# 📄 DEVELOPMENT REPORT: Stock Toko — Stock Jam & Stock Sparepart

## 26 Agustus 2026

---

### 🎯 TUJUAN SESI

Melanjutkan WIP stock toko menjadi fitur utuh sesuai keputusan final: stok per-cabang terisolasi (Jam+Sparepart), admin cabang hanya cabangnya, admin_gudang kelola gudang+semua stok toko, transaksi service langsung memilih **Sparepart | Jasa**, teknisi/QC wajib picker stok tanpa custom, rollback stok konsisten, operasi atomik server-side. Google Sheets = optional fase terpisah (tidak dieksekusi).

---

### 📝 KEPUTUSAN TEKNIS (dari approval user)

| # | Keputusan |
|---|---|
| 1 | Rollback stok WAJIB saat cancel/hapus/qty berkurang (delta-based) |
| 2 | Potong stok service_langsung saat transaksi tersimpan; gagal = batal simpan |
| 3 | Sparepart teknisi wajib dari stok cabang service (`inventory_id` valid) |
| 4 | Tanpa custom/free-form sparepart di staff/teknisi/QC; jasa tetap bebas |
| 5 | `admin_gudang` = gudang + stok semua cabang; `admin` = cabang sendiri; enforcement SERVER-SIDE |
| 6 | Retag item jam existing via kandidat review, tanpa tebakan |
| 7–18 | Google Sheets optional Phase 6; DB source of truth; adjustment-model bukan overwrite |

---

### ⚡ EKSEKUSI

#### Database (migration baru, idempotent — BELUM dijalankan ke live)
| File | Isi |
|---|---|
| `supabase/migrations/20260825_inventory_item_class.sql` | kolom `item_class` (WIP kemarin, ikut dikommit) |
| `supabase/migrations/20260826_inventory_stock_core.sql` | tabel `stock_toko`/`stock_gudang`/`stock_movements` + index unik + helper auth + guard trigger kolom legacy |
| `supabase/migrations/20260826_inventory_stock_rls.sql` | RLS: tutup `public_all_access`, policy select/manage per role+cabang |
| `supabase/migrations/20260827_adjust_stock_rpc.sql` | RPC atomik `adjust_store_stock`/`adjust_warehouse_stock` (FOR UPDATE, anti-minus, dual-write legacy, ledger) |
| `docs/sql/verify_stock_rls_rpc.sql` | runbook verifikasi staging/prod |
| `docs/sql/review_item_class_candidates.sql` | kandidat retag jam (review manual) |

#### Domain & Service
- `lib/domain/inventory/service.ts` **BARU**: wrapper RPC, `searchStoreStock`, pure `computeStockDeltas`, `applyUsageDeltas`/`compensateUsageDeltas`
- `lib/inventory-stock.ts` DIHAPUS (diganti domain service)
- `lib/domain/transaction/service.ts`: create=potong-dulu+kompensasi; update=diff rollback; delete=restore-abort

#### UI
- `LayananForm`: toggle **Jasa | Sparepart** per baris SKU service_langsung; picker Jam unified; validasi stok sebelum submit; potong-stok pindah ke createTransaction
- `components/inventory/SparepartPicker.tsx` **BARU** (search stok cabang, reusable)
- `AddSparepartModal` (teknisi): rewrite → picker wajib + kompensasi penuh saat gagal
- `SubmitQCModal`: hapus item sparepart → restore dulu, gagal = batal hapus
- `QCReviewModal`: fallback manual DIHAPUS; loader stok diperbaiki (sebelumnya tak pernah dimuat); edit-qty = delta stok dengan kompensasi
- `InventoryManagement`/`GudangView`: adjust via RPC terpusat; error tidak lagi di-swallow

#### RBAC (WIP kemarin ikut dikommit sebagai bagian fitur)
`proxy.ts` route `admin_gudang→/admin`; menu Gudang by role; `BranchContext` mengunci admin ke cabangnya.

---

### 🧪 TESTING

| Test | Status |
|---|---|
| `bunx tsc --noEmit` | ✅ 0 error |
| `bun run build` | ✅ sukses |
| `bun run test` | ✅ 12 file / 107 passed (5 unit test delta stok baru) |
| SQL runbook RLS/RPC/concurrency | ⚠️ **wajib dijalankan manual** di Supabase (staging→prod) — lihat `docs/sql/verify_stock_rls_rpc.sql` |
| Retag item jam | ⚠️ menunggu review kandidat oleh Anda (`docs/sql/review_item_class_candidates.sql`) |
| UAT alur end-to-end authenticated | ⚠️ manual oleh user |

---

### 🔥 DEPLOYMENT CHECKLIST
1. Commit & push kode ✔ (lokal)
2. Jalankan 4 migration di Supabase (urutan nama file)
3. Jalankan runbook verifikasi SQL
4. Review & retag kandidat jam
5. Smoke test: beli_jam, service_langsung sparepart, teknisi add sparepart, QC edit/delete, inventaris ±stok, gudang ±stok
6. Monitor `stock_movements`

---

### 📝 ISSUES / CATATAN
- Dual-model kolom legacy dipertahankan (dual-write oleh RPC); `store_stock` kini = total lintas cabang (semantik baru, lebih benar untuk katalog multi-cabang).
- Item legacy tanpa `inventory_id` tidak bisa di-rollback otomatis (by design; data historis).
- Insert item baru dengan opening stock >0 tetap lewat form Inventaris (opening balance sah); perubahan SETELAH itu harus via jalur adjust.

### ✍️ SIGN-OFF
Developer: Sisyphus · Status: **Kode selesai; menunggu eksekusi migration + verifikasi SQL + retag oleh user**

---

# TAHAP C — IMPORT STOK TOKO (CSV/XLSX/XLS)

## 26 Agustus 2026

---

### 🎯 TUJUAN SESI

Melanjutkan Tahap C: import stok toko dari file (CSV/XLSX/XLS) dengan model mapping **System Field ← Kolom File**, validasi per baris, pratinjau dampak delta, dan penerapan aman lewat jalur RPC terpusat `adjust_store_stock` — tanpa migration database dan tanpa delete+insert stok.

---

### 📝 KEPUTUSAN TEKNIS

| # | Keputusan | Alasan |
|---|---|---|
| 1 | Apply via `adjustStoreStock` (RPC atomik) — bukan UPDATE langsung `stock_toko` | Otorisasi cabang, anti-minus, dual-write legacy, ledger `stock_movements` tetap menegak |
| 2 | Delta = imported − current; delta 0 tidak dikirim ke RPC | Hemat RPC call; tidak ada mutasi tak perlu |
| 3 | Gagal di tengah → stop + kompensasi terbalik (LIFO) baris yang sudah masuk; kompensasi gagal = status "partial" dilaporkan eksplisit | Tidak ada silent partial failure; stok tidak tertinggal setengah ter-update |
| 4 | Matching SKU: trim + case-insensitive (`normalizeSkuKey`) terpusat di domain | Satu source of truth semantik matching |
| 5 | Supplier = OPSI 1: dropdown tampil tapi selalu "Tidak dipilih", tidak dibuat kolom DB | Sesuai requirement Tahap C |
| 6 | Harga dipetakan di UI tetapi belum disimpan ke database | Scope Tahap C hanya quantity |
| 7 | Kolom file yang tidak dipetakan → diabaikan, tidak masuk payload | Sesuai requirement |
| 8 | SKU duplikat dalam file ditolak (case-insensitive) | Duplikat bikin delta ambigu untuk satu target adjust |
| 9 | Validasi signature file (magic bytes ZIP/OLE2) sebelum parse | XLSX.read diam-diam mem-parsing byte acak sebagai teks → file rusak lolos sbg sheet kosong (ditemukan saat test) |
| 10 | Fetch stok current via `.in("sku", chunk≤100)` — matching DB case-sensitive | Deterministik; mismatch casing muncul jelas sebagai "tidak ditemukan" di pratinjau, bukan tebakan |

---

### ⚡ EKSEKUSI

#### Domain
| File | Isi |
|---|---|
| `lib/domain/inventory/importFile.ts` | Parser multi-format (csv/xlsx/xls), deteksi format, signature check, multi-sheet, ParsedTable ternormalisasi |
| `lib/domain/inventory/import.ts` | `SYSTEM_FIELDS`, auto-map (suggestion), `validateFieldMapping` (required + anti-duplikat kolom), `buildMappedRows`+`fieldMappingToColumnMap`+`columnMapToFieldMapping`, `validateRows`, `calculateImpact` (delta, notFound), `normalizeSkuKey` |
| `lib/domain/inventory/service.ts` | `applyStoreStockImport`: sequential apply via `adjustStoreStock`, stop-on-error, kompensasi LIFO, progress callback |

#### UI
| File | Isi |
|---|---|
| `components/inventory/StockImportModal.tsx` **BARU** | Flow: Upload → File Summary → Sheet Selection (>1 sheet) → Column Mapping (dropdown per system field) → Import Summary (total/valid/invalid/mapped/ignored/error rows) → Impact Summary (SKU/current/imported/delta berwarna) → Confirm → Progress → Result → refresh Stock Toko. Branch terkunci via prop `branchId`; guard tanpa cabang aktif |
| `components/admin/InventoryManagement.tsx` | Tombol **Import Stok Toko** + render modal (`onImported` → `fetchInventory()` + `onUpdate?.()`) |

#### Database
**TIDAK ADA migration / perubahan schema / perubahan data.** RPC existing dipakai apa adanya.

---

### 🧪 TESTING

| Test | Status |
|---|---|
| `bunx tsc --noEmit` | ✅ PASS |
| `bun run build` | ✅ Compiled successfully |
| `bun run test` | ✅ 13 file / 128 passed — termasuk 21 test import baru: mapping model (required/optional/duplikat/override/unused column), impact +5/−5/0 & notFound, parser csv/xlsx/multi-sheet/file rusak, apply sukses/gagal/kompensasi/partial/delta-0 |
| Regresi test lama | ✅ semua pass |
| UAT manual authenticated (upload file nyata → confirm) | ⚠️ oleh user |

---

### 📝 ISSUES / CATATAN
- Item katalog yang cocok SKU tetapi belum punya baris `stock_toko` untuk cabang → current dianggap 0 (RPC insert-if-missing).
- SKU sama pada >1 item katalog (data ganda) → baris dilewati dan dilaporkan eksplisit di pratinjau.
- Matching DB saat fetch bersifat case-sensitive; beda casing file vs katalog akan muncul sebagai "tidak ditemukan" (terlihat di pratinjau, bukan silent).
- Modal Import Barang existing (katalog barang) TIDAK diubah — fitur ini khusus quantity stok toko cabang aktif.

### ✍️ SIGN-OFF
Developer: Sisyphus · Status: **Tahap C complete (kode+test+build); UAT upload file nyata oleh user**

---

# TAHAP C-FIX — AUDIT IMPORT STOK TOKO (1557 SKU notFound + Row 2)

## 26 Agustus 2026

---

### 🎯 TUJUAN SESI

Audit root-cause laporan user: Impact Summary kosong (1557 SKU "tidak ditemukan") + error row 2 "Quantity bukan angka". Audit read-only terhadap DB production, kode, dan file asli `DATA_BARANG_*.xls`. Fix B+C+D dieksekusi setelah ACC; keputusan katalog = **Opsi A1** (isi katalog via Import Barang existing — TANPA create-if-missing).

### 🔍 ROOT CAUSE (terverifikasi bukti)

| Masalah | Akar | Bukti |
|---|---|---|
| 1557 SKU notFound | **Katalog `inventory` production KOSONG (0 baris)** — Import Stok Toko by design hanya adjust item existing | service-role count `*/0` (bypass RLS); `stock_movements` memuat smoke-test hari ini pada 2 item yang kini terhapus; file = export katalog Kasir Pintar yang belum pernah dibuat di inventory |
| Row 2 qty error | Baris 2 file = **baris instruksi template Kasir Pintar** (`kode_barang_edit` berisi kalimat "Data Kolom ini jangan di edit…", `stok_edit` teks) | parse langsung file asli; repro lokal mereproduksi persis pesan user |
| (Laten) `Number("1.000")===1` | Konversi JS senyap pada qty ber-pemisah → korupsi delta tanpa error | repro unit |

### ⚡ FIX (B+C+D)

| File | Perubahan |
|---|---|
| `lib/domain/inventory/import.ts` | **B**: `RowError.raw{sku,name,quantity}` (nilai mentah penyebab) + deteksi baris instruksi template (teks ≥30 char non-numerik di kolom SKU/Qty → `isTemplateRow`, pesan ramah). **C**: parser qty ketat — hanya bilangan bulat polos; `"1.000"`/`"1,000"` DITOLAK dengan pesan ambigu; kosong → "Quantity kosong" |
| `components/inventory/StockImportModal.tsx` | **B**: tabel error baru dgn kolom SKU/Quantity mentah + badge "Template". **D**: guard review — katalog kosong (0 match) → box merah; ≥80% notFound → box amber; keduanya mengarahkan ke tombol **Import Barang** dulu |
| `test/lib/inventory-import.test.ts` | +4 test: raw capture, template-row (fixture struktur DATA_BARANG nyata), separator reject anti-silent-corruption, pesan spesifik qty kosong/-/desimal |

### 🧪 TESTING
`bunx tsc --noEmit` ✅ · `bun run build` ✅ Compiled successfully · `bun run test` ✅ 13 file / **132 passed** (25 import). Flow apply **tidak berubah**: existing SKU → current → delta → RPC `adjust_store_stock`; `service.ts` nol diff; tanpa migration/tulis DB.

### 📋 UNTUK USER (jalur A1)
1. Klik **Import Barang** (biru) → upload file Kasir Pintar (`DATA_BARANG_*.xls`) → katalog + stock gudang terbentuk.
2. Klik **Import Stok Toko** (hijau) → mapping SKU/KODE dll. → pratinjau delta → konfirmasi.
3. Catatan: baris instruksi template kini otomatis dikenali & ditandai, bukan error membingungkan.

### ✍️ SIGN-OFF
Developer: Sisyphus · Status: **Fix selesai & terverifikasi; menunggu UAT user (A1: seed katalog via Import Barang)**
