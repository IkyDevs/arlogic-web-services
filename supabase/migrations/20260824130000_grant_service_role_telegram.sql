-- ============================================================================
-- Fix: beri hak akses service_role pada tabel konfigurasi Telegram
--
-- Gejala: "permission denied for table telegram_config" dari API route yang
-- memakai SUPABASE_SERVICE_ROLE_KEY. Penyebab: default privileges schema
-- public tidak lagi otomatis memberi grant ke service_role untuk tabel baru,
-- dan BYPASSRLS hanya melewati policy RLS -- bukan GRANT tingkat tabel.
--
-- Sengaja TIDAK memberi grant ke anon/authenticated: akses UI wajib lewat
-- API route (role-guard), tabel tetap tak terlihat dari client.
--
-- Rollback: REVOKE ALL ON ... FROM service_role;
-- ============================================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON telegram_config TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON telegram_channels TO service_role;

-- Future-proofing: tabel baru yang dibuat oleh migration (via role postgres)
-- otomatis mendapat grant service_role
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO service_role;
