const { pool, withTransaction } = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { logActivity } = require('../services/activityLogService');

/**
 * GET /api/inventory - admin only.
 * Full inventory transaction history with filters: product, type, from, to.
 */
const listTransactions = asyncHandler(async (req, res) => {
  const { productId, type, from, to } = req.query;

  const where = [];
  const params = [];
  if (productId) {
    where.push('it.product_id = ?');
    params.push(productId);
  }
  if (type) {
    where.push('it.type = ?');
    params.push(type);
  }
  if (from) {
    where.push('DATE(it.created_at) >= ?');
    params.push(from);
  }
  if (to) {
    where.push('DATE(it.created_at) <= ?');
    params.push(to);
  }

  const [rows] = await pool.query(
    `SELECT it.id, it.type, it.quantity, it.previous_stock, it.new_stock, it.unit_cost,
            it.supplier, it.reference, it.related_order_id, it.reason, it.notes, it.created_at,
            p.id AS product_id, p.name AS product_name, p.unit,
            u.full_name AS created_by_name
     FROM inventory_transactions it
     LEFT JOIN products p ON p.id = it.product_id
     LEFT JOIN users u ON u.id = it.created_by
     ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
     ORDER BY it.created_at DESC
     LIMIT 300`,
    params
  );

  res.json({ success: true, data: rows });
});

/**
 * POST /api/inventory/stock-in - admin only.
 * Body: { productId, quantity, unitCost?, supplier?, reference?, notes? }
 */
const stockIn = asyncHandler(async (req, res) => {
  const { productId, quantity, unitCost, supplier, reference, notes } = req.body;
  const qty = Number(quantity);

  if (!productId || !qty || qty <= 0) {
    throw new ApiError(400, 'Product and a positive quantity are required.');
  }

  const result = await withTransaction(async (conn) => {
    const [rows] = await conn.query('SELECT id, name, current_stock FROM products WHERE id = ? FOR UPDATE', [productId]);
    const product = rows[0];
    if (!product) throw new ApiError(404, 'Product not found.');

    const previousStock = Number(product.current_stock);
    const newStock = previousStock + qty;

    await conn.query('UPDATE products SET current_stock = ? WHERE id = ?', [newStock, productId]);
    await conn.query(
      `INSERT INTO inventory_transactions
        (product_id, type, quantity, previous_stock, new_stock, unit_cost, supplier, reference, notes, created_by)
       VALUES (?, 'stock_in', ?, ?, ?, ?, ?, ?, ?, ?)`,
      [productId, qty, previousStock, newStock, unitCost || null, supplier || null, reference || null, notes || null, req.user.id]
    );

    return { productName: product.name, newStock };
  });

  await logActivity({
    userId: req.user.id,
    action: 'stock_in',
    description: `Stocked in ${qty} of "${result.productName}"`,
    relatedType: 'product',
    relatedId: Number(productId),
  });

  res.status(201).json({ success: true, message: 'Stock in recorded.', data: { newStock: result.newStock } });
});

/**
 * POST /api/inventory/stock-out - admin only.
 * Body: { productId, quantity, reason?, notes? }
 * Respects the product's allow_negative_stock flag.
 */
const stockOut = asyncHandler(async (req, res) => {
  const { productId, quantity, reason, notes } = req.body;
  const qty = Number(quantity);

  if (!productId || !qty || qty <= 0) {
    throw new ApiError(400, 'Product and a positive quantity are required.');
  }

  const result = await withTransaction(async (conn) => {
    const [rows] = await conn.query(
      'SELECT id, name, current_stock, allow_negative_stock FROM products WHERE id = ? FOR UPDATE',
      [productId]
    );
    const product = rows[0];
    if (!product) throw new ApiError(404, 'Product not found.');

    const previousStock = Number(product.current_stock);
    const newStock = previousStock - qty;

    if (newStock < 0 && !product.allow_negative_stock) {
      throw new ApiError(409, `Not enough stock for "${product.name}" (have ${previousStock}, requested ${qty}).`);
    }

    await conn.query('UPDATE products SET current_stock = ? WHERE id = ?', [newStock, productId]);
    await conn.query(
      `INSERT INTO inventory_transactions
        (product_id, type, quantity, previous_stock, new_stock, reason, notes, created_by)
       VALUES (?, 'stock_out', ?, ?, ?, ?, ?, ?)`,
      [productId, qty, previousStock, newStock, reason || null, notes || null, req.user.id]
    );

    return { productName: product.name, newStock };
  });

  await logActivity({
    userId: req.user.id,
    action: 'stock_out',
    description: `Stocked out ${qty} of "${result.productName}"${reason ? ` - ${reason}` : ''}`,
    relatedType: 'product',
    relatedId: Number(productId),
  });

  res.status(201).json({ success: true, message: 'Stock out recorded.', data: { newStock: result.newStock } });
});

/**
 * POST /api/inventory/adjustment - admin only.
 * Body: { productId, newQuantity, reason }
 * Sets stock to an exact new value (e.g. after a physical stock count),
 * always with a required reason and a full transaction record.
 */
const stockAdjustment = asyncHandler(async (req, res) => {
  const { productId, newQuantity, reason } = req.body;

  if (!productId || newQuantity === undefined || newQuantity === null) {
    throw new ApiError(400, 'Product and new quantity are required.');
  }
  if (!reason?.trim()) {
    throw new ApiError(400, 'A reason is required for stock adjustments.');
  }

  const newStockValue = Number(newQuantity);
  if (newStockValue < 0) {
    throw new ApiError(400, 'New quantity cannot be negative.');
  }

  const result = await withTransaction(async (conn) => {
    const [rows] = await conn.query('SELECT id, name, current_stock FROM products WHERE id = ? FOR UPDATE', [productId]);
    const product = rows[0];
    if (!product) throw new ApiError(404, 'Product not found.');

    const previousStock = Number(product.current_stock);
    const diff = newStockValue - previousStock;

    await conn.query('UPDATE products SET current_stock = ? WHERE id = ?', [newStockValue, productId]);
    await conn.query(
      `INSERT INTO inventory_transactions
        (product_id, type, quantity, previous_stock, new_stock, reason, created_by)
       VALUES (?, 'adjustment', ?, ?, ?, ?, ?)`,
      [productId, diff, previousStock, newStockValue, reason.trim(), req.user.id]
    );

    return { productName: product.name };
  });

  await logActivity({
    userId: req.user.id,
    action: 'stock_adjustment',
    description: `Adjusted stock for "${result.productName}" - ${reason}`,
    relatedType: 'product',
    relatedId: Number(productId),
  });

  res.status(201).json({ success: true, message: 'Stock adjustment recorded.' });
});

module.exports = { listTransactions, stockIn, stockOut, stockAdjustment };
