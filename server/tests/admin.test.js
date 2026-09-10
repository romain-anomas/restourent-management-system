/**
 * Tests for Phase 5 admin endpoints. Requires the database to be
 * schema-imported and seeded first (uses the seeded admin/worker accounts).
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

describe('Admin-only endpoints reject non-admins', () => {
  test('worker cannot create a product', async () => {
    const workerToken = await loginAs(WORKER_EMAIL, WORKER_PASSWORD, 'worker');
    const res = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${workerToken}`)
      .send({ name: 'Should Fail', sellingPrice: 1000 });
    expect(res.statusCode).toBe(403);
  });

  test('worker cannot list workers', async () => {
    const workerToken = await loginAs(WORKER_EMAIL, WORKER_PASSWORD, 'worker');
    const res = await request(app).get('/api/workers').set('Authorization', `Bearer ${workerToken}`);
    expect(res.statusCode).toBe(403);
  });

  test('unauthenticated request to dashboard is rejected', async () => {
    const res = await request(app).get('/api/dashboard');
    expect(res.statusCode).toBe(401);
  });
});

describe('Admin product & category CRUD', () => {
  let adminToken;
  let categoryId;
  let productId;

  beforeAll(async () => {
    adminToken = await loginAs(ADMIN_EMAIL, ADMIN_PASSWORD, 'admin');
  });

  test('admin creates a category', async () => {
    const res = await request(app)
      .post('/api/categories')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: `Test Category ${Date.now()}` });
    expect(res.statusCode).toBe(201);
    categoryId = res.body.data.id;
  });

  test('admin creates a product in that category', async () => {
    const res = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .field('name', 'Test Product')
      .field('sellingPrice', '5000')
      .field('costPrice', '2000')
      .field('currentStock', '20')
      .field('minimumStock', '5')
      .field('categoryId', String(categoryId));
    expect(res.statusCode).toBe(201);
    productId = res.body.data.id;
  });

  test('admin can see the product in admin listing (including via ?all=1)', async () => {
    const res = await request(app)
      .get('/api/products?all=1')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.statusCode).toBe(200);
    expect(res.body.data.some((p) => p.id === productId)).toBe(true);
  });

  test('admin updates the product', async () => {
    const res = await request(app)
      .put(`/api/products/${productId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .field('sellingPrice', '5500');
    expect(res.statusCode).toBe(200);
  });

  test('admin deactivates the product', async () => {
    const res = await request(app)
      .patch(`/api/products/${productId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ isActive: false });
    expect(res.statusCode).toBe(200);
  });
});

describe('Order confirmation deducts inventory, cancellation restocks it', () => {
  let adminToken;
  let productId;
  let orderId;

  beforeAll(async () => {
    adminToken = await loginAs(ADMIN_EMAIL, ADMIN_PASSWORD, 'admin');

    const productRes = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .field('name', 'Stock Test Product')
      .field('sellingPrice', '1000')
      .field('currentStock', '10')
      .field('minimumStock', '2');
    productId = productRes.body.data.id;

    const orderRes = await request(app)
      .post('/api/orders')
      .send({
        customerName: 'Stock Test Customer',
        customerPhone: '0780000001',
        items: [{ productId, quantity: 3 }],
      });
    orderId = orderRes.body.data.id;
  });

  test('confirming the order deducts stock', async () => {
    const res = await request(app)
      .put(`/api/orders/${orderId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'confirmed' });
    expect(res.statusCode).toBe(200);

    const productRes = await request(app).get(`/api/products/${productId}`);
    expect(Number(productRes.body.data.current_stock)).toBe(7); // 10 - 3
  });

  test('cancelling the confirmed order restocks it', async () => {
    const res = await request(app)
      .put(`/api/orders/${orderId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'cancelled' });
    expect(res.statusCode).toBe(200);

    const productRes = await request(app).get(`/api/products/${productId}`);
    expect(Number(productRes.body.data.current_stock)).toBe(10); // restored
  });

  test('a terminal-state order cannot be changed again', async () => {
    const res = await request(app)
      .put(`/api/orders/${orderId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'preparing' });
    expect(res.statusCode).toBe(409);
  });
});

describe('Admin worker management', () => {
  let adminToken;

  beforeAll(async () => {
    adminToken = await loginAs(ADMIN_EMAIL, ADMIN_PASSWORD, 'admin');
  });

  test('admin creates a new worker with an auto-generated password', async () => {
    const res = await request(app)
      .post('/api/workers')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ fullName: 'New Test Worker', email: `worker${Date.now()}@restaurant.com` });
    expect(res.statusCode).toBe(201);
    expect(res.body.data.temporaryPassword).toBeDefined();
  });

  test('admin cannot create a worker with a duplicate email', async () => {
    const res = await request(app)
      .post('/api/workers')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ fullName: 'Dupe', email: WORKER_EMAIL });
    expect(res.statusCode).toBe(409);
  });
});
