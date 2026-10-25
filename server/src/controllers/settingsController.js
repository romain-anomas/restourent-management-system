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
            opening_hours, currency, tax_percent,
            momo_code, momo_number, momo_name, airtel_money_number
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
    momo_code: null,
    momo_number: null,
    momo_name: null,
    airtel_money_number: null,
  };

  res.json({ success: true, data: { ...settings, card_payments_enabled: Boolean(process.env.FLW_SECRET_KEY) } });
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
    momoCode, momoNumber, momoName, airtelMoneyNumber,
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
    momo_code: momoCode !== undefined ? momoCode?.trim() || null : existing?.momo_code,
    momo_number: momoNumber !== undefined ? momoNumber?.trim() || null : existing?.momo_number,
    momo_name: momoName !== undefined ? momoName?.trim() || null : existing?.momo_name,
    airtel_money_number: airtelMoneyNumber !== undefined ? airtelMoneyNumber?.trim() || null : existing?.airtel_money_number,
  };

  if (existing) {
    await pool.query(
      `UPDATE restaurant_settings SET
        restaurant_name=?, logo_path=?, phone=?, email=?, address=?, description=?, opening_hours=?,
        currency=?, tax_percent=?, invoice_prefix=?, order_prefix=?, allow_negative_stock_default=?,
        momo_code=?, momo_number=?, momo_name=?, airtel_money_number=?
       WHERE id=?`,
      [
        values.restaurant_name, logoPath, values.phone, values.email, values.address, values.description,
        values.opening_hours, values.currency, values.tax_percent, values.invoice_prefix, values.order_prefix,
        values.allow_negative_stock_default, values.momo_code, values.momo_number, values.momo_name,
        values.airtel_money_number, existing.id,
      ]
    );
  } else {
    await pool.query(
      `INSERT INTO restaurant_settings
        (restaurant_name, logo_path, phone, email, address, description, opening_hours,
         currency, tax_percent, invoice_prefix, order_prefix, allow_negative_stock_default,
         momo_code, momo_number, momo_name, airtel_money_number)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        values.restaurant_name, logoPath, values.phone, values.email, values.address, values.description,
        values.opening_hours, values.currency, values.tax_percent, values.invoice_prefix, values.order_prefix,
        values.allow_negative_stock_default, values.momo_code, values.momo_number, values.momo_name,
        values.airtel_money_number,
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
