-- ============================================================
-- MIGRATION: Add MTN MoMo automated payment tracking
-- Run this ONCE against your EXISTING database (after migration 001):
--
--   mysql -u root -p restaurant_management < server/database/migrations/002_add_momo_reference.sql
--
-- If you're setting up a brand new database instead, you don't need
-- this file - schema.sql already includes this column.
-- ============================================================

ALTER TABLE orders
  ADD COLUMN momo_reference_id VARCHAR(64) DEFAULT NULL AFTER payment_reference;
