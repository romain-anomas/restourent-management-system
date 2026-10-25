/**
 * Tests for the MTN MoMo automatic payment integration.
 * These tests run WITHOUT real MTN credentials configured (the CI/dev
 * environment won't have them), so they verify the graceful fallback
 * behavior - a fully configured environment would additionally exercise
 * requestToPay()/checkStatus() against MTN's real sandbox.
 */
const request = require('supertest');
const app = require('../src/app');

async function getFirstProductId() {
  const res = await request(app).get('/api/products');
  return res.body.data[0]?.id;
}

describe('MoMo status endpoint', () => {
  test('returns 404 for a non-existent order', async () => {
    const res = await request(app).get('/api/payments/momo/status/ORD-NOTREAL-0000');
    expect(res.statusCode).toBe(404);
  });

  test('returns NOT_APPLICABLE for an Airtel Money order', async () => {
    const productId = await getFirstProductId();
    const orderRes = await request(app)
      .post('/api/orders')
      .send({
        customerName: 'MoMo Status Test',
        customerPhone: '0780000007',
        items: [{ productId, quantity: 1 }],
        paymentMethod: 'airtel_money',
      });

    const statusRes = await request(app).get(`/api/payments/momo/status/${orderRes.body.data.orderNumber}`);
    expect(statusRes.statusCode).toBe(200);
    expect(statusRes.body.data.status).toBe('NOT_APPLICABLE');
  });

  test('returns NOT_SENT or NOT_CONFIGURED for a momo order when MTN credentials are absent', async () => {
    const productId = await getFirstProductId();
    const orderRes = await request(app)
      .post('/api/orders')
      .send({
        customerName: 'MoMo Status Test 2',
        customerPhone: '0780000008',
        items: [{ productId, quantity: 1 }],
        paymentMethod: 'momo',
      });

    const statusRes = await request(app).get(`/api/payments/momo/status/${orderRes.body.data.orderNumber}`);
    expect(statusRes.statusCode).toBe(200);
    expect(['NOT_SENT', 'NOT_CONFIGURED']).toContain(statusRes.body.data.status);
  });
});

describe('MoMo account validation endpoint', () => {
  test('returns valid:null when MTN is not configured (graceful, never crashes)', async () => {
    const res = await request(app).get('/api/payments/momo/validate/0788123456');
    expect(res.statusCode).toBe(200);
    if (!process.env.MOMO_SUBSCRIPTION_KEY) {
      expect(res.body.data.valid).toBeNull();
    }
  });
});

describe('MoMo retry endpoint', () => {
  test('returns a clear error when MTN is not configured', async () => {
    const productId = await getFirstProductId();
    const orderRes = await request(app)
      .post('/api/orders')
      .send({
        customerName: 'MoMo Retry Test',
        customerPhone: '0780000009',
        items: [{ productId, quantity: 1 }],
        paymentMethod: 'momo',
      });

    const retryRes = await request(app).post(`/api/payments/momo/retry/${orderRes.body.data.orderNumber}`);
    // Without MOMO_SUBSCRIPTION_KEY/API_USER/API_KEY set, this should fail gracefully (503), not crash (500)
    if (!process.env.MOMO_SUBSCRIPTION_KEY) {
      expect(retryRes.statusCode).toBe(503);
    }
  });

  test('rejects retry for a non-momo order', async () => {
    const productId = await getFirstProductId();
    const orderRes = await request(app)
      .post('/api/orders')
      .send({
        customerName: 'MoMo Retry Test 2',
        customerPhone: '0780000010',
        items: [{ productId, quantity: 1 }],
        paymentMethod: 'airtel_money',
      });

    const retryRes = await request(app).post(`/api/payments/momo/retry/${orderRes.body.data.orderNumber}`);
    // Either "not configured" (503) or "not momo" (400) depending on env - both are correct rejections
    expect([400, 503]).toContain(retryRes.statusCode);
  });
});
