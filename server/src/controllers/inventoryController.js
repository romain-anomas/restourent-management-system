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
 * Body: { items: [{productId, quantity, unitCost?}], supplier?, reference?, notes? }
 * Records one delivery/purchase covering multiple products at once - all
 * items succeed or fail together (single transaction), and share the same
 * supplier/reference/notes since they typically come from one invoice.
 */
const stockIn = asyncHandler(async (req, res) => {
  const { items, supplier, reference, notes } = req.body;

  if (!Array.isArray(items) || items.length === 0) {
    throw new ApiError(400, 'Add at least one product.');
  }

  const results = await withTransaction(async (conn) => {
    const out = [];
    for (const item of items) {
      const qty = Number(item.quantity);
      if (!item.productId || !qty || qty <= 0) {
        throw new ApiError(400, 'Every item needs a product and a positive quantity.');
      }

      const [rows] = await conn.query(
        'SELECT id, name, current_stock FROM products WHERE id = ? FOR UPDATE',
        [item.productId]
      );
      const product = rows[0];
      if (!product) throw new ApiError(404, `Product #${item.productId} not found.`);

      const previousStock = Number(product.current_stock);
      const newStock = previousStock + qty;

      await conn.query('UPDATE products SET current_stock = ? WHERE id = ?', [newStock, product.id]);
      await conn.query(
        `INSERT INTO inventory_transactions
          (product_id, type, quantity, previous_stock, new_stock, unit_cost, supplier, reference, notes, created_by)
         VALUES (?, 'stock_in', ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          product.id, qty, previousStock, newStock, item.unitCost || null,
          supplier || null, reference || null, notes || null, req.user.id,
        ]
      );

      out.push({ productId: product.id, productName: product.name, newStock });
    }
    return out;
  });

  await logActivity({
    userId: req.user.id,
    action: 'stock_in',
    description: `Stocked in ${results.length} product(s): ${results.map((r) => r.productName).join(', ')}`,
    relatedType: 'product',
  });

  res.status(201).json({ success: true, message: `Stock in recorded for ${results.length} product(s).`, data: results });
});

/**
 * POST /api/inventory/stock-out - admin only.
 * Body: { items: [{productId, quantity}], reason?, notes? }
 * Respects each product's allow_negative_stock flag. All items succeed or
 * fail together.
 */
const stockOut = asyncHandler(async (req, res) => {
  const { items, reason, notes } = req.body;

  if (!Array.isArray(items) || items.length === 0) {
    throw new ApiError(400, 'Add at least one product.');
  }

  const results = await withTransaction(async (conn) => {
    const out = [];
    for (const item of items) {
      const qty = Number(item.quantity);
      if (!item.productId || !qty || qty <= 0) {
        throw new ApiError(400, 'Every item needs a product and a positive quantity.');
      }

      const [rows] = await conn.query(
        'SELECT id, name, current_stock, allow_negative_stock FROM products WHERE id = ? FOR UPDATE',
        [item.productId]
      );
      const product = rows[0];
      if (!product) throw new ApiError(404, `Product #${item.productId} not found.`);

      const previousStock = Number(product.current_stock);
      const newStock = previousStock - qty;

      if (newStock < 0 && !product.allow_negative_stock) {
        throw new ApiError(409, `Not enough stock for "${product.name}" (have ${previousStock}, requested ${qty}).`);
      }

      await conn.query('UPDATE products SET current_stock = ? WHERE id = ?', [newStock, product.id]);
      await conn.query(
        `INSERT INTO inventory_transactions
          (product_id, type, quantity, previous_stock, new_stock, reason, notes, created_by)
         VALUES (?, 'stock_out', ?, ?, ?, ?, ?, ?)`,
        [product.id, qty, previousStock, newStock, reason || null, notes || null, req.user.id]
      );

      out.push({ productId: product.id, productName: product.name, newStock });
    }
    return out;
  });

  await logActivity({
    userId: req.user.id,
    action: 'stock_out',
    description: `Stocked out ${results.length} product(s)${reason ? ` - ${reason}` : ''}: ${results.map((r) => r.productName).join(', ')}`,
    relatedType: 'product',
  });

  res.status(201).json({ success: true, message: `Stock out recorded for ${results.length} product(s).`, data: results });
});

/**
 * POST /api/inventory/adjustment - admin only.
 * Body: { items: [{productId, newQuantity}], reason }
 * Sets stock to an exact new value per product (e.g. after a physical
 * stock count covering many products at once), always with a required
 * shared reason and a full transaction record per product.
 */
const stockAdjustment = asyncHandler(async (req, res) => {
  const { items, reason } = req.body;

  if (!Array.isArray(items) || items.length === 0) {
    throw new ApiError(400, 'Add at least one product.');
  }
  if (!reason?.trim()) {
    throw new ApiError(400, 'A reason is required for stock adjustments.');
  }

  const results = await withTransaction(async (conn) => {
    const out = [];
    for (const item of items) {
      if (!item.productId || item.newQuantity === undefined || item.newQuantity === null) {
        throw new ApiError(400, 'Every item needs a product and a new quantity.');
      }
      const newStockValue = Number(item.newQuantity);
      if (newStockValue < 0) {
        throw new ApiError(400, 'New quantity cannot be negative.');
      }

      const [rows] = await conn.query(
        'SELECT id, name, current_stock FROM products WHERE id = ? FOR UPDATE',
        [item.productId]
      );
      const product = rows[0];
      if (!product) throw new ApiError(404, `Product #${item.productId} not found.`);

      const previousStock = Number(product.current_stock);
      const diff = newStockValue - previousStock;

      await conn.query('UPDATE products SET current_stock = ? WHERE id = ?', [newStockValue, product.id]);
      await conn.query(
        `INSERT INTO inventory_transactions
          (product_id, type, quantity, previous_stock, new_stock, reason, created_by)
         VALUES (?, 'adjustment', ?, ?, ?, ?, ?)`,
        [product.id, diff, previousStock, newStockValue, reason.trim(), req.user.id]
      );

      out.push({ productId: product.id, productName: product.name, newStock: newStockValue });
    }
    return out;
  });

  await logActivity({
    userId: req.user.id,
    action: 'stock_adjustment',
    description: `Adjusted stock for ${results.length} product(s) - ${reason}: ${results.map((r) => r.productName).join(', ')}`,
    relatedType: 'product',
  });

  res.status(201).json({ success: true, message: `Stock adjustment recorded for ${results.length} product(s).`, data: results });
});

module.exports = { listTransactions, stockIn, stockOut, stockAdjustment };
