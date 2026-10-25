/**
 * Database seed script.
 * Run AFTER importing schema.sql and AFTER `npm install`:
 *
 *   npm run seed
 *
 * Creates:
 *  - 1 default admin account
 *  - 3 sample worker accounts
 *  - sample categories
 *  - sample products
 *  - default restaurant_settings row
 *
 * Safe to re-run: uses INSERT ... ON DUPLICATE KEY UPDATE / existence checks
 * so it won't create duplicate rows if you run it twice.
 */
require('dotenv').config();
const bcrypt = require('bcryptjs');
const mysql = require('mysql2/promise');

const normalizeDbPassword = () => {
  const password = process.env.DB_PASSWORD;
  if (!password || password === 'your_mysql_password') {
    return '';
  }
  return password;
};

const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL || 'admin@restaurant.com';
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD || 'Admin@12345';
const WORKER_PASSWORD = 'Worker@12345';

async function main() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'root',
    password: normalizeDbPassword(),
    database: process.env.DB_NAME || 'restaurant_management',
    multipleStatements: false,
  });

  console.log('🌱 Seeding database...');

  // ---------- Admin ----------
  const adminHash = await bcrypt.hash(ADMIN_PASSWORD, 10);
  const [existingAdmin] = await conn.query('SELECT id FROM users WHERE email = ?', [ADMIN_EMAIL]);
  if (existingAdmin.length === 0) {
    await conn.query(
      `INSERT INTO users (full_name, email, phone, password_hash, role, status, must_change_password)
       VALUES (?, ?, ?, ?, 'admin', 'active', 1)`,
      ['Restaurant Owner', ADMIN_EMAIL, '0780000000', adminHash]
    );
    console.log(`   ✔ Admin created: ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}`);
  } else {
    await conn.query(
      `UPDATE users
       SET full_name = ?, phone = ?, password_hash = ?, role = 'admin', status = 'active', must_change_password = 1
       WHERE email = ?`,
      ['Restaurant Owner', '0780000000', adminHash, ADMIN_EMAIL]
    );
    console.log(`   • Admin already exists (${ADMIN_EMAIL}), refreshed default credentials.`);
  }

  // ---------- Workers ----------
  const workers = [
    { name: 'Jean Baptiste', email: 'jean@restaurant.com', phone: '0781111111' },
    { name: 'Alice Uwase', email: 'alice@restaurant.com', phone: '0782222222' },
    { name: 'Eric Mugisha', email: 'eric@restaurant.com', phone: '0783333333' },
  ];
  const workerHash = await bcrypt.hash(WORKER_PASSWORD, 10);
  for (const w of workers) {
    const [existing] = await conn.query('SELECT id FROM users WHERE email = ?', [w.email]);
    if (existing.length === 0) {
      await conn.query(
        `INSERT INTO users (full_name, email, phone, password_hash, role, status, must_change_password)
         VALUES (?, ?, ?, ?, 'worker', 'active', 1)`,
        [w.name, w.email, w.phone, workerHash]
      );
      console.log(`   ✔ Worker created: ${w.email} / ${WORKER_PASSWORD}`);
    } else {
      await conn.query(
        `UPDATE users
         SET full_name = ?, phone = ?, password_hash = ?, role = 'worker', status = 'active', must_change_password = 1
         WHERE email = ?`,
        [w.name, w.phone, workerHash, w.email]
      );
      console.log(`   • Worker already exists (${w.email}), refreshed default credentials.`);
    }
  }

  // ---------- Categories ----------
  const categories = [
    { name: 'Breakfast', slug: 'breakfast', description: 'Morning meals' },
    { name: 'Lunch', slug: 'lunch', description: 'Midday meals' },
    { name: 'Dinner', slug: 'dinner', description: 'Evening meals' },
    { name: 'Drinks', slug: 'drinks', description: 'Beverages, hot and cold' },
    { name: 'Desserts', slug: 'desserts', description: 'Sweets and desserts' },
  ];
  const categoryIds = {};
  for (const c of categories) {
    const [existing] = await conn.query('SELECT id FROM categories WHERE slug = ?', [c.slug]);
    if (existing.length === 0) {
      const [result] = await conn.query(
        'INSERT INTO categories (name, slug, description, is_active) VALUES (?, ?, ?, 1)',
        [c.name, c.slug, c.description]
      );
      categoryIds[c.slug] = result.insertId;
      console.log(`   ✔ Category created: ${c.name}`);
    } else {
      categoryIds[c.slug] = existing[0].id;
    }
  }

  // ---------- Products ----------
  const products = [
    { name: 'Grilled Chicken', sku: 'FOOD-001', category: 'lunch', price: 6000, cost: 3500, stock: 40, min: 10, unit: 'plate' },
    { name: 'Beef Brochette', sku: 'FOOD-002', category: 'dinner', price: 4500, cost: 2500, stock: 30, min: 10, unit: 'stick' },
    { name: 'Vegetable Rice', sku: 'FOOD-003', category: 'lunch', price: 3500, cost: 1800, stock: 25, min: 8, unit: 'plate' },
    { name: 'Pancakes', sku: 'FOOD-004', category: 'breakfast', price: 2500, cost: 1200, stock: 20, min: 5, unit: 'plate' },
    { name: 'Fresh Juice', sku: 'DRK-001', category: 'drinks', price: 1500, cost: 600, stock: 50, min: 15, unit: 'glass' },
    { name: 'Soda', sku: 'DRK-002', category: 'drinks', price: 1000, cost: 500, stock: 60, min: 20, unit: 'bottle' },
    { name: 'Chocolate Cake', sku: 'DES-001', category: 'desserts', price: 3000, cost: 1500, stock: 12, min: 5, unit: 'slice' },
  ];
  for (const p of products) {
    const [existing] = await conn.query('SELECT id FROM products WHERE sku = ?', [p.sku]);
    if (existing.length === 0) {
      await conn.query(
        `INSERT INTO products
          (category_id, name, sku, description, selling_price, cost_price, unit, current_stock, minimum_stock, is_active)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
        [categoryIds[p.category], p.name, p.sku, `${p.name} - freshly prepared`, p.price, p.cost, p.unit, p.stock, p.min]
      );
      console.log(`   ✔ Product created: ${p.name}`);
    }
  }

  // ---------- Restaurant settings (single row) ----------
  const [settingsRows] = await conn.query('SELECT id FROM restaurant_settings LIMIT 1');
  if (settingsRows.length === 0) {
    await conn.query(
      `INSERT INTO restaurant_settings
        (restaurant_name, phone, email, address, description, opening_hours, currency, tax_percent, invoice_prefix, order_prefix,
         momo_code, momo_number, momo_name, airtel_money_number)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        'Tasty Bites Restaurant',
        '0780000000',
        ADMIN_EMAIL,
        'KG 123 St, Kigali, Rwanda',
        'A cozy restaurant serving fresh local and international dishes.',
        'Mon-Sun: 7:00 AM - 10:00 PM',
        'RWF',
        0,
        'INV',
        'ORD',
        '937559',
        '0793450646',
        'ISHIMWE Romain',
        '0722312312',
      ]
    );
    console.log('   ✔ Restaurant settings created (with MoMo + Airtel Money payment details)');
  } else {
    await conn.query(
      `UPDATE restaurant_settings
       SET restaurant_name = ?, phone = ?, email = ?, address = ?, description = ?,
           opening_hours = ?, currency = ?, tax_percent = 0, invoice_prefix = ?, order_prefix = ?,
           momo_code = ?, momo_number = ?, momo_name = ?, airtel_money_number = ?
       WHERE id = ?`,
      [
        'Tasty Bites Restaurant',
        '0780000000',
        ADMIN_EMAIL,
        'KG 123 St, Kigali, Rwanda',
        'A cozy restaurant serving fresh local and international dishes.',
        'Mon-Sun: 7:00 AM - 10:00 PM',
        'RWF',
        'INV',
        'ORD',
        '937559',
        '0793450646',
        'ISHIMWE Romain',
        '0722312312',
        settingsRows[0].id,
      ]
    );
    console.log('   • Restaurant settings already existed, reset defaults (tax 0, payment details).');
  }

  console.log('\n✅ Seeding complete.');
  console.log('----------------------------------------');
  console.log(`   Admin login:  ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}`);
  console.log(`   Worker login: jean@restaurant.com / ${WORKER_PASSWORD}`);
  console.log('   ⚠ Change these passwords after first login.');
  console.log('----------------------------------------');

  await conn.end();
}

main().catch((err) => {
  console.error('❌ Seeding failed:', err.message);
  process.exit(1);
});
