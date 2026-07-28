# TASK-003: Database Indexes - Create Branch-Scoped Query Indexes

**Priority**: 🟠 High  
**Difficulty**: ⭐⭐ Medium  
**Estimated Duration**: 1-2 days  
**Owner**: Database Lead / DevOps

---

## Objective

Create comprehensive indexes on `branch_id` columns and composite indexes combining branch with frequently-queried conditions. This enables performant queries in a multi-branch system.

---

## Scope

### In Scope ✅
- Create single-column indexes on all branch_id columns
- Create composite indexes (branch_id + status, date, etc.)
- Create partial indexes for common filters
- Verify index performance impact
- Document indexing strategy

### Out of Scope ❌
- Query optimization beyond indexing
- Query rewriting
- Performance tuning (separate TASK)

---

## Technical Changes

### 3.1 Critical Indexes (Must Create)

```sql
-- Service Orders (Core)
CREATE INDEX idx_service_orders_branch_id 
  ON service_orders(branch_id);

CREATE INDEX idx_service_orders_branch_status 
  ON service_orders(branch_id, status);

CREATE INDEX idx_service_orders_branch_created 
  ON service_orders(branch_id, created_at DESC);

CREATE INDEX idx_service_orders_branch_teknisi 
  ON service_orders(branch_id, assigned_teknisi_id);

-- Layanan (Transactions)
CREATE INDEX idx_layanan_branch_id 
  ON layanan(branch_id);

CREATE INDEX idx_layanan_branch_created 
  ON layanan(branch_id, created_at DESC);

CREATE INDEX idx_layanan_branch_payment 
  ON layanan(branch_id, metode_pembayaran);

-- Inventory
CREATE INDEX idx_inventory_branch_id 
  ON inventory(branch_id);

CREATE INDEX idx_inventory_branch_sku 
  ON inventory(branch_id, sku);

-- Expenses
CREATE INDEX idx_expenses_branch_id 
  ON expenses(branch_id);

-- Attendances
CREATE INDEX idx_attendances_branch_id 
  ON attendances(branch_id);

CREATE INDEX idx_attendances_branch_date 
  ON attendances(branch_id, check_in_time DESC);
```

### 3.2 Supporting Indexes

```sql
-- For JOINs
CREATE INDEX idx_service_items_service_order_id 
  ON service_items(service_order_id);

CREATE INDEX idx_layanan_items_layanan_id 
  ON layanan_items(layanan_id);

-- User-Branch Assignments (for RLS queries)
CREATE UNIQUE INDEX idx_user_branch_assignments_unique 
  ON user_branch_assignments(user_id, branch_id) 
  WHERE is_active = true;

CREATE INDEX idx_user_branch_assignments_user_id 
  ON user_branch_assignments(user_id);

CREATE INDEX idx_user_branch_assignments_branch_id 
  ON user_branch_assignments(branch_id);

-- Branches
CREATE UNIQUE INDEX idx_branches_code 
  ON branches(code);

CREATE INDEX idx_branches_status 
  ON branches(status);
```

### 3.3 Performance Indexes (Query-Specific)

```sql
-- For Owner dashboard: cross-branch revenue aggregation
CREATE INDEX idx_layanan_created_branch 
  ON layanan(created_at DESC, branch_id) 
  INCLUDE (nominal);

-- For service completion reports
CREATE INDEX idx_service_orders_branch_completed 
  ON service_orders(branch_id, status, completed_at DESC);

-- For inventory low-stock alerts
CREATE INDEX idx_inventory_branch_quantity 
  ON inventory(branch_id, quantity ASC) 
  WHERE quantity < 10;  -- Partial index for low stock

-- For technician workload
CREATE INDEX idx_service_orders_branch_tech_status 
  ON service_orders(branch_id, assigned_teknisi_id, status);
```

---

## Dependencies

### Prerequisites
- ✅ TASK-001 & TASK-002 completed (branch_id columns exist)
- ✅ Initial data migrated to branch (TASK-005 prereq)
- Database idle time available for index creation

### Blocks
- TASK-004 (RLS policies need indexes for performance)
- Production deployment (needs index performance validated)

---

## Implementation Checklist

### Phase 1: Preparation
- [ ] Document current table sizes and row counts
- [ ] List all current queries using branch_id (from logs)
- [ ] Create baseline performance metrics
- [ ] Schedule index creation during low-traffic window

### Phase 2: Index Creation
- [ ] Create all critical indexes (single and composite)
- [ ] Create supporting indexes (JOIN optimization)
- [ ] Create performance-specific indexes
- [ ] Monitor disk space usage during creation

### Phase 3: Validation
- [ ] Verify indexes created: `SELECT * FROM pg_indexes WHERE tablename='service_orders';`
- [ ] Run EXPLAIN ANALYZE on common queries
- [ ] Verify query plans use indexes (look for "Index Scan")
- [ ] Check for unused indexes

### Phase 4: Performance Testing
- [ ] Run baseline query suite
- [ ] Compare execution times (before vs after)
- [ ] Document performance improvements
- [ ] Update query documentation

---

## Acceptance Criteria

- [ ] All critical indexes created
- [ ] Query performance improved (or maintained)
- [ ] No index bloat
- [ ] Disk space impact acceptable
- [ ] EXPLAIN ANALYZE shows index usage
- [ ] Unused indexes identified for removal
- [ ] Documentation updated

---

## Index Strategy

### Why These Indexes?

| Index | Purpose | Example Query |
|-------|---------|---------------|
| `idx_service_orders_branch_id` | Basic branch lookup | SELECT * FROM service_orders WHERE branch_id='X' |
| `idx_service_orders_branch_status` | Filter by status + branch | SELECT * FROM service_orders WHERE branch_id='X' AND status='pending' |
| `idx_service_orders_branch_created` | Recent orders by branch | SELECT * FROM service_orders WHERE branch_id='X' ORDER BY created_at DESC LIMIT 10 |
| `idx_layanan_branch_created` | Recent transactions | SELECT * FROM layanan WHERE branch_id='X' AND created_at > NOW()-'30 days'::interval |

### Composite Index Ordering

```
Composite Index: (branch_id, status, created_at)
  ✓ Efficient for: WHERE branch_id=X AND status=Y ORDER BY created_at
  ✓ Efficient for: WHERE branch_id=X AND status=Y
  ✓ Efficient for: WHERE branch_id=X ORDER BY created_at
  ✓ Less efficient for: WHERE status=Y (no branch_id in prefix)
```

**Rule**: `branch_id` should ALWAYS be first in composite indexes.

---

## Risk Assessment

### High Risk ⚠️
- **Risk**: Index creation locks table during creation
- **Mitigation**: Use `CONCURRENTLY` option (PostgreSQL 11+)
  ```sql
  CREATE INDEX CONCURRENTLY idx_service_orders_branch_status 
    ON service_orders(branch_id, status);
  ```
- **Impact**: Slightly slower creation but no locks

### Medium Risk ⚠️
- **Risk**: Excessive indexes slow down INSERT/UPDATE
- **Mitigation**: Only create necessary indexes; remove unused ones
- **Monitoring**: Check `pg_stat_user_indexes` for unused indexes

### Low Risk ✓
- Disk space: Indexes typically 10-20% of table size
- Query plan changes: Mostly improvements

---

## Rollback Plan

```sql
-- Drop indexes if problems discovered
DROP INDEX CONCURRENTLY idx_service_orders_branch_id;
DROP INDEX CONCURRENTLY idx_service_orders_branch_status;
-- ... etc for all indexes

-- Queries will still work (slower) but functional
-- Recreate after investigation
```

---

## Testing

### Query Plan Analysis

```sql
-- Check if index is used
EXPLAIN ANALYZE
SELECT * FROM service_orders 
WHERE branch_id='jember-uuid' AND status='pending'
ORDER BY created_at DESC;

-- Expected: "Index Scan using idx_service_orders_branch_status"
-- Bad: "Seq Scan on service_orders" (index not used)
```

### Performance Benchmarks

```sql
-- Before indexes
SELECT * FROM service_orders WHERE branch_id='jember-uuid' AND status='pending';
-- Expected time: 100-500ms (depends on data size)

-- After indexes
SELECT * FROM service_orders WHERE branch_id='jember-uuid' AND status='pending';
-- Expected time: 10-50ms (5-10x faster)
```

---

## Monitoring

### Post-Deployment

```sql
-- Find unused indexes
SELECT schemaname, tablename, indexname, idx_scan 
FROM pg_stat_user_indexes 
WHERE idx_scan = 0 
ORDER BY pg_relation_size(indexrelid) DESC;

-- This shows indexes created but never used
-- Consider dropping if confirmed unused after 1-2 weeks

-- Check index size
SELECT 
  indexname,
  pg_size_pretty(pg_relation_size(indexrelname)) AS size
FROM pg_indexes
WHERE tablename = 'service_orders'
ORDER BY pg_relation_size(indexrelname) DESC;
```

---

## Success Criteria

- [x] All critical indexes created
- [x] Index usage verified via EXPLAIN ANALYZE
- [x] Query performance improved
- [x] No table locks during index creation
- [x] Unused indexes identified
- [x] Ready for production deployment

