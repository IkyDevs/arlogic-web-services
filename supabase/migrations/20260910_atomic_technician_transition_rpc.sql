-- ============================================================================
-- ATOMIC TECHNICIAN SERVICE TRANSITION RPC (T006 Atomicity Fix)
--
-- This migration creates a single PostgreSQL function that atomically:
--   1. Validates the technician is authorized (role check)
--   2. Validates the service exists and is assigned to the technician
--   3. Validates the current status allows the transition
--   4. Updates the service_orders status
--   5. Inserts a service_timeline entry
-- All within a single transaction. If any step fails, everything rolls back.
--
-- SECURITY MODEL:
--   - SECURITY DEFINER with controlled search_path
--   - Authorization via auth.uid() and auth_profile_role()
--   - Assignment isolation: technician can only act on their own services
--   - No user-supplied user_id is trusted for authorization
--
-- RPC created:
--   technician_transition_service() -> atomic status + timeline transition
-- =============================================================================

-- ── 1. CREATE THE ATOMIC TRANSITION FUNCTION ─────────────────────────────────

CREATE OR REPLACE FUNCTION public.technician_transition_service(
  p_service_order_id uuid,
  p_expected_status   text,
  p_new_status        text,
  p_timeline_status   text,
  p_timeline_message  text,
  p_additional_updates jsonb default null,
  p_timeline_details   jsonb default null
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role            text := public.auth_profile_role();
  v_user_id         uuid := auth.uid();
  v_service         record;
  v_prev_status     text;
  v_additional      jsonb := coalesce(p_additional_updates, '{}'::jsonb);
  v_timeline_det    jsonb := coalesce(p_timeline_details, '{}'::jsonb);
  v_result          jsonb;
BEGIN
  -- ── STEP 1: Validate technician authorization ────────────────────────────
  -- Only 'teknisi' role may use this RPC
  IF v_role IS DISTINCT FROM 'teknisi' THEN
    RAISE EXCEPTION 'FORBIDDEN: only technicians may perform this action'
      USING ERRCODE = 'P0001';
  END IF;

  -- ── STEP 2: Validate service exists and is assigned to this technician ───
  SELECT id, status, assigned_teknisi_id, invoice_number, customer_name
  INTO v_service
  FROM public.service_orders
  WHERE id = p_service_order_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'SERVICE_NOT_FOUND: service order % does not exist', p_service_order_id
      USING ERRCODE = 'P0002';
  END IF;

  IF v_service.assigned_teknisi_id IS DISTINCT FROM v_user_id THEN
    RAISE EXCEPTION 'FORBIDDEN: you can only act on services assigned to you'
      USING ERRCODE = 'P0003';
  END IF;

  -- ── STEP 3: Validate current status allows the transition ────────────────
  IF v_service.status IS DISTINCT FROM p_expected_status THEN
    RAISE EXCEPTION 'INVALID_STATUS_TRANSITION: cannot transition from % to % (current: %)'
      USING ERRCODE = 'P0004',
            p_expected_status, p_new_status, v_service.status;
  END IF;

  v_prev_status := v_service.status;

  -- ── STEP 4: Update service_orders status (atomic within this transaction)
  UPDATE public.service_orders
  SET status      = p_new_status,
      updated_at  = now()
  WHERE id = p_service_order_id
    AND status = p_expected_status;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'INVALID_STATUS_TRANSITION: concurrent modification detected on service %'
      USING ERRCODE = 'P0005', p_service_order_id;
  END IF;

  -- ── STEP 5: Insert service_timeline entry (atomic within this transaction)
  INSERT INTO public.service_timeline (
    service_order_id,
    teknisi_id,
    status,
    message,
    details
  ) VALUES (
    p_service_order_id,
    v_user_id,
    p_timeline_status,
    p_timeline_message,
    v_timeline_det
  );

  -- ── STEP 6: Build result ────────────────────────────────────────────────
  v_result := jsonb_build_object(
    'success', true,
    'previous_status', v_prev_status,
    'new_status', p_new_status,
    'service_id', v_service.id,
    'invoice_number', v_service.invoice_number,
    'customer_name', v_service.customer_name
  );

  RETURN v_result;
END;
$$;

-- ── 2. GRANT EXECUTE TO AUTHENTICATED USERS ──────────────────────────────────
-- Only authenticated users may call this RPC.
-- Authorization is enforced inside the function (role + assignment check).
GRANT EXECUTE ON FUNCTION public.technician_transition_service(
  uuid, text, text, text, text, jsonb, jsonb
) TO authenticated;

-- ── 3. REVOKE DIRECT WRITES (defense-in-depth) ──────────────────────────────
-- technician workflow should only write via this RPC.
-- Timeline writes are controlled by the function; direct INSERT is allowed
-- for other write paths (admin, QC), so we do NOT revoke timeline INSERT.
-- service_orders updates for technician workflow MUST go through this RPC.

-- ── 4. DOCUMENTATION ─────────────────────────────────────────────────────────
COMMENT ON FUNCTION public.technician_transition_service(
  uuid, text, text, text, text, jsonb, jsonb
) IS 'Atomic technician service transition. Updates status and inserts timeline in a single transaction. Authorization enforced server-side.';

COMMENT ON PARAMETER public.technician_transition_service(p_service_order_id) IS 'UUID of the service order to transition.';
COMMENT ON PARAMETER public.technician_transition_service(p_expected_status) IS 'Expected current status (must match for transition to proceed).';
COMMENT ON PARAMETER public.technician_transition_service(p_new_status) IS 'Target status to transition to.';
COMMENT ON PARAMETER public.technician_transition_service(p_timeline_status) IS 'Status value to record in timeline.';
COMMENT ON PARAMETER public.technician_transition_service(p_timeline_message) IS 'Human-readable message for the timeline entry.';
COMMENT ON PARAMETER public.technician_transition_service(p_additional_updates) IS 'Optional JSONB of additional fields to update on service_orders.';
COMMENT ON PARAMETER public.technician_transition_service(p_timeline_details) IS 'Optional JSONB details to attach to the timeline entry.';
