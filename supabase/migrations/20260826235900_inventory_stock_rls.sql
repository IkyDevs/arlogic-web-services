-- ============================================================================
-- STOCK TOKO — ROW LEVEL SECURITY (Phase 1b)
--
-- Menutup `public_all_access` untuk tabel stok & menegakkan isolasi cabang
-- SERVER-SIDE (keputusan final §5):
--   admin            : kelola stok cabangnya sendiri (inventory rows own-branch)
--   admin_gudang/owner: kelola gudang + stok SEMUA cabang
--   teknisi/qc/supervisor/engineer: baca sesuai scope; tanpa akses tulis stok
--
-- Tulis langsung ke stock_toko / stock_gudang / stock_movements DITOLAK bagi
-- semua role client — satu-satunya jalur tulis adalah RPC security definer
-- (adjust_store_stock / adjust_warehouse_stock).
-- ============================================================================

-- ── stock_toko ──────────────────────────────────────────────────────────────
alter table public.stock_toko enable row level security;

drop policy if exists public_all_access on public.stock_toko;

create policy stock_toko_select_scoped
  on public.stock_toko for select to authenticated
  using (
    public.auth_profile_role() in ('owner','engineer','admin_gudang','supervisor')
    or branch_id = public.auth_branch_id()
  );
-- Tanpa policy insert/update/delete => tolak tulis langsung (default deny).

-- ── stock_gudang ────────────────────────────────────────────────────────────
alter table public.stock_gudang enable row level security;

drop policy if exists public_all_access on public.stock_gudang;

create policy stock_gudang_select_mgmt
  on public.stock_gudang for select to authenticated
  using (public.auth_profile_role() in ('owner','engineer','admin_gudang'));
-- Tanpa policy tulis langsung.

-- ── stock_movements (ledger) ────────────────────────────────────────────────
alter table public.stock_movements enable row level security;

create policy stock_movements_select_mgmt
  on public.stock_movements for select to authenticated
  using (public.auth_profile_role() in ('owner','engineer','admin_gudang','supervisor'));
-- Tulis hanya lewat RPC (security definer).

-- ── inventory (katalog) — pertahankan CRUD, terapkan kepemilikan cabang ─────
alter table public.inventory enable row level security;

drop policy if exists public_all_access on public.inventory;

create policy inventory_select_authenticated
  on public.inventory for select to authenticated
  using (true);

create policy inventory_insert_scoped
  on public.inventory for insert to authenticated
  with check (
    public.auth_profile_role() in ('owner','admin_gudang')
    or (public.auth_profile_role() = 'admin'
        and (branch_id = public.auth_branch_id()))
  );

create policy inventory_update_scoped
  on public.inventory for update to authenticated
  using (
    public.auth_profile_role() in ('owner','admin_gudang')
    or (public.auth_profile_role() = 'admin'
        and branch_id = public.auth_branch_id())
  )
  with check (
    public.auth_profile_role() in ('owner','admin_gudang')
    or (public.auth_profile_role() = 'admin'
        and branch_id = public.auth_branch_id())
  );

create policy inventory_delete_scoped
  on public.inventory for delete to authenticated
  using (
    public.auth_profile_role() in ('owner','admin_gudang')
    or (public.auth_profile_role() = 'admin'
        and branch_id = public.auth_branch_id())
  );
