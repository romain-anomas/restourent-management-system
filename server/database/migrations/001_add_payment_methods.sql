-- ============================================================
-- MIGRATION: Add Mobile Money payment methods
-- Run this ONCE against your EXISTING database to add payment method
-- support without losing any data:
--
--   mysql -u root -p restaurant_management < server/database/migrations/001_add_payment_methods.sql
--
-- If you're setting up a brand new database instead, you don't need
-- this file - schema.sql already includes these columns.
--
-- NOTE: this uses plain ADD COLUMN (not "IF NOT EXISTS") for broad
-- MySQL 8.x compatibility. If you run it twice you'll get a harmless
-- "Duplicate column name" error on the second run - that's fine, it
-- just means the migration already applied.
-- ============================================================

ALTER TABLE restaurant_settings
  ADD COLUMN momo_code VARCHAR(30) DEFAULT NULL AFTER allow_negative_stock_default,
  ADD COLUMN momo_number VARCHAR(30) DEFAULT NULL AFTER momo_code,
  ADD COLUMN momo_name VARCHAR(100) DEFAULT NULL AFTER momo_number,
  ADD COLUMN airtel_money_number VARCHAR(30) DEFAULT NULL AFTER momo_name;

ALTER TABLE orders
  ADD COLUMN payment_method ENUM('momo','airtel_money') DEFAULT NULL AFTER payment_status,
  ADD COLUMN payment_reference VARCHAR(100) DEFAULT NULL AFTER payment_method;

-- Populate the payment details you provided, on whatever settings row already exists.
UPDATE restaurant_settings
SET
  momo_code = '937559',
  momo_number = '0793450646',
  momo_name = 'ISHIMWE Romain',
  airtel_money_number = '0722312312'
LIMIT 1;
