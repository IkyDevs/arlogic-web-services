-- ============================================================================
-- INVENTORY MOVEMENT ENGINE V2 (T002)
--
-- Centralized mutation engine for canonical inventory tables.
-- This is the ONLY canonical application-level mechanism allowed to mutate
-- inventory quantities in stock_balances.
--
-- CHANGES FROM LEGACY:
--   - Adds stock_item_id column to stock_movements
--   - Adds movement_type column to stock_movements
--   - Creates adjust_stock() and use_stock() public RPCs
--   - Creates reserve_stock() and release_reservation() internal functions
--   - REVOKE direct writes from authenticated users
--
-- RPCs created:
--   adjust_stock()            -> ADJUSTMENT only (public)
--   use_stock()               -> USAGE only (public)
--   reserve_stock()           -> reservation creation (internal)
--   release_reservation()     -> reservation release (internal)
--
-- ARCHITECTURE RULE:
--   Application code calls public RPCs.
--   RPCs handle: authorization → lock → validate → mutate → ledger → commit.
--   No application code may directly UPDATE stock_balances.
--
-- IDEMPOTENCY:
--   Unique constraint on (ref_type, ref_id, stock_item_id, movement_type)
--   prevents duplicate movements.
--
-- CONCURRENCY:
--   FOR UPDATE row locking on stock_balances.
--   Deterministic lock ordering for multi-balance operations (UUID comparison).
--
-- IMMUTABILITY:
--   stock_movements: no INSERT/UPDATE/DELETE policies.
--   REVOKE direct writes from authenticated; only via SECURITY DEFINER RPCs.
--
-- LEGACY COMPATIBILITY:
--   Legacy tables (inventory, stock_toko, stock_gudang) NOT modified.
--   Legacy RPCs (adjust_store_stock, adjust_warehouse_stock) NOT modified.
--   inventory_id column preserved for historical data.
--   stock_item_id column added for canonical references.
-- =============================================================================

-- ── 1. EXTEND STOCK_MOVEMENTS ───────────────────────────────────────────────

-- Add stock_item_id for canonical references (inventory.id reused as stock_items.id)
ALTER TABLE public.stock_movements
  ADD COLUMN IF NOT EXISTS stock_item_id uuid;

-- Add movement_type for classification
ALTER TABLE public.stock_movements
  ADD COLUMN IF NOT EXISTS movement_type text;

COMMENT ON COLUMN public.stock_movements.stock_item_id IS 'Canonical item reference. Same UUID as inventory.id.';
COMMENT ON COLUMN public.stock_movements.movement_type IS 'Movement classification. NULL for legacy rows.';

-- ── 2. CONSTRAINTS ──────────────────────────────────────────────────────────

-- CHECK constraint: movement_type must be one of the 4 V1 types or NULL
ALTER TABLE public.stock_movements
  ADD CONSTRAINT chk_movement_type
  CHECK (
    movement_type IS NULL
    OR movement_type IN (
      'ADJUSTMENT',
      'USAGE',
      'TRANSFER_OUT',
      'TRANSFER_IN'
    )
  );

-- Unique constraint for idempotency: same ref + item + type = duplicate
ALTER TABLE public.stock_movements
  ADD CONSTRAINT uq_stock_movements_ref
  UNIQUE (ref_type, ref_id, stock_item_id, movement_type);

-- Index for movement_type queries
CREATE INDEX IF NOT EXISTS idx_stock_movements_type
  ON public.stock_movements (movement_type);

-- Index for idempotency lookup
CREATE INDEX IF NOT EXISTS idx_stock_movements_ref_lookup
  ON public.stock_movements (ref_type, ref_id, stock_item_id, movement_type);

-- Index for stock_item_id queries
CREATE INDEX IF NOT EXISTS idx_stock_movements_stock_item
  ON public.stock_movements (stock_item_id);

-- ── 3. IMMUTABILITY: REVOKE DIRECT WRITES ────────────────────────────────────
-- Only SECURITY DEFINER RPCs should write to stock_movements.
-- RLS already denies INSERT/UPDATE/DELETE (no policies).
-- REVOKE provides defense-in-depth.

REVOKE INSERT, UPDATE, DELETE ON public.stock_movements FROM authenticated;

-- ── 4. adjust_stock() ────────────────────────────────────────────────────────
-- Physical stock mutation: ADJUSTMENT only.
-- Delta is signed: positive = restock, negative = reduction.
-- Creates movement record with movement_type = 'ADJUSTMENT'.

CREATE OR REPLACE FUNCTION public.adjust_stock(
  p_stock_item_id  uuid,
  p_location_id    uuid,
  p_delta          int,
  p_source         text default 'web_app',
  p_reason         text default null,
  p_ref_type       text default null,
  p_ref_id         uuid default null
)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role     text := public.auth_profile_role();
  v_branch   uuid := public.auth_branch_id();
  v_actor    uuid := auth.uid();
  v_physical int;
  v_new      int;
BEGIN
  IF p_stock_item_id IS NULL THEN
    RAISE EXCEPTION 'INVALID_ITEM: stock_item_id tidak boleh kosong';
  END IF;
  IF p_location_id IS NULL THEN
    RAISE EXCEPTION 'INVALID_LOCATION: location_id tidak boleh kosong';
  END IF;
  IF p_delta IS NULL OR p_delta = 0 THEN
    RAISE EXCEPTION 'INVALID_DELTA: delta tidak boleh 0';
  END IF;
  IF p_ref_type IS NULL OR p_ref_id IS NULL THEN
    RAISE EXCEPTION 'INVALID_REFERENCE: ref_type dan ref_id wajib diisi';
  END IF;

  IF NOT public.auth_can_manage_all_stocks() THEN
    IF v_role IS DISTINCT FROM 'admin'
       OR v_branch IS NULL
       OR v_branch != p_location_id THEN
      RAISE EXCEPTION 'FORBIDDEN: tidak berwenang mengubah stok lokasi ini';
    END IF;
  END IF;

  INSERT INTO public.stock_balances (stock_item_id, location_id, physical_quantity, reserved_quantity)
  VALUES (p_stock_item_id, p_location_id, 0, 0)
  ON CONFLICT (stock_item_id, location_id) DO NOTHING;

  SELECT physical_quantity INTO v_physical
  FROM public.stock_balances
  WHERE stock_item_id = p_stock_item_id
    AND location_id = p_location_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'BALANCE_NOT_FOUND: balance tidak ditemukan';
  END IF;

  v_new := v_physical + p_delta;
  IF v_new < 0 THEN
    RAISE EXCEPTION 'INSUFFICIENT_STOCK: stok tidak mencukupi (available: %, requested: %)', v_physical, -p_delta;
  END IF;

  INSERT INTO public.stock_movements (
    source, actor, stock_item_id, location_id, delta, result_quantity,
    reason, ref_type, ref_id, movement_type
  ) VALUES (
    p_source, v_actor, p_stock_item_id, p_location_id, p_delta, v_new,
    p_reason, p_ref_type, p_ref_id, 'ADJUSTMENT'
  );

  UPDATE public.stock_balances
  SET physical_quantity = v_new,
      updated_at = now()
  WHERE stock_item_id = p_stock_item_id
    AND location_id = p_location_id;

  RETURN v_new;
END;
$$;

COMMENT ON FUNCTION public.adjust_stock IS 'Physical stock mutation: ADJUSTMENT only. Creates movement record.';

GRANT EXECUTE ON FUNCTION public.adjust_stock(uuid, uuid, int, text, text, text, uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.adjust_stock(uuid, uuid, int, text, text, text, uuid) FROM PUBLIC;

-- ── 5. use_stock() ───────────────────────────────────────────────────────────
-- Physical stock mutation: USAGE only.
-- Consumes stock (delta is always negative).
-- Creates movement record with movement_type = 'USAGE'.

CREATE OR REPLACE FUNCTION public.use_stock(
  p_stock_item_id  uuid,
  p_location_id    uuid,
  p_quantity       int,
  p_source         text default 'web_app',
  p_reason         text default null,
  p_ref_type       text default null,
  p_ref_id         uuid default null
)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role     text := public.auth_profile_role();
  v_branch   uuid := public.auth_branch_id();
  v_actor    uuid := auth.uid();
  v_physical int;
  v_new      int;
  v_delta    int;
BEGIN
  IF p_stock_item_id IS NULL THEN
    RAISE EXCEPTION 'INVALID_ITEM: stock_item_id tidak boleh kosong';
  END IF;
  IF p_location_id IS NULL THEN
    RAISE EXCEPTION 'INVALID_LOCATION: location_id tidak boleh kosong';
  END IF;
  IF p_quantity IS NULL OR p_quantity <= 0 THEN
    RAISE EXCEPTION 'INVALID_QUANTITY: quantity harus positif';
  END IF;
  IF p_ref_type IS NULL OR p_ref_id IS NULL THEN
    RAISE EXCEPTION 'INVALID_REFERENCE: ref_type dan ref_id wajib diisi';
  END IF;

  IF NOT public.auth_can_manage_all_stocks() THEN
    IF v_role IS DISTINCT FROM 'admin'
       OR v_branch IS NULL
       OR v_branch != p_location_id THEN
      RAISE EXCEPTION 'FORBIDDEN: tidak berwenang mengubah stok lokasi ini';
    END IF;
  END IF;

  SELECT physical_quantity INTO v_physical
  FROM public.stock_balances
  WHERE stock_item_id = p_stock_item_id
    AND location_id = p_location_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'BALANCE_NOT_FOUND: balance tidak ditemukan untuk item ini di lokasi ini';
  END IF;

  v_delta := -p_quantity;
  v_new := v_physical + v_delta;
  IF v_new < 0 THEN
    RAISE EXCEPTION 'INSUFFICIENT_STOCK: stok tidak mencukupi (available: %, requested: %)', v_physical, p_quantity;
  END IF;

  INSERT INTO public.stock_movements (
    source, actor, stock_item_id, location_id, delta, result_quantity,
    reason, ref_type, ref_id, movement_type
  ) VALUES (
    p_source, v_actor, p_stock_item_id, p_location_id, v_delta, v_new,
    p_reason, p_ref_type, p_ref_id, 'USAGE'
  );

  UPDATE public.stock_balances
  SET physical_quantity = v_new,
      updated_at = now()
  WHERE stock_item_id = p_stock_item_id
    AND location_id = p_location_id;

  RETURN v_new;
END;
$$;

COMMENT ON FUNCTION public.use_stock IS 'Physical stock mutation: USAGE only. Consumes stock. Creates movement record.';

GRANT EXECUTE ON FUNCTION public.use_stock(uuid, uuid, int, text, text, text, uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.use_stock(uuid, uuid, int, text, text, text, uuid) FROM PUBLIC;

-- ── 6. reserve_stock() ───────────────────────────────────────────────────────
-- Create reservation: reserved_quantity += quantity.
-- NO movement record (reservation is not physical mutation).
-- Validates: available_quantity >= quantity.
-- INTERNAL FUNCTION: called by submit_stock_transfer(), not by application code.

CREATE OR REPLACE FUNCTION public.reserve_stock(
  p_stock_item_id  uuid,
  p_location_id    uuid,
  p_quantity       int,
  p_ref_type       text default null,
  p_ref_id         uuid default null
)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role      text := public.auth_profile_role();
  v_branch    uuid := public.auth_branch_id();
  v_physical  int;
  v_reserved  int;
  v_available int;
  v_new_reserved int;
BEGIN
  -- ── Input validation ──
  IF p_stock_item_id IS NULL THEN
    RAISE EXCEPTION 'INVALID_ITEM: stock_item_id tidak boleh kosong';
  END IF;
  IF p_location_id IS NULL THEN
    RAISE EXCEPTION 'INVALID_LOCATION: location_id tidak boleh kosong';
  END IF;
  IF p_quantity IS NULL OR p_quantity <= 0 THEN
    RAISE EXCEPTION 'INVALID_QUANTITY: quantity harus positif';
  END IF;
  IF p_ref_type IS NULL OR p_ref_id IS NULL THEN
    RAISE EXCEPTION 'INVALID_REFERENCE: ref_type dan ref_id wajib diisi';
  END IF;

  -- ── Authorization ──
  IF NOT public.auth_can_manage_all_stocks() THEN
    IF v_role IS DISTINCT FROM 'admin'
       OR v_branch IS NULL
       OR v_branch != p_location_id THEN
      RAISE EXCEPTION 'FORBIDDEN: tidak berwenang mengubah stok lokasi ini';
    END IF;
  END IF;

  -- ── Lock balance row ──
  SELECT physical_quantity, reserved_quantity
  INTO v_physical, v_reserved
  FROM public.stock_balances
  WHERE stock_item_id = p_stock_item_id
    AND location_id = p_location_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'BALANCE_NOT_FOUND: balance tidak ditemukan untuk item ini di lokasi ini';
  END IF;

  -- ── Validate: sufficient available stock ──
  v_available := v_physical - v_reserved;
  IF v_available < p_quantity THEN
    RAISE EXCEPTION 'INSUFFICIENT_AVAILABLE: stok tersedia tidak mencukupi (available: %, requested: %)', v_available, p_quantity;
  END IF;

  -- ── Mutate ──
  v_new_reserved := v_reserved + p_quantity;
  UPDATE public.stock_balances
  SET reserved_quantity = v_new_reserved,
      updated_at = now()
  WHERE stock_item_id = p_stock_item_id
    AND location_id = p_location_id;

  -- NO movement record (reservation is not physical mutation)

  RETURN v_new_reserved;
END;
$$;

COMMENT ON FUNCTION public.reserve_stock IS 'INTERNAL: Create reservation. No movement record. Validates available stock.';

-- ── 7. release_reservation() ─────────────────────────────────────────────────
-- Release reservation: reserved_quantity -= quantity.
-- NO movement record (reservation release is not physical mutation).
-- INTERNAL FUNCTION: called by reject_stock_transfer(), not by application code.

CREATE OR REPLACE FUNCTION public.release_reservation(
  p_stock_item_id  uuid,
  p_location_id    uuid,
  p_quantity       int,
  p_ref_type       text default null,
  p_ref_id         uuid default null
)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role      text := public.auth_profile_role();
  v_branch    uuid := public.auth_branch_id();
  v_reserved  int;
  v_new_reserved int;
BEGIN
  -- ── Input validation ──
  IF p_stock_item_id IS NULL THEN
    RAISE EXCEPTION 'INVALID_ITEM: stock_item_id tidak boleh kosong';
  END IF;
  IF p_location_id IS NULL THEN
    RAISE EXCEPTION 'INVALID_LOCATION: location_id tidak boleh kosong';
  END IF;
  IF p_quantity IS NULL OR p_quantity <= 0 THEN
    RAISE EXCEPTION 'INVALID_QUANTITY: quantity harus positif';
  END IF;
  IF p_ref_type IS NULL OR p_ref_id IS NULL THEN
    RAISE EXCEPTION 'INVALID_REFERENCE: ref_type dan ref_id wajib diisi';
  END IF;

  -- ── Authorization ──
  IF NOT public.auth_can_manage_all_stocks() THEN
    IF v_role IS DISTINCT FROM 'admin'
       OR v_branch IS NULL
       OR v_branch != p_location_id THEN
      RAISE EXCEPTION 'FORBIDDEN: tidak berwenang mengubah stok lokasi ini';
    END IF;
  END IF;

  -- ── Lock balance row ──
  SELECT reserved_quantity INTO v_reserved
  FROM public.stock_balances
  WHERE stock_item_id = p_stock_item_id
    AND location_id = p_location_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'BALANCE_NOT_FOUND: balance tidak ditemukan untuk item ini di lokasi ini';
  END IF;

  -- ── Validate: cannot release more than reserved ──
  IF v_reserved < p_quantity THEN
    RAISE EXCEPTION 'INSUFFICIENT_AVAILABLE: reservasi tidak mencukupi (reserved: %, release: %)', v_reserved, p_quantity;
  END IF;

  -- ── Mutate ──
  v_new_reserved := v_reserved - p_quantity;
  UPDATE public.stock_balances
  SET reserved_quantity = v_new_reserved,
      updated_at = now()
  WHERE stock_item_id = p_stock_item_id
    AND location_id = p_location_id;

  -- NO movement record (reservation release is not physical mutation)

  RETURN v_new_reserved;
END;
$$;

COMMENT ON FUNCTION public.release_reservation IS 'INTERNAL: Release reservation. No movement record.';

-- ============================================================================
-- MIGRATION NOTES
-- ============================================================================
-- 1. CHECK constraint allows NULL for legacy movement_type values.
-- 2. Unique constraint (ref_type, ref_id, stock_item_id, movement_type)
--    enforces idempotency for multi-item transfers.
-- 3. REVOKE direct writes from authenticated on stock_movements.
-- 4. adjust_stock() creates zero-balance row if missing (ADJUSTMENT only).
-- 5. use_stock() requires existing balance.
-- 6. reserve_stock() and release_reservation() are INTERNAL functions (no GRANT).
-- 7. REVOKE ALL ... FROM PUBLIC on all public RPCs (defense-in-depth).
-- 8. Legacy RPCs (adjust_store_stock, adjust_warehouse_stock) NOT modified.
-- 9. stock_item_id uses same UUID as inventory.id (no mapping needed).
-- 10. Idempotency: movement INSERT is the atomic gate (BEFORE balance mutation).
--     FOR UPDATE lock + movement INSERT = serialization point.
--     If concurrent request: lock serializes, INSERT unique_violation prevents double-mutate.
-- =============================================================================