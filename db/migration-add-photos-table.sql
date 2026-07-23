-- =====================================================
-- MIGRATION: Photos table for Telegram file_id tracking
-- Date: 2026-07-23
-- Purpose: Store file_id, file_unique_id for keep-alive
--          This enables long-term Telegram storage
-- =====================================================

CREATE TABLE IF NOT EXISTS photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Telegram data
  file_id TEXT NOT NULL,
  file_unique_id TEXT NOT NULL,
  file_size INTEGER DEFAULT 0,

  -- Photo data (base64 encoded JPEG for keep-alive re-upload)
  photo_data TEXT,

  -- Metadata
  filename TEXT NOT NULL DEFAULT '',
  mime_type TEXT NOT NULL DEFAULT 'image/jpeg',

  -- Relasi ke service order (opsional, foto bisa independent)
  service_order_id UUID REFERENCES service_orders(id) ON DELETE SET NULL,
  service_documentation_id UUID REFERENCES service_documentation(id) ON DELETE SET NULL,
  stage TEXT, -- initial_condition, progress, qc

  -- Uploader
  uploaded_by UUID REFERENCES profiles(id),

  -- Keep-alive tracking
  created_at TIMESTAMPTZ DEFAULT NOW(),
  refreshed_at TIMESTAMPTZ DEFAULT NOW(),
  refresh_count INTEGER DEFAULT 0,

  -- Last successful getFile check
  last_verified_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_photos_file_id ON photos(file_id);
CREATE INDEX IF NOT EXISTS idx_photos_file_unique_id ON photos(file_unique_id);
CREATE INDEX IF NOT EXISTS idx_photos_service_order ON photos(service_order_id);
CREATE INDEX IF NOT EXISTS idx_photos_created_at ON photos(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_photos_refreshed_at ON photos(refreshed_at);

-- RLS
ALTER TABLE photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for authenticated" ON photos
  FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

GRANT ALL ON TABLE photos TO authenticated;
GRANT ALL ON TABLE photos TO service_role;

NOTIFY pgrst, 'reload schema';
