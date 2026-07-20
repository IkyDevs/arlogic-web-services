-- Add missing columns to service_orders
ALTER TABLE service_orders ADD COLUMN IF NOT EXISTS discount INTEGER DEFAULT 0;
ALTER TABLE service_orders ADD COLUMN IF NOT EXISTS discount_percentage NUMERIC(5,2) DEFAULT 0;
ALTER TABLE service_orders ADD COLUMN IF NOT EXISTS qc_submit_notes TEXT;
