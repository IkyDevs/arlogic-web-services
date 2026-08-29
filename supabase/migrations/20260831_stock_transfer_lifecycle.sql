-- ============================================================================
-- STOCK TRANSFER LIFECYCLE (T003)
--
-- Implements the Inventory Transfer business lifecycle:
--   DRAFT → PENDING → APPROVED / REJECTED
--
-- Tables:
--   stock_transfers        -> transfer header (status, locations, actors)
--   stock_transfer_items   -> line items (item, quantity)
--   stock_transfer_history -> lifecycle audit trail
--
-- RPCs:
--   submit_stock_transfer()   -> DRAFT → PENDING (reserves items)
--   approve_stock_transfer()  -> PENDING → APPROVED (executes transfer)
--   reject_stock_transfer()   → PENDING → REJECTED (releases reservations)
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
-- LEGACY COMPATIBILITY:
--   Legacy tables (inventory, stock_toko, stock_gudang) NOT modified.
--   Legacy RPCs NOT modified.
-- =============================================================================

-- ── 1. TABLES ────────────────────────────────────────────────────────────────

-- ── stock_transfers ──────────────────────────────────────────────────────────
-- Transfer header. Tracks lifecycle, locations, and actors.

CREATE TABLE IF NOT EXISTS public.stock_transfers (
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

COMMENT ON TABLE public.stock_transfers IS 'Transfer header. Lifecycle: DRAFT → PENDING → APPROVED/REJECTED.';
COMMENT ON COLUMN public.stock_transfers.status IS 'Lifecycle state: DRAFT, PENDING, APPROVED, REJECTED.';
COMMENT ON COLUMN public.stock_transfers.source_location_id IS 'Source branch/warehouse.';
COMMENT ON COLUMN public.stock_transfers.dest_location_id IS 'Destination branch/warehouse.';
COMMENT ON COLUMN public.stock_transfers.notes IS 'Transfer reason/purpose.';
COMMENT ON COLUMN public.stock_transfers.reject_reason IS 'Required when status = REJECTED.';

-- ── stock_transfer_items ─────────────────────────────────────────────────────
-- Line items. One row per stock item per transfer.

CREATE TABLE IF NOT EXISTS public.stock_transfer_items (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transfer_id         uuid NOT NULL REFERENCES public.stock_transfers(id) ON DELETE CASCADE,
  stock_item_id       uuid NOT NULL REFERENCES public.stock_items(id),
  requested_quantity  int4 NOT NULL CHECK (requested_quantity > 0),

  -- One row per item per transfer
  UNIQUE (transfer_id, stock_item_id)
);

COMMENT ON TABLE public.stock_transfer_items IS 'Transfer line items. One row per stock item.';
COMMENT ON COLUMN public.stock_transfer_items.requested_quantity IS 'Requested quantity (positive). All-or-nothing approval.';

-- ── stock_transfer_history ───────────────────────────────────────────────────
-- Lifecycle audit trail. Separate from stock_movements (physical mutations).

CREATE TABLE IF NOT EXISTS public.stock_transfer_history (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transfer_id     uuid NOT NULL REFERENCES public.stock_transfers(id) ON DELETE CASCADE,
  action          text NOT NULL
                    CHECK (action IN ('CREATED', 'SUBMITTED', 'APPROVED', 'REJECTED')),
  actor_id        uuid NOT NULL REFERENCES auth.users(id),
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.stock_transfer_history IS 'Transfer lifecycle audit trail. Physical mutations are in stock_movements.';

-- ── 2. INDEXES ───────────────────────────────────────────────────────────────

-- stock_transfers
CREATE INDEX IF NOT EXISTS idx_stock_transfers_status ON public.stock_transfers (status);
CREATE INDEX IF NOT EXISTS idx_stock_transfers_source ON public.stock_transfers (source_location_id);
CREATE INDEX IF NOT EXISTS idx_stock_transfers_dest ON public.stock_transfers (dest_location_id);
CREATE INDEX IF NOT EXISTS idx_stock_transfers_created_by ON public.stock_transfers (created_by);

-- stock_transfer_items
CREATE INDEX IF NOT EXISTS idx_stock_transfer_items_transfer ON public.stock_transfer_items (transfer_id);
CREATE INDEX IF NOT EXISTS idx_stock_transfer_items_stock_item ON public.stock_transfer_items (stock_item_id);

-- stock_transfer_history
CREATE INDEX IF NOT EXISTS idx_stock_transfer_history_transfer ON public.stock_transfer_history (transfer_id);

-- ── 3. RLS ───────────────────────────────────────────────────────────────────
-- Authorization using existing helpers:
--   auth_profile_role()        -> user role text
--   auth_branch_id()           -> user branch uuid
--   auth_can_manage_all_stocks() -> owner or admin_gudang

-- ── stock_transfers RLS ──────────────────────────────────────────────────────
ALTER TABLE public.stock_transfers ENABLE ROW LEVEL SECURITY;

-- SELECT: management, creator, or source/dest branch
CREATE POLICY stock_transfers_select_authenticated
  ON public.stock_transfers FOR SELECT TO authenticated
  USING (
    public.auth_can_manage_all_stocks()
    OR created_by = auth.uid()
    OR source_location_id = public.auth_branch_id()
    OR dest_location_id = public.auth_branch_id()
  );

-- INSERT: management or admin
CREATE POLICY stock_transfers_insert_authenticated
  ON public.stock_transfers FOR INSERT TO authenticated
  WITH CHECK (
    public.auth_can_manage_all_stocks()
    OR public.auth_profile_role() = 'admin'
  );

-- UPDATE: management, or creator if DRAFT
CREATE POLICY stock_transfers_update_authenticated
  ON public.stock_transfers FOR UPDATE TO authenticated
  USING (
    public.auth_can_manage_all_stocks()
    OR (status = 'DRAFT' AND created_by = auth.uid())
  )
  WITH CHECK (
    public.auth_can_manage_all_stocks()
    OR (status = 'DRAFT' AND created_by = auth.uid())
  );

-- ── stock_transfer_items RLS ─────────────────────────────────────────────────
ALTER TABLE public.stock_transfer_items ENABLE ROW LEVEL SECURITY;

-- SELECT: via parent transfer
CREATE POLICY stock_transfer_items_select_authenticated
  ON public.stock_transfer_items FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.stock_transfers
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
CREATE POLICY stock_transfer_items_insert_authenticated
  ON public.stock_transfer_items FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.stock_transfers
      WHERE id = transfer_id
        AND status = 'DRAFT'
        AND (
          public.auth_can_manage_all_stocks()
          OR created_by = auth.uid()
        )
    )
  );

-- UPDATE: via parent transfer (DRAFT only)
CREATE POLICY stock_transfer_items_update_authenticated
  ON public.stock_transfer_items FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.stock_transfers
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
      SELECT 1 FROM public.stock_transfers
      WHERE id = transfer_id
        AND status = 'DRAFT'
        AND (
          public.auth_can_manage_all_stocks()
          OR created_by = auth.uid()
        )
    )
  );

-- DELETE: via parent transfer (DRAFT only)
CREATE POLICY stock_transfer_items_delete_authenticated
  ON public.stock_transfer_items FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.stock_transfers
      WHERE id = transfer_id
        AND status = 'DRAFT'
        AND (
          public.auth_can_manage_all_stocks()
          OR created_by = auth.uid()
        )
    )
  );

-- ── stock_transfer_history RLS ───────────────────────────────────────────────
ALTER TABLE public.stock_transfer_history ENABLE ROW LEVEL SECURITY;

-- SELECT: via parent transfer
CREATE POLICY stock_transfer_history_select_authenticated
  ON public.stock_transfer_history FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.stock_transfers
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

-- ── submit_stock_transfer() ──────────────────────────────────────────────────
-- DRAFT → PENDING
-- Reserves source stock for all items.
-- If ANY item fails, releases all previously reserved items.

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
  v_reserved uuid[];
  v_item_id  uuid;
BEGIN
  -- ── Lock transfer row ──
  SELECT * INTO v_transfer
  FROM public.stock_transfers
  WHERE id = p_transfer_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'TRANSFER_NOT_FOUND: transfer tidak ditemukan';
  END IF;

  -- ── Validate status ──
  IF v_transfer.status != 'DRAFT' THEN
    RAISE EXCEPTION 'INVALID_TRANSITION: hanya DRAFT yang dapat disubmit';
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
    SELECT 1 FROM public.stock_transfer_items WHERE transfer_id = p_transfer_id
  ) THEN
    RAISE EXCEPTION 'EMPTY_TRANSFER: transfer tidak memiliki item';
  END IF;

  -- ── Reserve stock for each item ──
  v_reserved := ARRAY[]::uuid[];
  FOR v_item IN
    SELECT * FROM public.stock_transfer_items WHERE transfer_id = p_transfer_id
  LOOP
    BEGIN
      PERFORM public.reserve_stock(
        v_item.stock_item_id,
        v_transfer.source_location_id,
        v_item.requested_quantity,
        'stock_transfer_item',
        v_item.id
      );
      v_reserved := array_append(v_reserved, v_item.id);
    EXCEPTION WHEN OTHERS THEN
      -- Release all previously reserved items
      FOREACH v_item_id IN ARRAY v_reserved
      LOOP
        DECLARE
          v_prev_item RECORD;
        BEGIN
          SELECT * INTO v_prev_item
          FROM public.stock_transfer_items
          WHERE id = v_item_id;

          PERFORM public.release_reservation(
            v_prev_item.stock_item_id,
            v_transfer.source_location_id,
            v_prev_item.requested_quantity,
            'stock_transfer_item',
            v_prev_item.id
          );
        END;
      END LOOP;
      RAISE;
    END;
  END LOOP;

  -- ── Update status ──
  UPDATE public.stock_transfers
  SET status = 'PENDING',
      submitted_at = now(),
      submitted_by = v_actor,
      updated_at = now()
  WHERE id = p_transfer_id;

  -- ── Audit trail ──
  INSERT INTO public.stock_transfer_history (transfer_id, action, actor_id)
  VALUES (p_transfer_id, 'SUBMITTED', v_actor);

END;
$$;

COMMENT ON FUNCTION public.submit_stock_transfer IS 'DRAFT → PENDING. Reserves source stock for all items.';

-- ── approve_stock_transfer() ─────────────────────────────────────────────────
-- PENDING → APPROVED
-- Executes atomic transfer for all items via T002.
-- All-or-nothing: if ANY item fails, entire approval rolls back.

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
BEGIN
  -- ── Lock transfer row ──
  SELECT * INTO v_transfer
  FROM public.stock_transfers
  WHERE id = p_transfer_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'TRANSFER_NOT_FOUND: transfer tidak ditemukan';
  END IF;

  -- ── Validate status ──
  IF v_transfer.status != 'PENDING' THEN
    RAISE EXCEPTION 'INVALID_TRANSITION: hanya PENDING yang dapat diapprove';
  END IF;

  -- ── Authorization: management only ──
  IF NOT public.auth_can_manage_all_stocks() THEN
    RAISE EXCEPTION 'FORBIDDEN: hanya owner/admin_gudang yang dapat approve';
  END IF;

  -- ── Execute transfer for each item ──
  FOR v_item IN
    SELECT * FROM public.stock_transfer_items WHERE transfer_id = p_transfer_id
  LOOP
    PERFORM public.execute_transfer_approval(
      v_item.stock_item_id,
      v_transfer.source_location_id,
      v_transfer.dest_location_id,
      v_item.requested_quantity,
      'stock_transfer_item',
      v_item.id,
      'stock_transfer_item',
      v_item.id
    );
  END LOOP;

  -- ── Update status ──
  UPDATE public.stock_transfers
  SET status = 'APPROVED',
      resolved_at = now(),
      resolved_by = v_actor,
      notes = COALESCE(p_notes, notes),
      updated_at = now()
  WHERE id = p_transfer_id;

  -- ── Audit trail ──
  INSERT INTO public.stock_transfer_history (transfer_id, action, actor_id, notes)
  VALUES (p_transfer_id, 'APPROVED', v_actor, p_notes);

END;
$$;

COMMENT ON FUNCTION public.approve_stock_transfer IS 'PENDING → APPROVED. Atomic transfer via T002. All-or-nothing.';

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
  FROM public.stock_transfers
  WHERE id = p_transfer_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'TRANSFER_NOT_FOUND: transfer tidak ditemukan';
  END IF;

  -- ── Validate status ──
  IF v_transfer.status != 'PENDING' THEN
    RAISE EXCEPTION 'INVALID_TRANSITION: hanya PENDING yang dapat direject';
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
    SELECT * FROM public.stock_transfer_items WHERE transfer_id = p_transfer_id
  LOOP
    PERFORM public.release_reservation(
      v_item.stock_item_id,
      v_transfer.source_location_id,
      v_item.requested_quantity,
      'stock_transfer_item',
      v_item.id
    );
  END LOOP;

  -- ── Update status ──
  UPDATE public.stock_transfers
  SET status = 'REJECTED',
      resolved_at = now(),
      resolved_by = v_actor,
      reject_reason = p_reason,
      updated_at = now()
  WHERE id = p_transfer_id;

  -- ── Audit trail ──
  INSERT INTO public.stock_transfer_history (transfer_id, action, actor_id, notes)
  VALUES (p_transfer_id, 'REJECTED', v_actor, p_reason);

END;
$$;

COMMENT ON FUNCTION public.reject_stock_transfer IS 'PENDING → REJECTED. Releases reservations.';

-- ============================================================================
-- MIGRATION NOTES
-- ============================================================================
-- 1. stock_transfers: source != destination enforced by CHECK.
-- 2. stock_transfer_items: one row per item per transfer (UNIQUE constraint).
-- 3. stock_transfer_history: separate from stock_movements (lifecycle vs physical).
-- 4. All RPCs use SECURITY DEFINER to bypass RLS.
-- 5. submit_stock_transfer(): releases all reservations on partial failure.
-- 6. approve_stock_transfer(): atomic via T002 execute_transfer_approval().
-- 7. reject_stock_transfer(): requires reject_reason.
-- 8. Legacy tables NOT modified.
-- ============================================================================
