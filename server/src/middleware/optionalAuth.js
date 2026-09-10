const { verifyToken } = require('../utils/jwt');
const { pool } = require('../config/db');

/**
 * Like `authenticate`, but never rejects the request. If a valid token is
 * present, req.user is populated; otherwise req.user stays undefined and
 * the request proceeds as an anonymous/public call. Useful for endpoints
 * like GET /api/products that serve the public site but reveal more
 * (e.g. inactive items) to a logged-in admin.
 */
async function optionalAuthenticate(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return next();
  }

  try {
    const decoded = verifyToken(token);
    const [rows] = await pool.query(
      `SELECT id, full_name, email, phone, role, status, must_change_password
       FROM users WHERE id = ? LIMIT 1`,
      [decoded.id]
    );
    const user = rows[0];
    if (user && user.status === 'active') {
      req.user = user;
    }
  } catch {
    // Invalid/expired token on a public route - just proceed anonymously
  }
  next();
}

module.exports = { optionalAuthenticate };
