-- =====================================================
-- ARLOGIC WEB SERVICES - SUPABASE SCHEMA
-- Import this file in Supabase SQL Editor
-- =====================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =====================================================
-- PROFILES
-- =====================================================
CREATE TABLE IF NOT EXISTS profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'teknisi' CHECK (role IN ('admin','teknisi','supervisor','owner')),
  teknisi_name TEXT,
  phone TEXT,
  gender TEXT CHECK (gender IN ('male','female','other')) DEFAULT 'other',
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- SERVICE ORDERS
-- =====================================================
CREATE TABLE IF NOT EXISTS service_orders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  invoice_number TEXT UNIQUE NOT NULL,
  token TEXT UNIQUE NOT NULL,
  token_expires_at TIMESTAMPTZ,
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  serial_number TEXT,
  device_type TEXT DEFAULT 'smartwatch',
  device_brand TEXT,
  device_model TEXT,
  watch_brand TEXT,
  watch_model TEXT,
  watch_year INTEGER,
  watch_movement TEXT CHECK (watch_movement IN ('automatic','quartz','mechanical','smartwatch','analog_digital','other')),
  watch_condition TEXT CHECK (watch_condition IN ('new','excellent','good','fair','poor')),
  watch_accessories TEXT[],
  watch_serial_number TEXT,
  category TEXT,
  down_payment DECIMAL(10,2) DEFAULT 0,
  payment_method TEXT DEFAULT 'cash',
  payment_proof_url TEXT,
  issue_description TEXT NOT NULL,
  request TEXT,
  notes TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','assigned','in_progress','req_sparepart_admin','po_pending','sparepart_ready','qc_pending','revision_required','completed','done','cancelled')),
  assigned_teknisi_id UUID REFERENCES profiles(id),
  po_status TEXT,
  po_sparepart TEXT,
  po_requested_at TIMESTAMPTZ,
  po_admin_response TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  start_date TIMESTAMPTZ,
  done_date TIMESTAMPTZ,
  work_duration TEXT,
  estimated_cost DECIMAL(10,2),
  final_cost DECIMAL(10,2),
  completion_notes TEXT,
  warranty_months INTEGER DEFAULT 3,
  warranty_expiry TIMESTAMPTZ
);

-- =====================================================
-- SERVICE ITEMS
-- =====================================================
CREATE TABLE IF NOT EXISTS service_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  service_order_id UUID REFERENCES service_orders(id) ON DELETE CASCADE,
  item_type TEXT CHECK (item_type IN ('jasa','sparepart')),
  name TEXT NOT NULL,
  quantity INTEGER DEFAULT 1,
  price DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- SERVICE DOCUMENTATION
-- =====================================================
CREATE TABLE IF NOT EXISTS service_documentation (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  service_order_id UUID REFERENCES service_orders(id) ON DELETE CASCADE,
  photo_url TEXT NOT NULL,
  stage TEXT NOT NULL,
  uploaded_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- SERVICE TIMELINE
-- =====================================================
CREATE TABLE IF NOT EXISTS service_timeline (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  service_order_id UUID REFERENCES service_orders(id) ON DELETE CASCADE,
  teknisi_id UUID REFERENCES profiles(id),
  status TEXT NOT NULL,
  message TEXT NOT NULL,
  photo_url TEXT,
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- ATTENDANCES
-- =====================================================
CREATE TABLE IF NOT EXISTS attendances (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  teknisi_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  photo_url TEXT NOT NULL,
  location TEXT,
  check_in TIMESTAMPTZ DEFAULT NOW(),
  check_out TIMESTAMPTZ,
  status TEXT DEFAULT 'checked_in' CHECK (status IN ('checked_in','checked_out')),
  work_duration TEXT,
  total_minutes INTEGER,
  overtime_minutes INTEGER DEFAULT 0,
  is_overtime BOOLEAN DEFAULT FALSE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'attendances' AND column_name = 'overtime_minutes'
  ) THEN
    ALTER TABLE attendances ADD COLUMN overtime_minutes INTEGER DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'attendances' AND column_name = 'is_overtime'
  ) THEN
    ALTER TABLE attendances ADD COLUMN is_overtime BOOLEAN DEFAULT FALSE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'attendances' AND column_name = 'notes'
  ) THEN
    ALTER TABLE attendances ADD COLUMN notes TEXT;
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';

-- =====================================================
-- INVENTORY
-- =====================================================
CREATE TABLE IF NOT EXISTS inventory (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  item_name TEXT NOT NULL,
  sku TEXT UNIQUE NOT NULL,
  store_stock INTEGER DEFAULT 0,
  warehouse_stock INTEGER DEFAULT 0,
  unit TEXT NOT NULL,
  min_stock INTEGER DEFAULT 0,
  category TEXT,
  price DECIMAL(10,2),
  photo_url TEXT,
  compatible_brands TEXT[],
  compatible_models TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- STOCK TRANSFERS
-- =====================================================
CREATE TABLE IF NOT EXISTS stock_transfers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  inventory_id UUID REFERENCES inventory(id) ON DELETE CASCADE,
  from_location TEXT NOT NULL CHECK (from_location IN ('warehouse','store')),
  to_location TEXT NOT NULL CHECK (to_location IN ('warehouse','store')),
  quantity INTEGER NOT NULL,
  notes TEXT,
  photo_url TEXT,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- CATEGORIES
-- =====================================================
CREATE TABLE IF NOT EXISTS categories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- QC REVIEWS
-- =====================================================
CREATE TABLE IF NOT EXISTS qc_reviews (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  service_order_id UUID REFERENCES service_orders(id) ON DELETE CASCADE,
  reviewer_id UUID REFERENCES profiles(id),
  status TEXT CHECK (status IN ('approved','rejected')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- ACTIVITY LOGS
-- =====================================================
CREATE TABLE IF NOT EXISTS activity_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id),
  action TEXT NOT NULL,
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- CONTACT LOGS
-- =====================================================
CREATE TABLE IF NOT EXISTS contact_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  service_order_id UUID REFERENCES service_orders(id) ON DELETE CASCADE,
  teknisi_id UUID REFERENCES profiles(id),
  contact_method TEXT CHECK (contact_method IN ('whatsapp','call','sms','email')),
  message TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- WATCH DATABASE
-- =====================================================
CREATE TABLE IF NOT EXISTS watch_database (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  brand TEXT NOT NULL,
  model TEXT NOT NULL,
  movement TEXT CHECK (movement IN ('automatic','quartz','mechanical','smartwatch')),
  year_from INTEGER,
  year_to INTEGER,
  reference_number TEXT,
  image_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(brand, model)
);

-- =====================================================
-- WARRANTIES
-- =====================================================
CREATE TABLE IF NOT EXISTS warranties (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  service_order_id UUID REFERENCES service_orders(id) ON DELETE CASCADE,
  warranty_number TEXT UNIQUE NOT NULL,
  issued_at TIMESTAMPTZ DEFAULT NOW(),
  expiry_date TIMESTAMPTZ NOT NULL,
  terms TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- FEEDBACKS
-- =====================================================
CREATE TABLE IF NOT EXISTS feedbacks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  service_order_id UUID REFERENCES service_orders(id) ON DELETE CASCADE,
  customer_name TEXT NOT NULL,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT,
  teknisi_id UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(service_order_id)
);

-- =====================================================
-- LAYANAN ITEMS (multi-item support for 1 transaksi)
-- =====================================================
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

ALTER TABLE layanan_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for authenticated" ON layanan_items
  FOR ALL USING (true) WITH CHECK (true);

GRANT ALL ON TABLE layanan_items TO authenticated;
GRANT ALL ON TABLE layanan_items TO service_role;

-- =====================================================
-- NOTIFICATIONS
-- =====================================================
CREATE TABLE IF NOT EXISTS notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT DEFAULT 'info',
  link TEXT,
  data JSONB,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- LAYANAN / TRANSACTIONS
-- =====================================================
CREATE TABLE IF NOT EXISTS layanan (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  customer_name TEXT NOT NULL,
  customer_whatsapp TEXT,
  service_type TEXT NOT NULL,
  handled_by UUID REFERENCES profiles(id),
  payment_method TEXT,
  lead_source TEXT,
  lead_source_custom TEXT,
  sku_details TEXT,
  nominal_pembayaran NUMERIC DEFAULT 0,
  created_by UUID REFERENCES profiles(id)
);

-- =====================================================
-- SERVICE JASA MASTER DATA
-- =====================================================
CREATE TABLE IF NOT EXISTS service_jasa (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  default_price NUMERIC DEFAULT 0,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- SPAREPART REQUESTS
-- =====================================================
CREATE TABLE IF NOT EXISTS sparepart_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  service_order_id UUID REFERENCES service_orders(id) ON DELETE CASCADE,
  teknisi_id UUID REFERENCES profiles(id),
  sparepart_name TEXT NOT NULL,
  sparepart_sku TEXT,
  quantity INTEGER DEFAULT 1,
  source_type TEXT DEFAULT 'warehouse' CHECK (source_type IN ('store','warehouse')),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  admin_response TEXT,
  responded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- SPAREPART CONVERSATIONS
-- =====================================================
CREATE TABLE IF NOT EXISTS sparepart_conversations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  sparepart_request_id UUID REFERENCES sparepart_requests(id) ON DELETE CASCADE,
  sender_id UUID REFERENCES profiles(id),
  sender_name TEXT,
  sender_role TEXT,
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- INDEXES
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);
CREATE UNIQUE INDEX IF NOT EXISTS idx_service_orders_token ON service_orders(token);
CREATE INDEX IF NOT EXISTS idx_service_orders_status ON service_orders(status);
CREATE INDEX IF NOT EXISTS idx_service_orders_invoice ON service_orders(invoice_number);
CREATE INDEX IF NOT EXISTS idx_service_orders_teknisi ON service_orders(assigned_teknisi_id);
CREATE INDEX IF NOT EXISTS idx_service_orders_created ON service_orders(created_at);
CREATE INDEX IF NOT EXISTS idx_service_timeline_service ON service_timeline(service_order_id);
CREATE INDEX IF NOT EXISTS idx_service_timeline_created ON service_timeline(created_at);
CREATE INDEX IF NOT EXISTS idx_attendances_teknisi ON attendances(teknisi_id);
CREATE INDEX IF NOT EXISTS idx_inventory_sku ON inventory(sku);
CREATE INDEX IF NOT EXISTS idx_inventory_item_name ON inventory(item_name);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_feedbacks_service ON feedbacks(service_order_id);
CREATE INDEX IF NOT EXISTS idx_sparepart_requests_service ON sparepart_requests(service_order_id);
CREATE INDEX IF NOT EXISTS idx_sparepart_conversations_request ON sparepart_conversations(sparepart_request_id);

-- =====================================================
-- RLS
-- =====================================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_documentation ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_timeline ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendances ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE qc_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE watch_database ENABLE ROW LEVEL SECURITY;
ALTER TABLE warranties ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedbacks ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE layanan ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_jasa ENABLE ROW LEVEL SECURITY;
ALTER TABLE sparepart_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE sparepart_conversations ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT policyname, tablename FROM pg_policies WHERE schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I;', r.policyname, r.tablename);
  END LOOP;
END $$;

CREATE POLICY public_all_access ON profiles FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY public_all_access ON service_orders FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY public_all_access ON service_items FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY public_all_access ON service_documentation FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY public_all_access ON service_timeline FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY public_all_access ON attendances FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY public_all_access ON inventory FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY public_all_access ON stock_transfers FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY public_all_access ON categories FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY public_all_access ON qc_reviews FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY public_all_access ON activity_logs FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY public_all_access ON contact_logs FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY public_all_access ON watch_database FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY public_all_access ON warranties FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY public_all_access ON feedbacks FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY public_all_access ON notifications FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY public_all_access ON layanan FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY public_all_access ON service_jasa FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY public_all_access ON sparepart_requests FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY public_all_access ON sparepart_conversations FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- =====================================================
-- TRIGGERS / FUNCTIONS
-- =====================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_inventory_updated_at ON inventory;
CREATE TRIGGER update_inventory_updated_at
  BEFORE UPDATE ON inventory
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_layanan_updated_at ON layanan;
CREATE TRIGGER update_layanan_updated_at
  BEFORE UPDATE ON layanan
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'role', 'customer')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =====================================================
-- GRANTS
-- =====================================================
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO service_role;

GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO service_role;

GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon;

GRANT EXECUTE ON FUNCTION public.handle_new_user() TO authenticated;

ALTER DEFAULT PRIVILEGES FOR ROLE authenticated IN SCHEMA public
  GRANT ALL ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE authenticated IN SCHEMA public
  GRANT ALL ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE authenticated IN SCHEMA public
  GRANT ALL ON FUNCTIONS TO authenticated;

ALTER DEFAULT PRIVILEGES FOR ROLE service_role IN SCHEMA public
  GRANT ALL ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE service_role IN SCHEMA public
  GRANT ALL ON SEQUENCES TO service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE service_role IN SCHEMA public
  GRANT ALL ON FUNCTIONS TO service_role;

ALTER DEFAULT PRIVILEGES FOR ROLE anon IN SCHEMA public
  GRANT SELECT ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE anon IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO anon;


-- =====================================================
-- REVISI BATCH 9 - 2026-07-06
-- Database Schema Updates untuk DP optional, handle_by default, service_type fix, tema, owner analytics
-- =====================================================

-- =====================================================
-- R3: FIX - Ensure jenis_layanan NOT NULL constraint
-- =====================================================
DO $$
BEGIN
  -- First rename old column if service_type exists
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'layanan' AND column_name = 'service_type'
  ) THEN
    ALTER TABLE layanan RENAME COLUMN service_type TO jenis_layanan;
  END IF;

  -- Create column if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'layanan' AND column_name = 'jenis_layanan'
  ) THEN
    ALTER TABLE layanan ADD COLUMN jenis_layanan TEXT NOT NULL DEFAULT 'service_langsung';
  ELSE
    -- Update NULL values to default
    UPDATE layanan SET jenis_layanan = 'service_langsung' WHERE jenis_layanan IS NULL;

    -- Set NOT NULL constraint if not already set
    ALTER TABLE layanan ALTER COLUMN jenis_layanan SET NOT NULL;
  END IF;
END $$;

-- =====================================================
-- R2: ADD - Support multiple photos with photo_urls array
-- =====================================================
DO $$
BEGIN
  -- Add photo_urls array column if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'layanan' AND column_name = 'photo_urls'
  ) THEN
    ALTER TABLE layanan ADD COLUMN photo_urls TEXT[] DEFAULT '{}';
  END IF;

  -- Migrate existing photo_url to photo_urls (one-time migration)
  UPDATE layanan
  SET photo_urls = ARRAY[photo_url]
  WHERE photo_url IS NOT NULL AND (photo_urls = '{}' OR photo_urls IS NULL);
END $$;

-- =====================================================
-- R2: ADD - Column renames for consistency
-- =====================================================
DO $$
BEGIN
  -- Rename payment_method to metode_pembayaran if exists
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'layanan' AND column_name = 'payment_method'
  ) THEN
    ALTER TABLE layanan RENAME COLUMN payment_method TO metode_pembayaran;
  ELSIF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'layanan' AND column_name = 'metode_pembayaran'
  ) THEN
    ALTER TABLE layanan ADD COLUMN metode_pembayaran TEXT;
  END IF;

  -- Rename sku_details to detail_sku if exists
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'layanan' AND column_name = 'sku_details'
  ) THEN
    ALTER TABLE layanan RENAME COLUMN sku_details TO detail_sku;
  ELSIF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'layanan' AND column_name = 'detail_sku'
  ) THEN
    ALTER TABLE layanan ADD COLUMN detail_sku TEXT;
  END IF;

  -- Rename nominal_pembayaran to nominal if exists
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'layanan' AND column_name = 'nominal_pembayaran'
  ) THEN
    ALTER TABLE layanan RENAME COLUMN nominal_pembayaran TO nominal;
  ELSIF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'layanan' AND column_name = 'nominal'
  ) THEN
    ALTER TABLE layanan ADD COLUMN nominal NUMERIC DEFAULT 0;
  END IF;

  -- Rename created_by to created_by if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'layanan' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE layanan ADD COLUMN created_by UUID REFERENCES profiles(id);
  END IF;
END $$;

-- =====================================================
-- R2: ADD - Support handle_by and metadata columns
-- =====================================================
DO $$
BEGIN
  -- Add handled_by column if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'layanan' AND column_name = 'handled_by'
  ) THEN
    ALTER TABLE layanan ADD COLUMN handled_by UUID REFERENCES profiles(id);
  END IF;

  -- Add handled_by_name column if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'layanan' AND column_name = 'handled_by_name'
  ) THEN
    ALTER TABLE layanan ADD COLUMN handled_by_name TEXT;
  END IF;

  -- Add created_by_name column if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'layanan' AND column_name = 'created_by_name'
  ) THEN
    ALTER TABLE layanan ADD COLUMN created_by_name TEXT;
  END IF;

  -- Add status column if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'layanan' AND column_name = 'status'
  ) THEN
    ALTER TABLE layanan ADD COLUMN status TEXT DEFAULT 'active';
  END IF;

  -- Add notes column if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'layanan' AND column_name = 'notes'
  ) THEN
    ALTER TABLE layanan ADD COLUMN notes TEXT;
  END IF;

  -- Add lead_source column if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'layanan' AND column_name = 'lead_source'
  ) THEN
    ALTER TABLE layanan ADD COLUMN lead_source TEXT;
  END IF;

  -- Add lead_source_custom column if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'layanan' AND column_name = 'lead_source_custom'
  ) THEN
    ALTER TABLE layanan ADD COLUMN lead_source_custom TEXT;
  END IF;

  -- Add customer_whatsapp column if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'layanan' AND column_name = 'customer_whatsapp'
  ) THEN
    ALTER TABLE layanan ADD COLUMN customer_whatsapp TEXT;
  END IF;

  -- Add photo_url column if not exists (backward compatibility)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'layanan' AND column_name = 'photo_url'
  ) THEN
    ALTER TABLE layanan ADD COLUMN photo_url TEXT;
  END IF;
END $$;

-- =====================================================
-- R9: INDEX - Add indexes for better query performance (owner analytics)
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_layanan_created_at ON layanan(created_at);
CREATE INDEX IF NOT EXISTS idx_layanan_handled_by ON layanan(handled_by);
CREATE INDEX IF NOT EXISTS idx_layanan_created_by ON layanan(created_by);
CREATE INDEX IF NOT EXISTS idx_layanan_jenis_layanan ON layanan(jenis_layanan);
CREATE INDEX IF NOT EXISTS idx_layanan_status ON layanan(status);

-- =====================================================
-- CLEANUP & RELOAD SCHEMA CACHE
-- =====================================================
NOTIFY pgrst, 'reload schema';



-- =====================================================
-- RV2-5: FIX - Ensure photo_urls column is properly set NOT NULL
-- =====================================================
DO $$
BEGIN
  -- Verify photo_urls column exists and is NOT NULL
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'layanan' AND column_name = 'photo_urls'
  ) THEN
    -- Ensure it's NOT NULL
    ALTER TABLE layanan ALTER COLUMN photo_urls SET NOT NULL;

    -- Migrate NULL/empty arrays to empty array
    UPDATE layanan
    SET photo_urls = '{}'
    WHERE photo_urls IS NULL OR array_length(photo_urls, 1) IS NULL;
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';

-- Closing Harian table for daily settlement cross-check
CREATE TABLE IF NOT EXISTS closings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  closing_date DATE NOT NULL,
  total_transactions INTEGER NOT NULL DEFAULT 0,
  total_expected BIGINT NOT NULL DEFAULT 0,
  total_actual BIGINT NOT NULL DEFAULT 0,
  difference BIGINT NOT NULL DEFAULT 0,
  difference_notes TEXT,
  detail JSONB DEFAULT '{}',
  notes TEXT,
  status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'rejected')) DEFAULT 'pending',
  admin_notes TEXT,
  rejection_reason TEXT,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_closings_date ON closings(closing_date);
CREATE INDEX IF NOT EXISTS idx_closings_status ON closings(status);

-- RLS policies — biasanya di-bypass oleh service_role key di API route
ALTER TABLE closings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Full access via service_role bypass" ON closings USING (true) WITH CHECK (true);

-- =====================================================
-- FOREIGN KEY INDEXES (untuk performa join)
-- =====================================================
-- service_items
CREATE INDEX IF NOT EXISTS idx_service_items_order ON service_items(service_order_id);
-- service_documentation
CREATE INDEX IF NOT EXISTS idx_service_doc_order ON service_documentation(service_order_id);
CREATE INDEX IF NOT EXISTS idx_service_doc_uploader ON service_documentation(uploaded_by);
-- service_timeline
CREATE INDEX IF NOT EXISTS idx_service_timeline_teknisi ON service_timeline(teknisi_id);
CREATE INDEX IF NOT EXISTS idx_service_timeline_status ON service_timeline(status);
-- qc_reviews
CREATE INDEX IF NOT EXISTS idx_qc_reviews_order ON qc_reviews(service_order_id);
CREATE INDEX IF NOT EXISTS idx_qc_reviews_reviewer ON qc_reviews(reviewer_id);
-- activity_logs
CREATE INDEX IF NOT EXISTS idx_activity_logs_user ON activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_action ON activity_logs(action);
-- contact_logs
CREATE INDEX IF NOT EXISTS idx_contact_logs_order ON contact_logs(service_order_id);
CREATE INDEX IF NOT EXISTS idx_contact_logs_teknisi ON contact_logs(teknisi_id);
-- warranties
CREATE INDEX IF NOT EXISTS idx_warranties_order ON warranties(service_order_id);
-- feedbacks
CREATE INDEX IF NOT EXISTS idx_feedbacks_teknisi ON feedbacks(teknisi_id);
-- stock_transfers
CREATE INDEX IF NOT EXISTS idx_stock_transfers_inventory ON stock_transfers(inventory_id);
CREATE INDEX IF NOT EXISTS idx_stock_transfers_creator ON stock_transfers(created_by);
-- sparepart_requests
CREATE INDEX IF NOT EXISTS idx_sparepart_requests_teknisi ON sparepart_requests(teknisi_id);
-- sparepart_conversations
CREATE INDEX IF NOT EXISTS idx_sparepart_conv_sender ON sparepart_conversations(sender_id);
-- notifications
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(type);
-- activity_logs created_at (sering di-order)
CREATE INDEX IF NOT EXISTS idx_activity_logs_created ON activity_logs(created_at);
-- notifications created_at
CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at);
-- service_orders
CREATE INDEX IF NOT EXISTS idx_service_orders_category ON service_orders(category);
CREATE INDEX IF NOT EXISTS idx_service_orders_updated ON service_orders(updated_at);

-- ============================================================
-- MIGRATION: 2026-07-10 - Telegram message tracking
-- ============================================================
ALTER TABLE service_documentation ADD COLUMN IF NOT EXISTS telegram_chat_id TEXT DEFAULT '';
ALTER TABLE service_documentation ADD COLUMN IF NOT EXISTS telegram_message_id BIGINT DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_service_doc_telegram ON service_documentation(telegram_chat_id, telegram_message_id);

ALTER TABLE closings ADD COLUMN IF NOT EXISTS telegram_chat_id TEXT DEFAULT '';
ALTER TABLE closings ADD COLUMN IF NOT EXISTS telegram_message_id BIGINT DEFAULT 0;

-- Customer database table
CREATE TABLE IF NOT EXISTS customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  point INTEGER DEFAULT 0,
  profesi TEXT DEFAULT '',
  email TEXT DEFAULT '',
  alamat TEXT DEFAULT '',
  last_transaction TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);
CREATE INDEX IF NOT EXISTS idx_customers_name ON customers(name);

ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read customers" ON customers FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can insert customers" ON customers FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can update customers" ON customers FOR UPDATE USING (auth.uid() IS NOT NULL);

-- Grant table-level permissions (diperlukan untuk tabel baru setelah GRANT ALL awal)
GRANT ALL ON TABLE customers TO authenticated;
GRANT ALL ON TABLE customers TO anon;
GRANT ALL ON TABLE customers TO service_role;

-- Tracking logs for tracking page visits
CREATE TABLE IF NOT EXISTS tracking_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_order_id UUID REFERENCES service_orders(id),
  token TEXT NOT NULL,
  visited_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tracking_logs_service ON tracking_logs(service_order_id);

ALTER TABLE tracking_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read tracking_logs" ON tracking_logs FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Anyone can insert tracking_logs" ON tracking_logs FOR INSERT WITH CHECK (true);

GRANT ALL ON TABLE tracking_logs TO authenticated;
GRANT INSERT ON TABLE tracking_logs TO anon;
GRANT ALL ON TABLE tracking_logs TO service_role;

NOTIFY pgrst, 'reload schema';

-- ============================================================
-- MIGRATION: 2026-07-09 - Performance optimization
-- ============================================================
-- 1. Hapus aws-sdk v2 (50MB tidak dipakai)
-- 2. Tambah 20+ FK indexes untuk query join
-- 3. Batch insert pattern untuk N+1 query fixes
-- 4. Fix useEffect stale closure di teknisi page
