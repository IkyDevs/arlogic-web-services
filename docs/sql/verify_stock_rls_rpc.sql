-- ============================================================================
-- RUNBOOK VERIFIKASI STOCK TOKO — jalankan manual di Supabase SQL Editor
-- (STAGING lebih dulu, baru PRODUCTION). Setiap langkah punya EXPECTED.
-- ============================================================================

-- ── 1. Struktur ada ─────────────────────────────────────────────────────────
-- EXPECTED: stock_toko, stock_gudang, stock_movements muncul; RLS enabled = true
select tablename, rowsecurity from pg_tables
 where schemaname = 'public'
   and tablename in ('inventory','stock_toko','stock_gudang','stock_movements');

-- ── 2. Tidak ada policy write langsung utk client pada tabel stok ───────────
-- EXPECTED: hanya policy SELECT (stock_toko_select_scoped / stock_gudang_select_mgmt /
--           stock_movements_select_mgmt); TIDAK ada INSERT/UPDATE/DELETE policy.
select tablename, policyname, cmd from pg_policies
 where schemaname='public'
   and tablename in ('stock_toko','stock_gudang','stock_movements');

-- ── 3. Isolasi cabang (jalankan SEBAGAI user admin cabang A) ────────────────
-- 3a. Baca stok: EXPECTED hanya baris cabangnya sendiri.
select * from public.stock_toko;
-- 3b. Tulis langsung: EXPECTED ERROR (permission denied oleh RLS).
insert into public.stock_toko (inventory_id, branch_id, quantity)
values (gen_random_uuid(), (select branch_id from public.profiles where id = auth.uid()), 5);
-- 3c. RPC ke cabang lain: EXPECTED ERROR 'FORBIDDEN_BRANCH'.
--     ganti <UUID_CABANG_B> dulu.
select public.adjust_store_stock(
  (select id from public.inventory limit 1),
  '<UUID_CABANG_B>', 1, 'web_app', 'tes otorisasi');
-- 3d. RPC cabang sendiri: EXPECTED sukses & mengembalikan qty baru.
select public.adjust_store_stock(
  (select inventory_id from public.stock_toko limit 1),
  (select branch_id from public.profiles where id = auth.uid()),
  -0 + 1, 'web_app', 'tes tambah');

-- ── 4. Anti-minus ───────────────────────────────────────────────────────────
-- EXPECTED ERROR 'INSUFFICIENT_STOCK'.
select public.adjust_store_stock(
  (select inventory_id from public.stock_toko limit 1),
  (select branch_id from public.profiles where id = auth.uid()),
  -999999, 'web_app', 'tes minus');

-- ── 5. Guard kolom legacy ───────────────────────────────────────────────────
-- Jalankan SEBAGAI admin cabang biasa:
-- EXPECTED ERROR 'STOCK_PATH_FORBIDDEN'.
update public.inventory set store_stock = 999 where id = (select id from public.inventory limit 1);

-- ── 6. Ledger tercatat ──────────────────────────────────────────────────────
-- EXPECTED: baris movement utk tiap operasi RPC di atas (source/actor/delta benar).
select * from public.stock_movements order by created_at desc limit 20;

-- ── 7. Dual-write kolom legacy ──────────────────────────────────────────────
-- EXPECTED: inventory.store_stock == SUM(stock_toko.quantity) per inventory.
select i.id, i.store_stock,
       coalesce((select sum(quantity) from public.stock_toko t where t.inventory_id = i.id),0) as total_toko
  from public.inventory i
 where exists (select 1 from public.stock_toko t where t.inventory_id = i.id);
