# Revision V26 — Implementation Plan

## Feature 1 — Pisahkan Tambah Sparepart dari Timeline

### Problem
Sparepart addition is tied to timeline creation. Teknisi must create a timeline entry just to add a sparepart.

### Solution
Create standalone `AddSparepartModal` (like `AddJasaModal`). Button in ProgressUpdate opens modal. System auto-generates timeline entry in background.

### Files Affected
| File | Action |
|------|--------|
| `components/teknisi/AddSparepartModal.tsx` | **REWRITE** — Simplify to name/qty/notes only (like AddJasaModal) |
| `components/teknisi/ProgressUpdate.tsx` | Remove inline sparepart item adding, keep button that opens modal via callback |
| `components/teknisi/QueueList.tsx` | Wire up new AddSparepartModal, add `openAddSparepart` handler |
| `lib/telegram.ts` | Add sparepart timeline entry generation |

### Data Flow
```
Teknisi clicks "Tambah Sparepart" button
  → Opens AddSparepartModal
  → Fills: name, qty, notes
  → Saves to service_items table
  → Auto-creates service_timeline entry: "Teknisi menambahkan sparepart: • YM92A TB (1x)"
  → Closes modal
```

---

## Feature 2 — Catatan Teknisi Saat Submit ke QC

### Problem
No notes field when teknisi submits to QC.

### Solution
Add optional textarea "Catatan Teknisi" in the Submit QC modal. Store in `service_orders.qc_submit_notes`.

### Database Changes
| Table | Column | Type | Default |
|-------|--------|------|---------|
| `service_orders` | `qc_submit_notes` | `text` | `nullable` |

### Files Affected
| File | Action |
|------|--------|
| `types/index.ts` | Add `qc_submit_notes` to `ServiceOrder` interface |
| `components/teknisi/QueueList.tsx` | Add textarea in Submit QC modal, pass to update |
| `supabase-schema.md` | Update schema documentation |

---

## Feature 3 — Revisi Format Caption UPDATE QC

### Problem
Current caption format doesn't match the new requirement.

### Solution
Update caption generator in both QueueList (Submit QC) and QCReviewModal (Approve/Reject).

### New Format
```
UPDATE QC

Status : Menunggu QC

Teknisi : Iky

Start : Jumat, 17 Juli 2026

Done : Jumat, 17 Juli 2026

Rincian Item

Barang:
• YM92A TB (1x) @Rp50.000

Jasa:
• Pasang Mesin (1x) @Rp50.000

Total : Rp100.000
DP : Rp1
Diskon : Rp50.000 (50%)
Kekurangan : Rp49.999

Keterangan QC :
(ditampilkan jika diisi)

Keterangan Teknisi :
(ditampilkan jika diisi)
```

### Files Affected
| File | Action |
|------|--------|
| `components/teknisi/QueueList.tsx` | Update caption in Submit QC (lines 337-348) |
| `components/qc/QCReviewModal.tsx` | Update caption on approve/reject (lines 350-401) |
| `components/teknisi/ServiceTimeline.tsx` | Update any timeline caption references |

### Changes
- "pengerjaan :" → "Rincian Item"
- "barang:" → "Barang:"
- "jasa:" → "Jasa:"
- Add "Status : ..." right after "UPDATE QC"
- Add Keterangan QC and Keterangan Teknisi sections (conditional)

---

## Feature 4 — QC Dapat Mengedit Rincian Item

### Problem
QC can only edit prices, not quantities, names, or add/remove items freely.

### Solution
Enhance QCReviewModal to allow full CRUD on items: edit price, quantity, name; add new items; delete items. Real-time recalculation.

### Files Affected
| File | Action |
|------|--------|
| `components/qc/QCReviewModal.tsx` | Add quantity editing, name editing, full add/remove, real-time total recalculation |

### Current Pattern
QCReviewModal already supports:
- Price editing via `editingPrice` state
- Custom jasa/sparepart adding
- Item deletion

### Enhancement
- Add quantity inline editing alongside price
- Add name editing
- Real-time discount calculation (see Feature 5)
- Better add item UI with search from existing service_jasa table

---

## Feature 5 — Sistem Diskon Custom

### Problem
No discount system. Subtotal = total. Need flexible discount.

### Solution
Add discount field (nominal) to service orders. Calculate percentage automatically. Recalculate all values in real-time.

### Rumus
```
Subtotal = Total Barang + Total Jasa
Grand Total = Subtotal - Diskon
Sisa Pembayaran = Grand Total - DP
```

### Database Changes
| Table | Column | Type | Default |
|-------|--------|------|---------|
| `service_orders` | `discount` | `integer` | `0` |
| `service_orders` | `discount_percentage` | `numeric(5,2)` | `0` |

### Files Affected
| File | Action |
|------|--------|
| `types/index.ts` | Add `discount`, `discount_percentage` to `ServiceOrder` |
| `components/qc/QCReviewModal.tsx` | Add discount input field, recalculate real-time |
| `components/teknisi/QueueList.tsx` | Update caption to include discount |
| `hooks/useOwnerDashboard.ts` | Update profit calculation to use discount |
| `components/owner/OwnerOverviewSection.tsx` | Update display |
| `lib/telegram.ts` | Update any caption templates |

### Validation
- Discount cannot exceed subtotal
- Grand Total cannot be negative
- Percentage calculated: `(discount / subtotal) * 100`
- Recalculate on: price change, qty change, item add/remove, discount change

---

## Feature 6 — Preview Foto pada QC Review

### Problem
Photos in QCReviewModal open in new tab. No preview modal with navigation.

### Solution
Create photo preview modal with navigation, zoom, download.

### Files Affected
| File | Action |
|------|--------|
| `components/qc/QCReviewModal.tsx` | Replace window.open with image preview modal |
| `components/ui/ImagePreview.tsx` | **NEW** — Image preview modal component |

### ImagePreview Component
- Props: photos[], initialIndex, onClose
- Features: previous/next navigation, zoom toggle, download button, close
- Uses design system tokens and Framer Motion

---

## Feature 7 — Draft pada QC Review Service

### Problem
QC changes to items/discount are lost if modal is closed accidentally.

### Solution
Add localStorage draft system for QCReviewModal, reusing the existing `draftStorage.ts` pattern.

### Files Affected
| File | Action |
|------|--------|
| `components/qc/QCReviewModal.tsx` | Add auto-save draft with debounce, restore on open, "Hapus Draft" button, clear on save |

### Draft Behavior
- Auto-save: When localItems, discount, or reviewNotes change
- Restore: On modal open, check for existing draft
- "Hapus Draft": Clears localStorage, resets to DB state
- Clear: On successful save (approve/reject), clear draft

---

## Summary of All Changes

### New Files
| File | Purpose |
|------|---------|
| `components/ui/ImagePreview.tsx` | Photo preview modal (Feature 6) |

### Modified Files
| File | Features |
|------|----------|
| `components/teknisi/AddSparepartModal.tsx` | F1 — Simplify to name/qty/notes modal |
| `components/teknisi/ProgressUpdate.tsx` | F1 — Remove inline sparepart, keep button |
| `components/teknisi/QueueList.tsx` | F1, F2, F3 — Wire AddSparepart, add notes field, update caption format |
| `components/qc/QCReviewModal.tsx` | F3, F4, F5, F6, F7 — Caption format, full item editing, discount, photo preview, draft |
| `types/index.ts` | F2, F5 — Add qc_submit_notes, discount fields |
| `lib/draftStorage.ts` | F7 — May need minor update for custom form types |

### Database Changes (service_orders)
| Column | Type | Feature |
|--------|------|---------|
| `qc_submit_notes` | `text` (nullable) | F2 |
| `discount` | `integer` (default 0) | F5 |
| `discount_percentage` | `numeric(5,2)` (default 0) | F5 |

### Documentation Files
| File | Action |
|------|--------|
| `revisi.md` | This document — update after work begins |
| `deskripsi.md` | Update with new feature descriptions |
| `progres.md` | Update implementation progress |
| `fitur.md` | Add new features to feature list |
| `supabase-schema.md` | Update with new columns |

---

## Risks and Mitigation

| Risk | Impact | Mitigation |
|------|--------|------------|
| F1: Existing AddSparepartModal (989 lines) has complex inventory logic | The existing modal handles INVENTORY-based adding. Feature 1 wants a SIMPLE modal (name/qty/notes). | Create a SECOND AddSparepartModal for the simple flow, OR refactor existing one with mode flag. Better: create separate simple component. |
| F4+F5: QCReviewModal will become very large | Currently 958 lines. Adding full editing + discount + draft + photo preview could double it. | Extract item editing section into sub-component. Use the design system pattern of < 200 lines per file. |
| F5: Discount affects profit calculations | Incorrect profit reporting if business logic doesn't account for discount. | Update `final_cost` calculation to be `subtotal - discount`. Update all downstream consumers. |
| F7: Draft conflicts with real-time changes | If DB data changes while draft exists, restoring draft could show stale data. | On draft restore, re-fetch current data. If data changed since draft, show warning. |

---

## Implementation Order

1. **F5** — Database: Add discount columns to service_orders (pre-requisite for F4 item editing)
2. **F5** — Types: Update ServiceOrder interface
3. **F4** — QCReviewModal: Full item editing (enhance existing partial editing)
4. **F5** — QCReviewModal: Add discount
5. **F6** — ImagePreview component
6. **F6** — QCReviewModal: Wire up photo preview
7. **F7** — QCReviewModal: Add draft system
8. **F3** — QueueList + QCReviewModal: Update caption format
9. **F2** — QueueList: Add teknisi notes
10. **F2** — Database: Add qc_submit_notes column
11. **F1** — AddSparepartModal: Simplify modal
12. **F1** — ProgressUpdate + QueueList: Wire up new modal
13. **F1** — Auto timeline generation
14. Documentation update

---

# Revision V27 — Grouping Jenis Layanan & Konsistensi Edit Transaksi

## Revision 1 — Grouping Jenis Layanan pada List Daftar Transaksi

### Problem
Setiap item layanan ditampilkan sebagai baris terpisah, menyebabkan tampilan tidak rapi ketika beberapa item memiliki Jenis Layanan yang sama.

### Solution
Grouping UI pada `LayananList.tsx`:
- Type hanya muncul satu kali (deduplikasi dari main item + `layanan_items`)
- Semua SKU tetap tampil terpisah di bawah Customer column dengan format: `• SKU — RpNominal`
- Nominal masing-masing SKU tetap dipisahkan (tidak digabung)
- Data database tetap disimpan per item (tidak ada merge)
- Grouping hanya pada level tampilan (UI), struktur data asli tidak berubah

### Files Affected
| File | Action |
|------|--------|
| `components/layanan/LayananList.tsx` | **MODIFY** — Grouping display on Customer & Type cells using `layanan_items` |

---

## Revision 2 — Perbaiki Bug Edit Transaction

### Problem
Saat edit transaksi, extra items (`layanan_items`) tidak direstore ke form, menyebabkan:
- Seluruh SKU berubah menjadi satu item
- Harga dijumlahkan menjadi satu nominal
- Detail SKU hilang
- Struktur transaksi berubah

### Root Cause
`LayananForm.tsx` tidak memiliki logic untuk me-restore `extraItems` dari `initialData.layanan_items` saat mode edit. `extraItems` selalu diinisialisasi sebagai `[]`.

### Solution
1. **Add effect** — Restore `extraItems` dari `initialData.layanan_items` saat `initialData?.id` berubah
2. **Fix jenis_layanan parsing** — Jika `initialData.jenis_layanan` adalah combined label (e.g. "Service Langsung & Service Langsung") bukan nilai enum valid, ambil dari `layanan_items[0].jenis_layanan`
3. **Fix save** — Ubah `payload.jenis_layanan` dari `combinedJenisLabel` menjadi `jenisLayananValue` agar database menyimpan nilai enum yang valid, bukan label display

### Data Flow (Edit)
```
User clicks edit → LayananList.onEdit(item)
  → item contains layanan_items[]
  → LayananForm receives initialData
  → Effect runs: restore extraItems from layanan_items
  → Fix jenis_layanan if combined label
  → Form displays ALL items correctly
  → On save: main item → layanan row, extra items → layanan_items
```

### Files Affected
| File | Action |
|------|--------|
| `components/layanan/LayananForm.tsx` | **MODIFY** — Add restore effect, fix save payload |

---

## Revision 3 — Samakan Seluruh Flow Transaksi

### Verification
| Flow | Status | Notes |
|------|--------|-------|
| New Transaction | ✅ | Main item → `layanan` row, extra items → `layanan_items` |
| Edit Transaction | ✅ | Data 100% identik dengan kondisi awal, form terisi dengan data sebelumnya |
| Detail Transaction | ✅ | Via LayananList grouping display |
| Preview Transaction | ✅ | Confirmation modal menampilkan semua item |
| Pembuatan Nota | ✅ | Telegram caption via `buildCaption()` mencakup semua item |
| Penyimpanan Database | ✅ | `jenis_layanan` menyimpan nilai enum valid, bukan combined label |
| Perhitungan Total | ✅ | `nominal` di `layanan` row adalah total seluruh item |
| API Request & Response | ✅ | PUT endpoint menerima semua field |
| Mapping DTO | ✅ | `initialData` mencakup `layanan_items` |
| State Management | ✅ | `extraItems` state di-restore dari DB |
| Validasi Form | ✅ | Validasi tetap sama |

### Files Affected
| File | Action |
|------|--------|
| `components/layanan/LayananList.tsx` | **MODIFY** — Grouping display (Revisi 1) |
| `components/layanan/LayananForm.tsx` | **MODIFY** — Restore extraItems, fix save (Revisi 2 & 3) |

### No Database Changes
Tidak ada perubahan schema atau migration. Struktur data tetap:
- `layanan` row: main item data (`jenis_layanan`, `detail_sku`, `nominal`)
- `layanan_items`: extra items (index > 0)

---

## Acceptance Criteria Checklist

- [x] Jenis Layanan yang sama ditampilkan sebagai satu Type pada daftar transaksi
- [x] Semua SKU tetap tampil secara terpisah di bawah Type tersebut
- [x] Nominal setiap SKU tetap terpisah
- [x] Data database tetap disimpan per item, bukan hasil merge
- [x] Edit Transaction menampilkan data persis seperti saat transaksi dibuat
- [x] Tidak ada SKU yang hilang setelah edit
- [x] Tidak ada nominal yang dijumlahkan otomatis
- [x] Grouping hanya memengaruhi tampilan UI
- [x] Seluruh flow transaksi tetap konsisten mulai dari input hingga nota
- [x] Tidak ada regression pada fitur transaksi lainnya

---

# Revision V27.1 — Scroll, Tab Done, QC Grid, Owner Redesign

## 10 — Scroll List Daftar Transaksi

**Problem**: Halaman yang scroll, bukan list transaksi.

**Fix**: Ubah `min-h-screen` → `h-screen` pada content wrapper (`admin/page.tsx:831`), `overflow-hidden` → `overflow-y-auto` pada `<main>` agar tab lain tetap bisa scroll dalam viewport tetap.

| File | Change |
|------|--------|
| `app/admin/page.tsx:831` | `min-h-screen` → `h-screen`, `overflow-x-hidden` → `overflow-hidden` |
| `app/admin/page.tsx:991` | `overflow-hidden` → `overflow-y-auto` |

## 11 — Tab Done & Detail Service

**Done Card**: Tambah rincian item final (`items.map`) di card, tampilkan status "✓ LUNAS" bila sisa bayar = 0.

**Detail Service**: Foto After mencakup stage `qc` selain `final_condition`.

| File | Change |
|------|--------|
| `components/admin/DoneService.tsx` | Card: item names + LUNAS; after photos: include qc stage |

## 11c — Konsistensi Nama Tab

Samakan seluruh dashboard menjadi **"List Service"**:

| File | Old | New |
|------|-----|-----|
| `app/admin/page.tsx:784` | "Service" | "List Service" |
| `app/teknisi/page.tsx:440` | "Service Baru" | "List Service" |
| `app/qc/page.tsx:325` | "Service" | "List Service" |

## 12 — Dashboard QC Redesign

- **QCServiceList**: Layout horizontal → card/grid (`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`)
- **QC Header**: "Semua Service QC" → "List Service yang Harus Direview"
- **Export Absensi**: Tambah filter "Tahunan" + tombol Export CSV
- **Edit User**: Modal edit profile, Email & User ID read-only

| File | Change |
|------|--------|
| `components/qc/QCServiceList.tsx` | Card/grid redesign |
| `app/qc/page.tsx:420` | Header rename |
| `components/qc/AttendanceReport.tsx` | Tahunan filter + CSV export |
| `components/admin/RoleManagement.tsx` | Edit profile modal, email/user_id read-only |

## 13 — Dashboard Owner

Hapus metrik palsu:
- `expenses = totalRevenue * 0.35` (estimasi tanpa dasar data)
- `profit = totalRevenue - expenses` (tidak realistis)
- `profit margin` (tidak didukung data)

Ganti dengan statistik aktual: Pendapatan Hari Ini, Pengeluaran Hari Ini, Pengeluaran Bulan Ini, Jasa Aktif. Layout stats grid full-width.

| File | Change |
|------|--------|
| `app/owner/page.tsx` | Hapus fake expenses/profit, tambah TodayRevenue/TodayExpenses/MonthExpenses/ActiveServices |

## Files Modified (complete list)

- `app/admin/page.tsx` — scroll fix, tab rename
- `app/teknisi/page.tsx` — tab rename
- `app/qc/page.tsx` — tab rename, header rename
- `components/admin/DoneService.tsx` — card items, LUNAS, qc stage photos
- `components/admin/RoleManagement.tsx` — edit modal, email/user_id read-only
- `components/qc/QCServiceList.tsx` — card/grid redesign
- `components/qc/AttendanceReport.tsx` — Tahunan filter, CSV export
- `app/owner/page.tsx` — remove fake metrics, realistic stats
