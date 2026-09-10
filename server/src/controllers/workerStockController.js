const { pool, withTransaction } = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { logActivity } = require('../services/activityLogService');
const { createNotification } = require('../services/notificationService');

/**
 * POST /api/worker-stock - admin or worker.
 * Records a product taken from stock by a worker (e.g. for personal use).
 * Stock is deducted immediately (the item physically left the stock room),
 * with a full inventory_transactions record - but this does NOT deduct
 * salary by itself. That only happens after two separate admin approvals:
 * first approving the stock-taking record itself, then approving the
 * resulting salary deduction (see reviewStockTaking / salary deduction routes).
 *
 * Body: { productId, quantity, reason?, notes?, workerId? }
 * `workerId` is only honored when the caller is an admin recording this on
 * behalf of a worker; a worker can only ever record it against themselves.
 */
const createStockTaking = asyncHandler(async (req, res) => {
  const { productId, quantity, reason, notes } = req.body;
  const qty = Number(quantity);

  if (!productId || !qty || qty <= 0) {
    throw new ApiError(400, 'Product and a positive quantity are required.');
  }

  const workerId = req.user.role === 'admin' && req.body.workerId ? req.body.workerId : req.user.id;

  if (req.user.role === 'admin') {
    const [workerRows] = await pool.query(`SELECT id FROM users WHERE id = ? AND role = 'worker'`, [workerId]);
    if (!workerRows[0]) throw new ApiError(400, 'Invalid worker selected.');
  }

  const result = await withTransaction(async (conn) => {
    const [productRows] = await conn.query(
      'SELECT id, name, current_stock, cost_price, selling_price, allow_negative_stock FROM products WHERE id = ? FOR UPDATE',
      [productId]
    );
    const product = productRows[0];
    if (!product) throw new ApiError(404, 'Product not found.');

    const previousStock = Number(product.current_stock);
    const newStock = previousStock - qty;
    if (newStock < 0 && !product.allow_negative_stock) {
      throw new ApiError(409, `Not enough stock of "${product.name}" (have ${previousStock}, requested ${qty}).`);
    }

    // Value at cost, not retail price - this is what it actually cost the
    // business, which is the fair basis for a salary deduction.
    const unitValue = Number(product.cost_price) > 0 ? Number(product.cost_price) : Number(product.selling_price);
    const totalValue = unitValue * qty;

    await conn.query('UPDATE products SET current_stock = ? WHERE id = ?', [newStock, productId]);

    const [txnResult] = await conn.query(
      `INSERT INTO inventory_transactions
        (product_id, type, quantity, previous_stock, new_stock, reason, notes, created_by)
       VALUES (?, 'worker_taking', ?, ?, ?, ?, ?, ?)`,
      [productId, qty, previousStock, newStock, `Worker stock-taking${reason ? `: ${reason}` : ''}`, notes || null, req.user.id]
    );

    const [wstResult] = await conn.query(
      `INSERT INTO worker_stock_takings
        (worker_id, product_id, quantity, unit_value, total_value, reason, status, inventory_transaction_id, notes)
       VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?)`,
      [workerId, productId, qty, unitValue, totalValue, reason || null, txnResult.insertId, notes || null]
    );

    return { id: wstResult.insertId, productName: product.name, totalValue };
  });

  await logActivity({
    userId: req.user.id,
    action: 'worker_stock_taking',
    description: `Recorded taking ${qty} of "${result.productName}" (value: ${result.totalValue})`,
    relatedType: 'worker_stock_taking',
    relatedId: result.id,
  });

  await createNotification({
    recipientRole: 'admin',
    type: 'worker_stock_taking',
    title: 'Worker stock-taking recorded',
    message: `A worker recorded taking ${qty} of "${result.productName}" - pending your review.`,
    relatedType: 'worker_stock_taking',
    relatedId: result.id,
  });

  res.status(201).json({ success: true, message: 'Stock-taking recorded.', data: { id: result.id } });
});

/**
 * GET /api/worker-stock - admin sees all (with filters), worker sees only their own.
 * Query: status, workerId (admin only)
 */
const listStockTakings = asyncHandler(async (req, res) => {
  const { status, workerId } = req.query;
  const where = [];
  const params = [];

  if (req.user.role === 'worker') {
    where.push('wst.worker_id = ?');
    params.push(req.user.id);
  } else if (workerId) {
    where.push('wst.worker_id = ?');
    params.push(workerId);
  }

  if (status) {
    where.push('wst.status = ?');
    params.push(status);
  }

  const [rows] = await pool.query(
    `SELECT wst.*, p.name AS product_name, p.unit, u.full_name AS worker_name,
            r.full_name AS reviewed_by_name
     FROM worker_stock_takings wst
     LEFT JOIN products p ON p.id = wst.product_id
     LEFT JOIN users u ON u.id = wst.worker_id
     LEFT JOIN users r ON r.id = wst.reviewed_by
     ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
     ORDER BY wst.created_at DESC
     LIMIT 300`,
    params
  );

  res.json({ success: true, data: rows });
});

/** GET /api/worker-stock/:id - admin, or the worker who owns the record. */
const getStockTakingById = asyncHandler(async (req, res) => {
  const [rows] = await pool.query(
    `SELECT wst.*, p.name AS product_name, p.unit, u.full_name AS worker_name,
            r.full_name AS reviewed_by_name
     FROM worker_stock_takings wst
     LEFT JOIN products p ON p.id = wst.product_id
     LEFT JOIN users u ON u.id = wst.worker_id
     LEFT JOIN users r ON r.id = wst.reviewed_by
     WHERE wst.id = ? LIMIT 1`,
    [req.params.id]
  );
  const record = rows[0];
  if (!record) throw new ApiError(404, 'Stock-taking record not found.');
  if (req.user.role === 'worker' && record.worker_id !== req.user.id) {
    throw new ApiError(403, 'You do not have permission to view this record.');
  }

  res.json({ success: true, data: record });
});

/**
 * PUT /api/worker-stock/:id/review - admin only.
 * Body: { action: 'approve' | 'reject', notes? }
 * - approve: marks the record approved and creates a pending salary
 *   deduction for the admin to separately approve/reject.
 * - reject: marks the record rejected and restores the stock, since a
 *   rejected record means the admin disputes that it should stand.
 */
const reviewStockTaking = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { action, notes } = req.body;

  if (!['approve', 'reject'].includes(action)) {
    throw new ApiError(400, 'Action must be "approve" or "reject".');
  }

  const result = await withTransaction(async (conn) => {
    const [rows] = await conn.query('SELECT * FROM worker_stock_takings WHERE id = ? FOR UPDATE', [id]);
    const record = rows[0];
    if (!record) throw new ApiError(404, 'Stock-taking record not found.');
    if (record.status !== 'pending') {
      throw new ApiError(409, `This record has already been ${record.status}.`);
    }

    if (action === 'approve') {
      await conn.query(
        `UPDATE worker_stock_takings SET status = 'approved', reviewed_by = ?, reviewed_at = NOW(), notes = COALESCE(?, notes) WHERE id = ?`,
        [req.user.id, notes || null, id]
      );

      const [deductionResult] = await conn.query(
        `INSERT INTO salary_deductions (worker_id, worker_stock_taking_id, amount, reason, status)
         VALUES (?, ?, ?, ?, 'pending')`,
        [record.worker_id, id, record.total_value, `Stock taken - ${record.reason || 'no reason given'}`]
      );

      return { action, deductionId: deductionResult.insertId, workerId: record.worker_id };
    }

    // Reject: restore the stock, since the record is being disputed
    const [productRows] = await conn.query('SELECT id, name, current_stock FROM products WHERE id = ? FOR UPDATE', [record.product_id]);
    const product = productRows[0];
    if (product) {
      const previousStock = Number(product.current_stock);
      const newStock = previousStock + Number(record.quantity);
      await conn.query('UPDATE products SET current_stock = ? WHERE id = ?', [newStock, product.id]);
      await conn.query(
        `INSERT INTO inventory_transactions
          (product_id, type, quantity, previous_stock, new_stock, reason, created_by)
         VALUES (?, 'adjustment', ?, ?, ?, 'Worker stock-taking rejected - stock restored', ?)`,
        [product.id, record.quantity, previousStock, newStock, req.user.id]
      );
    }

    await conn.query(
      `UPDATE worker_stock_takings SET status = 'rejected', reviewed_by = ?, reviewed_at = NOW(), notes = COALESCE(?, notes) WHERE id = ?`,
      [req.user.id, notes || null, id]
    );

    return { action, workerId: record.worker_id };
  });

  await logActivity({
    userId: req.user.id,
    action: `${result.action}_worker_stock_taking`,
    description: `${result.action === 'approve' ? 'Approved' : 'Rejected'} worker stock-taking record #${id}`,
    relatedType: 'worker_stock_taking',
    relatedId: Number(id),
  });

  if (result.action === 'approve') {
    await createNotification({
      recipientId: result.workerId,
      recipientRole: 'worker',
      type: 'stock_taking_approved',
      title: 'Stock-taking approved',
      message: 'Your stock-taking record was approved and a salary deduction is pending admin sign-off.',
      relatedType: 'worker_stock_taking',
      relatedId: Number(id),
    });
  }

  res.json({
    success: true,
    message: action === 'approve' ? 'Record approved. A pending salary deduction was created.' : 'Record rejected and stock restored.',
  });
});

module.exports = { createStockTaking, listStockTakings, getStockTakingById, reviewStockTaking };
