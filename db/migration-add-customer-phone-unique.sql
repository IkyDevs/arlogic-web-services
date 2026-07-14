-- Migration: Add UNIQUE constraint on customers.phone
-- Hapus duplikat dulu (keep row dengan created_at paling lama)
DELETE FROM customers a USING customers b
WHERE a.id < b.id AND a.phone = b.phone;

CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);
NOTIFY pgrst, 'reload schema';
