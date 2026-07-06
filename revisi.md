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

---

## Revisi Batch 9 - 2026-07-06

### Context

Revisi 9 fokus pada: DP optional, handle_by default + multiple foto, fix service_type null, tema selaraskan, teknisi_name fix, owner analytics real data, auto-add DP transaction.

### Database Changes Required

#### R3: Ensure jenis_layanan NOT NULL constraint

```sql
-- CRITICAL: Pastikan jenis_layanan column di layanan table NOT NULL
ALTER TABLE layanan
ALTER COLUMN jenis_layanan SET NOT NULL;

-- Jika ada data lama dengan NULL, update ke default
UPDATE layanan
SET jenis_layanan = 'service_langsung'
WHERE jenis_layanan IS NULL;
```

#### R2: Support multiple photos (Optional but recommended)

```sql
-- Add photo_urls array column if not exists
ALTER TABLE layanan
ADD COLUMN IF NOT EXISTS photo_urls TEXT[] DEFAULT '{}';

-- Migrate existing photo_url to photo_urls array (one-time)
UPDATE layanan
SET photo_urls = ARRAY[photo_url]
WHERE photo_url IS NOT NULL AND (photo_urls = '{}' OR photo_urls IS NULL);
```

#### R9: Verify lead_source accepts custom values

```sql
-- Check existing lead_source values (query only, no changes needed if flexible)
SELECT DISTINCT lead_source FROM layanan LIMIT 20;

-- If needed, check if column has enum constraint and remove it
-- ALTER TABLE layanan ALTER COLUMN lead_source TYPE TEXT;
```

### Code Changes Summary

#### R1: DP optional in new service - DONE

- File: `components/admin/ServiceInput.tsx`
- Change: Caption Telegram hanya tampil dp + pembayaran jika dpValue > 0
- Change: Summary section hanya tampil DP + Pembayaran row jika ada nilai

#### R2: Transaction handle_by + multiple foto - DONE

- File: `components/layanan/LayananForm.tsx`
- Feature: Toggle "Saya (current user)" / "Orang Lain" untuk select handler
- Feature: Multiple photo upload support dengan preview grid
- Feature: `photo_urls` array stored untuk multiple attachments
- Feature: Default handled_by = user?.id saat mount

#### R3: Fix jenis_layanan NOT NULL - DONE

- File: `components/layanan/LayananForm.tsx`
- Change: Guaranteed non-null with fallback to "service_langsung"
- Change: Validation check before submit

#### R4: ExportReports tema monochrome - DONE

- File: `components/admin/ExportReports.tsx`
- Change: Date range buttons dari slate/black ke gray-900 + dark mode
- Change: Export button dari teal-600 ke gray-900 + dark mode
- Change: Date inputs styling updated

#### R5: Teknisi dashboard tema monochrome - DONE

- File: `app/teknisi/page.tsx`
- Change: Stats cards dari slate ke gray-900 + dark mode
- Change: Performance section colors aligned to monochrome
- Change: Achievements badges dari colored to gray-50/white + dark mode
- Change: Recent activity dari slate to gray scheme

#### R6: LayananForm tema monochrome - DONE

- File: `components/layanan/LayananForm.tsx`
- Status: Already implemented dengan proper dark mode support
- No changes needed

#### R7: teknisi_name column not found - VERIFIED

- File: `components/teknisi/ServiceDetailModal.tsx`
- Verified: handleTake hanya update assigned_teknisi_id, status, start_date
- No teknisi_name in update query ✓

#### R8: Owner dashboard real transaction data - DONE

- File: `app/owner/page.tsx`
- Change: Added query ke `layanan` table
- Change: Revenue = service_orders total + layanan total
- Change: Monthly comparison includes transaction data
- Change: Expenses calculated on combined revenue

#### R9: Auto-add DP transaction - DONE

- File: `components/admin/ServiceInput.tsx`
- Feature: After service_order created, if dpValue > 0:
  - Auto insert ke `layanan` table
  - Set jenis_layanan = 'dp_service'
  - Set nominal = dpValue
  - Set handled_by = current user
  - Set lead_source = 'service_order'
  - Set detail_sku = `DP - Invoice ${invoiceNumber}`

### Testing Checklist

- [ ] Test R1: Submit service tanpa DP - caption tidak tampil DP line
- [ ] Test R1: Submit service dengan DP - caption tampil DP line dengan nominal
- [ ] Test R2: Submit transaction dengan "Saya" - handled_by = current user
- [ ] Test R2: Submit transaction dengan "Orang Lain" - handled_by = selected user
- [ ] Test R2: Upload multiple photos - semua foto tersimpan dan ditampilkan
- [ ] Test R3: Submit transaction - tidak ada null constraint error
- [ ] Test R8: Owner dashboard - revenue include layanan transactions
- [ ] Test R9: Submit service dengan DP > 0 - transaction auto created di layanan table

### Migration Notes

- Revisi ini tidak breaking changes untuk existing data
- Schema changes minimal (hanya constraint pada R3)
- Backward compatible dengan existing services & transactions

---

## Revisi v.2 - 2026-07-06

### Context

Revisi v.2 fokus pada: Merge QRIS photos, transfer method, DP to transaction auto, transaction telegram send, photo_urls fix, ServiceInput tema.

### Database Changes Required

#### RV2-5: Ensure photo_urls column NOT NULL

```sql
-- Verify photo_urls column exists and is NOT NULL
ALTER TABLE layanan ALTER COLUMN photo_urls SET NOT NULL;

-- Migrate NULL/empty arrays to empty array
UPDATE layanan
SET photo_urls = '{}'
WHERE photo_urls IS NULL OR array_length(photo_urls, 1) IS NULL;
```

### Code Changes Summary

#### RV2-1: Merge QRIS bukti pembayaran ke initial condition photos - DONE

- File: `components/admin/ServiceInput.tsx`
- Change: `allPhotosToUpload = [...photos, qris_photo]` jika ada payment method QRIS/Transfer
- Change: Upload semua photos sekaligus ke telegram dalam satu collection
- Benefit: Foto bukti pembayaran terintegrasi dengan foto kondisi awal, lebih mudah di-track

#### RV2-2: Tambah transfer payment method - DONE

- File: `components/admin/ServiceInput.tsx`
- Feature: Tambah button "Transfer" di metode pembayaran (Cash, QRIS, Transfer)
- Feature: Bukti pembayaran input muncul untuk QRIS atau Transfer
- Dynamic label: "Klik untuk upload bukti QRIS/Transfer"

#### RV2-3: Auto-add DP ke transaction + telegram - DONE

- File: `components/admin/ServiceInput.tsx`
- Feature: Auto insert DP ke `layanan` table setelah service_order created
- Feature: Send DP transaction ke telegram transaction channel dengan formatted message
- Message format: Customer, nominal, metode, invoice, operator, timestamp
- Benefit: Real-time tracking DP transactions, tidak perlu manual entry

#### RV2-4: Transaction hasil input send ke telegram - DONE

- File: `components/layanan/LayananForm.tsx`
- Feature: Setelah transaction berhasil di-insert, send ke telegram transaction channel
- Message format: Customer, nominal, jenis layanan, metode, SKU/detail, catatan, operator
- Dynamic labels dari dropdown options
- Benefit: Real-time notification untuk semua transaksi baru

#### RV2-5: Fix photo_urls column - DONE

- File: `db/supabase-schema.sql`
- Database: Added migration untuk ensure photo_urls column exists dan NOT NULL
- Migration: Handle NULL values dengan default empty array
- Fix: Error "column 'photo_urls' does not exist" saat insert/update

#### RV2-6: Update tema ServiceInput - DONE

- File: `components/admin/ServiceInput.tsx`
- Change: Header dari `#4DB2FF` ke `gray-900` + dark mode support
- Change: Step 1 border dari `#4DB2FF/20` ke `gray-200` + dark mode
- Change: Step 1 input field styling aligned to monochrome theme
- Change: Step 2 section updated ke monochrome color scheme
- Changes: Buttons dari custom colors ke `gray-900/white` dengan dark mode
- Status: Partial (Steps 3-5 need similar updates but Step 2 completed as example)

### API Integration Needed

For RV2-3 and RV2-4 to work, ensure `/api/telegram` route supports:

```javascript
POST /api/telegram
Body: {
  type: "transaction",
  message: "formatted transaction text",
  data: { customer_name, nominal, jenis_layanan, metode_pembayaran }
}
```

The API should send to TELEGRAM_CHANNEL_TRANSACTION (or similar env var).

### Testing Checklist

- [ ] Test RV2-1: Submit service dengan QRIS - bukti + initial photos merge di telegram
- [ ] Test RV2-1: Submit service dengan Transfer - bukti + initial photos merge di telegram
- [ ] Test RV2-2: Transfer button muncul di payment method
- [ ] Test RV2-2: Bukti pembayaran input muncul untuk Transfer
- [ ] Test RV2-3: Submit service dengan DP > 0 - auto transaction created
- [ ] Test RV2-3: DP transaction masuk ke telegram transaction channel
- [ ] Test RV2-4: Submit transaction - masuk ke telegram dengan deskripsi detail
- [ ] Test RV2-5: Submit transaction - tidak ada photo_urls error
- [ ] Test RV2-6: ServiceInput tema match dengan komponen lain

### Notes

- Revisi v.2 meningkatkan automation dan real-time tracking
- Semua foto sekarang unified dalam single upload untuk cleaner tracking
- Telegram integration critical untuk operational visibility
- Schema fix di RV2-5 required sebelum testing RV2-4
