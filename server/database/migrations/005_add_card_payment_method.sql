-- Add card as a recorded payment method. Card processing itself happens
-- in person through the restaurant's terminal; this app does not store card data.
-- Run once against an existing database:
-- mysql -u root -p restaurant_management < server/database/migrations/005_add_card_payment_method.sql

ALTER TABLE orders
  MODIFY COLUMN payment_method ENUM('momo','airtel_money','cash','card') DEFAULT NULL;
