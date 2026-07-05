# Fitur

## Fitur yang Sudah Ada

### 1. Authentication & Role Management
- Login/logout dengan Supabase Auth
- Role-based access: admin, teknisi, supervisor/owner, customer
- Profile auto-creation via trigger `on_auth_user_created`
- Redirect otomatis sesuai role

### 2. Service Order (Watch Repair)
- Admin input service order dengan foto, brand, model, keluhan
- Generate QR code & token tracking untuk customer
- Tracking page publik (`/tracking/[id]`)
- Status: pending → assigned → in_progress → waiting_sparepart → qc_pending → completed
- Timeline update & service items (sparepart + jasa)
- Notifikasi Telegram per status

### 3. Transaction (Layanan)
- Input transaksi layanan (service_langsung, order_online, beli jam, dll)
- Filter by jenis layanan, status, metode pembayaran, tanggal
- Export to CSV
- Upload foto bukti transaksi ke Telegram

### 4. Attendance
- Check-in & check-out dengan upload foto
- Popup enforcement sebelum jam 11:00 (admin, teknisi, QC/supervisor)
- Timer dashboard menampilkan jam kerja secara realtime
- Check-out dengan checkbox lembur + catatan
- Perhitungan lembur otomatis setelah threshold jam 20:00 (8 malam)
- Telegram template sesuai format: ABSEN MASUK / ABSEN PULANG dengan detail tanggal, role, nama, total jam, lembur
- Simpan ke tabel `attendances` dengan kolom `overtime_minutes`, `is_overtime`, `notes`

### 5. Inventory / Stock Management
- CRUD sparepart/inventory
- Kategori management
- Search & filter
- Upload foto barang ke Telegram
- Stock toko & stok gudang

### 6. QC / Supervisor
- Dashboard QC (`/qc`)
- List service yang sudah done by teknisi
- Approve / reject dengan catatan
- Reject mengirim kembali ke teknisi untuk perbaikan

### 7. Owner Dashboard
- Statistik attendance, service, inventory
- Export reports (Excel)
- Watch database management

### 8. Telegram Integration
- Storage foto via Telegram Bot API
- Channel mapping: attendance, service, layanan, inventory
- Upload multiple photos (media group)
- Caption dengan metadata form

### 9. Theme
- Light mode & dark mode toggle
- localStorage persistence
- System preference detection

### 10. Export & Reporting
- Export attendance to Excel
- Export inventory to Excel
- Export services/reports
- Transaction export to CSV

## Fitur yang Akan Datang / Dalam Perbaikan

### Immediate Fixes
- Fix permission denied setelah recreate Supabase project
- Fix schema cache PostgREST untuk tabel `layanan`
- Normalisasi RLS policies untuk semua tabel
- Fix upload Telegram error handling & channel configuration

### Planned
- Pra service module (form intake admin → list teknisi → progress → QC → finish)
- Overtime calculation & timer di dashboard
- Stock transfer tracking (warehouse ↔ store)
- Multi-group Telegram support
- WhatsApp template automation
- Advanced analytics
