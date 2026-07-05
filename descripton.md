# Deskripsi / Catatan Developing

## Tech Stack
- **Frontend**: Next.js 16 (App Router), React, TypeScript, Tailwind CSS, Framer Motion
- **Backend**: Next.js API Routes, Supabase (PostgreSQL + Auth + Storage)
- **Storage**: Telegram Bot API (file storage via channel)
- **State**: Zustand (authStore)
- **UI Icons**: Lucide React
- **Notifications**: React Hot Toast

## Konvensi Coding
- Semua komponen client pakai `'use client'`
- Server actions / API routes di `app/api/`
- Types centralized di `types/index.ts`
- Supabase client: browser (`lib/supabase/client.ts`), server (`lib/supabase/server.ts`)
- Upload hook centralized di `hooks/useUpload.ts`
- Hooks custom di `hooks/`
- Komponen reusable di `components/`

## Environment Variables
- `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anon key
- `SUPABASE_SERVICE_ROLE_KEY` - Service role key (server only)
- `NEXT_PUBLIC_APP_URL` - App base URL
- `TELEGRAM_BOT_TOKEN` - Telegram bot token
- `TELEGRAM_CHANNEL_*` - Channel IDs untuk setiap fitur (sementara pakai 1 group)

## Catatan Penting

### Referensi Tema & Layout
- Folder `refrensi thema/` berisi referensi tema dan layout yang akan dipakai untuk revisi UI setelah fitur inti selesai

### Telegram Storage
- Semua foto disimpan ke Telegram channel
- Compressed via sharp sebelum upload (max 1280px, quality 90)
- Channel mapping di `lib/telegram.ts`
- Upload menggunakan `sendMediaGroup` untuk multiple files

### RLS Policies
- Selalu drop policy lama sebelum create policy baru
- Gunakan `auth.uid() IS NOT NULL` sebagai check untuk user terautentikasi
- Tambahkan `GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated` jika perlu

### PostgREST Schema Cache
- Setelah alter table / rename column, jalankan `NOTIFY pgrst, 'reload schema'`
- Supabase terkadang butuh waktu untuk refresh cache

### Project Recovery
- Project Supabase di-recreate setelah accidentally deleted
- Perlu re-run schema SQL dan perbaiki RLS policies
- Pastikan `.env` sesuai dengan project Supabase yang aktif

### Responsive Design
- Target: mobile-first, semua role pakai HP
- Gunakan Tailwind breakpoints: sm, md, lg
- Hindari fixed width yang menyebabkan overflow
- Test di viewport: 375px, 768px, 1024px

### Dark Mode
- ThemeProvider sudah ada di `components/ThemeProvider.tsx`
- Gunakan `data-theme` attribute di document element
- Style CSS custom properties untuk warna tema
