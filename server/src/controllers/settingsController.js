const { pool } = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');
const { logActivity } = require('../services/activityLogService');

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

/** GET /api/settings - admin only. Full settings row for the Settings page. */
const getSettings = asyncHandler(async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM restaurant_settings LIMIT 1');
  res.json({ success: true, data: rows[0] || null });
});

/**
 * PUT /api/settings - admin only.
 * Updates the single restaurant_settings row (creates it if somehow
 * missing). Accepts multipart form data so a new logo can be uploaded
 * alongside the text fields, reusing the same product-image upload rules.
 */
const updateSettings = asyncHandler(async (req, res) => {
  const {
    restaurantName, phone, email, address, description, openingHours,
    currency, taxPercent, invoicePrefix, orderPrefix, allowNegativeStockDefault,
  } = req.body;

  const [existingRows] = await pool.query('SELECT * FROM restaurant_settings LIMIT 1');
  const existing = existingRows[0];

  const logoPath = req.file ? `/uploads/products/${req.file.filename}` : existing?.logo_path || null;

  const values = {
    restaurant_name: restaurantName?.trim() || existing?.restaurant_name || 'Restaurant',
    phone: phone !== undefined ? phone?.trim() || null : existing?.phone,
    email: email !== undefined ? email?.trim() || null : existing?.email,
    address: address !== undefined ? address?.trim() || null : existing?.address,
    description: description !== undefined ? description?.trim() || null : existing?.description,
    opening_hours: openingHours !== undefined ? openingHours?.trim() || null : existing?.opening_hours,
    currency: currency?.trim() || existing?.currency || 'RWF',
    tax_percent: taxPercent !== undefined ? Number(taxPercent) : existing?.tax_percent ?? 0,
    invoice_prefix: invoicePrefix?.trim() || existing?.invoice_prefix || 'INV',
    order_prefix: orderPrefix?.trim() || existing?.order_prefix || 'ORD',
    allow_negative_stock_default:
      allowNegativeStockDefault !== undefined
        ? (allowNegativeStockDefault === 'true' || allowNegativeStockDefault === true ? 1 : 0)
        : existing?.allow_negative_stock_default ?? 0,
  };

  if (existing) {
    await pool.query(
      `UPDATE restaurant_settings SET
        restaurant_name=?, logo_path=?, phone=?, email=?, address=?, description=?, opening_hours=?,
        currency=?, tax_percent=?, invoice_prefix=?, order_prefix=?, allow_negative_stock_default=?
       WHERE id=?`,
      [
        values.restaurant_name, logoPath, values.phone, values.email, values.address, values.description,
        values.opening_hours, values.currency, values.tax_percent, values.invoice_prefix, values.order_prefix,
        values.allow_negative_stock_default, existing.id,
      ]
    );
  } else {
    await pool.query(
      `INSERT INTO restaurant_settings
        (restaurant_name, logo_path, phone, email, address, description, opening_hours,
         currency, tax_percent, invoice_prefix, order_prefix, allow_negative_stock_default)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        values.restaurant_name, logoPath, values.phone, values.email, values.address, values.description,
        values.opening_hours, values.currency, values.tax_percent, values.invoice_prefix, values.order_prefix,
        values.allow_negative_stock_default,
      ]
    );
  }

  await logActivity({
    userId: req.user.id,
    action: 'update_settings',
    description: 'Updated restaurant settings',
  });

  res.json({ success: true, message: 'Settings updated.' });
});

module.exports = { getPublicSettings, getSettings, updateSettings };
