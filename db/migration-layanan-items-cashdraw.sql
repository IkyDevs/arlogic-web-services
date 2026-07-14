-- Migration: add layanan_items table + cashdraw

CREATE TABLE IF NOT EXISTS layanan_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  layanan_id UUID REFERENCES layanan(id) ON DELETE CASCADE,
  jenis_layanan TEXT NOT NULL,
  detail_sku TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  nominal DECIMAL(15,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_layanan_items_layanan_id ON layanan_items(layanan_id);

-- RLS
ALTER TABLE layanan_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for authenticated" ON layanan_items
  FOR ALL USING (true) WITH CHECK (true);

NOTIFY pgrst, 'reload schema';
