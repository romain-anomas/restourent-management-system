const { verifyToken } = require('../utils/jwt');
const { pool } = require('../config/db');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');

/**
 * Requires a valid JWT in the Authorization header ("Bearer <token>").
 * Loads the current user from the database (so disabled/deleted users
 * are rejected immediately, not just when their old token expires)
 * and attaches a safe subset to req.user.
 */
const authenticate = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    throw new ApiError(401, 'Authentication required. Please log in.');
  }

  let decoded;
  try {
    decoded = verifyToken(token);
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      throw new ApiError(401, 'Session expired. Please log in again.');
    }
    throw new ApiError(401, 'Invalid authentication token.');
  }

  const [rows] = await pool.query(
    `SELECT id, full_name, email, phone, role, status, must_change_password
     FROM users WHERE id = ? LIMIT 1`,
    [decoded.id]
  );

  const user = rows[0];
  if (!user) {
    throw new ApiError(401, 'Account no longer exists.');
  }
  if (user.status !== 'active') {
    throw new ApiError(403, 'This account has been disabled. Contact the administrator.');
  }

  req.user = user;
  next();
});

/**
 * Restricts a route to one or more roles.
 * Usage: authorize('admin') or authorize('admin', 'worker')
 * Must run after `authenticate`.
 */
const authorize = (...allowedRoles) => (req, res, next) => {
  if (!req.user) {
    return next(new ApiError(401, 'Authentication required.'));
  }
  if (!allowedRoles.includes(req.user.role)) {
    return next(new ApiError(403, 'You do not have permission to perform this action.'));
  }
  next();
};

module.exports = { authenticate, authorize };
