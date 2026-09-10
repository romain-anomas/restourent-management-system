const { pool, withTransaction } = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { logActivity } = require('../services/activityLogService');
const { createNotification } = require('../services/notificationService');

/**
 * GET /api/salary-deductions - admin only.
 * Query: status, workerId
 */
const listSalaryDeductions = asyncHandler(async (req, res) => {
  const { status, workerId } = req.query;
  const where = [];
  const params = [];

  if (status) {
    where.push('sd.status = ?');
    params.push(status);
  }
  if (workerId) {
    where.push('sd.worker_id = ?');
    params.push(workerId);
  }

  const [rows] = await pool.query(
    `SELECT sd.*, u.full_name AS worker_name, a.full_name AS approved_by_name,
            wst.product_id, p.name AS product_name, wst.quantity
     FROM salary_deductions sd
     LEFT JOIN users u ON u.id = sd.worker_id
     LEFT JOIN users a ON a.id = sd.approved_by
     LEFT JOIN worker_stock_takings wst ON wst.id = sd.worker_stock_taking_id
     LEFT JOIN products p ON p.id = wst.product_id
     ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
     ORDER BY sd.created_at DESC
     LIMIT 300`,
    params
  );

  res.json({ success: true, data: rows });
});

/**
 * PUT /api/salary-deductions/:id/review - admin only.
 * Body: { action: 'approve' | 'reject' }
 * Approving marks the deduction applied and flips the linked
 * worker_stock_taking to 'deducted'. Rejecting leaves the stock-taking
 * record as 'approved' (it happened, it's just not being deducted from pay).
 */
const reviewSalaryDeduction = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { action } = req.body;

  if (!['approve', 'reject'].includes(action)) {
    throw new ApiError(400, 'Action must be "approve" or "reject".');
  }

  const result = await withTransaction(async (conn) => {
    const [rows] = await conn.query('SELECT * FROM salary_deductions WHERE id = ? FOR UPDATE', [id]);
    const deduction = rows[0];
    if (!deduction) throw new ApiError(404, 'Salary deduction not found.');
    if (deduction.status !== 'pending') {
      throw new ApiError(409, `This deduction has already been ${deduction.status}.`);
    }

    const newStatus = action === 'approve' ? 'approved' : 'rejected';
    await conn.query(
      `UPDATE salary_deductions SET status = ?, approved_by = ?, approved_at = NOW() WHERE id = ?`,
      [newStatus, req.user.id, id]
    );

    if (action === 'approve' && deduction.worker_stock_taking_id) {
      await conn.query(
        `UPDATE worker_stock_takings SET status = 'deducted' WHERE id = ?`,
        [deduction.worker_stock_taking_id]
      );
    }

    return { workerId: deduction.worker_id, amount: deduction.amount };
  });

  await logActivity({
    userId: req.user.id,
    action: `${action}_salary_deduction`,
    description: `${action === 'approve' ? 'Approved' : 'Rejected'} salary deduction #${id} (${result.amount})`,
    relatedType: 'salary_deduction',
    relatedId: Number(id),
  });

  await createNotification({
    recipientId: result.workerId,
    recipientRole: 'worker',
    type: 'salary_deduction_reviewed',
    title: `Salary deduction ${action === 'approve' ? 'approved' : 'rejected'}`,
    message: `A salary deduction of ${result.amount} was ${action === 'approve' ? 'approved and will be applied' : 'rejected'}.`,
    relatedType: 'salary_deduction',
    relatedId: Number(id),
  });

  res.json({ success: true, message: `Salary deduction ${action === 'approve' ? 'approved' : 'rejected'}.` });
});

module.exports = { listSalaryDeductions, reviewSalaryDeduction };
