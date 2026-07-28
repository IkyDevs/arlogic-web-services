# Data Migration Strategy
## EPIC-001: Enterprise Multi Branch System

---

## 1. Pre-Migration Planning

### 1.1 Data Audit

Before migration, verify:
- Total service_orders count
- Total layanan (transactions) count
- Total users count
- Total active service orders (not completed)
- Storage size

**Audit Query**:
```sql
SELECT
  (SELECT COUNT(*) FROM service_orders) as total_orders,
  (SELECT COUNT(*) FROM service_orders WHERE status != 'done') as active_orders,
  (SELECT COUNT(*) FROM layanan) as total_transactions,
  (SELECT COUNT(*) FROM profiles) as total_users,
  (SELECT pg_size_pretty(pg_database_size(current_database()))) as db_size;
```

### 1.2 Backup Strategy

**Before Migration**:
1. Full database backup to S3 (Supabase automated)
2. Manual backup export (optional, recommended)
3. Verify backup integrity

**Command**:
```bash
# Supabase CLI - Create backup
supabase db dump --db-url $DATABASE_URL > backup_pre_migration_$(date +%Y%m%d_%H%M%S).sql
```

---

## 2. Migration Plan

### 2.1 Phase 1: Prepare Infrastructure (Zero Downtime)

**Duration**: 1-2 days before migration

**Steps**:

1. **Create branches table** (read-only during this phase)
```sql
CREATE TABLE branches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR NOT NULL,
  code VARCHAR UNIQUE NOT NULL,
  location TEXT,
  phone VARCHAR,
  email VARCHAR,
  address TEXT,
  city VARCHAR,
  province VARCHAR,
  postal_code VARCHAR,
  status VARCHAR DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'paused')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES profiles(id),
  
  CONSTRAINT branches_code_not_empty CHECK (code != '')
);

CREATE INDEX idx_branches_status ON branches(status);
CREATE INDEX idx_branches_code ON branches(code);
```

2. **Create user_branch_assignments table**
```sql
CREATE TABLE user_branch_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  role VARCHAR NOT NULL CHECK (role IN ('owner', 'manager', 'admin', 'technician', 'qc')),
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  assigned_by UUID REFERENCES profiles(id),
  is_active BOOLEAN DEFAULT true,
  notes TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(user_id, branch_id)
);

CREATE INDEX idx_user_branch_assignments_user_id ON user_branch_assignments(user_id);
CREATE INDEX idx_user_branch_assignments_branch_id ON user_branch_assignments(branch_id);
CREATE INDEX idx_user_branch_assignments_role ON user_branch_assignments(role);
```

3. **Add default_branch_id to profiles**
```sql
ALTER TABLE profiles ADD COLUMN default_branch_id UUID REFERENCES branches(id) ON DELETE SET NULL;
```

4. **Verify schema with test data** (optional):
```sql
INSERT INTO branches (name, code, location, status) VALUES 
  ('Cabang Jember', 'JMB001', 'Jember', 'active');
  
-- Verify
SELECT * FROM branches;
DELETE FROM branches;  -- Clean up test data
```

**Downtime**: NONE - These are new tables, no impact on existing operations

---

### 2.2 Phase 2: Add branch_id Columns (Zero Downtime)

**Duration**: 1-2 hours

**Steps**:

1. **Add branch_id to all operational tables** (with default to allow NOT NULL constraint):

```sql
-- Core service tables
ALTER TABLE service_orders ADD COLUMN branch_id UUID DEFAULT gen_random_uuid();
ALTER TABLE service_items ADD COLUMN branch_id UUID DEFAULT gen_random_uuid();
ALTER TABLE service_documentation ADD COLUMN branch_id UUID DEFAULT gen_random_uuid();
ALTER TABLE service_timeline ADD COLUMN branch_id UUID DEFAULT gen_random_uuid();
ALTER TABLE qc_reviews ADD COLUMN branch_id UUID DEFAULT gen_random_uuid();

-- Transaction tables
ALTER TABLE layanan ADD COLUMN branch_id UUID DEFAULT gen_random_uuid();
ALTER TABLE layanan_items ADD COLUMN branch_id UUID DEFAULT gen_random_uuid();
ALTER TABLE expenses ADD COLUMN branch_id UUID DEFAULT gen_random_uuid();

-- Inventory tables
ALTER TABLE inventory ADD COLUMN branch_id UUID DEFAULT gen_random_uuid();
ALTER TABLE stock_transfers ADD COLUMN branch_id UUID DEFAULT gen_random_uuid();

-- Support tables
ALTER TABLE attendances ADD COLUMN branch_id UUID DEFAULT gen_random_uuid();
ALTER TABLE notifications ADD COLUMN branch_id UUID;  -- Nullable for system-wide
ALTER TABLE activity_logs ADD COLUMN branch_id UUID;  -- Nullable
ALTER TABLE feedbacks ADD COLUMN branch_id UUID DEFAULT gen_random_uuid();

-- Profile tables
ALTER TABLE profiles ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
```

**Downtime**: NONE - Adding columns with defaults doesn't lock table

2. **Verify column creation**:
```sql
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'service_orders' AND column_name = 'branch_id';
-- Should return branch_id
```

---

### 2.3 Phase 3: Create Default Branch (Zero Downtime)

**Duration**: 5 minutes

**Steps**:

1. **Create default branch for existing data**:
```sql
INSERT INTO branches (
  id, 
  name, 
  code, 
  location, 
  status, 
  created_at,
  created_by
) VALUES (
  '00000000-0000-0000-0000-000000000001',
  'Default Branch (Legacy)',
  'DEFAULT',
  'Main Office',
  'active',
  NOW(),
  (SELECT id FROM profiles WHERE role = 'owner' LIMIT 1)
);

-- Verify
SELECT * FROM branches;
```

---

### 2.4 Phase 4: Populate branch_id (Downtime: 1-5 minutes)

**Duration**: 5-30 minutes (depends on data volume)

**Steps**:

1. **Migrate branch_id for all existing data** (use DEFAULT value):

```sql
-- All service_orders get default branch
UPDATE service_orders 
SET branch_id = '00000000-0000-0000-0000-000000000001'
WHERE branch_id IS NULL;

-- Update service_items with parent service_order's branch
UPDATE service_items 
SET branch_id = (
  SELECT branch_id FROM service_orders 
  WHERE service_orders.id = service_items.service_order_id
)
WHERE branch_id IS NULL;

-- All layanan transactions get default branch
UPDATE layanan 
SET branch_id = '00000000-0000-0000-0000-000000000001'
WHERE branch_id IS NULL;

-- Update layanan_items with parent layanan's branch
UPDATE layanan_items 
SET branch_id = (
  SELECT branch_id FROM layanan 
  WHERE layanan.id = layanan_items.layanan_id
)
WHERE branch_id IS NULL;

-- All other tables...
UPDATE expenses SET branch_id = '00000000-0000-0000-0000-000000000001' WHERE branch_id IS NULL;
UPDATE inventory SET branch_id = '00000000-0000-0000-0000-000000000001' WHERE branch_id IS NULL;
UPDATE attendances SET branch_id = '00000000-0000-0000-0000-000000000001' WHERE branch_id IS NULL;
UPDATE feedbacks SET branch_id = '00000000-0000-0000-0000-000000000001' WHERE branch_id IS NULL;

-- Verify all rows have branch_id
SELECT COUNT(*) as null_count FROM service_orders WHERE branch_id IS NULL;
SELECT COUNT(*) as null_count FROM layanan WHERE branch_id IS NULL;
-- Should both be 0
```

**Downtime**: YES - 1-5 minutes while UPDATE statements run

**Strategy**: Run during off-peak hours (late night)

2. **Verify all data updated**:
```sql
-- Should return 0
SELECT 
  (SELECT COUNT(*) FROM service_orders WHERE branch_id IS NULL) as so_nulls,
  (SELECT COUNT(*) FROM layanan WHERE branch_id IS NULL) as lay_nulls,
  (SELECT COUNT(*) FROM expenses WHERE branch_id IS NULL) as exp_nulls;
```

---

### 2.5 Phase 5: Add Constraints & Indexes (5-10 minutes)

**Duration**: 5-10 minutes

**Steps**:

1. **Convert branch_id to NOT NULL**:
```sql
ALTER TABLE service_orders ALTER COLUMN branch_id SET NOT NULL;
ALTER TABLE service_items ALTER COLUMN branch_id SET NOT NULL;
ALTER TABLE layanan ALTER COLUMN branch_id SET NOT NULL;
ALTER TABLE layanan_items ALTER COLUMN branch_id SET NOT NULL;
ALTER TABLE expenses ALTER COLUMN branch_id SET NOT NULL;
ALTER TABLE inventory ALTER COLUMN branch_id SET NOT NULL;
ALTER TABLE attendances ALTER COLUMN branch_id SET NOT NULL;
ALTER TABLE feedbacks ALTER COLUMN branch_id SET NOT NULL;
ALTER TABLE service_documentation ALTER COLUMN branch_id SET NOT NULL;
ALTER TABLE service_timeline ALTER COLUMN branch_id SET NOT NULL;
ALTER TABLE qc_reviews ALTER COLUMN branch_id SET NOT NULL;
ALTER TABLE stock_transfers ALTER COLUMN branch_id SET NOT NULL;
```

**Downtime**: NONE - Constraint check is fast if no NULLs exist

2. **Add foreign key constraints**:
```sql
ALTER TABLE service_orders ADD CONSTRAINT fk_service_orders_branch 
  FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE CASCADE;

ALTER TABLE service_items ADD CONSTRAINT fk_service_items_branch 
  FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE CASCADE;

-- [All other tables...]
```

3. **Create critical indexes**:
```sql
CREATE INDEX idx_service_orders_branch_id ON service_orders(branch_id);
CREATE INDEX idx_service_orders_branch_status ON service_orders(branch_id, status);
CREATE INDEX idx_service_orders_branch_created ON service_orders(branch_id, created_at DESC);

CREATE INDEX idx_layanan_branch_id ON layanan(branch_id);
CREATE INDEX idx_layanan_branch_created ON layanan(branch_id, created_at DESC);
CREATE INDEX idx_layanan_branch_payment ON layanan(branch_id, metode_pembayaran);

CREATE INDEX idx_inventory_branch_id ON inventory(branch_id);
CREATE INDEX idx_expenses_branch_id ON expenses(branch_id);
CREATE INDEX idx_attendances_branch_id ON attendances(branch_id);

-- [All other critical indexes...]
```

---

### 2.6 Phase 6: Migrate User Assignments (5 minutes)

**Duration**: 5 minutes

**Steps**:

1. **Set all existing users' default_branch_id to default branch**:
```sql
UPDATE profiles 
SET default_branch_id = '00000000-0000-0000-0000-000000000001'
WHERE default_branch_id IS NULL;
```

2. **Assign all existing users to default branch**:
```sql
INSERT INTO user_branch_assignments (
  user_id, 
  branch_id, 
  role, 
  assigned_at, 
  assigned_by
)
SELECT 
  p.id,
  '00000000-0000-0000-0000-000000000001',
  p.role,
  NOW(),
  (SELECT id FROM profiles WHERE role = 'owner' LIMIT 1)
FROM profiles p
ON CONFLICT (user_id, branch_id) DO NOTHING;

-- Verify
SELECT COUNT(*) FROM user_branch_assignments;
-- Should match user count (or close)
```

---

### 2.7 Phase 7: Denormalization & Triggers (5 minutes)

**Duration**: 5 minutes

**Steps**:

1. **Add branch_name denormalized columns** (optional but recommended):
```sql
ALTER TABLE service_orders ADD COLUMN branch_name VARCHAR;
ALTER TABLE layanan ADD COLUMN branch_name VARCHAR;

-- Populate initial values
UPDATE service_orders 
SET branch_name = (SELECT name FROM branches WHERE id = branch_id);

UPDATE layanan 
SET branch_name = (SELECT name FROM branches WHERE id = branch_id);

-- Create trigger to keep in sync
CREATE OR REPLACE FUNCTION update_branch_name_on_service_orders()
RETURNS TRIGGER AS $$
BEGIN
  SELECT name INTO NEW.branch_name FROM branches WHERE id = NEW.branch_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_branch_name_service_orders
  BEFORE INSERT OR UPDATE ON service_orders
  FOR EACH ROW
  EXECUTE FUNCTION update_branch_name_on_service_orders();
```

---

### 2.8 Phase 8: Enable RLS Policies (5 minutes)

**Duration**: 5 minutes

**Steps**:

1. **Enable RLS on all operational tables**:
```sql
ALTER TABLE service_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE layanan ENABLE ROW LEVEL SECURITY;
ALTER TABLE layanan_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendances ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedbacks ENABLE ROW LEVEL SECURITY;

-- [All other tables...]
```

2. **Create RLS policies** (Example: service_orders):
```sql
CREATE POLICY "Branch isolation" 
  ON public.service_orders
  FOR ALL
  TO authenticated
  USING (
    CASE 
      WHEN (SELECT role FROM profiles WHERE id = auth.uid()) = 'owner'
        THEN true
      ELSE branch_id IN (
        SELECT branch_id 
        FROM user_branch_assignments 
        WHERE user_id = auth.uid() AND is_active = true
      )
    END
  )
  WITH CHECK (
    CASE 
      WHEN (SELECT role FROM profiles WHERE id = auth.uid()) = 'owner'
        THEN true
      ELSE branch_id IN (
        SELECT branch_id 
        FROM user_branch_assignments 
        WHERE user_id = auth.uid() AND is_active = true
      )
    END
  );
```

---

## 3. Validation & Testing

### 3.1 Post-Migration Validation

```sql
-- 1. Check all rows have branch_id
SELECT table_name, COUNT(*) as null_count 
FROM (
  SELECT 'service_orders' as table_name FROM service_orders WHERE branch_id IS NULL
  UNION ALL
  SELECT 'layanan' FROM layanan WHERE branch_id IS NULL
  UNION ALL
  SELECT 'expenses' FROM expenses WHERE branch_id IS NULL
) t
GROUP BY table_name;
-- Should return no rows

-- 2. Check all branch_ids exist
SELECT COUNT(*) FROM service_orders 
WHERE branch_id NOT IN (SELECT id FROM branches);
-- Should return 0

-- 3. Check user assignments
SELECT COUNT(*) FROM user_branch_assignments;
-- Should approximately equal profiles count

-- 4. Check indexes created
SELECT indexname FROM pg_indexes 
WHERE tablename = 'service_orders' AND indexname LIKE 'idx_%branch%';
-- Should list all branch indexes
```

### 3.2 Data Integrity Checks

```sql
-- Service orders referential integrity
SELECT COUNT(*) FROM service_orders 
WHERE assigned_teknisi_id IS NOT NULL 
  AND assigned_teknisi_id NOT IN (SELECT id FROM profiles);
-- Should return 0

-- Layanan referential integrity
SELECT COUNT(*) FROM layanan_items 
WHERE layanan_id NOT IN (SELECT id FROM layanan);
-- Should return 0

-- No orphaned records
SELECT COUNT(*) FROM service_items 
WHERE service_order_id NOT IN (SELECT id FROM service_orders);
-- Should return 0
```

---

## 4. Rollback Plan

### 4.1 Immediate Rollback (if critical error)

If within 1 hour of migration:

```sql
-- Restore from backup
-- (Supabase automatically maintains backups)

-- Via CLI:
supabase db push --version pre-migration
```

### 4.2 Gradual Rollback (if discovered during testing)

If issues discovered during UAT (before go-live):

1. **Stop accepting new branch assignments**:
```sql
ALTER TABLE user_branch_assignments DISABLE TRIGGER ALL;
```

2. **Disable RLS temporarily**:
```sql
ALTER TABLE service_orders DISABLE ROW LEVEL SECURITY;
-- [All tables...]
```

3. **Remove branch_id constraints**:
```sql
ALTER TABLE service_orders DROP CONSTRAINT fk_service_orders_branch;
ALTER TABLE service_orders ALTER COLUMN branch_id DROP NOT NULL;
-- [All tables...]
```

4. **Restore from backup if needed**

### 4.3 Full Rollback (Nuclear Option)

```bash
# 1. Restore complete backup
supabase db push --db-snapshot backup_pre_migration.sql

# 2. Verify restoration
SELECT COUNT(*) FROM service_orders;

# 3. Notify stakeholders
```

---

## 5. Zero-Downtime Strategy

### 5.1 Migration Window

**Recommended Time**: 2-4 AM (off-peak hours)

**Steps**:
1. Notify team: "Maintenance window scheduled"
2. Stop accepting new service orders (5 min before)
3. Run migration (5-15 minutes)
4. Verify data integrity (5 minutes)
5. Resume service (notify team)
6. Monitor logs for errors (30 minutes post-migration)

### 5.2 Health Checks

After migration, verify:

```javascript
// API test: Can query service orders?
GET /api/service-orders
  ✓ Returns 200
  ✓ Data includes branch_id
  ✓ Branch filtering works

// API test: Can create service order?
POST /api/service-orders
  ✓ Returns 201
  ✓ Auto-assigned to default branch
  ✓ No permission errors

// Frontend test: Dashboard loads?
  ✓ Shows default branch data
  ✓ No console errors
  ✓ All widgets load

// Database test: RLS works?
  SELECT FROM service_orders (as non-owner)
    ✓ Returns only branch-scoped data
```

---

## 6. Backup & Recovery

### 6.1 Backup Schedule

- **Pre-migration**: Full backup (automated + manual)
- **Post-migration**: Full backup (automated + manual)
- **Ongoing**: Daily automated backups (Supabase)
- **Retention**: 30-day history

### 6.2 Recovery Testing

Test recovery procedure:

```bash
# 1. Restore to test database
# 2. Verify data integrity
# 3. Test queries
# 4. Verify RLS policies
# 5. Confirm migration successful
```

---

## 7. Success Criteria

✅ All data migrated with 100% accuracy  
✅ No data loss  
✅ No downtime (< 5 min acceptable)  
✅ All queries work post-migration  
✅ RLS policies enforced  
✅ Branch isolation verified  
✅ Performance maintained or improved  
✅ Rollback procedure documented and tested

