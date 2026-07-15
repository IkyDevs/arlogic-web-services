# Revisi

## Revisi v.25 - 2026-07-15

### Issue 1: Add New Service Error "No URLs returned from server" — Foto Tidak Terkirim ke Telegram

**Masalah**: Saat add new service, muncul error "No URLs returned from server" di toast. Data service berhasil tersimpan ke Supabase, tapi foto tidak terkirim ke Telegram dan tidak ada URL foto di `service_documentation`.

**Root Cause** (2 masalah):

1. **`lib/telegram.ts` — `uploadMultipleToTelegram()`**: `sendMediaGroup` selalu dicoba meskipun hanya 1 foto. Telegram API mewajibkan minimal 2 item untuk `sendMediaGroup`, sehingga selalu gagal (error 400) untuk single photo. Setelah gagal, fallback `sendSinglePhoto` dipanggil, tapi jika gagal juga (misal `getFile` return null), hasilnya array kosong.

2. **`hooks/useUpload.ts` — `uploadFiles()`**: Jika `data.urls` kosong, throw `new Error('No URLs returned from server')` yang misleading karena sebenarnya upload ke Telegram yang gagal, bukan server yang tidak return URL.

**Fix**:

1. **`lib/telegram.ts`**: 
   - `sendMediaGroup` hanya dicoba jika `chunk.length >= 2` (minimal 2 foto)
   - Jika 1 foto, langsung ke fallback individual (`sendSinglePhoto`)
   - Di path `sendMediaGroup`, jika `getFileUrl` return null untuk suatu foto, fallback per-photo dengan `sendSinglePhoto` (bukan skip seluruh foto)
   - Error handling per-item dengan try/catch agar satu foto gagal tidak menggagalkan seluruh chunk

2. **`hooks/useUpload.ts`**:
   - Ganti throw error menjadi return `[]` dengan toast "Foto gagal dikirim ke Telegram. Service tetap tersimpan tanpa foto."
   - Log error ke console dengan pesan yang lebih deskriptif

### Issue 2: Tipe Jam "MECHANICAL" → "DIGITAL"

**Masalah**: Opsi tipe jam "MECHANICAL" sudah tidak relevan, diganti "DIGITAL".

**Fix** — semua referensi `"mechanical"` diubah ke `"digital"`:
- `types/index.ts`: WatchMovement type
- `components/admin/ServiceInput.tsx`: watchMovements array
- `components/admin/ServiceList.tsx`: movementLabels, moveOptions, movementIcons
- `components/owner/WatchDatabase.tsx`: MOVEMENTS array, color switch, label switch
- `app/tracking/[[...slug]]/page.tsx`: getMovementIcon switch

### Issue 3: Tambah Metode Pembayaran EDC Mandiri & EDC BCA di DP

**Masalah**: DP hanya support Cash, QRIS, Transfer. Tidak ada EDC Mandiri dan EDC BCA.

**Fix** (semua di `components/admin/ServiceInput.tsx`):
1. Tambah `paymentLabels` map lokal untuk label payment method yang konsisten
2. Tambah 2 tombol "EDC Mandiri" dan "EDC BCA" di section metode pembayaran
3. Update kondisi foto bukti: sekarang muncul juga untuk `edc_mandiri` dan `edc_bca`
4. Update caption "Klik untuk upload bukti ..." pakai `paymentLabels`
5. Update caption Telegram pakai `paymentLabels[formData.payment_method]`
6. Update summary "Pembayaran" pakai `paymentLabels`

### Issue 4: Down Payment Tidak Muncul di Detail Service

**Masalah**: DP tersimpan di database (`service_orders.down_payment`) tapi tidak ditampilkan di modal detail service.

**Fix** — Tambah display `down_payment` di:
1. **`components/admin/ServiceList.tsx`**: Card "Down Payment" hijau di grid Status & Info
2. **`components/teknisi/ServiceDetailModal.tsx`**: Gradient card hijau setelah Estimasi Biaya
3. **`components/owner/FeedbackList.tsx`**: Card "Down Payment" di grid informasi

### Issue 5: Multi Jenis Layanan — Kirim Telegram Terpisah + List Per-Item

**Masalah**: Transaksi dengan multiple jenis layanan (extra items) caption Telegram digabung jadi 1 pesan dengan format "MULTIPLE LAYANAN". Di list transaksi, extra items tidak dihitung di stats dan tidak muncul di filter.

**Fix**:

1. **`components/layanan/LayananForm.tsx`** — Ganti format caption Telegram:
   - Hapus semua logika `isMulti` yang menggabung caption
   - Tambah `buildItemCaption()` helper yang format 1 pesan per item
   - Item utama (index 0): upload foto + caption seperti biasa
   - Extra items (index 1..N): kirim text-only via `/api/telegram` dengan caption masing-masing
   - Setiap item jadi pesan terpisah di Telegram

2. **`components/layanan/TransactionManagement.tsx`** — Expand per-item rows:
   - `fetchAll()`: SELECT `*, layanan_items(*)` dan expand jadi per-item rows
   - Extra items override `jenis_layanan`, `nominal`, `detail_sku`, `notes` dari `layanan_items`
   - Stats, filter modal otomatis hitung per-item (bukan per-transaksi induk)

**Format caption per item**:
```
📊 TRANSAKSI

🔧 tipe : Ambil Jam Service
📱 Customer: CS Suci Wulandari 5356
📞 WA: 82132815356
💰 Nominal: Rp 100.000
💳 Metode: Cash
📋 Invoice: 626 vinnic 626 murata
👤 Operator: iky
⏰ Rabu, 15 Juli 2026, 12.45.13
```

### Files Changed
- `lib/telegram.ts` — skip sendMediaGroup jika < 2 foto, fallback per-photo jika getFileUrl gagal
- `hooks/useUpload.ts` — better error handling untuk empty URLs
- `components/admin/ServiceInput.tsx` — MECHANICAL→DIGITAL, EDC methods, payment labels
- `components/admin/ServiceList.tsx` — DIGITAL movement, Down Payment display
- `components/teknisi/ServiceDetailModal.tsx` — Down Payment display
- `components/owner/FeedbackList.tsx` — Down Payment display
- `components/layanan/LayananForm.tsx` — caption per-item, kirim N pesan terpisah
- `components/layanan/TransactionManagement.tsx` — expand layanan_items per-item rows
- `types/index.ts` — WatchMovement: mechanical → digital
- `components/admin/ServiceInput.tsx` — MECHANICAL→DIGITAL
- `components/owner/WatchDatabase.tsx` — MECHANICAL→DIGITAL
- `app/tracking/[[...slug]]/page.tsx` — MECHANICAL→DIGITAL

### Issue 6: Upload Foto HEIC Gagal Total (Tidak Bisa Preview + Error Upload)

**Masalah**: Foto format HEIC dari iPhone tidak bisa di-preview dan gagal upload dengan error "failed to fetch".

**Root Cause**:
1. **Browser tidak support HEIC**: `Image()` API dan `URL.createObjectURL()` gagal decode HEIC → preview broken, kompresi return file original
2. **Server sharp mungkin tanpa HEIC support**: Raw HEIC dikirim ke Telegram → ditolak
3. **"failed to fetch"** karena request body HEIC besar + server crash saat proses format tidak dikenal

**Fix**:
1. **`hooks/useUpload.ts`**:
   - Install & import `heic2any` (WASM-based HEIC→JPEG converter)
   - Tambah `isHeic()` helper (detect by extension `.heic`/MIME `image/heic`/`image/heif`)
   - Tambah `convertHeicToJpeg()`: panggil `heic2any()` → output Blob JPEG
   - Flow baru: HEIC → `heic2any` → JPEG Blob → canvas kompresi → server sharp → Telegram
2. **`components/admin/ServiceInput.tsx`**:
   - Import `heic2any`
   - `handleAddPhoto()`: deteksi HEIC, convert ke JPEG dulu sebelum `URL.createObjectURL()` untuk preview
   - Preview foto HEIC sekarang muncul normal
3. **`components/layanan/LayananForm.tsx`**:
   - Import `heic2any`
   - `handlePhotoSelect()`: deteksi HEIC, convert ke JPEG sebelum preview & upload
4. **Dependency baru**: `heic2any@0.0.4` — WASM HEIC→JPEG converter di client

### Issue 7: Upload Foto Lambat (Pra Service & Transaksi)

**Masalah**: Proses upload foto lama karena HEIC conversion + canvas compression.

**Root Cause**:
1. HEIC conversion (`heic2any`) dan kompresi canvas jalan **parallel** (`Promise.all`) → overload memory HP
2. **Progress bar tidak update** selama fase kompresi — user tidak tahu status
3. File HEIC besar diproses barengan

**Fix**:
1. **Sequential processing**: Proses foto 1 per 1 (bukan parallel) — lebih stabil di mobile
2. **Progress selama kompresi**: `setProgress()` update per foto (0-40% untuk kompresi, 40-90% untuk upload)
3. **Skip kompresi untuk JPEG kecil** (< 200KB) — langsung kirim tanpa proses canvas
4. Interval upload lebih lambat (setiap 300ms +3%) biar progress bar tidak keburu habis

### Issue 8: Tombol Clear Draft di Popup Transaksi & Service

**Masalah**: Tidak ada cara menghapus draft tersimpan di localStorage.

**Fix**:
1. **`components/admin/ServiceInput.tsx`**: Tombol `Trash2` merah di header (page) dan link "Hapus Draft" (modal)
2. **`components/layanan/LayananForm.tsx`**: Tombol `Trash2` merah di header, sebelah tombol close
3. Tombol hanya muncul jika ada draft (`hasDraft(...)`)
4. Klik → `clearDraft()` → reset form → toast "Draft berhasil dihapus"

### Issue 9: DP Tetap Masuk Transaksi Walau Upload Foto Gagal

**Masalah**: Saat add new service, jika upload foto gagal, DP transaction (`jenis_layanan = 'dp_service'`) tetap masuk ke tabel `layanan` karena DP insert dijalankan terlepas dari hasil upload.

**Fix**: Tambah throw error jika upload foto gagal:
```typescript
if (urls.length === 0 && allPhotosToUpload.length > 0) {
  throw new Error("Upload foto gagal, transaksi DP dibatalkan");
}
```
Error di-catch oleh blok `catch` utama → toast ke user. Service order tetap tersimpan (tanpa foto), DP tidak masuk ke `layanan`.

### Issue 10: Popup Service Masih Tampilkan QR Token Lama Setelah Submit Sukses

**Masalah**: Setelah berhasil create service dan modal ditutup, saat membuka form Service lagi, popup success (QR + token) dari submit sebelumnya langsung muncul.

**Root Cause**: State `success`, `step`, `lastInvoice` tidak di-reset saat component mount. React kadang mempertahankan state render sebelumnya ketika modal dibuka-tutup cepat.

**Fix**: Tambah `useEffect` di mount yang reset state:
```typescript
useEffect(() => {
  setSuccess(false);
  setStep(1);
  setLastInvoice(null);
  setLoading(false);
}, []);
```
Effect ini berjalan sekali saat component mount, memastikan form selalu mulai dari step 1.

### Issue 7: Upload Foto Kadang Gagal — Efek Kompresi

**Masalah**: Upload foto ke Telegram kadang berhasil, kadang tidak. Foto dari HP (HEIC/WebP) sering gagal.

**Root Cause** (3 masalah di `hooks/useUpload.ts`):
1. **Hanya kompres >200KB**: File kecil (<200KB) tidak dikompres, format asli (HEIC/WebP) tetap dikirim → Telegram tolak karena hanya support JPEG/PNG/GIF untuk `sendPhoto`
2. **Canvas gagal decode HEIC**: `img.onerror` → return original HEIC yang dibungkus `{ type: 'image/jpeg' }` → data palsu
3. **Tidak ada white fill**: PNG transparan di-convert ke JPEG tanpa background → artefak hitam

**Fix**:
1. **Selalu kompres** untuk file non-JPEG — hapus threshold 200KB, tambah `file.type !== 'image/jpeg'`
2. **White background fill** (`ctx.fillStyle = '#FFFFFF'; ctx.fillRect(...)`) sebelum drawImage
3. **Ubah ekstensi file** `.heic`/`.png` → `.jpg` saat buat new File
4. **Max dimension** dinaikkan 1280 → 1600px agar hasil lebih tajam
5. **URL.revokeObjectURL** pake variable `objectUrl` yang konsisten (fix potensi memory leak)

### Issue 7: Pendapatan Hari Ini di Dashboard Admin Selalu Rp0

**Masalah**: Kartu "Pendapatan Hari Ini" di dashboard admin selalu menampilkan Rp0.

**Root Cause** (2 masalah):
1. **Props tidak dikirim**: `AdminDashboardAnalytics` dipanggil tanpa `todayRevenue`, `todayExpenses`, `revenue`, `totalExpenses` → default `0`
2. **Query tidak include `layanan_items`**: Query hanya jumlah `layanan.nominal`, mengabaikan nominal extra items di `layanan_items`

**Fix**:
1. **`app/admin/page.tsx` — `fetchTodayStats()`**: Query `layanan` dengan `layanan_items(nominal)` JOIN, tambah `sumNominal()` helper yang jumlah `layanan.nominal` + `layanan_items[].nominal`
2. **`app/admin/page.tsx` — `fetchStats()`**: Sama, query todayRevenue dan todayExpenses include `layanan_items(nominal)`
3. **`app/admin/page.tsx` — `AdminDashboardAnalytics` props**: Kirim `todayRevenue={todayStats.revenue}`, `todayExpenses={todayStats.expenses}`, `revenue={stats.revenue}`, `totalExpenses={stats.totalExpenses}`

### Database Migration
Jalankan SQL berikut di Supabase SQL Editor:
```sql
GRANT ALL ON TABLE layanan_items TO authenticated;
GRANT ALL ON TABLE layanan_items TO service_role;
NOTIFY pgrst, 'reload schema';
```

---

## Revisi Akhir v.24 - 2026-07-14

### Issue 1: Fitur Cashdraw (Semua Dashboard Kecuali Owner)

**Deskripsi**: Staff ingin tuker saldo digital ke cash. Staff scan QR/tf ke toko, upload bukti, sistem catat. Admin bisa approve. QRIS/TF bertambah, Cash berkurang.

**Implementasi**:
1. `types/index.ts`: Tambah `"cashdraw"` ke `JenisLayanan`
2. **Form baru** `CashdrawForm.tsx`: Staff name, nominal, metode (qris/tf), upload foto bukti
3. **Submit**: Buat 2 entri di `layanan`:
   - Entry A: `cashdraw` + qris/tf → QRIS/TF total naik
   - Entry B: `pengeluaran` + cash → Cash total turun
4. **Telegram**: Kirim ke grup buku kas
5. **Tombol Cashdraw**: Di TransactionManagement (admin, supervisor, teknisi)
6. **List transaksi**: Filter "Cashdraw" tampilkan entri cashdraw
7. **Detail transaksi**: Staff name, nominal, metode, foto bukti

### Issue 2: Default Filter Customer Bertransaksi

**Deskripsi**: List customer default hanya tampilkan yang pernah transaksi/service. Filter minggu/bulan = transaksi dalam periode tersebut.

**Implementasi**: `CustomerList.tsx` — filter default `hasTransactions`, query `layanan` + `service_orders`.

### Issue 3: Multi Jenis Layanan dalam 1 Transaksi

**Deskripsi**: 1 transaksi bisa punya beberapa jenis layanan (beli jam + service jam). Masing-masing punya SKU/catatan.

**Implementasi**:
1. **Tabel baru** `layanan_items`
2. **Form**: LayananForm support multiple items (Add Item)
3. **Submit**: 1 `layanan` + N `layanan_items`
4. **List**: Output N baris per transaksi
5. **Stats**: Semua diselaraskan

### Database Changes
- Tabel baru: `layanan_items`
- `layanan_items` FK ke `layanan(id)` ON DELETE CASCADE

---

## Revisi v.24 - 2026-07-14

### Issue 1: Selaraskan Semua Komponen Management Transaksi dengan Fitur Pengeluaran

**Masalah**: Fitur pengeluaran (`jenis_layanan = "pengeluaran"`) sudah ada di `PengeluaranForm.tsx` dan disimpan ke tabel `layanan`, tetapi banyak komponen transaksi yang belum selaras:

1. **TypeScript types** (`types/index.ts`): `JenisLayanan` type tidak menyertakan `"pengeluaran"`, dan `jenisLayananLabels` tidak punya entry untuk `"pengeluaran"`. Semua kode selama ini pakai `as string` cast untuk akses `"pengeluaran"`.

2. **LayananList.tsx filter options**: Dropdown filter "Service Type" tidak punya opsi "Pengeluaran", sehingga expense tidak bisa difilter.

3. **TransactionManagement.tsx analytics**: Stat card, chart, dan filter modal belum membedakan expense secara visual (warna merah/miring).

4. **AdminDashboardAnalytics.tsx**: "Transaksi Terbaru" di dashboard utama tidak menampilkan badge/indikator bahwa suatu transaksi adalah pengeluaran.

5. **app/admin/page.tsx**: Modal "Detail Transaksi" tidak menampilkan layout khusus untuk pengeluaran (nama barang bukan customer, warna merah, dll).

6. **AdminDashboardAnalytics.tsx**: Revenue/pendapatan chart tidak memisahkan pemasukan dan pengeluaran secara jelas.

### Fix Detail

1. **`types/index.ts`**:
   - Tambah `"pengeluaran"` ke union type `JenisLayanan`
   - Tambah `"pengeluaran": "Pengeluaran"` ke `jenisLayananLabels`

2. **`components/layanan/LayananList.tsx`**:
   - Tambah `{ value: "pengeluaran", label: "Pengeluaran" }` ke `jenisLayananOptions` (filter dropdown)

3. **`components/layanan/TransactionManagement.tsx`**:
   - FilterModal: item dengan `jenis_layanan === "pengeluaran"` tampil dengan latar merah/red border
   - Stat card "Total Transaksi" dipisah: "Pemasukan" (hijau) dan "Pengeluaran" (merah)
   - Method Pembayaran chart: expense transactions dihitung terpisah

4. **`components/admin/AdminDashboardAnalytics.tsx`**:
   - "Transaksi Terbaru": item `pengeluaran` tampil dengan border/icon merah
   - Revenue breakdown memisahkan pemasukan vs pengeluaran

5. **`app/admin/page.tsx`**:
   - Modal "Detail Transaksi": jika `jenis_layanan === "pengeluaran"`, tampilkan layout berbeda:
     - Header merah (bukan abu-abu)
     - "Nama Barang" sebagai title utama (bukan "Customer")
     - Nominal merah (bukan hijau)
     - Label "Pengeluaran" dengan icon Receipt

6. **`ClosingDashboard.tsx`**:
   - Sudah handle expense dengan benar (subtract dari expected) — tidak perlu perubahan

### Issue 2: Scrollable Daftar Transaksi di Dashboard

**Masalah**: List transaksi di dashboard utama (`AdminDashboardAnalytics.tsx`) dan di panel kanan `TransactionManagement.tsx` memakan banyak ruang vertikal, menyebabkan UI perlu scroll ke bawah untuk melihat konten lain.

**Fix**:
1. **`components/admin/AdminDashboardAnalytics.tsx`**:
   - `max-h-[420px]` → `max-h-[580px]` agar muat lebih banyak transaksi
   - Pastikan `overflow-y-auto` bekerja dengan baik

2. **`components/layanan/TransactionManagement.tsx`**:
   - "Daftar Transaksi" panel kanan: `min-h-[600px] lg:max-h-[1120px]` → `lg:max-h-[800px]`
   - Pastikan scroll internal tidak mempengaruhi scroll halaman

### Files Changed
- `types/index.ts` (type + labels)
- `components/layanan/LayananList.tsx` (filter options)
- `components/layanan/TransactionManagement.tsx` (stats, filter modal)
- `components/admin/AdminDashboardAnalytics.tsx` (transaksi list + expense display)
- `app/admin/page.tsx` (detail modal expense layout)

### No Database Changes

---

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

---

## Revisi v.20 - 2026-07-10

### Issue 1: QR URL localhost di ServiceList Modal

**Masalah**: QR code di popup detail service (ServiceList.tsx) masih pakai `window.location.origin` → jadi `http://localhost:3000/...` untuk customer.

**Fix**: `components/admin/ServiceList.tsx` — ganti ke `process.env.NEXT_PUBLIC_APP_URL || window.location.origin`, dan format URL samakan dengan QRCodeGenerator (`/tracking/{invoice}?token={token}`).

### Issue 2: Detail Aktivitas Teknisi Lebih Lengkap

**Masalah**: Popup detail aktivitas teknisi hanya munculin perubahan teks, tidak ada foto jam, item sebelum/sesudah.

**Fix**:
- `components/qc/QCReviewModal.tsx`: Activity_logs sekarang menyimpan `items_before` (array item original), `items_after` (array item baru), dan `photo_urls` (array foto dari service_documentation)
- `app/teknisi/page.tsx`: Modal detail aktivitas sekarang nampilin:
  - Foto jam (grid 3 kolom, bisa klik buka tab baru)
  - Item Sebelum Revisi (background gray)
  - Item Setelah Revisi (background green)
  - Perubahan oleh QC (background amber)

### Issue 3: Edit Caption Telegram Debug

**Masalah**: Edit caption Telegram saat QC revisi item masih belum bekerja.

**Fix**: Tambah error handling & toast notification:
- `components/qc/QCReviewModal.tsx`: Sekarang ngecek response dari `/api/telegram/edit-caption`, kalo error tampilin toast ke user
- Pastiin error message muncul di UI, bukan cuma di console.log

**Root Cause**: Route `edit-caption` mencari dokumentasi PERTAMA (`created_at ASC`), yaitu foto `initial_condition`. Tapi caption yang harus diedit ada di foto TERAKHIR (stage `qc` yang diupload teknisi). Jadi edit caption sukses secara teknis, tapi mengenai message yang salah.

**Fix**: `app/api/telegram/edit-caption/route.ts`:
- Ubah `order(created_at, ASC)` → `order(created_at, DESC)` — cari TERBARU dulu
- Ambil 5 docs teratas (bukan 1), loop coba edit semua sampai ada yang berhasil
- Tambah logging detail (doc id, stage, chat_id, msg_id, preview caption) untuk debugging

### Files Changed
- `components/admin/ServiceList.tsx`
- `components/qc/QCReviewModal.tsx`
- `app/teknisi/page.tsx`
- `app/api/telegram/edit-caption/route.ts`

### No Database Changes

---

## Revisi v.21 - 2026-07-10

### Issue 1: Payment Method "transfer" Tidak Muncul

**Masalah**: DP transaction dengan payment method "transfer" atau "qris" muncul kosong di list transaction admin. Penyebab: tipe `MetodePembayaran` dan semua label maps tidak menyertakan `"transfer"`.

**Fix**:
- `types/index.ts`: Tambah `"transfer"` ke `MetodePembayaran` type dan `metodePembayaranLabels`
- `components/layanan/LayananList.tsx`: Tambah `"transfer"` ke filter options, tambah fallback `|| item.metode_pembayaran` di display & CSV export
- `components/layanan/TransactionManagement.tsx`: Tambah `"transfer"` ke `paymentColors` & `paymentLabels`
- `components/admin/AdminDashboardAnalytics.tsx`: Tambah `"transfer"` ke `paymentLabels`, `paymentIcons`, `getPaymentColor`

### Issue 2: Status Caption di Telegram (QC Flow)

**Masalah**: Caption Telegram tidak menampilkan status QC.

**Fix**:
- `components/teknisi/QueueList.tsx`: Tambah `status : menunggu qc` di caption saat teknisi submit ke QC
- `components/qc/QCReviewModal.tsx`: Ganti status jadi `status : QC approve` saat QC approve dengan perubahan

### Issue 3: Simplify Caption New Service

**Masalah**: Caption awal service masih menyertakan placeholder `Teknisi : —`, `Start : —`, `Done : —`, `Pengerjaan :`, `Barang :`, `Jasa :`, `Total : —`, `Keterangan : —` yang tidak relevan untuk input awal.

**Fix**: `components/admin/ServiceInput.tsx`:
- Hapus semua baris placeholder di atas
- Tambah `estimasi : Rp ...` setelah DP (jika ada estimasi biaya)
- Hanya sisakan: Kategori, CS, WA, Seri, Tipe, Kendala, Request, Keterangan, dp, estimasi, Pembayaran, In

### Files Changed
- `types/index.ts`
- `components/layanan/LayananList.tsx`
- `components/layanan/TransactionManagement.tsx`
- `components/admin/AdminDashboardAnalytics.tsx`
- `components/teknisi/QueueList.tsx`
- `components/qc/QCReviewModal.tsx`
- `components/admin/ServiceInput.tsx`

### No Database Changes

---

## Revisi v.22 - 2026-07-10

### Fitur: Kirim Tracking ke WhatsApp dari Detail Service

**Deskripsi**: Di modal detail service (popup klik list service), tambah button "Kirim ke WhatsApp" yang otomatis buka WhatsApp dengan pesan berisi link tracking, invoice, dan token.

**File**: `components/admin/ServiceList.tsx`
- Button hijau di bawah QR + Token section
- Format pesan: Halo {nama}, invoice, link tracking, token
- Format nomor: otomatis convert 0xxx → 62xxx

### No Database Changes

---

## Revisi v.21 - 2026-07-10

### Issue 1: Restriksi Revisi Item oleh QC

**Perubahan**:
- Hapus tombol delete (Trash2) dari semua item — QC tidak boleh menghapus item
- QC bisa menambah JASA baru via "Tambah Jasa Custom" (+)
- QC bisa edit harga untuk semua item (JASA dan Sparepart)
- Sparepart: hanya edit harga, tidak bisa ditambah/dihapus

**File**: `components/qc/QCReviewModal.tsx`

### Issue 2: Laporan Absensi di QC/Supervisor Dashboard

**Fitur baru**: Tab "Absensi" di dashboard QC yang menampilkan rekap absensi semua staff.

**File baru**: `components/qc/AttendanceReport.tsx`
- Filter harian/mingguan/bulanan
- Pencarian staff
- Kolom: Tanggal, Staff, Check In, Check Out, Durasi, Status (Active/Lembur/Selesai)
- Sorting berdasarkan tanggal atau staff

**File diubah**: `app/qc/page.tsx`
- Tambah menu "Absensi" di sidebar
- Render AttendanceReport saat tab absensi aktif
- Import Calendar icon

### Files Changed
- `components/qc/QCReviewModal.tsx`
- `components/qc/AttendanceReport.tsx` (NEW)
- `app/qc/page.tsx`

### No Database Changes

---

## Revisi v.22 - 2026-07-10

### Fitur: Closing via Telegram + Edit Saat Approve

**Deskripsi**: Kirim notifikasi closing ke Telegram saat admin submit, dan edit otomatis saat owner approve (update status dari "waiting approve owner" → "Approve").

**Perubahan**:

1. **`app/api/admin/closing/route.ts`**:
   - `create`: setelah insert closing, kirim pesan ke Telegram channel closing, simpan `chat_id` + `message_id` ke database
   - `approve`: setelah update status, edit pesan Telegram yang sudah dikirim (ubah status + tambah notes owner)
   - Fallback: kirim pesan baru jika tidak punya referensi message_id

2. **`components/admin/ClosingApproval.tsx`**: Hapus kode kirim Telegram client-side (sekarang dihandle oleh API route)

3. **Database migration**:
   ```sql
   ALTER TABLE closings ADD COLUMN IF NOT EXISTS telegram_chat_id TEXT DEFAULT '';
   ALTER TABLE closings ADD COLUMN IF NOT EXISTS telegram_message_id BIGINT DEFAULT 0;
   ```

**Format pesan Telegram**:
```
CLOSING
tanggal : Jumat, 10 Juli, 2026
total keseluruhan : Rp ...
total payment:
 > cash: Rp ...
 > qris: Rp ...
status : DONE / SELISIH
owner : waiting approve owner / Approve
notes: ...
```

### Files Changed
- `app/api/admin/closing/route.ts`
- `components/admin/ClosingApproval.tsx`
- `db/supabase-schema.sql`

### Database Migration
Jalankan SQL berikut di Supabase SQL Editor:
```sql
ALTER TABLE closings ADD COLUMN IF NOT EXISTS telegram_chat_id TEXT DEFAULT '';
ALTER TABLE closings ADD COLUMN IF NOT EXISTS telegram_message_id BIGINT DEFAULT 0;
NOTIFY pgrst, 'reload schema';
```

---

## Revisi v.23 - 2026-07-10

### 1. Dark Mode Stat Card Gradients
**File**: `app/globals.css`
- Tambah CSS override untuk gradient backgrounds di TransactionManagement stat cards (`from-blue-50.to-blue-100/60`, `from-amber-50.to-amber-100/60`, `from-green-50.to-green-100/60`, `from-purple-50.to-purple-100/60`)
- Tambah override untuk `bg-white/50` → `rgba(0,0,0,0.3)` di dark mode

### 2. "Check In" → "Absen"
**Files**: `app/admin/page.tsx`, `app/teknisi/page.tsx`, `components/qc/QCSidebar.tsx`
- Ubah teks button "Check In" jadi "Absen"
- Ubah "Check Out" jadi "Absen Pulang"

### 3. Sidebar Layout Justify Evenly
**Files**: `app/admin/page.tsx`, `app/teknisi/page.tsx`, `components/qc/QCSidebar.tsx`, `app/owner/page.tsx`
- Semua sidebar nav sekarang pake `flex-1 flex flex-col justify-center` agar menu items terpusat vertikal
- Struktur: logo di atas, nav di tengah, attendance/theme/logout di bawah

### Files Changed
- `app/globals.css`
- `app/admin/page.tsx`
- `app/teknisi/page.tsx`
- `components/qc/QCSidebar.tsx`
- `app/owner/page.tsx`

---

## Revisi v.24 - 2026-07-10

### Fitur Baru: Data Customer di Semua Dashboard

**Deskripsi**: Tab "Customer" di semua dashboard (admin, teknisi, QC, owner) yang menampilkan daftar customer dari transaksi dan service orders, lengkap dengan search dan total transaksi.

**Komponen**: `components/admin/CustomerList.tsx` (NEW)
- Aggregate data dari tabel `layanan` (customer_name, customer_whatsapp) dan `service_orders` (customer_name, customer_phone)
- Deduplikasi berdasarkan nomor telepon
- Search by nama atau nomor WhatsApp
- Tabel: Nama, WhatsApp (klik link langsung WA), jumlah transaksi, jumlah service jam, total
- Dark mode support
- Refresh button

**Integrasi**:
- `app/admin/page.tsx` — menu item sebelum "management-transaction"
- `app/teknisi/page.tsx` — menu item sebelum "layanan"
- `app/qc/page.tsx` — menu item di sidebar
- `app/owner/page.tsx` — menu item di sidebar

### Files Changed
- `components/admin/CustomerList.tsx` (NEW)
- `app/admin/page.tsx`
- `app/teknisi/page.tsx`
- `app/qc/page.tsx`
- `app/owner/page.tsx`

### No Database Changes

---

## Revisi v.25 - 2026-07-10

### Fitur: Customer Autocomplete pada Input Transaksi & Service Baru

**Deskripsi**: Saat mengetik nama customer di form transaksi baru (`LayananForm`) atau service baru (`ServiceInput`), muncul dropdown suggestions dari database customer yang sudah ada. Setiap suggestion menampilkan nama + 4 digit terakhir nomor WhatsApp (kode unik customer). Pilih salah satu → nama dan nomor WhatsApp terisi otomatis.

**Komponen**: `components/admin/CustomerAutocomplete.tsx` (NEW)
- Search customer dari tabel `layanan` dan `service_orders` via `ilike`
- Debounce 200ms saat mengetik
- Dropdown dengan avatar, nama, nomor WA, dan kode 4 digit
- Navigasi keyboard (arrow up/down, enter, escape)
- Click outside untuk close dropdown

**Integrasi**:
- `components/layanan/LayananForm.tsx` — nama customer input diganti dengan CustomerAutocomplete (onSelect isi nama + whatsapp)
- `components/admin/ServiceInput.tsx` — Full Name input diganti dengan CustomerAutocomplete (onSelect isi cs_name + cs_phone)

### Files Changed
- `components/admin/CustomerAutocomplete.tsx` (NEW)
- `components/layanan/LayananForm.tsx`
- `components/admin/ServiceInput.tsx`

---

## Revisi v.26 - 2026-07-10

### Fitur: Customer Database via Telegram

**Deskripsi**: Setiap customer baru (nomor WA baru) yang masuk via transaksi atau service order otomatis dikirim ke Telegram channel "CUSTOMER DATABASE" dengan format:
```
CUSTOMER BARU 
nama cs: Iky
no. wa: 628123456789
```

**Perubahan**:

1. **Channel baru**: `TELEGRAM_CHANNEL_CUSTOMER` di `lib/telegram.ts` + `/api/telegram/route.ts`
2. **API route**: `/api/telegram/customer-new/route.ts` (NEW)
   - Menerima `{ name, phone }`
   - Cek apakah nomor sudah ada di tabel `layanan` atau `service_orders` (via service_role)
   - Jika baru (existingCount === 0), kirim ke Telegram
   - Jika sudah ada, return `{ status: "existing" }` tanpa notifikasi
3. **LayananForm.tsx**: Setelah submit sukses, panggil `/api/telegram/customer-new` dengan nama & WA customer
4. **ServiceInput.tsx**: Setelah submit sukses, panggil `/api/telegram/customer-new` dengan nama & WA customer

**Environment variable baru**: `TELEGRAM_CHANNEL_CUSTOMER` — isi dengan chat_id grup "CUSTOMER DATABASE"

### Files Changed
- `lib/telegram.ts`
- `app/api/telegram/route.ts`
- `app/api/telegram/customer-new/route.ts` (NEW)
- `components/layanan/LayananForm.tsx`
- `components/admin/ServiceInput.tsx`

---

## Revisi v.27 - 2026-07-10

### Fitur: Tabel Customers + Auto Code Nama

**Deskripsi**: 
- Tabel `customers` baru di database untuk menyimpan data customer terpusat
- Setiap customer baru otomatis mendapat kode 4 digit akhir nomor WA di namanya
- Contoh: input "iky" + WA "0817236427347234" → tersimpan sebagai "iky 7234"

**Perubahan**:

1. **Database**: `db/supabase-schema.sql`
   - Tabel `customers` baru: id, name, phone, last_transaction, created_at
   - Indexes + RLS policies

2. **API Route**: `app/api/telegram/customer-new/route.ts`
   - Cek `customers` table (bukan layanan/service_orders)
   - Jika baru: format nama + 4 digit, INSERT ke customers, kirim Telegram
   - Jika sudah ada: UPDATE last_transaction, return existing name

3. **CustomerAutocomplete**: Query dari `customers` table
4. **CustomerList**: Query dari `customers` table + hitung transaksi dari layanan/service_orders

### Environment
- `TELEGRAM_CHANNEL_CUSTOMER` — chat_id grup Telegram untuk data customer

### Database Migration
```sql
CREATE TABLE IF NOT EXISTS customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  last_transaction TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read customers" ON customers FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can insert customers" ON customers FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can update customers" ON customers FOR UPDATE USING (auth.uid() IS NOT NULL);
```

### Files Changed
- `db/supabase-schema.sql`
- `app/api/telegram/customer-new/route.ts`
- `components/admin/CustomerAutocomplete.tsx`
- `components/admin/CustomerList.tsx`

### Database Changes: YES — `customers` table baru
- Attendance timer & overtime perlu update logic di `components/teknisi/AttendanceModal.tsx`
- Responsive design perlu review semua dashboard

---

## Revisi DP Return, QC Overflow, Edit Caption Telegram - 2026-07-10

### Issue 1: DP Return Logic

**Masalah**: Ketika DP 100k dan total biaya 50k, caption menampilkan `kekurangan: Rp -50.000` (negatif).

**Fix**: `components/teknisi/QueueList.tsx` — logic diubah:
- Jika `total > DP`: tampilkan `kekurangan: Rp X`
- Jika `total < DP`: tampilkan `return: Rp X`
- Jika `total === DP`: hide kedua baris

### Issue 2: QC Tambah Jasa Custom Overflow

**Masalah**: Di QCReviewModal, form "Tambah Jasa Custom" overflow keluar dari box utama pada layar sempit.

**Fix**: `components/qc/QCReviewModal.tsx` — tambah `flex-wrap` dan `min-w-[140px]` pada input nama agar elemen wrapping ke baris baru saat tidak muat.

### Issue 3: Edit Telegram Caption saat QC Revisi

**Masalah**: Ketika QC merevisi harga item/jasa, caption Telegram yang sudah terkirim tidak berubah.

**Fix — Full pipeline edit caption:**

1. **Database**: Tambah kolom `telegram_chat_id TEXT` dan `telegram_message_id BIGINT` di `service_documentation` (`db/supabase-schema.sql`)
2. **Telegram lib** (`lib/telegram.ts`):
   - `sendPhotoBlob` return `{ url, chat_id, message_id }` (sebelumnya hanya string)
   - `uploadMultipleToTelegram` return array of `{ url, chat_id, message_id }`
   - Tambah fungsi `editMessageCaption(chatId, messageId, caption)` → call Telegram API
3. **Upload API** (`app/api/upload/route.ts`): Return `messages[]` dengan chat_id + message_id
4. **Upload Hook** (`hooks/useUpload.ts`): Return `UploadFileResult[]` (url + chat_id + message_id)
5. **Penyimpanan**: ServiceInput, ProgressUpdate, QueueList simpan chat_id + message_id saat insert `service_documentation`
6. **Edit API** (`app/api/telegram/edit-caption/route.ts`): Endpoint baru untuk edit caption berdasarkan service_order_id
7. **Integrasi QC** (`components/qc/QCReviewModal.tsx`): Saat approve dengan perubahan item, call edit caption API dengan caption baru yang berisi `revisi : ...`

### Files Changed
- `components/teknisi/QueueList.tsx`
- `components/qc/QCReviewModal.tsx`
- `components/admin/ServiceInput.tsx`
- `components/teknisi/ProgressUpdate.tsx`
- `lib/telegram.ts`
- `hooks/useUpload.ts`
- `app/api/upload/route.ts`
- `app/api/telegram/edit-caption/route.ts` (NEW)
- `db/supabase-schema.sql`

---

## Revisi Foto Service Detail Modal - 2026-07-10

### Context

Di admin dashboard, tab Service, popup detail service tidak menampilkan foto. Foto service disimpan di tabel `service_documentation` (terpisah dari `service_orders`), tetapi `ServiceList.tsx` hanya query `service_orders` tanpa mengambil `service_documentation`.

### Code Changes

- **File**: `components/admin/ServiceList.tsx`
- **Change**: Tambah state `servicePhotos` dan `loadingPhotos`
- **Change**: Fungsi `openDetail` sekarang fetch foto dari `service_documentation` berdasarkan `service_order_id`
- **Change**: Modal detail menampilkan grid foto (3 kolom) setelah bagian Device Info
- **Change**: Foto bisa diklik untuk dibuka di tab baru
- **Change**: State `servicePhotos` di-reset saat modal ditutup

### No Database Changes

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

---

## Revisi v.22 - 2026-07-11

### Issue 1: Customer Data Tidak Masuk Database
- Tambah client-side insert ke tabel `customers` setelah submit service/transaksi (tidak hanya API route)
- Tambah `GRANT ALL ON TABLE customers` ke schema (error permission denied)
- Error handling dengan toast jika gagal

### Issue 2: Universal Tracking URL
- Route diubah dari `/tracking/[id]` → `/tracking/[[...slug]]`
- `/tracking` → form input token
- `/tracking/TOKEN` → auto load service
- Setelah submit token manual, URL berubah via `history.replaceState` tanpa reload

### Issue 3: Tracking Visits Log
- Tabel `tracking_logs` baru: id, service_order_id, token, visited_at
- Setiap kunjungan ke tracking page tercatat otomatis
- Tab "Tracking" di owner dashboard menampilkan riwayat kunjungan (waktu, customer, invoice, link)

### Issue 4: Caption Telegram Brand & Model
- Tambah `Brand : ...` dan `Model : ...` di caption Telegram saat add new service

### Issue 5: Telegram Customer Baru dari Service
- Ganti dari `/api/telegram/customer-new` (butuh SERVICE_ROLE_KEY) ke `/api/telegram` langsung (pakai bot token yang sudah jalan)
- Format pesan: `CUSTOMER BARU \nnama cs: ... \nno. wa: ...`

### Files Changed
- `app/tracking/[[...slug]]/page.tsx` (renamed from `[id]`)
- `db/supabase-schema.sql` (tracking_logs table + GRANT customers)
- `app/owner/page.tsx` (tracking tab)
- `components/owner/TrackingVisits.tsx` (NEW)
- `components/admin/ServiceInput.tsx` (caption + customer save + telegram)
- `components/layanan/LayananForm.tsx` (customer save with error handling)

### Database Changes
- Tabel `tracking_logs` baru
- GRANT customers untuk akses
---

## Revisi v.28 - 2026-07-11

### 1. QR Image di WhatsApp Message
Saat klik "Kirim ke WhatsApp", pesan sekarang menyertakan QR image via `api.qrserver.com` — WhatsApp preview gambar QR.

**Files**: `components/admin/ServiceList.tsx`, `components/admin/QRCodeGenerator.tsx`

### 2. Token Tidak Lagi di Query String
- QR code pake `/tracking/{token}` (token di path, bukan query)
- Tracking page auto-load jika token ada di URL path
- QR di tracking page hanya link ke `/tracking` (tanpa token)

**Files**: `components/admin/ServiceList.tsx`, `components/admin/QRCodeGenerator.tsx`, `app/tracking/[id]/page.tsx`

### No Database Changes

---

## Revisi v.29 - Token Validation & Feedback Notification - 2026-07-11

### Issue 1: Token Validation Error
**Masalah**: Token tracking tidak valid, customer tidak bisa tracking service.

**Fix**:
- Improved token generation: fixed 12-character alphanumeric
- Collision detection: check database sebelum use token
- Retry mechanism: up to 5 attempts jika collision
- Error handling: toast notification untuk code 23505 (unique constraint violation)
- Database schema: tambah UNIQUE constraint pada token column

**Files**: 
- `components/admin/ServiceInput.tsx`
- `db/supabase-schema.sql`
- `db/migration-add-token-unique.sql` (NEW)

### Issue 2: Customer Feedback Tidak Masuk Owner Dashboard
**Masalah**: Notifikasi feedback tidak muncul di owner dashboard karena tidak ada `user_id`.

**Fix**:
- Query semua users dengan role 'owner' atau 'admin'
- Kirim notifikasi individual ke setiap owner/admin dengan `user_id`
- Notifikasi sekarang muncul di owner dashboard bell icon

**Files**:
- `app/tracking/[[...slug]]/page.tsx`
- `app/feedback/[id]/page.tsx`

### Database Migration Required
```sql
-- Add UNIQUE constraint to token
DROP INDEX IF EXISTS idx_service_orders_token;
ALTER TABLE service_orders 
  DROP CONSTRAINT IF EXISTS service_orders_token_key,
  ADD CONSTRAINT service_orders_token_key UNIQUE (token);
CREATE UNIQUE INDEX IF NOT EXISTS idx_service_orders_token_unique ON service_orders(token);
```

---

## Revisi v.30 - Validasi Kaspin & Feedback Restriction - 2026-07-11

### Issue 1: Validasi Kaspin Update per Teknisi

**Masalah**: Teknisi A bisa lihat dan update kaspin untuk service Teknisi B (tidak sesuai assignment).

**Fix**: 
- Filter service di KaspinUpdate berdasarkan `assigned_teknisi_id = user.id`
- Hanya tampilkan service yang assigned ke teknisi yang login
- Filter tambahan: hanya service dengan status `assigned`, `in_progress`, `waiting_sparepart`
- Exclude service yang sudah `completed`, `cancelled`, atau `qc_pending`
- Empty state jika teknisi belum ambil service

**Files**: `components/teknisi/KaspinUpdate.tsx`

### Issue 2: Customer Feedback Restriction

**Masalah**: Customer bisa submit feedback meskipun service belum selesai (in_progress, pending, dll).

**Fix**:
- Feedback form **hanya muncul** jika `service.status === "completed"`
- Tampilkan pesan "Feedback dapat diberikan setelah service selesai" untuk status lain
- UI service detail tetap tampil, hanya feedback section yang conditional
- Icon dan styling yang user-friendly

**Files**: `app/tracking/[[...slug]]/page.tsx`

### No Database Changes

---

## Revisi v.31 - Timeline Photos Not Displaying - 2026-07-11

### Issue: Foto Progress Update Tidak Muncul di Timeline Tracking

**Masalah**: 
- Teknisi upload foto + deskripsi di timeline
- Foto tidak muncul di tracking page
- Text berubah jadi "Update" (default label)

### Root Cause (DITEMUKAN!)
- `ServiceTimeline.tsx` insert dengan `status: 'progress'`
- Tracking page render hanya untuk status: `'in_progress'`, `'completed'`, `'waiting_sparepart'`, `'assigned'`, `'qc_pending'`
- Status `'progress'` tidak match → render default "UPDATE"
- Foto juga tidak muncul karena condition di line 506 tidak tercapai

### Fix
1. **ServiceTimeline.tsx line 88**: `'progress'` → `'in_progress'`
2. **ProgressUpdate.tsx line 106**: Sudah tambah `photo_url` ke service_timeline (done sebelumnya)
3. **Tracking page line 506**: Render foto conditional `{update.photo_url && <img>}` (sudah benar)

**Files Changed**: 
- `components/teknisi/ServiceTimeline.tsx`
- `components/teknisi/ProgressUpdate.tsx` (sudah)

### No Database Changes

---

## Revisi v.32 - 2026-07-11

### 1. Attendance Default Notes

**Masalah**: Catatan absen masuk/pulang kosong, tidak jelas.

**Fix**: 
- Absen masuk tanpa catatan → default "absen masuk"
- Absen pulang tanpa catatan → default "absen pulang"

**File**: `components/teknisi/AttendanceModal.tsx`
- Line 342, 354: Default notes untuk caption
- Line 377, 407: Default notes untuk DB insert/update

**Result**: Telegram caption selalu memiliki catatan yang jelas.

### 2. Add Sparepart di Timeline

**Masalah**: Tidak ada cara mencatat sparepart di timeline.

**Fix**: Form custom sparepart (nama, qty, harga) di timeline:
- Simpan ke `service_timeline.details.spareparts`
- Display dengan format rupiah
- Total biaya terhitung

**File**: `components/teknisi/ServiceTimeline.tsx`
- State: `spareparts` dan `sparepartForm`
- Functions: `addSparepart()`, `removeSparepart()`
- Upload: sparepart detail ke Telegram
- Display: Sparepart list dengan total

### 3. Separate Telegram Channels

**Masalah**: Semua update masuk ke channel yang sama, sulit track per role.

**Fix**: Channel terpisah:
- `TELEGRAM_CHANNEL_TEKNISI_UPDATE` → `@arlogic_teknisi_update`
- `TELEGRAM_CHANNEL_QC_UPDATE` → `@arlogic_qc_update`

**Files**:
- `.env`: Add 2 env var
- `lib/telegram.ts`: Add channel types
- `hooks/useUpload.ts`: Type definitions
- `app/api/upload/route.ts`: Channel mapping
- `components/teknisi/ServiceTimeline.tsx`: Upload ke `'teknisi_update'`

### No Database Changes

---

## Revisi v.33 - 2026-07-11 (Sparepart Sync & Edit)

### 1. Sparepart Timeline → service_items + Telegram Sync

**Masalah**: 
- Sparepart di timeline tidak muncul di QC popup
- Sparepart di timeline tidak masuk ke Telegram caption
- Data tidak sinkron antar komponen

**Root Cause**:
- Timeline sparepart hanya disimpan di `service_timeline.details.spareparts`, tidak di `service_items`
- QCReviewModal hanya merge `localItems` (service_items), mengabaikan timeline sparepart

**Fix**:
- **ServiceTimeline.tsx**: Insert sparepart ke `service_items` saat submit timeline (FIX #1)
- **QCReviewModal.tsx**: Merge sparepart dari `service_items` + `timeline.details.spareparts` (FIX #2)
- **AddSparepartModal.tsx**: Save detail sparepart ke timeline (sku, qty, price, total) (FIX #3)

**Files**:
- `components/teknisi/ServiceTimeline.tsx` - Line 149-164: Insert ke service_items
- `components/qc/QCReviewModal.tsx` - Line 350-360: Merge allSpareparts
- `components/teknisi/AddSparepartModal.tsx` - Line 412-426: Detail sparepart

### 2. Edit/Remove Sparepart di Timeline Form

**Masalah**: Teknisi tidak bisa edit/hapus sparepart yang salah ketik di form timeline

**Fix**: 
- Add `editSparepart()`, `updateSparepart()` functions
- Add `editingSparepartIndex` state
- UI: Edit button (blue), Update button (blue), Cancel button (gray)
- Remove button (red) sudah ada

**File**: `components/teknisi/ServiceTimeline.tsx`
- Line 77-98: Functions add/edit/update/remove
- Line 41-42: State `editingSparepartIndex`
- Line 274-280: Edit/Update UI buttons
- Line 294-299: Sparepart list dengan Edit button

### 3. Telegram Caption Sync (QCReviewModal)

**Masalah**: Total cost di Telegram tidak include timeline sparepart

**Fix**:
- Calculate `totalCostWithTimeline` = `totalCost` + `timelineSparePartCost`
- Update total display, selisih/return calculation
- Caption include all spareparts dari service_items + timeline

**File**: `components/qc/QCReviewModal.tsx`
- Line 350-360: Merge allSpareparts
- Line 362-370: barangList include timeline sparepart
- Line 388-390: Total display update
- Line 392-400: Selisih/return calculation

### No Database Changes

---

---

## Revisi Tambahan v.24 - 2026-07-14

### Issue 3: Operator Telegram Caption Tidak Sesuai Handle By

**Masalah**: Di `LayananForm.tsx`, Telegram caption selalu menampilkan `user?.full_name` sebagai operator, tidak peduli siapa yang dipilih di "Handled By". Jika admin memilih "Orang Lain", caption tetap menampilkan admin.

**Fix**: `components/layanan/LayananForm.tsx` — ganti `user?.full_name` dengan `selectedUser?.full_name || user?.full_name` di template caption.

### Issue 4: Management Transaksi untuk Dashboard Supervisor (QC)

**Masalah**: Dashboard QC/Supervisor tidak memiliki fitur manajemen transaksi seperti admin.

**Fix**: `app/qc/page.tsx`
- Import `TransactionManagement` (dynamic import)
- Import `LayananForm`
- Tambah menu item "Transaksi" di sidebar
- Render `TransactionManagement` saat tab aktif

### Issue 5: Add New Service di Dashboard Teknisi

**Masalah**: Dashboard teknisi sudah punya tombol "New Service" di header, tapi tidak ada di sidebar menu. Membuat teknisi sulit menemukan fitur ini.

**Fix**: `app/teknisi/page.tsx`
- Tambah menu item "Service" di sidebar (sebelum Transaksi)
- Sudah ada `ServiceInput` + modal, hanya perlu navigasi sidebar

### Issue 6: Tambah Payment Method EDC + Selaraskan Caption Telegram

**Masalah**: Belum ada metode pembayaran generik "EDC" (hanya `edc_bca` dan `edc_mandiri`). Telegram caption juga perlu diselaraskan.

**Fix**:
- `types/index.ts`: Tambah `"edc"` ke `MetodePembayaran` + `metodePembayaranLabels`
- `components/layanan/LayananForm.tsx`: Tambah opsi "EDC"
- `components/layanan/PengeluaranForm.tsx`: Tambah opsi "EDC"
- `components/layanan/LayananList.tsx`: Tambah opsi filter "EDC"
- `components/layanan/TransactionManagement.tsx`: Tambah `paymentColors` + `paymentLabels` entry untuk "edc"
- `components/admin/AdminDashboardAnalytics.tsx`: Tambah label, icon, color untuk "edc"
- `components/admin/ClosingDashboard.tsx`: Tambah label, icon untuk "edc"
- `app/admin/page.tsx`: Tambah label mapping untuk "edc" di detail modal

### Issue 7: Session Sering Logout (Keluar Sendiri)

**Masalah**: Web sering keluar ke halaman login tanpa aksi user. Penyebab: `onAuthStateChange` terlalu agresif — event `SIGNED_OUT` dipicu saat token refresh gagal sementara.

**Fix**: `components/Providers.tsx`
- Ubah handler `SIGNED_OUT`: jangan langsung redirect ke `/login` jika masih ada session di localStorage
- Tambah pengecekan `session` di `getUser()`: jika `getUser()` gagal, coba `getSession()` sebagai fallback
- Tambah retry logic untuk token refresh

### Files Changed
- `components/layanan/LayananForm.tsx`
- `types/index.ts`
- `app/qc/page.tsx`
- `app/teknisi/page.tsx`
- `components/layanan/PengeluaranForm.tsx`
- `components/layanan/LayananList.tsx`
- `components/layanan/TransactionManagement.tsx`
- `components/admin/AdminDashboardAnalytics.tsx`
- `components/admin/ClosingDashboard.tsx`
- `app/admin/page.tsx`
- `components/Providers.tsx`
- `components/admin/CustomerList.tsx`
- `components/admin/DoneService.tsx`
- `db/supabase-schema.sql`

### Database Migration
Jalankan SQL berikut di Supabase SQL Editor:
```sql
ALTER TABLE customers ADD COLUMN IF NOT EXISTS point INTEGER DEFAULT 0;
NOTIFY pgrst, 'reload schema';
```
