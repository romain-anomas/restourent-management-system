const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const {
  checkMomoStatus, retryMomoRequest, validateMomoNumber,
  retryCardCheckout, verifyCardPayment, handleFlutterwaveWebhook,
} = require('../controllers/paymentController');

const retryLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many retry attempts. Please wait a few minutes.' },
});

const validateLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many validation attempts. Please wait a few minutes.' },
});

router.get('/momo/status/:orderNumber', checkMomoStatus);
router.post('/momo/retry/:orderNumber', retryLimiter, retryMomoRequest);
router.get('/momo/validate/:phone', validateLimiter, validateMomoNumber);
router.post('/card/checkout/:orderNumber', retryLimiter, retryCardCheckout);
router.post('/card/verify/:orderNumber', retryLimiter, verifyCardPayment);
router.post('/card/webhook', handleFlutterwaveWebhook);

module.exports = router;
