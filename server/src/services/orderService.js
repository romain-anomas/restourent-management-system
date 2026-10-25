const { pool, withTransaction } = require('../config/db');
const ApiError = require('../utils/ApiError');
const { ensureActiveSession } = require('./tableService');
const crypto = require('crypto');

/**
 * Generates a unique, human-readable order number like ORD-20260908-0007.
 * Uses the configured prefix from restaurant_settings (falls back to "ORD")
 * and a per-day sequence. Runs inside the same connection/transaction as
 * the insert to keep the sequence reasonably accurate under load.
 */
async function generateOrderNumber(conn) {
  const [settingsRows] = await conn.query('SELECT order_prefix FROM restaurant_settings LIMIT 1');
  const prefix = settingsRows[0]?.order_prefix || 'ORD';

  const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, ''); // YYYYMMDD

  const [countRows] = await conn.query(
    `SELECT COUNT(*) AS cnt FROM orders WHERE DATE(created_at) = CURDATE()`
  );
  const sequence = String(Number(countRows[0].cnt) + 1).padStart(4, '0');

  return `${prefix}-${datePart}-${sequence}`;
}

/**
 * Creates a customer order + its line items inside a single transaction.
 * Prices are always looked up from the `products` table on the server -
 * the client only sends productId + quantity, never a price, so a
 * tampered request can't check out at a fake price.
 *
 * `items` = [{ productId, quantity }]
 * Does NOT touch inventory - stock is deducted when a worker/admin
 * confirms/processes the order (see business rules), not at checkout time.
 */
async function createOrder({ customerName, customerPhone, customerEmail, customerAddress, notes, items, paymentMethod, paymentReference, orderType = 'ONLINE', tableId, tableSessionId, tableSessionToken }) {
  if (!Array.isArray(items) || items.length === 0) {
    throw new ApiError(400, 'Your cart is empty.');
  }
  if (!['momo', 'airtel_money', 'card', ...(orderType === 'DINE_IN' ? ['cash'] : [])].includes(paymentMethod)) {
    throw new ApiError(400, 'Please choose a valid payment method.');
  }
  if (!['ONLINE', 'TAKEAWAY', 'DINE_IN'].includes(orderType)) {
    throw new ApiError(400, 'Invalid order type.');
  }
  if (orderType === 'DINE_IN' && (!Number.isInteger(Number(tableId)) || Number(tableId) < 1)) {
    throw new ApiError(400, 'Choose a table for dine-in orders.');
  }
  if (orderType !== 'DINE_IN' && tableId) {
    throw new ApiError(400, 'A table can only be selected for dine-in orders.');
  }

  const safeCustomerPhone = String(customerPhone || '').trim() || 'N/A';

  return withTransaction(async (conn) => {
    let tableSession = null;
    let tableSessionAccessToken = null;
    let continuingTableSession = false;
    let tableGuest = null;
    let billOrder = null;
    if (orderType === 'DINE_IN') {
      if (tableSessionId || tableSessionToken) {
        if (!Number.isInteger(Number(tableSessionId)) || Number(tableSessionId) < 1 || !/^[a-f0-9]{64}$/i.test(String(tableSessionToken || ''))) {
          throw new ApiError(400, 'The table session access details are invalid.');
        }
        const [tables] = await conn.query(
          'SELECT id, is_active FROM restaurant_tables WHERE id = ? FOR UPDATE',
          [Number(tableId)]
        );
        if (!tables[0] || !tables[0].is_active) throw new ApiError(404, 'Table not found.');
        const [sessions] = await conn.query(
          `SELECT * FROM table_sessions WHERE id = ? AND table_id = ? AND status = 'ACTIVE' FOR UPDATE`,
          [Number(tableSessionId), Number(tableId)]
        );
        const session = sessions[0];
        const suppliedHash = crypto.createHash('sha256').update(String(tableSessionToken)).digest('hex');
        const storedHash = session?.guest_access_token_hash;
        if (!storedHash || String(storedHash).length !== suppliedHash.length || !crypto.timingSafeEqual(Buffer.from(suppliedHash), Buffer.from(storedHash))) {
          throw new ApiError(409, 'This table session is closed or no longer accepts online orders. Please ask a team member for help.');
        }
        tableSession = session;
        continuingTableSession = true;
        const [guestRows] = await conn.query(
          `SELECT customer_name, customer_phone
           FROM orders WHERE table_session_id = ? AND status != 'cancelled'
           ORDER BY created_at ASC, id ASC LIMIT 1`,
          [tableSession.id]
        );
        tableGuest = guestRows[0];
        if (!tableGuest) throw new ApiError(409, 'The table bill could not be found. Please ask a team member for help.');
        const [billRows] = await conn.query(
          `SELECT * FROM orders
           WHERE table_session_id = ? AND status != 'cancelled' AND payment_status != 'paid'
           ORDER BY created_at ASC, id ASC LIMIT 1 FOR UPDATE`,
          [tableSession.id]
        );
        billOrder = billRows[0];
        if (!billOrder) throw new ApiError(409, 'This table bill has already been paid. Please ask a team member to reopen the table.');
      } else {
        tableSession = await ensureActiveSession(Number(tableId), null, conn, true);
        tableSessionAccessToken = crypto.randomBytes(32).toString('hex');
        const tokenHash = crypto.createHash('sha256').update(tableSessionAccessToken).digest('hex');
        await conn.query('UPDATE table_sessions SET guest_access_token_hash = ? WHERE id = ?', [tokenHash, tableSession.id]);
      }
    }
    // Lock and validate each product, and compute totals server-side
    let subtotal = 0;
    const lineItems = [];

    for (const item of items) {
      const qty = Number(item.quantity);
      if (!item.productId || !qty || qty <= 0) {
        throw new ApiError(400, 'Invalid item in cart.');
      }

      const [rows] = await conn.query(
        `SELECT id, name, selling_price, is_active, current_stock
         FROM products WHERE id = ? FOR UPDATE`,
        [item.productId]
      );
      const product = rows[0];
      if (!product || !product.is_active) {
        throw new ApiError(400, `"${item.name || 'A product'}" is no longer available.`);
      }

      const lineTotal = Number(product.selling_price) * qty;
      subtotal += lineTotal;

      lineItems.push({
        productId: product.id,
        productName: product.name,
        unitPrice: product.selling_price,
        quantity: qty,
        lineTotal,
      });
    }

    const [settingsRows] = await conn.query('SELECT tax_percent FROM restaurant_settings LIMIT 1');
    const taxPercent = Number(settingsRows[0]?.tax_percent || 0);
    const tax = Math.round((subtotal * taxPercent) / 100);
    const discount = 0;
    const totalAmount = subtotal + tax - discount;

    if (continuingTableSession) {
      const combinedSubtotal = Number(billOrder.subtotal || 0) + subtotal;
      const combinedDiscount = Number(billOrder.discount || 0);
      const combinedTax = Math.round((combinedSubtotal * taxPercent) / 100);
      const combinedTotal = combinedSubtotal + combinedTax - combinedDiscount;
      for (const li of lineItems) {
        await conn.query(
          `INSERT INTO order_items (order_id, product_id, product_name, unit_price, quantity, line_total)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [billOrder.id, li.productId, li.productName, li.unitPrice, li.quantity, li.lineTotal]
        );
      }

      await conn.query(
        `UPDATE orders
         SET subtotal = ?, discount = ?, tax = ?, total_amount = ?, status = 'pending',
             payment_status = 'unpaid', payment_method = ?,
             payment_reference = COALESCE(?, payment_reference),
             notes = CASE WHEN ? IS NULL OR ? = '' THEN notes
                          WHEN notes IS NULL OR notes = '' THEN ?
                          ELSE CONCAT(notes, '\\n', ?) END
         WHERE id = ?`,
        [combinedSubtotal, combinedDiscount, combinedTax, combinedTotal, paymentMethod,
          paymentReference?.trim() || null, notes?.trim() || null, notes?.trim() || null,
          notes?.trim() || null, notes?.trim() || null, billOrder.id]
      );
      await conn.query(
        `INSERT INTO order_status_history (order_id, old_status, new_status, changed_by, note)
         VALUES (?, ?, 'pending', NULL, 'Additional items added to the open dine-in bill')`,
        [billOrder.id, billOrder.status]
      );
      await conn.query(
        `UPDATE invoices SET subtotal = ?, discount = ?, tax = ?, grand_total = ?, payment_status = 'unpaid'
         WHERE order_id = ?`,
        [combinedSubtotal, combinedDiscount, combinedTax, combinedTotal, billOrder.id]
      );

      return {
        id: billOrder.id,
        orderNumber: billOrder.order_number,
        subtotal: combinedSubtotal,
        discount: combinedDiscount,
        tax: combinedTax,
        totalAmount: combinedTotal,
        status: 'pending',
        paymentStatus: 'unpaid',
        paymentMethod,
        paymentReference: paymentReference?.trim() || billOrder.payment_reference || null,
        orderType,
        tableId: Number(tableId),
        tableSessionId: tableSession.id,
        tableSessionAccessToken: null,
        customerName: tableGuest.customer_name,
        customerPhone: tableGuest.customer_phone,
        isAdditionalOrder: true,
        items: lineItems,
      };
    }

    const orderNumber = await generateOrderNumber(conn);

    const [orderResult] = await conn.query(
      `INSERT INTO orders
        (order_number, customer_name, customer_phone, customer_email, customer_address, notes,
         subtotal, discount, tax, total_amount, status, payment_status, payment_method, payment_reference,
         order_type, table_id, table_session_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', 'unpaid', ?, ?, ?, ?, ?)`,
      [
        orderNumber, customerName, safeCustomerPhone, customerEmail?.trim() || null, customerAddress || null, notes || null,
        subtotal, discount, tax, totalAmount, paymentMethod, paymentReference?.trim() || null,
        orderType, orderType === 'DINE_IN' ? Number(tableId) : null, tableSession?.id || null,
      ]
    );
    const orderId = orderResult.insertId;

    for (const li of lineItems) {
      await conn.query(
        `INSERT INTO order_items (order_id, product_id, product_name, unit_price, quantity, line_total)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [orderId, li.productId, li.productName, li.unitPrice, li.quantity, li.lineTotal]
      );
    }

    await conn.query(
      `INSERT INTO order_status_history (order_id, old_status, new_status, changed_by, note)
       VALUES (?, NULL, 'pending', NULL, 'Order placed by customer')`,
      [orderId]
    );

    return {
      id: orderId,
      orderNumber,
      subtotal,
      discount,
      tax,
      totalAmount,
      status: 'pending',
      paymentMethod,
      paymentReference: paymentReference?.trim() || null,
      orderType,
      tableId: orderType === 'DINE_IN' ? Number(tableId) : null,
      tableSessionId: tableSession?.id || null,
      tableSessionAccessToken,
      customerName,
      customerPhone: safeCustomerPhone,
      isAdditionalOrder: false,
      items: lineItems,
    };
  });
}

async function getOrderByNumber(orderNumber) {
  const [orderRows] = await pool.query(
    `SELECT o.id, o.order_number, o.customer_name, o.customer_phone, o.customer_address, o.notes,
            o.subtotal, o.discount, o.tax, o.total_amount, o.status, o.payment_status,
            o.payment_method, o.payment_reference, o.order_type, o.table_id,
            t.table_number, t.table_name, o.created_at
     FROM orders o LEFT JOIN restaurant_tables t ON t.id = o.table_id
     WHERE order_number = ? LIMIT 1`,
    [orderNumber]
  );
  const order = orderRows[0];
  if (!order) {
    throw new ApiError(404, 'Order not found.');
  }

  const [items] = await pool.query(
    `SELECT product_id, product_name, unit_price, quantity, line_total
     FROM order_items WHERE order_id = ?`,
    [order.id]
  );

  return { ...order, items };
}

/**
 * Creates an order on behalf of a walk-in/phone customer, recorded directly
 * by an admin or worker (e.g. from the Orders page "New Order" button).
 *
 * Unlike the public checkout flow, this order is created already
 * `confirmed` and deducts inventory immediately - staff are recording a
 * sale that's happening right now, not something that needs a separate
 * confirmation step later. Payment method is optional and may include
 * "cash" (not offered on the public site, since that's for in-person use
 * only). If `markPaid` is true (or paymentMethod is "cash"), payment_status
 * is set to "paid" immediately.
 *
 * `items` = [{ productId, quantity }]
 */
async function createManualOrder({
  customerName, customerPhone, customerAddress, notes, items,
  paymentMethod, paymentReference, markPaid, createdByUserId,
}) {
  if (!Array.isArray(items) || items.length === 0) {
    throw new ApiError(400, 'Please add at least one product to the order.');
  }
  if (paymentMethod && !['momo', 'airtel_money', 'cash', 'card'].includes(paymentMethod)) {
    throw new ApiError(400, 'Invalid payment method.');
  }

  const safeCustomerPhone = String(customerPhone || '').trim() || 'N/A';

  return withTransaction(async (conn) => {
    let subtotal = 0;
    const lineItems = [];

    // Validate, lock, and deduct stock for every product up front
    for (const item of items) {
      const qty = Number(item.quantity);
      if (!item.productId || !qty || qty <= 0) {
        throw new ApiError(400, 'Every item needs a product and a positive quantity.');
      }

      const [rows] = await conn.query(
        `SELECT id, name, selling_price, is_active, current_stock, allow_negative_stock
         FROM products WHERE id = ? FOR UPDATE`,
        [item.productId]
      );
      const product = rows[0];
      if (!product || !product.is_active) {
        throw new ApiError(400, `"${item.name || 'A product'}" is not available.`);
      }

      const previousStock = Number(product.current_stock);
      const newStock = previousStock - qty;
      if (newStock < 0 && !product.allow_negative_stock) {
        throw new ApiError(409, `Not enough stock for "${product.name}" (have ${previousStock}, need ${qty}).`);
      }

      const lineTotal = Number(product.selling_price) * qty;
      subtotal += lineTotal;

      lineItems.push({
        productId: product.id,
        productName: product.name,
        unitPrice: product.selling_price,
        quantity: qty,
        lineTotal,
        previousStock,
        newStock,
      });
    }

    const [settingsRows] = await conn.query('SELECT tax_percent FROM restaurant_settings LIMIT 1');
    const taxPercent = Number(settingsRows[0]?.tax_percent || 0);
    const tax = Math.round((subtotal * taxPercent) / 100);
    const discount = 0;
    const totalAmount = subtotal + tax - discount;

    const orderNumber = await generateOrderNumber(conn);
    const paymentStatus = markPaid || paymentMethod === 'cash' ? 'paid' : 'unpaid';

    const [orderResult] = await conn.query(
      `INSERT INTO orders
        (order_number, customer_name, customer_phone, customer_address, notes,
         subtotal, discount, tax, total_amount, status, payment_status, payment_method,
         payment_reference, handled_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'confirmed', ?, ?, ?, ?)`,
      [
        orderNumber, customerName, safeCustomerPhone, customerAddress || null, notes || null,
        subtotal, discount, tax, totalAmount, paymentStatus, paymentMethod || null,
        paymentReference?.trim() || null, createdByUserId,
      ]
    );
    const orderId = orderResult.insertId;

    for (const li of lineItems) {
      await conn.query(
        `INSERT INTO order_items (order_id, product_id, product_name, unit_price, quantity, line_total)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [orderId, li.productId, li.productName, li.unitPrice, li.quantity, li.lineTotal]
      );

      await conn.query('UPDATE products SET current_stock = ? WHERE id = ?', [li.newStock, li.productId]);

      await conn.query(
        `INSERT INTO inventory_transactions
          (product_id, type, quantity, previous_stock, new_stock, related_order_id, reason, created_by)
         VALUES (?, 'order_deduction', ?, ?, ?, ?, ?, ?)`,
        [li.productId, li.quantity, li.previousStock, li.newStock, orderId, 'Walk-in/phone order recorded by staff', createdByUserId]
      );
    }

    await conn.query(
      `INSERT INTO order_status_history (order_id, old_status, new_status, changed_by, note)
       VALUES (?, NULL, 'confirmed', ?, 'Order recorded directly by staff')`,
      [orderId, createdByUserId]
    );

    return {
      id: orderId,
      orderNumber,
      subtotal,
      discount,
      tax,
      totalAmount,
      status: 'confirmed',
      paymentStatus,
      paymentMethod: paymentMethod || null,
      items: lineItems,
    };
  });
}

module.exports = { createOrder, createManualOrder, getOrderByNumber, generateOrderNumber };
