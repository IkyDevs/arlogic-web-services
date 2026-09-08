-- ============================================================================
-- INVENTORY COMPLETE SETUP — ALL-IN-ONE
--
-- Struktur:
--   PART A: Preflight Validation (READ-ONLY, aman di-run kapan saja)
--   PART B: Canonical Tables (T001) — stock_items, stock_balances
--   PART C: Movement Engine (T002) — extend stock_movements, RPCs
--   PART D: Transfer Lifecycle (T003) — transfer tables + RPCs
--
-- Idempotent: semua pakai IF NOT EXISTS / CREATE OR REPLACE.
-- Aman di-run berulang kali.
--
-- RUN ORDER:
--   1. Jalankan PART A (preflight) — cek hasilnya
--   2. Jika tidak ada BLOCKER, lanjut PART B-D
--   3. PART B-D bisa di-skip jika sudah pernah di-run
-- ============================================================================


-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║  PART A: PREFLIGHT VALIDATION (READ-ONLY)                                ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

DO $$
DECLARE
  v_central_count int;
  v_central_id    uuid;
  v_central_name  text;
  r               record;
BEGIN
  SELECT count(*), (ARRAY_AGG(id ORDER BY id))[1]
  INTO v_central_count, v_central_id
  FROM branches WHERE is_central = true;

  SELECT name INTO v_central_name FROM branches WHERE id = v_central_id;

  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'PART A: INVENTORY PREFLIGHT VALIDATION';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';

  IF v_central_count = 1 THEN
    RAISE NOTICE '[PASS] Central warehouse: exactly 1 (id: %, name: %)', v_central_id, v_central_name;
  ELSIF v_central_count = 0 THEN
    RAISE NOTICE '[BLOCKER] Central warehouse: 0 found — exactly 1 required';
  ELSE
    RAISE NOTICE '[BLOCKER] Central warehouse: % found — exactly 1 required', v_central_count;
    FOR r IN SELECT id, name, code FROM branches WHERE is_central = true ORDER BY name LOOP
      RAISE NOTICE '  branch: id=%, name=%, code=%', r.id, r.name, r.code;
    END LOOP;
  END IF;
  RAISE NOTICE '';
END $$;

-- ── SKU Validation ──

SELECT 'SKU_NULL_EMPTY' AS check_name,
  CASE WHEN count(*) = 0 THEN 'PASS' ELSE 'BLOCKER' END AS status,
  count(*) AS row_count
FROM inventory WHERE sku IS NULL OR trim(sku) = '';

SELECT 'SKU_EXACT_DUPLICATE' AS check_name,
  CASE WHEN count(*) = 0 THEN 'PASS' ELSE 'BLOCKER' END AS status,
  count(*) AS duplicate_sku_groups,
  sum(cnt) AS total_affected_rows
FROM (
  SELECT sku, count(*) AS cnt FROM inventory
  WHERE sku IS NOT NULL AND trim(sku) != ''
  GROUP BY sku HAVING count(*) > 1
) d;

SELECT 'SKU_NORMALIZED_DUPLICATE' AS check_name,
  CASE WHEN count(*) = 0 THEN 'PASS' ELSE 'BLOCKER' END AS status,
  count(*) AS duplicate_groups,
  sum(cnt) AS total_affected_rows
FROM (
  SELECT lower(trim(sku)) AS norm_sku, count(*) AS cnt FROM inventory
  WHERE sku IS NOT NULL AND trim(sku) != ''
  GROUP BY lower(trim(sku)) HAVING count(*) > 1
) d;

SELECT 'SKU_NORMALIZED_SAMPLE' AS check_name,
  i.id AS inventory_id, i.sku, lower(trim(i.sku)) AS normalized
FROM inventory i
WHERE lower(trim(i.sku)) IN (
  SELECT lower(trim(sku)) FROM inventory
  WHERE sku IS NOT NULL AND trim(sku) != ''
  GROUP BY lower(trim(sku)) HAVING count(*) > 1
)
ORDER BY lower(trim(i.sku)), i.sku LIMIT 30;

-- ── inventory → stock_items Mapping ──

SELECT 'INVENTORY_TOTAL' AS check_name, count(*) AS total_rows FROM inventory;

SELECT 'INVENTORY_UNMAPPABLE' AS check_name,
  CASE WHEN count(*) = 0 THEN 'PASS' ELSE 'BLOCKER' END AS status,
  count(*) AS unmappable_rows
FROM inventory
WHERE id IS NULL OR sku IS NULL OR trim(sku) = ''
   OR item_name IS NULL OR trim(item_name) = '';

SELECT 'INVENTORY_ITEM_CLASS_DIST' AS check_name, item_class, count(*) AS cnt
FROM inventory GROUP BY item_class ORDER BY item_class;

-- ── stock_toko → stock_balances Mapping ──

SELECT 'STOCK_TOKO_TOTAL' AS check_name, count(*) AS total_rows FROM stock_toko;

SELECT 'STOCK_TOKO_UNMAPPABLE' AS check_name,
  CASE WHEN count(*) = 0 THEN 'PASS' ELSE 'BLOCKER' END AS status,
  count(*) AS unmappable_rows
FROM stock_toko st
WHERE NOT EXISTS (SELECT 1 FROM inventory i WHERE i.id = st.inventory_id)
   OR NOT EXISTS (SELECT 1 FROM branches b WHERE b.id = st.branch_id);

SELECT 'STOCK_TOKO_DUPLICATE' AS check_name,
  CASE WHEN count(*) = 0 THEN 'PASS' ELSE 'BLOCKER' END AS status,
  count(*) AS duplicate_groups, sum(cnt) AS total_affected
FROM (
  SELECT inventory_id, branch_id, count(*) AS cnt FROM stock_toko
  GROUP BY inventory_id, branch_id HAVING count(*) > 1
) d;

SELECT 'STOCK_TOKO_NEGATIVE' AS check_name,
  CASE WHEN count(*) = 0 THEN 'PASS' ELSE 'WARNING' END AS status,
  count(*) AS negative_rows
FROM stock_toko WHERE quantity < 0;

-- ── stock_gudang → stock_balances Mapping ──

SELECT 'STOCK_GUDANG_TOTAL' AS check_name, count(*) AS total_rows FROM stock_gudang;

SELECT 'STOCK_GUDANG_UNMAPPABLE' AS check_name,
  CASE WHEN count(*) = 0 THEN 'PASS' ELSE 'BLOCKER' END AS status,
  count(*) AS unmappable_rows
FROM stock_gudang sg
WHERE NOT EXISTS (SELECT 1 FROM inventory i WHERE i.id = sg.inventory_id);

SELECT 'STOCK_GUDANG_DUPLICATE' AS check_name,
  CASE WHEN count(*) = 0 THEN 'PASS' ELSE 'BLOCKER' END AS status,
  count(*) AS duplicate_rows
FROM (
  SELECT inventory_id, count(*) AS cnt FROM stock_gudang
  GROUP BY inventory_id HAVING count(*) > 1
) d;

SELECT 'STOCK_GUDANG_NEGATIVE' AS check_name,
  CASE WHEN count(*) = 0 THEN 'PASS' ELSE 'WARNING' END AS status,
  count(*) AS negative_rows
FROM stock_gudang WHERE quantity < 0;

-- ── Legacy Summary Reconciliation ──

SELECT 'LEGACY_RECONCILE_STORE' AS check_name,
  CASE WHEN count(*) = 0 THEN 'PASS' ELSE 'WARNING' END AS status,
  count(*) AS mismatch_rows
FROM (
  SELECT i.id, i.sku, i.store_stock, coalesce(SUM(st.quantity), 0) AS toko_sum
  FROM inventory i LEFT JOIN stock_toko st ON st.inventory_id = i.id
  GROUP BY i.id, i.sku, i.store_stock
  HAVING i.store_stock IS DISTINCT FROM coalesce(SUM(st.quantity), 0)
) m;

SELECT 'LEGACY_RECONCILE_WAREHOUSE' AS check_name,
  CASE WHEN count(*) = 0 THEN 'PASS' ELSE 'WARNING' END AS status,
  count(*) AS mismatch_rows
FROM (
  SELECT i.id, i.sku, i.warehouse_stock, coalesce(sg.quantity, 0) AS gudang_qty
  FROM inventory i LEFT JOIN stock_gudang sg ON sg.inventory_id = i.id
  WHERE i.warehouse_stock IS DISTINCT FROM coalesce(sg.quantity, 0)
) m;

-- ── stock_movements Audit ──

SELECT 'MOVEMENTS_TOTAL' AS check_name, count(*) AS total FROM stock_movements;

SELECT 'MOVEMENTS_NULL_INVENTORY' AS check_name,
  CASE WHEN count(*) = 0 THEN 'PASS' ELSE 'BLOCKER' END AS status,
  count(*) AS cnt FROM stock_movements WHERE inventory_id IS NULL;

SELECT 'MOVEMENTS_ORPHAN_INVENTORY' AS check_name,
  CASE WHEN count(*) = 0 THEN 'PASS' ELSE 'BLOCKER' END AS status,
  count(*) AS cnt
FROM stock_movements m
WHERE NOT EXISTS (SELECT 1 FROM inventory i WHERE i.id = m.inventory_id);

SELECT 'MOVEMENTS_NO_BRANCH' AS check_name,
  CASE WHEN count(*) = 0 THEN 'PASS' ELSE 'WARNING' END AS status,
  count(*) AS cnt FROM stock_movements WHERE branch_id IS NULL;

-- ── Canonical Table Readiness ──

DO $$
DECLARE v_cnt int;
BEGIN
  BEGIN
    SELECT count(*) INTO v_cnt FROM stock_items;
    RAISE NOTICE '[INFO] stock_items: % rows', v_cnt;
  EXCEPTION WHEN undefined_table THEN
    RAISE NOTICE '[INFO] stock_items: NOT EXISTS — will be created below';
  END;
  BEGIN
    SELECT count(*) INTO v_cnt FROM stock_balances;
    RAISE NOTICE '[INFO] stock_balances: % rows', v_cnt;
  EXCEPTION WHEN undefined_table THEN
    RAISE NOTICE '[INFO] stock_balances: NOT EXISTS — will be created below';
  END;
  SELECT count(*) INTO v_cnt FROM stock_movements;
  RAISE NOTICE '[INFO] stock_movements: % rows (legacy)', v_cnt;
  BEGIN
    SELECT count(*) INTO v_cnt FROM inventory_transfers;
    RAISE NOTICE '[INFO] inventory_transfers: % rows', v_cnt;
  EXCEPTION WHEN undefined_table THEN
    RAISE NOTICE '[INFO] inventory_transfers: NOT EXISTS — will be created below';
  END;
END $$;

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'PART A COMPLETE — review [BLOCKER] items above';
  RAISE NOTICE 'If no BLOCKERs, proceed to PART B-D below';
  RAISE NOTICE '========================================';
END $$;


-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║  PART B: CANONICAL TABLES (T001)                                         ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

-- ── B1. stock_items ─────────────────────────────────────────────────────────

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

COMMENT ON TABLE public.stock_items IS 'Global item catalog (single business). Quantity lives in stock_balances.';

CREATE INDEX IF NOT EXISTS idx_stock_items_category ON public.stock_items (category);
CREATE INDEX IF NOT EXISTS idx_stock_items_item_class ON public.stock_items (item_class);
CREATE INDEX IF NOT EXISTS idx_stock_items_name ON public.stock_items (name);

-- ── B2. stock_balances ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.stock_balances (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stock_item_id       uuid NOT NULL REFERENCES public.stock_items(id) ON DELETE RESTRICT,
  location_id         uuid NOT NULL REFERENCES public.branches(id) ON DELETE RESTRICT,
  physical_quantity   int4 NOT NULL DEFAULT 0,
  reserved_quantity   int4 NOT NULL DEFAULT 0,
  minimum_stock       int4,
  updated_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (stock_item_id, location_id),
  CHECK (physical_quantity >= 0),
  CHECK (reserved_quantity >= 0),
  CHECK (reserved_quantity <= physical_quantity)
);

COMMENT ON TABLE public.stock_balances IS 'Per-location stock quantities. One row per stock_item per branch.';

CREATE INDEX IF NOT EXISTS idx_stock_balances_item ON public.stock_balances (stock_item_id);
CREATE INDEX IF NOT EXISTS idx_stock_balances_location ON public.stock_balances (location_id);

-- ── B3. Warehouse constraint ────────────────────────────────────────────────

CREATE UNIQUE INDEX IF NOT EXISTS uq_branches_one_central
  ON public.branches ((is_central)) WHERE is_central = true;

-- ── B4. RLS: stock_items ────────────────────────────────────────────────────

ALTER TABLE public.stock_items ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY stock_items_select_authenticated
    ON public.stock_items FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY stock_items_insert_management
    ON public.stock_items FOR INSERT TO authenticated
    WITH CHECK (public.auth_can_manage_all_stocks());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY stock_items_update_management
    ON public.stock_items FOR UPDATE TO authenticated
    USING (public.auth_can_manage_all_stocks())
    WITH CHECK (public.auth_can_manage_all_stocks());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY stock_items_delete_management
    ON public.stock_items FOR DELETE TO authenticated
    USING (public.auth_can_manage_all_stocks());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── B5. RLS: stock_balances ─────────────────────────────────────────────────

ALTER TABLE public.stock_balances ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY stock_balances_select_management
    ON public.stock_balances FOR SELECT TO authenticated
    USING (
      public.auth_can_manage_all_stocks()
      OR public.auth_profile_role() IN ('engineer', 'supervisor')
      OR location_id = public.auth_branch_id()
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║  PART C: MOVEMENT ENGINE (T002)                                          ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

-- ── C1. Extend stock_movements ──────────────────────────────────────────────

ALTER TABLE public.stock_movements
  ADD COLUMN IF NOT EXISTS stock_item_id uuid;

ALTER TABLE public.stock_movements
  ADD COLUMN IF NOT EXISTS movement_type text;

ALTER TABLE public.stock_movements ALTER COLUMN inventory_id DROP NOT NULL;

-- ── C2. Constraints ─────────────────────────────────────────────────────────

-- chk_movement_type + uq_stock_movements_ref already exist (20260904_inventory_movement_engine_v2.sql)

CREATE INDEX IF NOT EXISTS idx_stock_movements_type ON public.stock_movements (movement_type);
CREATE INDEX IF NOT EXISTS idx_stock_movements_ref_lookup
  ON public.stock_movements (ref_type, ref_id, stock_item_id, movement_type);
CREATE INDEX IF NOT EXISTS idx_stock_movements_stock_item ON public.stock_movements (stock_item_id);

-- ── C3. Revoke direct writes ────────────────────────────────────────────────

REVOKE INSERT, UPDATE, DELETE ON public.stock_movements FROM authenticated;

-- ── C4. adjust_stock() ──────────────────────────────────────────────────────

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
  WHERE stock_item_id = p_stock_item_id AND location_id = p_location_id
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
  SET physical_quantity = v_new, updated_at = now()
  WHERE stock_item_id = p_stock_item_id AND location_id = p_location_id;

  RETURN v_new;
END;
$$;

GRANT EXECUTE ON FUNCTION public.adjust_stock(uuid, uuid, int, text, text, text, uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.adjust_stock(uuid, uuid, int, text, text, text, uuid) FROM PUBLIC;

-- ── C5. use_stock() ─────────────────────────────────────────────────────────

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
  WHERE stock_item_id = p_stock_item_id AND location_id = p_location_id
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
  SET physical_quantity = v_new, updated_at = now()
  WHERE stock_item_id = p_stock_item_id AND location_id = p_location_id;

  RETURN v_new;
END;
$$;

GRANT EXECUTE ON FUNCTION public.use_stock(uuid, uuid, int, text, text, text, uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.use_stock(uuid, uuid, int, text, text, text, uuid) FROM PUBLIC;

-- ── C6. reserve_stock() ─────────────────────────────────────────────────────

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

  SELECT physical_quantity, reserved_quantity INTO v_physical, v_reserved
  FROM public.stock_balances
  WHERE stock_item_id = p_stock_item_id AND location_id = p_location_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'BALANCE_NOT_FOUND: balance tidak ditemukan untuk item ini di lokasi ini';
  END IF;

  v_available := v_physical - v_reserved;
  IF v_available < p_quantity THEN
    RAISE EXCEPTION 'INSUFFICIENT_AVAILABLE: stok tersedia tidak mencukupi (available: %, requested: %)', v_available, p_quantity;
  END IF;

  v_new_reserved := v_reserved + p_quantity;
  UPDATE public.stock_balances
  SET reserved_quantity = v_new_reserved, updated_at = now()
  WHERE stock_item_id = p_stock_item_id AND location_id = p_location_id;

  RETURN v_new_reserved;
END;
$$;

-- ── C7. release_reservation() ───────────────────────────────────────────────

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

  SELECT reserved_quantity INTO v_reserved
  FROM public.stock_balances
  WHERE stock_item_id = p_stock_item_id AND location_id = p_location_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'BALANCE_NOT_FOUND: balance tidak ditemukan untuk item ini di lokasi ini';
  END IF;

  IF v_reserved < p_quantity THEN
    RAISE EXCEPTION 'INSUFFICIENT_AVAILABLE: reservasi tidak mencukupi (reserved: %, release: %)', v_reserved, p_quantity;
  END IF;

  v_new_reserved := v_reserved - p_quantity;
  UPDATE public.stock_balances
  SET reserved_quantity = v_new_reserved, updated_at = now()
  WHERE stock_item_id = p_stock_item_id AND location_id = p_location_id;

  RETURN v_new_reserved;
END;
$$;


-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║  PART D: TRANSFER LIFECYCLE (T003)                                       ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

-- ── D1. Tables ──────────────────────────────────────────────────────────────

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
  CHECK (source_location_id != dest_location_id)
);

CREATE TABLE IF NOT EXISTS public.inventory_transfer_items (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transfer_id         uuid NOT NULL REFERENCES public.inventory_transfers(id) ON DELETE CASCADE,
  stock_item_id       uuid NOT NULL REFERENCES public.stock_items(id),
  requested_quantity  int4 NOT NULL CHECK (requested_quantity > 0),
  UNIQUE (transfer_id, stock_item_id)
);

CREATE TABLE IF NOT EXISTS public.inventory_transfer_history (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transfer_id     uuid NOT NULL REFERENCES public.inventory_transfers(id) ON DELETE CASCADE,
  action          text NOT NULL CHECK (action IN ('CREATED', 'SUBMITTED', 'APPROVED', 'REJECTED')),
  actor_id        uuid NOT NULL REFERENCES auth.users(id),
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- ── D2. Indexes ─────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_inventory_transfers_status ON public.inventory_transfers (status);
CREATE INDEX IF NOT EXISTS idx_inventory_transfers_source ON public.inventory_transfers (source_location_id);
CREATE INDEX IF NOT EXISTS idx_inventory_transfers_dest ON public.inventory_transfers (dest_location_id);
CREATE INDEX IF NOT EXISTS idx_inventory_transfers_created_by ON public.inventory_transfers (created_by);
CREATE INDEX IF NOT EXISTS idx_inventory_transfer_items_transfer ON public.inventory_transfer_items (transfer_id);
CREATE INDEX IF NOT EXISTS idx_inventory_transfer_items_stock_item ON public.inventory_transfer_items (stock_item_id);
CREATE INDEX IF NOT EXISTS idx_inventory_transfer_history_transfer ON public.inventory_transfer_history (transfer_id);

-- ── D3. RLS ─────────────────────────────────────────────────────────────────

ALTER TABLE public.inventory_transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_transfer_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_transfer_history ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY inventory_transfers_select_authenticated
    ON public.inventory_transfers FOR SELECT TO authenticated
    USING (
      public.auth_can_manage_all_stocks()
      OR created_by = auth.uid()
      OR source_location_id = public.auth_branch_id()
      OR dest_location_id = public.auth_branch_id()
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY inventory_transfers_insert_authenticated
    ON public.inventory_transfers FOR INSERT TO authenticated
    WITH CHECK (
      public.auth_can_manage_all_stocks()
      OR public.auth_profile_role() = 'admin'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
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
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY inventory_transfer_items_select_authenticated
    ON public.inventory_transfer_items FOR SELECT TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM public.inventory_transfers
        WHERE id = transfer_id AND (
          public.auth_can_manage_all_stocks()
          OR created_by = auth.uid()
          OR source_location_id = public.auth_branch_id()
          OR dest_location_id = public.auth_branch_id()
        )
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY inventory_transfer_items_insert_authenticated
    ON public.inventory_transfer_items FOR INSERT TO authenticated
    WITH CHECK (
      EXISTS (
        SELECT 1 FROM public.inventory_transfers
        WHERE id = transfer_id AND status = 'DRAFT' AND (
          public.auth_can_manage_all_stocks() OR created_by = auth.uid()
        )
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY inventory_transfer_items_update_authenticated
    ON public.inventory_transfer_items FOR UPDATE TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM public.inventory_transfers
        WHERE id = transfer_id AND status = 'DRAFT' AND (
          public.auth_can_manage_all_stocks() OR created_by = auth.uid()
        )
      )
    )
    WITH CHECK (
      EXISTS (
        SELECT 1 FROM public.inventory_transfers
        WHERE id = transfer_id AND status = 'DRAFT' AND (
          public.auth_can_manage_all_stocks() OR created_by = auth.uid()
        )
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY inventory_transfer_items_delete_authenticated
    ON public.inventory_transfer_items FOR DELETE TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM public.inventory_transfers
        WHERE id = transfer_id AND status = 'DRAFT' AND (
          public.auth_can_manage_all_stocks() OR created_by = auth.uid()
        )
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY inventory_transfer_history_select_authenticated
    ON public.inventory_transfer_history FOR SELECT TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM public.inventory_transfers
        WHERE id = transfer_id AND (
          public.auth_can_manage_all_stocks()
          OR created_by = auth.uid()
          OR source_location_id = public.auth_branch_id()
          OR dest_location_id = public.auth_branch_id()
        )
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── D4. RPCs ────────────────────────────────────────────────────────────────

-- create_transfer()

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
  IF p_source_location_id IS NULL OR p_dest_location_id IS NULL THEN
    RAISE EXCEPTION 'INVALID_LOCATION: source dan destination harus diisi';
  END IF;
  IF p_source_location_id = p_dest_location_id THEN
    RAISE EXCEPTION 'TRANSFER_SAME_LOCATION: source dan destination harus berbeda';
  END IF;
  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'EMPTY_TRANSFER: transfer harus memiliki minimal 1 item';
  END IF;

  IF NOT public.auth_can_manage_all_stocks() THEN
    IF public.auth_profile_role() IS DISTINCT FROM 'admin' THEN
      RAISE EXCEPTION 'FORBIDDEN: tidak berwenang membuat transfer';
    END IF;
  END IF;

  INSERT INTO public.inventory_transfers (source_location_id, dest_location_id, notes, created_by)
  VALUES (p_source_location_id, p_dest_location_id, p_notes, v_actor)
  RETURNING id INTO v_transfer_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    IF (v_item->>'requested_quantity')::int <= 0 THEN
      RAISE EXCEPTION 'INVALID_QUANTITY: quantity harus positif';
    END IF;
    INSERT INTO public.inventory_transfer_items (transfer_id, stock_item_id, requested_quantity)
    VALUES (v_transfer_id, (v_item->>'stock_item_id')::uuid, (v_item->>'requested_quantity')::int);
  END LOOP;

  INSERT INTO public.inventory_transfer_history (transfer_id, action, actor_id)
  VALUES (v_transfer_id, 'CREATED', v_actor);

  RETURN v_transfer_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_transfer(uuid, uuid, text, jsonb) TO authenticated;
REVOKE ALL ON FUNCTION public.create_transfer(uuid, uuid, text, jsonb) FROM PUBLIC;

-- submit_stock_transfer()

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
  SELECT * INTO v_transfer FROM public.inventory_transfers
  WHERE id = p_transfer_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'TRANSFER_NOT_FOUND: transfer tidak ditemukan';
  END IF;

  IF v_transfer.status != 'DRAFT' THEN
    IF v_transfer.status = 'PENDING' THEN
      RAISE NOTICE 'submit_stock_transfer: transfer % sudah PENDING, skip', p_transfer_id;
      RETURN;
    END IF;
    RAISE EXCEPTION 'INVALID_TRANSITION: hanya DRAFT yang dapat disubmit (current: %)', v_transfer.status;
  END IF;

  IF NOT public.auth_can_manage_all_stocks() THEN
    IF v_role IS DISTINCT FROM 'admin' OR v_transfer.created_by != v_actor THEN
      RAISE EXCEPTION 'FORBIDDEN: tidak berwenang submit transfer ini';
    END IF;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.inventory_transfer_items WHERE transfer_id = p_transfer_id) THEN
    RAISE EXCEPTION 'EMPTY_TRANSFER: transfer tidak memiliki item';
  END IF;

  FOR v_item IN SELECT * FROM public.inventory_transfer_items WHERE transfer_id = p_transfer_id
  LOOP
    PERFORM public.reserve_stock(
      v_item.stock_item_id, v_transfer.source_location_id,
      v_item.requested_quantity, 'inventory_transfer_item', v_item.id
    );
  END LOOP;

  UPDATE public.inventory_transfers
  SET status = 'PENDING', submitted_at = now(), submitted_by = v_actor, updated_at = now()
  WHERE id = p_transfer_id;

  INSERT INTO public.inventory_transfer_history (transfer_id, action, actor_id)
  VALUES (p_transfer_id, 'SUBMITTED', v_actor);
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_stock_transfer(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.submit_stock_transfer(uuid) FROM PUBLIC;

-- approve_stock_transfer()

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
  v_balance_lock RECORD;
BEGIN
  SELECT * INTO v_transfer FROM public.inventory_transfers
  WHERE id = p_transfer_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'TRANSFER_NOT_FOUND: transfer tidak ditemukan';
  END IF;

  IF v_transfer.status != 'PENDING' THEN
    IF v_transfer.status = 'APPROVED' THEN
      RAISE NOTICE 'approve_stock_transfer: transfer % sudah APPROVED, skip', p_transfer_id;
      RETURN;
    END IF;
    RAISE EXCEPTION 'INVALID_TRANSITION: hanya PENDING yang dapat diapprove (current: %)', v_transfer.status;
  END IF;

  IF NOT public.auth_can_manage_all_stocks() THEN
    RAISE EXCEPTION 'FORBIDDEN: hanya owner/admin_gudang yang dapat approve';
  END IF;

  FOR v_balance_lock IN
    SELECT DISTINCT si.stock_item_id, v_transfer.source_location_id AS location_id
    FROM public.inventory_transfer_items si WHERE si.transfer_id = p_transfer_id
    UNION
    SELECT DISTINCT si.stock_item_id, v_transfer.dest_location_id AS location_id
    FROM public.inventory_transfer_items si WHERE si.transfer_id = p_transfer_id
    ORDER BY stock_item_id, location_id
  LOOP
    INSERT INTO public.stock_balances (stock_item_id, location_id, physical_quantity, reserved_quantity)
    VALUES (v_balance_lock.stock_item_id, v_balance_lock.location_id, 0, 0)
    ON CONFLICT (stock_item_id, location_id) DO NOTHING;

    PERFORM 1 FROM public.stock_balances
    WHERE stock_item_id = v_balance_lock.stock_item_id AND location_id = v_balance_lock.location_id
    FOR UPDATE;
  END LOOP;

  FOR v_item IN
    SELECT sti.stock_item_id, sti.requested_quantity, sti.id as item_id
    FROM public.inventory_transfer_items sti WHERE sti.transfer_id = p_transfer_id
    ORDER BY sti.stock_item_id
  LOOP
    SELECT reserved_quantity INTO v_reserved
    FROM public.stock_balances
    WHERE stock_item_id = v_item.stock_item_id AND location_id = v_transfer.source_location_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'BALANCE_NOT_FOUND: source balance tidak ditemukan untuk item %', v_item.stock_item_id;
    END IF;

    IF v_reserved < v_item.requested_quantity THEN
      RAISE EXCEPTION 'RESERVATION_RELEASED: reservasi untuk item % tidak mencukupi (reserved: %, required: %)',
        v_item.stock_item_id, v_reserved, v_item.requested_quantity;
    END IF;
  END LOOP;

  FOR v_item IN SELECT * FROM public.inventory_transfer_items WHERE transfer_id = p_transfer_id
  LOOP
    UPDATE public.stock_balances
    SET physical_quantity = physical_quantity - v_item.requested_quantity,
        reserved_quantity = reserved_quantity - v_item.requested_quantity,
        updated_at = now()
    WHERE stock_item_id = v_item.stock_item_id AND location_id = v_transfer.source_location_id;

    UPDATE public.stock_balances
    SET physical_quantity = physical_quantity + v_item.requested_quantity,
        updated_at = now()
    WHERE stock_item_id = v_item.stock_item_id AND location_id = v_transfer.dest_location_id;

    INSERT INTO public.stock_movements (
      source, actor, stock_item_id, location_id, delta, result_quantity,
      reason, ref_type, ref_id, movement_type
    )
    SELECT 'transfer', v_actor, v_item.stock_item_id, v_transfer.source_location_id,
      -v_item.requested_quantity, sb.physical_quantity,
      'Transfer approved: source outbound', 'inventory_transfer_item', v_item.id, 'TRANSFER_OUT'
    FROM public.stock_balances sb
    WHERE sb.stock_item_id = v_item.stock_item_id AND sb.location_id = v_transfer.source_location_id;

    INSERT INTO public.stock_movements (
      source, actor, stock_item_id, location_id, delta, result_quantity,
      reason, ref_type, ref_id, movement_type
    )
    SELECT 'transfer', v_actor, v_item.stock_item_id, v_transfer.dest_location_id,
      v_item.requested_quantity, sb.physical_quantity,
      'Transfer approved: destination inbound', 'inventory_transfer_item', v_item.id, 'TRANSFER_IN'
    FROM public.stock_balances sb
    WHERE sb.stock_item_id = v_item.stock_item_id AND sb.location_id = v_transfer.dest_location_id;
  END LOOP;

  UPDATE public.inventory_transfers
  SET status = 'APPROVED', resolved_at = now(), resolved_by = v_actor,
      notes = COALESCE(p_notes, notes), updated_at = now()
  WHERE id = p_transfer_id;

  INSERT INTO public.inventory_transfer_history (transfer_id, action, actor_id, notes)
  VALUES (p_transfer_id, 'APPROVED', v_actor, p_notes);
END;
$$;

GRANT EXECUTE ON FUNCTION public.approve_stock_transfer(uuid, text) TO authenticated;
REVOKE ALL ON FUNCTION public.approve_stock_transfer(uuid, text) FROM PUBLIC;

-- reject_stock_transfer()

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
  SELECT * INTO v_transfer FROM public.inventory_transfers
  WHERE id = p_transfer_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'TRANSFER_NOT_FOUND: transfer tidak ditemukan';
  END IF;

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

  IF NOT public.auth_can_manage_all_stocks() THEN
    RAISE EXCEPTION 'FORBIDDEN: hanya owner/admin_gudang yang dapat reject';
  END IF;

  IF p_reason IS NULL OR trim(p_reason) = '' THEN
    RAISE EXCEPTION 'REJECT_REASON_REQUIRED: alasan reject wajib diisi';
  END IF;

  FOR v_item IN SELECT * FROM public.inventory_transfer_items WHERE transfer_id = p_transfer_id
  LOOP
    PERFORM public.release_reservation(
      v_item.stock_item_id, v_transfer.source_location_id,
      v_item.requested_quantity, 'inventory_transfer_item', v_item.id
    );
  END LOOP;

  UPDATE public.inventory_transfers
  SET status = 'REJECTED', resolved_at = now(), resolved_by = v_actor,
      reject_reason = p_reason, updated_at = now()
  WHERE id = p_transfer_id;

  INSERT INTO public.inventory_transfer_history (transfer_id, action, actor_id, notes)
  VALUES (p_transfer_id, 'REJECTED', v_actor, p_reason);
END;
$$;

GRANT EXECUTE ON FUNCTION public.reject_stock_transfer(uuid, text) TO authenticated;
REVOKE ALL ON FUNCTION public.reject_stock_transfer(uuid, text) FROM PUBLIC;

-- HARDEN-001: CHECK constraint for reject_reason

DO $$ BEGIN
  ALTER TABLE public.inventory_transfers
    ADD CONSTRAINT chk_reject_reason_required
    CHECK (status != 'REJECTED' OR reject_reason IS NOT NULL);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║  DONE                                                                     ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'INVENTORY SETUP COMPLETE';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'PART A: Preflight validation (read-only)';
  RAISE NOTICE 'PART B: stock_items + stock_balances (T001)';
  RAISE NOTICE 'PART C: adjust_stock, use_stock, reserve, release (T002)';
  RAISE NOTICE 'PART D: inventory_transfers + RPCs (T003)';
  RAISE NOTICE '';
  RAISE NOTICE 'Semua menggunakan IF NOT EXISTS / CREATE OR REPLACE.';
  RAISE NOTICE 'Aman di-run berulang kali.';
  RAISE NOTICE '========================================';
END $$;
