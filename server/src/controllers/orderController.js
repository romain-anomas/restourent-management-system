const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { pool, withTransaction } = require('../config/db');
const orderService = require('../services/orderService');
const { createNotification } = require('../services/notificationService');
const { logActivity } = require('../services/activityLogService');
const inventoryService = require('../services/inventoryService');

const TERMINAL_STATUSES = ['completed', 'cancelled'];
const VALID_STATUSES = ['pending', 'confirmed', 'preparing', 'ready', 'completed', 'cancelled'];

/**
 * POST /api/orders
 * Public checkout endpoint. Body:
 *   { customerName, customerPhone, customerAddress?, notes?, items: [{productId, quantity}] }
 */
const createOrder = asyncHandler(async (req, res) => {
  const { customerName, customerPhone, customerAddress, notes, items } = req.body;

  if (!customerName?.trim() || !customerPhone?.trim()) {
    throw new ApiError(400, 'Customer name and phone number are required.');
  }

  const order = await orderService.createOrder({
    customerName: customerName.trim(),
    customerPhone: customerPhone.trim(),
    customerAddress: customerAddress?.trim(),
    notes: notes?.trim(),
    items,
  });

  await createNotification({
    recipientRole: 'all',
    type: 'new_order',
    title: 'New order received',
    message: `Order ${order.orderNumber} from ${customerName} - ${order.items.length} item(s)`,
    relatedType: 'order',
    relatedId: order.id,
  });

  res.status(201).json({ success: true, message: 'Order placed successfully.', data: order });
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
            o.status, o.payment_status, o.created_at, u.full_name AS handled_by_name
     FROM orders o
     LEFT JOIN users u ON u.id = o.handled_by
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
    `SELECT o.*, u.full_name AS handled_by_name
     FROM orders o LEFT JOIN users u ON u.id = o.handled_by
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

module.exports = { createOrder, trackOrder, listOrders, getOrderById, updateOrderStatus };
