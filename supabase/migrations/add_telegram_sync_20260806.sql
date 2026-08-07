-- Migrasi: Kolom sinkronisasi Telegram (protokol edit D3)
-- Menyimpan SEMUA message_id album (bukan hanya pertama) agar bisa delete pesan lama penuh,
-- plus status sinkronisasi untuk menangani out-of-sync caption.

BEGIN;

ALTER TABLE public.layanan
  ADD COLUMN IF NOT EXISTS telegram_message_ids JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS telegram_file_ids   JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS telegram_sync       TEXT  DEFAULT 'synced';

ALTER TABLE public.service_documentation
  ADD COLUMN IF NOT EXISTS telegram_message_ids JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS telegram_file_ids   JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS telegram_sync       TEXT  DEFAULT 'synced';

-- Tabel lain yang menyimpan hasil upload (agar protokol edit/hapus pesan lama bekerja)
ALTER TABLE public.service_timeline
  ADD COLUMN IF NOT EXISTS telegram_chat_id      TEXT  DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS telegram_message_id   INT8  DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS telegram_message_ids JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS telegram_file_ids   JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS telegram_sync       TEXT  DEFAULT 'synced';

ALTER TABLE public.attendances
  ADD COLUMN IF NOT EXISTS telegram_message_ids JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS telegram_file_ids   JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS telegram_sync       TEXT  DEFAULT 'synced';

ALTER TABLE public.stock_transfers
  ADD COLUMN IF NOT EXISTS telegram_chat_id      TEXT  DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS telegram_message_id   INT8  DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS telegram_message_ids JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS telegram_file_ids   JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS telegram_sync       TEXT  DEFAULT 'synced';

ALTER TABLE public.inventory
  ADD COLUMN IF NOT EXISTS telegram_chat_id      TEXT  DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS telegram_message_id   INT8  DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS telegram_message_ids JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS telegram_file_ids   JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS telegram_sync       TEXT  DEFAULT 'synced';

-- Backfill: pindahkan telegram_message_id (single) lama ke array agar hapus-lama tetap berfungsi
UPDATE public.layanan
SET telegram_message_ids = to_jsonb(ARRAY[telegram_message_id])
WHERE telegram_message_id IS NOT NULL
  AND (telegram_message_ids IS NULL OR jsonb_array_length(telegram_message_ids) = 0);

COMMIT;