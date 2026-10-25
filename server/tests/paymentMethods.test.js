/**
 * Tests for the MTN MoMo / Airtel Money payment method feature added
 * after Phase 11. Requires the database to be schema-imported (or
 * migrated) and seeded first.
 */
const request = require('supertest');
const app = require('../src/app');

const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL || 'admin@restaurant.com';
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD || 'Admin@12345';

async function loginAs(email, password, role) {
  const res = await request(app).post('/api/auth/login').send({ email, password, role });
  return res.body.data.token;
}

async function getFirstProductId() {
  const res = await request(app).get('/api/products');
  return res.body.data[0]?.id;
}

describe('Checkout requires a payment method', () => {
  test('rejects an order with no payment method', async () => {
    const productId = await getFirstProductId();
    const res = await request(app)
      .post('/api/orders')
      .send({
        customerName: 'Payment Test Customer',
        customerPhone: '0780000004',
        items: [{ productId, quantity: 1 }],
      });
    expect(res.statusCode).toBe(400);
  });

  test('rejects an invalid payment method', async () => {
    const productId = await getFirstProductId();
    const res = await request(app)
      .post('/api/orders')
      .send({
        customerName: 'Payment Test Customer',
        customerPhone: '0780000004',
        items: [{ productId, quantity: 1 }],
        paymentMethod: 'bitcoin',
      });
    expect(res.statusCode).toBe(400);
  });

  test('accepts momo as a valid payment method and stores the reference', async () => {
    const productId = await getFirstProductId();
    const res = await request(app)
      .post('/api/orders')
      .send({
        customerName: 'Payment Test Customer',
        customerPhone: '0780000004',
        items: [{ productId, quantity: 1 }],
        paymentMethod: 'momo',
        paymentReference: 'MP240912.TEST.123',
      });
    expect(res.statusCode).toBe(201);
    expect(res.body.data.paymentMethod).toBe('momo');

    const trackRes = await request(app).get(`/api/orders/track/${res.body.data.orderNumber}`);
    expect(trackRes.body.data.payment_method).toBe('momo');
    expect(trackRes.body.data.payment_reference).toBe('MP240912.TEST.123');
    expect(trackRes.body.data.payment_status).toBe('unpaid');
  });

  test('accepts airtel_money as a valid payment method', async () => {
    const productId = await getFirstProductId();
    const res = await request(app)
      .post('/api/orders')
      .send({
        customerName: 'Payment Test Customer 2',
        customerPhone: '0780000005',
        items: [{ productId, quantity: 1 }],
        paymentMethod: 'airtel_money',
      });
    expect(res.statusCode).toBe(201);
    expect(res.body.data.paymentMethod).toBe('airtel_money');
  });
});

describe('Public settings expose payment details for checkout', () => {
  test('public settings include momo and airtel money fields', async () => {
    const res = await request(app).get('/api/settings/public');
    expect(res.statusCode).toBe(200);
    expect(res.body.data).toHaveProperty('momo_code');
    expect(res.body.data).toHaveProperty('momo_number');
    expect(res.body.data).toHaveProperty('momo_name');
    expect(res.body.data).toHaveProperty('airtel_money_number');
  });
});

describe('Staff can mark an order as paid', () => {
  let adminToken;
  let orderId;

  beforeAll(async () => {
    adminToken = await loginAs(ADMIN_EMAIL, ADMIN_PASSWORD, 'admin');
    const productId = await getFirstProductId();
    const orderRes = await request(app)
      .post('/api/orders')
      .send({
        customerName: 'Payment Status Test',
        customerPhone: '0780000006',
        items: [{ productId, quantity: 1 }],
        paymentMethod: 'momo',
      });
    orderId = orderRes.body.data.id;
  });

  test('unauthenticated request is rejected', async () => {
    const res = await request(app).patch(`/api/orders/${orderId}/payment-status`).send({ paymentStatus: 'paid' });
    expect(res.statusCode).toBe(401);
  });

  test('admin marks the order as paid', async () => {
    const res = await request(app)
      .patch(`/api/orders/${orderId}/payment-status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ paymentStatus: 'paid' });
    expect(res.statusCode).toBe(200);

    const detailRes = await request(app)
      .get(`/api/orders/${orderId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(detailRes.body.data.payment_status).toBe('paid');
  });

  test('rejects an invalid payment status value', async () => {
    const res = await request(app)
      .patch(`/api/orders/${orderId}/payment-status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ paymentStatus: 'bitcoin' });
    expect(res.statusCode).toBe(400);
  });
});
