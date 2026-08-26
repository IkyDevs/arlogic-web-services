-- ============================================================================
-- STOCK TOKO — ATOMIC ADJUSTMENT RPC (Phase 1c)
--
-- Satu pintu perubahan stok (keputusan final §18):
--   * validasi role + cabang di server
--   * row-lock (FOR UPDATE) + anti-minus  -> aman race condition
--   * dual-write kolom legacy inventory.store_stock/warehouse_stock
--     (store_stock = TOTAL lintas cabang utk katalog multi-cabang)
--   * catat stock_movements (ledger; source siap utk Google Sheets Phase 6)
--
-- Dipanggil dari aplikasi: supabase.rpc('adjust_store_stock', {...})
-- ============================================================================

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

  -- Otorisasi server-side
  if coalesce(v_role,'') not in ('owner','admin_gudang') then
    if v_role is distinct from 'admin'
       or v_branch is null or v_branch <> p_branch_id then
      raise exception 'FORBIDDEN_BRANCH: tidak berwenang mengubah stok cabang ini';
    end if;
  end if;

  -- Lock baris lalu hitung (atomik terhadap concurrent adjustment)
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

  -- Dual-write kolom legacy = total seluruh cabang (katalog multi-cabang)
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

-- ----------------------------------------------------------------------------

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
  v_role text := public.auth_profile_role();
  v_cur  int;
  v_next int;
begin
  if p_delta is null or p_delta = 0 then
    raise exception 'DELTA_INVALID: delta stok tidak boleh 0/kosong';
  end if;
  if p_inventory_id is null then
    raise exception 'INVENTORY_REQUIRED';
  end if;

  if coalesce(v_role,'') not in ('owner','admin_gudang') then
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

grant execute on function public.adjust_store_stock(uuid,uuid,int,text,text,text,uuid) to authenticated;
grant execute on function public.adjust_warehouse_stock(uuid,int,text,text,text,uuid) to authenticated;
