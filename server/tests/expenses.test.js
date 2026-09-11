/**
 * Tests for Phase 10: expense management and its effect on profit
 * calculations in the dashboard and reports. Requires the database to be
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

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

describe('Expenses are admin-only', () => {
  test('worker cannot create an expense', async () => {
    const workerToken = await loginAs(WORKER_EMAIL, WORKER_PASSWORD, 'worker');
    const res = await request(app)
      .post('/api/expenses')
      .set('Authorization', `Bearer ${workerToken}`)
      .send({ title: 'Should fail', amount: 1000, expenseDate: todayStr() });
    expect(res.statusCode).toBe(403);
  });

  test('unauthenticated request is rejected', async () => {
    const res = await request(app).get('/api/expenses');
    expect(res.statusCode).toBe(401);
  });
});

describe('Expense CRUD', () => {
  let adminToken;
  let expenseId;

  beforeAll(async () => {
    adminToken = await loginAs(ADMIN_EMAIL, ADMIN_PASSWORD, 'admin');
  });

  test('rejects an expense with no title or non-positive amount', async () => {
    const res = await request(app)
      .post('/api/expenses')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ amount: 0, expenseDate: todayStr() });
    expect(res.statusCode).toBe(400);
  });

  test('admin creates an expense', async () => {
    const res = await request(app)
      .post('/api/expenses')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: 'Test Electricity Bill', category: 'electricity', amount: 15000, expenseDate: todayStr() });
    expect(res.statusCode).toBe(201);
    expenseId = res.body.data.id;
  });

  test('expense appears in the list with correct total', async () => {
    const res = await request(app)
      .get(`/api/expenses?category=electricity`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.statusCode).toBe(200);
    expect(res.body.data.some((e) => e.id === expenseId)).toBe(true);
    expect(res.body.total).toBeGreaterThanOrEqual(15000);
  });

  test('admin updates the expense', async () => {
    const res = await request(app)
      .put(`/api/expenses/${expenseId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ amount: 18000 });
    expect(res.statusCode).toBe(200);
  });

  test('dashboard estimated profit reflects the new expense', async () => {
    const res = await request(app).get('/api/dashboard').set('Authorization', `Bearer ${adminToken}`);
    expect(res.statusCode).toBe(200);
    expect(res.body.data.finance.monthExpenses).toBeGreaterThanOrEqual(18000);
  });

  test("today's daily report reflects the new expense", async () => {
    const res = await request(app)
      .get(`/api/reports/daily?date=${todayStr()}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.statusCode).toBe(200);
    expect(res.body.data.finance.expenses).toBeGreaterThanOrEqual(18000);
  });

  test('admin deletes the expense', async () => {
    const res = await request(app).delete(`/api/expenses/${expenseId}`).set('Authorization', `Bearer ${adminToken}`);
    expect(res.statusCode).toBe(200);

    const listRes = await request(app).get('/api/expenses').set('Authorization', `Bearer ${adminToken}`);
    expect(listRes.body.data.some((e) => e.id === expenseId)).toBe(false);
  });
});
