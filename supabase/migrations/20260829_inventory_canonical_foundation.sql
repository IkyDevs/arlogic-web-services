-- ============================================================================
-- INVENTORY CANONICAL FOUNDATION (T001)
--
-- Creates the target inventory domain schema:
--   stock_items       -> global catalog (within single business)
--   stock_balances    -> quantity per location
--   stock_units       -> individual serial-tracked physical units
--   stock_item_suppliers -> many-to-many: Stock Item <-> Supplier
--   suppliers         -> supplier catalog
--
-- REUSES existing tables:
--   categories        -> item categories (already exists)
--   branches          -> locations (already exists)
--   stock_movements   -> audit ledger (already exists, extended)
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
-- DO NOT DUAL-WRITE. Legacy tables remain source of truth until Phase 2.
-- =============================================================================

-- ── 1. SUPPLIERS ────────────────────────────────────────────────────────────
-- Supplier catalog. Many-to-many with stock_items via stock_item_suppliers.

create table if not exists public.suppliers (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  phone       text,
  email       text,
  address     text,
  notes       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.suppliers is 'Supplier catalog for inventory procurement';

create index if not exists idx_suppliers_name on public.suppliers (name);

-- ── 2. STOCK ITEMS ──────────────────────────────────────────────────────────
-- Global catalog within single business.
-- NOT tied to any location. Quantity lives in stock_balances.

create table if not exists public.stock_items (
  id                      uuid primary key default gen_random_uuid(),
  name                    text not null,
  sku                     text not null unique,
  category_id             uuid references public.categories(id) on delete set null,
  unit                    text not null default 'pcs',
  default_minimum_stock   int4 not null default 0,
  sell_price              numeric default 0,
  buy_price               numeric default 0,
  photo_url               text,
  compatible_brands       _text,
  compatible_models       _text,
  item_class              text not null default 'sparepart'
                            check (item_class in ('sparepart', 'jam')),
  is_serial_tracked       boolean not null default false,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

comment on table public.stock_items is 'Global item catalog (single business). Quantity NOT stored here — use stock_balances.';

comment on column public.stock_items.sku is 'Stock Keeping Unit. Globally unique within single business.';
comment on column public.stock_items.item_class is 'Classification: sparepart (used in service) or jam (watch transactions)';
comment on column public.stock_items.is_serial_tracked is 'True for watch-type items requiring serial/unit tracking';
comment on column public.stock_items.default_minimum_stock is 'Default minimum stock. Overridden by stock_balances.minimum_stock per location.';

create index if not exists idx_stock_items_sku on public.stock_items (sku);
create index if not exists idx_stock_items_category on public.stock_items (category_id);
create index if not exists idx_stock_items_item_class on public.stock_items (item_class);
create index if not exists idx_stock_items_name on public.stock_items (name);

-- ── 3. STOCK BALANCES ───────────────────────────────────────────────────────
-- Per-location quantity. One balance per stock_item per location.
-- available_quantity = physical_quantity - reserved_quantity (computed, not stored).

create table if not exists public.stock_balances (
  id                  uuid primary key default gen_random_uuid(),
  stock_item_id       uuid not null references public.stock_items(id) on delete cascade,
  location_id         uuid not null references public.branches(id) on delete cascade,
  physical_quantity   int4 not null default 0,
  reserved_quantity   int4 not null default 0,
  minimum_stock       int4,  -- NULL = use stock_items.default_minimum_stock
  updated_at          timestamptz not null default now(),

  -- One balance per item per location
  unique (stock_item_id, location_id),

  -- Quantities cannot be negative
  check (physical_quantity >= 0),
  check (reserved_quantity >= 0),
  check (reserved_quantity <= physical_quantity)
);

comment on table public.stock_balances is 'Per-location stock quantities. One row per stock_item per branch.';
comment on column public.stock_balances.physical_quantity is 'Actual physical count. Never negative.';
comment on column public.stock_balances.reserved_quantity is 'Reserved for pending transfers. Must not exceed physical_quantity.';
comment on column public.stock_balances.minimum_stock is 'Per-location override. NULL = use stock_items.default_minimum_stock.';

create index if not exists idx_stock_balances_item on public.stock_balances (stock_item_id);
create index if not exists idx_stock_balances_location on public.stock_balances (location_id);

-- ── 4. STOCK UNITS ──────────────────────────────────────────────────────────
-- Individual serial-tracked physical units (for watch-type items).
-- Each unit belongs to one stock_item. Serial number unique per stock_item.

create table if not exists public.stock_units (
  id              uuid primary key default gen_random_uuid(),
  stock_item_id   uuid not null references public.stock_items(id) on delete cascade,
  serial_number   text not null,
  status          text not null default 'available'
                    check (status in ('available', 'reserved', 'used', 'damaged')),
  location_id     uuid references public.branches(id) on delete set null,
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  -- Serial number unique per stock item
  unique (stock_item_id, serial_number)
);

comment on table public.stock_units is 'Individual serial-tracked physical units (watch-type items)';
comment on column public.stock_units.status is 'Unit lifecycle: available -> reserved -> used (or damaged)';

create index if not exists idx_stock_units_item on public.stock_units (stock_item_id);
create index if not exists idx_stock_units_serial on public.stock_units (serial_number);
create index if not exists idx_stock_units_status on public.stock_units (status);

-- ── 5. STOCK ITEM SUPPLIERS ─────────────────────────────────────────────────
-- Many-to-many: Stock Item <-> Supplier.

create table if not exists public.stock_item_suppliers (
  id              uuid primary key default gen_random_uuid(),
  stock_item_id   uuid not null references public.stock_items(id) on delete cascade,
  supplier_id     uuid not null references public.suppliers(id) on delete cascade,
  created_at      timestamptz not null default now(),

  -- One relationship per item-supplier pair
  unique (stock_item_id, supplier_id)
);

comment on table public.stock_item_suppliers is 'Many-to-many: Stock Item <-> Supplier';

create index if not exists idx_stock_item_suppliers_item on public.stock_item_suppliers (stock_item_id);
create index if not exists idx_stock_item_suppliers_supplier on public.stock_item_suppliers (supplier_id);

-- ── 6. STOCK MOVEMENTS EXTENSION ────────────────────────────────────────────
-- Additive: add movement_type column to existing table.
-- DO NOT drop existing data. DO NOT add restrictive CHECK constraints yet.
-- Movement taxonomy will be finalized in T002 (inventory movement engine).

-- Note: stock_movements already exists with columns:
--   id, created_at, source, actor, branch_id, inventory_id,
--   delta, result_quantity, reason, ref_type, ref_id
--
-- We add movement_type for future classification.
-- Existing rows get NULL (no data loss, no migration needed).

alter table public.stock_movements
  add column if not exists movement_type text;

comment on column public.stock_movements.movement_type is 'Movement classification. NULL for legacy rows. Taxonomy TBD in T002.';

-- ── 7. RLS ──────────────────────────────────────────────────────────────────
-- Uses existing authorization helpers:
--   auth_profile_role()        -> user role text
--   auth_branch_id()           -> user branch uuid
--   auth_can_manage_all_stocks() -> owner or admin_gudang
--
-- Access boundary:
--   stock_items:        read = all authenticated, write = management
--   stock_balances:     read = management + own branch, write = via RPC only
--   stock_units:        read = management + own branch, write = management
--   suppliers:          read = all authenticated, write = management
--   stock_item_suppliers: read = all authenticated, write = management

-- ── stock_items RLS ─────────────────────────────────────────────────────────
alter table public.stock_items enable row level security;

create policy stock_items_select_authenticated
  on public.stock_items for select to authenticated
  using (true);

create policy stock_items_insert_management
  on public.stock_items for insert to authenticated
  with check (public.auth_can_manage_all_stocks());

create policy stock_items_update_management
  on public.stock_items for update to authenticated
  using (public.auth_can_manage_all_stocks())
  with check (public.auth_can_manage_all_stocks());

create policy stock_items_delete_management
  on public.stock_items for delete to authenticated
  using (public.auth_can_manage_all_stocks());

-- ── stock_balances RLS ──────────────────────────────────────────────────────
-- Write denied to client-side (default deny). Only via RPC/security definer.

alter table public.stock_balances enable row level security;

create policy stock_balances_select_management
  on public.stock_balances for select to authenticated
  using (
    public.auth_can_manage_all_stocks()
    or public.auth_profile_role() in ('engineer', 'supervisor')
    or location_id = public.auth_branch_id()
  );

-- No insert/update/delete policies = deny direct writes (RPC only)

-- ── stock_units RLS ─────────────────────────────────────────────────────────
alter table public.stock_units enable row level security;

create policy stock_units_select_management
  on public.stock_units for select to authenticated
  using (
    public.auth_can_manage_all_stocks()
    or public.auth_profile_role() in ('engineer', 'supervisor')
    or location_id = public.auth_branch_id()
  );

create policy stock_units_insert_management
  on public.stock_units for insert to authenticated
  with check (public.auth_can_manage_all_stocks());

create policy stock_units_update_management
  on public.stock_units for update to authenticated
  using (public.auth_can_manage_all_stocks())
  with check (public.auth_can_manage_all_stocks());

create policy stock_units_delete_management
  on public.stock_units for delete to authenticated
  using (public.auth_can_manage_all_stocks());

-- ── suppliers RLS ───────────────────────────────────────────────────────────
alter table public.suppliers enable row level security;

create policy suppliers_select_authenticated
  on public.suppliers for select to authenticated
  using (true);

create policy suppliers_insert_management
  on public.suppliers for insert to authenticated
  with check (public.auth_can_manage_all_stocks());

create policy suppliers_update_management
  on public.suppliers for update to authenticated
  using (public.auth_can_manage_all_stocks())
  with check (public.auth_can_manage_all_stocks());

create policy suppliers_delete_management
  on public.suppliers for delete to authenticated
  using (public.auth_can_manage_all_stocks());

-- ── stock_item_suppliers RLS ────────────────────────────────────────────────
alter table public.stock_item_suppliers enable row level security;

create policy stock_item_suppliers_select_authenticated
  on public.stock_item_suppliers for select to authenticated
  using (true);

create policy stock_item_suppliers_insert_management
  on public.stock_item_suppliers for insert to authenticated
  with check (public.auth_can_manage_all_stocks());

create policy stock_item_suppliers_delete_management
  on public.stock_item_suppliers for delete to authenticated
  using (public.auth_can_manage_all_stocks());

-- ============================================================================
-- MIGRATION NOTES
-- ============================================================================
-- 1. Legacy tables (inventory, stock_toko, stock_gudang) are NOT modified.
-- 2. Existing RPCs (adjust_store_stock, adjust_warehouse_stock) are NOT modified.
-- 3. No data migration. No dual-write. Legacy remains source of truth.
-- 4. Warehouse mapping (stock_gudang -> stock_balances with central branch)
--    REQUIRES VERIFICATION of branches.is_central uniqueness before implementation.
-- 5. Movement taxonomy (TRANSFER_OUT, TRANSFER_IN, etc.) DEFERRED to T002.
-- 6. Category migration (inventory.category text -> stock_items.category_id uuid)
--    DEFERRED until category data is verified.
-- 7. reserved_quantity mutation logic DEFERRED to T002 (must be atomic).
-- ============================================================================
