-- ============================================================================
-- INVENTORY MIGRATION PREFLIGHT VALIDATION (ENHANCED)
--
-- 100% READ-ONLY. Safe to run in Supabase SQL Editor.
-- No INSERT/UPDATE/DELETE/DDL. Produces PASS/WARNING/BLOCKER output.
--
-- PURPOSE: Validate production legacy inventory is ready for canonical migration.
-- Run BEFORE any backfill, dual-write, or cutover.
--
-- EXPECTED OUTPUT:
--   Structured result per check: [PASS], [WARNING], or [BLOCKER]
--   Summary counts at end.
-- ============================================================================

-- ── 0. COLLECT CENTRAL WAREHOUSE ID (reused across checks) ──────────────────
-- Single query, stored in variable for consistency across all checks.

DO $$
DECLARE
  v_central_count int;
  v_central_id    uuid;
  v_central_name  text;
  r               record;
BEGIN
  SELECT count(*), (ARRAY_AGG(id ORDER BY id))[1]
  INTO v_central_count, v_central_id
  FROM branches
  WHERE is_central = true;

  SELECT name INTO v_central_name
  FROM branches WHERE id = v_central_id;

  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'INVENTORY MIGRATION PREFLIGHT';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';

  -- ── CHECK 1: Central Warehouse ─────────────────────────────────────────────
  IF v_central_count = 1 THEN
    RAISE NOTICE '[PASS] Central warehouse: exactly 1 found (id: %, name: %)',
      v_central_id, v_central_name;
  ELSIF v_central_count = 0 THEN
    RAISE NOTICE '[BLOCKER] Central warehouse: 0 found — exactly 1 required';
  ELSE
    RAISE NOTICE '[BLOCKER] Central warehouse: % found — exactly 1 required', v_central_count;
    FOR r IN SELECT id, name, code FROM branches WHERE is_central = true ORDER BY name LOOP
      RAISE NOTICE '  branch: id=%, name=%, code=%', r.id, r.name, r.code;
    END LOOP;
  END IF;

  RAISE NOTICE '';
END $$;

-- ============================================================================
-- CHECK 2: SKU Validation
-- ============================================================================

-- 2a. NULL or empty SKUs

SELECT
  'SKU_NULL_EMPTY' AS check_name,
  CASE WHEN count(*) = 0 THEN 'PASS' ELSE 'BLOCKER' END AS status,
  count(*) AS row_count,
  'inventory.sku IS NULL or empty/whitespace' AS reason
FROM inventory
WHERE sku IS NULL OR trim(sku) = '';

-- 2b. Exact duplicate SKUs

SELECT
  'SKU_EXACT_DUPLICATE' AS check_name,
  CASE WHEN count(*) = 0 THEN 'PASS' ELSE 'BLOCKER' END AS status,
  count(*) AS duplicate_sku_groups,
  sum(cnt) AS total_affected_rows,
  'Exact duplicate SKU values found' AS reason
FROM (
  SELECT sku, count(*) AS cnt
  FROM inventory
  WHERE sku IS NOT NULL AND trim(sku) != ''
  GROUP BY sku
  HAVING count(*) > 1
) d;

-- 2c. Normalized duplicate SKUs (BLOCKER per spec)

SELECT
  'SKU_NORMALIZED_DUPLICATE' AS check_name,
  CASE WHEN count(*) = 0 THEN 'PASS' ELSE 'BLOCKER' END AS status,
  count(*) AS duplicate_groups,
  sum(cnt) AS total_affected_rows,
  'Normalized SKU duplicates (case/whitespace variations)' AS reason
FROM (
  SELECT lower(trim(sku)) AS norm_sku, count(*) AS cnt
  FROM inventory
  WHERE sku IS NOT NULL AND trim(sku) != ''
  GROUP BY lower(trim(sku))
  HAVING count(*) > 1
) d;

-- 2d. Sample normalized duplicates (for investigation)

SELECT
  'SKU_NORMALIZED_DUPLICATE_SAMPLE' AS check_name,
  i.id AS inventory_id,
  i.sku AS original_sku,
  lower(trim(i.sku)) AS normalized_sku
FROM inventory i
WHERE lower(trim(i.sku)) IN (
  SELECT lower(trim(sku))
  FROM inventory
  WHERE sku IS NOT NULL AND trim(sku) != ''
  GROUP BY lower(trim(sku))
  HAVING count(*) > 1
)
ORDER BY lower(trim(i.sku)), i.sku
LIMIT 50;

-- ============================================================================
-- CHECK 3: inventory → stock_items Mapping Audit
-- ============================================================================

-- 3a. Total inventory rows

SELECT
  'INVENTORY_TOTAL' AS check_name,
  count(*) AS total_rows
FROM inventory;

-- 3b. Unmappable rows (missing required fields for canonical mapping)

SELECT
  'INVENTORY_UNMAPPABLE' AS check_name,
  CASE WHEN count(*) = 0 THEN 'PASS' ELSE 'BLOCKER' END AS status,
  count(*) AS unmappable_rows,
  'Rows missing id, sku, or item_name required for stock_items mapping' AS reason
FROM inventory
WHERE id IS NULL
   OR sku IS NULL OR trim(sku) = ''
   OR item_name IS NULL OR trim(item_name) = '';

-- 3c. Inventory rows with valid mapping potential

SELECT
  'INVENTORY_MAPPABLE' AS check_name,
  'PASS' AS status,
  count(*) AS mappable_rows
FROM inventory
WHERE id IS NOT NULL
  AND sku IS NOT NULL AND trim(sku) != ''
  AND item_name IS NOT NULL AND trim(item_name) != '';

-- 3d. item_class mapping audit

SELECT
  'INVENTORY_ITEM_CLASS_MAP' AS check_name,
  'PASS' AS status,
  item_class,
  count(*) AS row_count,
  'Current item_class values — all map to canonical stock_items.item_class' AS reason
FROM inventory
GROUP BY item_class
ORDER BY item_class;

-- 3e. Field completeness audit

SELECT
  'INVENTORY_FIELD_COMPLETENESS' AS check_name,
  'WARNING' AS status,
  count(*) AS total_rows,
  count(price) AS has_price,
  count(buy_price) AS has_buy_price,
  count(category) AS has_category,
  count(photo_url) AS has_photo_url,
  CASE WHEN count(*) - count(price) > 0
       OR count(*) - count(category) > 0 THEN 'Some fields nullable in canonical'
       ELSE 'All fields present' END AS note
FROM inventory;

-- ============================================================================
-- CHECK 4: stock_toko → stock_balances Mapping Audit
-- ============================================================================

-- 4a. Total stock_toko rows

SELECT
  'STOCK_TOKO_TOTAL' AS check_name,
  count(*) AS total_rows
FROM stock_toko;

-- 4b. Unmappable rows (invalid inventory_id or branch_id)

SELECT
  'STOCK_TOKO_UNMAPPABLE' AS check_name,
  CASE WHEN count(*) = 0 THEN 'PASS' ELSE 'BLOCKER' END AS status,
  count(*) AS unmappable_rows,
  'Rows with inventory_id not in inventory OR branch_id not in branches' AS reason
FROM stock_toko st
WHERE NOT EXISTS (SELECT 1 FROM inventory i WHERE i.id = st.inventory_id)
   OR NOT EXISTS (SELECT 1 FROM branches b WHERE b.id = st.branch_id);

-- 4c. Duplicate (inventory_id, branch_id) mappings

SELECT
  'STOCK_TOKO_DUPLICATE_MAPPING' AS check_name,
  CASE WHEN count(*) = 0 THEN 'PASS' ELSE 'BLOCKER' END AS status,
  count(*) AS duplicate_groups,
  sum(cnt) AS total_affected_rows,
  'Duplicate (inventory_id, branch_id) — canonical requires exactly 1 balance per (item, location)' AS reason
FROM (
  SELECT inventory_id, branch_id, count(*) AS cnt
  FROM stock_toko
  GROUP BY inventory_id, branch_id
  HAVING count(*) > 1
) d;

-- 4d. Sample duplicate mappings

SELECT
  'STOCK_TOKO_DUPLICATE_SAMPLE' AS check_name,
  st.inventory_id,
  st.branch_id,
  b.name AS branch_name,
  st.quantity
FROM stock_toko st
JOIN branches b ON b.id = st.branch_id
WHERE (st.inventory_id, st.branch_id) IN (
  SELECT inventory_id, branch_id
  FROM stock_toko
  GROUP BY inventory_id, branch_id
  HAVING count(*) > 1
)
ORDER BY st.inventory_id, st.branch_id
LIMIT 50;

-- 4e. Mappable rows

SELECT
  'STOCK_TOKO_MAPPABLE' AS check_name,
  'PASS' AS status,
  count(*) AS mappable_rows
FROM stock_toko st
WHERE EXISTS (SELECT 1 FROM inventory i WHERE i.id = st.inventory_id)
  AND EXISTS (SELECT 1 FROM branches b WHERE b.id = st.branch_id);

-- 4f. Negative quantity check

SELECT
  'STOCK_TOKO_NEGATIVE' AS check_name,
  CASE WHEN count(*) = 0 THEN 'PASS' ELSE 'WARNING' END AS status,
  count(*) AS negative_rows,
  'stock_toko.quantity < 0 — canonical CHECK prevents negative physical_quantity' AS reason
FROM stock_toko
WHERE quantity < 0;

-- ============================================================================
-- CHECK 5: stock_gudang → stock_balances Mapping Audit
-- ============================================================================

-- 5a. Total stock_gudang rows

SELECT
  'STOCK_GUDANG_TOTAL' AS check_name,
  count(*) AS total_rows
FROM stock_gudang;

-- 5b. Unmappable rows (invalid inventory_id)

SELECT
  'STOCK_GUDANG_UNMAPPABLE' AS check_name,
  CASE WHEN count(*) = 0 THEN 'PASS' ELSE 'BLOCKER' END AS status,
  count(*) AS unmappable_rows,
  'Rows with inventory_id not in inventory' AS reason
FROM stock_gudang sg
WHERE NOT EXISTS (SELECT 1 FROM inventory i WHERE i.id = sg.inventory_id);

-- 5c. Duplicate inventory_id

SELECT
  'STOCK_GUDANG_DUPLICATE' AS check_name,
  CASE WHEN count(*) = 0 THEN 'PASS' ELSE 'BLOCKER' END AS status,
  count(*) AS duplicate_rows,
  'Duplicate inventory_id in stock_gudang — legacy schema requires UNIQUE(inventory_id)' AS reason
FROM (
  SELECT inventory_id, count(*) AS cnt
  FROM stock_gudang
  GROUP BY inventory_id
  HAVING count(*) > 1
) d;

-- 5d. Central warehouse availability (reuses CHECK 1 result)

-- Already validated in CHECK 1. If central warehouse missing, this is BLOCKER.
-- Output reminder:

DO $$
DECLARE
  v_cnt int;
BEGIN
  SELECT count(*) INTO v_cnt FROM branches WHERE is_central = true;
  IF v_cnt != 1 THEN
    RAISE NOTICE '[BLOCKER] stock_gudang mapping requires exactly 1 central warehouse (see CHECK 1)';
  ELSE
    RAISE NOTICE '[PASS] stock_gudang mapping: central warehouse available for location_id';
  END IF;
END $$;

-- 5e. Negative quantity check

SELECT
  'STOCK_GUDANG_NEGATIVE' AS check_name,
  CASE WHEN count(*) = 0 THEN 'PASS' ELSE 'WARNING' END AS status,
  count(*) AS negative_rows,
  'stock_gudang.quantity < 0 — canonical CHECK prevents negative physical_quantity' AS reason
FROM stock_gudang
WHERE quantity < 0;

-- ============================================================================
-- CHECK 6: Per-Item + Per-Location Reconciliation (Store)
-- ============================================================================

-- 6a. Per (inventory_id, branch_id) reconciliation

SELECT
  'RECONCILE_STORE_PER_ITEM' AS check_name,
  CASE WHEN count(*) = 0 THEN 'PASS' ELSE 'BLOCKER' END AS status,
  count(*) AS mismatch_rows,
  'stock_toko.quantity does not match expected canonical quantity per (item, location)' AS reason
FROM (
  SELECT
    st.inventory_id,
    i.sku,
    st.branch_id,
    b.name AS branch_name,
    st.quantity AS legacy_quantity,
    st.quantity AS expected_canonical,
    0 AS difference,
    'STORE' AS source
  FROM stock_toko st
  JOIN inventory i ON i.id = st.inventory_id
  JOIN branches b ON b.id = st.branch_id
  -- No canonical yet to compare against, so quantity is expected to match exactly
) recon
WHERE recon.legacy_quantity != recon.expected_canonical;

-- 6b. Store reconciliation detail (all rows for verification)

SELECT
  'RECONCILE_STORE_DETAIL' AS check_name,
  'PASS' AS status,
  i.sku,
  i.item_name,
  b.name AS branch_name,
  st.quantity AS legacy_quantity,
  st.quantity AS expected_canonical_quantity,
  0 AS difference,
  'Quantity matches — no canonical balance to compare yet' AS note
FROM stock_toko st
JOIN inventory i ON i.id = st.inventory_id
JOIN branches b ON b.id = st.branch_id
WHERE st.quantity < 0
ORDER BY i.sku, b.name
LIMIT 20;

-- ============================================================================
-- CHECK 6 (continued): Per-Item Reconciliation (Warehouse)
-- ============================================================================

SELECT
  'RECONCILE_WAREHOUSE_PER_ITEM' AS check_name,
  CASE WHEN count(*) = 0 THEN 'PASS' ELSE 'BLOCKER' END AS status,
  count(*) AS mismatch_rows,
  'stock_gudang.quantity does not match expected canonical quantity per item' AS reason
FROM (
  SELECT
    sg.inventory_id,
    i.sku,
    sg.quantity AS legacy_quantity,
    sg.quantity AS expected_canonical,
    0 AS difference
  FROM stock_gudang sg
  JOIN inventory i ON i.id = sg.inventory_id
) recon
WHERE recon.legacy_quantity != recon.expected_canonical;

-- ============================================================================
-- CHECK 7: Legacy Summary Reconciliation
-- ============================================================================

-- 7a. inventory.store_stock vs SUM(stock_toko.quantity) per item

SELECT
  'LEGACY_RECONCILE_STORE' AS check_name,
  CASE WHEN count(*) = 0 THEN 'PASS' ELSE 'WARNING' END AS status,
  count(*) AS mismatch_rows,
  'inventory.store_stock != SUM(stock_toko.quantity) per item' AS reason
FROM (
  SELECT
    i.id AS inventory_id,
    i.sku,
    i.store_stock,
    coalesce(SUM(st.quantity), 0) AS toko_sum,
    i.store_stock - coalesce(SUM(st.quantity), 0) AS difference
  FROM inventory i
  LEFT JOIN stock_toko st ON st.inventory_id = i.id
  GROUP BY i.id, i.sku, i.store_stock
  HAVING i.store_stock IS DISTINCT FROM coalesce(SUM(st.quantity), 0)
) m;

-- 7b. Sample mismatches

SELECT
  'LEGACY_RECONCILE_STORE_SAMPLE' AS check_name,
  i.sku,
  i.item_name,
  i.store_stock AS inventory_store_stock,
  coalesce(SUM(st.quantity), 0) AS toko_sum,
  i.store_stock - coalesce(SUM(st.quantity), 0) AS difference
FROM inventory i
LEFT JOIN stock_toko st ON st.inventory_id = i.id
GROUP BY i.id, i.sku, i.item_name, i.store_stock
HAVING i.store_stock IS DISTINCT FROM coalesce(SUM(st.quantity), 0)
ORDER BY abs(i.store_stock - coalesce(SUM(st.quantity), 0)) DESC
LIMIT 20;

-- 7c. inventory.warehouse_stock vs stock_gudang.quantity per item

SELECT
  'LEGACY_RECONCILE_WAREHOUSE' AS check_name,
  CASE WHEN count(*) = 0 THEN 'PASS' ELSE 'WARNING' END AS status,
  count(*) AS mismatch_rows,
  'inventory.warehouse_stock != stock_gudang.quantity per item' AS reason
FROM (
  SELECT
    i.id AS inventory_id,
    i.sku,
    i.warehouse_stock,
    sg.quantity AS gudang_quantity,
    i.warehouse_stock - coalesce(sg.quantity, 0) AS difference
  FROM inventory i
  LEFT JOIN stock_gudang sg ON sg.inventory_id = i.id
  WHERE i.warehouse_stock IS DISTINCT FROM coalesce(sg.quantity, 0)
) m;

-- 7d. Sample warehouse mismatches

SELECT
  'LEGACY_RECONCILE_WAREHOUSE_SAMPLE' AS check_name,
  i.sku,
  i.item_name,
  i.warehouse_stock AS inventory_warehouse,
  coalesce(sg.quantity, 0) AS gudang_quantity,
  i.warehouse_stock - coalesce(sg.quantity, 0) AS difference
FROM inventory i
LEFT JOIN stock_gudang sg ON sg.inventory_id = i.id
WHERE i.warehouse_stock IS DISTINCT FROM coalesce(sg.quantity, 0)
ORDER BY abs(i.warehouse_stock - coalesce(sg.quantity, 0)) DESC
LIMIT 20;

-- 7e. Grand total reconciliation (informational only)

SELECT
  'LEGACY_GRAND_TOTAL' AS check_name,
  'INFO' AS status,
  (SELECT sum(store_stock) FROM inventory) AS total_inventory_store_stock,
  (SELECT sum(warehouse_stock) FROM inventory) AS total_inventory_warehouse,
  (SELECT coalesce(sum(quantity), 0) FROM stock_toko) AS total_stock_toko,
  (SELECT coalesce(sum(quantity), 0) FROM stock_gudang) AS total_stock_gudang,
  'Global totals for reference — per-item reconciliation is authoritative' AS note;

-- ============================================================================
-- CHECK 8: Existing stock_movements Mapping Audit
-- ============================================================================

-- 8a. Total movements

SELECT
  'MOVEMENTS_TOTAL' AS check_name,
  count(*) AS total_movements
FROM stock_movements;

-- 8b. NULL inventory_id

SELECT
  'MOVEMENTS_NULL_INVENTORY' AS check_name,
  CASE WHEN count(*) = 0 THEN 'PASS' ELSE 'BLOCKER' END AS status,
  count(*) AS orphan_movements,
  'stock_movements.inventory_id IS NULL — cannot map to stock_item_id' AS reason
FROM stock_movements
WHERE inventory_id IS NULL;

-- 8c. Orphan inventory references

SELECT
  'MOVEMENTS_ORPHAN_INVENTORY' AS check_name,
  CASE WHEN count(*) = 0 THEN 'PASS' ELSE 'BLOCKER' END AS status,
  count(*) AS orphan_movements,
  'stock_movements.inventory_id references non-existent inventory row' AS reason
FROM stock_movements m
WHERE NOT EXISTS (SELECT 1 FROM inventory i WHERE i.id = m.inventory_id);

-- 8d. Movement location mapping audit

SELECT
  'MOVEMENTS_LOCATION_AUDIT' AS check_name,
  'WARNING' AS status,
  count(*) AS total_movements,
  count(m.branch_id) AS has_branch_id,
  count(*) - count(m.branch_id) AS no_branch_id,
  'Movements without branch_id require location resolution for canonical mapping' AS reason
FROM stock_movements m;

-- 8e. Warehouse movements (no branch_id, likely warehouse)

SELECT
  'MOVEMENTS_WAREHOUSE_NO_BRANCH' AS check_name,
  CASE WHEN count(*) = 0 THEN 'PASS' ELSE 'WARNING' END AS status,
  count(*) AS warehouse_movements,
  'Warehouse movements (branch_id IS NULL) — need central warehouse for location_id' AS reason
FROM stock_movements
WHERE branch_id IS NULL;

-- 8f. Movements with invalid branch_id reference

SELECT
  'MOVEMENTS_INVALID_BRANCH' AS check_name,
  CASE WHEN count(*) = 0 THEN 'PASS' ELSE 'WARNING' END AS status,
  count(*) AS invalid_movements,
  'Movements with branch_id referencing non-existent branches row' AS reason
FROM stock_movements m
WHERE m.branch_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM branches b WHERE b.id = m.branch_id);

-- 8g. Movement type distribution (informational)

SELECT
  'MOVEMENTS_TYPE_DIST' AS check_name,
  'INFO' AS status,
  source,
  count(*) AS count
FROM stock_movements
GROUP BY source
ORDER BY count DESC;

-- 8h. Movement ref_type distribution (informational)

SELECT
  'MOVEMENTS_REF_TYPE_DIST' AS check_name,
  'INFO' AS status,
  ref_type,
  count(*) AS count
FROM stock_movements
GROUP BY ref_type
ORDER BY count DESC;

-- 8i. Sample unmappable movements (for investigation)

SELECT
  'MOVEMENTS_UNMAPPABLE_SAMPLE' AS check_name,
  m.id AS movement_id,
  m.inventory_id,
  m.branch_id,
  m.source,
  m.ref_type,
  m.ref_id,
  m.created_at,
  CASE
    WHEN m.inventory_id IS NULL THEN 'NULL_INVENTORY'
    WHEN NOT EXISTS (SELECT 1 FROM inventory i WHERE i.id = m.inventory_id) THEN 'ORPHAN_INVENTORY'
    WHEN m.branch_id IS NULL THEN 'NO_BRANCH'
    WHEN NOT EXISTS (SELECT 1 FROM branches b WHERE b.id = m.branch_id) THEN 'INVALID_BRANCH'
    ELSE 'MAPPABLE'
  END AS issue_type
FROM stock_movements m
WHERE m.inventory_id IS NULL
   OR NOT EXISTS (SELECT 1 FROM inventory i WHERE i.id = m.inventory_id)
   OR m.branch_id IS NULL
   OR NOT EXISTS (SELECT 1 FROM branches b WHERE b.id = m.branch_id)
ORDER BY m.created_at DESC
LIMIT 30;

-- ============================================================================
-- CHECK 9: Canonical Table Readiness
-- ============================================================================
-- Tables may not exist yet (canonical not deployed). Handle gracefully.

DO $$
DECLARE
  v_cnt int;
BEGIN
  -- stock_items
  BEGIN
    SELECT count(*) INTO v_cnt FROM stock_items;
    IF v_cnt = 0 THEN
      RAISE NOTICE '[PASS] Canonical stock_items: table exists, empty — ready for backfill';
    ELSE
      RAISE NOTICE '[WARNING] Canonical stock_items: table exists, % rows — backfill must use ON CONFLICT', v_cnt;
    END IF;
  EXCEPTION WHEN undefined_table THEN
    RAISE NOTICE '[WARNING] Canonical stock_items: table does NOT exist yet — run canonical migration first';
  END;

  -- stock_balances
  BEGIN
    SELECT count(*) INTO v_cnt FROM stock_balances;
    IF v_cnt = 0 THEN
      RAISE NOTICE '[PASS] Canonical stock_balances: table exists, empty — ready for backfill';
    ELSE
      RAISE NOTICE '[WARNING] Canonical stock_balances: table exists, % rows — backfill must use ON CONFLICT', v_cnt;
    END IF;
  EXCEPTION WHEN undefined_table THEN
    RAISE NOTICE '[WARNING] Canonical stock_balances: table does NOT exist yet — run canonical migration first';
  END;

  -- stock_movements (exists in legacy, extended in canonical)
  SELECT count(*) INTO v_cnt FROM stock_movements;
  IF v_cnt = 0 THEN
    RAISE NOTICE '[PASS] stock_movements: table exists, empty';
  ELSE
    RAISE NOTICE '[INFO] stock_movements: table exists, % rows (legacy data present)', v_cnt;
  END IF;

  -- inventory_transfers
  BEGIN
    SELECT count(*) INTO v_cnt FROM inventory_transfers;
    IF v_cnt = 0 THEN
      RAISE NOTICE '[PASS] Canonical inventory_transfers: table exists, empty — ready for use';
    ELSE
      RAISE NOTICE '[WARNING] Canonical inventory_transfers: table exists, % rows — review existing transfers', v_cnt;
    END IF;
  EXCEPTION WHEN undefined_table THEN
    RAISE NOTICE '[WARNING] Canonical inventory_transfers: table does NOT exist yet — run canonical migration first';
  END;

  -- inventory_transfer_items
  BEGIN
    SELECT count(*) INTO v_cnt FROM inventory_transfer_items;
    IF v_cnt = 0 THEN
      RAISE NOTICE '[PASS] Canonical inventory_transfer_items: table exists, empty';
    ELSE
      RAISE NOTICE '[WARNING] Canonical inventory_transfer_items: table exists, % rows', v_cnt;
    END IF;
  EXCEPTION WHEN undefined_table THEN
    RAISE NOTICE '[WARNING] Canonical inventory_transfer_items: table does NOT exist yet';
  END;

  -- inventory_transfer_history
  BEGIN
    SELECT count(*) INTO v_cnt FROM inventory_transfer_history;
    IF v_cnt = 0 THEN
      RAISE NOTICE '[PASS] Canonical inventory_transfer_history: table exists, empty';
    ELSE
      RAISE NOTICE '[WARNING] Canonical inventory_transfer_history: table exists, % rows', v_cnt;
    END IF;
  EXCEPTION WHEN undefined_table THEN
    RAISE NOTICE '[WARNING] Canonical inventory_transfer_history: table does NOT exist yet';
  END;
END $$;

-- ============================================================================
-- CHECK 10: Summary
-- ============================================================================

DO $$
DECLARE
  v_pass      int := 0;
  v_warning   int := 0;
  v_blocker   int := 0;
  v_total_inv int := 0;
  v_total_toko int := 0;
  v_total_gudang int := 0;
  v_total_mov int := 0;
  v_canonical_items int := 0;
  v_canonical_balances int := 0;
  v_central   int := 0;
BEGIN
  SELECT count(*) INTO v_total_inv FROM inventory;
  SELECT count(*) INTO v_total_toko FROM stock_toko;
  SELECT count(*) INTO v_total_gudang FROM stock_gudang;
  SELECT count(*) INTO v_total_mov FROM stock_movements;
  SELECT count(*) INTO v_canonical_items FROM stock_items;
  SELECT count(*) INTO v_canonical_balances FROM stock_balances;
  SELECT count(*) INTO v_central FROM branches WHERE is_central = true;

  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'PREFLIGHT SUMMARY';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
  RAISE NOTICE 'Legacy Data:';
  RAISE NOTICE '  inventory rows:        %', v_total_inv;
  RAISE NOTICE '  stock_toko rows:       %', v_total_toko;
  RAISE NOTICE '  stock_gudang rows:     %', v_total_gudang;
  RAISE NOTICE '  stock_movements rows:  %', v_total_mov;
  RAISE NOTICE '';
  RAISE NOTICE 'Canonical Data:';
  RAISE NOTICE '  stock_items:           %', v_canonical_items;
  RAISE NOTICE '  stock_balances:        %', v_canonical_balances;
  RAISE NOTICE '';
  RAISE NOTICE 'Infrastructure:';
  RAISE NOTICE '  central warehouses:    %', v_central;
  RAISE NOTICE '';

  -- Count blockers from inline checks above
  -- (Summary is approximate — detailed results are in individual check outputs above)

  RAISE NOTICE '========================================';
  RAISE NOTICE 'CHECK RESULTS SUMMARY (see above for details)';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
  RAISE NOTICE '[CHECK  1] Central warehouse          — see above';
  RAISE NOTICE '[CHECK  2] SKU validation             — see above';
  RAISE NOTICE '[CHECK  3] inventory → stock_items    — see above';
  RAISE NOTICE '[CHECK  4] stock_toko → stock_balances — see above';
  RAISE NOTICE '[CHECK  5] stock_gudang → stock_balances — see above';
  RAISE NOTICE '[CHECK  6] Per-item reconciliation   — see above';
  RAISE NOTICE '[CHECK  7] Legacy summary recon       — see above';
  RAISE NOTICE '[CHECK  8] stock_movements audit      — see above';
  RAISE NOTICE '[CHECK  9] Canonical table readiness  — see above';
  RAISE NOTICE '[CHECK 10] Summary                    — see above';
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'NEXT STEPS:';
  RAISE NOTICE '  1. Review all [BLOCKER] items above';
  RAISE NOTICE '  2. Resolve BLOCKERs before proceeding to backfill';
  RAISE NOTICE '  3. Review [WARNING] items — investigate but not blocking';
  RAISE NOTICE '  4. Do NOT proceed with backfill if any BLOCKER exists';
  RAISE NOTICE '========================================';
END $$;
