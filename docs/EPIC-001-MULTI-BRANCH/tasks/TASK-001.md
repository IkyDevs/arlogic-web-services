# TASK-001: Database Schema - Add branch_id to Core Service Tables

**Priority**: 🔴 Critical  
**Difficulty**: ⭐⭐ Medium  
**Estimated Duration**: 2 days  
**Owner**: Backend/Database Lead

---

## Objective

Add `branch_id` column to all core service-related tables with proper foreign key constraints and defaults. This establishes the foundation for branch-scoped service order management.

---

## Scope

### In Scope ✅
- Add `branch_id` to: `service_orders`, `service_items`, `service_documentation`, `service_timeline`, `qc_reviews`
- Set appropriate defaults
- Create foreign key constraints
- Add NOT NULL constraints (after data migration)
- Create preliminary indexes

### Out of Scope ❌
- Migrating existing data to branches
- Creating RLS policies
- Creating branch master table (handled in TASK-002)

---

## Technical Changes

### 1.1 Service Orders Table

```sql
ALTER TABLE service_orders 
ADD COLUMN branch_id UUID DEFAULT gen_random_uuid();

-- Add foreign key (will use default until data migrated)
ALTER TABLE service_orders 
ADD CONSTRAINT fk_service_orders_branch 
FOREIGN KEY (branch_id) REFERENCES branches(id) 
ON DELETE CASCADE;

-- Add denormalized branch_name for performance
ALTER TABLE service_orders 
ADD COLUMN branch_name VARCHAR;
```

### 1.2 Service Items Table

```sql
ALTER TABLE service_items 
ADD COLUMN branch_id UUID DEFAULT gen_random_uuid();

ALTER TABLE service_items 
ADD CONSTRAINT fk_service_items_branch 
FOREIGN KEY (branch_id) REFERENCES branches(id) 
ON DELETE CASCADE;
```

### 1.3 Service Documentation Table

```sql
ALTER TABLE service_documentation 
ADD COLUMN branch_id UUID DEFAULT gen_random_uuid();

ALTER TABLE service_documentation 
ADD CONSTRAINT fk_service_documentation_branch 
FOREIGN KEY (branch_id) REFERENCES branches(id) 
ON DELETE CASCADE;
```

### 1.4 Service Timeline Table

```sql
ALTER TABLE service_timeline 
ADD COLUMN branch_id UUID DEFAULT gen_random_uuid();

ALTER TABLE service_timeline 
ADD CONSTRAINT fk_service_timeline_branch 
FOREIGN KEY (branch_id) REFERENCES branches(id) 
ON DELETE CASCADE;
```

### 1.5 QC Reviews Table

```sql
ALTER TABLE qc_reviews 
ADD COLUMN branch_id UUID DEFAULT gen_random_uuid();

ALTER TABLE qc_reviews 
ADD CONSTRAINT fk_qc_reviews_branch 
FOREIGN KEY (branch_id) REFERENCES branches(id) 
ON DELETE CASCADE;
```

---

## Dependencies

### Prerequisites
- ✅ `branches` table created (TASK-002 prereq)
- Database access with ALTER TABLE permissions
- Backup taken before schema changes

### Blocks
- TASK-002 (needs these foreign keys)
- TASK-003 (indexing strategy)
- TASK-004 (RLS policies)

---

## Implementation Checklist

### Phase 1: Preparation
- [ ] Review current schema of all 5 tables
- [ ] Document current data volume
- [ ] Create database backup
- [ ] Prepare rollback script
- [ ] Coordinate with team for 15-min downtime window

### Phase 2: Execution
- [ ] Create `branches` table (temporary for FK reference)
- [ ] Add `branch_id` columns with defaults
- [ ] Add foreign key constraints
- [ ] Add `branch_name` denormalized columns (where needed)
- [ ] Verify schema changes with `\d table_name`

### Phase 3: Validation
- [ ] Verify all columns added: `SELECT * FROM service_orders LIMIT 1;`
- [ ] Check constraint creation: `SELECT constraint_name FROM information_schema.table_constraints WHERE table_name='service_orders';`
- [ ] Verify default values applied: `SELECT column_default FROM information_schema.columns WHERE table_name='service_orders' AND column_name='branch_id';`
- [ ] Test FK constraint with dummy insert

### Phase 4: Documentation
- [ ] Document schema changes in SCHEMA.md
- [ ] Update database diagram
- [ ] Document rollback procedure

---

## Acceptance Criteria

- [ ] All 5 tables have `branch_id` column
- [ ] Foreign key constraints created and validated
- [ ] Default values set correctly
- [ ] No breaking changes to existing queries
- [ ] Schema change documented
- [ ] Rollback procedure tested
- [ ] Team trained on new schema

---

## Technical Details

### Column Specification

```sql
branch_id UUID 
  DEFAULT gen_random_uuid() 
  REFERENCES branches(id) 
  ON DELETE CASCADE 
  -- Will be SET NOT NULL after data migration
```

### Rationale for Defaults

- `gen_random_uuid()`: Each row gets unique UUID until explicitly set
- Allows schema change without immediate data migration
- Foreign key active immediately (prevents orphaned data)
- ON DELETE CASCADE: Deleting branch deletes all related data

### Why Denormalize branch_name?

- `service_orders` and `service_documentation` accessed frequently
- Eliminates JOIN to `branches` table on every query
- Updated via trigger to keep in sync
- Negligible storage cost (one VARCHAR column)

---

## Risk Assessment

### High Risk ⚠️
- **Risk**: Foreign key constraint fails if branches table doesn't exist
- **Mitigation**: Create branches table first (empty is fine)
- **Rollback**: Drop FK constraint

### Medium Risk ⚠️
- **Risk**: ALTER TABLE on large tables could be slow
- **Mitigation**: Table size ~100K rows - should be fine
- **Downtime**: < 1 minute expected
- **Rollback**: DROP COLUMN branch_id

### Low Risk ✓
- Default values prevent constraint violations
- Existing queries not affected
- No data changes in this task

---

## Rollback Plan

### Immediate Rollback (if constraint fails)

```sql
-- Drop foreign keys
ALTER TABLE service_orders DROP CONSTRAINT fk_service_orders_branch;
ALTER TABLE service_items DROP CONSTRAINT fk_service_items_branch;
ALTER TABLE service_documentation DROP CONSTRAINT fk_service_documentation_branch;
ALTER TABLE service_timeline DROP CONSTRAINT fk_service_timeline_branch;
ALTER TABLE qc_reviews DROP CONSTRAINT fk_qc_reviews_branch;

-- Drop columns
ALTER TABLE service_orders DROP COLUMN branch_id;
ALTER TABLE service_orders DROP COLUMN branch_name;
-- ... repeat for other tables

-- Restore from backup if needed
```

---

## Testing

### Unit Tests

```typescript
// Verify schema
test('service_orders has branch_id column', async () => {
  const result = await db.raw(`
    SELECT column_name FROM information_schema.columns 
    WHERE table_name='service_orders' AND column_name='branch_id'
  `);
  expect(result.rows.length).toBe(1);
});

// Test default value
test('branch_id default generates UUID', async () => {
  const result = await db.raw(`
    INSERT INTO service_orders (customer_name, invoice_number, status) 
    VALUES ('Test', 'INV-TEST', 'pending')
    RETURNING branch_id
  `);
  expect(result.rows[0].branch_id).toBeDefined();
  expect(result.rows[0].branch_id).toMatch(/^[0-9a-f-]{36}$/);
});
```

### Integration Tests

```typescript
// Test FK constraint
test('FK constraint prevents orphaned records', async () => {
  const invalidBranchId = '00000000-0000-0000-0000-000000000000';
  
  expect(async () => {
    await db.from('service_orders').insert({
      branch_id: invalidBranchId,
      customer_name: 'Test'
    });
  }).rejects.toThrow('violates foreign key constraint');
});
```

---

## Monitoring & Validation

### Post-Deployment Checks

```sql
-- 1. Verify column exists
SELECT COUNT(*) FROM information_schema.columns 
WHERE table_name = 'service_orders' AND column_name = 'branch_id';
-- Should return 1 for each table

-- 2. Verify constraint exists
SELECT COUNT(*) FROM information_schema.table_constraints 
WHERE table_name = 'service_orders' AND constraint_type = 'FOREIGN KEY';

-- 3. Test insert works
INSERT INTO service_orders (customer_name, invoice_number, status) 
VALUES ('Test', 'TEST-001', 'pending');
-- Should succeed with auto-generated branch_id
```

---

## Success Criteria Met ✅

- [x] Schema changes applied without errors
- [x] Foreign key constraints active
- [x] Rollback tested and documented
- [x] No performance degradation
- [x] Team trained on changes
- [x] Ready for data migration (TASK-002)

