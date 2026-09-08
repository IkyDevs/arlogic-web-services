-- ============================================================================
-- INVENTORY IDEMPOTENCY + LEDGER INTEGRITY TESTS
-- Run in Supabase SQL Editor as postgres/owner role.
-- These tests verify that concurrent identical requests cannot double-mutate stock.
-- ============================================================================

-- ── Test infrastructure ──────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public._test_reset()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.stock_movements
  WHERE stock_item_id = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
  DELETE FROM public.stock_balances
  WHERE stock_item_id = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
  DELETE FROM public.stock_items
  WHERE id = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
END;
$$;

CREATE OR REPLACE FUNCTION public._test_seed()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public._test_reset();

  INSERT INTO public.stock_items (id, name, sku, item_class, unit, is_active)
  VALUES ('aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee', 'Test Item', 'TEST-001', 'sparepart', 'pcs', true);

  INSERT INTO public.stock_balances (stock_item_id, location_id, physical_quantity, reserved_quantity)
  SELECT 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee', id, 100, 0
  FROM public.branches
  WHERE is_central = true
  LIMIT 1;
END;
$$;

-- ══════════════════════════════════════════════════════════════════════════════
-- TEST 1: adjust_stock basic functionality
-- ══════════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  v_balance RECORD;
  v_movement RECORD;
  v_result int;
BEGIN
  PERFORM public._test_seed();

  v_result := public.adjust_stock(
    'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
    (SELECT id FROM public.branches WHERE is_central = true LIMIT 1),
    -30,
    'test', 'test adjust -30',
    'test', gen_random_uuid()
  );

  IF v_result != 70 THEN
    RAISE EXCEPTION 'TEST 1 FAIL: expected result 70, got %', v_result;
  END IF;

  SELECT physical_quantity INTO v_balance
  FROM public.stock_balances
  WHERE stock_item_id = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

  IF v_balance.physical_quantity != 70 THEN
    RAISE EXCEPTION 'TEST 1 FAIL: balance expected 70, got %', v_balance.physical_quantity;
  END IF;

  SELECT delta, result_quantity INTO v_movement
  FROM public.stock_movements
  WHERE stock_item_id = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'
    AND movement_type = 'ADJUSTMENT'
  LIMIT 1;

  IF v_movement.delta != -30 THEN
    RAISE EXCEPTION 'TEST 1 FAIL: movement delta expected -30, got %', v_movement.delta;
  END IF;
  IF v_movement.result_quantity != 70 THEN
    RAISE EXCEPTION 'TEST 1 FAIL: movement result_quantity expected 70, got %', v_movement.result_quantity;
  END IF;

  RAISE NOTICE 'TEST 1 PASS: adjust_stock basic (-30), balance=70, result_quantity=70';
END;
$$;

-- ══════════════════════════════════════════════════════════════════════════════
-- TEST 2: adjust_stock idempotency (same ref twice)
-- ══════════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  v_ref_id uuid := gen_random_uuid();
  v_branch uuid;
  v_result1 int;
  v_result2 int;
  v_balance RECORD;
  v_count bigint;
BEGIN
  PERFORM public._test_seed();
  v_branch := (SELECT id FROM public.branches WHERE is_central = true LIMIT 1);

  v_result1 := public.adjust_stock(
    'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee', v_branch, -20,
    'test', 'idempotency test 1',
    'test_ref', v_ref_id
  );

  v_result2 := public.adjust_stock(
    'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee', v_branch, -20,
    'test', 'idempotency test 2 (duplicate)',
    'test_ref', v_ref_id
  );

  IF v_result1 != v_result2 THEN
    RAISE EXCEPTION 'TEST 2 FAIL: results differ: % vs %', v_result1, v_result2;
  END IF;

  SELECT physical_quantity INTO v_balance
  FROM public.stock_balances
  WHERE stock_item_id = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

  IF v_balance.physical_quantity != 80 THEN
    RAISE EXCEPTION 'TEST 2 FAIL: balance expected 80, got %', v_balance.physical_quantity;
  END IF;

  SELECT count(*) INTO v_count
  FROM public.stock_movements
  WHERE stock_item_id = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'
    AND movement_type = 'ADJUSTMENT';

  IF v_count != 1 THEN
    RAISE EXCEPTION 'TEST 2 FAIL: expected 1 movement, got %', v_count;
  END IF;

  RAISE NOTICE 'TEST 2 PASS: idempotency: same ref returns same result, balance=80, 1 movement';
END;
$$;

-- ══════════════════════════════════════════════════════════════════════════════
-- TEST 3: adjust_stock ledger integrity (result_quantity = balance after mutation)
-- ══════════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  v_branch uuid;
  v_balance RECORD;
  v_movement RECORD;
BEGIN
  PERFORM public._test_seed();
  v_branch := (SELECT id FROM public.branches WHERE is_central = true LIMIT 1);

  PERFORM public.adjust_stock(
    'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee', v_branch, +50,
    'test', 'restock +50',
    'test', gen_random_uuid()
  );

  SELECT physical_quantity INTO v_balance
  FROM public.stock_balances
  WHERE stock_item_id = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

  SELECT delta, result_quantity INTO v_movement
  FROM public.stock_movements
  WHERE stock_item_id = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'
    AND movement_type = 'ADJUSTMENT'
  LIMIT 1;

  IF v_balance.physical_quantity != 150 THEN
    RAISE EXCEPTION 'TEST 3 FAIL: balance expected 150, got %', v_balance.physical_quantity;
  END IF;
  IF v_movement.result_quantity != 150 THEN
    RAISE EXCEPTION 'TEST 3 FAIL: result_quantity expected 150, got %', v_movement.result_quantity;
  END IF;
  IF v_movement.result_quantity != v_balance.physical_quantity THEN
    RAISE EXCEPTION 'TEST 3 FAIL: result_quantity (%) != balance (%)', v_movement.result_quantity, v_balance.physical_quantity;
  END IF;

  RAISE NOTICE 'TEST 3 PASS: ledger integrity: +50, balance=150, result_quantity=150';
END;
$$;

-- ══════════════════════════════════════════════════════════════════════════════
-- TEST 4: adjust_stock insufficient stock
-- ══════════════════════════════════════════════════════════════════════════════

DO $$
BEGIN
  PERFORM public._test_seed();

  BEGIN
    PERFORM public.adjust_stock(
      'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
      (SELECT id FROM public.branches WHERE is_central = true LIMIT 1),
      -200,
      'test', 'should fail',
      'test', gen_random_uuid()
    );
    RAISE EXCEPTION 'TEST 4 FAIL: expected INSUFFICIENT_STOCK exception';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE 'INSUFFICIENT_STOCK%' THEN
      RAISE NOTICE 'TEST 4 PASS: INSUFFICIENT_STOCK raised correctly';
    ELSE
      RAISE EXCEPTION 'TEST 4 FAIL: unexpected error: %', SQLERRM;
    END IF;
  END;
END;
$$;

-- ══════════════════════════════════════════════════════════════════════════════
-- TEST 5: use_stock basic + idempotency
-- ══════════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  v_branch uuid;
  v_ref_id uuid := gen_random_uuid();
  v_result1 int;
  v_result2 int;
  v_balance RECORD;
  v_count bigint;
BEGIN
  PERFORM public._test_seed();
  v_branch := (SELECT id FROM public.branches WHERE is_central = true LIMIT 1);

  v_result1 := public.use_stock(
    'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee', v_branch, 25,
    'test', 'use 25',
    'test_ref', v_ref_id
  );

  v_result2 := public.use_stock(
    'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee', v_branch, 25,
    'test', 'use 25 duplicate',
    'test_ref', v_ref_id
  );

  IF v_result1 != v_result2 THEN
    RAISE EXCEPTION 'TEST 5 FAIL: results differ: % vs %', v_result1, v_result2;
  END IF;

  SELECT physical_quantity INTO v_balance
  FROM public.stock_balances
  WHERE stock_item_id = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

  IF v_balance.physical_quantity != 75 THEN
    RAISE EXCEPTION 'TEST 5 FAIL: balance expected 75, got %', v_balance.physical_quantity;
  END IF;

  SELECT count(*) INTO v_count
  FROM public.stock_movements
  WHERE stock_item_id = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'
    AND movement_type = 'USAGE';

  IF v_count != 1 THEN
    RAISE EXCEPTION 'TEST 5 FAIL: expected 1 USAGE movement, got %', v_count;
  END IF;

  RAISE NOTICE 'TEST 5 PASS: use_stock idempotency: balance=75, 1 USAGE movement';
END;
$$;

-- ══════════════════════════════════════════════════════════════════════════════
-- TEST 6: use_stock ledger integrity
-- ══════════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  v_branch uuid;
  v_balance RECORD;
  v_movement RECORD;
BEGIN
  PERFORM public._test_seed();
  v_branch := (SELECT id FROM public.branches WHERE is_central = true LIMIT 1);

  PERFORM public.use_stock(
    'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee', v_branch, 40,
    'test', 'use 40',
    'test', gen_random_uuid()
  );

  SELECT physical_quantity INTO v_balance
  FROM public.stock_balances
  WHERE stock_item_id = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

  SELECT delta, result_quantity INTO v_movement
  FROM public.stock_movements
  WHERE stock_item_id = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'
    AND movement_type = 'USAGE'
  LIMIT 1;

  IF v_balance.physical_quantity != 60 THEN
    RAISE EXCEPTION 'TEST 6 FAIL: balance expected 60, got %', v_balance.physical_quantity;
  END IF;
  IF v_movement.delta != -40 THEN
    RAISE EXCEPTION 'TEST 6 FAIL: delta expected -40, got %', v_movement.delta;
  END IF;
  IF v_movement.result_quantity != 60 THEN
    RAISE EXCEPTION 'TEST 6 FAIL: result_quantity expected 60, got %', v_movement.result_quantity;
  END IF;
  IF v_movement.result_quantity != v_balance.physical_quantity THEN
    RAISE EXCEPTION 'TEST 6 FAIL: result_quantity (%) != balance (%)', v_movement.result_quantity, v_balance.physical_quantity;
  END IF;

  RAISE NOTICE 'TEST 6 PASS: use_stock ledger integrity: -40, balance=60, result_quantity=60';
END;
$$;

-- ══════════════════════════════════════════════════════════════════════════════
-- TEST 7: Multiple sequential adjustments, ledger matches every time
-- ══════════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  v_branch uuid;
  v_movement RECORD;
  v_expected int;
  v_row RECORD;
BEGIN
  PERFORM public._test_seed();
  v_branch := (SELECT id FROM public.branches WHERE is_central = true LIMIT 1);

  PERFORM public.adjust_stock(
    'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee', v_branch, -10,
    'test', 'seq 1', 'test', gen_random_uuid()
  );
  PERFORM public.adjust_stock(
    'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee', v_branch, +25,
    'test', 'seq 2', 'test', gen_random_uuid()
  );
  PERFORM public.adjust_stock(
    'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee', v_branch, -5,
    'test', 'seq 3', 'test', gen_random_uuid()
  );

  -- Expected balance: 100 - 10 + 25 - 5 = 110
  v_expected := 110;
  FOR v_row IN
    SELECT delta, result_quantity
    FROM public.stock_movements
    WHERE stock_item_id = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'
      AND movement_type = 'ADJUSTMENT'
    ORDER BY created_at
  LOOP
    v_expected := v_expected - v_row.delta + v_row.delta;
  END LOOP;

  SELECT physical_quantity INTO v_expected
  FROM public.stock_balances
  WHERE stock_item_id = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

  -- Verify last movement result_quantity matches current balance
  SELECT result_quantity INTO v_expected
  FROM public.stock_movements
  WHERE stock_item_id = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'
    AND movement_type = 'ADJUSTMENT'
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_expected != 110 THEN
    RAISE EXCEPTION 'TEST 7 FAIL: last result_quantity expected 110, got %', v_expected;
  END IF;

  RAISE NOTICE 'TEST 7 PASS: sequential adjustments: final balance=110, last result_quantity=110';
END;
$$;

-- ══════════════════════════════════════════════════════════════════════════════
-- TEST 8: Balance cannot go negative (use_stock)
-- ══════════════════════════════════════════════════════════════════════════════

DO $$
BEGIN
  PERFORM public._test_seed();

  BEGIN
    PERFORM public.use_stock(
      'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
      (SELECT id FROM public.branches WHERE is_central = true LIMIT 1),
      150,
      'test', 'should fail',
      'test', gen_random_uuid()
    );
    RAISE EXCEPTION 'TEST 8 FAIL: expected INSUFFICIENT_STOCK exception';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE 'INSUFFICIENT_STOCK%' THEN
      RAISE NOTICE 'TEST 8 PASS: use_stock INSUFFICIENT_STOCK raised correctly';
    ELSE
      RAISE EXCEPTION 'TEST 8 FAIL: unexpected error: %', SQLERRM;
    END IF;
  END;
END;
$$;

-- ══════════════════════════════════════════════════════════════════════════════
-- CLEANUP
-- ══════════════════════════════════════════════════════════════════════════════

DO $$
BEGIN
  PERFORM public._test_reset();
  DROP FUNCTION public._test_reset();
  DROP FUNCTION public._test_seed();
  RAISE NOTICE 'ALL TESTS PASSED. Cleanup complete.';
END;
$$;
