-- ============================================================================
-- Fix lanjutan: service_role kehilangan grant pada tabel-tabel lama
--
-- Gejala sebelumnya: "permission denied for table telegram_config" lalu
-- daftar cabang kosong karena tabel `branches` juga tidak memiliki grant
-- untuk service_role (default privileges sempat diubah di masa lalu).
--
-- Solusi: kembalikan baseline standar Supabase -- service_role (key hanya
-- dipegang server) berhak penuh atas semua tabel di schema public.
-- Tidak ada perubahan eksposur ke client: anon/authenticated tidak tersentuh,
-- dan tabel sensitif (telegram_*) tetap tanpa grant client.
--
-- Rollback: REVOKE ALL ON ALL TABLES IN SCHEMA public FROM service_role;
-- (tidak disarankan -- akan merusak seluruh fitur admin client)
-- ============================================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO service_role;
