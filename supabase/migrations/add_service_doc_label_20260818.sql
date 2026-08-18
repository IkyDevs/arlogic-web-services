-- Label foto initial condition (depan, kanan, belakang, kiri, bawah, atas, surat tanda terima)
ALTER TABLE service_documentation ADD COLUMN IF NOT EXISTS label text;
