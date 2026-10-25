const crypto = require('crypto');
const { pool } = require('../config/db');

const SECRET_KEY = process.env.FLW_SECRET_KEY;
const API_URL = 'https://api.flutterwave.com/v3';

function isConfigured() {
  return Boolean(SECRET_KEY);
}

async function request(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${SECRET_KEY}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  const result = await response.json();
  if (!response.ok || result.status !== 'success') {
    throw new Error(result.message || `Flutterwave request failed (${response.status}).`);
  }
  return result.data;
}

async function createCheckout(orderId) {
  if (!isConfigured()) throw new Error('Online card payments are not configured.');
  const [rows] = await pool.query(
    `SELECT o.id, o.order_number, o.customer_name, o.customer_phone, o.customer_email,
            o.total_amount, o.payment_status, o.order_type, s.currency, s.restaurant_name
     FROM orders o CROSS JOIN restaurant_settings s
     WHERE o.id = ? LIMIT 1`,
    [orderId]
  );
  const order = rows[0];
  if (!order) throw new Error('Order not found.');
  if (order.payment_status === 'paid') throw new Error('This order is already paid.');
  if (order.order_type === 'DINE_IN') throw new Error('Dine-in card payments are handled at the restaurant terminal.');

  const txRef = `order-${order.id}-${crypto.randomUUID()}`;
  await pool.query(
    `INSERT INTO payment_transactions (order_id, provider, tx_ref, status) VALUES (?, 'flutterwave', ?, 'pending')`,
    [order.id, txRef]
  );
  try {
    const clientUrl = (process.env.CLIENT_URL || 'http://localhost:5173').replace(/\/$/, '');
    const payment = await request('/payments', {
      method: 'POST',
      body: JSON.stringify({
        tx_ref: txRef,
        amount: String(Math.round(Number(order.total_amount))),
        currency: String(order.currency || 'RWF').toUpperCase(),
        payment_options: 'card',
        redirect_url: `${clientUrl}/order-confirmation/${encodeURIComponent(order.order_number)}?payment=card`,
        customer: {
          email: order.customer_email,
          name: order.customer_name,
          phonenumber: order.customer_phone,
        },
        customizations: {
          title: order.restaurant_name || 'Restaurant order',
          description: `Payment for order ${order.order_number}`,
        },
        meta: { order_id: order.id, order_number: order.order_number },
      }),
    });
    if (!payment.link?.startsWith('https://checkout.flutterwave.com/')) {
      throw new Error('Flutterwave did not return a valid secure checkout link.');
    }
    return { link: payment.link, txRef };
  } catch (error) {
    await pool.query(`UPDATE payment_transactions SET status = 'failed' WHERE tx_ref = ?`, [txRef]);
    throw error;
  }
}

async function verifyAndApplyPayment({ transactionId, txRef, expectedOrderNumber }) {
  if (!isConfigured()) throw new Error('Online card payments are not configured.');
  const [rows] = await pool.query(
    `SELECT pt.id AS payment_id, pt.order_id, pt.tx_ref, pt.status AS transaction_status,
            o.order_number, o.total_amount, o.payment_status, o.payment_method, o.order_type,
            s.currency
     FROM payment_transactions pt
     JOIN orders o ON o.id = pt.order_id
     CROSS JOIN restaurant_settings s
     WHERE pt.tx_ref = ? AND pt.provider = 'flutterwave' LIMIT 1`,
    [txRef]
  );
  const attempt = rows[0];
  if (!attempt) throw new Error('Payment reference not found.');
  if (expectedOrderNumber && attempt.order_number !== expectedOrderNumber) throw new Error('Payment reference does not match this order.');
  if (attempt.payment_method !== 'card' || attempt.order_type === 'DINE_IN') throw new Error('This order does not use online card payment.');

  const transaction = await request(`/transactions/${encodeURIComponent(transactionId)}/verify`, { method: 'GET' });
  const valid = transaction.status === 'successful'
    && String(transaction.tx_ref) === String(attempt.tx_ref)
    && String(transaction.currency).toUpperCase() === String(attempt.currency || 'RWF').toUpperCase()
    && Number(transaction.amount) >= Number(attempt.total_amount);

  if (!valid) {
    if (transaction.status === 'failed' || transaction.status === 'cancelled') {
      await pool.query(
        `UPDATE payment_transactions SET status = 'failed', gateway_transaction_id = ? WHERE id = ?`,
        [String(transactionId), attempt.payment_id]
      );
    }
    return { successful: false, paymentStatus: attempt.payment_status };
  }

  await pool.query(
    `UPDATE payment_transactions SET status = 'successful', gateway_transaction_id = ? WHERE id = ?`,
    [String(transactionId), attempt.payment_id]
  );
  const [updateResult] = await pool.query(
    `UPDATE orders SET payment_status = 'paid' WHERE id = ? AND payment_status <> 'paid'`,
    [attempt.order_id]
  );
  if (updateResult.affectedRows > 0) {
    await pool.query('UPDATE invoices SET payment_status = ? WHERE order_id = ?', ['paid', attempt.order_id]);
    const { createNotification } = require('./notificationService');
    const { logActivity } = require('./activityLogService');
    await logActivity({
      userId: null,
      action: 'card_payment_confirmed',
      description: `Card payment confirmed for order ${attempt.order_number}`,
      relatedType: 'order',
      relatedId: attempt.order_id,
    });
    await createNotification({
      recipientRole: 'all',
      type: 'payment_confirmed',
      title: 'Payment received',
      message: `Card payment confirmed for order ${attempt.order_number}`,
      relatedType: 'order',
      relatedId: attempt.order_id,
    });
  }
  return { successful: true, paymentStatus: 'paid' };
}

function isValidWebhook(rawBody, signature) {
  const secretHash = process.env.FLW_SECRET_HASH;
  if (!secretHash || !signature || !rawBody) return false;
  const expected = crypto.createHmac('sha256', secretHash).update(rawBody).digest('base64');
  const expectedBuffer = Buffer.from(expected);
  const signatureBuffer = Buffer.from(signature);
  return expectedBuffer.length === signatureBuffer.length && crypto.timingSafeEqual(expectedBuffer, signatureBuffer);
}

module.exports = { isConfigured, createCheckout, verifyAndApplyPayment, isValidWebhook };
