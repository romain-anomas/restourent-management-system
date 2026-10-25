-- ============================================================
-- MIGRATION: Add "cash" as a payment method
-- Run this ONCE against your EXISTING database:
--
--   mysql -u root -p restaurant_management < server/database/migrations/003_add_cash_payment_method.sql
--
-- If you're setting up a brand new database instead, you don't need
-- this file - schema.sql already includes it.
-- ============================================================

ALTER TABLE orders
  MODIFY COLUMN payment_method ENUM('momo','airtel_money','cash') DEFAULT NULL;
