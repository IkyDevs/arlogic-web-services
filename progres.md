# Implementation Progress

## Phase 1 — Design System Foundation

| Task | Status | Date |
|------|--------|------|
| Design tokens (colors, spacing, radius, shadows) | ✅ | 2026-07-18 |
| Typography scale | ✅ | 2026-07-18 |
| 11 UI primitives (Card, Button, Input, Badge, etc.) | ✅ | 2026-07-18 |
| Shared layout (DashboardShell, Sidebar, Topbar) | ✅ | 2026-07-18 |
| NavConfig for all roles | ✅ | 2026-07-18 |

## Phase 2 — Dashboard Migration

| Task | Status | Date |
|------|--------|------|
| Admin dashboard → shared layout | ✅ | 2026-07-18 |
| Owner dashboard → shared layout | ✅ | 2026-07-18 |
| QC dashboard → shared layout | ✅ | 2026-07-18 |
| Teknisi dashboard → shared layout | ✅ | 2026-07-18 |

## Phase 3 — Revision V26

| Task | Status | Date |
|------|--------|------|
| F1: Pisahkan Tambah Sparepart dari Timeline | ✅ | 2026-07-18 |
| F2: Catatan Teknisi Saat Submit ke QC | ✅ | 2026-07-18 |
| F3: Revisi Format Caption UPDATE QC | ✅ | 2026-07-18 |
| F4: QC Dapat Mengedit Rincian Item | ✅ | 2026-07-18 |
| F5: Sistem Diskon Custom | ✅ | 2026-07-18 |
| F6: Preview Foto pada QC Review | ✅ | 2026-07-18 |
| F7: Draft pada QC Review Service | ✅ | 2026-07-18 |
| Documentation | ✅ | 2026-07-18 |

## Phase 4 — Revision V27

| Task | Status | Date |
|------|--------|------|
| R1: Grouping Jenis Layanan pada List Daftar Transaksi | ✅ | 2026-07-24 |
| R2: Perbaiki Bug Edit Transaction (restore extraItems) | ✅ | 2026-07-24 |
| R3: Konsistensi Seluruh Flow Transaksi | ✅ | 2026-07-24 |
| Documentation | ✅ | 2026-07-24 |

## Phase 5 — Revision V28: Notification Center

| Task | Status | Date |
|------|--------|------|
| Notification Service (lib/notificationService.ts) | ✅ | 2026-07-24 |
| Notification Store (stores/notificationStore.ts) | ✅ | 2026-07-24 |
| API Routes (GET/PUT /api/notifications, POST /api/notifications/trigger) | ✅ | 2026-07-24 |
| Rewrite NotificationBell UI (modern, categories, relative time) | ✅ | 2026-07-24 |
| Replace stubs in QC & Teknisi dashboards | ✅ | 2026-07-24 |
| Replace inline notification in Admin dashboard | ✅ | 2026-07-24 |
| Integrate NotificationBell in Owner dashboard | ✅ | 2026-07-24 |
| Transaction event trigger (create/update) | ✅ | 2026-07-24 |
| Documentation | ✅ | 2026-07-24 |

## Phase 4 — Revision V27.1

| Task | Status | Date |
|------|--------|------|
| 10: Scroll List Daftar Transaksi | ✅ | 2026-07-24 |
| 11: Tab Done & Detail Service (rincian final, LUNAS) | ✅ | 2026-07-24 |
| 11c: Konsistensi nama tab → List Service | ✅ | 2026-07-24 |
| 12: Dashboard QC — card/grid, export absensi, edit user | ✅ | 2026-07-24 |
| 13: Dashboard Owner — realistic stats only | ✅ | 2026-07-24 |
| Documentation | ✅ | 2026-07-24 |

## Phase 6 — Revisions V30–V32: Upload Optimization

| Task | Status | Date |
|------|--------|------|
| V30: Profiling instrumentation (backend timing) | ✅ | 2026-07-24 |
| V30: Build usePhotoUpload hook (batch, parallel, profiling) | ✅ | 2026-07-24 |
| V30: Build PhotoUploader reusable component with full UI | ✅ | 2026-07-24 |
| V30: Fix ProgressUpdate serial → batch upload | ✅ | 2026-07-24 |
| V30: Fix KaspinUpdate FileReader → createObjectURL | ✅ | 2026-07-24 |
| V30: Backend optimization (Promise.all, profiling, increased limits) | ✅ | 2026-07-24 |
| V30: Regression testing | ✅ | 2026-07-24 |
| V31: Remove ALL compression/resize (no canvas, no sharp) | ✅ | 2026-07-24 |
| V31: Remove compressFiles from ServiceInput + LayananForm | ✅ | 2026-07-24 |
| V31: Update limits (50MB total, 60MB body, 120s timeout) | ✅ | 2026-07-24 |
| V32: Centralized upload config (lib/uploadConfig.ts, env-driven) | ✅ | 2026-07-24 |
| V32: Structured logging + dev-only profiling | ✅ | 2026-07-24 |
| V32: Migrate 4 raw-fetch components → usePhotoUpload hook | ✅ | 2026-07-24 |
| V32: PhotoUploader speed/ETA, improved drag-drop, file count display | ✅ | 2026-07-24 |
| V32: 69 tests pass, 0 TS errors | ✅ | 2026-07-24 |
| V32: Documentation update | ✅ | 2026-07-24 |

## Phase 7 — Upload Refactor & Central Upload (V33–V35)

| Task | Status | Date |
|------|--------|------|
| V33: Central Upload Module (lib/upload/) | ✅ | 2026-07-30 |
| V33: IndexedDB temporary file storage | ✅ | 2026-07-30 |
| V33: useCentralUpload hook + LayananForm migration | ✅ | 2026-07-30 |
| V34: Save→Upload flow (instant submit, background upload) | ✅ | 2026-07-30 |
| V34: Upload status (PENDING/UPLOADING/SUCCESS/FAILED) + badges | ✅ | 2026-07-30 |
| V34: Edit transaksi sinkron dengan Telegram (delete old → new) | ✅ | 2026-07-30 |
| V34: Statistik split payment + multi-jenis (jenisRevenue) | ✅ | 2026-07-30 |
| V35: Cloudflare Worker photo proxy (upload + cache + display) | ✅ | 2026-07-31 |
| V35: HEIC→JPEG (heic2any fallback) + per-foto loading bar | ✅ | 2026-07-31 |
| V35: Retry upload popup (recover dari IndexedDB) | ✅ | 2026-07-31 |
| V35: ServiceInput migrated ke central upload (background) | ✅ | 2026-07-31 |
| V35: Service list auto-refresh (new-service event) | ✅ | 2026-07-31 |
| V35: Fix Hapus Draft (guard auto-save) | ✅ | 2026-07-31 |

## Phase 8 — Multi-Branch (EPIC-001, mulai implementasi)

| Task | Status | Date |
|------|--------|------|
| Audit menyeluruh business flow, roles, DB, security | ✅ | 2026-07-31 |
| Desain multi-branch final (role, cabang, gudang, engineer) | ✅ | 2026-07-31 |
| Migration SQL: role `qc`, `is_engineer`, `is_stock_approver`, `inventory_stocks`, `reports`, `announcements`, `branch_assignments` | ✅ | 2026-07-31 |
| Import data barang (DATA_BARANG.xls, 500 item) | ⏳ | — |
| Auth & routing: proxy.ts, types, BranchContext, /engineer, /supervisor | ⏳ | — |
| Fitur Lapor (ReportModal + semua dashboard) | ⏳ | — |
| Perombakan /qc (role-based), /admin (hapus Users + gudang jember) | ⏳ | — |
| Teknisi: Stock Toko, Transfer (approver), Engineer (is_engineer) | ⏳ | — |
| Owner: Closing per cabang | ⏳ | — |
| Scope data per cabang (branch_id) | ⏳ | — |
| RLS branch (terakhir) | ⏳ | — |
