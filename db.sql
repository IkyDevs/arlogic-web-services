-- =====================================================
-- SERVICE MANAGEMENT SYSTEM - COMPLETE DATABASE SCHEMA
-- =====================================================
-- Version: 2.0
-- Date: 2024
-- Includes: Tables, RLS Policies, Triggers, Storage Buckets
-- =====================================================

-- =====================================================
-- 1. EXTENSIONS
-- =====================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =====================================================
-- 2. TABLES
-- =====================================================

-- 2.1 PROFILES TABLE (User profiles dengan role)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'customer' CHECK (role IN ('admin', 'teknisi', 'supervisor', 'owner', 'customer')),
  teknisi_name TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2.2 SERVICE ORDERS TABLE
CREATE TABLE IF NOT EXISTS service_orders (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  invoice_number TEXT UNIQUE NOT NULL,
  token TEXT NOT NULL,
  token_expires_at TIMESTAMPTZ,

  -- Customer Information
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  serial_number TEXT,

  -- Device Information
  device_type TEXT NOT NULL,
  device_brand TEXT NOT NULL,
  device_model TEXT,

  -- Service Information
  issue_description TEXT NOT NULL,
  request TEXT,
  notes TEXT,

  -- Status Workflow
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'assigned', 'in_progress', 'qc_pending', 'completed', 'cancelled')),

  -- Assignment
  assigned_teknisi_id UUID REFERENCES profiles(id),

  -- Timeline
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  start_date TIMESTAMPTZ,
  done_date TIMESTAMPTZ,
  work_duration TEXT,

  -- Financial
  estimated_cost DECIMAL(10,2),
  final_cost DECIMAL(10,2),

  -- Completion
  completion_notes TEXT
);

-- 2.3 SERVICE ITEMS TABLE (Jasa & Sparepart)
CREATE TABLE IF NOT EXISTS service_items (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  service_order_id UUID REFERENCES service_orders(id) ON DELETE CASCADE,
  item_type TEXT CHECK (item_type IN ('jasa', 'sparepart')),
  name TEXT NOT NULL,
  quantity INTEGER DEFAULT 1,
  price DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2.4 SERVICE DOCUMENTATION TABLE (Foto proses service)
CREATE TABLE IF NOT EXISTS service_documentation (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  service_order_id UUID REFERENCES service_orders(id) ON DELETE CASCADE,
  photo_url TEXT NOT NULL,
  stage TEXT NOT NULL,
  uploaded_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2.5 ATTENDANCES TABLE (Absensi teknisi & admin)
CREATE TABLE IF NOT EXISTS attendances (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  teknisi_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  photo_url TEXT NOT NULL,
  location TEXT,
  check_in TIMESTAMPTZ DEFAULT NOW(),
  check_out TIMESTAMPTZ,
  status TEXT DEFAULT 'checked_in' CHECK (status IN ('checked_in', 'checked_out')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2.6 INVENTORY TABLE (2 versi: store stock & warehouse stock)
CREATE TABLE IF NOT EXISTS inventory (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  item_name TEXT NOT NULL,
  sku TEXT UNIQUE NOT NULL,
  store_stock INTEGER DEFAULT 0,
  warehouse_stock INTEGER DEFAULT 0,
  unit TEXT NOT NULL,
  min_stock INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2.7 QC REVIEWS TABLE
CREATE TABLE IF NOT EXISTS qc_reviews (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  service_order_id UUID REFERENCES service_orders(id) ON DELETE CASCADE,
  reviewer_id UUID REFERENCES profiles(id),
  status TEXT CHECK (status IN ('approved', 'rejected')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2.8 ACTIVITY LOGS TABLE
CREATE TABLE IF NOT EXISTS activity_logs (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id),
  action TEXT NOT NULL,
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 3. INDEXES (For better performance)
-- =====================================================

-- Profiles indexes
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);

-- Service orders indexes
CREATE INDEX IF NOT EXISTS idx_service_orders_token ON service_orders(token);
CREATE INDEX IF NOT EXISTS idx_service_orders_status ON service_orders(status);
CREATE INDEX IF NOT EXISTS idx_service_orders_invoice ON service_orders(invoice_number);
CREATE INDEX IF NOT EXISTS idx_service_orders_teknisi ON service_orders(assigned_teknisi_id);
CREATE INDEX IF NOT EXISTS idx_service_orders_created ON service_orders(created_at);
CREATE INDEX IF NOT EXISTS idx_service_orders_customer ON service_orders(customer_name, customer_phone);

-- Attendances indexes
CREATE INDEX IF NOT EXISTS idx_attendances_teknisi ON attendances(teknisi_id);
CREATE INDEX IF NOT EXISTS idx_attendances_check_in ON attendances(check_in);

-- Inventory indexes
CREATE INDEX IF NOT EXISTS idx_inventory_sku ON inventory(sku);
CREATE INDEX IF NOT EXISTS idx_inventory_name ON inventory(item_name);

-- Activity logs indexes
CREATE INDEX IF NOT EXISTS idx_activity_logs_user ON activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created ON activity_logs(created_at);

-- =====================================================
-- 4. ROW LEVEL SECURITY (RLS) POLICIES
-- =====================================================

-- 4.1 Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_documentation ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendances ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE qc_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

-- 4.2 PROFILES POLICIES
-- Users can view their own profile
CREATE POLICY "profiles_select_own" ON profiles
  FOR SELECT USING (auth.uid() = id);

-- Users can insert their own profile
CREATE POLICY "profiles_insert_own" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY "profiles_update_own" ON profiles
  FOR UPDATE USING (auth.uid() = id);

-- Admin can do everything
CREATE POLICY "profiles_admin_all" ON profiles
  FOR ALL USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
  );

-- 4.3 SERVICE ORDERS POLICIES
-- Everyone can view (for tracking)
CREATE POLICY "service_orders_select_all" ON service_orders
  FOR SELECT USING (true);

-- Authenticated users can insert
CREATE POLICY "service_orders_insert_auth" ON service_orders
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Admin and assigned teknisi can update
CREATE POLICY "service_orders_update_assigned" ON service_orders
  FOR UPDATE USING (
    auth.uid() IN (
      SELECT id FROM profiles WHERE role = 'admin'
    ) OR assigned_teknisi_id = auth.uid()
  );

-- 4.4 SERVICE ITEMS POLICIES
CREATE POLICY "service_items_select_all" ON service_items
  FOR SELECT USING (true);

CREATE POLICY "service_items_insert_auth" ON service_items
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "service_items_update_auth" ON service_items
  FOR UPDATE USING (auth.role() = 'authenticated');

-- 4.5 SERVICE DOCUMENTATION POLICIES
CREATE POLICY "service_documentation_select_all" ON service_documentation
  FOR SELECT USING (true);

CREATE POLICY "service_documentation_insert_auth" ON service_documentation
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- 4.6 ATTENDANCES POLICIES
CREATE POLICY "attendances_insert_own" ON attendances
  FOR INSERT WITH CHECK (auth.uid() = teknisi_id);

CREATE POLICY "attendances_select_own" ON attendances
  FOR SELECT USING (true);

CREATE POLICY "attendances_update_own" ON attendances
  FOR UPDATE USING (auth.uid() = teknisi_id);

-- 4.7 INVENTORY POLICIES
CREATE POLICY "inventory_select_all" ON inventory
  FOR SELECT USING (true);

CREATE POLICY "inventory_insert_admin" ON inventory
  FOR INSERT WITH CHECK (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
  );

CREATE POLICY "inventory_update_admin" ON inventory
  FOR UPDATE USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
  );

-- 4.8 QC REVIEWS POLICIES
CREATE POLICY "qc_reviews_select_all" ON qc_reviews
  FOR SELECT USING (true);

CREATE POLICY "qc_reviews_insert_supervisor" ON qc_reviews
  FOR INSERT WITH CHECK (
    (SELECT role FROM profiles WHERE id = auth.uid()) IN ('supervisor', 'admin')
  );

-- 4.9 ACTIVITY LOGS POLICIES
CREATE POLICY "activity_logs_select_admin" ON activity_logs
  FOR SELECT USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin', 'owner')
  );

CREATE POLICY "activity_logs_insert_auth" ON activity_logs
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- =====================================================
-- 5. TRIGGERS & FUNCTIONS
-- =====================================================

-- 5.1 Auto-update updated_at column
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to profiles
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Apply to inventory
CREATE TRIGGER update_inventory_updated_at
  BEFORE UPDATE ON inventory
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 5.2 Auto-create profile when new user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'role', 'customer')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 5.3 Auto-log activity on service order status change
CREATE OR REPLACE FUNCTION log_service_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO activity_logs (user_id, action, details)
    VALUES (
      auth.uid(),
      'SERVICE_STATUS_CHANGED',
      jsonb_build_object(
        'service_id', NEW.id,
        'old_status', OLD.status,
        'new_status', NEW.status,
        'invoice', NEW.invoice_number
      )
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER service_status_change_log
  AFTER UPDATE OF status ON service_orders
  FOR EACH ROW EXECUTE FUNCTION log_service_status_change();

-- 5.4 Function to check if user is admin (helper)
CREATE OR REPLACE FUNCTION is_admin(user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  user_role TEXT;
BEGIN
  SELECT role INTO user_role FROM profiles WHERE id = user_id;
  RETURN user_role = 'admin';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5.5 Function to check if user is supervisor
CREATE OR REPLACE FUNCTION is_supervisor(user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  user_role TEXT;
BEGIN
  SELECT role INTO user_role FROM profiles WHERE id = user_id;
  RETURN user_role IN ('supervisor', 'admin');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 6. STORAGE BUCKETS
-- =====================================================

-- 6.1 Create storage buckets
INSERT INTO storage.buckets (id, name, public)
VALUES
  ('attendance-photos', 'attendance-photos', true),
  ('service-photos', 'service-photos', true)
ON CONFLICT (id) DO NOTHING;

-- 6.2 Storage policies for attendance-photos
DROP POLICY IF EXISTS "Attendance photos access" ON storage.objects;
CREATE POLICY "Attendance photos access"
ON storage.objects
FOR ALL
USING (bucket_id = 'attendance-photos')
WITH CHECK (bucket_id = 'attendance-photos');

-- 6.3 Storage policies for service-photos
DROP POLICY IF EXISTS "Service photos access" ON storage.objects;
CREATE POLICY "Service photos access"
ON storage.objects
FOR ALL
USING (bucket_id = 'service-photos')
WITH CHECK (bucket_id = 'service-photos');

-- =====================================================
-- 7. INITIAL DATA (Sample)
-- =====================================================

-- Insert sample admin (You need to create user in auth first)
-- Then update with actual user ID
-- UPDATE profiles SET role = 'admin' WHERE email = 'admin@example.com';

-- Insert sample inventory items
INSERT INTO inventory (item_name, sku, store_stock, warehouse_stock, unit, min_stock) VALUES
  ('LCD iPhone 11', 'LCD-IP11', 5, 10, 'pcs', 2),
  ('Battery iPhone 11', 'BAT-IP11', 8, 15, 'pcs', 3),
  ('LCD Samsung S21', 'LCD-S21', 3, 8, 'pcs', 2),
  ('Charging Port Type C', 'PORT-TC', 15, 30, 'pcs', 5),
  ('Screen Protector', 'SCR-PRO', 50, 100, 'pcs', 20)
ON CONFLICT (sku) DO NOTHING;

-- =====================================================
-- 8. VERIFICATION QUERIES
-- =====================================================

-- Check all tables
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;

-- Check all policies
SELECT schemaname, tablename, policyname
FROM pg_policies
ORDER BY tablename;

-- Check all triggers
SELECT trigger_name, event_manipulation, event_object_table
FROM information_schema.triggers
ORDER BY event_object_table;

-- =====================================================
-- END OF SCHEMA
-- =====================================================
