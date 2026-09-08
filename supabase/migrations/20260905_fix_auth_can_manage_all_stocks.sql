CREATE OR REPLACE FUNCTION public.auth_can_manage_all_stocks()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(role,'') IN ('owner', 'admin_gudang')
      OR (coalesce(role,'') = 'admin' AND coalesce(is_admin_gudang, false))
    FROM public.profiles WHERE id = auth.uid()
$$;
