-- ============================================================================
-- INVENTORY CANONICAL FOUNDATION V2 (T001)
--
-- Creates the target inventory domain schema:
--   stock_items       -> global catalog (within single business)
--   stock_balances    -> quantity per location
--
-- REUSES existing tables:
--   branches          -> locations (already exists, DO NOT MODIFY)
--   stock_movements   -> audit ledger (extended in T002)
--
-- LEGACY tables preserved for compatibility:
--   inventory, stock_toko, stock_gudang -> NOT dropped, NOT migrated
--   Existing RPCs and frontend code continue to work unchanged.
--
-- ARCHITECTURE RULE:
--   stock_items  = catalog only (NO quantity columns)
--   stock_balances = ALL quantities (per location)
--   stock_movements = immutable audit ledger
--   Physical stock must never be negative.
--
-- UUID STRATEGY:
--   stock_items.id = inventory.id (reused, not duplicated)
--   This preserves historical stock movement traceability.
--
-- SINGLE BUSINESS:
--   Arlogic is single-business. SKU is globally unique.
--   No business_id or tenant_id required for V1.
--
-- LOCATION MODEL:
--   Warehouse = branches.is_central = true (exactly one)
--   Store/Branch = branches.is_central = false
--   Partial unique index enforces single warehouse.
-- =============================================================================

-- ── 1. STOCK ITEMS ──────────────────────────────────────────────────────────
-- Global catalog within single business.
-- NOT tied to any location. Quantity lives in stock_balances.
-- UUID reuses inventory.id for migration simplicity.

CREATE TABLE IF NOT EXISTS public.stock_items (
  id                      uuid PRIMARY KEY,
  name                    text NOT NULL,
  sku                     text NOT NULL UNIQUE,
  item_class              text NOT NULL DEFAULT 'sparepart'
                            CHECK (item_class IN ('sparepart', 'jam')),
  unit                    text NOT NULL DEFAULT 'pcs',
  category                text,
  default_minimum_stock   int4 NOT NULL DEFAULT 0,
  sell_price              numeric DEFAULT 0,
  buy_price               numeric DEFAULT 0,
  photo_url               text,
  compatible_brands       _text,
  compatible_models       _text,
  is_active               boolean NOT NULL DEFAULT true,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.stock_items IS 'Global item catalog (single business). Quantity NOT stored here — use stock_balances.';
COMMENT ON COLUMN public.stock_items.sku IS 'Stock Keeping Unit. Globally unique within single business. UNIQUE constraint (no redundant index).';
COMMENT ON COLUMN public.stock_items.item_class IS 'Classification: sparepart (used in service) or jam (watch transactions)';
COMMENT ON COLUMN public.stock_items.default_minimum_stock IS 'Default minimum stock. Overridden by stock_balances.minimum_stock per location.';
COMMENT ON COLUMN public.stock_items.is_active IS 'Soft delete. false = hidden from UI.';

CREATE INDEX IF NOT EXISTS idx_stock_items_category ON public.stock_items (category);
CREATE INDEX IF NOT EXISTS idx_stock_items_item_class ON public.stock_items (item_class);
CREATE INDEX IF NOT EXISTS idx_stock_items_name ON public.stock_items (name);

-- ── 2. STOCK BALANCES ───────────────────────────────────────────────────────
-- Per-location quantity. One balance per stock_item per location.
-- available_quantity = physical_quantity - reserved_quantity (computed, not stored).

CREATE TABLE IF NOT EXISTS public.stock_balances (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stock_item_id       uuid NOT NULL REFERENCES public.stock_items(id) ON DELETE RESTRICT,
  location_id         uuid NOT NULL REFERENCES public.branches(id) ON DELETE RESTRICT,
  physical_quantity   int4 NOT NULL DEFAULT 0,
  reserved_quantity   int4 NOT NULL DEFAULT 0,
  minimum_stock       int4,  -- NULL = use stock_items.default_minimum_stock
  updated_at          timestamptz NOT NULL DEFAULT now(),

  -- One balance per item per location
  UNIQUE (stock_item_id, location_id),

  -- Quantities cannot be negative
  CHECK (physical_quantity >= 0),
  CHECK (reserved_quantity >= 0),
  CHECK (reserved_quantity <= physical_quantity)
);

COMMENT ON TABLE public.stock_balances IS 'Per-location stock quantities. One row per stock_item per branch.';
COMMENT ON COLUMN public.stock_balances.physical_quantity IS 'Actual physical count. Never negative.';
COMMENT ON COLUMN public.stock_balances.reserved_quantity IS 'Reserved for pending transfers. Must not exceed physical_quantity.';
COMMENT ON COLUMN public.stock_balances.minimum_stock IS 'Per-location override. NULL = use stock_items.default_minimum_stock.';

CREATE INDEX IF NOT EXISTS idx_stock_balances_item ON public.stock_balances (stock_item_id);
CREATE INDEX IF NOT EXISTS idx_stock_balances_location ON public.stock_balances (location_id);

-- ── 3. WAREHOUSE CONSTRAINT ─────────────────────────────────────────────────
-- NOTE: This MODIFIES the existing `branches` table (adds partial unique index).
-- The index guarantees AT MOST ONE central warehouse (is_central = true).
-- It does NOT guarantee EXACTLY ONE — that is validated at preflight/deploy time.
--
-- Preflight requirement: SELECT count(*) FROM branches WHERE is_central = true
--   must return exactly 1. Canonical migration must FAIL preflight if:
--     - zero central warehouses exist
--     - more than one central warehouse exists

CREATE UNIQUE INDEX IF NOT EXISTS uq_branches_one_central
  ON public.branches ((is_central))
  WHERE is_central = true;

-- ── 4. RLS ──────────────────────────────────────────────────────────────────
-- Uses existing authorization helpers:
--   auth_profile_role()        -> user role text
--   auth_branch_id()           -> user branch uuid
--   auth_can_manage_all_stocks() -> owner or admin_gudang
--
-- Access boundary:
--   stock_items:        read = all authenticated, write = management
--   stock_balances:     read = management + own branch, write = via RPC only

-- ── stock_items RLS ─────────────────────────────────────────────────────────
ALTER TABLE public.stock_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY stock_items_select_authenticated
  ON public.stock_items FOR SELECT TO authenticated
  USING (true);

CREATE POLICY stock_items_insert_management
  ON public.stock_items FOR INSERT TO authenticated
  WITH CHECK (public.auth_can_manage_all_stocks());

CREATE POLICY stock_items_update_management
  ON public.stock_items FOR UPDATE TO authenticated
  USING (public.auth_can_manage_all_stocks())
  WITH CHECK (public.auth_can_manage_all_stocks());

CREATE POLICY stock_items_delete_management
  ON public.stock_items FOR DELETE TO authenticated
  USING (public.auth_can_manage_all_stocks());

-- ── stock_balances RLS ──────────────────────────────────────────────────────
-- Write denied to client-side (default deny). Only via RPC/security definer.

ALTER TABLE public.stock_balances ENABLE ROW LEVEL SECURITY;

CREATE POLICY stock_balances_select_management
  ON public.stock_balances FOR SELECT TO authenticated
  USING (
    public.auth_can_manage_all_stocks()
    OR public.auth_profile_role() IN ('engineer', 'supervisor')
    OR location_id = public.auth_branch_id()
  );

-- No insert/update/delete policies = deny direct writes (RPC only)

-- ============================================================================
-- MIGRATION NOTES
-- ============================================================================
-- 1. stock_items.id reuses inventory.id (same UUID, no mapping needed)
-- 2. Legacy tables (inventory, stock_toko, stock_gudang) are NOT modified.
-- 3. Existing RPCs (adjust_store_stock, adjust_warehouse_stock) are NOT modified.
-- 4. No data migration in this phase. Tables created empty.
-- 5. branches table IS modified: partial unique index on is_central=true added.
--    Preflight: exactly one row with is_central=true required before cutover.
-- 6. stock_balances FKs use ON DELETE RESTRICT (not CASCADE).
--    Use is_active for soft-deactivation; never silently delete balances.
-- 7. SKU has UNIQUE constraint only (no redundant normal index).
-- 8. reserved_quantity logic created in T002 (must be atomic).
-- 9. Category is text (not FK) for legacy compatibility.
-- =============================================================================