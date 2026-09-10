const fs = require('fs');
const path = require('path');
const { pool, withTransaction } = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { logActivity } = require('../services/activityLogService');

const LOW_STOCK_JOIN = 'p.current_stock <= p.minimum_stock';

/**
 * GET /api/products
 * Public by default (active products only). If called by an authenticated
 * admin with ?all=1, returns every product (active + inactive) for the
 * management screen, plus search/category filters either way.
 */
const getProducts = asyncHandler(async (req, res) => {
  const { category, search, limit, all } = req.query;
  const isAdminAll = all === '1' && req.user?.role === 'admin';

  const where = [];
  const params = [];

  if (!isAdminAll) {
    where.push('p.is_active = 1');
  }
  if (category) {
    where.push('c.slug = ?');
    params.push(category);
  }
  if (search) {
    where.push('(p.name LIKE ? OR p.sku LIKE ?)');
    params.push(`%${search}%`, `%${search}%`);
  }

  let sql = `
    SELECT p.id, p.name, p.sku, p.description, p.selling_price, p.cost_price, p.unit,
           p.current_stock, p.minimum_stock, p.image_path, p.is_active,
           p.allow_negative_stock, p.created_at, p.updated_at,
           c.id AS category_id, c.name AS category_name, c.slug AS category_slug
    FROM products p
    LEFT JOIN categories c ON c.id = p.category_id
    ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
    ORDER BY p.created_at DESC
  `;

  if (limit && Number.isInteger(Number(limit)) && Number(limit) > 0) {
    sql += ` LIMIT ${Math.min(Number(limit), 100)}`;
  }

  const [rows] = await pool.query(sql, params);
  const products = rows.map((p) => ({
    ...p,
    isAvailable: Number(p.current_stock) > 0,
    isLowStock: Number(p.current_stock) <= Number(p.minimum_stock),
  }));

  res.json({ success: true, data: products });
});

/** GET /api/products/low-stock - admin only. Dedicated low-stock list. */
const getLowStockProducts = asyncHandler(async (req, res) => {
  const [rows] = await pool.query(
    `SELECT p.id, p.name, p.sku, p.unit, p.current_stock, p.minimum_stock, p.image_path,
            c.name AS category_name
     FROM products p
     LEFT JOIN categories c ON c.id = p.category_id
     WHERE p.is_active = 1 AND ${LOW_STOCK_JOIN}
     ORDER BY (p.current_stock - p.minimum_stock) ASC`
  );
  res.json({ success: true, data: rows });
});

/** GET /api/products/:id - public product details (active only). */
const getProductById = asyncHandler(async (req, res) => {
  const [rows] = await pool.query(
    `SELECT p.id, p.name, p.sku, p.description, p.selling_price, p.cost_price, p.unit,
            p.current_stock, p.minimum_stock, p.image_path, p.is_active, p.allow_negative_stock,
            c.id AS category_id, c.name AS category_name, c.slug AS category_slug
     FROM products p
     LEFT JOIN categories c ON c.id = p.category_id
     WHERE p.id = ? LIMIT 1`,
    [req.params.id]
  );

  const product = rows[0];
  const isAdmin = req.user?.role === 'admin';
  if (!product || (!product.is_active && !isAdmin)) {
    throw new ApiError(404, 'Product not found.');
  }

  res.json({
    success: true,
    data: { ...product, isAvailable: Number(product.current_stock) > 0 },
  });
});

/** POST /api/products - admin only. Creates a product, optional image upload. */
const createProduct = asyncHandler(async (req, res) => {
  const {
    name, sku, description, categoryId, sellingPrice, costPrice,
    unit, currentStock, minimumStock, allowNegativeStock,
  } = req.body;

  if (!name?.trim() || sellingPrice === undefined) {
    throw new ApiError(400, 'Product name and selling price are required.');
  }

  const imagePath = req.file ? `/uploads/products/${req.file.filename}` : null;

  const [result] = await pool.query(
    `INSERT INTO products
      (category_id, name, sku, description, selling_price, cost_price, unit,
       current_stock, minimum_stock, image_path, allow_negative_stock, is_active)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
    [
      categoryId || null,
      name.trim(),
      sku?.trim() || null,
      description?.trim() || null,
      Number(sellingPrice) || 0,
      Number(costPrice) || 0,
      unit?.trim() || 'pcs',
      Number(currentStock) || 0,
      Number(minimumStock) || 0,
      imagePath,
      allowNegativeStock === 'true' || allowNegativeStock === true ? 1 : 0,
    ]
  );

  await logActivity({
    userId: req.user.id,
    action: 'create_product',
    description: `Created product "${name}"`,
    relatedType: 'product',
    relatedId: result.insertId,
  });

  res.status(201).json({ success: true, message: 'Product created.', data: { id: result.insertId } });
});

/** PUT /api/products/:id - admin only. Full edit, optional new image. */
const updateProduct = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const [existingRows] = await pool.query('SELECT * FROM products WHERE id = ?', [id]);
  const existing = existingRows[0];
  if (!existing) throw new ApiError(404, 'Product not found.');

  const {
    name, sku, description, categoryId, sellingPrice, costPrice,
    unit, currentStock, minimumStock, allowNegativeStock,
  } = req.body;

  let imagePath = existing.image_path;
  if (req.file) {
    imagePath = `/uploads/products/${req.file.filename}`;
    // Clean up the old image file if it was locally stored
    if (existing.image_path?.startsWith('/uploads/')) {
      const oldPath = path.join(__dirname, '..', '..', existing.image_path);
      fs.unlink(oldPath, () => {}); // best-effort, ignore errors
    }
  }

  const updated = {
    category_id: categoryId !== undefined ? categoryId || null : existing.category_id,
    name: name?.trim() || existing.name,
    sku: sku !== undefined ? sku?.trim() || null : existing.sku,
    description: description !== undefined ? description?.trim() || null : existing.description,
    selling_price: sellingPrice !== undefined ? Number(sellingPrice) : existing.selling_price,
    cost_price: costPrice !== undefined ? Number(costPrice) : existing.cost_price,
    unit: unit?.trim() || existing.unit,
    current_stock: currentStock !== undefined ? Number(currentStock) : existing.current_stock,
    minimum_stock: minimumStock !== undefined ? Number(minimumStock) : existing.minimum_stock,
    allow_negative_stock:
      allowNegativeStock !== undefined ? (allowNegativeStock === 'true' || allowNegativeStock === true ? 1 : 0) : existing.allow_negative_stock,
  };

  await pool.query(
    `UPDATE products SET category_id=?, name=?, sku=?, description=?, selling_price=?, cost_price=?,
      unit=?, current_stock=?, minimum_stock=?, image_path=?, allow_negative_stock=? WHERE id=?`,
    [
      updated.category_id, updated.name, updated.sku, updated.description, updated.selling_price,
      updated.cost_price, updated.unit, updated.current_stock, updated.minimum_stock, imagePath,
      updated.allow_negative_stock, id,
    ]
  );

  await logActivity({
    userId: req.user.id,
    action: 'update_product',
    description: `Updated product "${updated.name}"`,
    relatedType: 'product',
    relatedId: Number(id),
    oldValue: { selling_price: existing.selling_price, cost_price: existing.cost_price },
    newValue: { selling_price: updated.selling_price, cost_price: updated.cost_price },
  });

  res.json({ success: true, message: 'Product updated.' });
});

/**
 * DELETE /api/products/:id - admin only.
 * If the product has never appeared in an order, it's safe to hard-delete.
 * Otherwise (per spec: never delete products with order history), it is
 * archived (deactivated) instead, and the response says so.
 */
const deleteProduct = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const [productRows] = await pool.query('SELECT id, name FROM products WHERE id = ?', [id]);
  const product = productRows[0];
  if (!product) throw new ApiError(404, 'Product not found.');

  const [orderItemRows] = await pool.query('SELECT id FROM order_items WHERE product_id = ? LIMIT 1', [id]);

  if (orderItemRows.length > 0) {
    await pool.query('UPDATE products SET is_active = 0 WHERE id = ?', [id]);
    await logActivity({
      userId: req.user.id,
      action: 'archive_product',
      description: `Archived product "${product.name}" (has order history, cannot be deleted)`,
      relatedType: 'product',
      relatedId: Number(id),
    });
    return res.json({
      success: true,
      message: 'This product has order history, so it was archived (deactivated) instead of deleted.',
      archived: true,
    });
  }

  await pool.query('DELETE FROM products WHERE id = ?', [id]);
  await logActivity({
    userId: req.user.id,
    action: 'delete_product',
    description: `Deleted product "${product.name}"`,
    relatedType: 'product',
    relatedId: Number(id),
  });
  res.json({ success: true, message: 'Product deleted.', archived: false });
});

/** PATCH /api/products/:id/status - admin only. Toggle active/inactive. */
const toggleProductStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { isActive } = req.body;
  const [rows] = await pool.query('SELECT id, name FROM products WHERE id = ?', [id]);
  if (!rows[0]) throw new ApiError(404, 'Product not found.');

  await pool.query('UPDATE products SET is_active = ? WHERE id = ?', [isActive ? 1 : 0, id]);
  await logActivity({
    userId: req.user.id,
    action: 'toggle_product_status',
    description: `${isActive ? 'Activated' : 'Deactivated'} product "${rows[0].name}"`,
    relatedType: 'product',
    relatedId: Number(id),
  });
  res.json({ success: true, message: `Product ${isActive ? 'activated' : 'deactivated'}.` });
});

module.exports = {
  getProducts,
  getLowStockProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  toggleProductStatus,
};
