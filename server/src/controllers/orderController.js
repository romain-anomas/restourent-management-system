const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { pool, withTransaction } = require('../config/db');
const orderService = require('../services/orderService');
const { createNotification } = require('../services/notificationService');
const { logActivity } = require('../services/activityLogService');
const inventoryService = require('../services/inventoryService');
const momoService = require('../services/momoService');
const flutterwaveService = require('../services/flutterwaveService');
const { closeTableSession } = require('../services/tableService');

const TERMINAL_STATUSES = ['completed', 'cancelled'];
const VALID_STATUSES = ['pending', 'confirmed', 'preparing', 'ready', 'completed', 'cancelled'];

/**
 * POST /api/orders
 * Public checkout endpoint. Body:
 *   { customerName, customerPhone, customerAddress?, notes?, items: [{productId, quantity}] }
 */
const createOrder = asyncHandler(async (req, res) => {
  const { customerName, customerPhone, customerEmail, customerAddress, notes, items, paymentMethod, paymentReference, orderType, tableId, tableSessionId, tableSessionToken } = req.body;

  const isContinuingDineInSession = orderType === 'DINE_IN' && tableSessionId && tableSessionToken;
  if (!isContinuingDineInSession && (!customerName?.trim() || !customerPhone?.trim())) {
    throw new ApiError(400, 'Customer name and phone number are required.');
  }
  const isOnlineCardPayment = paymentMethod === 'card' && orderType !== 'DINE_IN';
  if (isOnlineCardPayment && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(customerEmail || '').trim())) {
    throw new ApiError(400, 'Enter a valid email address for your secure card payment receipt.');
  }
  if (isOnlineCardPayment && !flutterwaveService.isConfigured()) {
    throw new ApiError(503, 'Online card payments are not configured yet. Please choose another payment method.');
  }

  const order = await orderService.createOrder({
    customerName: customerName?.trim() || '',
    customerPhone: customerPhone?.trim() || '',
    customerEmail: customerEmail?.trim(),
    customerAddress: customerAddress?.trim(),
    notes: notes?.trim(),
    items,
    paymentMethod,
    paymentReference,
    orderType,
    tableId,
    tableSessionId,
    tableSessionToken,
  });

  await createNotification({
    recipientRole: 'all',
    type: 'new_order',
    title: 'New order received',
    message: order.isAdditionalOrder
      ? `Additional items added to table bill ${order.orderNumber} (${order.items.length} item(s))`
      : `Order ${order.orderNumber} from ${order.customerName || customerName} - ${order.items.length} item(s)`,
    relatedType: 'order',
    relatedId: order.id,
  });

  // If the customer chose MTN MoMo and it's configured, automatically push
  // a payment approval prompt to their phone. This is best-effort: if it
  // fails (MTN down, not configured, sandbox quirk, etc.) the order still
  // succeeds - the customer just falls back to paying manually using the
  // details shown on the confirmation page, and staff mark it paid later.
  let momoPromptSent = false;
  if (paymentMethod === 'momo' && orderType !== 'DINE_IN' && momoService.isConfigured()) {
    try {
      const { referenceId } = await momoService.requestToPay({
        amount: order.totalAmount,
        phone: customerPhone,
        externalId: order.id,
        payerMessage: `Payment for order ${order.orderNumber}`,
        payeeNote: `Order ${order.orderNumber}`,
      });
      await pool.query('UPDATE orders SET momo_reference_id = ? WHERE id = ?', [referenceId, order.id]);
      momoPromptSent = true;
    } catch (err) {
      console.error('MTN MoMo request-to-pay failed (order still created):', err.message);
    }
  }

  let cardCheckoutUrl = null;
  let cardCheckoutTxRef = null;
  if (isOnlineCardPayment) {
    try {
      const payment = await flutterwaveService.createCheckout(order.id);
      cardCheckoutUrl = payment.link;
      cardCheckoutTxRef = payment.txRef;
    } catch (err) {
      console.error('Flutterwave checkout creation failed:', err.message);
    }
  }

  res.status(201).json({ success: true, message: 'Order placed successfully.', data: { ...order, momoPromptSent, cardCheckoutUrl, cardCheckoutTxRef } });
});

/**
 * POST /api/orders/manual - admin/worker.
 * Records a walk-in/phone order directly, with one or more products.
 * The order is created already "confirmed" with inventory deducted
 * immediately, since staff are recording a sale happening right now.
 * Body:
 *   { customerName, customerPhone?, customerAddress?, notes?,
 *     items: [{productId, quantity}], paymentMethod?, paymentReference?, markPaid? }
 */
const createManualOrder = asyncHandler(async (req, res) => {
  const {
    customerName, customerPhone, customerAddress, notes, items,
    paymentMethod, paymentReference, markPaid,
  } = req.body;

  if (!customerName?.trim()) {
    throw new ApiError(400, 'Customer name is required.');
  }

  const order = await orderService.createManualOrder({
    customerName: customerName.trim(),
    customerPhone: customerPhone?.trim(),
    customerAddress: customerAddress?.trim(),
    notes: notes?.trim(),
    items,
    paymentMethod: paymentMethod || null,
    paymentReference,
    markPaid: !!markPaid,
    createdByUserId: req.user.id,
  });

  await logActivity({
    userId: req.user.id,
    action: 'create_manual_order',
    description: `Recorded walk-in/phone order ${order.orderNumber} for "${customerName}" (${order.items.length} item(s))`,
    relatedType: 'order',
    relatedId: order.id,
  });

  // Notify admins when a worker records a sale, for visibility
  if (req.user.role === 'worker') {
    await createNotification({
      recipientRole: 'admin',
      type: 'manual_order_recorded',
      title: 'Order recorded by worker',
      message: `${req.user.full_name} recorded order ${order.orderNumber} for "${customerName}"`,
      relatedType: 'order',
      relatedId: order.id,
    });
  }

  // Same best-effort automatic MoMo prompt as the public checkout flow
  let momoPromptSent = false;
  if (paymentMethod === 'momo' && customerPhone && momoService.isConfigured()) {
    try {
      const { referenceId } = await momoService.requestToPay({
        amount: order.totalAmount,
        phone: customerPhone,
        externalId: order.id,
        payerMessage: `Payment for order ${order.orderNumber}`,
        payeeNote: `Order ${order.orderNumber}`,
      });
      await pool.query('UPDATE orders SET momo_reference_id = ? WHERE id = ?', [referenceId, order.id]);
      momoPromptSent = true;
    } catch (err) {
      console.error('MTN MoMo request-to-pay failed (order still created):', err.message);
    }
  }

  res.status(201).json({ success: true, message: 'Order recorded.', data: { ...order, momoPromptSent } });
});

/** GET /api/orders/track/:orderNumber - public order lookup */
const trackOrder = asyncHandler(async (req, res) => {
  const order = await orderService.getOrderByNumber(req.params.orderNumber);
  res.json({ success: true, data: order });
});

/**
 * GET /api/orders - admin/worker. List orders with filters.
 * Query: status, search (order number/customer/phone), from, to (dates)
 */
const listOrders = asyncHandler(async (req, res) => {
  const { status, search, from, to } = req.query;

  const where = [];
  const params = [];

  if (status && VALID_STATUSES.includes(status)) {
    where.push('o.status = ?');
    params.push(status);
  }
  if (search) {
    where.push('(o.order_number LIKE ? OR o.customer_name LIKE ? OR o.customer_phone LIKE ?)');
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }
  if (from) {
    where.push('DATE(o.created_at) >= ?');
    params.push(from);
  }
  if (to) {
    where.push('DATE(o.created_at) <= ?');
    params.push(to);
  }

  const [rows] = await pool.query(
    `SELECT o.id, o.order_number, o.customer_name, o.customer_phone, o.total_amount,
            o.status, o.payment_status, o.payment_method, o.payment_reference, o.order_type,
            o.table_id, o.table_session_id, t.table_number, t.table_name, o.created_at, u.full_name AS handled_by_name,
            table_bill.table_session_total, table_bill.table_order_count, table_bill.latest_order_id
     FROM orders o
     LEFT JOIN users u ON u.id = o.handled_by
     LEFT JOIN restaurant_tables t ON t.id = o.table_id
     LEFT JOIN (
       SELECT table_session_id,
              SUM(CASE WHEN status != 'cancelled' THEN total_amount ELSE 0 END) AS table_session_total,
              SUM(CASE WHEN status != 'cancelled' THEN 1 ELSE 0 END) AS table_order_count,
              SUM(CASE WHEN status != 'cancelled' AND payment_status != 'paid' THEN 1 ELSE 0 END) AS table_unpaid_order_count,
              MAX(CASE WHEN status != 'cancelled' THEN id ELSE NULL END) AS latest_order_id
       FROM orders WHERE table_session_id IS NOT NULL GROUP BY table_session_id
     ) table_bill ON table_bill.table_session_id = o.table_session_id
     ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
     ORDER BY o.created_at DESC
     LIMIT 200`,
    params
  );

  res.json({ success: true, data: rows });
});

/** GET /api/orders/:id - admin/worker. Full order detail with items and status history. */
const getOrderById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const [orderRows] = await pool.query(
    `SELECT o.*, u.full_name AS handled_by_name, t.table_number, t.table_name
     FROM orders o LEFT JOIN users u ON u.id = o.handled_by
     LEFT JOIN restaurant_tables t ON t.id = o.table_id
     WHERE o.id = ? LIMIT 1`,
    [id]
  );
  const order = orderRows[0];
  if (!order) throw new ApiError(404, 'Order not found.');

  const [items] = await pool.query(
    `SELECT oi.*, p.image_path FROM order_items oi
     LEFT JOIN products p ON p.id = oi.product_id WHERE oi.order_id = ?`,
    [id]
  );

  const [history] = await pool.query(
    `SELECT h.old_status, h.new_status, h.note, h.created_at, u.full_name AS changed_by_name
     FROM order_status_history h LEFT JOIN users u ON u.id = h.changed_by
     WHERE h.order_id = ? ORDER BY h.created_at ASC`,
    [id]
  );

  const [invoiceRows] = await pool.query(
    `SELECT id, invoice_number, payment_status FROM invoices WHERE order_id = ? LIMIT 1`,
    [id]
  );

  res.json({ success: true, data: { ...order, items, history, invoice: invoiceRows[0] || null } });
});

/**
 * PUT /api/orders/:id/status - admin/worker.
 * Body: { status, note? }
 * Confirming an order deducts inventory (once). Cancelling a previously
 * confirmed order restocks it. Terminal states (completed/cancelled)
 * cannot be changed further.
 */
const updateOrderStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status, note } = req.body;

  if (!VALID_STATUSES.includes(status)) {
    throw new ApiError(400, 'Invalid order status.');
  }

  const result = await withTransaction(async (conn) => {
    const [orderRows] = await conn.query('SELECT * FROM orders WHERE id = ? FOR UPDATE', [id]);
    const order = orderRows[0];
    if (!order) throw new ApiError(404, 'Order not found.');

    if (TERMINAL_STATUSES.includes(order.status)) {
      throw new ApiError(409, `This order is already ${order.status} and cannot be changed further.`);
    }

    // Deduct inventory the first time an order is confirmed
    if (status === 'confirmed' && !(await inventoryService.hasExistingDeduction(conn, id))) {
      await inventoryService.deductStockForOrder(conn, id, req.user.id);
    }

    // Restock if a previously-confirmed order is now being cancelled
    if (status === 'cancelled' && (await inventoryService.hasExistingDeduction(conn, id))) {
      await inventoryService.restockCancelledOrder(conn, id, req.user.id);
    }

    await conn.query(
      `UPDATE orders SET status = ?, handled_by = COALESCE(handled_by, ?) WHERE id = ?`,
      [status, req.user.id, id]
    );

    await conn.query(
      `INSERT INTO order_status_history (order_id, old_status, new_status, changed_by, note)
       VALUES (?, ?, ?, ?, ?)`,
      [id, order.status, status, req.user.id, note || null]
    );

    return { orderNumber: order.order_number, oldStatus: order.status };
  });

  await logActivity({
    userId: req.user.id,
    action: 'update_order_status',
    description: `Order ${result.orderNumber}: ${result.oldStatus} → ${status}`,
    relatedType: 'order',
    relatedId: Number(id),
    oldValue: result.oldStatus,
    newValue: status,
  });

  res.json({ success: true, message: `Order status updated to ${status}.` });
});

/**
 * PATCH /api/orders/:id/payment-status - admin/worker.
 * Since MoMo/Airtel Money payments aren't verified automatically (no
 * payment gateway integration), staff check their phone for the payment
 * and mark it here once confirmed.
 * Body: { paymentStatus: 'unpaid' | 'paid' | 'refunded' }
 */
const updateOrderPaymentStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { paymentStatus } = req.body;

  if (!['unpaid', 'paid', 'refunded'].includes(paymentStatus)) {
    throw new ApiError(400, 'Invalid payment status.');
  }

  const result = await withTransaction(async (conn) => {
    const [rows] = await conn.query('SELECT id, order_number, table_session_id FROM orders WHERE id = ? FOR UPDATE', [id]);
    const order = rows[0];
    if (!order) throw new ApiError(404, 'Order not found.');

    await conn.query('UPDATE orders SET payment_status = ? WHERE id = ?', [paymentStatus, id]);
    // Keep any already-generated invoice's payment status in sync.
    await conn.query('UPDATE invoices SET payment_status = ? WHERE order_id = ?', [paymentStatus, id]);

    let tableSessionClosed = false;
    if (paymentStatus === 'paid' && order.table_session_id) {
      const [unpaidRows] = await conn.query(
        `SELECT COUNT(*) AS unpaid_count FROM orders
         WHERE table_session_id = ? AND status != 'cancelled' AND payment_status != 'paid'`,
        [order.table_session_id]
      );
      if (Number(unpaidRows[0].unpaid_count) === 0) {
        await closeTableSession(order.table_session_id, req.user.id, conn);
        tableSessionClosed = true;
      }
    }

    return { orderNumber: order.order_number, tableSessionClosed };
  });

  await logActivity({
    userId: req.user.id,
    action: 'update_order_payment_status',
    description: `Order ${result.orderNumber} payment marked as ${paymentStatus}${result.tableSessionClosed ? ' and table session closed' : ''}`,
    relatedType: 'order',
    relatedId: Number(id),
  });

  res.json({
    success: true,
    tableSessionClosed: result.tableSessionClosed,
    message: result.tableSessionClosed
      ? 'Payment complete. All table orders are paid and the table is available again.'
      : `Payment status updated to ${paymentStatus}.`,
  });
});

module.exports = { createOrder, createManualOrder, trackOrder, listOrders, getOrderById, updateOrderStatus, updateOrderPaymentStatus };
