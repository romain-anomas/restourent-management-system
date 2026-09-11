const { pool } = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');

/**
 * GET /api/activity - admin/worker.
 * A worker sees only their own activity log. An admin may pass ?userId=
 * to view any user's log (defaults to their own otherwise).
 */
const listActivity = asyncHandler(async (req, res) => {
  const targetUserId = req.user.role === 'admin' && req.query.userId ? req.query.userId : req.user.id;

  const [rows] = await pool.query(
    `SELECT id, action, description, related_type, related_id, created_at
     FROM activity_logs
     WHERE user_id = ?
     ORDER BY created_at DESC
     LIMIT 200`,
    [targetUserId]
  );

  res.json({ success: true, data: rows });
});

module.exports = { listActivity };
