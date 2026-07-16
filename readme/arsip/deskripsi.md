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

### v.25 - Multiple Fixes: Upload, DP, Multi Jenis Layanan (2026-07-15)

1. **Bug fix upload**: `sendMediaGroup` hanya dipanggil jika foto >= 2, fallback per-photo jika `getFileUrl` gagal
2. **Error handling**: "No URLs returned from server" diganti toast informatif — service tetap tersimpan
3. **Tipe jam**: "MECHANICAL" diganti "DIGITAL" di form dan list filter
4. **Metode bayar DP**: Tambah EDC Mandiri & EDC BCA, perbaiki semua label caption/summary pakai `paymentLabels`
5. **Down Payment**: Sekarang tampil di modal detail service (admin, teknisi, owner)
6. **Multi jenis layanan**: Setiap extra item dikirim sebagai pesan Telegram terpisah (bukan digabung)
7. **List transaksi per-item**: `layanan_items` di-expand jadi rows terpisah di stats & filter
