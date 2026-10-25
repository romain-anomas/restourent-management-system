const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const {
  createOrder, createManualOrder, trackOrder, listOrders, getOrderById, updateOrderStatus, updateOrderPaymentStatus,
} = require('../controllers/orderController');
const { authenticate, authorize } = require('../middleware/auth');

const checkoutLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many orders placed. Please wait a few minutes and try again.' },
});

// Public
router.post('/', checkoutLimiter, createOrder);
router.get('/track/:orderNumber', trackOrder);

// Admin / worker (worker-facing dashboard UI arrives in Phase 6, but the
// API already supports both roles since the permission model is the same)
router.get('/', authenticate, authorize('admin', 'worker'), listOrders);
router.post('/manual', authenticate, authorize('admin', 'worker'), createManualOrder);
router.get('/:id', authenticate, authorize('admin', 'worker'), getOrderById);
router.put('/:id/status', authenticate, authorize('admin', 'worker'), updateOrderStatus);
router.patch('/:id/payment-status', authenticate, authorize('admin', 'worker'), updateOrderPaymentStatus);

module.exports = router;
