# Deskripsi Proyek

## Arlogic Web Services - Watch Service Management System

Sistem manajemen service jam tangan berbasis web yang terintegrasi dengan Supabase, Telegram, dan WhatsApp. Digunakan oleh admin, teknisi, QC/supervisor, dan owner untuk mengelola seluruh alur service dari order masuk hingga selesai.

---

## Alur Kerja

1. **Admin** input service order baru → generate invoice + token tracking
2. **Teknisi** ambil service dari queue → update progress → submit ke QC
3. **QC/Supervisor** review hasil service → approve/reject (revisi)
4. **Customer** tracking service via token → beri feedback setelah selesai
5. **Owner** monitor dashboard: revenue, performance, feedback, tracking visits

---

## Tech Stack

- **Frontend**: Next.js 16 (App Router), TypeScript, Tailwind CSS, Framer Motion
- **Backend**: Supabase (PostgreSQL + Auth + RLS)
- **Storage**: Telegram Bot API (foto upload ke channel)
- **Notification**: Telegram channel per kategori, WhatsApp sharing
- **State Management**: Zustand (authStore)
- **Chart**: Recharts (owner dashboard)
- **QR Code**: qrcode.react

---

## Role & Akses

| Role | Dashboard | Fitur Utama |
|------|-----------|-------------|
| Admin | `/admin` | Input service, manage inventory, PO, closing, customer, transaction |
| Teknisi | `/teknisi` | Queue service, progress update, kaspin, attendance, sparepart request |
| QC/Supervisor | `/qc` | Review service, approve/reject, attendance report |
| Owner | `/owner` | Revenue analytics, performance, feedback, tracking visits, closing approve |
| Customer | `/tracking` | Tracking service via token, feedback setelah selesai |

---

## Revisi Terakhir

### v.24 - Selaraskan Komponen dengan Fitur Pengeluaran (2026-07-14)

1. **TypeScript types**: `JenisLayanan` sekarang include `"pengeluaran"`, labels updated
2. **LayananList filter**: Opsi "Pengeluaran" di dropdown filter Service Type
3. **TransactionManagement**: Stats card pecah jadi Pemasukan/Pengeluaran, FilterModal tampil merah untuk expense
4. **AdminDashboardAnalytics**: Transaksi expense tampil dengan indikator merah, list scrollable
5. **Detail Transaksi modal**: Layout khusus untuk pengeluaran (header merah, nama barang, dll)
6. **Scrollable list**: Daftar transaksi di dashboard dan management transaction bisa scroll internal
