/**
 * Tests for staff-recorded walk-in/phone orders (POST /api/orders/manual).
 * Requires the database to be schema-imported (or migrated through 003)
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

async function createTestProducts(adminToken, count = 2) {
  const ids = [];
  for (let i = 0; i < count; i++) {
    const res = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .field('name', `Manual Order Test Product ${i} ${Date.now()}`)
      .field('sellingPrice', '2000')
      .field('costPrice', '1000')
      .field('currentStock', '50')
      .field('minimumStock', '5');
    ids.push(res.body.data.id);
  }
  return ids;
}

describe('Manual order creation requires auth', () => {
  test('unauthenticated request is rejected', async () => {
    const res = await request(app).post('/api/orders/manual').send({ customerName: 'X', items: [] });
    expect(res.statusCode).toBe(401);
  });
});

describe('Worker can record a multi-product walk-in order', () => {
  let adminToken;
  let workerToken;
  let productIds;

  beforeAll(async () => {
    adminToken = await loginAs(ADMIN_EMAIL, ADMIN_PASSWORD, 'admin');
    workerToken = await loginAs(WORKER_EMAIL, WORKER_PASSWORD, 'worker');

    await request(app)
      .put('/api/settings')
      .set('Authorization', `Bearer ${adminToken}`)
      .field('taxPercent', '0');

    productIds = await createTestProducts(adminToken, 3);
  });

  test('rejects an order with no products', async () => {
    const res = await request(app)
      .post('/api/orders/manual')
      .set('Authorization', `Bearer ${workerToken}`)
      .send({ customerName: 'Walk-in Customer', items: [] });
    expect(res.statusCode).toBe(400);
  });

  test('creates an order with multiple products, already confirmed, stock deducted immediately', async () => {
    const res = await request(app)
      .post('/api/orders/manual')
      .set('Authorization', `Bearer ${workerToken}`)
      .send({
        customerName: 'Walk-in Customer',
        customerPhone: '0780000011',
        items: [
          { productId: productIds[0], quantity: 2 },
          { productId: productIds[1], quantity: 3 },
          { productId: productIds[2], quantity: 1 },
        ],
        paymentMethod: 'cash',
      });

    expect(res.statusCode).toBe(201);
    expect(res.body.data.status).toBe('confirmed');
    expect(res.body.data.paymentStatus).toBe('paid'); // cash auto-marks paid
    expect(res.body.data.items.length).toBe(3);
    expect(Number(res.body.data.totalAmount)).toBe(2000 * 2 + 2000 * 3 + 2000 * 1);

    // Stock should already be deducted (order created at "confirmed")
    const productRes = await request(app).get(`/api/products/${productIds[0]}`);
    expect(Number(productRes.body.data.current_stock)).toBe(48); // 50 - 2
  });

  test('an unpaid manual order (no payment method) stays unpaid', async () => {
    const res = await request(app)
      .post('/api/orders/manual')
      .set('Authorization', `Bearer ${workerToken}`)
      .send({
        customerName: 'Phone Order Customer',
        items: [{ productId: productIds[0], quantity: 1 }],
      });
    expect(res.statusCode).toBe(201);
    expect(res.body.data.paymentStatus).toBe('unpaid');
  });

  test('rejects an order that would take stock negative without allow_negative_stock', async () => {
    const res = await request(app)
      .post('/api/orders/manual')
      .set('Authorization', `Bearer ${workerToken}`)
      .send({
        customerName: 'Overorder Customer',
        items: [{ productId: productIds[2], quantity: 9999 }],
      });
    expect(res.statusCode).toBe(409);
  });

  test('an invoice can be generated immediately for the manual order', async () => {
    const orderRes = await request(app)
      .post('/api/orders/manual')
      .set('Authorization', `Bearer ${workerToken}`)
      .send({
        customerName: 'Invoice Test Walk-in',
        items: [{ productId: productIds[0], quantity: 1 }],
        markPaid: true,
      });

    const invoiceRes = await request(app)
      .post(`/api/invoices/generate/${orderRes.body.data.id}`)
      .set('Authorization', `Bearer ${workerToken}`);
    expect(invoiceRes.statusCode).toBe(201);
    expect(invoiceRes.body.data.invoice_number).toBeDefined();
  });
});
