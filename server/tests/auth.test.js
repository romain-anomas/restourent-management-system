/**
 * Basic auth tests.
 * Requires a running MySQL database matching server/.env, with schema
 * imported and `npm run seed` already executed (so the default admin
 * and worker accounts exist).
 *
 * Run with: npm test
 */
const request = require('supertest');
const app = require('../src/app');

const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL || 'admin@restaurant.com';
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD || 'Admin@12345';
const WORKER_EMAIL = 'jean@restaurant.com';
const WORKER_PASSWORD = 'Worker@12345';

describe('Auth API', () => {
  test('rejects login with missing fields', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: ADMIN_EMAIL });
    expect(res.statusCode).toBe(400);
    expect(res.body.success).toBe(false);
  });

  test('rejects login with wrong password', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: ADMIN_EMAIL, password: 'wrongpassword', role: 'admin' });
    expect(res.statusCode).toBe(401);
    expect(res.body.success).toBe(false);
  });

  test('logs in admin successfully and returns a token', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD, role: 'admin' });
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.token).toBeDefined();
    expect(res.body.data.user.role).toBe('admin');
  });

  test('rejects admin credentials submitted through the worker portal', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD, role: 'worker' });
    expect(res.statusCode).toBe(401);
  });

  test('logs in worker successfully', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: WORKER_EMAIL, password: WORKER_PASSWORD, role: 'worker' });
    expect(res.statusCode).toBe(200);
    expect(res.body.data.user.role).toBe('worker');
  });

  test('rejects /api/auth/me without a token', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.statusCode).toBe(401);
  });

  test('accepts /api/auth/me with a valid token', async () => {
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD, role: 'admin' });
    const token = loginRes.body.data.token;

    const meRes = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);
    expect(meRes.statusCode).toBe(200);
    expect(meRes.body.data.email).toBe(ADMIN_EMAIL);
  });
});
