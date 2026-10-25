/**
 * Tests for Phase 4 public endpoints: categories, products, order creation.
 * Requires the database to be schema-imported and seeded first.
 */
const request = require('supertest');
const app = require('../src/app');

describe('Public storefront API', () => {
  test('GET /api/categories returns active categories', async () => {
    const res = await request(app).get('/api/categories');
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  test('GET /api/products returns active products with computed availability', async () => {
    const res = await request(app).get('/api/products');
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    if (res.body.data.length > 0) {
      expect(res.body.data[0]).toHaveProperty('isAvailable');
    }
  });

  test('GET /api/products/:id returns 404 for a non-existent product', async () => {
    const res = await request(app).get('/api/products/999999');
    expect(res.statusCode).toBe(404);
  });

  test('POST /api/orders rejects an empty cart', async () => {
    const res = await request(app)
      .post('/api/orders')
      .send({ customerName: 'Test Customer', customerPhone: '0780000000', items: [] });
    expect(res.statusCode).toBe(400);
  });

  test('POST /api/orders rejects missing customer info', async () => {
    const res = await request(app)
      .post('/api/orders')
      .send({ items: [{ productId: 1, quantity: 1 }] });
    expect(res.statusCode).toBe(400);
  });

  test('POST /api/orders creates a real order end-to-end and it can be tracked', async () => {
    const productsRes = await request(app).get('/api/products');
    if (productsRes.body.data.length === 0) {
      return; // No seeded products in this environment - nothing to assert
    }
    const product = productsRes.body.data[0];

    const orderRes = await request(app)
      .post('/api/orders')
      .send({
        customerName: 'Test Customer',
        customerPhone: '0780000000',
        items: [{ productId: product.id, quantity: 2 }],
        paymentMethod: 'momo',
      });

    expect(orderRes.statusCode).toBe(201);
    expect(orderRes.body.data.orderNumber).toBeDefined();
    expect(Number(orderRes.body.data.totalAmount)).toBeGreaterThan(0);

    const trackRes = await request(app).get(`/api/orders/track/${orderRes.body.data.orderNumber}`);
    expect(trackRes.statusCode).toBe(200);
    expect(trackRes.body.data.status).toBe('pending');
    expect(trackRes.body.data.items.length).toBe(1);
  });
});
