-- ============================================================================
-- GOOGLE SPREADSHEET INTEGRATION (OPTIONAL, Phase 6) — settings singleton
--
-- Database tetap SOURCE OF TRUTH. Sheets diakses lewat Apps Script Web App
-- milik Admin Gudang (URL + secret token), bukan kredensial OAuth global.
-- Sync failure TIDAK memengaruhi operasi inventory (keputusan final §15).
-- ============================================================================

create table if not exists public.inventory_sheets_settings (
  id              uuid primary key default gen_random_uuid(),
  enabled         boolean not null default false,
  apps_script_url text,
  secret_token    text,
  spreadsheet_id  text,
  auto_sync       boolean not null default false,
  last_pull_at    timestamptz,
  last_push_at    timestamptz,
  last_result     text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

alter table public.inventory_sheets_settings enable row level security;

create policy sheets_settings_select_mgmt
  on public.inventory_sheets_settings for select to authenticated
  using (public.auth_profile_role() in ('owner','admin_gudang'));

create policy sheets_settings_insert_mgmt
  on public.inventory_sheets_settings for insert to authenticated
  with check (public.auth_profile_role() in ('owner','admin_gudang'));

create policy sheets_settings_update_mgmt
  on public.inventory_sheets_settings for update to authenticated
  using (public.auth_profile_role() in ('owner','admin_gudang'))
  with check (public.auth_profile_role() in ('owner','admin_gudang'));

create policy sheets_settings_delete_mgmt
  on public.inventory_sheets_settings for delete to authenticated
  using (public.auth_profile_role() in ('owner','admin_gudang'));
