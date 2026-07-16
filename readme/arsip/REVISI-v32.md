# Revisi v.32 - 2026-07-11

## Fitur 1: Attendance Default Notes

**Masalah**: Nota absen masuk/pulang kosong, tidak ada informasi yang jelas di Telegram.

**Fix**: 
- Absen masuk tanpa catatan → default "absen masuk"
- Absen pulang tanpa catatan → default "absen pulang"

**Files Changed**:
- `components/teknisi/AttendanceModal.tsx` (line 342, 354, 377, 407)

**Changes**:
- Line 342: `checkOutNotes || "-"` → `checkOutNotes.trim() || "absen pulang"`
- Line 354: `checkInNotes || "-"` → default "absen masuk"
- Line 377: DB insert dengan default "absen masuk"
- Line 407: DB update dengan default "absen pulang"

**Result**: Telegram caption selalu memiliki catatan yang jelas.

---

## Fitur 2: Add Sparepart di Timeline

**Masalah**: Tidak ada cara untuk mencatat sparepart yang ditambahkan saat update timeline.

**Fix**: Tambah form custom sparepart di timeline dengan:
- Input: Nama barang, Qty, Harga
- Simpan ke `service_timeline.details.spareparts`
- Display di timeline dengan format rupiah
- Kirim ke Telegram dengan detail sparepart

**Files Changed**:
- `components/teknisi/ServiceTimeline.tsx`

**Changes**:
- Line 40-41: Tambah state `spareparts` dan `sparepartForm`
- Line 73-78: Tambah fungsi `addSparepart()` dan `removeSparepart()`
- Line 83-101: Update `addTimelineUpdate()` dengan sparepart logic
- Line 191-211: Display sparepart list di timeline
- Line 233-257: Sparepart form UI (input nama, qty, harga + button add)

**Result**: Timeline sekarang mencatat semua sparepart yang ditambahkan dengan total biaya.

---

## Fitur 3: Separate Telegram Channels

**Masalah**: Semua update (teknisi & QC) masuk ke channel yang sama (`service`), sulit untuk track per role.

**Fix**: Buat channel terpisah untuk setiap tipe update:
- `TELEGRAM_CHANNEL_TEKNISI_UPDATE` = `@arlogic_teknisi_update`
- `TELEGRAM_CHANNEL_QC_UPDATE` = `@arlogic_qc_update`

**Files Changed**:
- `.env` (line 19-20)
- `lib/telegram.ts` (line 14-15)
- `hooks/useUpload.ts` (type definitions)
- `app/api/upload/route.ts` (channelMap)
- `components/teknisi/ServiceTimeline.tsx` (line 85)

**Changes**:
- `.env`: Tambah 2 env var untuk channel baru
- `lib/telegram.ts`: Tambah `teknisi_update` dan `qc_update` ke CHANNELS
- `useUpload.ts`: Update type definitions untuk support 2 channel baru
- `upload/route.ts`: Update channelMap untuk 2 channel baru
- `ServiceTimeline.tsx`: Upload ke `'teknisi_update'` instead of `'service'`

**Result**: Update teknisi dan QC sekarang terpisah ke channel masing-masing.

---

## Files Modified Summary

| File | Changes |
|------|---------|
| `components/teknisi/AttendanceModal.tsx` | Default notes logic |
| `components/teknisi/ServiceTimeline.tsx` | Sparepart form + Telegram channel |
| `hooks/useUpload.ts` | Type definitions |
| `app/api/upload/route.ts` | Channel mapping |
| `lib/telegram.ts` | Channel types |
| `.env` | New channel env vars |

---

## No Database Changes

Semua fitur tidak memerlukan perubahan database schema.

---

## Testing Checklist

- [ ] Absen masuk tanpa catatan → caption "absen masuk"
- [ ] Absen pulang tanpa catatan → caption "absen pulang"
- [ ] Add sparepart di timeline → muncul di timeline dengan format rupiah
- [ ] Sparepart total terhitung dengan benar
- [ ] Teknisi upload update → masuk ke channel `@arlogic_teknisi_update`
- [ ] (Future) QC upload update → masuk ke channel `@arlogic_qc_update`

---

## Effort: ~120 menit

- Fitur 1: 15 min
- Fitur 2: 60 min
- Fitur 3: 30 min
- Testing & Documentation: 15 min

---

## Build Status

- TypeScript: ✅ No errors
- Ready for testing
