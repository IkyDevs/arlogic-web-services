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
