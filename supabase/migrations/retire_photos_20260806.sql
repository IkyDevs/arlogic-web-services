-- Migrasi: Pensiunkan tabel photos (penyimpanan foto base64)
-- Keputusan D7: Telegram = source of truth storage; DB tidak boleh menyimpan foto/blob.
-- Pendekatan: backup dulu ke tabel arsip, tabel asli TIDAK dihapus (jalan lama yang membaca tetap berfungsi).

BEGIN;

-- 1) Backup data existing ke tabel arsip (aman, bisa dipulihkan)
CREATE TABLE IF NOT EXISTS public.photos_backup_20260806 AS
SELECT * FROM public.photos;

-- 2. Tandai tabel sebagai retired (tidak ada penulis baru dari aplikasi)
COMMENT ON TABLE public.photos IS 'RETIRED 2026-08-06 (D7): penyimpanan foto base64 dipensiunkan. Telegram adalah source of truth storage; DB hanya metadata + referensi. Backup ada di photos_backup_20260806.';

COMMIT;