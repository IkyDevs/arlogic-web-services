-- =====================================================
-- MIGRATION: Central Upload Architecture
-- Date: 2026-07-30
-- Purpose: Upload sessions, files, captions, audit logs
-- =====================================================

-- =====================================================
-- ADD upload_status to layanan table
-- =====================================================
ALTER TABLE layanan ADD COLUMN IF NOT EXISTS upload_status TEXT NOT NULL DEFAULT 'NONE'
  CHECK (upload_status IN ('NONE','PENDING','UPLOADING','SUCCESS','FAILED'));

CREATE INDEX IF NOT EXISTS idx_layanan_upload_status ON layanan(upload_status);

-- =====================================================
-- ADD upload_status to service_orders table
-- =====================================================
ALTER TABLE service_orders ADD COLUMN IF NOT EXISTS upload_status TEXT NOT NULL DEFAULT 'NONE'
  CHECK (upload_status IN ('NONE','PENDING','UPLOADING','SUCCESS','FAILED'));

-- =====================================================
-- UPLOAD SESSIONS
-- =====================================================
CREATE TABLE IF NOT EXISTS upload_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_type TEXT NOT NULL,
  transaction_id UUID,
  status TEXT NOT NULL DEFAULT 'WAITING' CHECK (status IN ('WAITING','VALIDATING','QUEUED','UPLOADING','VERIFYING','SUCCESS','FAILED','CANCELLED')),
  created_by UUID REFERENCES profiles(id),
  total_files INTEGER DEFAULT 0,
  completed_files INTEGER DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_upload_sessions_status ON upload_sessions(status);
CREATE INDEX IF NOT EXISTS idx_upload_sessions_transaction ON upload_sessions(transaction_id);
CREATE INDEX IF NOT EXISTS idx_upload_sessions_created ON upload_sessions(created_at);
CREATE INDEX IF NOT EXISTS idx_upload_sessions_created_by ON upload_sessions(created_by);

ALTER TABLE upload_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for authenticated" ON upload_sessions
  FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

GRANT ALL ON TABLE upload_sessions TO authenticated;
GRANT ALL ON TABLE upload_sessions TO service_role;

-- =====================================================
-- UPLOAD FILES
-- =====================================================
CREATE TABLE IF NOT EXISTS upload_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES upload_sessions(id) ON DELETE CASCADE,
  filename TEXT NOT NULL DEFAULT '',
  file_size INTEGER DEFAULT 0,
  mime_type TEXT DEFAULT 'image/jpeg',
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','UPLOADING','SUCCESS','FAILED')),
  supabase_path TEXT,
  telegram_file_id TEXT,
  telegram_file_unique_id TEXT,
  telegram_chat_id TEXT,
  telegram_message_id BIGINT,
  error_message TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_upload_files_session ON upload_files(session_id);
CREATE INDEX IF NOT EXISTS idx_upload_files_status ON upload_files(status);
CREATE INDEX IF NOT EXISTS idx_upload_files_telegram ON upload_files(telegram_file_id);

ALTER TABLE upload_files ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for authenticated" ON upload_files
  FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

GRANT ALL ON TABLE upload_files TO authenticated;
GRANT ALL ON TABLE upload_files TO service_role;

-- =====================================================
-- PHOTO CAPTIONS (separate from Telegram)
-- =====================================================
CREATE TABLE IF NOT EXISTS photo_captions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  upload_file_id UUID REFERENCES upload_files(id) ON DELETE CASCADE,
  transaction_type TEXT NOT NULL,
  transaction_id UUID,
  caption TEXT NOT NULL DEFAULT '',
  created_by UUID REFERENCES profiles(id),
  updated_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_photo_captions_file ON photo_captions(upload_file_id);
CREATE INDEX IF NOT EXISTS idx_photo_captions_transaction ON photo_captions(transaction_id);

ALTER TABLE photo_captions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for authenticated" ON photo_captions
  FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

GRANT ALL ON TABLE photo_captions TO authenticated;
GRANT ALL ON TABLE photo_captions TO service_role;

-- =====================================================
-- UPLOAD AUDIT LOGS
-- =====================================================
CREATE TABLE IF NOT EXISTS upload_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES upload_sessions(id) ON DELETE SET NULL,
  event TEXT NOT NULL,
  status TEXT NOT NULL,
  details JSONB DEFAULT '{}',
  duration_ms INTEGER,
  error_message TEXT,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_upload_audit_logs_session ON upload_audit_logs(session_id);
CREATE INDEX IF NOT EXISTS idx_upload_audit_logs_event ON upload_audit_logs(event);
CREATE INDEX IF NOT EXISTS idx_upload_audit_logs_created ON upload_audit_logs(created_at);

ALTER TABLE upload_audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for authenticated" ON upload_audit_logs
  FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

GRANT ALL ON TABLE upload_audit_logs TO authenticated;
GRANT ALL ON TABLE upload_audit_logs TO service_role;

-- =====================================================
-- TRIGGER: updated_at for upload_sessions
-- =====================================================
CREATE OR REPLACE FUNCTION update_upload_sessions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_upload_sessions_updated_at ON upload_sessions;
CREATE TRIGGER update_upload_sessions_updated_at
  BEFORE UPDATE ON upload_sessions
  FOR EACH ROW EXECUTE FUNCTION update_upload_sessions_updated_at();

-- =====================================================
-- TRIGGER: updated_at for upload_files
-- =====================================================
CREATE OR REPLACE FUNCTION update_upload_files_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_upload_files_updated_at ON upload_files;
CREATE TRIGGER update_upload_files_updated_at
  BEFORE UPDATE ON upload_files
  FOR EACH ROW EXECUTE FUNCTION update_upload_files_updated_at();

NOTIFY pgrst, 'reload schema';
