# Laporan Lengkap — Sistem Central Upload

**Tanggal laporan**: 11 Agustus 2026
**Status verifikasi**: Berbasis pembacaan langsung kode sumber (bukan asumsi), mencakup hook, service, API routes, Cloudflare Worker, Inngest, IndexedDB, konfigurasi, dan 12 fitur konsumen.
**Catatan**: Laporan ini memperbarui dokumen audit lama (`AUDIT_CENTRAL_UPLOAD_2026.md`, `AUDIT_CENTRAL_UPLOAD_DEEP_2026.md`, `UPLOAD_SYSTEM_AUDIT.md`, `UPLOAD_QUICK_REFERENCE.md`) karena kondisi kode sudah banyak berubah sejak dokumen tersebut ditulis.

---

## 1. Ringkasan Eksekutif

Sistem Central Upload adalah **satu-satunya jalur upload foto & video** untuk seluruh fitur aplikasi (12 fitur). Arsitektur utamanya:

```
Komponen Form (12 fitur)
  → useCentralUpload(sessionKey)              [hooks/useCentralUpload.ts]
  → UploadService (singleton)                  [lib/upload/upload-service.ts]
      ├─ addFiles()    → validasi → kompresi → IndexedDB (DB arlogic-uploads)
      ├─ recoverSession() → pemulihan draft/retry dari IndexedDB
      ├─ clearSession()
      └─ legacyUpload() → POST Cloudflare Worker /upload → Telegram → URL photos.arlogic.com/photos/{file_id}
```

Poin penting yang **berubah sejak audit lama**:

| Perubahan | Kondisi lama (audit 6 Agu) | Kondisi sekarang (11 Agu) |
|---|---|---|
| Adopsi central | 3 fitur CENTRAL + 9 LEGACY | **Semua 12 fitur pakai `useCentralUpload`** |
| Dukungan video | Belum ada | **Ada**: MIME video, transcode HEVC→H.264 (ffmpeg.wasm), sendDocument |
| Sistem 2-fase Supabase | Rusak & aktif | **Dinonaktifkan** (flag `UPLOAD_TWO_PHASE_ENABLED=1`, route balas 410) |
| Konfigurasi ganda | `uploadConfig` vs `uploadServiceConfig` bertolak | **Disatukan** — `uploadConfig` kini delegasi ke `uploadServiceConfig` |
| Worker keamanan | CORS `*`, tanpa rate-limit | **Origin whitelist + rate-limit** (in-memory) |
| Cron reconcile | `*/15 * * * *` (tiap 15 menit) | **`15 0 * * *`** (harian 00:15) |
| Hook legacy `useUpload`/`usePhotoUpload` | 9 fitur pakai | **0 konsumen** (mati) |

Kesimpulan: **jalur produksi utama (addFiles + legacyUpload + Worker → Telegram) sehat dan jadi satu-satunya jalur aktif**. Seluruh infrastruktur 2-fase (session/complete/callback, Inngest upload-*, tabel upload_*) sudah dinonaktifkan rapi (tidak dipanggil), bukan lagi risiko aktif.

---

## 2. Arsitektur & Alur Kerja

### 2.1 Alur lengkap (jalur aktif)

```
1. User pilih foto/video  → addFiles()
     ├─ checkDuplicateFiles  (nama + ukuran sama = duplikat)
     ├─ validateFiles        (≤20 file, ≤15MB/foto, ≤50MB/video, ≤100MB total, MIME)
     ├─ validateCorrupted    (foto: load ke <img>; video: di-skip)
     ├─ kompresi             (foto >1MB → compressToTarget 1MB; video → passthrough)
     └─ simpan IndexedDB     (files + metadata, key `{sessionKey}_{id}`) + preview blob URL

2. Submit transaksi (DB dulu — layanan/service/cashdraw)

3. upload.legacyUpload(files, type, caption, timeout, branchCode)  [BACKGROUND, fire-and-forget]
     ├─ GET /api/telegram/chat-id?type=...&branch=...  → resolve chat_id per cabang
     ├─ persistAPlayer video: ensureUploadableVideo() (HEVC→H.264, ≤48MB) — ffmpeg.wasm
     ├─ POST {NEXT_PUBLIC_PHOTO_PROXY_URL}/upload  (FormData: type, chat_id, branch, caption, files)
     │     └─ Cloudflare Worker → Telegram sendPhoto / sendMediaGroup / sendDocument
     └─ hasil: { url: https://photos.arlogic.com/photos/{file_id}, chat_id, message_id, file_id }

4. .then() → simpan url ke kolom foto (photo_urls / service_documentation.photo_url) + status SUCCESS
   → upload.clear() (hapus IndexedDB)

5. Gagal → status FAILED/failed → IndexedDB DIPERTAHANKAN → event "layanan-retry-upload"
   → TransactionManagement buka form edit → recoverSession() → user klik Simpan → ulang dari langkah 3

6. Cron (harian) → layanan macet status pending >30 menit → tandai failed (kedua kolom status)
```

### 2.2 Alur sistem 2-fase Supabase (NONAKTIF)

```sh
UPLOAD_TWO_PHASE_ENABLED=1  # satu-satunya cara mengaktifkan
```
- `POST /api/upload/session` → buat `upload_sessions` + `upload_files` + signed URLs bucket `uploads`
- `PUT {signed_url}` (client) → `POST /api/upload/callback` → `POST /api/upload/complete` → event Inngest `upload.session.queued` → `upload-worker` → Telegram → `upload-cleanup`
- **Tanpa flag**: semua route balas `410 Gone` dengan pesan "Gunakan jalur Telegram (legacyUpload)".
- `app/api/upload/draft`, `/retry`, `/cleanup`, `/status` — **tidak ada route file** (direktori kosong).

---

## 3. Peta File per Lapisan

| Lapisan | File | Tanggung jawab |
|---|---|---|
| Hook | `hooks/useCentralUpload.ts` | State React (pendingFiles, uploading, progress, errors), lifecycle, recover on mount |
| Service | `lib/upload/upload-service.ts` | Inti: addFiles, legacyUpload, recover, clear, submit/uploadToSupabase/completeSession/checkStatus/retry (mati) |
| Validasi | `lib/upload/upload-validator.ts` | validateFiles (jumlah/ukuran/MIME/total), checkDuplicateFiles, validateCorrupted |
| Kompresi | `lib/upload/upload-compressor.ts` | compressToTarget (1MB, q92→72), HEIC/HEIF→JPEG (canvas → heic2any WASM), video passthrough |
| Storage client | `lib/upload/indexeddb-storage.ts` | DB `arlogic-uploads`, store `files` + `metadata` |
| Konfigurasi | `lib/upload/upload-config.ts` | `uploadServiceConfig` + helper (isAllowedFile, isVideoFile, batas ukuran) |
| Tipe | `lib/upload/upload-types.ts` | TypeScript types + `UPLOAD_EVENTS` |
| Utilitas | `lib/upload/upload-utils.ts` | generateId, blob URL, formatter |
| Config legacy | `lib/uploadConfig.ts` | Wrapper kompatibilitas → delegasi ke `uploadServiceConfig` |
| Repository 2-fase | `lib/upload/upload-repository.ts` | CRUD `upload_sessions`, `upload_files`, `photo_captions`, `upload_audit_logs` (dormant) |
| Storage 2-fase | `lib/upload/upload-storage.ts` | Bucket `uploads` (public), signed URL (dormant) |
| Queue Inngest | `lib/upload/upload-queue.ts` | Event SESSION_QUEUED / RETRY_STARTED / CLEANUP_STARTED (dormant) |
| Barrel | `lib/upload/index.ts` | Re-export publik |
| Transcode video | `lib/video/transcode.ts` | `ensureUploadableVideo` — HEVC→H.264, ≤48MB output, progress |
| Telegram helper | `lib/telegram.ts` | `uploadMultipleToTelegram`, `getChannel` (per-cabang), retry 429/backoff |
| Worker | `workers/photo-proxy/src/index.ts` | POST /upload + GET /photos/:file_id |
| Route legacy | `app/api/upload/route.ts` | Multipart Vercel (sharp server-compress) — **tanpa konsumen (mati)** |
| Routes 2-fase | `app/api/upload/{session,complete,callback}` + `session/[id]` + `session/[id]/retry` | **Nonaktif** (410) |
| Chat-id | `app/api/telegram/chat-id/route.ts` | Resolve chat per type + branch |
| Cron | `app/api/cron/reconcile-photo-uploads/route.ts` | Reconcile status macet (harian 00:15) |
| Photo retrieval | `app/api/photos/[id]/route.ts` | Fallback proxy server-side (cadangan Worker) |
| Inngest | `inngest/functions/upload-{worker,retry,cleanup}.ts` | Worker 2-fase — **idle** (event tidak pernah dikirim tanpa flag) |

---

## 4. Cloudflare Worker (`workers/photo-proxy`)

### 4.1 POST /upload (jalur produksi utama)

Urutan penanganan:

1. **Method check** → hanya POST; OPTIONS untuk preflight.
2. **CORS origin whitelist** — `ALLOWED_ORIGINS` (env) atau default:
   `https://arlogic-web-services.vercel.app`, `https://arlogic.com`, `https://www.arlogic.com`, `http://localhost:3000`, `http://localhost:3001`. Origin tidak terdaftar → `403`.
3. **Rate limit** (in-memory sliding window per IP `CF-Connecting-IP`):
   - `RATE_LIMIT_MAX` (default **30** request/window)
   - `RATE_LIMIT_WINDOW_SEC` (default **60** detik)
   - Melanggar → `429` + header `Retry-After`.
4. **Guardrail file**:
   - ≤ `MAX_FILES` = **20 file**
   - Gambar ≤ `MAX_IMG_BYTES` = **10 MB**
   - Video ≤ `MAX_VIDEO_BYTES` = **50 MB**
   - Tipe: image (jpg/jpeg/png/webp/heic/heif/avif) atau video (mp4/mov/webm/3gp/3gpp/avi)
5. **Channel**: `chat_id` dari client (hasil resolve server) → env `TELEGRAM_CHANNEL_{TYPE}` → default `DEFAULT_CHANNELS` → fallback `@arlogic_layanan`.
6. **Kirim ke Telegram**:
   - **1 file foto** → `sendPhoto`
   - **1 file video** → `sendDocument` (komentar kode: sengaja bukan `sendVideo` karena Telegram re-encode → kualitas rusak; document menyimpan file asli dan tetap playable via proxy)
   - **banyak file** → `sendMediaGroup` per **10 file** (batas album Telegram); video sebagai `"type":"document"`
   - **Album gagal** (mis. `IMAGE_PROCESS_FAILED` pada 1 foto) → fallback kirim **per-file** agar satu foto bermasalah tidak menggagalkan batch
7. **Respons**: `{ success, urls[], file_ids[], messages[], count, storage: "cloudflare-worker" }`.

### 4.2 GET /photos/:file_id (proxy serve foto/video)

- `getFile` dari Telegram → download `file/bot{token}/{file_path}`
- **Cache** `caches.default` 7 hari (`Cache-Control: public, max-age=604800`) — di-skip bila header `Range`
- **MIME akurat**: deteksi dari ekstensi path Telegram, lalu fallback **sniffing magic bytes** (ftyp→mp4/qt, EBML→webm, JPEG/PNG/WebP signature). Mencegah video didefault ke `image/jpeg` (tidak bisa diputar).
- **Range request** (video): dukung `Range: bytes=...` → `206 Partial Content` dengan `Content-Range`, `Accept-Ranges: bytes`, batas `416`.

---

## 5. Dukungan Video (fitur baru sejak audit)

| Aspek | Implementasi |
|---|---|
| MIME diizinkan | `video/mp4, video/quicktime, video/webm, video/3gpp` (config + validator). Deteksi ganda: `file.type` + ekstensi nama |
| Batas ukuran | Client ≤ **50 MB** per video (`maxVideoSizeMB`); Worker ≤ 50 MB; input transcode ≤ 120 MB |
| Transcode | `ensureUploadableVideo` (`lib/video/transcode.ts`): HEVC/H.265 (iPhone) → H.264 via ffmpeg.wasm; H.264 >48MB → re-encode; ≤48MB H.264/WebM tidak disentuh. Profil turun bertahap, ada callback progress. |
| Pengiriman | Worker `sendDocument` (kualitas asli) untuk 1 video; `"type":"document"` dalam `sendMediaGroup` untuk campuran |
| Validasi korup | `validateCorrupted` **di-skip** untuk video (hanya image) |
| Kompresi | Foto >1MB dikompres; **video tidak pernah dikompres** (passthrough) |
| Playback | Proxy mendukung Range request (206) + MIME sniffing → video bisa diputar/scrub di browser |

---

## 6. API Routes

| Route | Status | Keamanan | Catatan |
|---|---|---|---|
| `POST /api/upload` (legacy Vercel) | Ada, **tanpa konsumen** | CSRF origin + rate-limit IP + batas body + sharp compress >2MB server | Hanya `useUpload`/`usePhotoUpload` yang memanggil — kedua hook mati. **Siap dihapus** |
| `POST /api/upload/session` | **410 nonaktif** | CSRF + rate-limit | Butuh flag `UPLOAD_TWO_PHASE_ENABLED=1` |
| `POST /api/upload/complete` | **410 nonaktif** | CSRF (tanpa rate-limit) | Trigger Inngest + cleanup |
| `POST /api/upload/callback` | **410 nonaktif** | Tanpa CSRF & rate-limit | Ubah status file per-file |
| `GET /api/upload/session/[id]` | **410 nonaktif** | — | Detail session + files |
| `POST /api/upload/session/[id]/retry` | **410 nonaktif** | — | Retry session FAILED |
| `GET /api/telegram/chat-id` | **Aktif** | — | `?type=` + `?branch=` → chat_id |
| `GET /api/cron/reconcile-photo-uploads` | **Aktif** | `x-vercel-cron` / `?secret=` / `Bearer` | Harian 00:15 (vercel.json) |

> Endpoint `upload/draft`, `upload/retry`, `upload/cleanup`, `upload/status`, `upload/async` — **tidak ada implementasi** (direktori kosong).

---

## 7. Dua Belas Fitur Konsumen (semua pakai `useCentralUpload`)

| # | Fitur | Komponen | Tipe channel | Pola |
|---|---|---|---|---|
| 1 | Transaksi Layanan | `components/layanan/LayananForm.tsx` | `layanan` | addFiles → legacyUpload → retry event |
| 2 | Pengeluaran | `components/layanan/PengeluaranForm.tsx` | `layanan` | addFiles → legacyUpload → retry event |
| 3 | Service Order (admin) + foto DP | `components/admin/ServiceInput.tsx` | `service` / `layanan` | addFiles → legacyUpload (`service` + DP via `layanan`) |
| 4 | Cashdraw | `components/layanan/CashdrawForm.tsx` | `layanan` | addFiles → session key → retry event |
| 5 | Inventory / Stok | `components/admin/InventoryManagement.tsx` | `inventory` | addFiles → legacyUpload |
| 6 | Absensi | `components/teknisi/AttendanceModal.tsx` | `attendance` | legacyUpload |
| 7 | Submit QC | `components/teknisi/SubmitQCModal.tsx` | `qc_update` | legacyUpload |
| 8 | Antrian QC | `components/teknisi/QueueList.tsx` | `qc_update` | legacyUpload |
| 9 | Update Kaspin | `components/teknisi/KaspinUpdate.tsx` | `kaspin` | legacyUpload |
| 10 | Sparepart Ready | `components/admin/SparepartReadyModal.tsx` | `service` | legacyUpload |
| 11 | Timeline Teknisi | `components/teknisi/ServiceTimeline.tsx` | `teknisi_update` | addFiles → legacyUpload (1 foto) |
| 12 | Update Progres | `components/teknisi/ProgressUpdate.tsx` | `teknisi_update` | addFiles → legacyUpload |

**Retry flow** (fitur 1, 2, 4): transaksi tersimpan dulu (DB), foto menyusul background. Gagal → IndexedDB dipertahankan + dispatch `layanan-retry-upload` → `TransactionManagement` membuka form edit → `recoverSession()` → user klik Simpan.

---

## 8. Konfigurasi & Environment

### 8.1 `uploadServiceConfig` (`lib/upload/upload-config.ts`)

| Key | Default | Env override |
|---|---|---|
| `maxFiles` | 20 | `UPLOAD_MAX_FILES` |
| `maxSizeMB` (foto) | 15 | `UPLOAD_MAX_SIZE_MB` |
| `maxVideoSizeMB` | 50 | `UPLOAD_MAX_VIDEO_SIZE_MB` |
| `maxTotalSizeMB` | 100 | `UPLOAD_MAX_TOTAL_SIZE_MB` |
| `compressTargetKB` | 1024 | `UPLOAD_COMPRESS_TARGET_KB` |
| `compressQuality` | 80 | `UPLOAD_COMPRESS_QUALITY` |
| `compressMaxDimension` | 1920 | `UPLOAD_COMPRESS_MAX_DIM` |
| `allowedTypes` | jpeg/png/webp/heic/heif + 4 video | `UPLOAD_ALLOWED_TYPES` |
| `telegramRetryCount` | 3 | `UPLOAD_TELEGRAM_RETRY` |

### 8.2 Worker (`workers/photo-proxy`)

| Env | Keterangan |
|---|---|
| `TELEGRAM_BOT_TOKEN` | Wajib |
| `TELEGRAM_CHANNEL_*` | Fallback channel per tipe |
| `ALLOWED_ORIGINS` | Whitelist origin (koma) — mengalahkan default |
| `RATE_LIMIT_MAX` | default 30 |
| `RATE_LIMIT_WINDOW_SEC` | default 60 |

### 8.3 Vercel / App

- `NEXT_PUBLIC_PHOTO_PROXY_URL` — base URL Worker (dipakai legacyUpload)
- `PHOTO_PROXY_DOMAIN` — domain serve foto (default `https://photos.arlogic.com`)
- `TELEGRAM_CHANNEL_{TYPE}_{KODE_CABANG}` — channel per cabang (prioritas di atas global)
- `CRON_SECRET` — otorisasi cron
- `UPLOAD_TWO_PHASE_ENABLED=1` — **khusus** mengaktifkan sistem 2-fase (default nonaktif)

---

## 9. Skema Database Terkait

| Tabel | Status | Kolom penting |
|---|---|---|
| `layanan` | **AKTIF** | `photo_url` (single), `photo_urls` (array), `upload_status` (LayananForm), `photo_status` (PengeluaranForm), `upload_session_key` |
| `service_orders` | AKTIF | foto via `service_documentation` |
| `service_documentation` | AKTIF | `photo_url`, `media_type` |
| `upload_sessions` | DORMANT | (lihat `db/compleated-database.md` §540) |
| `upload_files` | DORMANT | id, session_id, status, supabase_path, telegram_* |
| `photo_captions` | DORMANT | upload_file_id, caption |
| `upload_audit_logs` | DORMANT | session_id, event, status, duration_ms |

---

## 10. Temuan & Risiko

### 🔴 Kritis

1. **Mismatch batas ukuran gambar di Worker** (`workers/photo-proxy/src/index.ts`):
   - Batas aktual: `MAX_IMG_BYTES = 10 MB`
   - Pesan error: `max ... '15MB'`
   - Client melempar foto 11–15 MB (lolos validasi client 15MB) → ditolak Worker dengan pesan menyesatkan "max 15MB".
   - **Perbaikan**: seragamkan — ubah `MAX_IMG_BYTES` ke 15MB (ikuti config client) atau pesan ke 10MB.

### 🟠 Menengah

2. **Fire-and-forget tanpa server-side queue**: transaksi tersimpan lebih dulu, upload foto di background. Tab/browser ditutup sebelum selesai → transaksi tanpa foto (status menggantung). Mitigasi saat ini: event retry manual + cron harian menandai failed. Masih ada kemungkinan foto hilang permanen jika IndexedDB users terhapus.
3. **Debu log debug di produksi**: `useCentralUpload.ts`, `upload-service.ts`, `indexeddb-storage.ts` penuh `console.log('[DEBUG:...]')` pada setiap addFiles/mount/state change — noise di production, biaya bandwidth/observability.
4. **Rate-limit Worker in-memory per-isolate**: tidak global, bisa dilewati dengan membanjiri banyak edge node (tetap jauh lebih baik dari sebelumnya; cukup untuk skala sekarang).
5. **Ketergantungan storage ke Telegram**: URL foto bergantung pada file Telegram yang bisa di-purge (kebijakan penyimpanan file Telegram tidak dijamin selamanya). Tidak ada backup ke Supabase/R2 (jalur 2-fase justru dinonaktifkan).

### 🟡 Minor / Maintainability

6. **`validateCorrupted` nama terbalik** (`upload-validator.ts`): resolve `true` saat gambar **valid** (padahal nama membacanya "corrupted"). Logika benar, nama menyesatkan. Juga ada **timeout 10 detik** per foto — foto lambat-lambat bisa ditolak.
7. **`IndexedDB` tanpa TTL client-side**: blob draft tersimpan sampai di-clear manual/berhasil upload. Quota browser bisa menumpuk (terutama video >20MB).
8. **`clearSessionFiles` pakai `key.startsWith(sessionId)`**: risiko tabrakan key sangat rendah (key = userId+timestamp), dicatat sebagai edge.
9. **Konsistensi kolom status**: `upload_status` (Layanan) vs `photo_status` (Pengeluaran) — diseragamkan hanya oleh cron; UI lain membaca kolom masing-masing.
10. **Penghapusan bucket**: `upload-storage.ts` membuat bucket `uploads` public bila 2-fase diaktifkan — dormant, tetapi tetap dokumentasi risiko bila flag nyala.
11. **Kode mati**: `CentralUploader.tsx`, `PhotoUploader.tsx.bak`, hook `useUpload.ts`/`usePhotoUpload.ts` (0 konsumen), entitas 2-fase (repo/storage/queue/Inngest/tabel) — terpelihara namun tidak dieksekusi. Session route 2-fase tetap tidak menyimpan `supabase_path` (bug audit lama masih ada di kode dormant).

---

## 11. Keamanan

| # | Temuan | Status | Severity |
|---|---|---|---|
| K1 | Worker `/upload`: origin whitelist + rate-limit + guardrail ukuran/MIME | **FIXED** (sejak audit) | — |
| K2 | Worker `/photos/:file_id`: CORS `*` (baca publik) — wajar untuk foto publik; tanpa rate-limit di sisi proxy | Diterima (cache 7d meringankan) | Low |
| K3 | `/api/upload` legacy: CSRF + rate-limit + batas body | OK (tanpa konsumen) | — |
| K4 | Routes 2-fase (`session/complete/callback`): callback tanpa CSRF/rate-limit, session tanpa auth (`created_by`/`transaction_id` spoofable) | **Nonaktif (410)** — risiko hanya jika flag dinyalakan | High hanya bila aktif |
| K5 | Bucket `uploads` dibuat `public: true` saat 2-fase diaktifkan | Dormant | Medium jika aktif |
| K6 | Worker rate-limit in-memory (per-isolate, bukan global) | Diterima | Low |

---

## 12. Rekomendasi

**Prioritas tinggi**
1. Seragamkan batas gambar Worker dengan config client (10MB vs 15MB + pesan error) — lihat temuan 🔴1.
2. Hapus `console.log('[DEBUG:...]')` dari hook/service/IndexedDB (atau bungkus dengan guard `NODE_ENV !== 'production'`).
3. Pertimbangkan server-side queue untuk re-upload foto gagal (Inngest sudah tersedia; reuse untuk jalur aktif, jangan fire-and-forget murni).

**Prioritas sedang**
4. TTL client-side untuk IndexedDB (hapus draft > N hari) + batas total per-session untuk video.
5. Rename `validateCorrupted` → `isImageLoadable` (atau setara) dan turunkan timeout 10s.
6. Backup jangka panjang: pertimbangkan duplikasi ke R2/object storage untuk foto kritis (protect dari purge Telegram).

**Prioritas rendah**
7. Bersihkan kode mati: `CentralUploader.tsx`, `PhotoUploader.tsx.bak`, `useUpload.ts`, `usePhotoUpload.ts`, komponen 2-fase (`upload-repository`, `upload-storage`, `upload-queue`, Inngest `upload-*`, tabel `upload_*`), route `/api/upload` legacy — setelah verifikasi tidak ada referensi tersisa.
8. Dokumentasi ini: pertahankan sebagai satu sumber kebenaran; tandai doc lama sebagai superseded.

---

## 13. Referensi File Kunci

```
hooks/useCentralUpload.ts
lib/upload/{upload-service,upload-config,upload-validator,upload-compressor,indexeddb-storage,upload-types,upload-utils,upload-events,upload-queue,upload-repository,upload-storage,index}.ts
lib/uploadConfig.ts
lib/video/transcode.ts
lib/telegram.ts
workers/photo-proxy/src/index.ts
workers/photo-proxy/wrangler.toml
app/api/upload/route.ts
app/api/upload/session/route.ts
app/api/upload/complete/route.ts
app/api/upload/callback/route.ts
app/api/upload/session/[id]/route.ts
app/api/upload/session/[id]/retry/route.ts
app/api/telegram/chat-id/route.ts
app/api/cron/reconcile-photo-uploads/route.ts
app/api/cron/keepalive/route.ts
app/api/photos/[id]/route.ts
inngest/functions/upload-worker.ts
inngest/functions/upload-retry.ts
inngest/functions/upload-cleanup.ts
vercel.json
.env (TELEGRAM_*, NEXT_PUBLIC_PHOTO_PROXY_URL, PHOTO_PROXY_DOMAIN, CRON_SECRET)
db/compleated-database.md (schema upload_sessions/upload_files)
```