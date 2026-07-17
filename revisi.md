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
