# Progress

## Current State (2026-07-11)

### Completed
- [x] Project setup with Next.js, Supabase, Telegram bot integration
- [x] Authentication & role-based access (admin, teknisi, supervisor/owner, customer)
- [x] Login system with profile auto-creation
- [x] Service order tracking (service_orders) with QR code
- [x] Service order management (admin input, teknisi update, QC review)
- [x] Transaction module (layanan) with form, list, filters, export
- [x] Attendance module (check-in/check-out with photo upload)
- [x] Inventory/stock management (add, edit, delete items)
- [x] Telegram storage integration (photo upload to channel)
- [x] Dark mode / light mode toggle
- [x] Export reports (attendance, inventory, services)
- [x] Owner dashboard with statistics
- [x] Superadmin features (role management, user management)
- [x] RLS policies fully normalized across all tables
- [x] Service order permission errors after project recreation
- [x] Schema cache PostgREST fixes for multiple tables
- [x] Attendance popup enforcement before 11 AM - implemented for admin, teknisi, QC
- [x] Attendance timer & overtime calculation - updated templates + overtime checkbox + 8PM threshold
- [x] Stock transfer tracking (warehouse → store)
- [x] Admin dashboard UI redesign to fintech style
- [x] Service detail modal foto dari service_documentation
- [x] DP return logic (kekurangan/return di caption)
- [x] QC overflow fix (tambah jasa custom flex-wrap)
- [x] Edit Telegram caption saat QC revisi item (dengan error toast)
- [x] QR URL fix di ServiceList (pake NEXT_PUBLIC_APP_URL)
- [x] Detail aktivitas teknisi: foto jam + item sebelum/sesudah revisi
- [x] Payment method "transfer" di type & labels (fix blank display)
- [x] Status caption "menunggu qc" / "QC approve" di Telegram
- [x] Simplify caption new service (hapus placeholder, tambah estimasi)
- [x] QC item restrictions (no delete, JASA add/edit, sparepart edit harga saja)
- [x] Attendance report di QC/Supervisor dashboard (table + filter harian/mingguan/bulanan)
- [x] Dark mode: stat card gradients + sidebar justify-evenly + "Check In" → "Absen"
- [x] Fitur Customer (daftar customer dari transaksi + service orders) di semua dashboard
- [x] Customer Autocomplete di form transaksi & service baru (search + 4 digit kode)
- [x] Customer baru otomatis dikirim ke Telegram channel "CUSTOMER DATABASE"
- [x] Tabel customers + auto code 4 digit di nama customer
- [x] Token validation fix (unique constraint + collision detection)
- [x] Feedback notification ke owner dashboard (with user_id)
- [x] Kaspin validation: teknisi hanya bisa update kaspin service yang di-assigned ke dia
- [x] Feedback restriction: customer hanya bisa feedback setelah service completed
- [x] Documentation files completion

### In Progress / Needs Fix
- [x] **v.24**: Selaraskan komponen management transaksi dengan fitur pengeluaran
- [x] **v.24**: Scrollable daftar transaksi di dashboard
- [x] **v.25**: Fix upload foto ke Telegram — skip sendMediaGroup jika < 2 foto, fallback per-photo
- [x] **v.25**: Tipe jam MECHANICAL → DIGITAL
- [x] **v.25**: Tambah EDC Mandiri & EDC BCA di metode bayar DP
- [x] **v.25**: Down Payment tampil di detail service (admin, teknisi, owner)
- [x] **v.25**: Multi jenis layanan — caption Telegram kirim terpisah per item
- [x] **v.25**: TransactionManagement expand layanan_items jadi per-item rows
- [ ] Technician service queue & "take service" flow alignment
- [ ] QC/Supervisor dashboard approve/reject flow refinement
- [ ] Telegram multi-group support configuration
- [ ] Full responsive design verification (mobile-first) - admin dashboard fixed
- [ ] Dark mode consistency across all pages

### Planned
- [ ] Pra service module (new pre-service intake form)
- [ ] Advanced analytics & reporting
- [ ] WhatsApp template automation for customer notifications
- [ ] Sparepart request & chat system improvements
