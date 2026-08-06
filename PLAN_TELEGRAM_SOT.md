# Rencana Flow — Telegram Source of Truth (SOT)

**Tanggal**: 6 Agustus 2026
**Status**: Draf untuk konfirmasi — BELUM implementasi
**Dasar**: Tujuan utama (5 poin) + 3 konfirmasi user

---

## 1. Keputusan Terkunci

| ID | Keputusan |
|---|---|
| D1 | Caption album multi-foto cukup di **pesan pertama** (batasan API Telegram) |
| D2 | **QC langsung mengubah data** (item/diskon/DP) & approve — TANPA kirim balik ke teknisi. **QC TIDAK pernah menambah/menghapus foto** → sinkronisasi Telegram QC = **edit caption saja, tidak ada hapus/kirim ulang** |
| D3 | **Hapus chat lama SETELAH data baru terkirim sukses** — urutan: kirim baru → sukses → hapus lama (tidak ada window data hilang; duplikat sesaat diperbolehkan). **KHUSUS transaksi & HANYA jika foto berubah** |
| D4 | **DB tidak menyimpan foto** — Telegram = source of truth storage; DB = metadata + referensi |
| D5 | **Semua upload wajib caption**, channel **per fitur × per cabang** |
| D6 | **Edit tanpa ganti foto = edit caption/text pesan lama**; **ganti foto (khusus transaksi) = kirim baru lalu hapus lama** |
| D7 | Tabel `photos` (base64) **dipensiunkan** dulu (backup, tidak dihapus fisik) |

---

## 2. Arsitektur Target

```
UI (semua fitur) ──► useCentralUpload (jalur TUNGGAL)
      │
      ├─ addFiles (validasi image+video, kompresi image, video passthrough)
      │    └─ IndexedDB (draft/retry; video dibatasi quota)
      │
      └─ submit → upload → POST Worker /upload (Cloudflare)
             ├─ image → sendPhoto / sendMediaGroup
             ├─ video → sendVideo (≤50MB, bot limit)
             └─ RESPONSE: { urls[], file_ids[], messages: [{chat_id, message_id}] }
                    │
                    ▼
             DB (metadata ONLY):
               photo_urls[]            → URL proxy photos.arlogic.com
               telegram_chat_id        → channel (per fitur×cabang)
               telegram_message_ids[]  → SEMUA message id album (utk delete)
               telegram_file_ids[]     → utk proxy & trace
                    │
                    ▼
      PROTOKOL EDIT (lib/telegram-sync.ts)
       ├─ data berubah, foto tetap → editMessageCaption (pesan pertama album)
       │      [berlaku utk SEMUA fitur, termasuk QC approve = caption-only]
       └─ foto berubah (tambah/hapus) [KHUSUS TRANSAKSI]
             ├─ 1) kirim pesan baru (foto+data+caption)
             ├─ 2) tunggu sukses
             └─ 3) deleteMessage utk SETIAP message_id lama
```

---

## 3. Model Data (perubahan)

### 3.1 Kolom baru (migrasi)
- `layanan` (transaksi & pengeluaran):
  - `telegram_message_ids JSONB` — array message_id album (Wajib utk delete penuh)
  - `telegram_file_ids JSONB` — array file_id
  - (sudah ada: `photo_urls`, `telegram_chat_id`, `telegram_message_id` [single → diganti array])
- `service_documentation` (QC/teknisi):
  - `telegram_message_ids JSONB`
  - `telegram_file_ids JSONB`
- `service_orders` (QC approve):
  - pastikan kolom harga final: `discount`, `down_payment`, `final_total` (atau reuse yang ada)
- **Pensiunkan dulu (D7)**: tabel `photos` + kolom `photo_data` (base64) — violasi D4, backup dulu, tidak dihapus fisik
- (upload_sessions/upload_files/photo_captions — dinonaktifkan, bukan dipakai)

### 3.2 Aturan
- DB hanya menyimpan URL + referensi Telegram. Blob TIDAK pernah masuk DB.

---

## 4. Alur Upload (Central + Video)

```
1. User pilih file (foto / video) → addFiles()
2. Validasi: MIME sesuai (image: jpeg/png/webp/heic/heif | video: mp4/mov/webm/3gpp)
   - max per-file: image 15MB, video 50MB (limit bot Telegram)
   - max 20 file/session
3. Proses: image → kompresi (compressToTarget 1MB, HEIC→JPEG)
          video → passthrough (TANPA kompresi; preview opsional)
4. Simpan IndexedDB (draft/retry)
5. Submit → kirim ke Worker → Telegram:
   - 1 image → sendPhoto (caption)
   - N image → sendMediaGroup (caption di pesan pertama)
   - 1 video → sendVideo (caption)
   - campuran image+video → sendMediaGroup (caption di pesan pertama)
6. Response Worker → { urls[], file_ids[], messages[] }
7. Simpan metadata ke DB (photo_urls, chat_id, message_ids, file_ids)
8. Clear IndexedDB
```

---

## 5. Protokol Edit (Inti) — lib/telegram-sync.ts

```
syncTelegram({
  oldRef:  { chat_id, message_ids[], file_ids[] },   // dari DB
  newRef:  { urls[], file_ids[], message_ids[], chat_id },  // dari upload baru
  caption,
  hasPhotoChange,      // diff photo_urls lama vs baru
  isEditDataOnly,
}):

if (!hasPhotoChange):
    # data berubah saja → EDIT caption pesan lama (pesan pertama album)
    editMessageCaption(chat_id, oldRef.message_ids[0], caption)
    # file_ids/urls tidak berubah → tidak ada delete

else (foto berubah: tambah/hapus):
    # 1) KIRIM DULU pesan baru (D3)
    newMsg = sendToTelegram(newRef, caption)        # sendPhoto/MediaGroup/Video
    if newMsg.success:
        # 2) simpan metadata baru ke DB
        updateDb(newMsg.metadata)
        # 3) BARU hapus pesan lama (semua message_id, D3)
        for mid in oldRef.message_ids: deleteMessage(chat_id, mid)
    else:
        # kirim baru gagal → pertahankan pesan lama (tidak ada data hilang)
        status = FAILED; UI tampilkan retry
```

### 5.1 Diff foto (tambah/hapus) — diputuskan di UI
- Edit form memuat `photo_urls` lama → admin hapus (×) / tambah baru
- `hasPhotoChange = setOf(urls_lama) != setOf(urls_baru_final)`
- Data-only → caption edit; foto berubah → kirim baru + hapus lama

---

## 6. Flow per Fitur

### 6.1 Transaksi Layanan (staff add / admin edit)
- **Add**: simpan transaksi → upload foto+caption → Telegram (channel layanan per cabang) → simpan metadata
- **Edit admin (data saja)**: tampilkan data+foto lama → simpan → `hasPhotoChange=false` → edit caption pesan lama
- **Edit admin (foto berubah)**: tampilkan semua foto lama (bisa dihapus) → simpan → kirim baru → hapus lama
- Retry: jika kirim gagal → status FAILED + IndexedDB dipertahankan → event retry (sudah ada)

### 6.2 Pengeluaran
- Sama seperti 6.1 (channel `layanan`/buku kas per cabang; kolom status `photo_status`)

### 6.3 Teknisi → QC (D2: QC edit langsung, caption-only)
1. Teknisi input jasa/item → **draft sementara** di DB (status belum final)
2. Teknisi **Submit QC**: upload **foto + video** (central, support video) → Telegram `qc_update` per cabang, caption berisi item + total + status
3. **QC review** di web: lihat foto/video + item; **QC mengubah item/diskon/DP langsung** (D2)
4. **QC Approve**: simpan item final + diskon + DP → `final_total` → **update caption pesan Telegram QC** (caption-only — QC tidak pernah ganti foto, jadi TIDAK ada hapus/kirim ulang)
5. **Public tracking**: tampilkan harga final (`final_total`) + foto

### 6.4 Absensi (WebRTC — T2)
- Komponen `AbsensiCamera`: `getUserMedia({video})` → preview → tombol **Ambil Foto** (canvas capture) → `File` → `addFiles()` → auto upload ke central → Telegram channel attendance per cabang
- Tidak menyimpan stream; hentikan saat unmount; fallback ke `<input capture>` bila WebRTC tidak tersedia

### 6.5 Fitur lain (migrasi ke central)
- Inventory, Kaspin, Sparepart Ready, Cashdraw, Timeline/Progress Teknisi → pindahkan ke `useCentralUpload` (migrasi satu per satu, lihat §9)

---

## 7. Dukungan Video (QC)

| Aspek | Rencana |
|---|---|
| MIME | `video/mp4, video/quicktime, video/webm, video/3gpp` |
| Batas | 50 MB/file (limit bot Telegram) |
| Kompresi | **skip** (passthrough) — kompresor hanya image |
| Validasi corrupt | skip utk video |
| Sink | Worker `sendVideo` (single) / `sendMediaGroup` (campuran) |
| Preview UI | `<video>` thumbnail opsional |
| IndexedDB | perhatikan quota (video besar) — batas per-session + TTL |

---

## 8. Migrasi & Cleanup (bertahap)

1. Satukan config → `uploadServiceConfig` (hapus `uploadConfig`)
2. Hapus/pensiunkan: tabel `photos`+`photo_data`, sistem 2-fase Supabase (session/complete/callback, upload_*, Inngest upload-*) → nonaktifkan dulu, hapus setelah stabil
3. Migrasi fitur per fase (lihat §10), mulai dari Layanan (sudah central) → QC → lainnya
4. Hapus komponen mati: `PhotoUploader`, `CentralUploader` (jika digantikan)

---

## 9. Roadmap Fase (urutan eksekusi)

| Fase | Isi | Hasil |
|---|---|---|
| F0 | Fondasi: unify config, pensiunkan tabel `photos` base64 (backup), nonaktifkan 2-fase | DB bersih; config tunggal |
| F1 | Protokol edit: kolom message_ids + `telegram-sync.ts` + route | Edit transaksi = edit caption / kirim-baru-hapus-lama |
| F2 | Video (validator/worker/UI) | Submit QC bisa video |
| F3 | Absensi WebRTC (`AbsensiCamera`) | Take foto langsung di browser |
| F4 | Migrasi fitur lain ke central (QC, inventory, kaspin, dsb) | Satu jalur upload |
| F5 | QC approve → final_total → tracking publik | Harga final tampil publik |

---

## 10. Risiko & Catatan

- **Album caption**: hanya pesan pertama yang bisa di-edit caption (D1) — data yang sama direplikasi di DB (web), caption = representasi publik.
- **Delete-lama-setelah-kirim-baru (D3)**: ada jendela duplikat singkat di channel — disengaja (aman).
- **Bot limit**: video ≤ 50MB; file > 50MB ditolak Telegram (perlu split/kompresi video atau batasi).
- **Foto dihapus di Telegram (purge)**: proxy `photos.arlogic.com` akan 404 → perlu strategi (re-upload dari... tidak ada source → data hilang; catat risiko Telegram-SOT).
- **IndexedDB quota**: video draft besar → batasi & TTL.

---

## 11. Pertanyaan Sisa

✅ **Sudah terkunci** (tidak ada pertanyaan tersisa):
1. QC **tidak** menambah/menghapus foto → sinkronisasi QC = **edit caption saja**, tanpa hapus/kirim ulang.
2. Tabel `photos` base64 **dipensiunkan dulu** (backup, tidak dihapus fisik).
