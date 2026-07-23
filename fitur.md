# Feature List

## Core Features

| Feature | Status | Description |
|---------|--------|-------------|
| Authentication & RBAC | ✅ | 5 roles: admin, teknisi, supervisor, owner, customer |
| Service Order Management | ✅ | Full CRUD with invoice, token tracking |
| Transaction Management | ✅ | Multi-payment method, DP, expense |
| Inventory Management | ✅ | Store + warehouse stock, category management |
| Attendance System | ✅ | Check-in/out with photo, location, work duration |
| User Management | ✅ | Role management, profile editing |
| Closing Dashboard | ✅ | End-of-day reconciliation |
| Export Reports | ✅ | Excel/PDF export |
| Template Management | ✅ | Message templates |
| Customer Portal | ✅ | Public tracking page + feedback |
| Telegram Integration | ✅ | Photo upload, caption generation |
| QC Workflow | ✅ | QC review, approve/reject, revision |
| Draft System | ✅ | Auto-save on forms (Layanan, Service, QC Review) |
| Discount System | ✅ | Custom discount with % calculation |

## Dashboard Features

| Feature | Admin | Teknisi | QC | Owner |
|---------|-------|---------|----|-------|
| Hero KPIs | ✅ | ✅ | ✅ | ✅ |
| Revenue Analytics | ✅ | ❌ | ❌ | ✅ |
| Trend Charts | ✅ | ❌ | ❌ | ✅ |
| Activity Feed | ✅ | ✅ | ❌ | ❌ |
| Service Queue | ❌ | ✅ | ✅ | ❌ |
| Technician Performance | ❌ | ✅ | ❌ | ✅ |
| Item Editing | ❌ | ❌ | ✅ | ❌ |
| Customer Management | ✅ | ✅ | ✅ | ✅ |

## Recent Changes (V28)

| Feature | Description |
|---------|-------------|
| Notification Center | Full notification system with real-time, role-based delivery |
| Notification Service | Centralized `lib/notificationService.ts` with role-based routing |
| Notification API | REST endpoints for CRUD, mark read, mark all, trigger |
| Modern NotificationBell | Redesigned UI with categories, icons, relative timestamps |
| Event Triggers | Automatic notifications for transaction, service, and QC events |

## Recent Changes (V27)

| Feature | Description |
|---------|-------------|
| Grouping Jenis Layanan | Multi-item transaksi ditampilkan per Type (UI-only) |
| Fix Edit Transaction | Extra items tidak hilang saat edit, data 100% identik |
| Konsistensi Data | `jenis_layanan` menyimpan nilai enum valid, label hanya untuk Telegram |

## Recent Changes (V26)

| Feature | Description |
|---------|-------------|
| Sparepart Modal | Simplified add sparepart outside timeline |
| QC Submit Notes | Optional teknisi notes on QC submission |
| Caption Format | Updated UPDATE QC caption format |
| QC Item Editing | Full CRUD on items (price, qty, name, add, delete) |
| Discount System | Custom discount with % calculation |
| Photo Preview | Image preview modal with navigation |
| QC Draft System | Auto-save/restore draft on QC Review |

## Recent Changes (V30–V32)

| Feature | Description |
|---------|-------------|
| Zero-Compression Strategy | All compression/resize removed. Files stored identical to original |
| Centralized Upload Config | `lib/uploadConfig.ts` — all parameters configurable via env vars, no hardcoded values |
| PhotoUploader Component | Reusable `<PhotoUploader>` with camera/gallery/drag-drop, real progress, speed/ETA, status |
| usePhotoUpload Hook | Centralized hook with validation (from config), batch upload, profiling, cancel/retry |
| Structured Logging | Consistent `[Upload]` / `[Upload API]` prefix logging for all upload events |
| Dev-Only Profiling | Backend returns `profiling` timing breakdown only in development mode |
| Batch Upload Fix | ProgressUpdate: serial `uploadFile` loop → batch `uploadFiles` (N requests → 1) |
| Migration: Raw Fetch → Hook | SparepartReadyModal, KaspinUpdate, SubmitQCModal, QueueList (inline QC) migrated from raw `fetch('/api/upload')` to `usePhotoUpload` |
| Parallel Backend | Backend reads all files in parallel via `Promise.all`, Supabase uploads in parallel |
| Blob URL Cleanup | Centralized `URL.revokeObjectURL` in PhotoUploader, all components clean up |
| Increased Limits | Max total 50MB, body 60MB, timeout 120s |

## Upcoming

| Feature | Priority |
|---------|----------|
| Multi-branch support | Low |
| Advanced reporting | Medium |
| WhatsApp native integration | High |
