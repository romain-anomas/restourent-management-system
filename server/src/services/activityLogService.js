const { pool } = require('../config/db');

/**
 * Records an entry in activity_logs. Never throws - logging failures
 * must not break the primary business operation that triggered them.
 */
async function logActivity({
  userId = null,
  action,
  description = null,
  relatedType = null,
  relatedId = null,
  oldValue = null,
  newValue = null,
  ipAddress = null,
}) {
  try {
    await pool.query(
      `INSERT INTO activity_logs
        (user_id, action, description, related_type, related_id, old_value, new_value, ip_address)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userId,
        action,
        description,
        relatedType,
        relatedId,
        oldValue !== null && typeof oldValue !== 'string' ? JSON.stringify(oldValue) : oldValue,
        newValue !== null && typeof newValue !== 'string' ? JSON.stringify(newValue) : newValue,
        ipAddress,
      ]
    );
  } catch (err) {
    console.error('Failed to write activity log:', err.message);
  }
}

module.exports = { logActivity };
