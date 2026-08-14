-- Business settings + realtime publication for owner dashboard
-- Run via: supabase db push

CREATE TABLE IF NOT EXISTS business_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID REFERENCES branches(id) ON DELETE CASCADE,
  monthly_revenue_target BIGINT NOT NULL DEFAULT 150000000,
  daily_target BIGINT NOT NULL DEFAULT 5000000,
  sla_days INTEGER NOT NULL DEFAULT 7,
  currency TEXT NOT NULL DEFAULT 'IDR',
  business_start_hour INTEGER NOT NULL DEFAULT 9,
  business_end_hour INTEGER NOT NULL DEFAULT 21,
  dashboard_theme TEXT NOT NULL DEFAULT 'light',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_business_settings_branch ON business_settings(branch_id);

ALTER TABLE business_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Read settings authenticated" ON business_settings;
CREATE POLICY "Read settings authenticated" ON business_settings
  FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Update settings owner admin" ON business_settings;
CREATE POLICY "Update settings owner admin" ON business_settings
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

-- Default row (global, all branches)
INSERT INTO business_settings (monthly_revenue_target, daily_target, sla_days)
SELECT 150000000, 5000000, 7
WHERE NOT EXISTS (SELECT 1 FROM business_settings WHERE branch_id IS NULL);

-- Enable realtime for live activity feed
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE service_orders;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE layanan;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- REPLICA IDENTITY FULL so DELETE events carry the old row payload
ALTER TABLE service_orders REPLICA IDENTITY FULL;
ALTER TABLE layanan REPLICA IDENTITY FULL;