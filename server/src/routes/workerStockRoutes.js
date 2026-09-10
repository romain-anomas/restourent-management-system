const express = require('express');
const router = express.Router();
const {
  createStockTaking, listStockTakings, getStockTakingById, reviewStockTaking,
} = require('../controllers/workerStockController');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate, authorize('admin', 'worker'));

router.get('/', listStockTakings);
router.get('/:id', getStockTakingById);
router.post('/', createStockTaking);
router.put('/:id/review', authorize('admin'), reviewStockTaking);

module.exports = router;
