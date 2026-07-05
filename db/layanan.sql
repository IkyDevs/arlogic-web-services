-- =====================================================
-- ARLOGIC WEB SERVICES - LAYANAN TABLE
-- Complete schema aligned with frontend usage
-- =====================================================

-- 1. CREATE TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS layanan (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Customer Info
  customer_name TEXT NOT NULL,
  customer_whatsapp TEXT,

  -- Service Details (frontend column names)
  jenis_layanan TEXT,
  handled_by UUID REFERENCES profiles(id),
  handled_by_name TEXT,
  metode_pembayaran TEXT,
  lead_source TEXT,
  lead_source_custom TEXT,
  detail_sku TEXT,
  nominal NUMERIC DEFAULT 0,
  notes TEXT,
  photo_url TEXT,

  -- Metadata
  created_by UUID REFERENCES profiles(id),
  created_by_name TEXT,
  status TEXT DEFAULT 'active'
);

-- 2. BACKWARD COMPAT / MIGRATION
-- =====================================================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'layanan' AND column_name = 'create_by'
  ) THEN
    ALTER TABLE layanan RENAME COLUMN create_by TO created_by;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'layanan' AND column_name = 'service_type'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'layanan' AND column_name = 'jenis_layanan'
  ) THEN
    ALTER TABLE layanan RENAME COLUMN service_type TO jenis_layanan;
  ELSIF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'layanan' AND column_name = 'service_type'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'layanan' AND column_name = 'jenis_layanan'
  ) THEN
    ALTER TABLE layanan DROP COLUMN service_type;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'layanan' AND column_name = 'payment_method'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'layanan' AND column_name = 'metode_pembayaran'
  ) THEN
    ALTER TABLE layanan RENAME COLUMN payment_method TO metode_pembayaran;
  ELSIF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'layanan' AND column_name = 'payment_method'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'layanan' AND column_name = 'metode_pembayaran'
  ) THEN
    ALTER TABLE layanan DROP COLUMN payment_method;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'layanan' AND column_name = 'sku_details'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'layanan' AND column_name = 'detail_sku'
  ) THEN
    ALTER TABLE layanan RENAME COLUMN sku_details TO detail_sku;
  ELSIF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'layanan' AND column_name = 'sku_details'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'layanan' AND column_name = 'detail_sku'
  ) THEN
    ALTER TABLE layanan DROP COLUMN sku_details;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'layanan' AND column_name = 'nominal_pembayaran'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'layanan' AND column_name = 'nominal'
  ) THEN
    ALTER TABLE layanan RENAME COLUMN nominal_pembayaran TO nominal;
  ELSIF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'layanan' AND column_name = 'nominal_pembayaran'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'layanan' AND column_name = 'nominal'
  ) THEN
    ALTER TABLE layanan DROP COLUMN nominal_pembayaran;
  END IF;
END $$;

-- 3. ROW LEVEL SECURITY
-- =====================================================
ALTER TABLE layanan ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins and owners can view all layanan" ON layanan;
CREATE POLICY "Admins and owners can view all layanan"
  ON layanan FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'owner')
    )
    OR created_by = auth.uid()
    OR handled_by = auth.uid()
  );

DROP POLICY IF EXISTS "Authenticated users can create layanan" ON layanan;
CREATE POLICY "Authenticated users can create layanan"
  ON layanan FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Users can update layanan" ON layanan;
CREATE POLICY "Users can update layanan"
  ON layanan FOR UPDATE
  USING (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'owner')
    )
  );

DROP POLICY IF EXISTS "Admins and owners can delete layanan" ON layanan;
CREATE POLICY "Admins and owners can delete layanan"
  ON layanan FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'owner')
    )
  );

-- 4. TRIGGERS
-- =====================================================
CREATE OR REPLACE FUNCTION update_layanan_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_layanan_updated_at ON layanan;
CREATE TRIGGER update_layanan_updated_at
  BEFORE UPDATE ON layanan
  FOR EACH ROW
  EXECUTE FUNCTION update_layanan_updated_at();

-- 5. RELOAD SCHEMA CACHE
-- =====================================================
NOTIFY pgrst, 'reload schema';
