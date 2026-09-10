/**
 * Tests for Phase 8: invoice generation, retrieval, PDF download, and
 * payment status updates. Requires the database to be schema-imported
 * and seeded first.
 */
const request = require('supertest');
const app = require('../src/app');

const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL || 'admin@restaurant.com';
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD || 'Admin@12345';
const WORKER_EMAIL = 'jean@restaurant.com';
const WORKER_PASSWORD = 'Worker@12345';

async function loginAs(email, password, role) {
  const res = await request(app).post('/api/auth/login').send({ email, password, role });
  return res.body.data.token;
}

async function createTestOrder() {
  const productsRes = await request(app).get('/api/products');
  const product = productsRes.body.data[0];
  const res = await request(app)
    .post('/api/orders')
    .send({
      customerName: 'Invoice Test Customer',
      customerPhone: '0780000002',
      items: [{ productId: product.id, quantity: 1 }],
    });
  return res.body.data.id;
}

describe('Invoice generation and retrieval', () => {
  let adminToken;
  let workerToken;
  let orderId;
  let invoiceId;

  beforeAll(async () => {
    adminToken = await loginAs(ADMIN_EMAIL, ADMIN_PASSWORD, 'admin');
    workerToken = await loginAs(WORKER_EMAIL, WORKER_PASSWORD, 'worker');
    orderId = await createTestOrder();
  });

  test('worker can generate an invoice for an order', async () => {
    const res = await request(app)
      .post(`/api/invoices/generate/${orderId}`)
      .set('Authorization', `Bearer ${workerToken}`);
    expect(res.statusCode).toBe(201);
    expect(res.body.data.invoice_number).toBeDefined();
    invoiceId = res.body.data.id;
  });

  test('generating again for the same order returns the same invoice (idempotent)', async () => {
    const res = await request(app)
      .post(`/api/invoices/generate/${orderId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.statusCode).toBe(201);
    expect(res.body.data.id).toBe(invoiceId);
  });

  test('unauthenticated request cannot generate an invoice', async () => {
    const res = await request(app).post(`/api/invoices/generate/${orderId}`);
    expect(res.statusCode).toBe(401);
  });

  test('invoice appears in the admin invoice list', async () => {
    const res = await request(app).get('/api/invoices').set('Authorization', `Bearer ${adminToken}`);
    expect(res.statusCode).toBe(200);
    expect(res.body.data.some((i) => i.id === invoiceId)).toBe(true);
  });

  test('PDF download returns a valid PDF buffer', async () => {
    const res = await request(app)
      .get(`/api/invoices/${invoiceId}/pdf`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toBe('application/pdf');
    // PDF files start with the "%PDF-" magic bytes
    expect(res.body.slice(0, 5).toString()).toBe('%PDF-');
  });

  test('worker cannot change payment status', async () => {
    const res = await request(app)
      .patch(`/api/invoices/${invoiceId}/payment-status`)
      .set('Authorization', `Bearer ${workerToken}`)
      .send({ paymentStatus: 'paid' });
    expect(res.statusCode).toBe(403);
  });

  test('admin can mark the invoice as paid', async () => {
    const res = await request(app)
      .patch(`/api/invoices/${invoiceId}/payment-status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ paymentStatus: 'paid' });
    expect(res.statusCode).toBe(200);

    const detailRes = await request(app)
      .get(`/api/invoices/${invoiceId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(detailRes.body.data.payment_status).toBe('paid');
  });
});
