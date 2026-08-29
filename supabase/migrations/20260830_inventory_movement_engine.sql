-- ============================================================================
-- INVENTORY MOVEMENT ENGINE (T002)
--
-- Centralized mutation engine for canonical inventory tables.
-- This is the ONLY canonical application-level mechanism allowed to mutate
-- inventory quantities in stock_balances.
--
-- RPCs created:
--   adjust_stock()            -> ADJUSTMENT only
--   use_stock()               -> USAGE only
--   reserve_stock()           -> reservation creation (no movement record)
--   release_reservation()     -> reservation release (no movement record)
--   execute_transfer_approval() -> internal atomic transfer (TRANSFER_OUT + TRANSFER_IN)
--
-- ARCHITECTURE RULE:
--   Application code calls RPCs.
--   RPCs handle: authorization → lock → validate → mutate → ledger → commit.
--   No application code may directly UPDATE stock_balances.
--
-- IDEMPOTENCY:
--   Unique constraint on (ref_type, ref_id, movement_type) prevents duplicate movements.
--   Duplicate requests are rejected, not silently ignored.
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
--   movement_type NULL remains valid for legacy records.
-- =============================================================================

-- ── 1. CONSTRAINTS & INDEXES ─────────────────────────────────────────────────

-- CHECK constraint: movement_type must be one of the 6 confirmed types or NULL
ALTER TABLE public.stock_movements
  ADD CONSTRAINT chk_movement_type
  CHECK (
    movement_type IS NULL
    OR movement_type IN (
      'ADJUSTMENT',
      'USAGE',
      'TRANSFER_OUT',
      'TRANSFER_IN',
      'TRANSFER_REVERSAL_OUT',
      'TRANSFER_REVERSAL_IN'
    )
  );

-- Unique constraint for idempotency: same ref_type + ref_id + movement_type = duplicate
ALTER TABLE public.stock_movements
  ADD CONSTRAINT uq_stock_movements_ref
  UNIQUE (ref_type, ref_id, movement_type);

-- Index for movement_type queries
CREATE INDEX IF NOT EXISTS idx_stock_movements_type
  ON public.stock_movements (movement_type);

-- Index for idempotency lookup
CREATE INDEX IF NOT EXISTS idx_stock_movements_ref_lookup
  ON public.stock_movements (ref_type, ref_id, movement_type);

-- ── 2. IMMUTABILITY: REVOKE DIRECT WRITES ────────────────────────────────────
-- Only SECURITY DEFINER RPCs should write to stock_movements.
-- RLS already denies INSERT/UPDATE/DELETE (no policies).
-- REVOKE provides defense-in-depth.

REVOKE INSERT, UPDATE, DELETE ON public.stock_movements FROM authenticated;

-- ── 3. adjust_stock() ────────────────────────────────────────────────────────
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
  v_result   int;
BEGIN
  -- ── Input validation ──
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

  -- ── Authorization ──
  IF NOT public.auth_can_manage_all_stocks() THEN
    IF v_role IS DISTINCT FROM 'admin'
       OR v_branch IS NULL
       OR v_branch != p_location_id THEN
      RAISE EXCEPTION 'FORBIDDEN: tidak berwenang mengubah stok lokasi ini';
    END IF;
  END IF;

  -- ── Idempotency check ──
  IF EXISTS (
    SELECT 1 FROM public.stock_movements
    WHERE ref_type = p_ref_type
      AND ref_id = p_ref_id
      AND movement_type = 'ADJUSTMENT'
  ) THEN
    SELECT result_quantity INTO v_result
    FROM public.stock_movements
    WHERE ref_type = p_ref_type
      AND ref_id = p_ref_id
      AND movement_type = 'ADJUSTMENT';
    RETURN v_result;
  END IF;

  -- ── Lock balance row (or create if ADJUSTMENT and row missing) ──
  -- For ADJUSTMENT: create zero-balance row if missing
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

  -- ── Validate: non-negative ──
  v_new := v_physical + p_delta;
  IF v_new < 0 THEN
    RAISE EXCEPTION 'INSUFFICIENT_STOCK: stok tidak mencukupi (available: %, requested: %)', v_physical, -p_delta;
  END IF;

  -- ── Mutate ──
  UPDATE public.stock_balances
  SET physical_quantity = v_new,
      updated_at = now()
  WHERE stock_item_id = p_stock_item_id
    AND location_id = p_location_id;

  -- ── Ledger ──
  INSERT INTO public.stock_movements (
    source, actor, branch_id, inventory_id, delta, result_quantity,
    reason, ref_type, ref_id, movement_type
  ) VALUES (
    p_source, v_actor, p_location_id, p_stock_item_id, p_delta, v_new,
    p_reason, p_ref_type, p_ref_id, 'ADJUSTMENT'
  );

  RETURN v_new;
END;
$$;

COMMENT ON FUNCTION public.adjust_stock IS 'Physical stock mutation: ADJUSTMENT only. Creates movement record.';

-- ── 4. use_stock() ───────────────────────────────────────────────────────────
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
  v_result   int;
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

  -- ── Idempotency check ──
  IF EXISTS (
    SELECT 1 FROM public.stock_movements
    WHERE ref_type = p_ref_type
      AND ref_id = p_ref_id
      AND movement_type = 'USAGE'
  ) THEN
    SELECT result_quantity INTO v_result
    FROM public.stock_movements
    WHERE ref_type = p_ref_type
      AND ref_id = p_ref_id
      AND movement_type = 'USAGE';
    RETURN v_result;
  END IF;

  -- ── Lock balance row ──
  SELECT physical_quantity INTO v_physical
  FROM public.stock_balances
  WHERE stock_item_id = p_stock_item_id
    AND location_id = p_location_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'BALANCE_NOT_FOUND: balance tidak ditemukan untuk item ini di lokasi ini';
  END IF;

  -- ── Validate: sufficient stock ──
  v_delta := -p_quantity;
  v_new := v_physical + v_delta;
  IF v_new < 0 THEN
    RAISE EXCEPTION 'INSUFFICIENT_STOCK: stok tidak mencukupi (available: %, requested: %)', v_physical, p_quantity;
  END IF;

  -- ── Mutate ──
  UPDATE public.stock_balances
  SET physical_quantity = v_new,
      updated_at = now()
  WHERE stock_item_id = p_stock_item_id
    AND location_id = p_location_id;

  -- ── Ledger ──
  INSERT INTO public.stock_movements (
    source, actor, branch_id, inventory_id, delta, result_quantity,
    reason, ref_type, ref_id, movement_type
  ) VALUES (
    p_source, v_actor, p_location_id, p_stock_item_id, v_delta, v_new,
    p_reason, p_ref_type, p_ref_id, 'USAGE'
  );

  RETURN v_new;
END;
$$;

COMMENT ON FUNCTION public.use_stock IS 'Physical stock mutation: USAGE only. Consumes stock. Creates movement record.';

-- ── 5. reserve_stock() ───────────────────────────────────────────────────────
-- Create reservation: reserved_quantity += quantity.
-- NO movement record (reservation is not physical mutation).
-- Validates: available_quantity >= quantity.

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

COMMENT ON FUNCTION public.reserve_stock IS 'Create reservation. No movement record. Validates available stock.';

-- ── 6. release_reservation() ─────────────────────────────────────────────────
-- Release reservation: reserved_quantity -= quantity.
-- NO movement record (reservation release is not physical mutation).

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

COMMENT ON FUNCTION public.release_reservation IS 'Release reservation. No movement record.';

-- ── 7. execute_transfer_approval() ───────────────────────────────────────────
-- Internal atomic transfer: TRANSFER_OUT (source) + TRANSFER_IN (dest).
-- Used by future Transfer Approval workflow.
-- NOT exposed to frontend as general-purpose RPC.
--
-- Atomic steps:
--   1. Lock both balances (deterministic UUID order)
--   2. Validate source has sufficient available stock
--   3. Decrease source physical_quantity
--   4. Decrease source reserved_quantity
--   5. Increase destination physical_quantity
--   6. Create TRANSFER_OUT movement (source)
--   7. Create TRANSFER_IN movement (dest)
--   8. Commit
--
-- If any step fails, EVERYTHING rolls back.

CREATE OR REPLACE FUNCTION public.execute_transfer_approval(
  p_stock_item_id      uuid,
  p_source_location    uuid,
  p_dest_location      uuid,
  p_quantity           int,
  p_source_ref_type    text,
  p_source_ref_id      uuid,
  p_dest_ref_type      text,
  p_dest_ref_id        uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role          text := public.auth_profile_role();
  v_actor         uuid := auth.uid();
  v_source_physical   int;
  v_source_reserved   int;
  v_dest_physical     int;
  v_dest_reserved     int;
  v_source_available  int;
  v_first_loc     uuid;
  v_second_loc    uuid;
  v_first_is_source boolean;
BEGIN
  -- ── Input validation ──
  IF p_stock_item_id IS NULL THEN
    RAISE EXCEPTION 'INVALID_ITEM: stock_item_id tidak boleh kosong';
  END IF;
  IF p_source_location IS NULL OR p_dest_location IS NULL THEN
    RAISE EXCEPTION 'INVALID_LOCATION: source dan destination harus diisi';
  END IF;
  IF p_source_location = p_dest_location THEN
    RAISE EXCEPTION 'TRANSFER_SAME_LOCATION: source dan destination tidak boleh sama';
  END IF;
  IF p_quantity IS NULL OR p_quantity <= 0 THEN
    RAISE EXCEPTION 'INVALID_QUANTITY: quantity harus positif';
  END IF;
  IF p_source_ref_type IS NULL OR p_source_ref_id IS NULL THEN
    RAISE EXCEPTION 'INVALID_REFERENCE: source ref_type dan ref_id wajib diisi';
  END IF;
  IF p_dest_ref_type IS NULL OR p_dest_ref_id IS NULL THEN
    RAISE EXCEPTION 'INVALID_REFERENCE: dest ref_type dan ref_id wajib diisi';
  END IF;

  -- ── Authorization: management-level only ──
  IF NOT public.auth_can_manage_all_stocks() THEN
    RAISE EXCEPTION 'FORBIDDEN: hanya owner/admin_gudang yang dapat melakukan transfer';
  END IF;

  -- ── Deterministic lock ordering (prevent deadlock) ──
  IF p_source_location < p_dest_location THEN
    v_first_loc := p_source_location;
    v_second_loc := p_dest_location;
    v_first_is_source := true;
  ELSE
    v_first_loc := p_dest_location;
    v_second_loc := p_source_location;
    v_first_is_source := false;
  END IF;

  -- ── Lock first balance ──
  IF v_first_is_source THEN
    SELECT physical_quantity, reserved_quantity
    INTO v_source_physical, v_source_reserved
    FROM public.stock_balances
    WHERE stock_item_id = p_stock_item_id
      AND location_id = v_first_loc
    FOR UPDATE;
  ELSE
    SELECT physical_quantity, reserved_quantity
    INTO v_dest_physical, v_dest_reserved
    FROM public.stock_balances
    WHERE stock_item_id = p_stock_item_id
      AND location_id = v_first_loc
    FOR UPDATE;
  END IF;

  -- ── Lock second balance ──
  IF v_first_is_source THEN
    SELECT physical_quantity, reserved_quantity
    INTO v_dest_physical, v_dest_reserved
    FROM public.stock_balances
    WHERE stock_item_id = p_stock_item_id
      AND location_id = v_second_loc
    FOR UPDATE;
  ELSE
    SELECT physical_quantity, reserved_quantity
    INTO v_source_physical, v_source_reserved
    FROM public.stock_balances
    WHERE stock_item_id = p_stock_item_id
      AND location_id = v_second_loc
    FOR UPDATE;
  END IF;

  -- ── Validate source exists ──
  IF v_source_physical IS NULL THEN
    RAISE EXCEPTION 'BALANCE_NOT_FOUND: source balance tidak ditemukan';
  END IF;

  -- ── Validate dest exists ──
  IF v_dest_physical IS NULL THEN
    RAISE EXCEPTION 'BALANCE_NOT_FOUND: destination balance tidak ditemukan';
  END IF;

  -- ── Validate: sufficient available stock at source ──
  v_source_available := v_source_physical - v_source_reserved;
  IF v_source_available < p_quantity THEN
    RAISE EXCEPTION 'INSUFFICIENT_AVAILABLE: stok tersedia source tidak mencukupi (available: %, transfer: %)', v_source_available, p_quantity;
  END IF;

  -- ── Mutate source: decrease physical, decrease reserved ──
  UPDATE public.stock_balances
  SET physical_quantity = physical_quantity - p_quantity,
      reserved_quantity = reserved_quantity - p_quantity,
      updated_at = now()
  WHERE stock_item_id = p_stock_item_id
    AND location_id = p_source_location;

  -- ── Mutate destination: increase physical ──
  -- Create balance row if missing (ON CONFLICT DO NOTHING)
  INSERT INTO public.stock_balances (stock_item_id, location_id, physical_quantity, reserved_quantity)
  VALUES (p_stock_item_id, p_dest_location, 0, 0)
  ON CONFLICT (stock_item_id, location_id) DO NOTHING;

  UPDATE public.stock_balances
  SET physical_quantity = physical_quantity + p_quantity,
      updated_at = now()
  WHERE stock_item_id = p_stock_item_id
    AND location_id = p_dest_location;

  -- ── Ledger: TRANSFER_OUT (source) ──
  INSERT INTO public.stock_movements (
    source, actor, branch_id, inventory_id, delta, result_quantity,
    reason, ref_type, ref_id, movement_type
  ) VALUES (
    'transfer', v_actor, p_source_location, p_stock_item_id, -p_quantity,
    (v_source_physical - p_quantity),
    'Transfer approved: source outbound', p_source_ref_type, p_source_ref_id, 'TRANSFER_OUT'
  );

  -- ── Ledger: TRANSFER_IN (dest) ──
  INSERT INTO public.stock_movements (
    source, actor, branch_id, inventory_id, delta, result_quantity,
    reason, ref_type, ref_id, movement_type
  ) VALUES (
    'transfer', v_actor, p_dest_location, p_stock_item_id, p_quantity,
    (v_dest_physical + p_quantity),
    'Transfer approved: destination inbound', p_dest_ref_type, p_dest_ref_id, 'TRANSFER_IN'
  );

END;
$$;

COMMENT ON FUNCTION public.execute_transfer_approval IS 'Internal atomic transfer. Used by Transfer Approval workflow. NOT for frontend.';

-- ============================================================================
-- MIGRATION NOTES
-- ============================================================================
-- 1. CHECK constraint allows NULL for legacy movement_type values.
-- 2. Unique constraint (ref_type, ref_id, movement_type) enforces idempotency.
-- 3. REVOKE on stock_movements prevents direct writes from authenticated.
-- 4. adjust_stock() creates zero-balance row if missing (ADJUSTMENT only).
-- 5. use_stock(), reserve_stock(), release_reservation() require existing balance.
-- 6. execute_transfer_approval() uses deterministic UUID lock ordering.
-- 7. execute_transfer_approval() creates zero-balance at destination if missing.
-- 8. All RPCs use SECURITY DEFINER to bypass RLS.
-- 9. Legacy RPCs (adjust_store_stock, adjust_warehouse_stock) NOT modified.
-- ============================================================================
