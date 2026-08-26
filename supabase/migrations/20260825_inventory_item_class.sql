-- ============================================================================
-- Inventory V1: klasifikasi item (Stock Sparepart vs Stock Jam)
--
-- item_class:
--   'sparepart' -> digunakan service/teknisi (stock_toko per cabang)
--   'jam'       -> digunakan transaksi beli_jam (stock_toko per cabang)
--
-- Additive only. Default existing items = 'sparepart'.
-- Rollback: ALTER TABLE inventory DROP COLUMN IF EXISTS item_class;
-- ============================================================================

ALTER TABLE inventory ADD COLUMN IF NOT EXISTS item_class TEXT NOT NULL DEFAULT 'sparepart';
