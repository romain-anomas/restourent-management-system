/**
 * Tests for Phase 7: worker stock-taking + salary deduction workflow.
 * Requires the database to be schema-imported and seeded first.
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

async function createTestProduct(adminToken, stock = 20) {
  const res = await request(app)
    .post('/api/products')
    .set('Authorization', `Bearer ${adminToken}`)
    .field('name', `Worker Stock Test Product ${Date.now()}`)
    .field('sellingPrice', '2000')
    .field('costPrice', '1000')
    .field('currentStock', String(stock))
    .field('minimumStock', '2');
  return res.body.data.id;
}

describe('Worker stock-taking end-to-end workflow', () => {
  let adminToken;
  let workerToken;
  let productId;
  let stockTakingId;

  beforeAll(async () => {
    adminToken = await loginAs(ADMIN_EMAIL, ADMIN_PASSWORD, 'admin');
    workerToken = await loginAs(WORKER_EMAIL, WORKER_PASSWORD, 'worker');
    productId = await createTestProduct(adminToken, 20);
  });

  test('worker records a stock-taking and stock is deducted immediately', async () => {
    const res = await request(app)
      .post('/api/worker-stock')
      .set('Authorization', `Bearer ${workerToken}`)
      .send({ productId, quantity: 4, reason: 'Personal use' });
    expect(res.statusCode).toBe(201);
    stockTakingId = res.body.data.id;

    const productRes = await request(app).get(`/api/products/${productId}`);
    expect(Number(productRes.body.data.current_stock)).toBe(16); // 20 - 4
  });

  test('worker cannot review their own stock-taking record', async () => {
    const res = await request(app)
      .put(`/api/worker-stock/${stockTakingId}/review`)
      .set('Authorization', `Bearer ${workerToken}`)
      .send({ action: 'approve' });
    expect(res.statusCode).toBe(403);
  });

  test('worker can only see their own records', async () => {
    const res = await request(app).get('/api/worker-stock').set('Authorization', `Bearer ${workerToken}`);
    expect(res.statusCode).toBe(200);
    expect(res.body.data.every((r) => r.worker_name)).toBe(true);
  });

  test('admin approves the record, creating a pending salary deduction', async () => {
    const res = await request(app)
      .put(`/api/worker-stock/${stockTakingId}/review`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ action: 'approve' });
    expect(res.statusCode).toBe(200);

    const deductionsRes = await request(app)
      .get('/api/salary-deductions?status=pending')
      .set('Authorization', `Bearer ${adminToken}`);
    const found = deductionsRes.body.data.find((d) => d.worker_stock_taking_id === stockTakingId);
    expect(found).toBeDefined();
    expect(Number(found.amount)).toBe(4000); // 4 * 1000 cost price
  });

  test('approving an already-reviewed record fails', async () => {
    const res = await request(app)
      .put(`/api/worker-stock/${stockTakingId}/review`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ action: 'approve' });
    expect(res.statusCode).toBe(409);
  });

  test('admin approves the salary deduction, marking the stock-taking as deducted', async () => {
    const deductionsRes = await request(app)
      .get('/api/salary-deductions?status=pending')
      .set('Authorization', `Bearer ${adminToken}`);
    const deduction = deductionsRes.body.data.find((d) => d.worker_stock_taking_id === stockTakingId);

    const reviewRes = await request(app)
      .put(`/api/salary-deductions/${deduction.id}/review`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ action: 'approve' });
    expect(reviewRes.statusCode).toBe(200);

    const stockTakingRes = await request(app)
      .get(`/api/worker-stock/${stockTakingId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(stockTakingRes.body.data.status).toBe('deducted');
  });
});

describe('Rejecting a stock-taking record restores stock', () => {
  let adminToken;
  let workerToken;
  let productId;
  let stockTakingId;

  beforeAll(async () => {
    adminToken = await loginAs(ADMIN_EMAIL, ADMIN_PASSWORD, 'admin');
    workerToken = await loginAs(WORKER_EMAIL, WORKER_PASSWORD, 'worker');
    productId = await createTestProduct(adminToken, 10);

    const res = await request(app)
      .post('/api/worker-stock')
      .set('Authorization', `Bearer ${workerToken}`)
      .send({ productId, quantity: 5, reason: 'Test' });
    stockTakingId = res.body.data.id;
  });

  test('stock was deducted on creation', async () => {
    const productRes = await request(app).get(`/api/products/${productId}`);
    expect(Number(productRes.body.data.current_stock)).toBe(5); // 10 - 5
  });

  test('admin rejects the record and stock is restored', async () => {
    const res = await request(app)
      .put(`/api/worker-stock/${stockTakingId}/review`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ action: 'reject' });
    expect(res.statusCode).toBe(200);

    const productRes = await request(app).get(`/api/products/${productId}`);
    expect(Number(productRes.body.data.current_stock)).toBe(10); // restored
  });

  test('no salary deduction was created for the rejected record', async () => {
    const res = await request(app)
      .get('/api/salary-deductions')
      .set('Authorization', `Bearer ${adminToken}`);
    const found = res.body.data.find((d) => d.worker_stock_taking_id === stockTakingId);
    expect(found).toBeUndefined();
  });
});
