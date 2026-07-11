# REVISI v.32 PROPOSAL - Tiga Fitur Baru

**Tanggal**: 2026-07-11  
**Status**: 🔍 PROPOSAL

---

## Fitur 1: Attendance Default Notes

**Requirement**:
- Absen masuk tanpa catatan → default "absen masuk"
- Absen pulang tanpa catatan → default "absen pulang"

**Implementation**:
- File: `components/teknisi/AttendanceModal.tsx`
- Logic: Saat submit check-in/check-out, jika `notes` kosong, set ke default string

**Example**:
```typescript
const finalNotes = notes.trim() || (isCheckOut ? "absen pulang" : "absen masuk");
```

---

## Fitur 2: Add Sparepart di Update Timeline

**Requirement**:
- Custom sparepart input di timeline (nama, qty, harga)
- Tidak integrasi ke inventory table
- Disimpan di `service_timeline` details
- Display di timeline juga

**Implementation**:
- File: `components/teknisi/ServiceTimeline.tsx`
- Add form untuk input sparepart: nama, qty, harga
- Simpan ke `service_timeline.details.spareparts` array
- Render sparepart list di timeline display
- Kirim ke Telegram dengan detail sparepart

**Database Structure**:
```typescript
details: {
  spareparts: [
    { name: "Battery", qty: 1, price: 50000 },
    { name: "Glass", qty: 2, price: 150000 }
  ],
  total_sparepart_cost: 200000
}
```

---

## Fitur 3: Separate Telegram Channels

**Requirement**:
- Update teknisi → channel `TELEGRAM_CHANNEL_TEKNISI_UPDATE`
- Update QC → channel `TELEGRAM_CHANNEL_QC_UPDATE`
- Setiap tipe update punya grub sendiri

**Implementation**:

### 1. Environment Variables (`.env`)
```
# Existing
TELEGRAM_CHANNEL_SERVICE=@arlogic_storage
TELEGRAM_CHANNEL_KASPIN=@arlogic_storage

# NEW - Separate channels
TELEGRAM_CHANNEL_TEKNISI_UPDATE=@arlogic_teknisi_update
TELEGRAM_CHANNEL_QC_UPDATE=@arlogic_qc_update
```

### 2. Telegram Lib (`lib/telegram.ts`)
```typescript
const CHANNELS: Record<TelegramChannelType, string> = {
  service: process.env.TELEGRAM_CHANNEL_SERVICE || '',
  kaspin: process.env.TELEGRAM_CHANNEL_KASPIN || '',
  teknisi_update: process.env.TELEGRAM_CHANNEL_TEKNISI_UPDATE || '',  // NEW
  qc_update: process.env.TELEGRAM_CHANNEL_QC_UPDATE || '',  // NEW
  // ... existing channels
}

type TelegramChannelType = 
  | 'service' 
  | 'kaspin' 
  | 'teknisi_update'  // NEW
  | 'qc_update'  // NEW
  | 'attendance'
  | 'layanan'
  | 'inventory'
  | 'closing'
  | 'customer'
```

### 3. Routes yang Diubah
- ServiceTimeline.tsx → upload ke `'teknisi_update'` channel (bukan `'service'`)
- QCReviewModal.tsx → upload ke `'qc_update'` channel (bukan `'service'`)

---

## Flow Diagram

### Before (semua ikut service channel):
```
Teknisi update → TELEGRAM_CHANNEL_SERVICE ✗
QC update → TELEGRAM_CHANNEL_SERVICE ✗
Service foto → TELEGRAM_CHANNEL_SERVICE ✓
```

### After (terpisah per tipe):
```
Teknisi update → TELEGRAM_CHANNEL_TEKNISI_UPDATE ✓
QC update → TELEGRAM_CHANNEL_QC_UPDATE ✓
Service foto → TELEGRAM_CHANNEL_SERVICE ✓
```

---

## Testing Plan

### Fitur 1: Attendance Default
1. Absen masuk tanpa catatan → Telegram caption: "...notes: absen masuk"
2. Absen pulang tanpa catatan → Telegram caption: "...notes: absen pulang"
3. Absen masuk dengan catatan → Telegram caption: "...notes: [custom catatan]"

### Fitur 2: Add Sparepart Timeline
1. Buka Update Timeline
2. Add sparepart: Battery, qty 1, price 50000
3. Submit
4. ✅ Sparepart muncul di timeline display
5. ✅ Telegram caption include sparepart detail

### Fitur 3: Separate Channels
1. Create 2 telegram channels baru
2. Add ke .env
3. Teknisi upload update → channel teknisi_update ✓
4. QC upload update → channel qc_update ✓

---

## Files to Modify

| File | Changes |
|------|---------|
| `.env` | Add 2 new channel env vars |
| `lib/telegram.ts` | Add new channel types |
| `components/teknisi/AttendanceModal.tsx` | Add default notes logic |
| `components/teknisi/ServiceTimeline.tsx` | Add sparepart form + Telegram channel |
| `components/qc/QCReviewModal.tsx` | Change Telegram channel |
| `revisi.md` | v.32 documentation |

---

## Effort Estimate

- Fitur 1 (Attendance): 15 min
- Fitur 2 (Sparepart Timeline): 45 min
- Fitur 3 (Telegram Channels): 30 min
- Documentation & Testing: 20 min
- **Total: ~110 min**

---

**Status: 🔍 READY FOR APPROVAL & IMPLEMENTATION**

Konfirmasi jika semua requirement jelas atau ada adjustment?
