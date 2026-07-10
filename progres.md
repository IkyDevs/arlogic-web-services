# Progress

## Current State (2026-07-05)

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

### In Progress / Needs Fix
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
- [ ] Technician service queue & "take service" flow alignment
- [ ] QC/Supervisor dashboard approve/reject flow refinement
- [ ] Telegram multi-group support configuration
- [ ] Full responsive design verification (mobile-first) - admin dashboard fixed
- [ ] Dark mode consistency across all pages
- [x] Documentation files completion

### Planned
- [ ] Pra service module (new pre-service intake form)
- [ ] Advanced analytics & reporting
- [ ] WhatsApp template automation for customer notifications
- [ ] Sparepart request & chat system improvements
