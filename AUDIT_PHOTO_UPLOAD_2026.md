# Audit Sistem Foto & Upload — Arlogic Web Services

**Tanggal**: 6 Agustus 2026
**Status**: Audit menyeluruh + mekanisme perbaikan diaktifkan
**Scope**: Seluruh fitur yang memakai upload foto; analisa mendalam sistem "upload central"

---

## 1. Ringkasan Eksekutif

Proyek mendapat dokumentasi yang mengklaim sebuah **centralized upload service** dua-fase
(alur `useCentralUpload → /api/upload/session (signed URL) → Supabase → /api/upload/complete → Inngest`,
lihat `UPLOAD_SYSTEM_AUDIT.md`, `UPLOAD_QUICK_REFERENCE.md`, `UPLOAD_FLOW_DIAGRAM.md`).

**Temuan inti: klaim tersebut tidak sesuai dengan kode yang benar-benar berjalan.**

1. **Sistem "central" Supabase justru kode mati.** Tidak ada satu pun komponen yang memanggil
   `upload.submit()`, `upload.uploadToSupabase()`, atau `upload.completeSession()`. API
   `/api/upload/session`, `/api/upload/complete`, `/api/photos/session/[id]`, Inngest
   `upload-worker/retry/cleanup`, dan tabel `upload_sessions`/`upload_files`/`photo_captions`/
   `upload_audit_logs` HANYA dipanggil oleh `lib/upload/upload-service.ts` (client-side), dan tidak pernah dipakai UI.

2. **Ada 3 sistem upload paralel** (bukan 1 central), semuanya **ujung ke Telegram** lalu disajikan
   via Cloudflare proxy (`photos.arlogic.com/photos/{file_id}`).

3. **Bug: kolom status tidak konsisten.** `PengeluaranForm` menulis `photo_status`;
   `LayananForm` menulis `upload_status` (kolom berbeda). Cron recovery hanya membaca `photo_status`.

4. **Bug: cron recovery tidak pernah dijadwalkan** di `vercel.json` (hanya cron `keepalive` bulanan).

5. **Security gap (baru ditambal):** jalur foto Layanan langsung ke Worker Cloudflare `/upload`
   **tanpa** validasi jumlah/ukuran/MIME, tanpa rate-limit, tanpa origin check.

Bagian §7 merinci perbaikan yang sudah diaplikasikan dalam pass ini.

---

## 2. Inventarisasi Fitur Upload Foto (Feature-by-Feature)

Dari 14+ komponen dengan `input[type/accept]`, berikut yang **benar-benar meng-upload foto**:

| Fitur | Komponen | Hook | `type` channel | Endpoint final | Berkas yang disimpan |
|---|---|---|---|---|---|
| Transaksi Layanan | `components/layanan/LayananForm.tsx` | `useCentralUpload`→`legacyUpload` | `layanan` | **Worker `/upload`** | `photo_urls` + `upload_status` |
| Pengeluaran | `components/layanan/PengeluaranForm.tsx` | `useCentralUpload`→`legacyUpload` | `layanan` | **Worker `/upload`** | `photo_urls` + `photo_status` |
| Service Order (admin) + foto DP | `components/admin/ServiceInput.tsx` | `useCentralUpload`→`legacyUpload` | `service` / `layanan` | **Worker `/upload`** | `service_documentation.photo_url` |
| Cashdraw | `components/layanan/CashdrawForm.tsx` | `useUpload` | `layanan` | `/api/upload` | `photo_urls` |
| Inventory | `components/admin/InventoryManagement.tsx` | `useUpload` | `inventory` | `/api/upload` | (store) |
| Absensi | `components/teknisi/AttendanceModal.tsx` | `useUpload` | `attendance` | `/api/upload` | (store) |
| Update Teknisi | `components/teknisi/ServiceTimeline.tsx` | `useUpload` | `teknisi_update` | `/api/upload` | (store) |
| Update Progres | `components/teknisi/ProgressUpdate.tsx` | `useUpload` | `teknisi_update` | `/api/upload` | `service_documentation` |
| Submit QC | `components/teknisi/SubmitQCModal.tsx` | `usePhotoUpload` | `qc_update` | `/api/upload` | `service_documentation` |
| Antrian QC | `components/teknisi/QueueList.tsx` | `usePhotoUpload` | `qc_update` | `/api/upload` | `service_documentation` |
| Kaspin | `components/teknisi/KaspinUpdate.tsx` | `usePhotoUpload` | `kaspin` | `/api/upload` | (store) |
| Sparepart Ready | `components/admin/SparepartReadyModal.tsx` | `usePhotoUpload` | `service` | `/api/upload` | (store) |

**Komponen yang BUKAN upload foto** (false positive grep):`AttendanceReport.tsx` (ekspor CSV),
`ImportBarangModal.tsx` (impor Excel .xls/.xlsx), `CustomerList.tsx`, `LayananList.tsx` (view),
`QueueList.tsx.bak` (file cadangan).

**Komponen mati (tidak diimpor oleh siapa pun):** `components/ui/PhotoUploader.tsx`,
`components/ui/CentralUploader.tsx` (perlu diverifikasi kepastiannya per-modul).

---

## 3. Deep-Dive: Fitur "Upload Central"

### 3.1 Dua konfigurasi `config` yang saling bertentangan

| | `lib/uploadConfig.ts` (`uploadConfig`) | `lib/upload/upload-config.ts` (`uploadServiceConfig`) |
|---|---|---|
| dipakai oleh | `usePhotoUpload`, `/api/upload` route | `useCentralUpload`, `lib/upload/*` |
| Maks. file | `IMAGE_MAX_FILES` **10** | `UPLOAD_MAX_FILES` **20** |
| Maks. per file | 15 MB | 15 MB |
| Total | 10×15=150 MB | 100 MB |
| Kompresi | **non aktif default** (`IMAGE_COMPRESSION_ENABLED=false`), hanya `compressImage` canvas >2MB | aktif (>1MB → `compressToTarget` 1MB, HEIC→JPEG) |
| Backend | Telegram (via `/api/upload` atau Worker) | "Supabase" (yang tak terpakai) + `legacyUpload`→Telegram |

Dua sumber kebenaran yang bertentangan → `usePhotoUpload`/`/api/upload` menerima **10** file,
`useCentralUpload` → hingga **20** file.

### 3.2 Spesifikasi alur dua-fase ("central" Supabase)

Artefak lengkap di `lib/upload/`:
- `upload-service.ts` — `addFiles/removeFile/clearSession/recoverSession/submit/uploadToSupabase/completeSession/legacyUpload/retryPhotoUpload`
- `indexeddb-storage.ts` — DB `arlogic-uploads` (file blob + metadata) untuk draft-recovery
- `upload-validator.ts`, `upload-compressor.ts`, `upload-utils.ts`, `upload-events.ts`, `upload-queue.ts` (Inngest), `upload-repository.ts` (Supabase), `upload-storage.ts` (signed URL)

**Status: PSEUDO — tidak pernah dijalankan.** Tidak ada `<komponen>.submit()` /`uploadToSupabase()` / `completeSession()` di seluruh `components/`. Ketiga komponen `useCentralUpload` justru memakai `legacyUpload()` yang **menuju Worker Cloudflare**, sehingga **path supabase + queue + cleanup seluruhnya idle**.

### 3.3 Alur yang benar-benar produksi

```
CLIENT (komponen)
  │
  ├─ usePhotoUpload / useUpload  ──► POST /api/upload (Vercel)
  │                                  ├─ validateOrigin (CSRF)
  │                                  ├─ rateLimitIP
  │                                  ├─ MIME/size/maxFiles check
  │                                  ├─ sharp compress (>2MB, 1920px, q80)
  │                                  └─ uploadMultipleToTelegram ──► Telegram ──► file_id
  │
  └─ useCentralUpload.legacyUpload ──► POST {NEXT_PUBLIC_PHOTO_PROXY_URL}/upload  [Cloudflare Worker]
        └─ (tidak ada validasi server; langsung sendMediaGroup/sendPhoto ke Telegram ──► file_id
        └─ (TELAH DITAMBAH validasi baru di worker)
                                  │
                                  ▼
  foto didistribusi via:  https://photos.arlogic.com/photos/{file_id}
  (Cloudflare photo-proxy worker: getFile Telegram → cache 7 hari)
```

Jadi dua jalur **berbeda** untuk hal yang sama (Telegram). Worker menghindari biaya bandwidth Vercel
(desain disengaja per komentar `upload-service.ts`), tetapi mengorbankan validasi server + rate-limit.

---

## 4. Temuan / Bug

### 🔴 4.1 Kolom status tidak konsisten (eksisting, TELAH diperbaiki)
- `PengeluaranForm.tsx` → `photo_status` (`pending/completed/failed`)
- `LayananForm.tsx` + `LayananList.tsx` + `lib/domain/transaction` → `upload_status` (`PENDING/UPLOADING/SUCCESS/FAILED`)
- Cron `reconcile-photo-uploads` hanya memindai `photo_status='pending'` → **transaksi Layanan yang macet tidak pernah ter-reconcile**, bisa menggantung selamanya.
- ✅ **Perbaikan**: cron kini memindai `upload_status IN (PENDING,UPLOADING)` **ATAU** `photo_status='pending'`, dan menandai **kedua kolom** `failed`/`FAILED` saat di-reconcile.

### 🔴 4.2 Cron recovery tidak dijadwalkan (eksisting, TELAH diperbaiki)
- `vercel.json` hanya punya `crons: [/api/cron/keepalive (bulanan)]`.
- `reconcile-photo-uploads` (dokumentasi: "run every 15-30 min") tidak pernah masuk scheduler → recovery otomatis tidak pernah berjalan.
- ✅ **Perbaikan**: ditambah `*/15 * * * *` untuk `/api/cron/reconcile-photo-uploads`.

### 🔴 4.3 Dua jalur masuk (ingestion) yang berbeda
- `useUpload`/`usePhotoUpload` ke `/api/upload` (Vercel, ada CSRF+rate-limit+sharp)
- `useCentralUpload.legacyUpload` ke Worker `/upload` (tanpa rate-limit, **tanpa validasi**)
- Karena worker adalah jalur produksi untuk fitur Layanan/Pengeluaran/ServiceInput, ini celah ganda.
- ✅ **Mitigasi baru**: worker sekarang memvalidasi maks 20 file, 15 MB/file, dan MIME image (tampaknya `.jpg/.png/.webp/.heic`). Rate-limit/origin di worker masih rekomendasi (lihat §7).

### 🟠 4.4 Sistem Supabase dual-fase = bloat mati
- `upload_sessions`, `upload_files`, `photo_captions`, `upload_audit_logs` + Inngest `upload-*` + `/api/upload/session*` — **tidak satu konsumen pun**.
- Menambah kompleksitas & risiko keamanan (endpoint tanpa auth, hanya CSRF+rate-limit) tanpa manfaat fungsional.

### 🟠 4.5 `photos` tabel adalah data orphan/legacy
- `app/api/cron/keepalive` dan `app/api/photos/[id]` membaca tabel `photos` (kolom `photo_data` base64,
  `file_id`). **Tidak ada penulis** ditemukan di kode saat ini → jalur proxy ini kemungkinan operasi data lama.
- Ada **dua proxy foto**: Vercel `app/api/photos/[id]` DAN Cloudflare Worker `/photos/:id`. Duplikasi domain.

### 🟠 4.6 Kecocokan schema jenis (`UploadType`) terbatas
- `/api/upload` menerima `attendance,service,layanan,inventory,kaspin,teknisi_update,qc_update`.
- Jenis `closing/stock_transfer/sparepart_ready` TIDAK ada di skema → yang bukan di enum diserap jadi `service` (fallback) — berisiko salah saluran.

### 🟡 4.7 Kompresi dua lapis yang tak sinkron
- Client `compressImage` (canvas) mendekompresi >2MB ke q0.8 di beberapa hook; server `sharp` mengompres lagi >2MB. Target berbeda (uploadConfig nonaktif) vs central (1MB). Konfigurasi duplikat bisa dihapus / disatukan.

---

## 5. Risiko

| Risiko | Severity | Status |
|---|---|---|
| Transaksi Layanan macet `upload_status`
menggantung sampai cron dipasang | Critical | ✅ Diperbaiki (cron) |
| Jalur worker tanpa validasi jumlah/ukuran/MIME | High | ✅ Ditambal (worker) |
| `photos` telegram usia > 7 hari tidak diverifikasi (depend pada `keepalive` bulanan) | Medium | Dipantau |
| `service_documentation` URL menunjuk worker tanpa fallback saat Telegram purge | Medium | Terbukti |
| Dua konfigurasi upload (10 vs 20 file) membingungkan + ketidak-sejalan UX | Medium | Rekomendasi |
| Endpoint double-fase /upload/session tanpa auth bila dipakai | Medium | Rekomendasi hapus/disable |

---

## 6. Roadmap Konsolidasi (prioritas)

1. **HApus bloat dua-fase Supabase** (opsi) — hapus `lib/upload/upload-storage.ts`,
   `upload-queue.ts`, file upload di `upload-*`, tabel `upload_sessions/upload_files/photo_captions/upload_audit_logs`,
   route `/api/upload/session*`, `complete`, `callback`. Atau setidaknya tandai `deprecated` & nol auth.
2. **Satu jalur masuk gambar**: pilih salah satu — (a) semua `legacyUpload`→`/api/upload` (dpt validasi + rate-limit, biaya bandwidth Vercel), atau (b) semua ke worker (hemat bandwidth, harus tambah rate-limit+origin di worker). Rekomendasi: (b) + rate-limit worker, karena arsitektur sudah mengarah ke sana & hemat biaya.
3. **Persatukan konfigurasi** menjadi satu file (masukkan ke satu `upload-config.ts`/`uploadServiceConfig`), penyesuaian `IMAGE_MAX_FILES` = `UPLOAD_MAX_FILES` = 20.
4. **Perbaiki `UploadType` skema** untuk meng-akomodir semua channel atau hapus pengamb.
5. **Hapus komponen mati**: `PhotoUploader.tsx` (tidak diimpor). `CentralUploader.tsx` dipakai? — verifikasi.
6. **Verifikasi data `photos`/`photo_data`**: bila legacy, plan migrasi/backup ke Worker proxy saja.
7. **Hapus `QueueList.tsx.bak`** (file cadangan menyimpan kode lama).

---

## 7. Perubahan yang Dilakukan dalam Pass Ini

| File | Perubahan |
|---|---|
| `app/api/cron/reconcile-photo-uploads/route.ts` | Scan + update kolom `photo_status` DAN `upload_status`; tandai kedua kolom saat reconcile. |
| `vercel.json` | Tambah cron `*/15 * * * *` → `/api/cron/reconcile-photo-uploads`. |
| `workers/photo-proxy/src/index.ts` | Validasi server-side: ≤20 file, ≤15MB/jam, MIME image (atau ekstensi `.jpg/.png/.webp/.heic/.heif/.avif`). |

> Deploy masih **note**: perubahan cron & route harus di-`git push` + redeploy Vercel; perubahan worker
> harus `wrangler deploy` di folder `workers/photo-proxy`.

---

## Lampiran A — Referensi kunci

| Lokasi | File |
|---|---|
| Komponen jalur foto | `components/{layanan,admin,teknisi}/*` (lihat §2) |
| Hook | `hooks/useUpload.ts`, `hooks/usePhotoUpload.ts`, `hooks/useCentralUpload.ts` |
| Config | `lib/uploadConfig.ts`, `lib/upload/upload-config.ts` |
| Endpoint | `app/api/upload/route.ts`, `app/api/upload/session/route.ts`, `app/api/upload/complete/route.ts`, `app/api/upload/session/[id]/route.ts`, `app/api/upload/callback/route.ts` |
| Worker | `workers/photo-proxy/src/index.ts` (`/upload`, `/photos/:id`) |
| Modul store | `lib/upload/` (`upload-service`, `upload-repository`, `upload-storage`, `upload-queue`, `upload-events`, `indexeddb-storage`, `upload-validator`, `upload-compressor`) |
| Cron | `app/api/cron/reconcile-photo-uploads/route.ts`, `app/api/cron/keepalive/route.ts` |