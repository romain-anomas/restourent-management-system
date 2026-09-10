const bcrypt = require('bcryptjs');
const { pool } = require('../config/db');
const { signToken } = require('../utils/jwt');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { logActivity } = require('../services/activityLogService');

/**
 * POST /api/auth/login
 * Body: { email, password, role }  role is 'admin' or 'worker' - the
 * user must select which portal they are logging into, and the account's
 * actual role must match it (an admin account cannot log in as "worker").
 */
const login = asyncHandler(async (req, res) => {
  const { email, password, role } = req.body;

  if (!email || !password || !role) {
    throw new ApiError(400, 'Email, password and role are required.');
  }
  if (!['admin', 'worker'].includes(role)) {
    throw new ApiError(400, 'Role must be either "admin" or "worker".');
  }

  const [rows] = await pool.query(
    `SELECT id, full_name, email, password_hash, role, status, must_change_password
     FROM users WHERE email = ? LIMIT 1`,
    [email.trim().toLowerCase()]
  );
  const user = rows[0];

  // Same generic message whether the email doesn't exist or the password
  // is wrong - avoids leaking which emails are registered.
  if (!user) {
    throw new ApiError(401, 'Invalid email or password.');
  }

  const passwordMatches = await bcrypt.compare(password, user.password_hash);
  if (!passwordMatches) {
    throw new ApiError(401, 'Invalid email or password.');
  }

  if (user.role !== role) {
    throw new ApiError(401, `This account is not registered as ${role}. Try the ${user.role} login instead.`);
  }

  if (user.status !== 'active') {
    throw new ApiError(403, 'This account has been disabled. Contact the administrator.');
  }

  await pool.query('UPDATE users SET last_login_at = NOW() WHERE id = ?', [user.id]);

  const token = signToken({ id: user.id, role: user.role });

  await logActivity({
    userId: user.id,
    action: 'login',
    description: `${user.role} logged in`,
    ipAddress: req.ip,
  });

  res.json({
    success: true,
    message: 'Login successful.',
    data: {
      token,
      user: {
        id: user.id,
        fullName: user.full_name,
        email: user.email,
        role: user.role,
        mustChangePassword: !!user.must_change_password,
      },
    },
  });
});

/**
 * GET /api/auth/me
 * Returns the currently authenticated user (used to restore session on refresh).
 */
const getCurrentUser = asyncHandler(async (req, res) => {
  res.json({
    success: true,
    data: {
      id: req.user.id,
      fullName: req.user.full_name,
      email: req.user.email,
      phone: req.user.phone,
      role: req.user.role,
      mustChangePassword: !!req.user.must_change_password,
    },
  });
});

/**
 * POST /api/auth/change-password
 * Body: { currentPassword, newPassword }
 * Works for both admin and worker - they can only change their own password here.
 */
const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    throw new ApiError(400, 'Current password and new password are required.');
  }
  if (newPassword.length < 8) {
    throw new ApiError(400, 'New password must be at least 8 characters long.');
  }

  const [rows] = await pool.query('SELECT password_hash FROM users WHERE id = ?', [req.user.id]);
  const user = rows[0];
  if (!user) {
    throw new ApiError(404, 'User not found.');
  }

  const matches = await bcrypt.compare(currentPassword, user.password_hash);
  if (!matches) {
    throw new ApiError(401, 'Current password is incorrect.');
  }

  const newHash = await bcrypt.hash(newPassword, 10);
  await pool.query(
    'UPDATE users SET password_hash = ?, must_change_password = 0 WHERE id = ?',
    [newHash, req.user.id]
  );

  await logActivity({
    userId: req.user.id,
    action: 'change_password',
    description: 'User changed their own password',
  });

  res.json({ success: true, message: 'Password changed successfully.' });
});

/**
 * POST /api/auth/logout
 * JWTs are stateless, so logout is handled by the client discarding the
 * token. This endpoint exists mainly to record the activity log entry
 * and give the frontend a clean call to make.
 */
const logout = asyncHandler(async (req, res) => {
  if (req.user) {
    await logActivity({
      userId: req.user.id,
      action: 'logout',
      description: `${req.user.role} logged out`,
    });
  }
  res.json({ success: true, message: 'Logged out successfully.' });
});

module.exports = { login, getCurrentUser, changePassword, logout };
