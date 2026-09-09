const { pool, withTransaction } = require('../config/db');
const ApiError = require('../utils/ApiError');

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
async function createOrder({ customerName, customerPhone, customerAddress, notes, items }) {
  if (!Array.isArray(items) || items.length === 0) {
    throw new ApiError(400, 'Your cart is empty.');
  }

  return withTransaction(async (conn) => {
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

    const orderNumber = await generateOrderNumber(conn);

    const [orderResult] = await conn.query(
      `INSERT INTO orders
        (order_number, customer_name, customer_phone, customer_address, notes,
         subtotal, discount, tax, total_amount, status, payment_status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', 'unpaid')`,
      [orderNumber, customerName, customerPhone, customerAddress || null, notes || null, subtotal, discount, tax, totalAmount]
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
      items: lineItems,
    };
  });
}

async function getOrderByNumber(orderNumber) {
  const [orderRows] = await pool.query(
    `SELECT id, order_number, customer_name, customer_phone, customer_address, notes,
            subtotal, discount, tax, total_amount, status, payment_status, created_at
     FROM orders WHERE order_number = ? LIMIT 1`,
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

module.exports = { createOrder, getOrderByNumber, generateOrderNumber };
