# TASK-002: Database Schema - Add branch_id to Transaction & Inventory Tables

**Priority**: 🔴 Critical  
**Difficulty**: ⭐⭐ Medium  
**Estimated Duration**: 2 days  
**Owner**: Backend/Database Lead

---

## Objective

Add `branch_id` column to all transaction and inventory-related tables. This parallels TASK-001 but focuses on operational/financial data tables.

---

## Scope

### In Scope ✅
- Add `branch_id` to: `layanan`, `layanan_items`, `expenses`, `inventory`, `stock_transfers`
- Add `branch_id` to support tables: `attendances`, `feedbacks`, `notifications` (conditional)
- Set appropriate defaults and foreign key constraints
- Add `branch_name` denormalized columns to frequently-accessed tables

### Out of Scope ❌
- Data migration
- RLS policies
- Query optimization

---

## Technical Changes

### 2.1 Layanan (Main Transaction) Table

```sql
ALTER TABLE layanan 
ADD COLUMN branch_id UUID DEFAULT gen_random_uuid();

ALTER TABLE layanan 
ADD CONSTRAINT fk_layanan_branch 
FOREIGN KEY (branch_id) REFERENCES branches(id) 
ON DELETE CASCADE;

-- Denormalized for performance
ALTER TABLE layanan 
ADD COLUMN branch_name VARCHAR;
```

### 2.2 Layanan Items Table

```sql
ALTER TABLE layanan_items 
ADD COLUMN branch_id UUID DEFAULT gen_random_uuid();

ALTER TABLE layanan_items 
ADD CONSTRAINT fk_layanan_items_branch 
FOREIGN KEY (branch_id) REFERENCES branches(id) 
ON DELETE CASCADE;
```

### 2.3 Expenses Table

```sql
ALTER TABLE expenses 
ADD COLUMN branch_id UUID DEFAULT gen_random_uuid();

ALTER TABLE expenses 
ADD CONSTRAINT fk_expenses_branch 
FOREIGN KEY (branch_id) REFERENCES branches(id) 
ON DELETE CASCADE;
```

### 2.4 Inventory Table

```sql
ALTER TABLE inventory 
ADD COLUMN branch_id UUID DEFAULT gen_random_uuid();

ALTER TABLE inventory 
ADD CONSTRAINT fk_inventory_branch 
FOREIGN KEY (branch_id) REFERENCES branches(id) 
ON DELETE CASCADE;
```

### 2.5 Stock Transfers Table

```sql
ALTER TABLE stock_transfers 
ADD COLUMN branch_id UUID DEFAULT gen_random_uuid();

ALTER TABLE stock_transfers 
ADD CONSTRAINT fk_stock_transfers_branch 
FOREIGN KEY (branch_id) REFERENCES branches(id) 
ON DELETE CASCADE;
```

### 2.6 Support Tables

```sql
-- Attendances
ALTER TABLE attendances 
ADD COLUMN branch_id UUID DEFAULT gen_random_uuid();

ALTER TABLE attendances 
ADD CONSTRAINT fk_attendances_branch 
FOREIGN KEY (branch_id) REFERENCES branches(id) 
ON DELETE CASCADE;

-- Feedbacks
ALTER TABLE feedbacks 
ADD COLUMN branch_id UUID DEFAULT gen_random_uuid();

ALTER TABLE feedbacks 
ADD CONSTRAINT fk_feedbacks_branch 
FOREIGN KEY (branch_id) REFERENCES branches(id) 
ON DELETE CASCADE;

-- Notifications (nullable for system-wide notifications)
ALTER TABLE notifications 
ADD COLUMN branch_id UUID;

ALTER TABLE notifications 
ADD CONSTRAINT fk_notifications_branch 
FOREIGN KEY (branch_id) REFERENCES branches(id) 
ON DELETE SET NULL;
```

---

## Dependencies

### Prerequisites
- ✅ TASK-001 completed (core service tables have branch_id)
- ✅ branches table exists
- Database backup taken

### Blocks
- TASK-003 (indexing)
- TASK-004 (RLS policies)
- TASK-005 (auth layer integration)

---

## Implementation Checklist

### Phase 1: Preparation
- [ ] Document current data in each table
- [ ] Review table sizes (expected: layanan ~50K rows, inventory ~5K)
- [ ] Create database backup
- [ ] Schedule 30-minute downtime window

### Phase 2: Schema Changes
- [ ] Add branch_id to layanan with FK
- [ ] Add branch_id to layanan_items with FK
- [ ] Add branch_id to expenses with FK
- [ ] Add branch_id to inventory with FK
- [ ] Add branch_id to stock_transfers with FK
- [ ] Add branch_id to attendances with FK
- [ ] Add branch_id to feedbacks with FK
- [ ] Add branch_id (nullable) to notifications with FK
- [ ] Add branch_name denormalized columns

### Phase 3: Validation
- [ ] Verify all columns exist
- [ ] Verify FK constraints created
- [ ] Test inserts for each table
- [ ] Verify defaults working
- [ ] Check query performance (should not degrade)

### Phase 4: Documentation
- [ ] Update schema documentation
- [ ] Document any migration considerations
- [ ] Update ER diagram

---

## Acceptance Criteria

- [ ] All 8 tables have branch_id column
- [ ] Foreign key constraints working
- [ ] Default values applied correctly
- [ ] Denormalized branch_name added where needed
- [ ] Rollback tested
- [ ] Query performance verified
- [ ] Documentation updated
- [ ] Zero breaking changes to existing code

---

## Technical Rationale

### Why These Tables Need branch_id?

| Table | Reason |
|-------|--------|
| layanan | Core financial transaction - must be branch-scoped |
| layanan_items | Child of layanan - inherits branch scope |
| expenses | Financial records - must be branch-scoped |
| inventory | Branch-local stock - each branch has own inventory |
| stock_transfers | Transfers between locations - tracked per branch |
| attendances | Staff attendance - branch-specific |
| feedbacks | Customer feedback - tied to branch service |
| notifications | Some system-wide, some branch-specific |

### Denormalization Strategy

Denormalize `branch_name` in:
- `layanan` (transactions listed frequently)
- `expenses` (expense reports generated often)

Do NOT denormalize in:
- `layanan_items` (joined to layanan, redundant)
- `inventory` (lookups by SKU, not by branch)
- Support tables (infrequent access)

---

## Risk Assessment

### High Risk ⚠️
- **Risk**: Table locks during ALTER on large tables
- **Mitigation**: Run during off-peak hours, expect 1-2 min per table
- **Monitoring**: Check for slow queries post-deployment

### Medium Risk ⚠️
- **Risk**: Expenses table used for daily closing - could impact reporting
- **Mitigation**: Add branch_id but keep closing logic unchanged for now
- **Rollback**: Quick (< 5 min to drop columns)

### Low Risk ✓
- Default values prevent constraint violations
- No data changes - just schema additions
- Can be rolled back quickly if needed

---

## Rollback Plan

```sql
-- Drop all constraints
ALTER TABLE layanan DROP CONSTRAINT fk_layanan_branch;
ALTER TABLE layanan_items DROP CONSTRAINT fk_layanan_items_branch;
ALTER TABLE expenses DROP CONSTRAINT fk_expenses_branch;
ALTER TABLE inventory DROP CONSTRAINT fk_inventory_branch;
ALTER TABLE stock_transfers DROP CONSTRAINT fk_stock_transfers_branch;
ALTER TABLE attendances DROP CONSTRAINT fk_attendances_branch;
ALTER TABLE feedbacks DROP CONSTRAINT fk_feedbacks_branch;
ALTER TABLE notifications DROP CONSTRAINT fk_notifications_branch;

-- Drop columns
ALTER TABLE layanan DROP COLUMN branch_id, DROP COLUMN branch_name;
ALTER TABLE layanan_items DROP COLUMN branch_id;
-- ... etc for remaining tables
```

---

## Testing

### Schema Verification

```sql
-- Verify all columns added
SELECT table_name, COUNT(*) as branch_id_columns
FROM information_schema.columns
WHERE column_name = 'branch_id'
  AND table_name IN ('layanan', 'layanan_items', 'expenses', 'inventory', 'stock_transfers', 'attendances', 'feedbacks', 'notifications')
GROUP BY table_name;
-- Should return 8 rows
```

### Performance Testing

```sql
-- Query performance should not degrade
-- Before: SELECT * FROM layanan WHERE customer_name LIKE '%John%' LIMIT 100;
-- After: Same query should complete in similar time

EXPLAIN ANALYZE
SELECT * FROM layanan WHERE customer_name LIKE '%John%' LIMIT 100;
```

---

## Monitoring

### Post-Deployment

```sql
-- 1. Verify all tables have branch_id
SELECT table_name FROM information_schema.tables 
WHERE table_schema='public' 
  AND table_name IN ('layanan','layanan_items','expenses','inventory','stock_transfers','attendances','feedbacks','notifications')
EXCEPT
SELECT table_name FROM information_schema.columns
WHERE column_name='branch_id';
-- Should return 0 rows (all tables have the column)

-- 2. Monitor query performance
-- Run against prod replicas
```

---

## Success Criteria

- [x] All transaction & inventory tables have branch_id
- [x] Foreign keys properly configured
- [x] No performance degradation
- [x] Rollback procedure tested
- [x] Ready for data migration

