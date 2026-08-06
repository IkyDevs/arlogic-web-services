# Laporan Penanganan Error — Flow Telegram SOT (Upload, Edit, QC, WebRTC, Video)

**Tanggal**: 6 Agustus 2026
**Status**: Desain penanganan error (draf) — untuk disandingkan dengan `PLAN_TELEGRAM_SOT.md`
**Prinsip inti**: Tidak ada kegagalan yang diam-diam; setiap error → status + retry + notifikasi user; tidak ada kehilangan data (D3).

---

## 1. Prinsip Desain Penanganan Error

| # | Prinsip | Implementasi |
|---|---|---|
| E1 | **Gagal = tercatat & terlihat** | Setiap langkah punya state (DB) + toast/notifikasi user; tidak ada `catch {}` kosong |
| E2 | **Per-lapisan, per-file** | Error granular: lapisan (validasi/kompresi/IndexedDB/network/worker/Telegram/DB) dan per-file (1 file gagal ≠ semua gagal) |
| E3 | **Retry aman (idempotent)** | Retry hanya dari status `FAILED`; status `UPLOADING` dijaga agar tidak dobel-kirim (state transition guard) |
| E4 | **D3 invariant: tidak hapus sebelum kirim baru sukses** | Jika kirim baru gagal → pesan lama dipertahankan, status `FAILED`, siap retry |
| E5 | **DB = kebenaran struktur; Telegram = cermin media** | Error sinkronisasi Telegram tidak menghapus/merusak data web; cukup ditandai & di-retry |
| E6 | **Sanitasi** | Error ke user = pesan ramah (bahasa Indonesia), tanpa stack/internal detail |

---

## 2. Taksonomi Error per Lapisan

| Kode | Lapisan | Jenis error | Contoh | Severity |
|---|---|---|---|---|
| V | Validasi client | file tak didukung / terlalu besar / duplikat / corrupt | `"x.jpg" bukan format gambar` | Low |
| C | Kompresi | HEIC gagal konversi / canvas error | `"x.heic" tidak bisa dikonversi` | Medium |
| I | IndexedDB | quota penuh / write gagal | `QuotaExceededError` | Medium |
| N | Network | timeout / offline / abort | `Koneksi tidak stabil. Coba lagi.` | High |
| S | Server route | CSRF / rate-limit / JSON invalid | `403 / 429 / 400` | High |
| W | Worker | validasi (20 file/15MB/MIME) / Telegram API error | `502 Telegram error` | High |
| T | Telegram | 429 rate-limit / timeout / file terlalu besar / album invalid | `retry_after` / 50MB video | High |
| D | Database | insert/update gagal / RLS | `Failed to create session` | Critical |
| P | Protokol edit | edit caption gagal / delete gagal / kirim baru gagal | caption not found / message_id expired | Medium |
| R | WebRTC | izin kamera ditolak / kamera sibuk / tidak ada kamera | `NotAllowedError` | Medium |
| Vd | Video | >50MB / codec unsupported | Telegram reject | Medium |

---

## 3. Matriks Penanganan per Flow

### 3.1 `addFiles()` (validasi → kompresi → IndexedDB)
| Kondisi | Deteksi | Aksi |
|---|---|---|
| Bukan gambar/video | `isAllowedFile` false | Tolak file itu saja; toast `"nama" bukan format`; file lain tetap lanjut |
| File > batas (image 15MB / video 50MB) | size check | Tolak file; toast ukuran max |
| Melebihi 20 file | count check | Tolak batch; toast `Maksimal 20 foto` |
| Duplikat (nama+size) | `checkDuplicateFiles` | Tolak & beri tahu; tidak crash |
| Gambar corrupt | `validateCorrupted` (image only) | Tolak file; toast `corrupt/tidak bisa dibaca` |
| HEIC gagal konversi | `convertHeicFiles` failed list | File dilewati + toast; sisanya lanjut |
| IndexedDB quota penuh | `QuotaExceededError` | Abort add, simpan di memori saja, toast peringatan |
| Sebagian berhasil | `{files[], errors[]}` | Tambah yang sukses; tampilkan semua error |

**Outcome**: return `{ files, errors }` — komponen render error list + preview sukses.

### 3.2 Submit → Worker → Telegram
| Kondisi | Deteksi | Aksi |
|---|---|---|
| Chat/Channel tidak terkonfigurasi | `getChannel` kosong | Abort sebelum kirim; status `FAILED`; toast konfigurasi |
| `NEXT_PUBLIC_PHOTO_PROXY_URL` kosong | url worker kosong | Abort; toast jelas (bukan "Upload gagal" generik) |
| Worker tolak (20/15MB/MIME) | HTTP 400 | Toast pesan worker; status `FAILED` |
| Telegram 429 | `retry_after` | Tunggu sesuai `retry_after`; tidak hitung retry |
| Telegram timeout/network | fetch abort | Retry backoff 2s→4s→8s (sudah ada di `lib/telegram.ts`) |
| Telegram error 502 | `data.description` | Map ke pesan; status `FAILED` |
| Parsial (sebagian file sukses) | count hasil < total | Simpan yang sukses; tandai sisanya FAILED; retry yang gagal |

**Invariant D3**: hasil kirim baru **harus** dikonfirmasi dulu sebelum operasi hapus lama (jika ada).

### 3.3 Simpan metadata DB (photo_urls, message_ids, file_ids)
| Kondisi | Aksi |
|---|---|
| Update DB gagal padahal Telegram sudah terkirim | Jangan hapus chat; simpan state `FAILED_DB` → retry update (data Telegram tetap, tinggal sinkron DB) |
| Update DB sukses | lanjut ke langkah berikut (clear IndexedDB / delete lama) |

### 3.4 Edit — CAPTION ONLY (transaksi data-only & QC approve)
| Kondisi | Aksi |
|---|---|
| `editMessageCaption` gagal (message_id tidak valid/expired) | Jangan gagalkan simpan web; tandai `TELEGRAM_OUT_OF_SYNC`; toast peringatan; opsi "coba lagi" / "kirim ulang pesan" (kirim baru + hapus lama) |
| Caption baru terlalu panjang (>1024 char caption) | Validasi client sebelum kirim; potong/peringatkan |

### 3.5 Edit — FOTO BERUBAH (khusus transaksi; kirim baru → hapus lama)
| Langkah | Error | Aksi |
|---|---|---|
| 1) Kirim pesan baru | gagal | **JANGAN hapus lama**; status `FAILED`; simpan IndexedDB; toast + retry |
| 2) Simpan metadata baru | gagal | Pesan baru sudah live → ulangi update DB (jangan hapus lama/lama), tandai retry |
| 3) Hapus pesan lama (semua message_id) | salah satu gagal | Pesan baru sudah live; log + retry hapus di background (cleanup); duplikat sesaat diterima |
| **Sebagian message_id lama tidak terhapus** | delete berulang | Batch delete dengan toleransi; tidak fatal (hanya duplikat visual) |

**Aturan utama**: `hasPhotoChange` dihitung dari diff `photo_urls` lama vs baru. Salah hitung = salah mode edit → validasi di UI.

### 3.6 Absensi — WebRTC
| Error WebRTC | Aksi |
|---|---|
| `NotAllowedError` (izin ditolak) | Toast minta izin; fallback `<input capture>` |
| `NotFoundError` (tak ada kamera) | Fallback `<input capture>` / galeri |
| `NotReadableError` (kamera dipakai app lain) | Toast; tombol coba lagi |
| `OverconstrainedError` (facingMode) | Retry tanpa constraint |
| Capture → canvas gagal | Toast; tidak menambah file |
| Stream tidak di-stop | cleanup di unmount (selalu) |

### 3.7 Video (QC submit)
| Kondisi | Aksi |
|---|---|
| Video > 50MB | Tolak sebelum upload; toast batas (validasi client) |
| Video corrupt / codec tak didukung | Gagal di Worker/Telegram → pesan spesifik; file tetap di IndexedDB utk retry |
| Campuran foto+video sebagian gagal | Per-file result; yang sukses terkirim, sisanya retry |

---

## 4. Status Failure di DB + Rekonsiliasi

### 4.1 State machine upload (kolom status)
```
no_photo → pending → uploading → success
                          └──→ failed ──(retry)──→ pending/uploading
```
- **`failed`** (photo_status) / **`FAILED`** (upload_status) → UI menampilkan tombol retry + event `layanan-retry-upload`.
- Retry HANYA diizinkan dari `failed` (idempotency, E3).
- Cron `reconcile-photo-uploads` (tiap 15 mnt): `pending/uploading` > 30 mnt → `failed` (kedua kolom sudah ditangani).

### 4.2 Sinkronisasi Telegram out-of-sync
- Kolom status tambahan opsional: `telegram_sync` = `synced | caption_failed | resend_pending`.
- `caption_failed` → retry caption; `resend_pending` → antrian kirim-baru-hapus-lama (bisa via Inngest).

---

## 5. Retry & Recovery

| Lapisan | Mekanisme | Sudah ada? |
|---|---|---|
| Validasi/kompresi | reject per-file, lanjut sisanya | ✅ |
| Telegram | backoff 2/4/8s + 429 wait | ✅ (`lib/telegram.ts`) |
| Rate-limit server | `429` + `Retry-After` | ✅ (`lib/rate-limit.ts`, in-memory) |
| Upload gagal (transaksi) | IndexedDB dipertahankan + event retry | ✅ |
| Reconcile macet | cron 15 mnt → `failed` | ✅ (pass ini) |
| Re-upload background | Inngest (jika fire-and-forget dipindah ke server) | ⏳ Fase 4 |
| Retry hapus lama gagal | cleanup job (delete message lama tersisa) | ⏳ Fase 1 |
| Double-submit | `submittingRef` guard | ✅ |

---

## 6. Pesan Error untuk User (matriks)

| Kode | Pesan (ID) | Kelas |
|---|---|---|
| V1 | `"nama" bukan format gambar/video yang didukung` | toast |
| V2 | `"nama" terlalu besar (max 15MB foto / 50MB video)` | toast |
| V3 | `Maksimal 20 file per upload` | toast |
| V4 | `"nama" sudah ditambahkan (duplikat)` | toast |
| V5 | `"nama" file corrupt atau tidak dapat dibaca` | toast |
| C1 | `"nama" gagal dikonversi dari HEIC. Kirim ulang sebagai JPEG.` | toast |
| I1 | `Penyimpanan browser penuh. Foto disimpan sementara di memori.` | toast |
| N1 | `Koneksi tidak stabil. Coba lagi.` | toast |
| N2 | `Tidak dapat terhubung ke server.` | toast |
| S1 | `Terlalu banyak permintaan. Coba lagi beberapa saat.` | toast + countdown |
| W1 | `Server menolak: (pesan worker)` | toast |
| T1 | `Telegram timeout. Coba lagi.` | toast |
| D1 | `Gagal menyimpan data. (detail ringkas)` | toast + status failed |
| P1 | `Foto berhasil disimpan, tetapi caption Telegram gagal diperbarui.` | toast + opsi retry |
| P2 | `Pesan lama gagal dihapus — akan dibersihkan otomatis.` | info |
| R1 | `Akses kamera ditolak. Izinkan kamera atau pilih dari galeri.` | toast + fallback |
| R2 | `Kamera tidak tersedia. Pilih dari galeri.` | toast + fallback |

---

## 7. Keamanan Error (sanitasi)

- Response API: `{ error: "pesan ramah" }` — **tidak** mengembalikan stack/internal.
- Log detail (stack, supabase error) hanya di server console / Sentry.
- CSRF (`validateOrigin`) & rate-limit di semua route mutasi — **tambah** ke `/api/upload/complete` & `/api/upload/callback` (saat ini kurang, lihat gap G-7).
- Jangan ekspos `TELEGRAM_BOT_TOKEN`, `SERVICE_ROLE_KEY` ke client.

---

## 8. Observability

| Kanal | Isi |
|---|---|
| `console.*` | debug flow per langkah (sudah ada banyak `[DEBUG:...]`) — kurangi saat produksi |
| Sentry (`@sentry/nextjs`) | unhandled exception + error route |
| `upload_audit_logs` (2-fase, mati) | ganti dengan audit sederhana per transaksi: event `UPLOAD_OK/FAILED/CAPTION_EDITED/RESENT` |
| Cron reconcile | log jumlah stuck per run |

---

## 9. Gap Error-Handling Saat Ini vs Target

| G | Gap | Lokasi | Fix (Fase) |
|---|---|---|---|
| G-1 | `catch {}` kosong di beberapa titik (edit caption, delete message, syncCustomer) | `LayananForm` | Minimal: log + state; F1 |
| G-2 | `retryPhotoUpload` & `submit/uploadToSupabase` mati — retry hanya via UI event | hook | Rapikan; F4 |
| G-3 | IndexedDB quota tak ditangani | `indexeddb-storage` | try/catch + fallback memori; F0 |
| G-4 | `NEXT_PUBLIC_PHOTO_PROXY_URL` kosong → error generik | `upload-service` | pesan jelas; F0 |
| G-5 | Error video & WebRTC belum ada (fitur baru) | — | F2/F3 |
| G-6 | Hapus lama sebagian gagal tidak ditangani | — | cleanup job; F1 |
| G-7 | `/api/upload/complete` tanpa rate-limit; `/api/upload/callback` tanpa CSRF+rate-limit | routes | tambah; F0 |
| G-8 | `catch {}` di `telegram.ts` mengembalikan `false` diam-diam (edit caption) | `lib/telegram.ts` | log + retry; F1 |
| G-9 | Tidak ada status `TELEGRAM_OUT_OF_SYNC` | DB | kolom `telegram_sync`; F1 |

---

## 10. Prioritas Perbaikan Error

1. **F0** — tutup gap keamanan (G-7), pesan jelas G-4, IndexedDB quota G-3.
2. **F1** — protokol edit + state `telegram_sync` + retry hapus lama (G-6, G-1, G-8, G-9).
3. **F2** — error video (batas 50MB, codec) (G-5).
4. **F3** — error WebRTC lengkap (G-5).
5. **F4** — migrasi + audit state, hapus hook mati (G-2).
