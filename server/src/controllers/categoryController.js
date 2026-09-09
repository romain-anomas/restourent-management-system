const { pool } = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');

/**
 * GET /api/categories
 * Public. Returns active categories ordered for menu display.
 * (Admin-only create/edit/delete/deactivate endpoints arrive in Phase 5.)
 */
const getCategories = asyncHandler(async (req, res) => {
  const [rows] = await pool.query(
    `SELECT id, name, slug, description, sort_order
     FROM categories
     WHERE is_active = 1
     ORDER BY sort_order ASC, name ASC`
  );
  res.json({ success: true, data: rows });
});

module.exports = { getCategories };
