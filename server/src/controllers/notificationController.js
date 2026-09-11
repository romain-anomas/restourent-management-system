const { pool } = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');

/**
 * Builds the WHERE clause + params that scope notifications to what the
 * current user should see: notifications addressed directly to them, or
 * broadcast to their role (or to "all").
 */
function scopeToUser(user) {
  return {
    where: `(recipient_id = ? OR (recipient_id IS NULL AND (recipient_role = ? OR recipient_role = 'all')))`,
    params: [user.id, user.role],
  };
}

/** GET /api/notifications - admin/worker. Returns recent notifications + unread count. */
const listNotifications = asyncHandler(async (req, res) => {
  const { where, params } = scopeToUser(req.user);
  const { unreadOnly } = req.query;

  const [rows] = await pool.query(
    `SELECT id, type, title, message, related_type, related_id, is_read, created_at
     FROM notifications
     WHERE ${where} ${unreadOnly === '1' ? 'AND is_read = 0' : ''}
     ORDER BY created_at DESC
     LIMIT 100`,
    params
  );

  const [[unreadRow]] = await pool.query(
    `SELECT COUNT(*) AS count FROM notifications WHERE ${where} AND is_read = 0`,
    params
  );

  res.json({ success: true, data: rows, unreadCount: unreadRow.count });
});

/** PATCH /api/notifications/:id/read - admin/worker. Marks one notification as read. */
const markAsRead = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { where, params } = scopeToUser(req.user);

  const [rows] = await pool.query(`SELECT id FROM notifications WHERE id = ? AND ${where}`, [id, ...params]);
  if (!rows[0]) throw new ApiError(404, 'Notification not found.');

  await pool.query('UPDATE notifications SET is_read = 1 WHERE id = ?', [id]);
  res.json({ success: true, message: 'Marked as read.' });
});

/** PATCH /api/notifications/read-all - admin/worker. Marks every visible notification as read. */
const markAllAsRead = asyncHandler(async (req, res) => {
  const { where, params } = scopeToUser(req.user);
  await pool.query(`UPDATE notifications SET is_read = 1 WHERE ${where}`, params);
  res.json({ success: true, message: 'All notifications marked as read.' });
});

module.exports = { listNotifications, markAsRead, markAllAsRead };
