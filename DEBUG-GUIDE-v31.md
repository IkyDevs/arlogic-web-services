# REVISI v.31 - FINAL DEBUG GUIDE

**Status**: 🔍 FOTO MUNCUL DI TELEGRAM TAPI TIDAK DI TRACKING

---

## Diagnosis

Foto berhasil upload ke Telegram ✅ tapi tidak muncul di tracking page ❌

**Kemungkinan Root Cause:**
1. `photo_url` disimpan sebagai `null` ke `service_timeline`
2. Query timeline fetch `photo_url` tapi nilainya `null`
3. Render condition `{update.photo_url && <img>}` skip karena `null`

---

## Debug Langkah demi Langkah

### Langkah 1: Open DevTools Console (F12)
Buka Chrome DevTools di tracking page atau saat upload

### Langkah 2: Upload Foto di Timeline
Saat teknisi upload foto + deskripsi di "Detail Update", lihat console untuk:

**Expected Console Output:**
```
📸 Telegram sendMediaGroup response: {"ok":true,"result":[...]}
✅ sendMediaGroup chunk 1 success: 1 photos
📷 Photo URL generated: ✅ https://api.telegram.org/file/bot.../...
✅ Timeline entry created: {
  photo_url: "https://api.telegram.org/file/bot.../...",
  total_photos: 1,
  photos: ["https://api.telegram.org/file/bot.../..."]
}
Progress saved!
```

### Langkah 3: Refresh Tracking Page
Customer buka tracking dengan token, lihat console untuk:

**Expected Output:**
```
📋 Timeline fetched (1 items): [
  {
    id: "uuid",
    status: "in_progress",
    message: "Service dalam pengerjaan...",
    photo_url: "✅ https://api.telegram.org/file/...",
    details_photos: 1
  }
]
```

### Langkah 4: Interpretasi Hasil

**Scenario A - Foto ada di console tapi tidak tampil**
- Console: `photo_url: "✅ https://..."`
- Tracking page: Foto tidak muncul
- **Cause**: Browser CORS blocking atau Telegram URL expired
- **Fix**: Check network tab → foto URL blocked?

**Scenario B - photo_url null di console**
- Console: `photo_url: "❌ null/undefined"`
- **Cause**: Upload gagal tapi tidak di-handle, atau `newPhotoUrls` kosong
- **Fix**: Check upload logs lebih atas di console

**Scenario C - Timeline tidak di-fetch**
- Console: Tidak ada "📋 Timeline fetched" log
- **Cause**: Query error atau data tidak ada
- **Fix**: Check network tab → Supabase request error?

---

## Konsol Log Reference

### Upload Phase
```
📸 Telegram sendMediaGroup response: ...  ← Telegram response
✅ sendMediaGroup chunk 1 success: X photos  ← Upload berhasil
📷 Photo URL generated: ✅ ...  ← URL valid
```

### Save Phase
```
✅ Timeline entry created: {photo_url: "...", ...}  ← Disimpan ke DB
Progress saved!  ← Toast success
```

### Fetch Phase (saat buka tracking)
```
📋 Timeline fetched (X items): [...]  ← Timeline di-fetch
  photo_url: "✅ ..." atau "❌ null"  ← photo_url status
```

---

## ACTION UNTUK USER

**Silakan:**
1. Upload 1 foto di timeline service
2. Buka DevTools Console (F12)
3. Refresh tracking page
4. Screenshot/copy semua console logs
5. **Report hasil ke saya dengan logs lengkap**

---

## Files dengan Debug Logging

| File | Logs |
|------|------|
| `components/teknisi/ProgressUpdate.tsx` | ✅ Timeline entry created |
| `lib/telegram.ts` | ✅ Telegram response + URL generated |
| `app/tracking/[[...slug]]/page.tsx` | ✅ Timeline fetched status |

---

## Expected Next Steps

1. **User test** → Report console logs
2. **Kiro analyze** → Identify root cause dari logs
3. **Implement fix** → Based on actual data
4. **Verify** → Test upload again

---

**Status: 🔍 AWAITING USER DEBUG LOGS**

*Revisi v.31 Final Debug Guide - 2026-07-11*
