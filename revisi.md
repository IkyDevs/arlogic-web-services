# Revisi

## Revisi yang Sudah Dilakukan

### 2026-07-05

#### Supabase Project Recovery
- Project Supabase di-recreate setelah accidentally deleted
- Update semua RLS policies dari `auth.role() = 'authenticated'` ke `auth.uid() IS NOT NULL`
- Drop semua policy lama sebelum recreate policy baru
- Tambahkan `GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated` di `db/supabase-schema.sql`
- Tambahkan `GRANT USAGE ON SCHEMA public TO authenticated` dan `anon`

#### Permission Denied Fix
- Error `permission denied for table profiles` di `lib/supabase/profile.ts`
- Error `permission denied for table service_orders`
- Error `permission denied for table inventory`
- Error `permission denied for table layanan`
- Solusi: policy cleanup + grant privileges + schema cache reload

#### Schema Cache / Column Not Found
- Error `column "jenis_layanan" of relation "layanan" already exists`
- Error `column "created_by_name" of relation "layanan" does not exist`
- Error `column "handled_by_name" of relation "layanan" does not exist`
- Solusi:
  - Tambahkan blok migrasi di `db/layanan.sql` dengan `IF EXISTS` / `IF NOT EXISTS`
  - Rename kolom lama: `create_by` → `created_by`, `service_type` → `jenis_layanan`, `payment_method` → `metode_pembayaran`, `sku_details` → `detail_sku`, `nominal_pembayaran` → `nominal`
  - Tambahkan kolom baru jika belum ada: `handled_by_name`, `created_by_name`, `status`, `jenis_layanan`, `metode_pembayaran`, `detail_sku`, `nominal`, `notes`, `photo_url`
  - Tambahkan `NOTIFY pgrst, 'reload schema'` di akhir migration

#### API Route Alignment
- Update `app/api/layanan/route.ts` agar konsisten nama kolom dengan database
- `service_type` → `jenis_layanan`
- `payment_method` → `metode_pembayaran`
- `sku_details` → `detail_sku`
- `nominal_pembayaran` → `nominal`

#### Upload Telegram Fix
- Fix `.env` Telegram channel IDs dari URL (`https://t.me/...`) ke username (`@...`) atau numeric ID
- Fix `hooks/useUpload.ts` error handling: prioritas `data.details || data.error || 'Upload failed'` agar pesan error asli dari server tampil

#### Attendance Overhaul
- Update `components/teknisi/AttendanceModal.tsx`
- Ganti template Telegram ke format yang diminta: `ABSEN MASUK` / `ABSEN PULANG` dengan `absensi: tanggal bulan tahun jam:menit:detik`, `role`, `nama`, `total jam`, `lembur`
- Tambahkan checkbox lembur + textarea catatan pada check-out
- Perhitungan lembur diubah dari expectedHours menjadi fixed threshold jam 20:00 (8 malam)
- Simpan `overtime_minutes`, `is_overtime`, `notes` ke tabel `attendances`

#### Attendance Enforcement
- Tambahkan enforcement popup di `app/admin/page.tsx`, `app/teknisi/page.tsx`, dan `app/qc/page.tsx`
- Jika user belum absen masuk dan jam sudah >= 11:00, maka modal absensi muncul otomatis
- Memblokir dashboard sampai user absen masuk

#### TypeScript Fixes
- Fix type errors pada kedua attendance modal (`user_metadata`, `photoUrl` nullability)
- Fix immutable string concatenation pada caption overtime di check-out

#### Attendance Unification
- Hapus `components/admin/AdminAttendanceModal.tsx`
- Semua role (admin, teknisi, QC) sekarang pakai `components/teknisi/AttendanceModal.tsx`
- Owner tidak termasuk absensi

#### Stock Transfer
- Tambah tabel `stock_transfers` di `db/supabase-schema.sql`
- Tambah channel `TELEGRAM_CHANNEL_STOCK_TRANSFER` di `.env` dan `lib/telegram.ts`
- Tambah fitur transfer stock di `components/admin/InventoryManagement.tsx`
- Upload foto bukti transfer ke Telegram channel stock transfer
- Update stok warehouse dan toko secara otomatis

#### Admin Dashboard UI Redesign
- Update `app/globals.css` dengan design tokens fintech dashboard
- Redesign `app/admin/page.tsx` dengan layout baru:
  - Sidebar icons-only dengan rounded corners dan active state kuning
  - Top navbar dengan search, notification, profile avatar
  - Cards dengan border-radius 24px, shadow, dan hover animation
  - Color palette baru: #A8D7FF background, #4DB2FF primary, #FF5F87 secondary, #FFD65A accent
- Update `components/admin/POSection.tsx` sesuai theme baru
- Update komponen admin lain untuk konsistensi warna

### Catatan untuk Revisi Selanjutnya
- Multi-group Telegram perlu update `lib/telegram.ts` agar support mapping dinamis
- Attendance timer & overtime perlu update logic di `components/teknisi/AttendanceModal.tsx`
- Responsive design perlu review semua dashboard
