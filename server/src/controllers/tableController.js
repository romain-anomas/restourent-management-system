const { pool } = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { ensureActiveSession, getActiveTableSession, closeTableSession, closeFullyPaidTableSessions, getSeatingPlan, getGuestTableSession } = require('../services/tableService');

const listTables = asyncHandler(async (req, res) => {
  await closeFullyPaidTableSessions();
  const includeInactive = req.query.all === '1' && req.user?.role === 'admin';
  const [rows] = await pool.query(
    `SELECT t.*, s.id AS session_id, s.id AS active_session_id, s.session_number, s.status AS session_status,
            CASE WHEN s.id IS NOT NULL AND s.status = 'PAYMENT_PENDING' THEN 'PAYMENT_PENDING'
                 WHEN s.id IS NOT NULL THEN 'ORDERING'
                 ELSE t.status END AS effective_status,
            s.opened_at,
            (SELECT COALESCE(SUM(o.total_amount), 0) FROM orders o WHERE o.table_session_id = s.id AND o.status != 'cancelled') AS session_total,
            (SELECT COUNT(*) FROM orders o WHERE o.table_session_id = s.id AND o.status != 'cancelled') AS active_order_count,
            (SELECT COUNT(*) FROM orders o WHERE o.table_session_id = s.id AND o.status != 'cancelled' AND o.payment_status != 'paid') AS unpaid_order_count
     FROM restaurant_tables t
     LEFT JOIN table_sessions s ON s.table_id = t.id AND s.status IN ('ACTIVE', 'PAYMENT_PENDING')
     ${includeInactive ? '' : 'WHERE t.is_active = 1'}
     ORDER BY CAST(t.table_number AS UNSIGNED), t.table_number`
  );

  res.json({ success: true, data: rows });
});

const getTableOrders = asyncHandler(async (req, res) => {
  const tableId = Number(req.params.id);
  if (!Number.isInteger(tableId) || tableId < 1) throw new ApiError(400, 'Invalid table.');

  const session = await getActiveTableSession(tableId);
  if (!session) {
    return res.json({ success: true, data: { session: null, orders: [] } });
  }

  const [rows] = await pool.query(
    `SELECT o.id, o.order_number, o.customer_name, o.customer_phone, o.total_amount,
            o.status, o.payment_status, o.payment_method, o.payment_reference, o.created_at,
            oi.id AS item_id, oi.product_name, oi.quantity, oi.line_total
     FROM orders o
     LEFT JOIN order_items oi ON oi.order_id = o.id
     WHERE o.table_session_id = ? AND o.status != 'cancelled'
     ORDER BY o.created_at DESC, oi.id ASC`,
    [session.id]
  );

  const orderMap = new Map();
  for (const row of rows) {
    if (!orderMap.has(row.id)) {
      orderMap.set(row.id, {
        id: row.id,
        order_number: row.order_number,
        customer_name: row.customer_name,
        customer_phone: row.customer_phone,
        total_amount: Number(row.total_amount),
        status: row.status,
        payment_status: row.payment_status,
        payment_method: row.payment_method,
        payment_reference: row.payment_reference,
        created_at: row.created_at,
        items: [],
      });
    }
    if (row.item_id) {
      orderMap.get(row.id).items.push({
        name: row.product_name,
        quantity: Number(row.quantity),
        line_total: Number(row.line_total),
      });
    }
  }

  res.json({ success: true, data: { session, orders: [...orderMap.values()] } });
});

// The public seating plan shows every active table. The derived status keeps
// active sessions visibly occupied even if a table's stored status is stale.
const listPublicTables = asyncHandler(async (req, res) => {
  await closeFullyPaidTableSessions();
  const [rows] = await pool.query(
    `SELECT t.id, t.table_number, t.table_name, t.capacity, t.section, t.position_x, t.position_y,
            CASE WHEN s.id IS NOT NULL AND s.status = 'PAYMENT_PENDING' THEN 'PAYMENT_PENDING'
                 WHEN s.id IS NOT NULL THEN 'ORDERING'
                 ELSE t.status END AS status,
            s.id AS session_id, s.status AS session_status
     FROM restaurant_tables t
     LEFT JOIN table_sessions s ON s.table_id = t.id AND s.status IN ('ACTIVE', 'PAYMENT_PENDING')
     WHERE t.is_active = 1
     ORDER BY t.section, CAST(t.table_number AS UNSIGNED), t.table_number`
  );
  res.json({ success: true, data: rows });
});

const getPublicGuestSession = asyncHandler(async (req, res) => {
  const data = await getGuestTableSession(req.params.sessionId, req.get('x-table-session-token'));
  res.json({ success: true, data });
});

const createTable = asyncHandler(async (req, res) => {
  const { tableNumber, tableName, capacity, status = 'AVAILABLE', section = null, positionX = null, positionY = null } = req.body;

  if (!tableNumber || !String(tableNumber).trim()) {
    throw new ApiError(400, 'Table number is required.');
  }

  const capacityNumber = Number(capacity || 2);
  if (!Number.isFinite(capacityNumber) || capacityNumber < 1) {
    throw new ApiError(400, 'Table capacity must be at least 1.');
  }
  const x = positionX === '' || positionX == null ? null : Number(positionX);
  const y = positionY === '' || positionY == null ? null : Number(positionY);
  if ((x !== null && (!Number.isFinite(x) || x < 0 || x > 100)) || (y !== null && (!Number.isFinite(y) || y < 0 || y > 100))) {
    throw new ApiError(400, 'Map positions must be between 0 and 100.');
  }

  const validStatuses = ['AVAILABLE', 'OCCUPIED', 'ORDERING', 'PAYMENT_PENDING', 'RESERVED'];
  const normalizedStatus = validStatuses.includes(String(status).toUpperCase()) ? String(status).toUpperCase() : 'AVAILABLE';

  const [result] = await pool.query(
    `INSERT INTO restaurant_tables (table_number, table_name, capacity, status, section, position_x, position_y, is_active)
     VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
    [String(tableNumber).trim(), tableName?.trim() || null, capacityNumber, normalizedStatus, section?.trim() || null, x, y]
  );

  const [rows] = await pool.query('SELECT * FROM restaurant_tables WHERE id = ? LIMIT 1', [result.insertId]);
  res.status(201).json({ success: true, message: 'Table created.', data: rows[0] });
});

const updateTable = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { tableNumber, tableName, capacity, status, section, positionX, positionY } = req.body;

  const [rows] = await pool.query('SELECT * FROM restaurant_tables WHERE id = ? LIMIT 1', [id]);
  const existing = rows[0];
  if (!existing) throw new ApiError(404, 'Table not found.');

  const [sessions] = await pool.query(
    `SELECT id FROM table_sessions WHERE table_id = ? AND status IN ('ACTIVE', 'PAYMENT_PENDING') LIMIT 1`,
    [id]
  );
  if (sessions[0] && status === 'AVAILABLE') {
    throw new ApiError(409, 'Close the active table session before marking this table available.');
  }

  const nextNumber = tableNumber?.trim() || existing.table_number;
  const nextCapacity = Number(capacity ?? existing.capacity);
  if (!Number.isFinite(nextCapacity) || nextCapacity < 1) {
    throw new ApiError(400, 'Table capacity must be at least 1.');
  }
  const x = positionX === undefined ? existing.position_x : (positionX === '' || positionX == null ? null : Number(positionX));
  const y = positionY === undefined ? existing.position_y : (positionY === '' || positionY == null ? null : Number(positionY));
  if ((x !== null && (!Number.isFinite(Number(x)) || Number(x) < 0 || Number(x) > 100)) || (y !== null && (!Number.isFinite(Number(y)) || Number(y) < 0 || Number(y) > 100))) {
    throw new ApiError(400, 'Map positions must be between 0 and 100.');
  }
  const validStatuses = ['AVAILABLE', 'OCCUPIED', 'ORDERING', 'PAYMENT_PENDING', 'RESERVED'];
  const nextStatus = status ? (validStatuses.includes(String(status).toUpperCase()) ? String(status).toUpperCase() : existing.status) : existing.status;

  await pool.query(
    `UPDATE restaurant_tables SET table_number = ?, table_name = ?, capacity = ?, status = ?, section = ?, position_x = ?, position_y = ?, is_active = 1, updated_at = NOW() WHERE id = ?`,
    [nextNumber, tableName?.trim() || existing.table_name, nextCapacity, nextStatus, section?.trim() || existing.section, x, y, id]
  );

  const [updated] = await pool.query('SELECT * FROM restaurant_tables WHERE id = ? LIMIT 1', [id]);
  res.json({ success: true, message: 'Table updated.', data: updated[0] });
});

const deleteTable = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const [rows] = await pool.query('SELECT * FROM restaurant_tables WHERE id = ? LIMIT 1', [id]);
  if (!rows[0]) throw new ApiError(404, 'Table not found.');

  const [sessions] = await pool.query(
    `SELECT id FROM table_sessions WHERE table_id = ? AND status IN ('ACTIVE', 'PAYMENT_PENDING') LIMIT 1`,
    [id]
  );
  if (sessions[0]) throw new ApiError(409, 'Close the active table session before deactivating this table.');

  await pool.query('UPDATE restaurant_tables SET is_active = 0, status = ? WHERE id = ?', ['AVAILABLE', id]);
  res.json({ success: true, message: 'Table deactivated.' });
});

const getSeatingPlanData = asyncHandler(async (req, res) => {
  const seatingPlan = await getSeatingPlan();
  res.json({ success: true, data: seatingPlan });
});

const openTableSession = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const session = await ensureActiveSession(Number(id), req.user?.id || null);
  res.status(201).json({ success: true, message: 'Table session opened.', data: session });
});

const getActiveSession = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const session = await getActiveTableSession(Number(id));
  res.json({ success: true, data: session });
});

const closeTableSessionForTable = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const session = await getActiveTableSession(Number(id));
  if (!session) {
    throw new ApiError(404, 'No active session found for this table.');
  }
  const closed = await closeTableSession(session.id, req.user?.id || null);
  res.json({ success: true, message: 'Table session closed.', data: closed });
});

module.exports = {
  listTables,
  listPublicTables,
  getPublicGuestSession,
  createTable,
  updateTable,
  deleteTable,
  getSeatingPlanData,
  getTableOrders,
  openTableSession,
  getActiveSession,
  closeTableSessionForTable,
};
