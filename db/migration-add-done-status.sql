-- Migration: Add 'done' status to service_orders CHECK constraint
ALTER TABLE service_orders DROP CONSTRAINT IF EXISTS service_orders_status_check;
ALTER TABLE service_orders ADD CONSTRAINT service_orders_status_check
  CHECK (status IN ('pending','assigned','in_progress','req_sparepart_admin','po_pending','sparepart_ready','qc_pending','revision_required','completed','done','cancelled'));
NOTIFY pgrst, 'reload schema';
