-- ============================================================================
-- Per-service magic link tracking
-- Menambahkan kolom `access_code` pada service_orders sebagai kode acak
-- per-service untuk URL tracking permanen:
--
--   /track/{invoice_number}/{access_code}
--
-- Additive only: tidak ada data yang diubah/dihapus.
-- Rollback: DROP INDEX idx_service_orders_access_code; ALTER TABLE service_orders DROP COLUMN access_code;
-- ============================================================================

ALTER TABLE service_orders ADD COLUMN IF NOT EXISTS access_code TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_service_orders_access_code ON service_orders(access_code);

-- Backfill semua service existing dengan kode acak 10 karakter (hex uppercase).
-- Sumber entropi: random + id + clock_timestamp agar baris yang dibuat pada
-- detik yang sama tetap menghasilkan kode berbeda.
UPDATE service_orders
SET access_code = UPPER(SUBSTRING(MD5(RANDOM()::TEXT || id::TEXT || CLOCK_TIMESTAMP()::TEXT) FROM 1 FOR 10))
WHERE access_code IS NULL;
