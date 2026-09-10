const { pool } = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { logActivity } = require('../services/activityLogService');

function slugify(name) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

/**
 * GET /api/categories
 * Public: active categories only. Admin with ?all=1: every category.
 */
const getCategories = asyncHandler(async (req, res) => {
  const isAdminAll = req.query.all === '1' && req.user?.role === 'admin';

  const [rows] = await pool.query(
    `SELECT id, name, slug, description, is_active, sort_order, created_at
     FROM categories
     ${isAdminAll ? '' : 'WHERE is_active = 1'}
     ORDER BY sort_order ASC, name ASC`
  );
  res.json({ success: true, data: rows });
});

/** POST /api/categories - admin only */
const createCategory = asyncHandler(async (req, res) => {
  const { name, description, sortOrder } = req.body;
  if (!name?.trim()) {
    throw new ApiError(400, 'Category name is required.');
  }

  const slug = slugify(name);
  const [result] = await pool.query(
    `INSERT INTO categories (name, slug, description, sort_order, is_active) VALUES (?, ?, ?, ?, 1)`,
    [name.trim(), slug, description?.trim() || null, Number(sortOrder) || 0]
  );

  await logActivity({
    userId: req.user.id,
    action: 'create_category',
    description: `Created category "${name}"`,
    relatedType: 'category',
    relatedId: result.insertId,
  });

  res.status(201).json({ success: true, message: 'Category created.', data: { id: result.insertId, slug } });
});

/** PUT /api/categories/:id - admin only */
const updateCategory = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const [rows] = await pool.query('SELECT * FROM categories WHERE id = ?', [id]);
  const existing = rows[0];
  if (!existing) throw new ApiError(404, 'Category not found.');

  const { name, description, sortOrder } = req.body;
  const newName = name?.trim() || existing.name;
  const newSlug = name?.trim() ? slugify(name) : existing.slug;

  await pool.query(
    `UPDATE categories SET name=?, slug=?, description=?, sort_order=? WHERE id=?`,
    [newName, newSlug, description !== undefined ? description?.trim() || null : existing.description, Number(sortOrder ?? existing.sort_order), id]
  );

  await logActivity({
    userId: req.user.id,
    action: 'update_category',
    description: `Updated category "${newName}"`,
    relatedType: 'category',
    relatedId: Number(id),
  });

  res.json({ success: true, message: 'Category updated.' });
});

/**
 * DELETE /api/categories/:id - admin only.
 * Deletes only if no products reference it (products.category_id has
 * ON DELETE SET NULL, so a hard delete is technically safe either way,
 * but we still warn and deactivate instead when products are attached,
 * to avoid orphaning menu items unexpectedly).
 */
const deleteCategory = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const [rows] = await pool.query('SELECT id, name FROM categories WHERE id = ?', [id]);
  const category = rows[0];
  if (!category) throw new ApiError(404, 'Category not found.');

  const [productRows] = await pool.query('SELECT id FROM products WHERE category_id = ? LIMIT 1', [id]);

  if (productRows.length > 0) {
    await pool.query('UPDATE categories SET is_active = 0 WHERE id = ?', [id]);
    await logActivity({
      userId: req.user.id,
      action: 'archive_category',
      description: `Deactivated category "${category.name}" (has products, cannot be deleted)`,
      relatedType: 'category',
      relatedId: Number(id),
    });
    return res.json({
      success: true,
      message: 'This category has products, so it was deactivated instead of deleted.',
      archived: true,
    });
  }

  await pool.query('DELETE FROM categories WHERE id = ?', [id]);
  await logActivity({
    userId: req.user.id,
    action: 'delete_category',
    description: `Deleted category "${category.name}"`,
    relatedType: 'category',
    relatedId: Number(id),
  });
  res.json({ success: true, message: 'Category deleted.', archived: false });
});

/** PATCH /api/categories/:id/status - admin only */
const toggleCategoryStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { isActive } = req.body;
  const [rows] = await pool.query('SELECT id, name FROM categories WHERE id = ?', [id]);
  if (!rows[0]) throw new ApiError(404, 'Category not found.');

  await pool.query('UPDATE categories SET is_active = ? WHERE id = ?', [isActive ? 1 : 0, id]);
  await logActivity({
    userId: req.user.id,
    action: 'toggle_category_status',
    description: `${isActive ? 'Activated' : 'Deactivated'} category "${rows[0].name}"`,
    relatedType: 'category',
    relatedId: Number(id),
  });
  res.json({ success: true, message: `Category ${isActive ? 'activated' : 'deactivated'}.` });
});

module.exports = { getCategories, createCategory, updateCategory, deleteCategory, toggleCategoryStatus };
