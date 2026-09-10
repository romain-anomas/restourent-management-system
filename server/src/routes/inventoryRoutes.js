const express = require('express');
const router = express.Router();
const { listTransactions, stockIn, stockOut, stockAdjustment } = require('../controllers/inventoryController');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate, authorize('admin'));

router.get('/', listTransactions);
router.post('/stock-in', stockIn);
router.post('/stock-out', stockOut);
router.post('/adjustment', stockAdjustment);

module.exports = router;
