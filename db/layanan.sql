-- Layanan (Service Transactions) Table
-- Tracks all customer service interactions

CREATE TABLE IF NOT EXISTS layanan (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Customer Info
  customer_name TEXT NOT NULL,
  customer_whatsapp TEXT,

  -- Service Details
  service_type TEXT NOT NULL,
  handled_by UUID REFERENCES profiles(id),
  payment_method TEXT,
  lead_source TEXT,
  lead_source_custom TEXT, -- Custom lead source if "write yourself" is selected
  sku_details TEXT,
  nominal_pembayaran NUMERIC DEFAULT 0,

  -- Metadata
  created_by UUID REFERENCES profiles(id)
);

-- Enable RLS
ALTER TABLE layanan ENABLE ROW LEVEL SECURITY;

-- Policy: Admins and owners can view all
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

-- Policy: Authenticated users can insert
CREATE POLICY "Authenticated users can create layanan"
  ON layanan FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Policy: Users can update their own records
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

-- Policy: Admins and owners can delete
CREATE POLICY "Admins and owners can delete layanan"
  ON layanan FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'owner')
    )
  );

-- Trigger to update updated_at
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
