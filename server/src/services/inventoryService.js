const ApiError = require('../utils/ApiError');

/**
 * Deducts stock for every line item of an order, inside the same
 * transaction as the order status update. Skips products that no longer
 * exist (e.g. later deleted) rather than failing the whole order.
 * Respects each product's `allow_negative_stock` flag - if stock would go
 * negative and that flag is off, this throws and the whole transaction
 * (including the status change) rolls back.
 *
 * Idempotent: call `hasExistingDeduction` first to avoid double-deducting
 * if an order is confirmed twice by mistake.
 */
async function deductStockForOrder(conn, orderId, userId) {
  const [items] = await conn.query(
    `SELECT product_id, product_name, quantity FROM order_items WHERE order_id = ?`,
    [orderId]
  );

  for (const item of items) {
    if (!item.product_id) continue; // product may have been removed since order was placed

    const [productRows] = await conn.query(
      `SELECT id, current_stock, allow_negative_stock FROM products WHERE id = ? FOR UPDATE`,
      [item.product_id]
    );
    const product = productRows[0];
    if (!product) continue;

    const previousStock = Number(product.current_stock);
    const newStock = previousStock - Number(item.quantity);

    if (newStock < 0 && !product.allow_negative_stock) {
      throw new ApiError(
        409,
        `Not enough stock for "${item.product_name}" (have ${previousStock}, order needs ${item.quantity}).`
      );
    }

    await conn.query('UPDATE products SET current_stock = ? WHERE id = ?', [newStock, product.id]);

    await conn.query(
      `INSERT INTO inventory_transactions
        (product_id, type, quantity, previous_stock, new_stock, related_order_id, reason, created_by)
       VALUES (?, 'order_deduction', ?, ?, ?, ?, ?, ?)`,
      [product.id, item.quantity, previousStock, newStock, orderId, 'Order confirmed', userId]
    );
  }
}

/**
 * Reverses stock deductions for an order (used when a confirmed order is
 * later cancelled). Only restocks products that still exist.
 */
async function restockCancelledOrder(conn, orderId, userId) {
  const [deductions] = await conn.query(
    `SELECT product_id, quantity FROM inventory_transactions
     WHERE related_order_id = ? AND type = 'order_deduction'`,
    [orderId]
  );

  for (const d of deductions) {
    const [productRows] = await conn.query(
      `SELECT id, current_stock FROM products WHERE id = ? FOR UPDATE`,
      [d.product_id]
    );
    const product = productRows[0];
    if (!product) continue;

    const previousStock = Number(product.current_stock);
    const newStock = previousStock + Number(d.quantity);

    await conn.query('UPDATE products SET current_stock = ? WHERE id = ?', [newStock, product.id]);

    await conn.query(
      `INSERT INTO inventory_transactions
        (product_id, type, quantity, previous_stock, new_stock, related_order_id, reason, created_by)
       VALUES (?, 'adjustment', ?, ?, ?, ?, ?, ?)`,
      [product.id, d.quantity, previousStock, newStock, orderId, 'Order cancelled - stock restored', userId]
    );
  }
}

/**
 * Whether this order's inventory has already been deducted (used to make
 * confirming an order idempotent - won't double-deduct on repeated calls).
 */
async function hasExistingDeduction(conn, orderId) {
  const [rows] = await conn.query(
    `SELECT id FROM inventory_transactions WHERE related_order_id = ? AND type = 'order_deduction' LIMIT 1`,
    [orderId]
  );
  return rows.length > 0;
}

module.exports = { deductStockForOrder, restockCancelledOrder, hasExistingDeduction };
