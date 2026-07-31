# AUDIT MENYELURUH — arlogic-web-services

Tanggal: 2026-08-01
Status: Crosscheck ✅ + Full Audit (baca saja, belum ada perubahan kode)

---

## BAGIAN 1 — CROSSCHECK PERUBAHAN MULTI-BRANCH

> Hasil verifikasi semua yang telah diperbaiki/ditambah — ✅ = tidak ada error/bug.

| # | Item | Status |
|---|------|--------|
| 1 | TypeScript (`tsc --noEmit`) — 0 error | ✅ |
| 2 | ESLint file baru (BranchContext, useBranchScope, BranchSelector, ReportModal, TeknisiStockView, TeknisiTransferView, ImportBarangModal, GudangView, /engineer, /supervisor) — 0 error | ✅ |
| 3 | Unit test — 69/69 pass | ✅ |
| 4 | Build Next.js — compiled success, 34 halaman | ✅ |
| 5 | `useBranchScope` dipakai konsisten di 9 komponen (tidak duplikat) | ✅ |
| 6 | Route baru `/engineer`, `/supervisor`, `/qc` ada | ✅ |
| 7 | `useCentralUpload` (upload) TIDAK diubah — tetap fix | ✅ |
| 8 | Import komponen konsisten (lucide, imports) | ✅ |

### ⚠️ Tercatat (belum diperbaiki — lint debt pre-existing, di luar perubahan ini)
- ESLint project penuh: **671 error** (mayoritas `any`) — semua pre-existing di file lama
- Lint debt ini bukan dari perubahan multi-branch

---

## BAGIAN 2 — FILE TIDAK DIPAKAI (UNUSED)

### 2.1 Komponen tidak pernah di-import (15)
| File | Status |
|------|--------|
| `components/admin/SparepartChat.tsx` | Tidak dipakai (0 referensi) |
| `components/teknisi/SparepartRequestModal.tsx` | Tidak dipakai |
| `components/ui/AnimatedInput.tsx` | Tidak dipakai |
| `components/ui/CentralUploader.tsx` | Tidak dipakai |
| `components/ui/GlassCard.tsx` | Tidak dipakai |
| `components/ui/LazyImage.tsx` | Tidak dipakai |
| `components/ui/ModernButton.tsx`, `ModernCard.tsx` | Tidak dipakai |
| `components/ui/NeoButton.tsx`, `NeoCard.tsx`, `NeonButton.tsx` | Tidak dipakai |
| `components/ui/PhotoUploader.tsx` | Tidak dipakai (hanya dipakai test) |
| `components/ui/SKUDetailModal.tsx`, `SearchInput.tsx`, `ServiceItemManager.tsx` | Tidak dipakai |
| `components/ui/StatCard.tsx`, `ResponsiveContainer.tsx`, `TransactionDetailModal.tsx` | Hanya name-collision (punya lokal di file lain) |
| `components/ui/Loading.tsx` | Hanya dipakai test |
| `components/teknisi/QueueList.tsx.bak` | Backup — hapus |
| `.DS_Store` (6 lokasi) | Junk macOS — hapus |

### 2.2 API route mati (8)
| Route | Catatan |
|-------|---------|
| `/api/admin/expenses` | Tidak ada caller (tabel `expenses` tidak dipakai) |
| `/api/admin/service-pickup` | Tidak ada caller |
| `/api/layanan` | Tidak ada caller |
| `/api/notifications` (base) | Hanya `/trigger` yang dipakai |
| `/api/photos/[id]` | Tidak dipakai (foto via Cloudflare Worker) |
| `/api/test-r2` | Endpoint test — **tidak aman** |
| `/api/telegram/customer-new` | Tidak ada caller |
| `/api/upload/callback` | Tidak ada caller (worker tidak panggil) |

### 2.3 Lib tidak dipakai (8)
| File | Catatan |
|------|---------|
| `lib/cloudflare-r2.ts` | R2 tidak dipakai (upload via Supabase Storage) |
| `lib/domain/service-order/service.ts` | 353 baris CRUD — 0 import |
| `lib/domain/shared/realtime.ts` | Duplikat `lib/realtime.ts` |
| `lib/domain/shared/types.ts` | 0 referensi |
| `lib/domain/whatsapp/template.ts` | 0 referensi |
| `lib/upload/index.ts` | Barrel — tidak di-import |
| `lib/upload/upload-events.ts` | 0 referensi |
| `lib/validation/helpers.ts` | 0 referensi |

### 2.4 Hook tidak dipakai (3)
- `hooks/useAdminStats.ts` — 0 referensi
- `hooks/useDebounce.ts` — 0 referensi
- `hooks/useVirtualScroll.ts` — 0 referensi

### 2.5 Store tidak dipakai
- `stores/serviceStore.ts` — 0 referensi

---

## BAGIAN 3 — LOGIKA DUPLIKAT

### 3.1 Upload — 5 jalur paralel (CRITICAL untuk konsolidasi)
| Jalur | File | Dipakai oleh |
|-------|------|--------------|
| A. Central two-phase | `lib/upload/upload-service.ts` + `useCentralUpload` | LayananForm, ServiceInput (tapi cuma `legacyUpload`) |
| B. Legacy direct | `upload-service.legacyUpload` | LayananForm, ServiceInput |
| C. usePhotoUpload | `hooks/usePhotoUpload.ts` | SubmitQCModal, KaspinUpdate, QueueList, SparepartReadyModal |
| D. useUpload | `hooks/useUpload.ts` | CashdrawForm, PengeluaranForm, ServiceTimeline, ProgressUpdate, AttendanceModal, InventoryManagement |
| E. Server | `app/api/upload/route.ts` | endpoint lama |

**Masalah:** Jalur A/B (central) & C/D (lama) berjalan paralel. Jalur session→queue→Inngest (`/api/upload/session`, `/complete`) **tidak pernah dipicu UI** — foto masih lewat `legacyUpload` (multipart). Komponen useUpload/usePhotoUpload belum dimigrasi.

### 3.2 Telegram — lib kanonik vs 7 inline duplikat
- `lib/telegram.ts` = kanonik
- Duplikat inline: `/api/telegram/route.ts` (sendMessage sendiri), `customer-new`, `delete-message`, `edit-message`, `/api/admin/closing/route.ts` (sendTelegramMessage sendiri), `cron/keepalive`, `app/api/photos/[id]`, `CashdrawForm.tsx` (fetch client-side), `lib/transaction-service.ts:501`, Worker
- **~10 builder caption berbeda** (LayananForm, ServiceInput, PengeluaranForm, CashdrawForm, QueueList, SubmitQCModal, DoneService, QCReviewModal, InventoryManagement, lib/telegram) — semua bangun string "TRANSAKSI..." sendiri

### 3.3 Transaction service — DUPLIKAT NYATA
- `lib/transaction-service.ts` (legacy) vs `lib/domain/transaction/service.ts` (baru) — hampir identik
- `TransactionManagement.tsx` import KEDUANYA sekaligus
- Kanonik = `lib/domain/transaction/service.ts`

### 3.4 formatRupiah — 15 definisi!
- Kanonik: `lib/domain/shared/formatters.ts`
- 13 `formatRupiah` + 1 `formatRupiahStatic` (mati) + 2 `formatCurrency` lokal + 64 inline `toLocaleString`
- `types/index.ts:504` = mati

### 3.5 Validasi file — 5 duplikat
- Kanonik: `lib/upload/upload-validator.ts`
- Duplikat: `usePhotoUpload` validasi sendiri, `useUpload` inline (hardcode 10 file/20MB — beda dari config), server re-check, `lib/uploadConfig.ts` vs `lib/upload/upload-config.ts` (2 config!)

### 3.6 Label map — banyak duplikat
- `paymentLabels`: 5 salinan lokal (TransactionManagement, AdminDashboardAnalytics, CustomerList, ClosingDashboard, ServiceInput)
- `serviceStatusLabels`: 3 definisi
- `getStatusBadge`: 5+ definisi lokal
- `getStatusColor`: 3 definisi

---

## BAGIAN 4 — BUG POTENSIAL (urut prioritas)

| # | Bug | File | Severity |
|---|-----|------|----------|
| 4.1 | **Tracking page rusak** — anon key + RLS `auth.uid() IS NOT NULL` → customer tidak bisa lihat tracking/feedback | `app/tracking/[[...slug]]/page.tsx` | 🔴 HIGH |
| 4.2 | **`waiting_sparepart` tidak ada di CHECK constraint** — update selalu gagal (check_violation) | `SparepartRequestModal.tsx:78`, schema | 🔴 HIGH |
| 4.3 | **Stock tidak pernah berkurang** — approve sparepart bilang "stok otomatis berkurang" tapi tidak ada logic decrement | `SparepartChat.tsx:186` | 🔴 HIGH |
| 4.4 | **Closing ignore split payment** — total per metode salah untuk split_payment | `ClosingDashboard.tsx:68-85` | 🔴 HIGH |
| 4.5 | **Middleware auth mati** — file `proxy.ts` tidak dipanggil (harus `middleware.ts`), tidak ada middleware.ts → halaman tidak terlindungi | `proxy.ts` (root) | 🔴 HIGH |
| 4.6 | **`po_pending` & `cancelled` service tidak pernah di-set** — flow tidak pernah sampai | POSection, ServiceList | 🟠 MED |
| 4.7 | **Browser client di server route** — expenses & service-pickup pakai `@/lib/supabase/client` (harus server) | 2 route | 🟠 MED |
| 4.8 | **Banyak state mati** — 30+ useState di-set tapi tidak pernah dibaca | LayananForm, teknisi, admin, qc, dll | 🟢 LOW |
| 4.9 | **Test utils.test.ts tidak valid** — test duplikat lokal, bukan code asli | `test/utils.test.ts` | 🟠 MED |
| 4.10 | **Test telegram slow** — mock 1 fetch tapi code 2 fetch (network real) | `test/lib/telegram.test.ts` | 🟢 LOW |

---

## BAGIAN 5 — KEAMANAN

| # | Isu | Severity |
|---|-----|----------|
| 5.1 | Middleware auth mati (`proxy.ts` ≠ `middleware.ts`) | 🔴 HIGH |
| 5.2 | `/api/telegram` — tanpa auth, CORS `*`, siapa pun bisa kirim ke channel | 🔴 HIGH |
| 5.3 | `/api/telegram/edit-message`, `delete-message`, `edit-caption` — tanpa auth | 🔴 HIGH |
| 5.4 | `/api/admin/closing` — tanpa auth, service-role, owner approval bisa di-bypass | 🔴 HIGH |
| 5.5 | `/api/upload/*` (session, complete, callback, retry) — tanpa auth, service-role | 🔴 HIGH |
| 5.6 | `/api/upload` legacy — tanpa auth (hanya origin + rate limit) | 🔴 HIGH |
| 5.7 | `/api/photos/[id]` — public proxy, service-role | 🟠 MED |
| 5.8 | `/api/test-r2` — tanpa auth, bocor config | 🟠 MED |
| 5.9 | `/api/telegram/chat-id` — bocor channel ID | 🟠 MED |

---

## BAGIAN 6 — DEPENDENSI TIDAK DIPAKAI (15)

```
@aws-sdk/s3-request-presigner
@radix-ui/react-dialog
@radix-ui/react-dropdown-menu
@radix-ui/react-select
@radix-ui/react-slot
@radix-ui/react-tabs
@hookform/resolvers
class-variance-authority
clsx
lodash.debounce
react-hook-form
react-intersection-observer
tailwind-merge
use-debounce
@types/lodash.debounce (dev)
```

---

## BAGIAN 7 — GAP MULTI-BRANCH (belum di-scope)

### Sudah di-scope ✅
QueueList, QC page, ServiceList, DoneService, CustomerList, AttendanceDashboard, AttendanceReport, TransactionManagement (read), engineer/supervisor overview, ClosingDashboard (write)

### Belum di-scope ❌
| Item | Masalah |
|------|---------|
| **Admin dashboard stats** | `app/admin/page.tsx` fetchStats/fetchRecentServices/fetchTodayStats — tanpa branch_id |
| **Owner dashboard stats** | `app/owner/page.tsx` — BranchSelector tampil tapi TIDAK mempengaruhi query (cosmetic) |
| **POSection** | fetch service_orders tanpa branch + notifikasi semua admin |
| **Teknisi pending queue count** | `app/teknisi/page.tsx:246` — hitung pending global tanpa branch |
| **`/api/admin/search`** | cari semua cabang |
| **`/api/layanan`** | GET admin lihat semua; POST tidak set branch_id |
| **Closing list** | `/api/admin/closing` list semua + **tabel `closings` TIDAK punya kolom `branch_id`** (ClosingApproval baca `closing.branch_id` → selalu "Cabang tidak diketahui") |
| **Notifications trigger** | target role semua cabang |
| **ExportReports** | tanpa branch |
| **WRITES** | `service_orders` INSERT (ServiceInput), `layanan` INSERT (createTransaction, PengeluaranForm, CashdrawForm) — tidak set branch_id |
| **`activity_logs` / `notifications`** | TIDAK punya kolom `branch_id` sama sekali |

### Pengumuman (announcements)
- ❌ **Belum ada komponen yang MENAMPILKAN pengumuman** — engineer bisa buat, tapi staff tidak pernah melihat popup

### Log aktivitas (activity_logs)
- ✅ Ada 6 tempat nulis (expenses, pickup, QC price, absensi)
- ⚠️ Coverage parsial — service/transaksi/inventory/tidak di-log
- ⚠️ Tidak ada kolom branch_id

---

## BAGIAN 8 — REKOMENDASI PRIORITAS

### P0 — Segera (bug berdampak user)
1. Fix **tracking page** (RLS anon / token-based policy)
2. Fix **`waiting_sparepart`** CHECK constraint
3. Fix **stock decrement** saat sparepart di-approve
4. Fix **closing split payment**
5. Fix **middleware auth** (proxy.ts → middleware.ts)

### P1 — Keamanan
6. Auth di semua `/api/telegram/*`, `/api/admin/closing`, `/api/upload/*`

### P2 — Konsolidasi duplikat
7. Migrasi 6 komponen `useUpload` → central upload
8. Migrasi 5 komponen `usePhotoUpload` → central upload
9. Hapus `lib/transaction-service.ts` (pindah ke domain service)
10. Satukan `formatRupiah` → `lib/domain/shared/formatters.ts`
11. Satukan 2 config upload → `lib/upload/upload-config.ts`
12. Buat 1 helper `buildTransactionCaption` + `buildServiceCaption`

### P3 — Multi-branch lanjutan
13. Scope admin dashboard stats + owner stats (BranchSelector benar-benar difilter)
14. Scope POSection, search, layanan API, notifications, ExportReports
15. Set `branch_id` di semua INSERT
16. Tambah kolom `branch_id` di `closings` (migration)
17. Tambah kolom `branch_id` di `activity_logs` + `notifications`
18. Buat komponen **AnnouncementPopup** (tampilkan pengumuman di dashboard)
19. Lengkapi activity log coverage

### P4 — Bersih-bersih
20. Hapus 15 komponen unused, 8 route mati, 8 lib unused, 3 hook unused, 15 dependency unused
21. Hapus `.bak`, `.DS_Store`, `build.log`, `tsconfig.tsbuildinfo`
22. Fix test `utils.test.ts` (import code asli)

---

## BAGIAN 9 — KESIMPULAN

- **Crosscheck perubahan multi-branch: SEMUA PASS ✅** (TS 0 error, lint file baru 0, test 69/69, build OK)
- **Project punya banyak hutang teknis lama**: 671 lint error, 15 komponen mati, 8 route mati, 15 dependency unused, 2 transaction service duplikat, 15 formatRupiah
- **5 bug HIGH** perlu segera diperbaiki (tracking, waiting_sparepart, stock, closing split, middleware)
- **Multi-branch belum 100%**: owner selector cosmetic, beberapa query belum di-scope, INSERT belum set branch_id, pengumuman belum tampil
- **RLS branch belum aktif** (Phase 5) — menunggu semua gap di atas beres

> Dokumen ini bersifat audit — TIDAK ada kode yang diubah. File ini untuk referensi kamu sebelum mengambil keputusan perbaikan.
