/**
 * Tests for Phase 11: notifications and activity log endpoints.
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

describe('Notifications', () => {
  let adminToken;
  let workerToken;

  beforeAll(async () => {
    adminToken = await loginAs(ADMIN_EMAIL, ADMIN_PASSWORD, 'admin');
    workerToken = await loginAs(WORKER_EMAIL, WORKER_PASSWORD, 'worker');

    // Placing an order creates a broadcast notification for admin/worker (recipientRole: 'all')
    const productsRes = await request(app).get('/api/products');
    if (productsRes.body.data.length > 0) {
      await request(app)
        .post('/api/orders')
        .send({
          customerName: 'Notification Test Customer',
          customerPhone: '0780000003',
          items: [{ productId: productsRes.body.data[0].id, quantity: 1 }],
          paymentMethod: 'momo',
        });
    }
  });

  test('unauthenticated request is rejected', async () => {
    const res = await request(app).get('/api/notifications');
    expect(res.statusCode).toBe(401);
  });

  test('admin sees notifications with an unread count', async () => {
    const res = await request(app).get('/api/notifications').set('Authorization', `Bearer ${adminToken}`);
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(typeof res.body.unreadCount).toBe('number');
  });

  test('worker also sees the broadcast "new order" notification', async () => {
    const res = await request(app).get('/api/notifications').set('Authorization', `Bearer ${workerToken}`);
    expect(res.statusCode).toBe(200);
    expect(res.body.data.some((n) => n.type === 'new_order')).toBe(true);
  });

  test('mark-all-as-read clears the unread count', async () => {
    const markRes = await request(app)
      .patch('/api/notifications/read-all')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(markRes.statusCode).toBe(200);

    const listRes = await request(app).get('/api/notifications').set('Authorization', `Bearer ${adminToken}`);
    expect(listRes.body.unreadCount).toBe(0);
  });

  test('unreadOnly filter returns nothing after marking all as read', async () => {
    const res = await request(app)
      .get('/api/notifications?unreadOnly=1')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.body.data.length).toBe(0);
  });
});

describe('Activity log', () => {
  let workerToken;

  beforeAll(async () => {
    workerToken = await loginAs(WORKER_EMAIL, WORKER_PASSWORD, 'worker');
  });

  test('worker sees their own activity log, including this login', async () => {
    const res = await request(app).get('/api/activity').set('Authorization', `Bearer ${workerToken}`);
    expect(res.statusCode).toBe(200);
    expect(res.body.data.some((a) => a.action === 'login')).toBe(true);
  });

  test('unauthenticated request is rejected', async () => {
    const res = await request(app).get('/api/activity');
    expect(res.statusCode).toBe(401);
  });
});

describe('Admin settings', () => {
  let adminToken;
  let workerToken;

  beforeAll(async () => {
    adminToken = await loginAs(ADMIN_EMAIL, ADMIN_PASSWORD, 'admin');
    workerToken = await loginAs(WORKER_EMAIL, WORKER_PASSWORD, 'worker');
  });

  test('worker cannot access admin settings', async () => {
    const res = await request(app).get('/api/settings').set('Authorization', `Bearer ${workerToken}`);
    expect(res.statusCode).toBe(403);
  });

  test('admin can read and update settings', async () => {
    const getRes = await request(app).get('/api/settings').set('Authorization', `Bearer ${adminToken}`);
    expect(getRes.statusCode).toBe(200);

    const updateRes = await request(app)
      .put('/api/settings')
      .set('Authorization', `Bearer ${adminToken}`)
      .field('restaurantName', 'Updated Test Restaurant')
      .field('taxPercent', '5');
    expect(updateRes.statusCode).toBe(200);

    const publicRes = await request(app).get('/api/settings/public');
    expect(publicRes.body.data.restaurant_name).toBe('Updated Test Restaurant');
  });
});
