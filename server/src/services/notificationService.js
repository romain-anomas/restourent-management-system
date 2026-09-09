const { pool } = require('../config/db');

/**
 * Creates a notification row. `recipientId` null + `recipientRole` targets
 * everyone with that role (e.g. all admins). Pass a specific recipientId
 * to target one user.
 */
async function createNotification({
  recipientId = null,
  recipientRole = 'admin',
  type,
  title,
  message,
  relatedType = null,
  relatedId = null,
}) {
  try {
    await pool.query(
      `INSERT INTO notifications
        (recipient_id, recipient_role, type, title, message, related_type, related_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [recipientId, recipientRole, type, title, message, relatedType, relatedId]
    );
  } catch (err) {
    console.error('Failed to create notification:', err.message);
  }
}

module.exports = { createNotification };
