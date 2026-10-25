const { pool, withTransaction } = require('../config/db');
const ApiError = require('../utils/ApiError');
const crypto = require('crypto');

async function generateSessionNumber(conn) {
  const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const [countRows] = await conn.query(
    `SELECT COUNT(*) AS cnt FROM table_sessions WHERE DATE(created_at) = CURDATE()`
  );
  const sequence = String(Number(countRows[0].cnt) + 1).padStart(4, '0');
  return `TS-${datePart}-${sequence}`;
}

async function getActiveTableSession(tableId, conn = pool) {
  const [rows] = await conn.query(
    `SELECT * FROM table_sessions WHERE table_id = ? AND status IN ('ACTIVE', 'PAYMENT_PENDING') ORDER BY opened_at DESC LIMIT 1`,
    [tableId]
  );
  return rows[0] || null;
}

async function ensureActiveSession(tableId, openedBy = null, conn = pool, requireAvailable = false) {
  if (!tableId) {
    throw new ApiError(400, 'A table is required for dine-in orders.');
  }

  const [tableRows] = await conn.query(
    `SELECT id, table_number, status FROM restaurant_tables WHERE id = ? AND is_active = 1 FOR UPDATE`,
    [tableId]
  );
  const table = tableRows[0];
  if (!table) {
    throw new ApiError(404, 'Table not found.');
  }
  if (requireAvailable && table.status !== 'AVAILABLE') {
    throw new ApiError(409, 'This table is occupied. Please choose another available table.');
  }
  if (table.status === 'RESERVED') {
    throw new ApiError(409, 'This table is reserved. Please choose another table.');
  }
  if (table.status === 'PAYMENT_PENDING') {
    throw new ApiError(409, 'This table is waiting for payment. Please choose another table.');
  }

  let session = await getActiveTableSession(tableId, conn);
  if (session) {
    if (requireAvailable) {
      throw new ApiError(409, 'This table has already been occupied. Please choose another available table.');
    }
    if (session.status === 'PAYMENT_PENDING') {
      throw new ApiError(409, 'This table is waiting for payment. Please choose another table.');
    }
    await conn.query(
      `UPDATE restaurant_tables SET status = ? WHERE id = ?`,
      [session.status === 'PAYMENT_PENDING' ? 'PAYMENT_PENDING' : 'ORDERING', tableId]
    );
    return session;
  }

  const sessionNumber = await generateSessionNumber(conn);
  const [result] = await conn.query(
    `INSERT INTO table_sessions (table_id, session_number, status, opened_by, opened_at)
     VALUES (?, ?, 'ACTIVE', ?, NOW())`,
    [tableId, sessionNumber, openedBy || null]
  );

  await conn.query(
    `UPDATE restaurant_tables SET status = 'ORDERING' WHERE id = ?`,
    [tableId]
  );

  const [sessionRows] = await conn.query(
    `SELECT * FROM table_sessions WHERE id = ? LIMIT 1`,
    [result.insertId]
  );
  return sessionRows[0];
}

async function closeTableSession(sessionId, closedBy = null, conn = pool) {
  if (conn === pool) {
    return withTransaction((transaction) => closeTableSession(sessionId, closedBy, transaction));
  }

  const [sessionRows] = await conn.query(
    `SELECT id, table_id, status FROM table_sessions WHERE id = ? FOR UPDATE`,
    [sessionId]
  );
  const session = sessionRows[0];
  if (!session) {
    throw new ApiError(404, 'Table session not found.');
  }

  await conn.query('SELECT id FROM restaurant_tables WHERE id = ? FOR UPDATE', [session.table_id]);
  if (session.status === 'CLOSED') {
    throw new ApiError(409, 'This table session is already closed.');
  }

  const [unpaidRows] = await conn.query(
    `SELECT order_number FROM orders
     WHERE table_session_id = ? AND status != 'cancelled' AND payment_status != 'paid'
     ORDER BY created_at ASC`,
    [sessionId]
  );
  if (unpaidRows.length) {
    const orderNumbers = unpaidRows.map((order) => order.order_number).join(', ');
    throw new ApiError(409, `Payment must be completed for all table orders before closing. Outstanding: ${orderNumbers}.`);
  }

  const totalAmount = Number(
    (
      await conn.query(
        `SELECT COALESCE(SUM(total_amount),0) AS total
         FROM orders WHERE table_session_id = ? AND status != 'cancelled'`,
        [sessionId]
      )
    )[0][0].total
  );

  await conn.query(
    `UPDATE table_sessions SET status = 'CLOSED', closed_by = ?, closed_at = NOW(), total_amount = ?, guest_access_token_hash = NULL WHERE id = ?`,
    [closedBy || null, totalAmount, sessionId]
  );

  await conn.query(
    `UPDATE restaurant_tables SET status = 'AVAILABLE' WHERE id = ?`,
    [session.table_id]
  );

  return { ...session, total_amount: totalAmount, status: 'CLOSED' };
}

// Repair sessions paid before the automatic-close flow was deployed and
// reconcile a session if payment was completed through another staff flow.
// Empty manually-opened sessions are left for staff to close explicitly.
async function closeFullyPaidTableSessions() {
  const [sessions] = await pool.query(
    `SELECT s.id,
            SUM(CASE WHEN o.id IS NOT NULL AND o.status != 'cancelled' THEN 1 ELSE 0 END) AS order_count,
            SUM(CASE WHEN o.id IS NOT NULL AND o.status != 'cancelled' AND o.payment_status != 'paid' THEN 1 ELSE 0 END) AS unpaid_count
     FROM table_sessions s
     LEFT JOIN orders o ON o.table_session_id = s.id
     WHERE s.status IN ('ACTIVE', 'PAYMENT_PENDING')
     GROUP BY s.id
     HAVING order_count > 0 AND unpaid_count = 0`
  );
  for (const session of sessions) {
    try {
      await closeTableSession(session.id);
    } catch (err) {
      // Another request may have closed the session or a new unpaid order
      // may have arrived after the aggregate query.
      if (err.statusCode !== 409) throw err;
    }
  }
}

async function getGuestTableSession(sessionId, accessToken) {
  if (!Number.isInteger(Number(sessionId)) || Number(sessionId) < 1 || !/^[a-f0-9]{64}$/i.test(String(accessToken || ''))) {
    throw new ApiError(404, 'Active table session not found.');
  }
  const tokenHash = crypto.createHash('sha256').update(String(accessToken)).digest('hex');
  const [sessionRows] = await pool.query(
    `SELECT s.id, s.session_number, s.table_id, s.status, s.opened_at,
            t.table_number, t.table_name, t.capacity
     FROM table_sessions s
     JOIN restaurant_tables t ON t.id = s.table_id
     WHERE s.id = ? AND s.guest_access_token_hash = ? AND s.status = 'ACTIVE' LIMIT 1`,
    [Number(sessionId), tokenHash]
  );
  const session = sessionRows[0];
  if (!session) throw new ApiError(404, 'Active table session not found.');

  const [rows] = await pool.query(
    `SELECT o.id, o.order_number, o.customer_name, o.customer_phone, o.payment_method,
            o.total_amount, o.payment_status, o.created_at,
            oi.id AS item_id, oi.product_name, oi.quantity, oi.line_total
     FROM orders o
     LEFT JOIN order_items oi ON oi.order_id = o.id
     WHERE o.table_session_id = ? AND o.status != 'cancelled'
     ORDER BY o.created_at ASC, oi.id ASC`,
    [session.id]
  );
  const orderMap = new Map();
  for (const row of rows) {
    if (!orderMap.has(row.id)) {
      orderMap.set(row.id, { id: row.id, order_number: row.order_number, customer_name: row.customer_name, customer_phone: row.customer_phone, payment_method: row.payment_method, total_amount: Number(row.total_amount), payment_status: row.payment_status, created_at: row.created_at, items: [] });
    }
    if (row.item_id) orderMap.get(row.id).items.push({ name: row.product_name, quantity: Number(row.quantity), line_total: Number(row.line_total) });
  }
  const orders = [...orderMap.values()];
  const guestOrder = orders[0];
  const openBill = orders.find((order) => order.payment_status !== 'paid');
  return {
    session,
    orders,
    guest: guestOrder ? { customerName: guestOrder.customer_name, customerPhone: guestOrder.customer_phone } : null,
    paymentMethod: openBill?.payment_method || guestOrder?.payment_method || null,
    totalAmount: orders.reduce((total, order) => total + order.total_amount, 0),
    unpaidAmount: orders.reduce((total, order) => total + (order.payment_status === 'paid' ? 0 : order.total_amount), 0),
  };
}

async function getSeatingPlan() {
  const [rows] = await pool.query(
    `SELECT t.id, t.table_number, t.table_name, t.capacity, t.status, t.position_x, t.position_y,
            t.section, t.is_active,
            s.id AS session_id, s.session_number, s.status AS session_status, s.opened_at, s.closed_at,
            COALESCE(COUNT(o.id), 0) AS active_order_count,
            COALESCE(SUM(CASE WHEN o.status != 'cancelled' THEN o.total_amount ELSE 0 END), 0) AS session_total
     FROM restaurant_tables t
     LEFT JOIN table_sessions s ON s.table_id = t.id AND s.status IN ('ACTIVE', 'PAYMENT_PENDING')
     LEFT JOIN orders o ON o.table_session_id = s.id AND o.status != 'cancelled'
     WHERE t.is_active = 1
     GROUP BY t.id
     ORDER BY CAST(t.table_number AS UNSIGNED), t.table_number` 
  );

  return rows.map((table) => ({
    ...table,
    session_total: Number(table.session_total || 0),
    active_order_count: Number(table.active_order_count || 0),
    table_status: table.session_id
      ? (table.session_status === 'PAYMENT_PENDING' ? 'PAYMENT_PENDING' : 'ORDERING')
      : (table.status || 'AVAILABLE'),
  }));
}

module.exports = {
  getActiveTableSession,
  ensureActiveSession,
  closeTableSession,
  closeFullyPaidTableSessions,
  getGuestTableSession,
  getSeatingPlan,
  generateSessionNumber,
};
