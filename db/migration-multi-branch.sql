-- =====================================================
-- MIGRATION: MULTI-BRANCH — Phase 1 (Additive)
-- Jalankan di Supabase SQL Editor.
-- CATATAN: RLS branch TIDAK diaktifkan di sini.
--         RLS branch menyusul di Phase 5 (setelah kode siap).
--
-- ROLE FINAL: admin, teknisi, supervisor, owner, qc
--   + flag: is_engineer, is_stock_approver, home_branch_id
-- =====================================================

-- ─────────────────────────────────────────────────────
-- 0) BRANCHES: pastikan tabel ada + data cabang awal
--    (idempotent — aman dijalankan ulang)
-- ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS branches (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT UNIQUE NOT NULL,
  address TEXT,
  phone TEXT,
  email TEXT,
  logo_url TEXT,
  is_active BOOLEAN DEFAULT true,
  is_central BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO branches (name, code, is_central) VALUES
  ('Jember', 'JBR', true),
  ('Kudus',  'KDS', false)
ON CONFLICT (code) DO NOTHING;

ALTER TABLE branches ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  DROP POLICY IF EXISTS public_all_access ON branches;
  CREATE POLICY public_all_access ON branches
    FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
GRANT ALL ON TABLE branches TO authenticated;

-- ─────────────────────────────────────────────────────
-- 1) PROFILES: role (qc) + kolom bonus & rolling & approver
-- ─────────────────────────────────────────────────────
ALTER TABLE branches ADD COLUMN IF NOT EXISTS is_central BOOLEAN DEFAULT false;
UPDATE branches SET is_central = true WHERE code = 'JBR';

DO $$
BEGIN
  ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
  ALTER TABLE profiles ADD CONSTRAINT profiles_role_check
    CHECK (role IN ('admin','teknisi','supervisor','owner','qc'));
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS home_branch_id UUID REFERENCES branches(id);
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_stock_approver BOOLEAN DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_engineer BOOLEAN DEFAULT false;

-- Backfill home_branch_id = branch_id (cabang asal = cabang saat ini utk existing)
UPDATE profiles SET home_branch_id = branch_id
WHERE home_branch_id IS NULL AND branch_id IS NOT NULL;

-- ─────────────────────────────────────────────────────
-- 2) INVENTORY: buy_price (harga beli/dasar)
-- ─────────────────────────────────────────────────────
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS buy_price NUMERIC(12,2);

-- ─────────────────────────────────────────────────────
-- 3) INVENTORY_STOCKS: stok per lokasi (gudang / toko per cabang)
-- ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS inventory_stocks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  inventory_id UUID REFERENCES inventory(id) ON DELETE CASCADE,
  location_type TEXT NOT NULL CHECK (location_type IN ('gudang','toko')),
  branch_id UUID REFERENCES branches(id),
  quantity INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────
-- 4) STOCK_TRANSFERS: tambah status konfirmasi (approver)
-- ─────────────────────────────────────────────────────
ALTER TABLE stock_transfers ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending'
  CHECK (status IN ('pending','confirmed','rejected'));
ALTER TABLE stock_transfers ADD COLUMN IF NOT EXISTS confirmed_by UUID REFERENCES profiles(id);
ALTER TABLE stock_transfers ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMPTZ;

-- ─────────────────────────────────────────────────────
-- 5) REPORTS: fitur Lapor (bug / request fitur)
-- ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS reports (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  report_type TEXT NOT NULL CHECK (report_type IN ('bug','feature','other')),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  module TEXT,
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low','medium','high')),
  attachment_url TEXT,
  branch_id UUID REFERENCES branches(id),
  created_by UUID REFERENCES profiles(id),
  status TEXT DEFAULT 'new' CHECK (status IN ('new','in_progress','done','rejected')),
  status_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────
-- 6) ANNOUNCEMENTS: pengumuman oleh engineer
-- ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS announcements (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  target_branch_id UUID REFERENCES branches(id),
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────
-- 7) BRANCH_ASSIGNMENTS: riwayat rolling teknisi
-- ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS branch_assignments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES branches(id),
  start_date TIMESTAMPTZ DEFAULT NOW(),
  end_date TIMESTAMPTZ,
  reason TEXT,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────
-- 8) RLS: PERMISIF dulu (branch RLS di Phase 5)
-- ─────────────────────────────────────────────────────
ALTER TABLE inventory_stocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE branch_assignments ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['inventory_stocks','reports','announcements','branch_assignments']
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS public_all_access ON %I', t);
    EXECUTE format('CREATE POLICY public_all_access ON %I FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL)', t);
  END LOOP;
END $$;

GRANT ALL ON TABLE inventory_stocks TO authenticated;
GRANT ALL ON TABLE reports TO authenticated;
GRANT ALL ON TABLE announcements TO authenticated;
GRANT ALL ON TABLE branch_assignments TO authenticated;

-- ─────────────────────────────────────────────────────
-- 9) Index pendukung
-- ─────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_profiles_home_branch ON profiles(home_branch_id);
CREATE INDEX IF NOT EXISTS idx_inventory_stocks_item ON inventory_stocks(inventory_id);
CREATE INDEX IF NOT EXISTS idx_inventory_stocks_location ON inventory_stocks(location_type, branch_id);
CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status);
CREATE INDEX IF NOT EXISTS idx_reports_branch ON reports(branch_id);
CREATE INDEX IF NOT EXISTS idx_announcements_created ON announcements(created_at);
CREATE INDEX IF NOT EXISTS idx_branch_assignments_profile ON branch_assignments(profile_id);
CREATE INDEX IF NOT EXISTS idx_stock_transfers_status ON stock_transfers(status);

-- ─────────────────────────────────────────────────────
-- 10) BRANCH_ID di tabel yang belum punya
--     (closings, notifications, activity_logs, customers, attendances)
-- ─────────────────────────────────────────────────────
ALTER TABLE closings ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES branches(id);
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES branches(id);
ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES branches(id);
ALTER TABLE customers ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES branches(id);
ALTER TABLE attendances ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES branches(id);

CREATE INDEX IF NOT EXISTS idx_closings_branch ON closings(branch_id);
CREATE INDEX IF NOT EXISTS idx_notifications_branch ON notifications(branch_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_branch ON activity_logs(branch_id);
CREATE INDEX IF NOT EXISTS idx_customers_branch ON customers(branch_id);
CREATE INDEX IF NOT EXISTS idx_attendances_branch ON attendances(branch_id);

-- Backfill data existing ke cabang pusat (JBR)
UPDATE closings SET branch_id = (SELECT id FROM branches WHERE code = 'JBR') WHERE branch_id IS NULL;
UPDATE notifications SET branch_id = (SELECT id FROM branches WHERE code = 'JBR') WHERE branch_id IS NULL;
UPDATE activity_logs SET branch_id = (SELECT id FROM branches WHERE code = 'JBR') WHERE branch_id IS NULL;
UPDATE customers SET branch_id = (SELECT id FROM branches WHERE code = 'JBR') WHERE branch_id IS NULL;
UPDATE attendances SET branch_id = (SELECT id FROM branches WHERE code = 'JBR') WHERE branch_id IS NULL;

-- ─────────────────────────────────────────────────────
-- 11) FEEDBACK: branch_id (dari service_order terkait)
-- ─────────────────────────────────────────────────────
ALTER TABLE feedbacks ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES branches(id);
UPDATE feedbacks SET branch_id = (SELECT branch_id FROM service_orders WHERE id = feedbacks.service_order_id)
WHERE branch_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_feedbacks_branch ON feedbacks(branch_id);

-- ─────────────────────────────────────────────────────
-- 12) STOCK: 2 tabel terpisah (gudang & toko per cabang)
-- ─────────────────────────────────────────────────────

-- Stock GUDANG (pusat, tanpa cabang)
CREATE TABLE IF NOT EXISTS stock_gudang (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  inventory_id UUID UNIQUE REFERENCES inventory(id) ON DELETE CASCADE,
  quantity INTEGER DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Stock TOKO (per cabang — 1 tabel, dipisah branch_id)
CREATE TABLE IF NOT EXISTS stock_toko (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  inventory_id UUID REFERENCES inventory(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES branches(id),
  quantity INTEGER DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(inventory_id, branch_id)
);

-- Seed dari data lama (warehouse_stock → gudang, store_stock → toko JBR)
INSERT INTO stock_gudang (inventory_id, quantity)
SELECT id, COALESCE(warehouse_stock, 0) FROM inventory
ON CONFLICT (inventory_id) DO UPDATE SET quantity = EXCLUDED.quantity;

INSERT INTO stock_toko (inventory_id, branch_id, quantity)
SELECT i.id, b.id, COALESCE(i.store_stock, 0)
FROM inventory i CROSS JOIN branches b WHERE b.code = 'JBR'
ON CONFLICT (inventory_id, branch_id) DO UPDATE SET quantity = EXCLUDED.quantity;

-- RLS permisif
ALTER TABLE stock_gudang ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_toko ENABLE ROW LEVEL SECURITY;
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['stock_gudang','stock_toko']
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS public_all_access ON %I', t);
    EXECUTE format('CREATE POLICY public_all_access ON %I FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL)', t);
  END LOOP;
END $$;
GRANT ALL ON TABLE stock_gudang TO authenticated;
GRANT ALL ON TABLE stock_toko TO authenticated;

CREATE INDEX IF NOT EXISTS idx_stock_gudang_inventory ON stock_gudang(inventory_id);
CREATE INDEX IF NOT EXISTS idx_stock_toko_branch ON stock_toko(branch_id);

-- ─────────────────────────────────────────────────────
-- 13) SERVICE_ITEMS & SPAREPART_REQUESTS: inventory_id
--     (sparepart yang dipilih dari stock/inventory)
-- ─────────────────────────────────────────────────────
ALTER TABLE service_items ADD COLUMN IF NOT EXISTS inventory_id UUID REFERENCES inventory(id) ON DELETE SET NULL;
ALTER TABLE sparepart_requests ADD COLUMN IF NOT EXISTS inventory_id UUID REFERENCES inventory(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_service_items_inventory ON service_items(inventory_id);
CREATE INDEX IF NOT EXISTS idx_sparepart_requests_inventory ON sparepart_requests(inventory_id);

NOTIFY pgrst, 'reload schema';

