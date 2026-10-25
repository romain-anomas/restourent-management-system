/**
 * Tests for bulk inventory operations (multiple products per request).
 * Requires the database to be schema-imported and seeded first.
 */
const request = require('supertest');
const app = require('../src/app');

const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL || 'admin@restaurant.com';
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD || 'Admin@12345';

async function loginAs(email, password, role) {
  const res = await request(app).post('/api/auth/login').send({ email, password, role });
  return res.body.data.token;
}

async function createTestProducts(adminToken, count, stock = 20) {
  const ids = [];
  for (let i = 0; i < count; i++) {
    const res = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .field('name', `Bulk Inventory Test Product ${i} ${Date.now()}`)
      .field('sellingPrice', '1000')
      .field('currentStock', String(stock))
      .field('minimumStock', '3');
    ids.push(res.body.data.id);
  }
  return ids;
}

describe('Bulk stock-in', () => {
  let adminToken;
  let productIds;

  beforeAll(async () => {
    adminToken = await loginAs(ADMIN_EMAIL, ADMIN_PASSWORD, 'admin');
    productIds = await createTestProducts(adminToken, 3, 10);
  });

  test('rejects an empty items array', async () => {
    const res = await request(app)
      .post('/api/inventory/stock-in')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ items: [] });
    expect(res.statusCode).toBe(400);
  });

  test('stocks in multiple products in one request, sharing supplier/reference', async () => {
    const res = await request(app)
      .post('/api/inventory/stock-in')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        items: [
          { productId: productIds[0], quantity: 5, unitCost: 500 },
          { productId: productIds[1], quantity: 10, unitCost: 300 },
          { productId: productIds[2], quantity: 2, unitCost: 700 },
        ],
        supplier: 'Test Wholesale Ltd',
        reference: 'INV-BULK-001',
      });

    expect(res.statusCode).toBe(201);
    expect(res.body.data.length).toBe(3);

    const p0 = await request(app).get(`/api/products/${productIds[0]}`);
    expect(Number(p0.body.data.current_stock)).toBe(15); // 10 + 5
    const p1 = await request(app).get(`/api/products/${productIds[1]}`);
    expect(Number(p1.body.data.current_stock)).toBe(20); // 10 + 10
  });

  test('a bad product id in the batch fails the whole batch (atomic)', async () => {
    const p0Before = await request(app).get(`/api/products/${productIds[0]}`);

    const res = await request(app)
      .post('/api/inventory/stock-in')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        items: [
          { productId: productIds[0], quantity: 5 },
          { productId: 999999, quantity: 5 }, // invalid product
        ],
      });
    expect(res.statusCode).toBe(404);

    // productIds[0] should NOT have been updated since the whole transaction rolled back
    const p0After = await request(app).get(`/api/products/${productIds[0]}`);
    expect(Number(p0After.body.data.current_stock)).toBe(Number(p0Before.body.data.current_stock));
  });
});

describe('Bulk stock-out', () => {
  let adminToken;
  let productIds;

  beforeAll(async () => {
    adminToken = await loginAs(ADMIN_EMAIL, ADMIN_PASSWORD, 'admin');
    productIds = await createTestProducts(adminToken, 2, 20);
  });

  test('stocks out multiple products sharing one reason', async () => {
    const res = await request(app)
      .post('/api/inventory/stock-out')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        items: [
          { productId: productIds[0], quantity: 4 },
          { productId: productIds[1], quantity: 6 },
        ],
        reason: 'Weekly kitchen prep',
      });

    expect(res.statusCode).toBe(201);
    const p0 = await request(app).get(`/api/products/${productIds[0]}`);
    expect(Number(p0.body.data.current_stock)).toBe(16); // 20 - 4
    const p1 = await request(app).get(`/api/products/${productIds[1]}`);
    expect(Number(p1.body.data.current_stock)).toBe(14); // 20 - 6
  });

  test('rejects the whole batch if any single item would go negative', async () => {
    const p1Before = await request(app).get(`/api/products/${productIds[1]}`);

    const res = await request(app)
      .post('/api/inventory/stock-out')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        items: [
          { productId: productIds[0], quantity: 1 },
          { productId: productIds[1], quantity: 99999 },
        ],
        reason: 'Test',
      });
    expect(res.statusCode).toBe(409);

    const p1After = await request(app).get(`/api/products/${productIds[1]}`);
    expect(Number(p1After.body.data.current_stock)).toBe(Number(p1Before.body.data.current_stock));
  });
});

describe('Bulk stock adjustment', () => {
  let adminToken;
  let productIds;

  beforeAll(async () => {
    adminToken = await loginAs(ADMIN_EMAIL, ADMIN_PASSWORD, 'admin');
    productIds = await createTestProducts(adminToken, 2, 10);
  });

  test('requires a shared reason', async () => {
    const res = await request(app)
      .post('/api/inventory/adjustment')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ items: [{ productId: productIds[0], newQuantity: 5 }] });
    expect(res.statusCode).toBe(400);
  });

  test('adjusts multiple products to their exact new counts', async () => {
    const res = await request(app)
      .post('/api/inventory/adjustment')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        items: [
          { productId: productIds[0], newQuantity: 7 },
          { productId: productIds[1], newQuantity: 25 },
        ],
        reason: 'Monthly physical stock count',
      });

    expect(res.statusCode).toBe(201);
    const p0 = await request(app).get(`/api/products/${productIds[0]}`);
    expect(Number(p0.body.data.current_stock)).toBe(7);
    const p1 = await request(app).get(`/api/products/${productIds[1]}`);
    expect(Number(p1.body.data.current_stock)).toBe(25);
  });
});
