/**
 * Tests for Phase 6 inventory endpoints. Requires the database to be
 * schema-imported and seeded first.
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

async function createTestProduct(adminToken, stock = 10) {
  const res = await request(app)
    .post('/api/products')
    .set('Authorization', `Bearer ${adminToken}`)
    .field('name', `Inventory Test Product ${Date.now()}`)
    .field('sellingPrice', '1000')
    .field('currentStock', String(stock))
    .field('minimumStock', '3');
  return res.body.data.id;
}

describe('Inventory endpoints are admin-only', () => {
  test('worker cannot access inventory history', async () => {
    const workerToken = await loginAs(WORKER_EMAIL, WORKER_PASSWORD, 'worker');
    const res = await request(app).get('/api/inventory').set('Authorization', `Bearer ${workerToken}`);
    expect(res.statusCode).toBe(403);
  });

  test('unauthenticated request is rejected', async () => {
    const res = await request(app).post('/api/inventory/stock-in').send({ productId: 1, quantity: 5 });
    expect(res.statusCode).toBe(401);
  });
});

describe('Stock in/out/adjustment', () => {
  let adminToken;
  let productId;

  beforeAll(async () => {
    adminToken = await loginAs(ADMIN_EMAIL, ADMIN_PASSWORD, 'admin');
    productId = await createTestProduct(adminToken, 10);
  });

  test('stock-in increases stock and records a transaction', async () => {
    const res = await request(app)
      .post('/api/inventory/stock-in')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ productId, quantity: 5, unitCost: 500, supplier: 'Test Supplier' });
    expect(res.statusCode).toBe(201);
    expect(res.body.data.newStock).toBe(15);
  });

  test('stock-out decreases stock', async () => {
    const res = await request(app)
      .post('/api/inventory/stock-out')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ productId, quantity: 3, reason: 'Kitchen use' });
    expect(res.statusCode).toBe(201);
    expect(res.body.data.newStock).toBe(12);
  });

  test('stock-out is rejected if it would go negative and allow_negative_stock is off', async () => {
    const res = await request(app)
      .post('/api/inventory/stock-out')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ productId, quantity: 999, reason: 'Too much' });
    expect(res.statusCode).toBe(409);
  });

  test('adjustment requires a reason', async () => {
    const res = await request(app)
      .post('/api/inventory/adjustment')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ productId, newQuantity: 20 });
    expect(res.statusCode).toBe(400);
  });

  test('adjustment sets stock to the exact new value', async () => {
    const res = await request(app)
      .post('/api/inventory/adjustment')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ productId, newQuantity: 20, reason: 'Physical count correction' });
    expect(res.statusCode).toBe(201);

    const productRes = await request(app).get(`/api/products/${productId}`);
    expect(Number(productRes.body.data.current_stock)).toBe(20);
  });

  test('every change appears in the transaction history', async () => {
    const res = await request(app)
      .get(`/api/inventory?productId=${productId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.statusCode).toBe(200);
    const types = res.body.data.map((t) => t.type);
    expect(types).toEqual(expect.arrayContaining(['stock_in', 'stock_out', 'adjustment']));
  });
});
