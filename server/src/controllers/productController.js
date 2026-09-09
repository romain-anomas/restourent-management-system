const { pool } = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');

/**
 * GET /api/products
 * Public. Query params:
 *   category  - filter by category slug
 *   search    - search by product name (debounced on frontend)
 *   limit     - optional cap on results (used for "featured" sections)
 * Only returns active products - inactive/archived products never
 * appear on the customer-facing site.
 */
const getProducts = asyncHandler(async (req, res) => {
  const { category, search, limit } = req.query;

  const where = ['p.is_active = 1'];
  const params = [];

  if (category) {
    where.push('c.slug = ?');
    params.push(category);
  }
  if (search) {
    where.push('p.name LIKE ?');
    params.push(`%${search}%`);
  }

  let sql = `
    SELECT p.id, p.name, p.description, p.selling_price, p.unit, p.current_stock,
           p.minimum_stock, p.image_path, p.created_at,
           c.id AS category_id, c.name AS category_name, c.slug AS category_slug
    FROM products p
    LEFT JOIN categories c ON c.id = p.category_id
    WHERE ${where.join(' AND ')}
    ORDER BY p.created_at DESC
  `;

  if (limit && Number.isInteger(Number(limit)) && Number(limit) > 0) {
    sql += ` LIMIT ${Math.min(Number(limit), 50)}`;
  }

  const [rows] = await pool.query(sql, params);

  const products = rows.map((p) => ({
    ...p,
    isAvailable: Number(p.current_stock) > 0,
  }));

  res.json({ success: true, data: products });
});

/**
 * GET /api/products/:id
 * Public. Single product detail page.
 */
const getProductById = asyncHandler(async (req, res) => {
  const [rows] = await pool.query(
    `SELECT p.id, p.name, p.description, p.selling_price, p.unit, p.current_stock,
            p.minimum_stock, p.image_path, p.is_active,
            c.id AS category_id, c.name AS category_name, c.slug AS category_slug
     FROM products p
     LEFT JOIN categories c ON c.id = p.category_id
     WHERE p.id = ? LIMIT 1`,
    [req.params.id]
  );

  const product = rows[0];
  if (!product || !product.is_active) {
    throw new ApiError(404, 'Product not found.');
  }

  res.json({
    success: true,
    data: { ...product, isAvailable: Number(product.current_stock) > 0 },
  });
});

module.exports = { getProducts, getProductById };
