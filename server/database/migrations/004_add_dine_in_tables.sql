-- ============================================================
-- MIGRATION: Add table seating and dine-in order support
-- Run once on an existing installation after migrations 001-003:
--   mysql -u root -p restaurant_management < server/database/migrations/004_add_dine_in_tables.sql
-- Fresh installs already include these tables and columns in schema.sql.
-- ============================================================

CREATE TABLE IF NOT EXISTS restaurant_tables (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  table_number VARCHAR(40) NOT NULL,
  table_name VARCHAR(100) DEFAULT NULL,
  capacity INT UNSIGNED NOT NULL DEFAULT 2,
  status ENUM('AVAILABLE','OCCUPIED','ORDERING','PAYMENT_PENDING','RESERVED') NOT NULL DEFAULT 'AVAILABLE',
  section VARCHAR(100) DEFAULT NULL,
  position_x INT DEFAULT NULL,
  position_y INT DEFAULT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_tables_number (table_number),
  KEY idx_tables_status (status),
  KEY idx_tables_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS table_sessions (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  table_id INT UNSIGNED NOT NULL,
  session_number VARCHAR(40) NOT NULL,
  status ENUM('ACTIVE','PAYMENT_PENDING','CLOSED') NOT NULL DEFAULT 'ACTIVE',
  opened_by INT UNSIGNED DEFAULT NULL,
  closed_by INT UNSIGNED DEFAULT NULL,
  total_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  opened_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  closed_at DATETIME DEFAULT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_sessions_number (session_number),
  KEY idx_sessions_table (table_id),
  KEY idx_sessions_status (status),
  CONSTRAINT fk_table_sessions_table FOREIGN KEY (table_id) REFERENCES restaurant_tables(id) ON DELETE CASCADE,
  CONSTRAINT fk_table_sessions_opened_by FOREIGN KEY (opened_by) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT fk_table_sessions_closed_by FOREIGN KEY (closed_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

ALTER TABLE orders
  ADD COLUMN order_type ENUM('DINE_IN','TAKEAWAY','ONLINE') NOT NULL DEFAULT 'ONLINE' AFTER notes,
  ADD COLUMN table_id INT UNSIGNED DEFAULT NULL AFTER order_type,
  ADD COLUMN table_session_id INT UNSIGNED DEFAULT NULL AFTER table_id,
  ADD KEY idx_orders_order_type (order_type),
  ADD KEY idx_orders_table_session (table_session_id),
  ADD KEY idx_orders_table (table_id),
  ADD CONSTRAINT fk_orders_table FOREIGN KEY (table_id) REFERENCES restaurant_tables(id) ON DELETE SET NULL,
  ADD CONSTRAINT fk_orders_table_session FOREIGN KEY (table_session_id) REFERENCES table_sessions(id) ON DELETE SET NULL;
