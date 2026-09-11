const { pool } = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { logActivity } = require('../services/activityLogService');

const VALID_CATEGORIES = ['food_supplies', 'transport', 'electricity', 'water', 'rent', 'salaries', 'maintenance', 'other'];

/**
 * GET /api/expenses - admin only.
 * Query: category, from, to, search (title)
 */
const listExpenses = asyncHandler(async (req, res) => {
  const { category, from, to, search } = req.query;
  const where = [];
  const params = [];

  if (category) {
    where.push('e.category = ?');
    params.push(category);
  }
  if (from) {
    where.push('e.expense_date >= ?');
    params.push(from);
  }
  if (to) {
    where.push('e.expense_date <= ?');
    params.push(to);
  }
  if (search) {
    where.push('e.title LIKE ?');
    params.push(`%${search}%`);
  }

  const [rows] = await pool.query(
    `SELECT e.*, u.full_name AS recorded_by_name
     FROM expenses e
     LEFT JOIN users u ON u.id = e.recorded_by
     ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
     ORDER BY e.expense_date DESC, e.created_at DESC
     LIMIT 300`,
    params
  );

  const [[totalRow]] = await pool.query(
    `SELECT COALESCE(SUM(e.amount),0) AS total
     FROM expenses e
     ${where.length ? `WHERE ${where.join(' AND ')}` : ''}`,
    params
  );

  res.json({ success: true, data: rows, total: Number(totalRow.total) });
});

/** POST /api/expenses - admin only. */
const createExpense = asyncHandler(async (req, res) => {
  const { title, category, amount, description, reference, expenseDate } = req.body;

  if (!title?.trim() || !amount || Number(amount) <= 0) {
    throw new ApiError(400, 'Title and a positive amount are required.');
  }
  if (category && !VALID_CATEGORIES.includes(category)) {
    throw new ApiError(400, 'Invalid expense category.');
  }
  if (!expenseDate) {
    throw new ApiError(400, 'Expense date is required.');
  }

  const [result] = await pool.query(
    `INSERT INTO expenses (title, category, amount, description, reference, expense_date, recorded_by)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [title.trim(), category || 'other', Number(amount), description?.trim() || null, reference?.trim() || null, expenseDate, req.user.id]
  );

  await logActivity({
    userId: req.user.id,
    action: 'create_expense',
    description: `Recorded expense "${title}" (${amount})`,
    relatedType: 'expense',
    relatedId: result.insertId,
  });

  res.status(201).json({ success: true, message: 'Expense recorded.', data: { id: result.insertId } });
});

/** PUT /api/expenses/:id - admin only. */
const updateExpense = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const [rows] = await pool.query('SELECT * FROM expenses WHERE id = ?', [id]);
  const existing = rows[0];
  if (!existing) throw new ApiError(404, 'Expense not found.');

  const { title, category, amount, description, reference, expenseDate } = req.body;
  if (category && !VALID_CATEGORIES.includes(category)) {
    throw new ApiError(400, 'Invalid expense category.');
  }

  const updated = {
    title: title?.trim() || existing.title,
    category: category || existing.category,
    amount: amount !== undefined ? Number(amount) : existing.amount,
    description: description !== undefined ? description?.trim() || null : existing.description,
    reference: reference !== undefined ? reference?.trim() || null : existing.reference,
    expense_date: expenseDate || existing.expense_date,
  };

  await pool.query(
    `UPDATE expenses SET title=?, category=?, amount=?, description=?, reference=?, expense_date=? WHERE id=?`,
    [updated.title, updated.category, updated.amount, updated.description, updated.reference, updated.expense_date, id]
  );

  await logActivity({
    userId: req.user.id,
    action: 'update_expense',
    description: `Updated expense "${updated.title}"`,
    relatedType: 'expense',
    relatedId: Number(id),
  });

  res.json({ success: true, message: 'Expense updated.' });
});

/** DELETE /api/expenses/:id - admin only. */
const deleteExpense = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const [rows] = await pool.query('SELECT id, title FROM expenses WHERE id = ?', [id]);
  if (!rows[0]) throw new ApiError(404, 'Expense not found.');

  await pool.query('DELETE FROM expenses WHERE id = ?', [id]);

  await logActivity({
    userId: req.user.id,
    action: 'delete_expense',
    description: `Deleted expense "${rows[0].title}"`,
    relatedType: 'expense',
    relatedId: Number(id),
  });

  res.json({ success: true, message: 'Expense deleted.' });
});

module.exports = { listExpenses, createExpense, updateExpense, deleteExpense };
