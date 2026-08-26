-- ============================================================================
-- STOCK TOKO CORE FOUNDATION (Phase 1a)
--
-- Tabel stok baru sesuai db/compleated-database.md:
--   stock_toko   (inventory_id + branch_id + quantity) -> stok per cabang
--   stock_gudang (inventory_id UNIQUE + quantity)      -> gudang pusat
-- Tambahan:
--   stock_movements  -> ledger audit semua perubahan stok (source/actor/delta)
--   item_class       -> 'sparepart' | 'jam' (kolom inventory)
--   Guard trigger    -> store_stock/warehouse_stock hanya boleh berubah via
--                       RPC terpusat (app.via_stock_rpc) atau admin_gudang/owner.
--
-- Idempotent. Rollback: DROP tabel/policy/function pada migrasi ini & berikutnya.
-- ============================================================================

-- ── Helper identitas pemanggil (dipakai RLS, trigger, dan RPC) ──────────────
create or replace function public.auth_profile_role()
returns text
language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid()
$$;

create or replace function public.auth_branch_id()
returns uuid
language sql stable security definer set search_path = public as $$
  select branch_id from public.profiles where id = auth.uid()
$$;

-- ── Tabel stok (schema = dokumentasi; create-if-not-exists) ─────────────────
create table if not exists public.stock_toko (
  id           uuid primary key default gen_random_uuid(),
  inventory_id uuid,
  branch_id    uuid,
  quantity     int4,
  updated_at   timestamptz
);

create table if not exists public.stock_gudang (
  id           uuid primary key default gen_random_uuid(),
  inventory_id uuid unique,
  quantity     int4,
  updated_at   timestamptz
);

-- Ledger perubahan stok (sumber kebenaran audit + bekal sinkronisasi Sheets)
create table if not exists public.stock_movements (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz not null default now(),
  source          text        not null, -- web_app|service_transaction|technician|qc|gudang|layanan|google_sheets
  actor           uuid,
  branch_id       uuid,
  inventory_id    uuid        not null,
  delta           int4        not null,
  result_quantity int4,
  reason          text,
  ref_type        text,                 -- 'layanan_item'|'service_item'|'adjustment'|...
  ref_id          uuid
);

create index if not exists idx_stock_toko_inv_branch
  on public.stock_toko (inventory_id, branch_id);
create index if not exists idx_stock_toko_branch
  on public.stock_toko (branch_id);
create index if not exists idx_stock_movements_inv
  on public.stock_movements (inventory_id, created_at desc);
create index if not exists idx_stock_movements_branch
  on public.stock_movements (branch_id, created_at desc);

-- Klasifikasi item (migrasi 20260825 sudah menambahkan; defensif-if-not-exists)
alter table public.inventory add column if not exists item_class text not null default 'sparepart';

-- ── Guard: kolom legacy store_stock/warehouse_stock hanya via jalur pusat ───
create or replace function public.guard_inventory_legacy_stock()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_role text := public.auth_profile_role();
begin
  if (new.store_stock is distinct from old.store_stock)
     or (new.warehouse_stock is distinct from old.warehouse_stock) then
    if coalesce(current_setting('app.via_stock_rpc', true), '') <> 'on'
       and coalesce(v_role,'') not in ('admin_gudang','owner') then
      raise exception 'STOCK_PATH_FORBIDDEN: perubahan store_stock/warehouse_stock harus melalui operasi inventory terpusat';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists trg_guard_inventory_legacy on public.inventory;
create trigger trg_guard_inventory_legacy
  before update on public.inventory
  for each row execute function public.guard_inventory_legacy_stock();
