-- ============================================================================
-- T004 PREFLIGHT VALIDATION
--
-- Run this script BEFORE migration to identify blockers.
-- Execute in Supabase SQL Editor and review results.
--
-- EXPECTED OUTPUT:
--   - Category mapping requirements
--   - SKU conflicts or issues
--   - Warehouse location status
--   - Quantity reconciliation mismatches
--   - Duplicate stock_toko entries
--   - Canonical table counts
-- =============================================================================

-- ── 1. CATEGORY MAPPING ──────────────────────────────────────────────────────
-- Find all unique categories in legacy inventory

SELECT
  'LEGACY_CATEGORIES' AS query_name,
  category,
  COUNT(*) AS item_count
FROM inventory
WHERE category IS NOT NULL AND category != ''
GROUP BY category
ORDER BY category;

-- ── 2. EXISTING CATEGORIES ───────────────────────────────────────────────────
-- Find all existing categories in canonical table

SELECT
  'EXISTING_CATEGORIES' AS query_name,
  id,
  name
FROM categories
ORDER BY name;

-- ── 3. SKU VALIDATION ────────────────────────────────────────────────────────
-- Check for duplicate SKUs

SELECT
  'DUPLICATE_SKUS' AS query_name,
  sku,
  COUNT(*) AS duplicate_count
FROM inventory
WHERE sku IS NOT NULL AND sku != ''
GROUP BY sku
HAVING COUNT(*) > 1;

-- Check for NULL/empty SKUs

SELECT
  'NULL_EMPTY_SKUS' AS query_name,
  COUNT(*) AS count
FROM inventory
WHERE sku IS NULL OR TRIM(sku) = '';

-- ── 4. WAREHOUSE LOCATION ────────────────────────────────────────────────────
-- Check branches.is_central

SELECT
  'WAREHOUSE_BRANCHES' AS query_name,
  id,
  name,
  code,
  is_central
FROM branches
WHERE is_central = true;

-- Count central branches

SELECT
  'CENTRAL_BRANCH_COUNT' AS query_name,
  COUNT(*) AS count
FROM branches
WHERE is_central = true;

-- ── 5. QUANTITY RECONCILIATION ────────────────────────────────────────────────
-- Store stock: inventory.store_stock vs SUM(stock_toko.quantity)

SELECT
  'STORE_STOCK_MISMATCH' AS query_name,
  i.id AS inventory_id,
  i.sku,
  i.item_name,
  i.store_stock AS inventory_store,
  COALESCE(SUM(st.quantity), 0) AS toko_sum,
  i.store_stock - COALESCE(SUM(st.quantity), 0) AS difference
FROM inventory i
LEFT JOIN stock_toko st ON st.inventory_id = i.id
GROUP BY i.id, i.sku, i.item_name, i.store_stock
HAVING i.store_stock IS DISTINCT FROM COALESCE(SUM(st.quantity), 0)
LIMIT 50;

-- Warehouse stock: inventory.warehouse_stock vs stock_gudang.quantity

SELECT
  'WAREHOUSE_STOCK_MISMATCH' AS query_name,
  i.id AS inventory_id,
  i.sku,
  i.item_name,
  i.warehouse_stock AS inventory_warehouse,
  sg.quantity AS gudang_quantity,
  i.warehouse_stock - COALESCE(sg.quantity, 0) AS difference
FROM inventory i
LEFT JOIN stock_gudang sg ON sg.inventory_id = i.id
WHERE i.warehouse_stock IS DISTINCT FROM COALESCE(sg.quantity, 0)
LIMIT 50;

-- ── 6. STOCK TOKO DUPLICATES ─────────────────────────────────────────────────
-- Check for duplicate (inventory_id, branch_id) in stock_toko

SELECT
  'STOCK_TOKO_DUPLICATES' AS query_name,
  inventory_id,
  branch_id,
  COUNT(*) AS duplicate_count
FROM stock_toko
GROUP BY inventory_id, branch_id
HAVING COUNT(*) > 1;

-- ── 7. CANONICAL TABLE COUNTS ────────────────────────────────────────────────
-- Check if canonical tables already have data

SELECT
  'CANONICAL_COUNTS' AS query_name,
  (SELECT COUNT(*) FROM stock_items) AS stock_items_count,
  (SELECT COUNT(*) FROM stock_balances) AS stock_balances_count,
  (SELECT COUNT(*) FROM stock_movements) AS stock_movements_count;

-- ── 8. LEGACY TABLE COUNTS ───────────────────────────────────────────────────
-- Legacy counts for comparison

SELECT
  'LEGACY_COUNTS' AS query_name,
  (SELECT COUNT(*) FROM inventory) AS inventory_count,
  (SELECT COUNT(*) FROM stock_toko) AS stock_toko_count,
  (SELECT COUNT(*) FROM stock_gudang) AS stock_gudang_count;

-- ── 9. INVENTORY WITHOUT STOCK_TOKO ──────────────────────────────────────────
-- Items in inventory but no stock_toko entry

SELECT
  'INVENTORY_NO_TOKO' AS query_name,
  COUNT(*) AS count
FROM inventory i
WHERE NOT EXISTS (
  SELECT 1 FROM stock_toko st WHERE st.inventory_id = i.id
);

-- ── 10. STOCK_TOKO WITHOUT INVENTORY ─────────────────────────────────────────
-- Orphan stock_toko entries

SELECT
  'TOKO_ORPHANS' AS query_name,
  COUNT(*) AS count
FROM stock_toko st
WHERE NOT EXISTS (
  SELECT 1 FROM inventory i WHERE i.id = st.inventory_id
);

-- ── 11. STOCK_GUDANG WITHOUT INVENTORY ───────────────────────────────────────
-- Orphan stock_gudang entries

SELECT
  'GUDANG_ORPHANS' AS query_name,
  COUNT(*) AS count
FROM stock_gudang sg
WHERE NOT EXISTS (
  SELECT 1 FROM inventory i WHERE i.id = sg.inventory_id
);

-- ============================================================================
-- MIGRATION BLOCKER SUMMARY
-- ============================================================================
-- If any of these return unexpected results, migration is BLOCKED:
--
-- 1. CENTRAL_BRANCH_COUNT != 1 → Warehouse location unknown
-- 2. DUPLICATE_SKUS has rows → SKU conflicts
-- 3. NULL_EMPTY_SKUS > 0 → Missing required SKUs
-- 4. STORE_STOCK_MISMATCH has rows → Quantity mismatch
-- 5. WAREHOUSE_STOCK_MISMATCH has rows → Quantity mismatch
-- 6. STOCK_TOKO_DUPLICATES has rows → Duplicate balances
-- 7. CANONICAL_COUNTS.stock_items_count > 0 → Already migrated
-- ============================================================================
