const mysql = require('mysql2/promise');
require('dotenv').config();

const normalizeDbPassword = () => {
  const password = process.env.DB_PASSWORD;
  if (!password || password === 'your_mysql_password') {
    return '';
  }
  return password;
};

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'root',
  password: normalizeDbPassword(),
  database: process.env.DB_NAME || 'restaurant_management',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  dateStrings: true,
});

/**
 * Quick connectivity check used at server startup.
 */
async function testConnection() {
  const conn = await pool.getConnection();
  try {
    await conn.query('SELECT 1');
    console.log('✅ MySQL connected:', process.env.DB_NAME);
  } finally {
    conn.release();
  }
}

/**
 * Run a callback inside a MySQL transaction.
 * Automatically commits on success and rolls back on error.
 * Usage: await withTransaction(async (conn) => { ...queries using conn... });
 */
async function withTransaction(callback) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const result = await callback(conn);
    await conn.commit();
    return result;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

module.exports = { pool, testConnection, withTransaction };
