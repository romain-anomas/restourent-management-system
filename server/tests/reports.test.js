/**
 * Tests for Phase 9 report endpoints. Requires the database to be
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

describe('Reports are admin-only', () => {
  test('worker cannot access daily report', async () => {
    const workerToken = await loginAs(WORKER_EMAIL, WORKER_PASSWORD, 'worker');
    const res = await request(app).get('/api/reports/daily').set('Authorization', `Bearer ${workerToken}`);
    expect(res.statusCode).toBe(403);
  });

  test('unauthenticated request is rejected', async () => {
    const res = await request(app).get('/api/reports/monthly');
    expect(res.statusCode).toBe(401);
  });
});

describe('Report generation returns the expected shape', () => {
  let adminToken;

  beforeAll(async () => {
    adminToken = await loginAs(ADMIN_EMAIL, ADMIN_PASSWORD, 'admin');
  });

  test('daily report defaults to today and has the right shape', async () => {
    const res = await request(app).get('/api/reports/daily').set('Authorization', `Bearer ${adminToken}`);
    expect(res.statusCode).toBe(200);
    expect(res.body.data.period.from).toBe(res.body.data.period.to);
    expect(res.body.data.orders).toHaveProperty('total');
    expect(res.body.data.finance).toHaveProperty('estimatedProfit');
    expect(Array.isArray(res.body.data.productsSold)).toBe(true);
    expect(Array.isArray(res.body.data.workerActivity)).toBe(true);
  });

  test('weekly report spans Monday to Sunday', async () => {
    const res = await request(app)
      .get('/api/reports/weekly?date=2026-01-15')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.statusCode).toBe(200);
    // Jan 15 2026 is a Thursday - week should be Jan 12 (Mon) to Jan 18 (Sun)
    expect(res.body.data.period.from).toBe('2026-01-12');
    expect(res.body.data.period.to).toBe('2026-01-18');
  });

  test('monthly report spans the full calendar month', async () => {
    const res = await request(app)
      .get('/api/reports/monthly?year=2026&month=2')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.statusCode).toBe(200);
    expect(res.body.data.period.from).toBe('2026-02-01');
    expect(res.body.data.period.to).toBe('2026-02-28');
  });

  test('custom report requires both from and to', async () => {
    const res = await request(app)
      .get('/api/reports/custom?from=2026-01-01')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.statusCode).toBe(400);
  });

  test('custom report rejects from after to', async () => {
    const res = await request(app)
      .get('/api/reports/custom?from=2026-02-01&to=2026-01-01')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.statusCode).toBe(400);
  });

  test('custom report works with a valid range', async () => {
    const res = await request(app)
      .get('/api/reports/custom?from=2026-01-01&to=2026-01-31')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.statusCode).toBe(200);
    expect(res.body.data.period).toEqual({ from: '2026-01-01', to: '2026-01-31' });
  });

  test('CSV export returns CSV content', async () => {
    const res = await request(app)
      .get('/api/reports/daily?format=csv')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('text/csv');
    expect(res.text).toContain('Report Period');
  });
});
