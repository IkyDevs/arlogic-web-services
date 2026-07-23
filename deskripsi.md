# Arlogic Service Management System

Sistem manajemen toko service jam tangan dengan multi-role dashboard.

## Fitur Utama

- Manajemen Service Order (CRM)
- Manajemen Transaksi (Kasir)
- Manajemen Inventory & Sparepart
- Manajemen Absensi Teknisi
- Manajemen Roles & Users
- Closing & Laporan Harian
- Export Data (Excel/PDF)
- Customer Portal (Tracking + Feedback)
- Integrasi Telegram (Captions, Notifications)
- Workflow QC (Quality Control)
- Sistem Diskon Custom
- Draft System (Auto-save)
- Grouping Jenis Layanan (Display multi-item transaksi per type)
- Edit Transaction Preserved (Data tetap utuh tanpa merge)

## Role System

- **Super Admin** — Full access
- **Admin** — Operational management
- **Teknisi** — Service execution, sparepart, progress updates
- **QC** — Quality control, item review, approval/rejection
- **Owner** — Business overview, revenue, performance
- **Customer** — Service tracking, feedback (public)

## Tech Stack

- Next.js 16 (App Router)
- Supabase (PostgreSQL + Auth + Realtime)
- Zustand (State Management)
- Tailwind CSS v4 (Styling)
- Framer Motion (Animations)
- Recharts (Charts)
- Telegram Bot API (Photos + Captions)
