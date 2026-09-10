const { pool } = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');

/**
 * GET /api/settings/public
 * Returns the public-safe subset of restaurant_settings used by the
 * customer website (name, logo, contact info, hours, currency).
 * No auth required - this powers the homepage/footer/contact page.
 */
const getPublicSettings = asyncHandler(async (req, res) => {
  const [rows] = await pool.query(
    `SELECT restaurant_name, logo_path, phone, email, address, description,
            opening_hours, currency, tax_percent
     FROM restaurant_settings LIMIT 1`
  );

  const settings = rows[0] || {
    restaurant_name: 'Restaurant',
    logo_path: null,
    phone: null,
    email: null,
    address: null,
    description: null,
    opening_hours: null,
    currency: 'RWF',
    tax_percent: 0,
  };

  res.json({ success: true, data: settings });
});

module.exports = { getPublicSettings };
