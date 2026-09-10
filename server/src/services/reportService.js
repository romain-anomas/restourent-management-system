const { pool } = require('../config/db');
const ApiError = require('../utils/ApiError');

/**
 * Builds the full report payload for a given inclusive date range
 * (YYYY-MM-DD strings). Used by all four report endpoints - they only
 * differ in how they compute `from`/`to` before calling this.
 */
async function generateReport(from, to) {
  const results = await Promise.all([
    pool.query(
      `SELECT
         COUNT(*) AS total,
         SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS completed,
         SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) AS cancelled,
         SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS pending
       FROM orders WHERE DATE(created_at) BETWEEN ? AND ?`,
      [from, to]
    ),
    pool.query(
      `SELECT COALESCE(SUM(total_amount),0) AS revenue FROM orders
       WHERE status = 'completed' AND DATE(created_at) BETWEEN ? AND ?`,
      [from, to]
    ),
    pool.query(
      `SELECT COALESCE(SUM(oi.quantity * p.cost_price),0) AS cogs
       FROM order_items oi
       JOIN orders o ON o.id = oi.order_id
       LEFT JOIN products p ON p.id = oi.product_id
       WHERE o.status = 'completed' AND DATE(o.created_at) BETWEEN ? AND ?`,
      [from, to]
    ),
    pool.query(
      `SELECT oi.product_name AS name, SUM(oi.quantity) AS quantity, SUM(oi.line_total) AS revenue
       FROM order_items oi
       JOIN orders o ON o.id = oi.order_id
       WHERE o.status != 'cancelled' AND DATE(o.created_at) BETWEEN ? AND ?
       GROUP BY oi.product_name ORDER BY quantity DESC LIMIT 10`,
      [from, to]
    ),
    pool.query(
      `SELECT COALESCE(SUM(quantity),0) AS total FROM inventory_transactions
       WHERE type = 'stock_in' AND DATE(created_at) BETWEEN ? AND ?`,
      [from, to]
    ),
    pool.query(
      `SELECT COALESCE(SUM(quantity),0) AS total FROM inventory_transactions
       WHERE type = 'stock_out' AND DATE(created_at) BETWEEN ? AND ?`,
      [from, to]
    ),
    pool.query(
      `SELECT COUNT(*) AS count FROM inventory_transactions
       WHERE type = 'adjustment' AND DATE(created_at) BETWEEN ? AND ?`,
      [from, to]
    ),
    pool.query(
      `SELECT COALESCE(SUM(quantity),0) AS total FROM inventory_transactions
       WHERE type = 'worker_taking' AND DATE(created_at) BETWEEN ? AND ?`,
      [from, to]
    ),
    pool.query(
      `SELECT u.full_name AS worker_name, COUNT(*) AS actions
       FROM activity_logs a
       JOIN users u ON u.id = a.user_id
       WHERE u.role = 'worker' AND DATE(a.created_at) BETWEEN ? AND ?
       GROUP BY u.full_name ORDER BY actions DESC LIMIT 10`,
      [from, to]
    ),
  ]);

  // Each result is a [rows, fields] tuple from mysql2 - take rows ([0]) from each.
  const orderStats = results[0][0][0];
  const revenueRow = results[1][0][0];
  const cogsRow = results[2][0][0];
  const productsSold = results[3][0];
  const stockIn = results[4][0][0];
  const stockOut = results[5][0][0];
  const adjustments = results[6][0][0];
  const workerTakings = results[7][0][0];
  const workerActivity = results[8][0];

  const revenue = Number(revenueRow.revenue);
  const cogs = Number(cogsRow.cogs);
  const expenses = 0; // Phase 10 will populate this from the expenses table
  const estimatedProfit = revenue - cogs - expenses;

  return {
    period: { from, to },
    orders: {
      total: orderStats.total,
      completed: orderStats.completed || 0,
      cancelled: orderStats.cancelled || 0,
      pending: orderStats.pending || 0,
    },
    finance: { revenue, costOfGoods: cogs, expenses, estimatedProfit },
    productsSold,
    stockMovements: {
      stockIn: Number(stockIn.total),
      stockOut: Number(stockOut.total),
      adjustments: adjustments.count,
      workerTakings: Number(workerTakings.total),
    },
    workerActivity,
  };
}

/** Monday-start ISO week containing `dateStr` (YYYY-MM-DD), defaults to today. */
function getWeekRange(dateStr) {
  const date = dateStr ? new Date(`${dateStr}T00:00:00`) : new Date();
  if (isNaN(date.getTime())) throw new ApiError(400, 'Invalid date.');

  const day = date.getDay(); // 0 = Sunday
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(date);
  monday.setDate(date.getDate() + diffToMonday);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  return { from: toDateStr(monday), to: toDateStr(sunday) };
}

/** First/last day of the given month (1-12), defaults to current month. */
function getMonthRange(year, month) {
  const now = new Date();
  const y = year ? Number(year) : now.getFullYear();
  const m = month ? Number(month) : now.getMonth() + 1;
  if (m < 1 || m > 12) throw new ApiError(400, 'Month must be between 1 and 12.');

  const first = new Date(y, m - 1, 1);
  const last = new Date(y, m, 0);
  return { from: toDateStr(first), to: toDateStr(last) };
}

function toDateStr(d) {
  return d.toISOString().slice(0, 10);
}

/**
 * Turns the report payload into CSV text (for export). Kept intentionally
 * simple/flat rather than a multi-section CSV library, since the report
 * shape is fixed and known.
 */
function reportToCsv(report) {
  const lines = [];
  lines.push('Report Period', `${report.period.from} to ${report.period.to}`);
  lines.push('');
  lines.push('Metric,Value');
  lines.push(`Total Orders,${report.orders.total}`);
  lines.push(`Completed Orders,${report.orders.completed}`);
  lines.push(`Cancelled Orders,${report.orders.cancelled}`);
  lines.push(`Pending Orders,${report.orders.pending}`);
  lines.push(`Revenue,${report.finance.revenue}`);
  lines.push(`Cost of Goods Sold,${report.finance.costOfGoods}`);
  lines.push(`Expenses,${report.finance.expenses}`);
  lines.push(`Estimated Profit,${report.finance.estimatedProfit}`);
  lines.push(`Stock In (units),${report.stockMovements.stockIn}`);
  lines.push(`Stock Out (units),${report.stockMovements.stockOut}`);
  lines.push(`Stock Adjustments (count),${report.stockMovements.adjustments}`);
  lines.push(`Worker Stock Takings (units),${report.stockMovements.workerTakings}`);
  lines.push('');
  lines.push('Top Products Sold');
  lines.push('Product,Quantity,Revenue');
  report.productsSold.forEach((p) => lines.push(`"${p.name}",${p.quantity},${p.revenue}`));
  lines.push('');
  lines.push('Worker Activity');
  lines.push('Worker,Actions');
  report.workerActivity.forEach((w) => lines.push(`"${w.worker_name}",${w.actions}`));

  return lines.join('\n');
}

module.exports = { generateReport, getWeekRange, getMonthRange, toDateStr, reportToCsv };
