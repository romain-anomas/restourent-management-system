-- Allows the guest who opened a dine-in table session to add items later.
-- The raw access token stays in the guest's browser; only its SHA-256 hash
-- is stored in the database. New installs already have this column in schema.sql.
ALTER TABLE table_sessions
  ADD COLUMN IF NOT EXISTS guest_access_token_hash CHAR(64) DEFAULT NULL AFTER total_amount;
