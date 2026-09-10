const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const reportService = require('../services/reportService');

function sendReport(res, report, format) {
  if (format === 'csv') {
    const csv = reportService.reportToCsv(report);
    res.set({
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="report-${report.period.from}_to_${report.period.to}.csv"`,
    });
    return res.send(csv);
  }
  res.json({ success: true, data: report });
}

/** GET /api/reports/daily - admin only. Query: date (defaults to today), format=csv optional. */
const getDailyReport = asyncHandler(async (req, res) => {
  const date = req.query.date || reportService.toDateStr(new Date());
  const report = await reportService.generateReport(date, date);
  sendReport(res, report, req.query.format);
});

/** GET /api/reports/weekly - admin only. Query: date (any day in the target week), format=csv optional. */
const getWeeklyReport = asyncHandler(async (req, res) => {
  const { from, to } = reportService.getWeekRange(req.query.date);
  const report = await reportService.generateReport(from, to);
  sendReport(res, report, req.query.format);
});

/** GET /api/reports/monthly - admin only. Query: year, month (1-12), format=csv optional. */
const getMonthlyReport = asyncHandler(async (req, res) => {
  const { from, to } = reportService.getMonthRange(req.query.year, req.query.month);
  const report = await reportService.generateReport(from, to);
  sendReport(res, report, req.query.format);
});

/** GET /api/reports/custom - admin only. Query: from, to (required), format=csv optional. */
const getCustomReport = asyncHandler(async (req, res) => {
  const { from, to } = req.query;
  if (!from || !to) {
    throw new ApiError(400, 'Both "from" and "to" dates are required for a custom report.');
  }
  if (new Date(from) > new Date(to)) {
    throw new ApiError(400, '"from" date must be before or equal to "to" date.');
  }
  const report = await reportService.generateReport(from, to);
  sendReport(res, report, req.query.format);
});

module.exports = { getDailyReport, getWeeklyReport, getMonthlyReport, getCustomReport };
