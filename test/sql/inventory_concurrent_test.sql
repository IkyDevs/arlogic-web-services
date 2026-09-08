-- ============================================================================
-- CONCURRENT IDEMPOTENCY TESTS (dblink-based)
-- ============================================================================
-- WHY dblink?
--   Supabase SQL Editor executes statements sequentially within ONE session.
--   True concurrency requires TWO independent sessions holding their own
--   transaction and FOR UPDATE lock simultaneously. dblink spawns a second
--   connection from within PL/pgSQL, enabling genuine overlap.
--
-- LIMITATION:
--   dblink must be installed: CREATE EXTENSION IF NOT EXISTS dblink;
--   Some Supabase projects may not have it. If dblink is unavailable,
--   these tests will SKIP gracefully with a notice.
--
-- PREREQUISITES:
--   1. Run in Supabase SQL Editor as postgres/owner role.
--   2. dblink extension must be installable (SELECT * FROM pg_available_extensions
--      WHERE name = 'dblink').
--   3. Run AFTER inventory_idempotency_test.sql (assumes tables exist).
--
-- MECHANISM:
--   1. Seed a balance row with physical_quantity = 100.
--   2. Spawn dblink session B.
--   3. In MAIN session: BEGIN; SELECT ... FOR UPDATE (acquires row lock).
--   4. In session B: execute same adjust_stock (blocks on FOR UPDATE).
--   5. In MAIN session: INSERT movement, UPDATE balance, COMMIT (releases lock).
--   6. In session B: lock acquired, INSERT movement → UNIQUE violation →
--      transaction aborted, balance NOT mutated.
--   7. Verify: exactly 1 movement, balance changed exactly once, correct final value.
-- ============================================================================

-- ── Prerequisite check ──────────────────────────────────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'dblink') THEN
    RAISE NOTICE 'SKIPPING CONCURRENT TESTS: dblink extension not available on this server.';
    RAISE NOTICE 'To run these tests, install dblink: CREATE EXTENSION IF NOT EXISTS dblink;';
  END IF;
END;
$$;

-- ── Helpers ─────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public._ctest_reset()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.stock_movements
  WHERE stock_item_id = '11111111-2222-3333-4444-555555555555';
  DELETE FROM public.stock_balances
  WHERE stock_item_id = '11111111-2222-3333-4444-555555555555';
  DELETE FROM public.stock_items
  WHERE id = '11111111-2222-3333-4444-555555555555';
  PERFORM dblink_disconnect('concurrent_test') WHERE dblink_get_connections() @> ARRAY['concurrent_test'];
EXCEPTION WHEN OTHERS THEN
  NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public._ctest_seed(p_initial int DEFAULT 100)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_branch uuid;
BEGIN
  PERFORM public._ctest_reset();

  INSERT INTO public.stock_items (id, name, sku, item_class, unit, is_active)
  VALUES ('11111111-2222-3333-4444-555555555555', 'Concurrent Test Item', 'CTEST-001', 'sparepart', 'pcs', true);

  SELECT id INTO v_branch FROM public.branches WHERE is_central = true LIMIT 1;

  INSERT INTO public.stock_balances (stock_item_id, location_id, physical_quantity, reserved_quantity)
  VALUES ('11111111-2222-3333-4444-555555555555', v_branch, p_initial, 0);

  RETURN v_branch;
END;
$$;

-- ══════════════════════════════════════════════════════════════════════════════
-- TEST C1: adjust_stock — concurrent duplicate adjust_stock cannot double-mutate
-- ══════════════════════════════════════════════════════════════════════════════
--
-- Scenario:
--   Session A (main): adjust_stock(item, loc, -20, ref_type='adj', ref_id=X)
--   Session B (dblink): same adjust_stock(item, loc, -20, ref_type='adj', ref_id=X)
--
-- Expected:
--   Session A commits successfully, balance 100 → 80.
--   Session B: UNIQUE violation on stock_movements → transaction aborted.
--   Final: balance = 80, movements = 1, last result_quantity = 80.
-- ══════════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  v_branch     uuid;
  v_ref_id     uuid := gen_random_uuid();
  v_item       uuid := '11111111-2222-3333-4444-555555555555';
  v_conn       text;
  v_dbname     text;
  v_b_result   text;
  v_b_error    text;
  v_movement   RECORD;
  v_balance    RECORD;
  v_mvt_count  bigint;
  v_branch_text text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'dblink') THEN
    RAISE NOTICE 'TEST C1 SKIP: dblink not available';
    RETURN;
  END IF;

  v_branch := public._ctest_seed(100);
  v_branch_text := v_branch::text;

  SELECT current_database() INTO v_dbname;
  v_conn := 'dbname=' || v_dbname;

  PERFORM dblink_disconnect('concurrent_test') WHERE dblink_get_connections() @> ARRAY['concurrent_test'];
  PERFORM dblink_connect('concurrent_test', v_conn);

  -- Session A: BEGIN + lock the balance row (does not commit yet)
  PERFORM dblink('concurrent_test', 'BEGIN');

  -- Session B: send adjust_stock (will block on FOR UPDATE until A commits/rolls back)
  PERFORM dblink_send_query('concurrent_test',
    format(
      'SELECT public.adjust_stock(%L::uuid, %L::uuid, -20, %L, %L, %L, %L::uuid)',
      v_item, v_branch_text, 'test', 'concurrent dup', 'adj', v_ref_id
    )
  );

  -- Small delay to let session B start and block on lock
  PERFORM pg_sleep(0.3);

  -- Session A: execute adjust_stock (acquires lock, inserts movement, updates balance)
  BEGIN
    PERFORM public.adjust_stock(
      v_item, v_branch, -20,
      'test', 'concurrent A', 'adj', v_ref_id
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'TEST C1 FAIL: session A raised: %', SQLERRM;
  END;

  -- Session A: COMMIT (releases lock, session B unblocks)
  PERFORM dblink('concurrent_test', 'COMMIT');

  -- Wait for session B to finish
  PERFORM pg_sleep(0.5);

  -- Collect session B result
  BEGIN
    SELECT result INTO v_b_result
    FROM dblink_get_result('concurrent_test') AS t(result text);
  EXCEPTION WHEN OTHERS THEN
    v_b_error := SQLERRM;
  END;

  -- Drain any remaining results
  BEGIN
    LOOP
      PERFORM dblink_get_result('concurrent_test');
    END LOOP;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  -- Session B should have failed with unique_violation or been rolled back
  IF v_b_result IS NOT NULL AND v_b_result != '' AND v_b_error IS NULL THEN
    RAISE EXCEPTION 'TEST C1 FAIL: session B succeeded (%) — should have been blocked/failed', v_b_result;
  END IF;

  -- Verify: exactly 1 movement
  SELECT count(*) INTO v_mvt_count
  FROM public.stock_movements
  WHERE stock_item_id = v_item
    AND ref_type = 'adj' AND ref_id = v_ref_id;

  IF v_mvt_count != 1 THEN
    RAISE EXCEPTION 'TEST C1 FAIL: expected 1 movement, got %', v_mvt_count;
  END IF;

  -- Verify: balance = 80
  SELECT physical_quantity INTO v_balance
  FROM public.stock_balances
  WHERE stock_item_id = v_item AND location_id = v_branch;

  IF v_balance.physical_quantity != 80 THEN
    RAISE EXCEPTION 'TEST C1 FAIL: balance expected 80, got %', v_balance.physical_quantity;
  END IF;

  -- Verify: last movement result_quantity = 80
  SELECT result_quantity INTO v_movement
  FROM public.stock_movements
  WHERE stock_item_id = v_item
    AND ref_type = 'adj' AND ref_id = v_ref_id
  LIMIT 1;

  IF v_movement.result_quantity != 80 THEN
    RAISE EXCEPTION 'TEST C1 FAIL: result_quantity expected 80, got %', v_movement.result_quantity;
  END IF;

  IF v_movement.result_quantity != v_balance.physical_quantity THEN
    RAISE EXCEPTION 'TEST C1 FAIL: ledger mismatch: result_quantity=% balance=%', v_movement.result_quantity, v_balance.physical_quantity;
  END IF;

  RAISE NOTICE 'TEST C1 PASS: concurrent adjust_stock — exactly 1 movement, balance=80, result_quantity=80';
END;
$$;

-- ══════════════════════════════════════════════════════════════════════════════
-- TEST C2: use_stock — concurrent duplicate use_stock cannot double-mutate
-- ══════════════════════════════════════════════════════════════════════════════
--
-- Scenario:
--   Session A (main): use_stock(item, loc, 30, ref_type='svc', ref_id=X)
--   Session B (dblink): same use_stock(item, loc, 30, ref_type='svc', ref_id=X)
--
-- Expected:
--   Session A commits, balance 100 → 70.
--   Session B: UNIQUE violation → transaction aborted.
--   Final: balance = 70, 1 USAGE movement, last result_quantity = 70.
-- ══════════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  v_branch     uuid;
  v_ref_id     uuid := gen_random_uuid();
  v_item       uuid := '11111111-2222-3333-4444-555555555555';
  v_conn       text;
  v_dbname     text;
  v_b_result   text;
  v_b_error    text;
  v_movement   RECORD;
  v_balance    RECORD;
  v_mvt_count  bigint;
  v_branch_text text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'dblink') THEN
    RAISE NOTICE 'TEST C2 SKIP: dblink not available';
    RETURN;
  END IF;

  v_branch := public._ctest_seed(100);
  v_branch_text := v_branch::text;

  SELECT current_database() INTO v_dbname;
  v_conn := 'dbname=' || v_dbname;

  PERFORM dblink_disconnect('concurrent_test') WHERE dblink_get_connections() @> ARRAY['concurrent_test'];
  PERFORM dblink_connect('concurrent_test', v_conn);

  PERFORM dblink('concurrent_test', 'BEGIN');

  -- Session B: send use_stock (will block on FOR UPDATE)
  PERFORM dblink_send_query('concurrent_test',
    format(
      'SELECT public.use_stock(%L::uuid, %L::uuid, 30, %L, %L, %L, %L::uuid)',
      v_item, v_branch_text, 'test', 'concurrent dup use', 'svc', v_ref_id
    )
  );

  PERFORM pg_sleep(0.3);

  -- Session A: execute use_stock (acquires lock)
  BEGIN
    PERFORM public.use_stock(
      v_item, v_branch, 30,
      'test', 'concurrent A use', 'svc', v_ref_id
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'TEST C2 FAIL: session A raised: %', SQLERRM;
  END;

  PERFORM dblink('concurrent_test', 'COMMIT');
  PERFORM pg_sleep(0.5);

  BEGIN
    SELECT result INTO v_b_result
    FROM dblink_get_result('concurrent_test') AS t(result text);
  EXCEPTION WHEN OTHERS THEN
    v_b_error := SQLERRM;
  END;

  BEGIN
    LOOP
      PERFORM dblink_get_result('concurrent_test');
    END LOOP;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  IF v_b_result IS NOT NULL AND v_b_result != '' AND v_b_error IS NULL THEN
    RAISE EXCEPTION 'TEST C2 FAIL: session B succeeded (%) — should have been blocked/failed', v_b_result;
  END IF;

  SELECT count(*) INTO v_mvt_count
  FROM public.stock_movements
  WHERE stock_item_id = v_item
    AND ref_type = 'svc' AND ref_id = v_ref_id;

  IF v_mvt_count != 1 THEN
    RAISE EXCEPTION 'TEST C2 FAIL: expected 1 USAGE movement, got %', v_mvt_count;
  END IF;

  SELECT physical_quantity INTO v_balance
  FROM public.stock_balances
  WHERE stock_item_id = v_item AND location_id = v_branch;

  IF v_balance.physical_quantity != 70 THEN
    RAISE EXCEPTION 'TEST C2 FAIL: balance expected 70, got %', v_balance.physical_quantity;
  END IF;

  SELECT result_quantity INTO v_movement
  FROM public.stock_movements
  WHERE stock_item_id = v_item
    AND ref_type = 'svc' AND ref_id = v_ref_id
  LIMIT 1;

  IF v_movement.result_quantity != 70 THEN
    RAISE EXCEPTION 'TEST C2 FAIL: result_quantity expected 70, got %', v_movement.result_quantity;
  END IF;

  IF v_movement.result_quantity != v_balance.physical_quantity THEN
    RAISE EXCEPTION 'TEST C2 FAIL: ledger mismatch: result_quantity=% balance=%', v_movement.result_quantity, v_balance.physical_quantity;
  END IF;

  RAISE NOTICE 'TEST C2 PASS: concurrent use_stock — exactly 1 USAGE movement, balance=70, result_quantity=70';
END;
$$;

-- ══════════════════════════════════════════════════════════════════════════════
-- TEST C3: adjust_stock — two DIFFERENT ref_ids both succeed (no false blocking)
-- ══════════════════════════════════════════════════════════════════════════════
--
-- Scenario:
--   Session A (main): adjust_stock(item, loc, -10, ref_type='adj', ref_id=X)
--   Session B (dblink): adjust_stock(item, loc, -20, ref_type='adj', ref_id=Y)
--
-- Expected:
--   Both succeed (different idempotency keys → no UNIQUE violation).
--   Balance: 100 → 90 (A) → 70 (B).
--   2 movements, last result_quantity = 70.
-- ══════════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  v_branch     uuid;
  v_ref_a      uuid := gen_random_uuid();
  v_ref_b      uuid := gen_random_uuid();
  v_item       uuid := '11111111-2222-3333-4444-555555555555';
  v_conn       text;
  v_dbname     text;
  v_b_result   text;
  v_b_error    text;
  v_movement   RECORD;
  v_balance    RECORD;
  v_mvt_count  bigint;
  v_branch_text text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'dblink') THEN
    RAISE NOTICE 'TEST C3 SKIP: dblink not available';
    RETURN;
  END IF;

  v_branch := public._ctest_seed(100);
  v_branch_text := v_branch::text;

  SELECT current_database() INTO v_dbname;
  v_conn := 'dbname=' || v_dbname;

  PERFORM dblink_disconnect('concurrent_test') WHERE dblink_get_connections() @> ARRAY['concurrent_test'];
  PERFORM dblink_connect('concurrent_test', v_conn);

  PERFORM dblink('concurrent_test', 'BEGIN');

  -- Session B: different ref_id, will succeed after A releases lock
  PERFORM dblink_send_query('concurrent_test',
    format(
      'SELECT public.adjust_stock(%L::uuid, %L::uuid, -20, %L, %L, %L, %L::uuid)',
      v_item, v_branch_text, 'test', 'concurrent B diff ref', 'adj', v_ref_b
    )
  );

  PERFORM pg_sleep(0.3);

  -- Session A: adjust -10 (different ref_id)
  BEGIN
    PERFORM public.adjust_stock(
      v_item, v_branch, -10,
      'test', 'concurrent A diff ref', 'adj', v_ref_a
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'TEST C3 FAIL: session A raised: %', SQLERRM;
  END;

  PERFORM dblink('concurrent_test', 'COMMIT');
  PERFORM pg_sleep(0.5);

  -- Collect session B result
  BEGIN
    SELECT result INTO v_b_result
    FROM dblink_get_result('concurrent_test') AS t(result text);
  EXCEPTION WHEN OTHERS THEN
    v_b_error := SQLERRM;
  END;

  BEGIN
    LOOP
      PERFORM dblink_get_result('concurrent_test');
    END LOOP;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  -- Session B should succeed (different ref_id, no UNIQUE violation)
  IF v_b_result IS NULL OR v_b_result = '' THEN
    RAISE EXCEPTION 'TEST C3 FAIL: session B produced no result (expected success). error=%', v_b_error;
  END IF;

  IF v_b_error IS NOT NULL THEN
    RAISE EXCEPTION 'TEST C3 FAIL: session B errored: %', v_b_error;
  END IF;

  -- Verify: 2 movements (A and B)
  SELECT count(*) INTO v_mvt_count
  FROM public.stock_movements
  WHERE stock_item_id = v_item
    AND ref_type = 'adj'
    AND ref_id IN (v_ref_a, v_ref_b);

  IF v_mvt_count != 2 THEN
    RAISE EXCEPTION 'TEST C3 FAIL: expected 2 movements, got %', v_mvt_count;
  END IF;

  -- Verify: final balance = 70 (100 - 10 - 20)
  SELECT physical_quantity INTO v_balance
  FROM public.stock_balances
  WHERE stock_item_id = v_item AND location_id = v_branch;

  IF v_balance.physical_quantity != 70 THEN
    RAISE EXCEPTION 'TEST C3 FAIL: balance expected 70, got %', v_balance.physical_quantity;
  END IF;

  -- Verify: last movement result_quantity = 70
  SELECT result_quantity INTO v_movement
  FROM public.stock_movements
  WHERE stock_item_id = v_item
    AND ref_type = 'adj'
    AND ref_id IN (v_ref_a, v_ref_b)
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_movement.result_quantity != 70 THEN
    RAISE EXCEPTION 'TEST C3 FAIL: last result_quantity expected 70, got %', v_movement.result_quantity;
  END IF;

  IF v_movement.result_quantity != v_balance.physical_quantity THEN
    RAISE EXCEPTION 'TEST C3 FAIL: ledger mismatch: result_quantity=% balance=%', v_movement.result_quantity, v_balance.physical_quantity;
  END IF;

  RAISE NOTICE 'TEST C3 PASS: two different ref_ids both succeed — 2 movements, balance=70, last result_quantity=70';
END;
$$;

-- ══════════════════════════════════════════════════════════════════════════════
-- CLEANUP
-- ══════════════════════════════════════════════════════════════════════════════

DO $$
BEGIN
  PERFORM public._ctest_reset();
  DROP FUNCTION IF EXISTS public._ctest_reset();
  DROP FUNCTION IF EXISTS public._ctest_seed(int);
  RAISE NOTICE 'CONCURRENT TESTS COMPLETE. Cleanup done.';
END;
$$;
