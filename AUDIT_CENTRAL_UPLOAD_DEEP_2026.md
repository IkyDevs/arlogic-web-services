# Deep Audit — Central Upload (Fondasi Jalur Tunggal Foto + Video)

**Tanggal**: 6 Agustus 2026
**Tujuan audit**: Mengukur **kesiapan** sistem Central Upload untuk dijadikan **satu-satunya jalur
foto** semua fitur, termasuk dua target khusus: **absensi foto langsung (WebRTC)** dan
**teknisi Submit QC dengan video**.
**Verdict**: ❗ **Cukup siap untuk migrasi foto**, tetapi **PERLU perbaikan dulu**; dan saat ini
**belum mendukung video** maupun mode kamera WebRTC (baru `<input capture>`).

---

## 1. Target adopsi (apa yang harus dipenuhi central)

| # | Target | Kebutuhan baru di central |
|---|---|---|
| T1 | Semua fitur foto → central | Konsolidasi config, dukungan semua channel, penyimpanan umum (tak terikat `layanan`) |
| T2 | Absensi langsung foto (**Web RTC**) | Komponen kamera getUserMedia → blob/File → `addFiles()` |
| T3 | Submit QC teknisi **support video** | MIME `video/*`, batas ukuran, kompresor di-skip utk video, sink Telegram `sendVideo`, penyimpanan |

---

## 2. Arsitektur Central saat ini (state sebenarnya & akurat)

```
3 form layanan (LayananForm, PengeluaranForm, ServiceInput)
  → useCentralUpload(sessionKey)               hooks/useCentralUpload.ts
  → UploadService (singleton)                  lib/upload/upload-service.ts
      ├─ addFiles    → validasi → kompresi → IndexedDB (DB `arlogic-uploads`) + preview
      ├─ recoverSession → IndexedDB (draft/retry)
      ├─ clearSession → IndexedDB + revoke blob URL
      ├─ submit / uploadToSupabase / completeSession / checkStatus / retry   [MATI - tak dipanggil]
      └─ legacyUpload → POST {PROXY_URL}/upload  [Cloudflare Worker] → Telegram → url photos.arlogic.com
  Backing yang TIDAK dipakai (code/mati): /api/upload/session, /complete, /callback,
    /api/upload/session/[id], /[id]/retry; Inngest upload-*; tabel upload_sessions/upload_files/photo_captions/upload_audit_logs
```

Bagian yang **akan dipakai** = **`addFiles`(IndexedDB) + `legacyUpload`(Worker→Telegram)**.
Bagian **dua-fase Supabase benar-benar rusak** (lihat §7.1) → jangan jadikan dasar.

---

## 3. Audit per lapisan

### 3.1 IndexedDB (draft & retry)
- DB `arlogic-uploads`, store `files` (blob) + `metadata`.
- ✅ Recalls by sessionKey; recover on mount; blob URL di-revoke saat remove/clear.
- ⚠️ **Tak ada TTL client-side** — blob tersimpan sampai dihapus manual / server cleanup
  (TTL 24 jam hanya untuk tabel `upload_sessions` yang mati). Risiko IndexedDB quota menumpuk.
- ⚠️ `clearSessionFiles` hapus `key.startsWith(sessionKey)` — risiko tabrak SANGAT RENDAH
  (key = userId+timestamp), dicatat saja.
- 🔴 **Untuk video ukuran besar (> 20–50MB) persisten di IndexedDB** → boros quota & draft
  recovery lambat. Perlu TTL dan batas total per-session untuk video.

### 3.2 Validasi & Kompresi
- `allowedTypes` (upload-config): **image only** — jpeg/png/webp/heic/heif.
  `isAllowedFile`/`isAllowedMime` menolak video. (Video = gap §6.)
- Kompresi: `compressToTarget` (1MB, q .92→.72, HEIC→JPEG) solid untuk foto.
- ⚠️ Naming terbalik `validateCorrupted` (resolve `true` kala **valid**), fungsi benar.

### 3.3 Transmisi `legacyUpload`
- Urutan: resolve chat_id (`/api/telegram/chat-id?type&branch`) → POST berulang
  FormData ke Worker `/upload` (timeout 120s) → hasil `{url, chat_id, message_id, file_id}`.
- ✅ Branch awar per cabang via `getChannel(type, code)` — semua 12 fitur terpetakan `CHANNELS`
  (attendance, service, layanan, inventory, stock_transfer, kaspin, teknisi_update, qc_update, closing...).
- ⚠️ Fire-and-forget di form (tidak di-await) → fenomena transaksi tanpa foto bila tab tertutup.
- ⚠️ **Tanpa CSRF/rate-limit di worker** (sudah ditambah validasi dasar 20/15MB/MIME; rate-limit menyusul).
- ⚠️ Jika `NEXT_PUBLIC_PHOTO_PROXY_URL` tak disetel → url kosong → `Throw 'Upload gagal'` (edge).

### 3.4 Cloudflare Worker `/upload` + `/photos/:id`
- `/photos/:id` proxy dari Telegram `getFile` (+ cache 7 hari). ✅
- `/upload` kirim ke Telegram via `sendPhoto`/`sendMediaGroup`. **Image only** — belum `sendVideo`.
- Patched baru (pass ini): validasi ≤20 file, ≤15MB/file, MIME image.

### 3.5 Storage URL & status
- URL akhir disimpan di kolom `photo_url(s)` (`layanan`) / `service_documentation.photo_url` /
  store masing-masing. Tergantung kemurahan Telegram file (bisa purge).
- **Ketidakkonsisten kolom status**: `upload_status` (LayananForm) vs `photo_status`
  (PengeluaranForm) — sudah di-reconcile cron; namun UI lain masing punya kolom sendiri.

### 3.6 Konfigurasi
- **Dua config** (`uploadConfig` vs `uploadServiceConfig`) saling bertolak (10 vs 20 file, kompresi).
  Untuk jadian tunggal harus **disatukan** (hapus satu).
- Env non-NEXT_PUBLIC tak terbawa ke client (config client selalu default).

---

## 4. Gap analisis — target adopsi

### 4.1 T1 — Semua 12 fitur → central
Injeksi domain layanan (submit) terikat ke bentuk "transaksi layanan." Fitur lain (attendance/QC/inventory)
wajib menulis ke **store berbeda** — yang central (index) tidak tahu bentuknya. Karena seluruh fitur
central kini memanggil `legacyUpload(files, type)` langsung (tidak lewat `submit`), ini **kompatibel**:
`type` tiap fitur sudah terbangkin di `CHANNELS`. Yang perlu disatukan: **konfigurasi**, **state
kecil fitur (attendance = 1 foto instan, bukan form transaksi)** — komponen `CentralUploader` harus
mendukung mode **quick/single** (tanpa transactional flow). Dan penyimpanan hasil `photo_url(s)`
per-store tetap di handle komponen masing-masing.

### 4.2 T2 — Absensi foto via **Web**
Sekarang central memakai `<input capture="environment">`. **WebRTC** (getUserMedia+stream preview +
`MediaCapture/takePhoto`) belum ada. Desain yang dibutuhkan:
- Komponen `AbsensiCamera`: `navigator.mediaDevices.getUserMedia({video})` → preview life →
  `canvas.captureStream`/`canvas.toBlob` → `addFiles([File])` central + auto `legacyUpload`.
- Fallback emulator (kualitas, `facingMode`), hentikan stream saat unmount.
- Integrasi IndexedDB + validasi via `addFiles` (file WebRTC = `image/jpeg/png` → lolos).

### 4.3 T3 — Video untuk Submit QC teknisi
Central **belum bisa video**. Yang harus diaktifkan:
1. **MIME** tambah `video/mp4`, `video/quicktime`, `video/webm`, `video/3gpp` di `UPLOAD_ALLOWED_TYPES`.
2. **`validateFiles`/`isAllowedFile`** lewati video (ukuran: per-file **≤50 MB** Telegram bot; `maxSizeMB`
   per modul naik utk video; batas `maxFiles` tetap). `validateCorrupted` (image) **harus di-skip** utk video.
3. **Kompresor**: `compress/generator` & `compressToTarget` → **jangan dipakai utk video** (canvas image-only).
   Upload video harus virus-kan/passthrough.
4. **Worker `/upload`**: kirim video via Telegram **`sendVideo`** (single) / `sendMediaGroup` (campuran
   foto+video) — perlu cabang MIME; ambang 50MB; caption.
5. **Index array splitIndex**: video tidak perlu preview canvas (lihat miniaturnya opsional).
6. **Storage**: diff video ke URL `photos.arlogic.com/photos/{file_id}` tetap berlaku (proxy getFile).

---

## 5. Bug fundamental yang harus diperbaiki SEBELUM adopsi

### 🔴 5.1 Dua-fase Supabase = gagal total (jangan dipakai)
- `supabase_path` tidak pernah disimpan (`upload-repository.ts:34-49`; `session/route.ts:75-86`
  membuang `path`).
- `callback` tak dipanggil (client `uploadToSupabase` PUT tanpa status).
- Worker jadi `FAILED 'No Supabase path'` utk semua file (`upload-worker.ts:74-80`).
→ Jika berdiskusi pakai jalur 2-fase: **rewrite** persisten path + panggil callback + auth.

### 🔴 5.2 Video dan ukuran batas
- Validator & worker menolak video; per-file max 15MB (terlalu kecil utk video). Harus di kustom per tipe.

### 🟠 5.3 IndexedDB
- Tanpa TTL client & tanpa batas utk video. Perlu politik onboarding & batas per-session.

### 🟠 5.4 Keamanan
- `/api/upload/complete` tanpa rate-limit; `/api/upload/callback` tanpa CSRF & rate-limit;
  `upload` bucket dibuat public. Worker tanpa rate-limit origin.

### 🟡 5.5 Maintainability
- Naming terbalik `validateCorrupted`; dua config; fire-and-forget; `retryPhotoUpload`+`submit/uploadToSupabase/completeSession` mati.

---

## 6. Rencana implementasi terurut (rekomendasi)

1. **Luruskan fondasi central**:
   - Perbaiki/disable jalur 2-fase Supabase; pertahankan `legacyUpload`+IndexDB.
   - Satukan ke **satu config `uploadServiceConfig`**; tambah parameter MIME video opsional.
2. **Aktifkan video** (untuk QC):
   - `UPLOAD_ALLOWED_TYPES` + video; skip kompresi/validateCorrupted utk video; batas per-file 50 MB utk video.
   - Tambah `sendVideo`/`sendMediaGroup(video)` di Worker + kembali limit 20 file / 50MB video.
3. **Absensi WebRTC** (untuk T2):
   - New `AbsensiCamera` component (getUserMedia + capture + Feed `addFiles`).
4. **Restrukturisasi migrasi seluruh fitur ke central** (T1):
   - Pemetaan per fitur utama `type` → central `legacyUpload`; migrasi satu per satu.
5. **Keamanan**: rate-limit + origin whitelist di Worker; tutup session/callback 2-fase bila tak dipakai.

---

## Lampiran — Perubahan sudah dilakukan (pass sebelumnya)
| File | Perubahan |
|---|---|
| `app/api/cron/reconcile-photo-uploads/route.ts` | Reconcile kolom `photo_status` & `upload_status`, tandai keduanya failed |
| `vercel.json` | Cron `*/15 * * * *` utk reconcile-photo-uploads |
| `workers/photo-proxy/src/index.ts` | Validasi ≤20 file, ≤15MB/file, MIME image |

Referensi kunci: `hooks/useCentralUpload.ts`, `lib/upload/{upload-service,upload-config,upload-validator,upload-compressor,indexeddb-storage}.ts`,
`components/ui/CentralUploader.tsx`, `workers/photo-proxy/src/index.ts`, `app/api/telegram/chat-id/route.ts`,
`app/api/cron/reconcile-photo-uploads/route.ts`.