-- ================================================================
-- TRANSACTION ARCHITECTURE REFACTOR V29 — DATABASE MIGRATION
-- ================================================================

-- 1. ADD is_final COLUMN TO service_items
ALTER TABLE service_items ADD COLUMN IF NOT EXISTS is_final BOOLEAN DEFAULT FALSE;
CREATE INDEX IF NOT EXISTS idx_service_items_final ON service_items(service_order_id, is_final);

-- 2. QC RECALL TABLE
CREATE TABLE IF NOT EXISTS qc_recalls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_order_id UUID REFERENCES service_orders(id) ON DELETE CASCADE,
  qc_id UUID REFERENCES profiles(id),
  reason TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_qc_recalls_order ON qc_recalls(service_order_id);

-- 3. ADD qc_recalled_status TO service_orders (for recall tracking)
ALTER TABLE service_orders ADD COLUMN IF NOT EXISTS qc_recalled BOOLEAN DEFAULT FALSE;
ALTER TABLE service_orders ADD COLUMN IF NOT EXISTS qc_recalled_at TIMESTAMPTZ;
ALTER TABLE service_orders ADD COLUMN IF NOT EXISTS qc_recall_reason TEXT;

-- 4. Teknisi Recall — ADD teknisi_can_recall field
ALTER TABLE service_orders ADD COLUMN IF NOT EXISTS teknisi_can_recall BOOLEAN DEFAULT FALSE;

-- 5. FINAL COST SNAPSHOT on service_orders
ALTER TABLE service_orders ADD COLUMN IF NOT EXISTS final_sparepart_total DECIMAL(15,2) DEFAULT 0;
ALTER TABLE service_orders ADD COLUMN IF NOT EXISTS final_jasa_total DECIMAL(15,2) DEFAULT 0;

-- 6. RLS for qc_recalls
ALTER TABLE qc_recalls ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS public_all_access ON qc_recalls;
CREATE POLICY public_all_access ON qc_recalls FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- 7. NOTIFY reload
NOTIFY pgrst, 'reload schema';