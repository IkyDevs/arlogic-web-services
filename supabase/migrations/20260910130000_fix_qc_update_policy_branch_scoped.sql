-- ============================================================================
-- FIX QC UPDATE POLICY: Branch-scoped authorization for QC/Supervisor
-- 
-- Masalah: Policy "QC can update order status" (20260910120000) cek 
-- auth_profile_role() = 'qc' secara ketat. Tapi historisnya supervisor 
-- (gusti febrian di cabang Jember/Pusat) juga melakukan QC approve.
-- 
-- Solusi: Policy UPDATE branch-scoped yang konsisten dengan policy SELECT 
-- yang sudah di-hardening (20260909_service_rls_select_hardening.sql).
--   - Owner: selalu bisa (bypass branch)
--   - Supervisor & QC: hanya cabang mereka (branch_id = auth_branch_id())
--   - Admin: selalu bisa (bypass branch)
--   - Transfer cabang: transferred_to_branch_id harus null atau = auth_branch_id()
-- ============================================================================

-- 1. DROP policy lama yang salah
DROP POLICY IF EXISTS "QC can update order status" ON service_orders;

-- 2. CREATE policy baru yang benar (branch-scoped, konsisten dengan SELECT policy)
CREATE POLICY "QC can update order status"
ON service_orders
FOR UPDATE
USING (
  auth.role() = 'authenticated'
  AND status = 'qc_pending'
  AND (
    -- Owner selalu bisa (bypass branch scoping)
    auth_profile_role() = 'owner'
    OR
    -- Supervisor & QC: hanya cabang mereka + handle transfer cabang
    (
      auth_profile_role() IN ('supervisor', 'qc')
      AND branch_id = auth_branch_id()
      AND (
        transferred_to_branch_id IS NULL
        OR transferred_to_branch_id = auth_branch_id()
      )
    )
    OR
    -- Admin (non-cabang) bisa semua
    auth_profile_role() = 'admin'
  )
)
WITH CHECK (
  auth.role() = 'authenticated'
  AND status IN ('completed', 'revision_required')
  AND (
    -- Owner selalu bisa
    auth_profile_role() = 'owner'
    OR
    -- Supervisor & QC: hanya cabang mereka + handle transfer cabang
    (
      auth_profile_role() IN ('supervisor', 'qc')
      AND branch_id = auth_branch_id()
      AND (
        transferred_to_branch_id IS NULL
        OR transferred_to_branch_id = auth_branch_id()
      )
    )
    OR
    -- Admin bypass branch
    auth_profile_role() = 'admin'
  )
);

-- ============================================================================
-- VERIFIKASI: Pastikan hanya ada SATU policy UPDATE dengan nama ini
-- (policy lama sudah ke-drop, bukan numpuk 2 policy)
-- Jalankan: SELECT * FROM pg_policies WHERE tablename = 'service_orders' AND cmd = 'UPDATE';
-- ============================================================================