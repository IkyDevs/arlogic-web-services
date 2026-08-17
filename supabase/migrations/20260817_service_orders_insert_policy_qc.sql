-- Allow staff roles (admin, owner, qc, teknisi) to insert service_orders.
-- QC reported: "permission denied for table service_orders" when creating service.
-- Mirrors existing business_settings policy pattern (profiles.role).
DROP POLICY IF EXISTS "Insert service orders staff" ON service_orders;
CREATE POLICY "Insert service orders staff" ON service_orders
FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role IN ('admin', 'owner', 'qc', 'teknisi')
  )
);
