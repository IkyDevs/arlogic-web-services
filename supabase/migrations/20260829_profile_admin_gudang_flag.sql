-- ============================================================================
-- ADMIN GUDANG FLAG (Phase B) — additive, backward compatible.
--
-- Model baru (keputusan final): TIDAK ada role terpisah 'admin_gudang'.
--   profiles.is_admin_gudang = false → Admin Toko biasa
--   profiles.is_admin_gudang = true  → Admin Toko + Admin Gudang
--
-- Data migration: profile ber-role lama 'admin_gudang' dipetakan ke
--   role='admin' + flag=true (perilaku tidak berubah).
-- Mirror JWT metadata agar middleware/sidebar membaca tanpa query tambahan;
-- efektif setelah token berikutnya (re-login).
-- Rollback: drop column; role lama tidak dapat direkonstruksi otomatis
--   (dokumentasikan sebelum rollback).
-- ============================================================================

alter table public.profiles
  add column if not exists is_admin_gudang boolean not null default false;

update public.profiles
   set is_admin_gudang = true,
       role = 'admin'
 where role = 'admin_gudang';

-- Mirror ke auth metadata (JWT) utk user ber-flag
update auth.users u
   set raw_user_meta_data = coalesce(u.raw_user_meta_data, '{}'::jsonb)
         || jsonb_build_object('is_admin_gudang', p.is_admin_gudang),
       raw_app_meta_data = coalesce(u.raw_app_meta_data, '{}'::jsonb)
         || jsonb_build_object('is_admin_gudang', p.is_admin_gudang)
  from public.profiles p
 where p.id = u.id
   and p.is_admin_gudang;

-- Helper otorisasi terpusat (dipakai RPC & RLS)
create or replace function public.auth_can_manage_all_stocks()
returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(role,'') = 'owner'
      or (coalesce(role,'') = 'admin' and coalesce(is_admin_gudang, false))
    from public.profiles where id = auth.uid()
$$;

create or replace function public.auth_is_admin_gudang()
returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(role,'')='admin' and coalesce(is_admin_gudang,false)
    from public.profiles where id = auth.uid()
$$;

-- ── Sinkronkan otorisasi RPC & RLS ke model flag ───────────────────────────

create or replace function public.adjust_store_stock(
  p_inventory_id uuid,
  p_branch_id    uuid,
  p_delta        int,
  p_source       text default 'web_app',
  p_reason       text default null,
  p_ref_type     text default null,
  p_ref_id       uuid default null
)
returns int
language plpgsql security definer set search_path = public as $$
declare
  v_role   text := public.auth_profile_role();
  v_branch uuid := public.auth_branch_id();
  v_actor  uuid := auth.uid();
  v_cur    int;
  v_next   int;
begin
  if p_delta is null or p_delta = 0 then
    raise exception 'DELTA_INVALID: delta stok tidak boleh 0/kosong';
  end if;
  if p_branch_id is null then
    raise exception 'BRANCH_REQUIRED: cabang wajib ditentukan';
  end if;
  if p_inventory_id is null then
    raise exception 'INVENTORY_REQUIRED';
  end if;

  if not coalesce(public.auth_can_manage_all_stocks(), false) then
    if v_role is distinct from 'admin'
       or v_branch is null or v_branch <> p_branch_id then
      raise exception 'FORBIDDEN_BRANCH: tidak berwenang mengubah stok cabang ini';
    end if;
  end if;

  select quantity into v_cur
    from public.stock_toko
    where inventory_id = p_inventory_id and branch_id = p_branch_id
    for update;

  v_next := coalesce(v_cur, 0) + p_delta;
  if v_next < 0 then
    raise exception 'INSUFFICIENT_STOCK: sisa stok %', coalesce(v_cur, 0);
  end if;

  if v_cur is null then
    insert into public.stock_toko (inventory_id, branch_id, quantity, updated_at)
    values (p_inventory_id, p_branch_id, v_next, now());
  else
    update public.stock_toko
       set quantity = v_next, updated_at = now()
     where inventory_id = p_inventory_id and branch_id = p_branch_id;
  end if;

  perform set_config('app.via_stock_rpc', 'on', true);
  update public.inventory
     set store_stock = (select coalesce(sum(quantity), 0)
                          from public.stock_toko
                         where inventory_id = p_inventory_id)
   where id = p_inventory_id;

  insert into public.stock_movements
    (source, actor, branch_id, inventory_id, delta, result_quantity, reason, ref_type, ref_id)
  values
    (coalesce(nullif(p_source,''), 'web_app'), v_actor, p_branch_id,
     p_inventory_id, p_delta, v_next, p_reason, p_ref_type, p_ref_id);

  return v_next;
end $$;

create or replace function public.adjust_warehouse_stock(
  p_inventory_id uuid,
  p_delta        int,
  p_source       text default 'gudang',
  p_reason       text default null,
  p_ref_type     text default null,
  p_ref_id       uuid default null
)
returns int
language plpgsql security definer set search_path = public as $$
declare
  v_cur  int;
  v_next int;
begin
  if p_delta is null or p_delta = 0 then
    raise exception 'DELTA_INVALID';
  end if;
  if p_inventory_id is null then
    raise exception 'INVENTORY_REQUIRED';
  end if;
  if not coalesce(public.auth_can_manage_all_stocks(), false) then
    raise exception 'FORBIDDEN: hanya admin gudang/owner yang dapat mengubah stock gudang';
  end if;

  select quantity into v_cur
    from public.stock_gudang
    where inventory_id = p_inventory_id
    for update;

  v_next := coalesce(v_cur, 0) + p_delta;
  if v_next < 0 then
    raise exception 'INSUFFICIENT_STOCK: sisa stok gudang %', coalesce(v_cur, 0);
  end if;

  if v_cur is null then
    insert into public.stock_gudang (inventory_id, quantity, updated_at)
    values (p_inventory_id, v_next, now());
  else
    update public.stock_gudang
       set quantity = v_next, updated_at = now()
     where inventory_id = p_inventory_id;
  end if;

  perform set_config('app.via_stock_rpc', 'on', true);
  update public.inventory
     set warehouse_stock = v_next
   where id = p_inventory_id;

  insert into public.stock_movements
    (source, actor, branch_id, inventory_id, delta, result_quantity, reason, ref_type, ref_id)
  values
    (coalesce(nullif(p_source,''), 'gudang'), auth.uid(), null,
     p_inventory_id, p_delta, v_next, p_reason, p_ref_type, p_ref_id);

  return v_next;
end $$;

-- ── RLS: ganti referensi role lama dengan helper flag ───────────────────────

drop policy if exists stock_toko_select_scoped on public.stock_toko;
create policy stock_toko_select_scoped
  on public.stock_toko for select to authenticated
  using (
    public.auth_can_manage_all_stocks()
    or public.auth_profile_role() in ('engineer','supervisor')
    or branch_id = public.auth_branch_id()
  );

drop policy if exists stock_gudang_select_mgmt on public.stock_gudang;
create policy stock_gudang_select_mgmt
  on public.stock_gudang for select to authenticated
  using (public.auth_can_manage_all_stocks());

drop policy if exists stock_movements_select_mgmt on public.stock_movements;
create policy stock_movements_select_mgmt
  on public.stock_movements for select to authenticated
  using (public.auth_can_manage_all_stocks()
         or public.auth_profile_role() in ('engineer','supervisor'));

drop policy if exists sheets_settings_select_mgmt on public.inventory_sheets_settings;
create policy sheets_settings_select_mgmt
  on public.inventory_sheets_settings for select to authenticated
  using (public.auth_can_manage_all_stocks());

drop policy if exists sheets_settings_insert_mgmt on public.inventory_sheets_settings;
create policy sheets_settings_insert_mgmt
  on public.inventory_sheets_settings for insert to authenticated
  with check (public.auth_can_manage_all_stocks());

drop policy if exists sheets_settings_update_mgmt on public.inventory_sheets_settings;
create policy sheets_settings_update_mgmt
  on public.inventory_sheets_settings for update to authenticated
  using (public.auth_can_manage_all_stocks())
  with check (public.auth_can_manage_all_stocks());

drop policy if exists sheets_settings_delete_mgmt on public.inventory_sheets_settings;
create policy sheets_settings_delete_mgmt
  on public.inventory_sheets_settings for delete to authenticated
  using (public.auth_can_manage_all_stocks());
