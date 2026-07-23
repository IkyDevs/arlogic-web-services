-- =====================================================
-- MIGRATION: Add missing indexes for query performance
-- Date: 2026-07-23
-- =====================================================

-- 1. service_orders.created_at — sering di-order by dan filter tanggal
CREATE INDEX IF NOT EXISTS idx_service_orders_created_at ON service_orders(created_at DESC);

-- 2. service_orders.assigned_teknisi_id — dipakai di QueueList filter
CREATE INDEX IF NOT EXISTS idx_service_orders_teknisi ON service_orders(assigned_teknisi_id);

-- 3. layanan.created_at — dipakai di dashboard queries (statistik harian/bulanan)
CREATE INDEX IF NOT EXISTS idx_layanan_created_at ON layanan(created_at DESC);

-- 4. service_documentation.stage — difilter di banyak tempat (initial_condition, progress, qc)
CREATE INDEX IF NOT EXISTS idx_service_doc_stage ON service_documentation(stage);

-- 5. expenses.created_at — dipakai di expenses list dengan filter tanggal
CREATE INDEX IF NOT EXISTS idx_expenses_created_at ON expenses(created_at DESC);

NOTIFY pgrst, 'reload schema';
