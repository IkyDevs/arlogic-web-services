-- ============================================================================
-- Konfigurasi Telegram via UI (Engineer Dashboard)
--
-- telegram_config  : 1 baris tunggal berisi bot token
-- telegram_channels: chat ID per channel_type (+ optional per-cabang)
--
-- KEAMANAN: RLS diaktifkan TANPA policy sama sekali => anon/authenticated
-- ditolak total. Hanya service_role (SUPABASE_SERVICE_ROLE_KEY, dipakai
-- server-side di API routes) yang bisa baca/tulis. UI tidak pernah menyentuh
-- tabel ini langsung dengan anon key.
--
-- Rollback: DROP TABLE telegram_channels; DROP TABLE telegram_config;
-- ============================================================================

CREATE TABLE IF NOT EXISTS telegram_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_token text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id)
);

-- Paksa maksimal 1 baris konfigurasi
CREATE UNIQUE INDEX IF NOT EXISTS telegram_config_single_row ON telegram_config ((true));

CREATE TABLE IF NOT EXISTS telegram_channels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_type text NOT NULL CHECK (channel_type IN (
    'attendance','service','layanan','inventory','stock_transfer',
    'closing','customer','kaspin','buku_kas','teknisi_update','qc_update','expense'
  )),
  branch_id uuid REFERENCES branches(id) ON DELETE CASCADE,
  chat_id text,
  enabled boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id)
);

-- Satu baris per kombinasi type+cabang (NULL branch = global);
-- Postgres 17: NULLS NOT DISTINCT agar baris global tidak bisa duplikat
CREATE UNIQUE INDEX IF NOT EXISTS telegram_channels_type_branch_uniq
  ON telegram_channels (channel_type, branch_id) NULLS NOT DISTINCT;

ALTER TABLE telegram_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE telegram_channels ENABLE ROW LEVEL SECURITY;
