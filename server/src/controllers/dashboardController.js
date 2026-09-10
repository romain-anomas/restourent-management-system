const { pool } = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');

/**
 * GET /api/dashboard - admin only.
 * Returns today's snapshot, inventory health, and chart-ready series.
 * Expenses are not yet tracked (Phase 10), so estimatedProfit currently
 * subtracts only cost-of-goods-sold from revenue - it will incorporate
 * real expenses once that module exists.
 */
const getDashboard = asyncHandler(async (req, res) => {
  const [
    [[todaySales]],
    [[todayOrders]],
    [[pendingOrders]],
    [[completedToday]],
    [[cancelledToday]],
    [[productStats]],
    [[lowStock]],
    [[workerCount]],
    [[inventoryValue]],
    [[monthRevenue]],
    salesOverTime,
    ordersOverTime,
    bestSelling,
    categoryPerformance,
  ] = await Promise.all([
    pool.query(
      `SELECT COALESCE(SUM(total_amount),0) AS total FROM orders
       WHERE DATE(created_at) = CURDATE() AND status != 'cancelled'`
    ),
    pool.query(`SELECT COUNT(*) AS count FROM orders WHERE DATE(created_at) = CURDATE()`),
    pool.query(`SELECT COUNT(*) AS count FROM orders WHERE status = 'pending'`),
    pool.query(
      `SELECT COUNT(*) AS count FROM orders WHERE status = 'completed' AND DATE(created_at) = CURDATE()`
    ),
    pool.query(
      `SELECT COUNT(*) AS count FROM orders WHERE status = 'cancelled' AND DATE(created_at) = CURDATE()`
    ),
    pool.query(`SELECT COUNT(*) AS count FROM products WHERE is_active = 1`),
    pool.query(
      `SELECT COUNT(*) AS count FROM products WHERE is_active = 1 AND current_stock <= minimum_stock`
    ),
    pool.query(`SELECT COUNT(*) AS count FROM users WHERE role = 'worker' AND status = 'active'`),
    pool.query(`SELECT COALESCE(SUM(current_stock * cost_price),0) AS total FROM products WHERE is_active = 1`),
    pool.query(
      `SELECT COALESCE(SUM(total_amount),0) AS revenue FROM orders
       WHERE status = 'completed' AND YEAR(created_at) = YEAR(CURDATE()) AND MONTH(created_at) = MONTH(CURDATE())`
    ),
    pool.query(
      `SELECT DATE(created_at) AS date, COALESCE(SUM(total_amount),0) AS total
       FROM orders WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 6 DAY) AND status != 'cancelled'
       GROUP BY DATE(created_at) ORDER BY date ASC`
    ),
    pool.query(
      `SELECT DATE(created_at) AS date, COUNT(*) AS count
       FROM orders WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)
       GROUP BY DATE(created_at) ORDER BY date ASC`
    ),
    pool.query(
      `SELECT oi.product_name AS name, SUM(oi.quantity) AS quantity
       FROM order_items oi JOIN orders o ON o.id = oi.order_id
       WHERE o.status != 'cancelled'
       GROUP BY oi.product_name ORDER BY quantity DESC LIMIT 5`
    ),
    pool.query(
      `SELECT c.name AS category, COALESCE(SUM(oi.line_total),0) AS revenue
       FROM order_items oi
       JOIN orders o ON o.id = oi.order_id
       LEFT JOIN products p ON p.id = oi.product_id
       LEFT JOIN categories c ON c.id = p.category_id
       WHERE o.status != 'cancelled'
       GROUP BY c.name ORDER BY revenue DESC LIMIT 6`
    ),
  ]);

  // Cost of goods sold this month (for a rough profit estimate)
  const [[cogsRow]] = await pool.query(
    `SELECT COALESCE(SUM(oi.quantity * p.cost_price),0) AS cogs
     FROM order_items oi
     JOIN orders o ON o.id = oi.order_id
     LEFT JOIN products p ON p.id = oi.product_id
     WHERE o.status = 'completed' AND YEAR(o.created_at) = YEAR(CURDATE()) AND MONTH(o.created_at) = MONTH(CURDATE())`
  );

  const monthRevenueValue = Number(monthRevenue.revenue);
  const cogs = Number(cogsRow.cogs);
  const expensesThisMonth = 0; // Phase 10 will populate this from the expenses table
  const estimatedProfit = monthRevenueValue - cogs - expensesThisMonth;

  res.json({
    success: true,
    data: {
      today: {
        sales: Number(todaySales.total),
        orders: todayOrders.count,
        pendingOrders: pendingOrders.count,
        completedOrders: completedToday.count,
        cancelledOrders: cancelledToday.count,
      },
      inventory: {
        totalProducts: productStats.count,
        lowStockCount: lowStock.count,
        inventoryValue: Number(inventoryValue.total),
      },
      workers: { total: workerCount.count },
      finance: {
        monthRevenue: monthRevenueValue,
        monthCogs: cogs,
        monthExpenses: expensesThisMonth,
        estimatedProfit,
      },
      charts: {
        salesOverTime: salesOverTime[0],
        ordersOverTime: ordersOverTime[0],
        bestSellingProducts: bestSelling[0],
        categoryPerformance: categoryPerformance[0],
      },
    },
  });
});

module.exports = { getDashboard };
