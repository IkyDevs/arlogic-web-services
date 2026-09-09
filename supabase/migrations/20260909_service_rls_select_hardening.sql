-- =============================================================================
-- T005.2.2: Service RLS SELECT Hardening
-- =============================================================================
-- Purpose: Harden SELECT RLS policies for Flutter direct Supabase READ access
-- 
-- Architecture:
--   Flutter READ → Supabase direct → RLS SELECT as security boundary
--   Flutter WRITE → Dio → Existing Next.js API routes
--
-- Policy changes:
--   - REMOVE: auth_all, supervisor_all, admin_all, customer_tracking, teknisi_select_own_service
--   - REMOVE: public_all_access (service_items, service_timeline, qc_reviews)
--   - CREATE: Branch-isolated SELECT policies using auth_branch_id(), auth_profile_role()
--   - CREATE: Explicit write policies for web compatibility
--
-- Author: T005.2.2 RLS Hardening
-- Date: 2026-09-09
-- =============================================================================

-- =============================================================================
-- SECTION 1: REMOVE DANGEROUS SELECT POLICIES
-- =============================================================================

DROP POLICY IF EXISTS "auth_all" ON service_orders;
DROP POLICY IF EXISTS "supervisor_all" ON service_orders;
DROP POLICY IF EXISTS "admin_all" ON service_orders;
DROP POLICY IF EXISTS "customer_tracking" ON service_orders;
DROP POLICY IF EXISTS "teknisi_select_own_service" ON service_orders;
DROP POLICY IF EXISTS "public_all_access" ON service_items;
DROP POLICY IF EXISTS "public_all_access" ON service_timeline;
DROP POLICY IF EXISTS "public_all_access" ON qc_reviews;

-- =============================================================================
-- SECTION 2: CREATE HARDENED SELECT POLICIES
-- =============================================================================

DROP POLICY IF EXISTS "service_orders_select_hardened" ON service_orders;
CREATE POLICY "service_orders_select_hardened"
ON service_orders
FOR SELECT
TO authenticated
USING (
    auth_profile_role() = 'owner'
    OR
    (
        branch_id = auth_branch_id()
        AND (
            transferred_to_branch_id IS NULL
            OR transferred_to_branch_id = auth_branch_id()
        )
    )
    OR
    assigned_teknisi_id = auth.uid()
);

DROP POLICY IF EXISTS "service_items_select_parent_based" ON service_items;
CREATE POLICY "service_items_select_parent_based"
ON service_items
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM service_orders so
        WHERE so.id = service_items.service_order_id
        AND (
            auth_profile_role() = 'owner'
            OR
            (
                so.branch_id = auth_branch_id()
                AND (
                    so.transferred_to_branch_id IS NULL
                    OR so.transferred_to_branch_id = auth_branch_id()
                )
            )
            OR
            so.assigned_teknisi_id = auth.uid()
        )
    )
);

DROP POLICY IF EXISTS "service_timeline_select_parent_based" ON service_timeline;
CREATE POLICY "service_timeline_select_parent_based"
ON service_timeline
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM service_orders so
        WHERE so.id = service_timeline.service_order_id
        AND (
            auth_profile_role() = 'owner'
            OR
            (
                so.branch_id = auth_branch_id()
                AND (
                    so.transferred_to_branch_id IS NULL
                    OR so.transferred_to_branch_id = auth_branch_id()
                )
            )
            OR
            so.assigned_teknisi_id = auth.uid()
        )
    )
);

DROP POLICY IF EXISTS "qc_reviews_select_parent_based" ON qc_reviews;
CREATE POLICY "qc_reviews_select_parent_based"
ON qc_reviews
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM service_orders so
        WHERE so.id = qc_reviews.service_order_id
        AND (
            auth_profile_role() = 'owner'
            OR
            (
                so.branch_id = auth_branch_id()
                AND (
                    so.transferred_to_branch_id IS NULL
                    OR so.transferred_to_branch_id = auth_branch_id()
                )
            )
            OR
            so.assigned_teknisi_id = auth.uid()
        )
    )
);

-- =============================================================================
-- SECTION 3: CREATE EXPLICIT WRITE POLICIES (Web Compatibility)
-- =============================================================================

DROP POLICY IF EXISTS "service_items_insert_authenticated" ON service_items;
CREATE POLICY "service_items_insert_authenticated"
ON service_items
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "service_items_update_authenticated" ON service_items;
CREATE POLICY "service_items_update_authenticated"
ON service_items
FOR UPDATE
TO authenticated
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "service_items_delete_authenticated" ON service_items;
CREATE POLICY "service_items_delete_authenticated"
ON service_items
FOR DELETE
TO authenticated
USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "service_timeline_insert_authenticated" ON service_timeline;
CREATE POLICY "service_timeline_insert_authenticated"
ON service_timeline
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "qc_reviews_insert_authenticated" ON qc_reviews;
CREATE POLICY "qc_reviews_insert_authenticated"
ON qc_reviews
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);

-- =============================================================================
-- RLS STATUS:
--   SELECT: HARDENED (branch-isolated, parent-based for children)
--   INSERT: LEGACY (authenticated users can insert)
--   UPDATE: LEGACY (service_items only, authenticated users can update)
--   DELETE: LEGACY (service_items only, authenticated users can delete)
-- =============================================================================
