-- Migration: Add profesi, email, alamat columns to customers
ALTER TABLE customers ADD COLUMN IF NOT EXISTS profesi TEXT DEFAULT '';
ALTER TABLE customers ADD COLUMN IF NOT EXISTS email TEXT DEFAULT '';
ALTER TABLE customers ADD COLUMN IF NOT EXISTS alamat TEXT DEFAULT '';
NOTIFY pgrst, 'reload schema';
