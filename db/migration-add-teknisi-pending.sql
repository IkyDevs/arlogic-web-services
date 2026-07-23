-- Migration: Add teknisi pending feature
ALTER TABLE service_orders ADD COLUMN IF NOT EXISTS teknisi_pending_reason TEXT;
ALTER TABLE service_orders ADD COLUMN IF NOT EXISTS pending_teknisi_approved BOOLEAN DEFAULT NULL;

NOTIFY pgrst, 'reload schema';
