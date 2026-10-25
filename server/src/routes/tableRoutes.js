const express = require('express');
const router = express.Router();
const {
  listTables,
  listPublicTables,
  getPublicGuestSession,
  createTable,
  updateTable,
  deleteTable,
  getSeatingPlanData,
  getTableOrders,
  openTableSession,
  getActiveSession,
  closeTableSessionForTable,
} = require('../controllers/tableController');
const { authenticate, authorize } = require('../middleware/auth');

router.get('/public', listPublicTables);
router.get('/public/session/:sessionId', getPublicGuestSession);
router.get('/', authenticate, authorize('admin', 'worker'), listTables);
router.get('/seating-plan', authenticate, authorize('admin', 'worker'), getSeatingPlanData);
router.get('/:id/orders', authenticate, authorize('admin'), getTableOrders);
router.post('/', authenticate, authorize('admin', 'worker'), createTable);
router.put('/:id', authenticate, authorize('admin', 'worker'), updateTable);
router.delete('/:id', authenticate, authorize('admin', 'worker'), deleteTable);
router.post('/:id/session', authenticate, authorize('admin', 'worker'), openTableSession);
router.get('/:id/session', authenticate, authorize('admin', 'worker'), getActiveSession);
router.post('/:id/session/close', authenticate, authorize('admin', 'worker'), closeTableSessionForTable);

module.exports = router;
