-- Migration: Add point column to customers table
ALTER TABLE customers ADD COLUMN IF NOT EXISTS point INTEGER DEFAULT 0;
NOTIFY pgrst, 'reload schema';
