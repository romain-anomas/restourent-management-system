-- Supports secure hosted card checkout for delivery/takeaway orders.
-- Run once against an existing database after migration 005:
-- mysql -u root -p restaurant_management < server/database/migrations/006_add_online_card_checkout.sql

ALTER TABLE orders
  ADD COLUMN customer_email VARCHAR(255) DEFAULT NULL AFTER customer_phone;

CREATE TABLE IF NOT EXISTS payment_transactions (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  order_id INT UNSIGNED NOT NULL,
  provider VARCHAR(30) NOT NULL,
  tx_ref VARCHAR(100) NOT NULL,
  gateway_transaction_id VARCHAR(100) DEFAULT NULL,
  status ENUM('pending','successful','failed') NOT NULL DEFAULT 'pending',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_payment_transactions_tx_ref (tx_ref),
  KEY idx_payment_transactions_order (order_id),
  CONSTRAINT fk_payment_transactions_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
