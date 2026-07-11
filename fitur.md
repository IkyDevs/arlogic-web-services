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
- QR code di popup detail service pakai `NEXT_PUBLIC_APP_URL` (bukan localhost)
- Tracking page publik (`/tracking/[[...slug]]`)
- Status: pending → assigned → in_progress → waiting_sparepart → qc_pending → completed
- Timeline update & service items (sparepart + jasa)
- Notifikasi Telegram per status
- Token validation: unique constraint, collision detection, fixed 12-char format

### 3. Transaction (Layanan)
- Input transaksi layanan (service_langsung, order_online, beli jam, dll)
- Filter by jenis layanan, status, metode pembayaran, tanggal
- Export to CSV
- Upload foto bukti transaksi ke Telegram
- Multiple photo upload support

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
- Transfer stock antara gudang dan toko dengan foto bukti
- Record transfer disimpan di tabel `stock_transfers`

### 6. QC / Supervisor
- Dashboard QC (`/qc`)
- List service yang sudah done by teknisi
- Approve / reject dengan catatan
- Reject mengirim kembali ke teknisi untuk perbaikan
- QC hanya bisa edit harga item (tidak bisa hapus)
- QC bisa tambah JASA custom
- Sparepart hanya bisa edit harga (tidak bisa tambah/hapus)
- **Laporan Absensi**: Tabel absensi semua staff dengan filter harian/mingguan/bulanan
- Edit caption Telegram otomatis saat QC revisi item

### 7. Owner Dashboard
- Statistik attendance, service, inventory
- Export reports (Excel)
- Watch database management
- **Feedback list**: Daftar feedback customer dengan rating, komentar, filter, sorting
- **Tracking visits**: Riwayat kunjungan customer ke tracking page (waktu, customer, invoice, link)
- **Closing approval**: Approve/reject closing harian dari admin dengan edit caption Telegram
- **Notifikasi feedback**: Setiap feedback customer masuk sebagai notifikasi ke owner/admin

### 8. Telegram Integration
- Storage foto via Telegram Bot API
- Channel mapping: attendance, service, layanan, inventory, stock_transfer, customer, closing
- Upload multiple photos (media group)
- Caption dengan metadata form
- Edit caption otomatis saat QC merevisi item (via `editMessageCaption` API)
- Setiap upload menyimpan `chat_id` + `message_id` untuk keperluan edit
- Notifikasi customer baru ke channel dedicated
- Notifikasi kaspin update dengan foto

### 9. Theme
- Light mode & dark mode toggle
- Fintech dashboard UI design:
  - Background: #A8D7FF
  - Cards: white dengan border-radius 24px
  - Primary: #4DB2FF
  - Accent: #FFD65A
  - Secondary: #FF5F87
- Responsive sidebar icons-only
- Top navbar dengan search, notification, profile

### 10. Data Customer
- Tab "Customer" di semua dashboard (admin, teknisi, QC, owner)
- Daftar customer dari transaksi (`layanan`) dan service orders
- Deduplikasi otomatis berdasarkan nomor telepon
- Search by nama / nomor WhatsApp
- Link langsung ke WhatsApp
- Menampilkan total transaksi & service per customer
- Autocomplete nama customer di form transaksi & service (search + 4 digit kode unik di akhir WA)
- Tabel `customers` terpisah dengan auto code 4 digit

### 11. Export & Reporting
- Export attendance to Excel
- Export inventory to Excel
- Export services/reports
- Transaction export to CSV

### 12. Kaspin Update (Sparepart Tracking)
- Teknisi update kaspin (sparepart diambil dari gudang/toko)
- Filter service: hanya service yang **assigned ke teknisi yang login**
- Status filter: hanya `assigned`, `in_progress`, `waiting_sparepart`
- Upload foto bukti kaspin ke Telegram
- Notifikasi ke Telegram channel dedicated

### 13. Customer Feedback & Tracking
- Customer tracking service via token di `/tracking/[token]`
- Feedback form **hanya muncul** jika service status = `completed`
- Rating 1-5 star + optional comment
- Notifikasi feedback ke owner/admin dashboard dengan `user_id`
- Feedback list di owner dashboard dengan filter & sorting
- Tracking visits logger: setiap akses tracking tercatat di `tracking_logs`
- Pesan informatif saat feedback belum tersedia (service belum completed)

## Fitur yang Akan Datang / Dalam Perbaikan

### Immediate Fixes
- Pra service module (form intake admin → list teknisi → progress → QC → finish)
- Overtime calculation & timer di dashboard
- Stock transfer tracking (warehouse ↔ store) - sudah ada, perlu refinement
- Multi-group Telegram support - sudah support, perlu config refinement

### Planned
- WhatsApp template automation
- Advanced analytics & real-time dashboard
- Sparepart request & chat system improvements
- Mobile app (React Native / Flutter)
