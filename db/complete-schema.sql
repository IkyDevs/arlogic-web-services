-- ================================================================
-- ARLOGIC WEB SERVICES — COMPLETE DATABASE SCHEMA
-- Generated: 2026-07-23
-- Source: supabase-schema.sql + 13 migration files + types/index.ts + codebase analysis
-- Instructions: Copy-paste this entire file into Supabase SQL Editor and run
-- ================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ================================================================
-- 1. PROFILES (users / auth)
-- ================================================================
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

-- ================================================================
-- 2. CUSTOMERS (customer database)
-- ================================================================
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

-- ================================================================
-- 3. SERVICE ORDERS (core service order)
-- ================================================================
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
  discount INTEGER DEFAULT 0,
  discount_percentage NUMERIC(5,2) DEFAULT 0,
  completion_notes TEXT,
  qc_submit_notes TEXT,
  warranty_months INTEGER DEFAULT 3,
  warranty_expiry TIMESTAMPTZ,
  -- Teknisi pending fields (added 2026-07-23, gunakan timeline sebagai fallback)
  teknisi_pending_reason TEXT,
  pending_teknisi_approved BOOLEAN DEFAULT NULL
);

-- ================================================================
-- 4. SERVICE ITEMS (jasa & sparepart per service order)
-- ================================================================
CREATE TABLE IF NOT EXISTS service_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  service_order_id UUID REFERENCES service_orders(id) ON DELETE CASCADE,
  item_type TEXT CHECK (item_type IN ('jasa','sparepart')),
  name TEXT NOT NULL,
  quantity INTEGER DEFAULT 1,
  price DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ================================================================
-- 5. SERVICE DOCUMENTATION (photos per service order)
-- ================================================================
CREATE TABLE IF NOT EXISTS service_documentation (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  service_order_id UUID REFERENCES service_orders(id) ON DELETE CASCADE,
  photo_url TEXT NOT NULL,
  stage TEXT NOT NULL,
  uploaded_by UUID REFERENCES profiles(id),
  telegram_chat_id TEXT DEFAULT '',
  telegram_message_id BIGINT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ================================================================
-- 6. PHOTOS (Telegram file_id tracking + keep-alive)
-- ================================================================
CREATE TABLE IF NOT EXISTS photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_id TEXT NOT NULL,
  file_unique_id TEXT NOT NULL,
  file_size INTEGER DEFAULT 0,
  photo_data TEXT,
  filename TEXT NOT NULL DEFAULT '',
  mime_type TEXT NOT NULL DEFAULT 'image/jpeg',
  service_order_id UUID REFERENCES service_orders(id) ON DELETE SET NULL,
  service_documentation_id UUID REFERENCES service_documentation(id) ON DELETE SET NULL,
  stage TEXT,
  uploaded_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  refreshed_at TIMESTAMPTZ DEFAULT NOW(),
  refresh_count INTEGER DEFAULT 0,
  last_verified_at TIMESTAMPTZ
);

-- ================================================================
-- 7. SERVICE TIMELINE (status change log)
-- ================================================================
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

-- ================================================================
-- 8. ATTENDANCES (teknisi check-in/out)
-- ================================================================
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

-- ================================================================
-- 9. INVENTORY (sparepart stock)
-- ================================================================
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

-- ================================================================
-- 10. STOCK TRANSFERS
-- ================================================================
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

-- ================================================================
-- 11. CATEGORIES (inventory categories)
-- ================================================================
CREATE TABLE IF NOT EXISTS categories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ================================================================
-- 12. QC REVIEWS
-- ================================================================
CREATE TABLE IF NOT EXISTS qc_reviews (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  service_order_id UUID REFERENCES service_orders(id) ON DELETE CASCADE,
  reviewer_id UUID REFERENCES profiles(id),
  status TEXT CHECK (status IN ('approved','rejected')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ================================================================
-- 13. WARRANTIES
-- ================================================================
CREATE TABLE IF NOT EXISTS warranties (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  service_order_id UUID REFERENCES service_orders(id) ON DELETE CASCADE,
  warranty_number TEXT UNIQUE NOT NULL,
  issued_at TIMESTAMPTZ DEFAULT NOW(),
  expiry_date TIMESTAMPTZ NOT NULL,
  terms TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ================================================================
-- 14. FEEDBACKS (customer ratings)
-- ================================================================
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

-- ================================================================
-- 15. LAYANAN / TRANSACTIONS (cash register)
-- ================================================================
CREATE TABLE IF NOT EXISTS layanan (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  customer_name TEXT NOT NULL,
  customer_whatsapp TEXT,
  jenis_layanan TEXT NOT NULL DEFAULT 'service_langsung',
  handled_by UUID REFERENCES profiles(id),
  handled_by_name TEXT,
  metode_pembayaran TEXT,
  lead_source TEXT,
  lead_source_custom TEXT,
  detail_sku TEXT,
  nominal NUMERIC DEFAULT 0,
  notes TEXT,
  photo_url TEXT,
  photo_urls TEXT[] DEFAULT '{}',
  created_by UUID REFERENCES profiles(id),
  created_by_name TEXT,
  status TEXT DEFAULT 'active',
  linked_service_order_id UUID REFERENCES service_orders(id),
  telegram_chat_id TEXT DEFAULT '',
  telegram_message_id BIGINT DEFAULT 0,
  split_payment BOOLEAN DEFAULT FALSE,
  metode_pembayaran_1 TEXT,
  nominal_1 NUMERIC DEFAULT 0,
  metode_pembayaran_2 TEXT,
  nominal_2 NUMERIC DEFAULT 0
);

-- ================================================================
-- 16. LAYANAN ITEMS (multi-item support for 1 transaction)
-- ================================================================
CREATE TABLE IF NOT EXISTS layanan_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  layanan_id UUID REFERENCES layanan(id) ON DELETE CASCADE,
  jenis_layanan TEXT NOT NULL,
  detail_sku TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  nominal DECIMAL(15,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ================================================================
-- 17. ACTIVITY LOGS
-- ================================================================
CREATE TABLE IF NOT EXISTS activity_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id),
  action TEXT NOT NULL,
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ================================================================
-- 18. NOTIFICATIONS (in-app)
-- ================================================================
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

-- ================================================================
-- 19. CONTACT LOGS
-- ================================================================
CREATE TABLE IF NOT EXISTS contact_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  service_order_id UUID REFERENCES service_orders(id) ON DELETE CASCADE,
  teknisi_id UUID REFERENCES profiles(id),
  contact_method TEXT CHECK (contact_method IN ('whatsapp','call','sms','email')),
  message TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ================================================================
-- 20. WATCH DATABASE (reference data)
-- ================================================================
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

-- ================================================================
-- 21. SERVICE JASA (master data for jasa items)
-- ================================================================
CREATE TABLE IF NOT EXISTS service_jasa (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  default_price NUMERIC DEFAULT 0,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ================================================================
-- 22. SPAREPART REQUESTS
-- ================================================================
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

-- ================================================================
-- 23. SPAREPART CONVERSATIONS
-- ================================================================
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

-- ================================================================
-- 24. CLOSINGS (daily settlement)
-- ================================================================
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
  status TEXT NOT NULL CHECK (status IN ('pending','approved','rejected')) DEFAULT 'pending',
  admin_notes TEXT,
  rejection_reason TEXT,
  created_by UUID REFERENCES profiles(id),
  telegram_chat_id TEXT DEFAULT '',
  telegram_message_id BIGINT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ================================================================
-- 25. EXPENSES (pengeluaran)
-- ================================================================
CREATE TABLE IF NOT EXISTS expenses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  item_name TEXT NOT NULL,
  amount DECIMAL(15,2) NOT NULL,
  payment_method TEXT NOT NULL,
  handled_by UUID REFERENCES profiles(id),
  handled_by_name TEXT,
  notes TEXT,
  proof_photo_urls TEXT[] DEFAULT '{}',
  telegram_chat_id TEXT DEFAULT '',
  telegram_message_id BIGINT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ================================================================
-- 26. CUSTOMERS (duplicate of #2 — kept for backward compat)
-- ================================================================

-- ================================================================
-- 27. TRACKING LOGS (public tracking page visits)
-- ================================================================
CREATE TABLE IF NOT EXISTS tracking_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_order_id UUID REFERENCES service_orders(id),
  token TEXT NOT NULL,
  visited_at TIMESTAMPTZ DEFAULT NOW()
);

-- ================================================================
-- 28. WHATSAPP TEMPLATES
-- ================================================================
CREATE TABLE IF NOT EXISTS whatsapp_templates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  template_name TEXT UNIQUE NOT NULL,
  template_content TEXT NOT NULL,
  placeholders JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ================================================================
-- 29. KASPIN (sparepart movement tracking — used in KaspinUpdate.tsx)
-- ================================================================
-- Note: KaspinUpdate.tsx inserts into service_timeline with status='kaspin'
-- If a separate kaspin table exists, add it here.

-- ================================================================
-- INDEXES (performance optimization)
-- ================================================================

-- Profiles
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);

-- Customers
CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);
CREATE INDEX IF NOT EXISTS idx_customers_name ON customers(name);

-- Service Orders
CREATE UNIQUE INDEX IF NOT EXISTS idx_service_orders_token ON service_orders(token);
CREATE INDEX IF NOT EXISTS idx_service_orders_status ON service_orders(status);
CREATE INDEX IF NOT EXISTS idx_service_orders_invoice ON service_orders(invoice_number);
CREATE INDEX IF NOT EXISTS idx_service_orders_teknisi ON service_orders(assigned_teknisi_id);
CREATE INDEX IF NOT EXISTS idx_service_orders_created ON service_orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_service_orders_category ON service_orders(category);
CREATE INDEX IF NOT EXISTS idx_service_orders_updated ON service_orders(updated_at);

-- Service Items
CREATE INDEX IF NOT EXISTS idx_service_items_order ON service_items(service_order_id);

-- Service Documentation
CREATE INDEX IF NOT EXISTS idx_service_doc_order ON service_documentation(service_order_id);
CREATE INDEX IF NOT EXISTS idx_service_doc_uploader ON service_documentation(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_service_doc_telegram ON service_documentation(telegram_chat_id, telegram_message_id);
CREATE INDEX IF NOT EXISTS idx_service_doc_stage ON service_documentation(stage);

-- Photos
CREATE INDEX IF NOT EXISTS idx_photos_file_id ON photos(file_id);
CREATE INDEX IF NOT EXISTS idx_photos_file_unique_id ON photos(file_unique_id);
CREATE INDEX IF NOT EXISTS idx_photos_service_order ON photos(service_order_id);
CREATE INDEX IF NOT EXISTS idx_photos_created_at ON photos(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_photos_refreshed_at ON photos(refreshed_at);

-- Service Timeline
CREATE INDEX IF NOT EXISTS idx_service_timeline_service ON service_timeline(service_order_id);
CREATE INDEX IF NOT EXISTS idx_service_timeline_teknisi ON service_timeline(teknisi_id);
CREATE INDEX IF NOT EXISTS idx_service_timeline_status ON service_timeline(status);
CREATE INDEX IF NOT EXISTS idx_service_timeline_created ON service_timeline(created_at DESC);

-- Attendances
CREATE INDEX IF NOT EXISTS idx_attendances_teknisi ON attendances(teknisi_id);

-- Inventory
CREATE INDEX IF NOT EXISTS idx_inventory_sku ON inventory(sku);
CREATE INDEX IF NOT EXISTS idx_inventory_item_name ON inventory(item_name);

-- Stock Transfers
CREATE INDEX IF NOT EXISTS idx_stock_transfers_inventory ON stock_transfers(inventory_id);
CREATE INDEX IF NOT EXISTS idx_stock_transfers_creator ON stock_transfers(created_by);

-- Layanan
CREATE INDEX IF NOT EXISTS idx_layanan_created_at ON layanan(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_layanan_handled_by ON layanan(handled_by);
CREATE INDEX IF NOT EXISTS idx_layanan_created_by ON layanan(created_by);
CREATE INDEX IF NOT EXISTS idx_layanan_jenis_layanan ON layanan(jenis_layanan);
CREATE INDEX IF NOT EXISTS idx_layanan_status ON layanan(status);

-- Layanan Items
CREATE INDEX IF NOT EXISTS idx_layanan_items_layanan_id ON layanan_items(layanan_id);

-- QC Reviews
CREATE INDEX IF NOT EXISTS idx_qc_reviews_order ON qc_reviews(service_order_id);
CREATE INDEX IF NOT EXISTS idx_qc_reviews_reviewer ON qc_reviews(reviewer_id);

-- Activity Logs
CREATE INDEX IF NOT EXISTS idx_activity_logs_user ON activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_action ON activity_logs(action);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created ON activity_logs(created_at DESC);

-- Contact Logs
CREATE INDEX IF NOT EXISTS idx_contact_logs_order ON contact_logs(service_order_id);
CREATE INDEX IF NOT EXISTS idx_contact_logs_teknisi ON contact_logs(teknisi_id);

-- Notifications
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(type);
CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at DESC);

-- Feedbacks
CREATE INDEX IF NOT EXISTS idx_feedbacks_service ON feedbacks(service_order_id);
CREATE INDEX IF NOT EXISTS idx_feedbacks_teknisi ON feedbacks(teknisi_id);

-- Sparepart Requests
CREATE INDEX IF NOT EXISTS idx_sparepart_requests_service ON sparepart_requests(service_order_id);
CREATE INDEX IF NOT EXISTS idx_sparepart_requests_teknisi ON sparepart_requests(teknisi_id);

-- Sparepart Conversations
CREATE INDEX IF NOT EXISTS idx_sparepart_conversations_request ON sparepart_conversations(sparepart_request_id);
CREATE INDEX IF NOT EXISTS idx_sparepart_conv_sender ON sparepart_conversations(sender_id);

-- Closings
CREATE INDEX IF NOT EXISTS idx_closings_date ON closings(closing_date);
CREATE INDEX IF NOT EXISTS idx_closings_status ON closings(status);

-- Expenses
CREATE INDEX IF NOT EXISTS idx_expenses_created_at ON expenses(created_at DESC);

-- Tracking Logs
CREATE INDEX IF NOT EXISTS idx_tracking_logs_service ON tracking_logs(service_order_id);

-- Whatsapp Templates
CREATE UNIQUE INDEX IF NOT EXISTS idx_whatsapp_templates_name ON whatsapp_templates(template_name);

-- ================================================================
-- ROW LEVEL SECURITY (RLS)
-- ================================================================

-- Drop all existing policies first
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT policyname, tablename FROM pg_policies WHERE schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I;', r.policyname, r.tablename);
  END LOOP;
END $$;

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_documentation ENABLE ROW LEVEL SECURITY;
ALTER TABLE photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_timeline ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendances ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE qc_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE warranties ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedbacks ENABLE ROW LEVEL SECURITY;
ALTER TABLE layanan ENABLE ROW LEVEL SECURITY;
ALTER TABLE layanan_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE watch_database ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_jasa ENABLE ROW LEVEL SECURITY;
ALTER TABLE sparepart_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE sparepart_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE closings ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE tracking_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_templates ENABLE ROW LEVEL SECURITY;

-- Simple universal policy: authenticated users can do everything
DO $$
DECLARE
  tables_list TEXT[] := ARRAY['profiles','customers','service_orders','service_items',
    'service_documentation','photos','service_timeline','attendances','inventory',
    'stock_transfers','categories','qc_reviews','warranties','feedbacks','layanan',
    'layanan_items','activity_logs','notifications','contact_logs','watch_database',
    'service_jasa','sparepart_requests','sparepart_conversations','closings','expenses',
    'whatsapp_templates'];
  t TEXT;
BEGIN
  FOREACH t IN ARRAY tables_list
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS public_all_access ON %I;', t);
    EXECUTE format('CREATE POLICY public_all_access ON %I FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);', t);
  END LOOP;
END $$;

-- Tracking logs: anyone can insert (public tracking page)
DROP POLICY IF EXISTS tracking_logs_insert_anon ON tracking_logs;
CREATE POLICY tracking_logs_insert_anon ON tracking_logs FOR INSERT WITH CHECK (true);

-- Expenses: full access for authenticated
-- (already covered by public_all_access above)

-- ================================================================
-- FUNCTIONS & TRIGGERS
-- ================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Auto-update triggers for tables with updated_at
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_inventory_updated_at BEFORE UPDATE ON inventory
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_layanan_updated_at BEFORE UPDATE ON layanan
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_closings_updated_at BEFORE UPDATE ON closings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_expenses_updated_at BEFORE UPDATE ON expenses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_whatsapp_templates_updated_at BEFORE UPDATE ON whatsapp_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Auto-create profile when auth user is created
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

-- ================================================================
-- GRANTS
-- ================================================================

GRANT USAGE ON SCHEMA public TO authenticated, anon, service_role;

GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO authenticated;

GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO service_role;

GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon;
GRANT INSERT ON TABLE tracking_logs TO anon;

ALTER DEFAULT PRIVILEGES FOR ROLE authenticated IN SCHEMA public
  GRANT ALL ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE authenticated IN SCHEMA public
  GRANT ALL ON SEQUENCES TO authenticated;

ALTER DEFAULT PRIVILEGES FOR ROLE service_role IN SCHEMA public
  GRANT ALL ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE service_role IN SCHEMA public
  GRANT ALL ON SEQUENCES TO service_role;

ALTER DEFAULT PRIVILEGES FOR ROLE anon IN SCHEMA public
  GRANT SELECT ON TABLES TO anon;

-- ================================================================
-- RELOAD SCHEMA CACHE
-- ================================================================
NOTIFY pgrst, 'reload schema';

-- ================================================================
-- VERIFICATION QUERIES (jalankan untuk cek hasil)
-- ================================================================
-- SELECT table_name, COUNT(*) as columns FROM information_schema.columns
-- WHERE table_schema = 'public' GROUP BY table_name ORDER BY table_name;
