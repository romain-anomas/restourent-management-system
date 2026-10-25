const { pool } = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const momoService = require('../services/momoService');
const flutterwaveService = require('../services/flutterwaveService');
const { createNotification } = require('../services/notificationService');
const { logActivity } = require('../services/activityLogService');

/**
 * GET /api/payments/momo/validate/:phone - public.
 * Lets the checkout page check, in real time, whether a phone number
 * has an active MTN MoMo account before the customer submits the order -
 * avoids a silent failed payment prompt after the fact.
 * Returns { valid: true|false|null } - null means "couldn't check,
 * proceed anyway" (e.g. MTN not configured or temporarily unreachable).
 */
const validateMomoNumber = asyncHandler(async (req, res) => {
  const valid = await momoService.validateAccountHolder(req.params.phone);
  res.json({ success: true, data: { valid } });
});

/**
 * GET /api/payments/momo/status/:orderNumber - public.
 * Polled by the order confirmation page while payment is pending.
 * If MTN reports SUCCESSFUL, this marks the order (and any generated
 * invoice) as paid automatically - no staff action needed.
 */
const checkMomoStatus = asyncHandler(async (req, res) => {
  const [rows] = await pool.query(
    `SELECT id, payment_status, payment_method, momo_reference_id FROM orders WHERE order_number = ? LIMIT 1`,
    [req.params.orderNumber]
  );
  const order = rows[0];
  if (!order) throw new ApiError(404, 'Order not found.');

  if (order.payment_method !== 'momo') {
    return res.json({ success: true, data: { status: 'NOT_APPLICABLE', paymentStatus: order.payment_status } });
  }
  if (order.payment_status === 'paid') {
    return res.json({ success: true, data: { status: 'SUCCESSFUL', paymentStatus: 'paid' } });
  }
  if (!order.momo_reference_id) {
    return res.json({ success: true, data: { status: 'NOT_SENT', paymentStatus: order.payment_status } });
  }
  if (!momoService.isConfigured()) {
    return res.json({ success: true, data: { status: 'NOT_CONFIGURED', paymentStatus: order.payment_status } });
  }

  const momoResult = await momoService.checkStatus(order.momo_reference_id);

  if (momoResult.status === 'SUCCESSFUL' && order.payment_status !== 'paid') {
    await pool.query('UPDATE orders SET payment_status = ? WHERE id = ?', ['paid', order.id]);
    await pool.query('UPDATE invoices SET payment_status = ? WHERE order_id = ?', ['paid', order.id]);
    await logActivity({
      userId: null,
      action: 'momo_payment_confirmed',
      description: `MTN MoMo payment confirmed automatically for order #${order.id}`,
      relatedType: 'order',
      relatedId: order.id,
    });
    await createNotification({
      recipientRole: 'all',
      type: 'payment_confirmed',
      title: 'Payment received',
      message: `MTN MoMo payment confirmed for order #${req.params.orderNumber}`,
      relatedType: 'order',
      relatedId: order.id,
    });
  }

  res.json({
    success: true,
    data: {
      status: momoResult.status,
      paymentStatus: momoResult.status === 'SUCCESSFUL' ? 'paid' : order.payment_status,
      reason: momoResult.reason,
    },
  });
});

/**
 * POST /api/payments/momo/retry/:orderNumber - public, rate-limited.
 * Re-sends the payment prompt if the first one failed or the customer
 * didn't see it in time.
 */
const retryMomoRequest = asyncHandler(async (req, res) => {
  if (!momoService.isConfigured()) {
    throw new ApiError(503, 'Automatic MoMo payments are not configured yet. Please pay using the details shown and contact the restaurant.');
  }

  const [rows] = await pool.query(
    `SELECT id, order_number, customer_phone, total_amount, payment_method, payment_status
     FROM orders WHERE order_number = ? LIMIT 1`,
    [req.params.orderNumber]
  );
  const order = rows[0];
  if (!order) throw new ApiError(404, 'Order not found.');
  if (order.payment_method !== 'momo') throw new ApiError(400, 'This order is not using MTN MoMo.');
  if (order.payment_status === 'paid') throw new ApiError(409, 'This order is already paid.');

  const { referenceId } = await momoService.requestToPay({
    amount: order.total_amount,
    phone: order.customer_phone,
    externalId: order.id,
    payerMessage: `Payment for order ${order.order_number}`,
    payeeNote: `Order ${order.order_number}`,
  });

  await pool.query('UPDATE orders SET momo_reference_id = ? WHERE id = ?', [referenceId, order.id]);

  res.json({ success: true, message: 'Payment request sent again. Check your phone.' });
});

const retryCardCheckout = asyncHandler(async (req, res) => {
  const [rows] = await pool.query('SELECT id, payment_status, payment_method, order_type FROM orders WHERE order_number = ? LIMIT 1', [req.params.orderNumber]);
  const order = rows[0];
  if (!order) throw new ApiError(404, 'Order not found.');
  if (order.payment_method !== 'card' || order.order_type === 'DINE_IN') throw new ApiError(400, 'This order does not use online card payment.');
  if (order.payment_status === 'paid') throw new ApiError(409, 'This order is already paid.');
  const checkout = await flutterwaveService.createCheckout(order.id);
  res.json({ success: true, data: { checkoutUrl: checkout.link } });
});

const verifyCardPayment = asyncHandler(async (req, res) => {
  const transactionId = String(req.body.transactionId || '').trim();
  const txRef = String(req.body.txRef || '').trim();
  if (!/^\d+$/.test(transactionId) || !txRef) throw new ApiError(400, 'Payment verification details are missing.');
  const result = await flutterwaveService.verifyAndApplyPayment({
    transactionId,
    txRef,
    expectedOrderNumber: req.params.orderNumber,
  });
  res.json({ success: true, data: result });
});

const handleFlutterwaveWebhook = asyncHandler(async (req, res) => {
  if (!flutterwaveService.isValidWebhook(req.rawBody, req.get('flutterwave-signature'))) {
    return res.status(401).json({ success: false, message: 'Invalid webhook signature.' });
  }
  const event = req.body?.event;
  const payment = req.body?.data;
  if (event === 'charge.completed' && payment?.id && payment?.tx_ref) {
    await flutterwaveService.verifyAndApplyPayment({ transactionId: payment.id, txRef: payment.tx_ref });
  }
  res.sendStatus(200);
});

module.exports = {
  checkMomoStatus, retryMomoRequest, validateMomoNumber,
  retryCardCheckout, verifyCardPayment, handleFlutterwaveWebhook,
};
