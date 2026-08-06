# Audit Central Upload + Inventaris Strategy Upload Foto

**Tanggal**: 6 Agustus 2026
**Dasar**: verifikasi menyeluruh kode (hooks, komponen, API routes, worker, Inngest, IndexedDB, Supabase)

---

## Bagian A — Inventaris Fitur Upload Foto per Strategy

### A.1 Definisi strategy

| Strategy | Hook | Endpoint transmisi | Storage akhir | Kompresi |
|---|---|---|---|---|
| **CENTRAL** | `useCentralUpload` (`hooks/useCentralUpload.ts` + `lib/upload/*`) | `POST {NEXT_PUBLIC_PHOTO_PROXY_URL}/upload` (Cloudflare Worker) via `uploadService.legacyUpload()` | Telegram → Cloudflare proxy | client-side `compressToTarget` (target 1 MB, HEIC→JPEG) |
| **LEGACY** | `useUpload` / `usePhotoUpload` | `POST /api/upload` (Vercel) | Telegram → Cloudflare proxy | client canvas `compressImage` + server `sharp` (>2 MB) |

> Kedua strategy **ujung ke Telegram** dan menyimpan URL `https://photos.arlogic.com/photos/{file_id}`.
> Perbedaan strategis: CENTRAL menyimpan file sementara di **IndexedDB** (draft + retry recovery) dan
> transmisi **langsung ke Worker** (hindari bandwidth Vercel); LEGACY melewati **`/api/upload` Vercel**
> yang punya CSRF + rate-limit + kompresi sharp server.

### A.2 Fitur yang PAKAI CENTRAL — 3 fitur

| # | Fitur | Komponen | Channel | Penyimpanan DB |
|---|---|---|---|---|
| 1 | Transaksi Layanan | `components/layanan/LayananForm.tsx` | `layanan` | `photo_urls` + `upload_status` |
| 2 | Pengeluaran | `components/layanan/PengeluaranForm.tsx` | `layanan` | `photo_urls` + `photo_status` |
| 3 | Input Service Order (admin) + foto DP | `components/admin/ServiceInput.tsx` | `service` / `layanan` | `service_documentation.photo_url` |

### A.3 Fitur yang PAKAI LEGACY — 9 fitur

**Via `usePhotoUpload` (4):**
| # | Fitur | Komponen | Channel |
|---|---|---|---|
| 4 | Submit QC | `components/teknisi/SubmitQCModal.tsx` | `qc_update` |
| 5 | Antrian QC | `components/teknisi/QueueList.tsx` | `qc_update` |
| 6 | Update Kaspin | `components/teknisi/KaspinUpdate.tsx` | `kaspin` |
| 7 | Sparepart Ready | `components/admin/SparepartReadyModal.tsx` | `service` |

**Via `useUpload` (5):**
| # | Fitur | Komponen | Channel |
|---|---|---|---|
| 8 | Cashdraw | `components/layanan/CashdrawForm.tsx` | `layanan` |
| 9 | Inventory / Stok | `components/admin/InventoryManagement.tsx` | `inventory` |
| 10 | Absensi | `components/teknisi/AttendanceModal.tsx` | `attendance` |
| 11 | Timeline Teknisi | `components/teknisi/ServiceTimeline.tsx` | `teknisi_update` |
| 12 | Update Progres | `components/teknisi/ProgressUpdate.tsx` | `teknisi_update` |

### A.4 Komponen UI upload yang MATI (tidak diimpor siapa pun)
- `components/ui/PhotoUploader.tsx` — wrapper `usePhotoUpload`
- `components/ui/CentralUploader.tsx` — UI central (tidak dipakai satu komponen pun)

### A.5 Bukan fitur upload foto (false positive)
`AttendanceReport.tsx` (CSV), `ImportBarangModal.tsx` (Excel), `CustomerList.tsx`, `LayananList.tsx` (view), `QueueList.tsx.bak`.

**TOTAL: 12 fitur upload foto aktif = 3 CENTRAL + 9 LEGACY.**

---

## Bagian B — Audit Mendalam: Sistem Central Upload

### B.1 Peta komponen central upload

```
UI 3 fitur (LayananForm, PengeluaranForm, ServiceInput)
  → useCentralUpload(sessionKey)                  [hooks/useCentralUpload.ts]
  → UploadService (singleton)                     [lib/upload/upload-service.ts]
      ├─ addFiles()        → validate → compress → IndexedDB (arlogic-uploads)
      ├─ recoverSession()  → IndexedDB (draft/retry)
      ├─ clearSession()
      ├─ legacyUpload()    → POST Worker /upload → Telegram → url photos.arlogic.com
      ├─ submit/uploadToSupabase/completeSession/checkStatus/retry   [TIDAK DIPAKAI]
      └─ retryPhotoUpload()                                          [TIDAK DIPAKAI]
  API yang ada tapi TIDAK dipanggil komponen mana pun:
      /api/upload/session, /api/upload/complete, /api/upload/callback,
      /api/upload/session/[id], /api/upload/session/[id]/retry
  Inngest: upload-worker, upload-retry, upload-cleanup   [idle]
  Supabase: upload_sessions, upload_files, photo_captions, upload_audit_logs   [idle]
```

### B.2 Alur central yang BENAR-BENAR berjalan (3 fitur)

```
1. User pilih foto → addFiles() → validasi (20 file, 15 MB, MIME, duplikat, corrupt)
2. Kompresi → IndexedDB (files + meta) + preview blob URL
3. Submit transaksi (DB dulu) → status PENDING/UPLOADING (kolom beda per form)
4. upload.legacyUpload() DI-BACKGROUND (fire-and-forget, tidak di-await)
   → chat_id via /api/telegram/chat-id → POST Worker /upload → Telegram → file_id
5. .then() → update photo_urls + chat_id/message_id + status SUCCESS/completed → clear IndexedDB
   Gagal → status FAILED/failed + simpan IndexedDB untuk retry + event "layanan-retry-upload"
6. Retry: TransactionManagement buka form edit dengan upload_session_key lama
   → useCentralUpload auto-recover dari IndexedDB → user klik Simpan → ulang dari langkah 3
```

### B.3 Temuan: FLOW BENAR-TIDAKNYA

#### 🟢 Benar & sudah aman
- Guard double-submit ada di ketiga form (`submittingRef` — LayananForm:552, PengeluaranForm:247).
- Draft recovery IndexedDB berfungsi (recover pada mount, `useCentralUpload.ts:390-409`).
- Compress target 1 MB dengan degradasi kualitas bertahap (`compressToTarget`) — kualitas terjaga.
- HEIC→JPEG dua jalur (Canvas Safari → heic2any WASM) dengan yield agar UI tidak freeze.
- Retry mempertahankan IndexedDB (tidak di-clear saat gagal) dan event retry menghidupkan ulang form.
- (Pass ini) Cron reconcile kini menandai kedua kolom status → transaksi macet tidak menggantung.

#### 🔴 BUG KRITIS — "Central Upload" Supabase 2-fase TIDAK BISA BEKERJA, bahkan jika dihubungkan
Sistem yang didokumentasikan (`submit → /api/upload/session → PUT signed URL → complete → Inngest → Telegram`)
memiliki rantai yang putus di tengah:

1. **`supabase_path` tidak pernah tersimpan.** `createUploadFiles` (`upload-repository.ts:34-49`)
   membuat baris `upload_files` **tanpa `supabase_path`**. Route `/api/upload/session`
   (`session/route.ts:75-86`) menghasilkan signed URL tetapi **membuang `path`** (hanya
   mengembalikan `signed_url` + `public_url`).
2. **Callback tidak pernah dipanggil.** `UploadService.uploadToSupabase()` (`upload-service.ts:271-311`)
   langsung PUT ke signed URL dan **tidak pernah** memanggil `/api/upload/callback`. Sekalipun
   dipanggil, `callback/route.ts` hanya mengubah `status` — **tidak menulis `supabase_path`**.
3. **Worker selalu gagal.** `inngest/functions/upload-worker.ts:74-80`:
   ```ts
   if (!file.supabase_path) { updateFile(...FAILED, 'No Supabase path'); continue }
   ```
   Karena `supabase_path` selalu NULL → **setiap file di-mark FAILED**, session FAILED,
   retry 5× → hasil sama. **Pipeline dua-fase ini gagal total secara desain.**

Kesimpulan: **flownya TIDAK benar** — sistem yang didokumentasikan sebagai "central" tidak pernah
berfungsi, dan untungnya tidak pernah dipanggil komponen mana pun (kode mati). Yang dipakai justru
`legacyUpload` yang sehat.

#### 🟠 BUG MENENGAH — jalur transmisi yang dipakai (legacyUpload dalam hook central)
1. **Fire-and-forget tanpa server-side queue** (LayananForm:768, PengeluaranForm:432).
   Transaksi tersimpan dulu, foto menyusul di background. Jika browser/tab ditutup sebelum selesai
   → transaksi tanpa foto + status menggantung (kini ter-reconcile cron, tetapi foto tetap hilang
   sampai user buka form & retry manual).
2. **Tanpa CSRF/rate-limit** di Worker (langsung dari client). Sudah ditambal validasi dasar
   (≤20 file, ≤15 MB, MIME); rate-limit & origin check masih rekomendasi.
3. **Kolom status beda antar form** (Layanan `upload_status`, Pengeluaran `photo_status`)
   → sudah diseragamkan sisi cron.

#### 🟡 MINOR / MAINTAINABILITY
- `validateCorrupted()` (`upload-validator.ts:73-94`) namanya TERBALIK: resolve `true` saat gambar
  **valid** ("isCorrupted = true" = sebenarnya "isValid"). Logika jalan benar, nama menyesatkan.
- `uploadServiceConfig` di-env server; di client non-NEXT_PUBLIC env tak tersedia → fallback default.
  Asimetri client/server pada nilai config yang sama.
- `clearSessionFiles` (`indexeddb-storage.ts:70-88`) hapus dengan `key.startsWith(sessionId)` —
  risiko tabrakan sangat rendah (key berisi userId+timestamp), dicatat sebagai edge.
- `UploadType` skema `/api/upload` tidak menerima `closing/stock_transfer/sparepart_ready`
  (fallback ke `service`) — hanya relevan jalur LEGACY.

### B.4 Temuan Keamanan (central)

| # | Temuan | File | Severity |
|---|---|---|---|
| S1 | `/api/upload/session` tanpa auth; `created_by` & `transaction_id` spoofable (hanya CSRF origin + rate-limit IP) | `session/route.ts` | High |
| S2 | `/api/upload/complete` tanpa rate-limit (hanya CSRF) → bisa memicu event Inngest berulang | `complete/route.ts` | Medium |
| S3 | `/api/upload/callback` **tanpa CSRF & tanpa rate-limit** → siapa pun bisa menandai file SUCCESS/FAILED | `callback/route.ts` | High |
| S4 | Bucket Supabase `uploads` dibuat `public: true` (`upload-storage.ts:52`) → bila dua-fase dipakai, semua foto world-readable | `upload-storage.ts` | Medium |
| S5 | Worker /upload: CORS `*` + origin dipantulkan, tanpa rate-limit (validasi baru = dasar saja) | `workers/photo-proxy/src/index.ts` | Medium |

### B.5 Metode central yang MATI (tidak ada konsumen)

`submit()`, `uploadToSupabase()`, `completeSession()`, `checkSessionStatus()`, `retry()` di
`UploadService`/`useCentralUpload`, serta `retryPhotoUpload()` — **0 pemanggil** di seluruh
`components/`. Seluruh infrastruktur pendukungnya (repo, storage, queue, Inngest, 5 route) = bloat.

### B.6 Rekomendasi (prioritas)

1. **Hapus/disable sistem dua-fase Supabase** (route session/complete/callback, `upload-storage`,
   `upload-queue`, Inngest `upload-*`, tabel upload_*). Bila ingin dipertahankan: perbaiki
   persistensi `supabase_path` + panggil callback + tambah auth — besar, tidak sebanding.
2. **Beri rate-limit + origin whitelist** di Worker `/upload` (jalur produksi utama Layanan).
3. **Pertimbangkan server-side queue** untuk legacyUpload (Inngest sudah ada — reuse untuk
   re-upload foto yang gagal di background, tidak fire-and-forget murni).
4. **Satukan config** upload (hapus salah satu dari `uploadConfig` vs `uploadServiceConfig`).
5. Rename `validateCorrupted` → `isImageLoadable` (atau sejenis) agar tidak menyesatkan.
6. Hapus komponen mati: `PhotoUploader.tsx`, `CentralUploader.tsx` (setelah verifikasi).

---

## Lampiran — Perubahan yang sudah diaplikasikan (pass sebelumnya)

| File | Perubahan |
|---|---|
| `app/api/cron/reconcile-photo-uploads/route.ts` | Reconcile kolom `photo_status` DAN `upload_status`; tandai keduanya failed |
| `vercel.json` | Cron `*/15 * * * *` untuk reconcile-photo-uploads |
| `workers/photo-proxy/src/index.ts` | Validasi ≤20 file, ≤15 MB/file, MIME gambar |
