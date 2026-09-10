const express = require('express');
const router = express.Router();
const {
  getDailyReport, getWeeklyReport, getMonthlyReport, getCustomReport,
} = require('../controllers/reportController');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate, authorize('admin'));

router.get('/daily', getDailyReport);
router.get('/weekly', getWeeklyReport);
router.get('/monthly', getMonthlyReport);
router.get('/custom', getCustomReport);

module.exports = router;
