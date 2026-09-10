const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { pool } = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { logActivity } = require('../services/activityLogService');

/** GET /api/workers - admin only. List with optional search. */
const listWorkers = asyncHandler(async (req, res) => {
  const { search } = req.query;
  const where = [`role = 'worker'`];
  const params = [];

  if (search) {
    where.push('(full_name LIKE ? OR email LIKE ?)');
    params.push(`%${search}%`, `%${search}%`);
  }

  const [rows] = await pool.query(
    `SELECT id, full_name, email, phone, status, must_change_password, last_login_at, created_at
     FROM users WHERE ${where.join(' AND ')} ORDER BY created_at DESC`,
    params
  );
  res.json({ success: true, data: rows });
});

/** GET /api/workers/:id - admin only. Profile + activity summary counts. */
const getWorkerById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const [rows] = await pool.query(
    `SELECT id, full_name, email, phone, status, must_change_password, last_login_at, created_at
     FROM users WHERE id = ? AND role = 'worker' LIMIT 1`,
    [id]
  );
  const worker = rows[0];
  if (!worker) throw new ApiError(404, 'Worker not found.');

  const [[ordersHandled]] = await pool.query(
    `SELECT COUNT(*) AS count FROM orders WHERE handled_by = ?`,
    [id]
  );
  const [[stockTakings]] = await pool.query(
    `SELECT COUNT(*) AS count FROM worker_stock_takings WHERE worker_id = ?`,
    [id]
  );
  const [[salaryDeductions]] = await pool.query(
    `SELECT COALESCE(SUM(amount), 0) AS total FROM salary_deductions WHERE worker_id = ? AND status = 'approved'`,
    [id]
  );
  const [recentActivity] = await pool.query(
    `SELECT action, description, created_at FROM activity_logs
     WHERE user_id = ? ORDER BY created_at DESC LIMIT 15`,
    [id]
  );

  res.json({
    success: true,
    data: {
      ...worker,
      stats: {
        ordersHandled: ordersHandled.count,
        stockTakings: stockTakings.count,
        approvedSalaryDeductions: salaryDeductions.total,
      },
      recentActivity,
    },
  });
});

/**
 * POST /api/workers - admin only. Creates a worker account.
 * If no password is supplied, a random temporary one is generated and
 * returned once in the response (admin should relay it to the worker).
 * New workers are always flagged must_change_password = 1.
 */
const createWorker = asyncHandler(async (req, res) => {
  const { fullName, email, phone, password } = req.body;

  if (!fullName?.trim() || !email?.trim()) {
    throw new ApiError(400, 'Full name and email are required.');
  }

  const [existing] = await pool.query('SELECT id FROM users WHERE email = ?', [email.trim().toLowerCase()]);
  if (existing.length > 0) {
    throw new ApiError(409, 'A user with this email already exists.');
  }

  const finalPassword = password?.trim() || crypto.randomBytes(6).toString('hex');
  const hash = await bcrypt.hash(finalPassword, 10);

  const [result] = await pool.query(
    `INSERT INTO users (full_name, email, phone, password_hash, role, status, must_change_password)
     VALUES (?, ?, ?, ?, 'worker', 'active', 1)`,
    [fullName.trim(), email.trim().toLowerCase(), phone?.trim() || null, hash]
  );

  await logActivity({
    userId: req.user.id,
    action: 'create_worker',
    description: `Created worker account for "${fullName}"`,
    relatedType: 'user',
    relatedId: result.insertId,
  });

  res.status(201).json({
    success: true,
    message: 'Worker account created.',
    data: { id: result.insertId, temporaryPassword: finalPassword },
  });
});

/** PUT /api/workers/:id - admin only. Edit profile fields. */
const updateWorker = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const [rows] = await pool.query(`SELECT * FROM users WHERE id = ? AND role = 'worker'`, [id]);
  const existing = rows[0];
  if (!existing) throw new ApiError(404, 'Worker not found.');

  const { fullName, phone, email } = req.body;

  if (email && email.trim().toLowerCase() !== existing.email) {
    const [dupe] = await pool.query('SELECT id FROM users WHERE email = ? AND id != ?', [email.trim().toLowerCase(), id]);
    if (dupe.length > 0) throw new ApiError(409, 'Another user already uses this email.');
  }

  await pool.query(
    `UPDATE users SET full_name = ?, phone = ?, email = ? WHERE id = ?`,
    [
      fullName?.trim() || existing.full_name,
      phone !== undefined ? phone?.trim() || null : existing.phone,
      email?.trim().toLowerCase() || existing.email,
      id,
    ]
  );

  await logActivity({
    userId: req.user.id,
    action: 'update_worker',
    description: `Updated worker profile "${fullName || existing.full_name}"`,
    relatedType: 'user',
    relatedId: Number(id),
  });

  res.json({ success: true, message: 'Worker updated.' });
});

/** PATCH /api/workers/:id/status - admin only. Activate/deactivate. */
const toggleWorkerStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  if (!['active', 'disabled'].includes(status)) {
    throw new ApiError(400, 'Status must be "active" or "disabled".');
  }

  const [rows] = await pool.query(`SELECT id, full_name FROM users WHERE id = ? AND role = 'worker'`, [id]);
  if (!rows[0]) throw new ApiError(404, 'Worker not found.');

  await pool.query('UPDATE users SET status = ? WHERE id = ?', [status, id]);
  await logActivity({
    userId: req.user.id,
    action: 'toggle_worker_status',
    description: `${status === 'active' ? 'Activated' : 'Disabled'} worker "${rows[0].full_name}"`,
    relatedType: 'user',
    relatedId: Number(id),
  });

  res.json({ success: true, message: `Worker account ${status === 'active' ? 'activated' : 'disabled'}.` });
});

/**
 * POST /api/workers/:id/reset-password - admin only.
 * Admin sets (or auto-generates) a new password for the worker; forces
 * them to change it again at their next login.
 */
const resetWorkerPassword = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { newPassword } = req.body;

  const [rows] = await pool.query(`SELECT id, full_name FROM users WHERE id = ? AND role = 'worker'`, [id]);
  if (!rows[0]) throw new ApiError(404, 'Worker not found.');

  const finalPassword = newPassword?.trim() || crypto.randomBytes(6).toString('hex');
  const hash = await bcrypt.hash(finalPassword, 10);

  await pool.query('UPDATE users SET password_hash = ?, must_change_password = 1 WHERE id = ?', [hash, id]);

  await logActivity({
    userId: req.user.id,
    action: 'reset_worker_password',
    description: `Reset password for worker "${rows[0].full_name}"`,
    relatedType: 'user',
    relatedId: Number(id),
  });

  res.json({
    success: true,
    message: 'Password reset. Share this new password with the worker securely.',
    data: { temporaryPassword: finalPassword },
  });
});

module.exports = { listWorkers, getWorkerById, createWorker, updateWorker, toggleWorkerStatus, resetWorkerPassword };
