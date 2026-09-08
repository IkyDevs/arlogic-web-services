-- ============================================================================
-- INVENTORY TRANSFER LIFECYCLE V2 (T003)
--
-- Implements the Inventory Transfer business lifecycle:
--   DRAFT → PENDING → APPROVED / REJECTED
--
-- Tables:
--   inventory_transfers        -> transfer header (status, locations, actors)
--   inventory_transfer_items   -> line items (item, quantity)
--   inventory_transfer_history -> lifecycle audit trail
--
-- RPCs:
--   submit_stock_transfer()    -> DRAFT → PENDING (reserves items)
--   approve_stock_transfer()   -> PENDING → APPROVED (executes transfer)
--   reject_stock_transfer()    -> PENDING → REJECTED (releases reservations)
--
-- ARCHITECTURE RULE:
--   T003 owns transfer business rules.
--   T002 owns physical stock mutation.
--   All physical mutations go through T002 Movement Engine.
--
-- BUSINESS RULES:
--   1. Multi-item transfer (one transfer, multiple items)
--   2. All-or-nothing approval (no partial approval)
--   3. DRAFT does not mutate physical stock
--   4. PENDING reserves source stock
--   5. REJECTED releases reservation
--   6. APPROVED performs atomic transfer via T002
--   7. No negative stock allowed
--   8. Historical stock movements are immutable
--
-- IDEMPOTENCY:
--   Movement uniqueness: (ref_type, ref_id, stock_item_id, movement_type)
--   Transfer row lock prevents concurrent approvals.
--   Status check ensures single approval per transfer.
--
-- LEGACY COMPATIBILITY:
--   Legacy tables (inventory, stock_toko, stock_gudang) NOT modified.
--   Legacy RPCs NOT modified.
--   Legacy stock_transfers NOT modified (deprecated but preserved).
-- =============================================================================

-- ── 1. TABLES ────────────────────────────────────────────────────────────────

-- ── inventory_transfers ──────────────────────────────────────────────────────
-- Transfer header. Tracks lifecycle, locations, and actors.

CREATE TABLE IF NOT EXISTS public.inventory_transfers (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  status              text NOT NULL DEFAULT 'DRAFT'
                        CHECK (status IN ('DRAFT', 'PENDING', 'APPROVED', 'REJECTED')),
  source_location_id  uuid NOT NULL REFERENCES public.branches(id),
  dest_location_id    uuid NOT NULL REFERENCES public.branches(id),
  notes               text,
  created_by          uuid NOT NULL REFERENCES auth.users(id),
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  submitted_at        timestamptz,
  submitted_by        uuid REFERENCES auth.users(id),
  resolved_at         timestamptz,
  resolved_by         uuid REFERENCES auth.users(id),
  reject_reason       text,

  -- Source and destination must be different
  CHECK (source_location_id != dest_location_id)
);

COMMENT ON TABLE public.inventory_transfers IS 'Transfer header. Lifecycle: DRAFT → PENDING → APPROVED/REJECTED.';
COMMENT ON COLUMN public.inventory_transfers.status IS 'Lifecycle state: DRAFT, PENDING, APPROVED, REJECTED.';
COMMENT ON COLUMN public.inventory_transfers.source_location_id IS 'Source branch/warehouse.';
COMMENT ON COLUMN public.inventory_transfers.dest_location_id IS 'Destination branch/warehouse.';
COMMENT ON COLUMN public.inventory_transfers.notes IS 'Transfer reason/purpose.';
COMMENT ON COLUMN public.inventory_transfers.reject_reason IS 'Required when status = REJECTED.';

-- ── inventory_transfer_items ─────────────────────────────────────────────────
-- Line items. One row per stock item per transfer.

CREATE TABLE IF NOT EXISTS public.inventory_transfer_items (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transfer_id         uuid NOT NULL REFERENCES public.inventory_transfers(id) ON DELETE CASCADE,
  stock_item_id       uuid NOT NULL REFERENCES public.stock_items(id),
  requested_quantity  int4 NOT NULL CHECK (requested_quantity > 0),

  -- One row per item per transfer
  UNIQUE (transfer_id, stock_item_id)
);

COMMENT ON TABLE public.inventory_transfer_items IS 'Transfer line items. One row per stock item.';
COMMENT ON COLUMN public.inventory_transfer_items.requested_quantity IS 'Requested quantity (positive). All-or-nothing approval.';

-- ── inventory_transfer_history ───────────────────────────────────────────────
-- Lifecycle audit trail. Separate from stock_movements (physical mutations).

CREATE TABLE IF NOT EXISTS public.inventory_transfer_history (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transfer_id     uuid NOT NULL REFERENCES public.inventory_transfers(id) ON DELETE CASCADE,
  action          text NOT NULL
                    CHECK (action IN ('CREATED', 'SUBMITTED', 'APPROVED', 'REJECTED')),
  actor_id        uuid NOT NULL REFERENCES auth.users(id),
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.inventory_transfer_history IS 'Transfer lifecycle audit trail. Physical mutations are in stock_movements.';

-- ── 2. INDEXES ───────────────────────────────────────────────────────────────

-- inventory_transfers
CREATE INDEX IF NOT EXISTS idx_inventory_transfers_status ON public.inventory_transfers (status);
CREATE INDEX IF NOT EXISTS idx_inventory_transfers_source ON public.inventory_transfers (source_location_id);
CREATE INDEX IF NOT EXISTS idx_inventory_transfers_dest ON public.inventory_transfers (dest_location_id);
CREATE INDEX IF NOT EXISTS idx_inventory_transfers_created_by ON public.inventory_transfers (created_by);

-- inventory_transfer_items
CREATE INDEX IF NOT EXISTS idx_inventory_transfer_items_transfer ON public.inventory_transfer_items (transfer_id);
CREATE INDEX IF NOT EXISTS idx_inventory_transfer_items_stock_item ON public.inventory_transfer_items (stock_item_id);

-- inventory_transfer_history
CREATE INDEX IF NOT EXISTS idx_inventory_transfer_history_transfer ON public.inventory_transfer_history (transfer_id);

-- ── 3. RLS ───────────────────────────────────────────────────────────────────
-- Authorization using existing helpers:
--   auth_profile_role()        -> user role text
--   auth_branch_id()           -> user branch uuid
--   auth_can_manage_all_stocks() -> owner or admin_gudang

-- ── inventory_transfers RLS ──────────────────────────────────────────────────
ALTER TABLE public.inventory_transfers ENABLE ROW LEVEL SECURITY;

-- SELECT: management, creator, or source/dest branch
CREATE POLICY inventory_transfers_select_authenticated
  ON public.inventory_transfers FOR SELECT TO authenticated
  USING (
    public.auth_can_manage_all_stocks()
    OR created_by = auth.uid()
    OR source_location_id = public.auth_branch_id()
    OR dest_location_id = public.auth_branch_id()
  );

-- INSERT: management or admin
CREATE POLICY inventory_transfers_insert_authenticated
  ON public.inventory_transfers FOR INSERT TO authenticated
  WITH CHECK (
    public.auth_can_manage_all_stocks()
    OR public.auth_profile_role() = 'admin'
  );

-- UPDATE: management, or creator if DRAFT
CREATE POLICY inventory_transfers_update_authenticated
  ON public.inventory_transfers FOR UPDATE TO authenticated
  USING (
    public.auth_can_manage_all_stocks()
    OR (status = 'DRAFT' AND created_by = auth.uid())
  )
  WITH CHECK (
    public.auth_can_manage_all_stocks()
    OR (status = 'DRAFT' AND created_by = auth.uid())
  );

-- ── inventory_transfer_items RLS ─────────────────────────────────────────────
ALTER TABLE public.inventory_transfer_items ENABLE ROW LEVEL SECURITY;

-- SELECT: via parent transfer
CREATE POLICY inventory_transfer_items_select_authenticated
  ON public.inventory_transfer_items FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.inventory_transfers
      WHERE id = transfer_id
        AND (
          public.auth_can_manage_all_stocks()
          OR created_by = auth.uid()
          OR source_location_id = public.auth_branch_id()
          OR dest_location_id = public.auth_branch_id()
        )
    )
  );

-- INSERT: via parent transfer (DRAFT only)
CREATE POLICY inventory_transfer_items_insert_authenticated
  ON public.inventory_transfer_items FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.inventory_transfers
      WHERE id = transfer_id
        AND status = 'DRAFT'
        AND (
          public.auth_can_manage_all_stocks()
          OR created_by = auth.uid()
        )
    )
  );

-- UPDATE: via parent transfer (DRAFT only)
CREATE POLICY inventory_transfer_items_update_authenticated
  ON public.inventory_transfer_items FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.inventory_transfers
      WHERE id = transfer_id
        AND status = 'DRAFT'
        AND (
          public.auth_can_manage_all_stocks()
          OR created_by = auth.uid()
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.inventory_transfers
      WHERE id = transfer_id
        AND status = 'DRAFT'
        AND (
          public.auth_can_manage_all_stocks()
          OR created_by = auth.uid()
        )
    )
  );

-- DELETE: via parent transfer (DRAFT only)
CREATE POLICY inventory_transfer_items_delete_authenticated
  ON public.inventory_transfer_items FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.inventory_transfers
      WHERE id = transfer_id
        AND status = 'DRAFT'
        AND (
          public.auth_can_manage_all_stocks()
          OR created_by = auth.uid()
        )
    )
  );

-- ── inventory_transfer_history RLS ───────────────────────────────────────────
ALTER TABLE public.inventory_transfer_history ENABLE ROW LEVEL SECURITY;

-- SELECT: via parent transfer
CREATE POLICY inventory_transfer_history_select_authenticated
  ON public.inventory_transfer_history FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.inventory_transfers
      WHERE id = transfer_id
        AND (
          public.auth_can_manage_all_stocks()
          OR created_by = auth.uid()
          OR source_location_id = public.auth_branch_id()
          OR dest_location_id = public.auth_branch_id()
        )
    )
  );

-- INSERT: only via SECURITY DEFINER RPCs (no direct inserts)

-- ── 4. RPCs ──────────────────────────────────────────────────────────────────

-- ── create_transfer() ────────────────────────────────────────────────────────
-- Creates a new DRAFT transfer with items and audit trail atomically.
-- SECURITY DEFINER: actor_id derived from auth.uid(), not accepted from client.

CREATE OR REPLACE FUNCTION public.create_transfer(
  p_source_location_id  uuid,
  p_dest_location_id    uuid,
  p_notes               text DEFAULT NULL,
  p_items               jsonb DEFAULT '[]'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_transfer_id  uuid;
  v_actor        uuid := auth.uid();
  v_item         jsonb;
BEGIN
  -- ── Input validation ──
  IF p_source_location_id IS NULL OR p_dest_location_id IS NULL THEN
    RAISE EXCEPTION 'INVALID_LOCATION: source dan destination harus diisi';
  END IF;
  IF p_source_location_id = p_dest_location_id THEN
    RAISE EXCEPTION 'TRANSFER_SAME_LOCATION: source dan destination harus berbeda';
  END IF;
  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'EMPTY_TRANSFER: transfer harus memiliki minimal 1 item';
  END IF;

  -- ── Authorization ──
  IF NOT public.auth_can_manage_all_stocks() THEN
    IF public.auth_profile_role() IS DISTINCT FROM 'admin' THEN
      RAISE EXCEPTION 'FORBIDDEN: tidak berwenang membuat transfer';
    END IF;
  END IF;

  -- ── Create transfer ──
  INSERT INTO public.inventory_transfers (source_location_id, dest_location_id, notes, created_by)
  VALUES (p_source_location_id, p_dest_location_id, p_notes, v_actor)
  RETURNING id INTO v_transfer_id;

  -- ── Create items ──
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    IF (v_item->>'requested_quantity')::int <= 0 THEN
      RAISE EXCEPTION 'INVALID_QUANTITY: quantity harus positif';
    END IF;

    INSERT INTO public.inventory_transfer_items (transfer_id, stock_item_id, requested_quantity)
    VALUES (
      v_transfer_id,
      (v_item->>'stock_item_id')::uuid,
      (v_item->>'requested_quantity')::int
    );
  END LOOP;

  -- ── Audit trail (server-side, actor = auth.uid()) ──
  INSERT INTO public.inventory_transfer_history (transfer_id, action, actor_id)
  VALUES (v_transfer_id, 'CREATED', v_actor);

  RETURN v_transfer_id;
END;
$$;

COMMENT ON FUNCTION public.create_transfer IS 'Creates DRAFT transfer with items and audit trail atomically. SECURITY DEFINER.';

GRANT EXECUTE ON FUNCTION public.create_transfer(uuid, uuid, text, jsonb) TO authenticated;
REVOKE ALL ON FUNCTION public.create_transfer(uuid, uuid, text, jsonb) FROM PUBLIC;

-- ── submit_stock_transfer() ──────────────────────────────────────────────────
-- DRAFT → PENDING
-- Reserves source stock for all items.
-- Atomic: if ANY reservation fails, entire transaction rolls back (PG guarantee).
-- No manual rollback logic needed — EXCEPTION propagates, PG rolls back all changes.

CREATE OR REPLACE FUNCTION public.submit_stock_transfer(
  p_transfer_id  uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_transfer RECORD;
  v_item RECORD;
  v_role     text := public.auth_profile_role();
  v_actor    uuid := auth.uid();
BEGIN
  -- ── Lock transfer row ──
  SELECT * INTO v_transfer
  FROM public.inventory_transfers
  WHERE id = p_transfer_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'TRANSFER_NOT_FOUND: transfer tidak ditemukan';
  END IF;

  -- ── Validate status (idempotency guard) ──
  IF v_transfer.status != 'DRAFT' THEN
    IF v_transfer.status = 'PENDING' THEN
      RAISE NOTICE 'submit_stock_transfer: transfer % sudah PENDING, skip', p_transfer_id;
      RETURN;
    END IF;
    RAISE EXCEPTION 'INVALID_TRANSITION: hanya DRAFT yang dapat disubmit (current: %)', v_transfer.status;
  END IF;

  -- ── Authorization ──
  IF NOT public.auth_can_manage_all_stocks() THEN
    IF v_role IS DISTINCT FROM 'admin'
       OR v_transfer.created_by != v_actor THEN
      RAISE EXCEPTION 'FORBIDDEN: tidak berwenang submit transfer ini';
    END IF;
  END IF;

  -- ── Check has items ──
  IF NOT EXISTS (
    SELECT 1 FROM public.inventory_transfer_items WHERE transfer_id = p_transfer_id
  ) THEN
    RAISE EXCEPTION 'EMPTY_TRANSFER: transfer tidak memiliki item';
  END IF;

  -- ── Reserve stock for each item ──
  -- If any reserve_stock() fails, PG rolls back the entire function automatically.
  FOR v_item IN
    SELECT * FROM public.inventory_transfer_items WHERE transfer_id = p_transfer_id
  LOOP
    PERFORM public.reserve_stock(
      v_item.stock_item_id,
      v_transfer.source_location_id,
      v_item.requested_quantity,
      'inventory_transfer_item',
      v_item.id
    );
  END LOOP;

  -- ── Update status ──
  UPDATE public.inventory_transfers
  SET status = 'PENDING',
      submitted_at = now(),
      submitted_by = v_actor,
      updated_at = now()
  WHERE id = p_transfer_id;

  -- ── Audit trail ──
  INSERT INTO public.inventory_transfer_history (transfer_id, action, actor_id)
  VALUES (p_transfer_id, 'SUBMITTED', v_actor);

END;
$$;

COMMENT ON FUNCTION public.submit_stock_transfer IS 'DRAFT → PENDING. Reserves source stock for all items.';

GRANT EXECUTE ON FUNCTION public.submit_stock_transfer(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.submit_stock_transfer(uuid) FROM PUBLIC;

-- ── approve_stock_transfer() ─────────────────────────────────────────────────
-- PENDING → APPROVED
-- Executes atomic transfer for all items via T002.
-- All-or-nothing: if ANY item fails, entire approval rolls back.
-- This is the ONLY public RPC for PENDING → APPROVED.

CREATE OR REPLACE FUNCTION public.approve_stock_transfer(
  p_transfer_id  uuid,
  p_notes        text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_transfer RECORD;
  v_item RECORD;
  v_actor uuid := auth.uid();
  v_reserved int;
  v_dest_physical int;
  v_balance_lock RECORD;
BEGIN
  -- ── Lock transfer row ──
  SELECT * INTO v_transfer
  FROM public.inventory_transfers
  WHERE id = p_transfer_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'TRANSFER_NOT_FOUND: transfer tidak ditemukan';
  END IF;

  -- ── Validate status (idempotency guard) ──
  IF v_transfer.status != 'PENDING' THEN
    IF v_transfer.status = 'APPROVED' THEN
      RAISE NOTICE 'approve_stock_transfer: transfer % sudah APPROVED, skip', p_transfer_id;
      RETURN;
    END IF;
    RAISE EXCEPTION 'INVALID_TRANSITION: hanya PENDING yang dapat diapprove (current: %)', v_transfer.status;
  END IF;

  -- ── Authorization: management only ──
  IF NOT public.auth_can_manage_all_stocks() THEN
    RAISE EXCEPTION 'FORBIDDEN: hanya owner/admin_gudang yang dapat approve';
  END IF;

  -- ── M1: Deterministic lock ordering ──
  -- Collect ALL balance keys (source + dest for every item), sort, lock.
  -- This prevents deadlock when two transfers share overlapping items.
  FOR v_balance_lock IN
    SELECT DISTINCT si.stock_item_id, v_transfer.source_location_id AS location_id
    FROM public.inventory_transfer_items si
    WHERE si.transfer_id = p_transfer_id
    UNION
    SELECT DISTINCT si.stock_item_id, v_transfer.dest_location_id AS location_id
    FROM public.inventory_transfer_items si
    WHERE si.transfer_id = p_transfer_id
    ORDER BY stock_item_id, location_id
  LOOP
    -- Lock destination row (create if missing)
    INSERT INTO public.stock_balances (stock_item_id, location_id, physical_quantity, reserved_quantity)
    VALUES (v_balance_lock.stock_item_id, v_balance_lock.location_id, 0, 0)
    ON CONFLICT (stock_item_id, location_id) DO NOTHING;

    PERFORM 1 FROM public.stock_balances
    WHERE stock_item_id = v_balance_lock.stock_item_id
      AND location_id = v_balance_lock.location_id
    FOR UPDATE;
  END LOOP;

  -- ── Pre-validate reservations ──
  FOR v_item IN
    SELECT sti.stock_item_id, sti.requested_quantity, sti.id as item_id
    FROM public.inventory_transfer_items sti
    WHERE sti.transfer_id = p_transfer_id
    ORDER BY sti.stock_item_id
  LOOP
    SELECT reserved_quantity INTO v_reserved
    FROM public.stock_balances
    WHERE stock_item_id = v_item.stock_item_id
      AND location_id = v_transfer.source_location_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'BALANCE_NOT_FOUND: source balance tidak ditemukan untuk item %', v_item.stock_item_id;
    END IF;

    IF v_reserved < v_item.requested_quantity THEN
      RAISE EXCEPTION 'RESERVATION_RELEASED: reservasi untuk item % telah dilepas atau tidak mencukupi (reserved: %, required: %)',
        v_item.stock_item_id, v_reserved, v_item.requested_quantity;
    END IF;
  END LOOP;

  -- ── Execute transfer for each item ──
  -- All balance rows locked in deterministic order; safe to mutate.
  FOR v_item IN
    SELECT * FROM public.inventory_transfer_items WHERE transfer_id = p_transfer_id
  LOOP
    UPDATE public.stock_balances
    SET physical_quantity = physical_quantity - v_item.requested_quantity,
        reserved_quantity = reserved_quantity - v_item.requested_quantity,
        updated_at = now()
    WHERE stock_item_id = v_item.stock_item_id
      AND location_id = v_transfer.source_location_id;

    UPDATE public.stock_balances
    SET physical_quantity = physical_quantity + v_item.requested_quantity,
        updated_at = now()
    WHERE stock_item_id = v_item.stock_item_id
      AND location_id = v_transfer.dest_location_id;

    -- C1 fix: result_quantity = post-UPDATE physical_quantity (no double-count)
    INSERT INTO public.stock_movements (
      source, actor, stock_item_id, location_id, delta, result_quantity,
      reason, ref_type, ref_id, movement_type
    )
    SELECT
      'transfer', v_actor, v_item.stock_item_id, v_transfer.source_location_id,
      -v_item.requested_quantity,
      sb.physical_quantity,
      'Transfer approved: source outbound',
      'inventory_transfer_item', v_item.id, 'TRANSFER_OUT'
    FROM public.stock_balances sb
    WHERE sb.stock_item_id = v_item.stock_item_id
      AND sb.location_id = v_transfer.source_location_id;

    INSERT INTO public.stock_movements (
      source, actor, stock_item_id, location_id, delta, result_quantity,
      reason, ref_type, ref_id, movement_type
    )
    SELECT
      'transfer', v_actor, v_item.stock_item_id, v_transfer.dest_location_id,
      v_item.requested_quantity,
      sb.physical_quantity,
      'Transfer approved: destination inbound',
      'inventory_transfer_item', v_item.id, 'TRANSFER_IN'
    FROM public.stock_balances sb
    WHERE sb.stock_item_id = v_item.stock_item_id
      AND sb.location_id = v_transfer.dest_location_id;
  END LOOP;

  UPDATE public.inventory_transfers
  SET status = 'APPROVED',
      resolved_at = now(),
      resolved_by = v_actor,
      notes = COALESCE(p_notes, notes),
      updated_at = now()
  WHERE id = p_transfer_id;

  INSERT INTO public.inventory_transfer_history (transfer_id, action, actor_id, notes)
  VALUES (p_transfer_id, 'APPROVED', v_actor, p_notes);

END;
$$;

COMMENT ON FUNCTION public.approve_stock_transfer IS 'PENDING → APPROVED. Atomic transfer via T002. All-or-nothing.';

GRANT EXECUTE ON FUNCTION public.approve_stock_transfer(uuid, text) TO authenticated;
REVOKE ALL ON FUNCTION public.approve_stock_transfer(uuid, text) FROM PUBLIC;

-- ── reject_stock_transfer() ──────────────────────────────────────────────────
-- PENDING → REJECTED
-- Releases reservations for all items.

CREATE OR REPLACE FUNCTION public.reject_stock_transfer(
  p_transfer_id  uuid,
  p_reason       text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_transfer RECORD;
  v_item RECORD;
  v_actor uuid := auth.uid();
BEGIN
  -- ── Lock transfer row ──
  SELECT * INTO v_transfer
  FROM public.inventory_transfers
  WHERE id = p_transfer_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'TRANSFER_NOT_FOUND: transfer tidak ditemukan';
  END IF;

  -- ── Validate status (idempotency guard) ──
  IF v_transfer.status != 'PENDING' THEN
    IF v_transfer.status = 'REJECTED' THEN
      RAISE NOTICE 'reject_stock_transfer: transfer % sudah REJECTED, skip', p_transfer_id;
      RETURN;
    END IF;
    IF v_transfer.status = 'APPROVED' THEN
      RAISE EXCEPTION 'INVALID_TRANSITION: transfer sudah APPROVED, tidak dapat direject';
    END IF;
    RAISE EXCEPTION 'INVALID_TRANSITION: hanya PENDING yang dapat direject (current: %)', v_transfer.status;
  END IF;

  -- ── Authorization: management only ──
  IF NOT public.auth_can_manage_all_stocks() THEN
    RAISE EXCEPTION 'FORBIDDEN: hanya owner/admin_gudang yang dapat reject';
  END IF;

  -- ── Validate reason ──
  IF p_reason IS NULL OR trim(p_reason) = '' THEN
    RAISE EXCEPTION 'REJECT_REASON_REQUIRED: alasan reject wajib diisi';
  END IF;

  -- ── Release reservations for each item ──
  FOR v_item IN
    SELECT * FROM public.inventory_transfer_items WHERE transfer_id = p_transfer_id
  LOOP
    PERFORM public.release_reservation(
      v_item.stock_item_id,
      v_transfer.source_location_id,
      v_item.requested_quantity,
      'inventory_transfer_item',
      v_item.id
    );
  END LOOP;

  -- ── Update status ──
  UPDATE public.inventory_transfers
  SET status = 'REJECTED',
      resolved_at = now(),
      resolved_by = v_actor,
      reject_reason = p_reason,
      updated_at = now()
  WHERE id = p_transfer_id;

  -- ── Audit trail ──
  INSERT INTO public.inventory_transfer_history (transfer_id, action, actor_id, notes)
  VALUES (p_transfer_id, 'REJECTED', v_actor, p_reason);

END;
$$;

COMMENT ON FUNCTION public.reject_stock_transfer IS 'PENDING → REJECTED. Releases reservations.';

GRANT EXECUTE ON FUNCTION public.reject_stock_transfer(uuid, text) TO authenticated;
REVOKE ALL ON FUNCTION public.reject_stock_transfer(uuid, text) FROM PUBLIC;

-- ── HARDEN-001: CHECK constraint for reject_reason ────────────────────────────
-- Enforces: when status = 'REJECTED', reject_reason must NOT be NULL.
-- Defense-in-depth: reject_stock_transfer() already validates at RPC level,
-- but this prevents direct SQL from bypassing the validation.

ALTER TABLE public.inventory_transfers
  ADD CONSTRAINT chk_reject_reason_required
  CHECK (status != 'REJECTED' OR reject_reason IS NOT NULL);

COMMENT ON CONSTRAINT chk_reject_reason_required ON public.inventory_transfers
  IS 'HARDEN-001: Ensures rejected transfers always have a reject reason.';

-- ============================================================================
-- MIGRATION NOTES
-- ============================================================================
-- 1. inventory_transfers: source != destination enforced by CHECK.
-- 2. inventory_transfer_items: one row per item per transfer (UNIQUE constraint).
-- 3. inventory_transfer_history: separate from stock_movements (lifecycle vs physical).
--    All mutations via SECURITY DEFINER RPCs only. No direct INSERT allowed.
-- 4. All RPCs use SECURITY DEFINER + SET search_path = public.
--    REVOKE ALL ... FROM PUBLIC on all public RPCs (defense-in-depth).
-- 5. create_transfer(): atomic creation + CREATED audit trail. actor = auth.uid().
-- 6. submit_stock_transfer(): releases all reservations on partial failure.
-- 7. approve_stock_transfer(): deterministic lock ordering (stock_item_id, location_id)
--    across ALL source+dest balances before mutation. C1 fix: result_quantity uses
--    post-UPDATE physical_quantity (no double-count).
-- 8. reject_stock_transfer(): requires reject_reason.
-- 9. HARDEN-001: CHECK constraint prevents rejected transfers without reason.
-- 10. Legacy tables NOT modified. Legacy stock_transfers NOT modified (deprecated but preserved).
-- =============================================================================