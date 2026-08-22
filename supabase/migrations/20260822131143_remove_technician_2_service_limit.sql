-- Remove the 2-service limit for technicians
-- This allows technicians to take unlimited active services simultaneously

-- Drop the trigger that enforces the 2-service limit
DROP TRIGGER IF EXISTS enforce_teknisi_active_limit ON service_orders;

-- Drop the function that checks the active limit
DROP FUNCTION IF EXISTS check_teknisi_active_limit();

-- Technicians are now free to take as many services as they want
