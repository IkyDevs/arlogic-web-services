-- ============================================================================
-- INVENTORY HARDENING PHASE A
--
-- HARDEN-001: CHECK constraint for reject_reason
-- HARDEN-003: Pre-approval reservation validation in approve_stock_transfer()
--
-- PRODUCTION SAFETY:
--   - Additive only (no destructive operations)
--   - No existing data violations (T003 unused in production)
--   - All changes isolated to canonical inventory tables
--   - Legacy tables NOT modified
--
-- DEPENDS ON:
--   - 20260831_stock_transfer_lifecycle.sql (T003)
--   - 20260830_inventory_movement_engine.sql (T002)
-- =============================================================================

-- ── HARDEN-001: CHECK constraint for reject_reason ────────────────────────────
-- Enforces: when status = 'REJECTED', reject_reason must NOT be NULL.
-- Defense-in-depth: reject_stock_transfer() already validates at RPC level,
-- but this prevents direct SQL from bypassing the validation.

ALTER TABLE public.stock_transfers
  ADD CONSTRAINT chk_reject_reason_required
  CHECK (status != 'REJECTED' OR reject_reason IS NOT NULL);

COMMENT ON CONSTRAINT chk_reject_reason_required ON public.stock_transfers
  IS 'HARDEN-001: Ensures rejected transfers always have a reject reason.';

-- ── HARDEN-003: Pre-approval reservation validation ───────────────────────────
-- Replaces approve_stock_transfer() with hardened version that:
--   1. Locks source balance rows BEFORE validation (FOR UPDATE)
--   2. Verifies reservation exists and is sufficient for each item
--   3. Raises deterministic RESERVATION_RELEASED error if reservation missing/insufficient
--   4. Prevents race condition with concurrent release_reservation()
--
-- CONCURRENCY ANALYSIS:
--   - approve_stock_transfer() locks transfer row (FOR UPDATE) at start
--   - NEW: Locks source balance rows (FOR UPDATE) before validation
--   - release_reservation() also locks source balance (FOR UPDATE)
--   - If approve acquires lock first → release blocks → approve validates → success
--   - If release acquires lock first → decreases reserved → approve blocks → then
--     approve acquires lock → finds reserved < requested → fails with clear error
--   - No deadlock: same transaction, same row → FOR UPDATE is idempotent

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
  v_source_balance RECORD;
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

  -- ── HARDEN-003: Pre-validate reservations ──
  -- Lock source balance rows and verify reservation is sufficient for each item.
  -- This must happen BEFORE execute_transfer_approval() to prevent race condition
  -- with concurrent release_reservation().
  --
  -- Lock ordering: same as execute_transfer_approval() (UUID comparison) to avoid deadlock.
  FOR v_item IN
    SELECT sti.stock_item_id, sti.requested_quantity, sti.id as item_id
    FROM public.stock_transfer_items sti
    WHERE sti.transfer_id = p_transfer_id
    ORDER BY sti.stock_item_id  -- Deterministic order
  LOOP
    -- Lock source balance row (FOR UPDATE)
    -- This blocks concurrent release_reservation() from modifying the same row
    SELECT sb.reserved_quantity, sb.physical_quantity
    INTO v_reserved, v_source_balance
    FROM public.stock_balances sb
    WHERE sb.stock_item_id = v_item.stock_item_id
      AND sb.location_id = v_transfer.source_location_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'BALANCE_NOT_FOUND: source balance tidak ditemukan untuk item %', v_item.stock_item_id;
    END IF;

    -- Verify reservation is sufficient
    IF v_reserved < v_item.requested_quantity THEN
      RAISE EXCEPTION 'RESERVATION_RELEASED: reservasi untuk item % telah dilepas atau tidak mencukupi (reserved: %, required: %)',
        v_item.stock_item_id, v_reserved, v_item.requested_quantity;
    END IF;
  END LOOP;

  -- ── Execute transfer for each item ──
  -- At this point, all source balance rows are locked and reservations verified.
  -- execute_transfer_approval() will re-acquire the same locks (idempotent) and
  -- proceed without blocking.
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

COMMENT ON FUNCTION public.approve_stock_transfer IS 'HARDEN-003: PENDING → APPROVED. Pre-validates reservations before execution. Atomic via T002.';

-- ============================================================================
-- MIGRATION NOTES
-- ============================================================================
-- 1. HARDEN-001: CHECK constraint is additive, no existing data violations.
-- 2. HARDEN-003: Pre-validation loop locks source balances BEFORE execution.
-- 3. FOR UPDATE is idempotent: same transaction, same row = no deadlock.
-- 4. Race condition prevented: release_reservation() blocks on FOR UPDATE.
-- 5. Deterministic error: RESERVATION_RELEASED for clear failure communication.
-- 6. Legacy tables NOT modified.
-- ============================================================================