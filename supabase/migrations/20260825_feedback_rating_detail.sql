-- ============================================================================
-- Feedback 3 dimensi: kepuasan, layanan, kualitas service
-- Menambahkan kolom `rating_detail` (jsonb) pada tabel feedbacks.
--
-- Struktur nilai: {"kepuasan": 1..5, "layanan": 1..5, "kualitas": 1..5}
--
-- Kompatibilitas:
--   - Kolom lama `rating` (int4) TETAP dipakai sebagai nilai kompatibel =
--     pembulatan rata-rata 3 dimensi untuk baris baru.
--   - Baris lama (sebelum fitur ini) memiliki rating_detail = NULL;
--     consumer wajib fallback ke `rating`.
--   - Rata-rata desimal utk dashboard owner dihitung di aplikasi:
--       avg = round(((k + l + q) / 3) * 10) / 10   -- skala 5, 1 desimal
--
-- Additive only: tidak ada data yang diubah/dihapus.
-- Rollback: ALTER TABLE feedbacks DROP COLUMN IF EXISTS rating_detail;
-- ============================================================================

ALTER TABLE feedbacks ADD COLUMN IF NOT EXISTS rating_detail JSONB;

COMMENT ON COLUMN feedbacks.rating_detail IS
  'Detail rating 3 dimensi (kepuasan, layanan, kualitas), masing-masing 1-5. NULL untuk baris legacy.';
