# Deskripsi Revisi v.23

## Tanggal: 2026-07-11

## Ringkasan
Revisi v.23 fokus pada **validasi akses teknisi** dan **pembatasan feedback customer**. Implementasi ini memastikan teknisi hanya bisa mengakses service yang menjadi tanggung jawabnya, dan customer hanya bisa memberikan feedback setelah service selesai.

---

## Detail Perubahan

### 1. Validasi Kaspin Update - Teknisi Assignment

**Problem:**
Saat ini, dropdown "Pilih Service" di KaspinUpdate menampilkan SEMUA service (50 terakhir) tanpa filter. Teknisi A bisa melihat dan memilih service yang ditangani Teknisi B, padahal seharusnya tidak punya akses.

**Solution:**
- Filter service berdasarkan `assigned_teknisi_id = user.id`
- Hanya service yang **assigned ke teknisi yang login** yang muncul di dropdown
- Jika teknisi belum mengambil service apapun, dropdown kosong dengan pesan "Belum ada service yang diambil"
- Validasi di level query (tidak hanya UI)

**Impact:**
- ✅ Security: Teknisi tidak bisa akses service orang lain
- ✅ UX: Dropdown lebih relevan dan tidak membingungkan
- ✅ Data integrity: Kaspin report akurat per teknisi

**File yang diubah:**
- `components/teknisi/KaspinUpdate.tsx`

---

### 2. Feedback Restriction - Completed Status Only

**Problem:**
Customer bisa submit feedback kapan saja, bahkan ketika service masih `in_progress`, `pending`, atau `qc_pending`. Ini menyebabkan feedback prematur yang tidak valid.

**Solution:**
- Feedback form **hanya muncul** jika `service.status === "completed"`
- Jika status belum completed, tampilkan informasi: "Feedback dapat diberikan setelah service selesai"
- UI tetap menampilkan service detail, hanya feedback section yang disabled
- Pesan user-friendly dengan icon

**Impact:**
- ✅ Data quality: Feedback hanya dari service yang benar-benar selesai
- ✅ Business logic: Sesuai workflow (feedback = kepuasan setelah service done)
- ✅ UX: Customer paham kapan bisa kasih feedback

**File yang diubah:**
- `app/tracking/[[...slug]]/page.tsx`

---

## Technical Details

### Kaspin Validation Query
```typescript
// BEFORE
.select("id, customer_name, watch_brand, device_brand, invoice_number")
.order("created_at", { ascending: false })
.limit(50)

// AFTER
.select("id, customer_name, watch_brand, device_brand, invoice_number, assigned_teknisi_id")
.eq("assigned_teknisi_id", user?.id)
.in("status", ["assigned", "in_progress", "waiting_sparepart"])
.order("created_at", { ascending: false })
.limit(50)
```

**Alasan tambah filter status:**
- `assigned`: Service baru diambil teknisi
- `in_progress`: Sedang dikerjakan
- `waiting_sparepart`: Menunggu sparepart (still teknisi's responsibility)
- **Exclude**: `completed`, `cancelled`, `qc_pending` (sudah tidak perlu kaspin)

---

### Feedback UI Conditional Rendering
```typescript
// Check status
const isCompleted = service.status === "completed";

// Render
{isCompleted ? (
  <FeedbackForm />
) : (
  <InfoMessage message="Feedback dapat diberikan setelah service selesai" />
)}
```

---

## Testing Scenarios

### Test Case 1: Kaspin - Teknisi yang Benar
1. Login sebagai Teknisi A
2. Ambil service S1 dari pending queue
3. Buka tab Kaspin
4. **Expected**: Dropdown hanya tampil S1 (yang baru diambil)
5. Submit kaspin untuk S1
6. **Expected**: Berhasil, kirim ke Telegram

### Test Case 2: Kaspin - Teknisi Belum Ambil Service
1. Login sebagai Teknisi B (baru, belum ambil service)
2. Buka tab Kaspin
3. **Expected**: Dropdown kosong dengan pesan "Belum ada service yang diambil"
4. **Expected**: Tidak bisa submit (button disabled atau tidak ada pilihan)

### Test Case 3: Kaspin - Service Completed Tidak Muncul
1. Login sebagai Teknisi A
2. Complete service S1 (submit to QC → approved → completed)
3. Buka tab Kaspin
4. **Expected**: S1 tidak muncul di dropdown (sudah selesai, tidak perlu kaspin lagi)

### Test Case 4: Feedback - Service Belum Completed
1. Customer buka tracking page dengan token
2. Service status: `in_progress`
3. Scroll ke bawah
4. **Expected**: Tidak ada form feedback
5. **Expected**: Muncul pesan "Feedback dapat diberikan setelah service selesai"

### Test Case 5: Feedback - Service Completed
1. Customer buka tracking page dengan token
2. Service status: `completed`
3. Scroll ke bawah
4. **Expected**: Form feedback muncul dengan star rating + comment
5. Submit feedback
6. **Expected**: Berhasil, feedback tersimpan, notif ke owner

### Test Case 6: Feedback - Already Submitted
1. Customer submit feedback untuk service completed
2. Refresh page / buka lagi
3. **Expected**: Form tidak muncul, tampil "Feedback Terkirim" dengan rating yang sudah diberikan

---

## User Impact

### Teknisi
- **Benefit**: Dropdown kaspin lebih clean, hanya service yang relevan
- **Behavior Change**: Tidak bisa lagi lihat service orang lain (security improvement)
- **Workflow**: Tidak berubah, hanya list lebih spesifik

### Customer
- **Benefit**: Tidak bingung kapan bisa kasih feedback
- **Behavior Change**: Harus tunggu service completed dulu
- **Workflow**: Lebih jelas, ada informasi status

### Owner/Admin
- **Benefit**: Data feedback lebih valid (hanya dari service yang selesai)
- **Benefit**: Kaspin tracking lebih akurat per teknisi
- **Workflow**: Tidak berubah

---

## Rollback Plan

Jika ada issue:

1. **Kaspin validation issue**:
   - Revert query ke `.limit(50)` tanpa filter `assigned_teknisi_id`
   - File: `components/teknisi/KaspinUpdate.tsx`

2. **Feedback restriction issue**:
   - Revert conditional rendering, tampilkan feedback form untuk semua status
   - File: `app/tracking/[[...slug]]/page.tsx`

3. **Git revert**:
   ```bash
   git revert HEAD
   ```

---

## Notes
- Tidak ada perubahan database schema
- Tidak ada migration SQL
- Changes bersifat logic/validation only
- Backward compatible dengan data existing
- Build time: ~30 detik
- Zero downtime deployment
