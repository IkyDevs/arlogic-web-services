-- Policy: Izinkan QC reviewer update status service_order dari qc_pending ke completed/revision_required
-- Terpisah dari policy "Atomic service assignment" yang sudah ada (tidak diubah)

CREATE POLICY "QC can update order status"
ON service_orders
FOR UPDATE
USING (
  -- Baris LAMA: hanya izinkan mulai dari qc_pending
  auth.role() = 'authenticated'
  AND auth_profile_role() = 'qc'
  AND status = 'qc_pending'
)
WITH CHECK (
  -- Baris BARU: hasil akhir harus completed atau revision_required
  auth.role() = 'authenticated'
  AND auth_profile_role() = 'qc'
  AND status IN ('completed', 'revision_required')
);
