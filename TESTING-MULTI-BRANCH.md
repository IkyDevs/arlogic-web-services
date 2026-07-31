# TESTING CHECKLIST — MULTI-BRANCH + PEROMBAKAN DASHBOARD

> Jalankan migration `db/migration-multi-branch.sql` di Supabase dulu sebelum testing.
> Data existing sudah punya `branch_id = JBR` (backfill).

---

## A. PERSIAPAN DATABASE (1x)

- [ ] **A1** Jalankan `db/migration-multi-branch.sql` di Supabase SQL Editor (tidak error)
- [ ] **A2** Cek kolom baru ada: `branches.is_central`, `profiles.is_engineer`, `profiles.is_stock_approver`, `profiles.home_branch_id`, `inventory.buy_price`, tabel `inventory_stocks`, `reports`, `announcements`, `branch_assignments`, `stock_transfers.status`
- [ ] **A3** Cek `branches` berisi Jember (is_central=true) & Kudus (is_central=false)
- [ ] **A4** Cek staff punya `branch_id = JBR` (query: `SELECT id, full_name, role, branch_id FROM profiles`)

---

## B. ROLE & ROUTING

- [ ] **B1** Login role **admin** → redirect ke `/admin` ✅
- [ ] **B2** Login role **teknisi** → redirect ke `/teknisi` ✅
- [ ] **B3** Login role **qc** → redirect ke `/qc` ✅
- [ ] **B4** Login role **supervisor** → redirect ke `/qc` (atau `/supervisor`) ✅
- [ ] **B5** Login role **owner** → redirect ke `/owner` ✅
- [ ] **B6** Teknisi dengan `is_engineer=true` → bisa akses `/engineer` ✅
- [ ] **B7** Teknisi tanpa `is_engineer` → akses `/engineer` ditolak (redirect) ✅
- [ ] **B8** Admin → akses `/users` tidak ada (menu hilang) ✅

---

## C. DASHBOARD QC (/qc) — PEROMBAKAN

- [ ] **C1** Role **qc** → menu hanya: Semua, Completed, Pending, Absensi, Customer, Transaksi, Done, List Service (**TANPA Users**)
- [ ] **C2** Role **qc** → data service qc_pending HANYA cabangnya (Kudus hanya lihat kudus)
- [ ] **C3** Role **supervisor** → menu lengkap termasuk **Users** (bisa add role)
- [ ] **C4** Role **supervisor** → bisa lihat QC SEMUA cabang
- [ ] **C5** QC approve/reject service tetap berfungsi

---

## D. DASHBOARD ADMIN (/admin)

- [ ] **D1** Menu **Users/Pengguna HILANG** (admin tidak bisa add role) ✅
- [ ] **D2** Admin **Jember** → menu **Gudang** muncul
- [ ] **D3** Admin **Kudus** → menu **Gudang TIDAK muncul**
- [ ] **D4** Admin jember buka tab **Gudang** → lihat stock gudang (warehouse_stock)
- [ ] **D5** Admin jember klik **Import Barang** di Gudang → modal terbuka
- [ ] **D6** Admin jember klik **Import Barang** di Inventaris → modal terbuka
- [ ] **D7** Data transaksi/service/absensi/customer admin → HANYA cabangnya (jember hanya jember)

---

## E. DASHBOARD TEKNISI (/teknisi)

- [ ] **E1** Menu baru **Stock Toko** muncul untuk SEMUA teknisi
- [ ] **E2** Buka Stock Toko → lihat nama sparepart, SKU, qty, harga, kategori
- [ ] **E3** **Searchbar** Stock Toko → cari nama / SKU / kategori bekerja
- [ ] **E4** Indikator stok menipis (merah jika stok <= min_stock)
- [ ] **E5** Teknisi dengan `is_stock_approver=true` → menu **Transfer** muncul
- [ ] **E6** Teknisi tanpa approver → menu Transfer TIDAK muncul
- [ ] **E7** Tab Transfer → lihat "Transferan Masuk" + "Riwayat"
- [ ] **E8** Teknisi dengan `is_engineer=true` → menu **Engineer** muncul → klik → buka `/engineer`
- [ ] **E9** Antrian service pending → HANYA cabang teknisi tersebut

---

## F. ENGINEER PANEL (/engineer)

- [ ] **F1** Overview menampilkan SEMUA cabang (Jember + Kudus) dengan jumlah service & transaksi
- [ ] **F2** Tab **Pengumuman** → buat pengumuman → terkirim (muncul di list)
- [ ] **F3** Tab **Laporan Bug** → lihat laporan dari staff (fitur Lapor)
- [ ] **F4** Ubah status laporan (Baru → Diproses → Selesai/Ditolak)
- [ ] **F5** Tab **Log Perubahan** → ada activity_logs
- [ ] **F6** Teknisi-engineer: tombol "← Dashboard Teknisi" muncul

---

## G. SUPERVISOR PANEL (/supervisor)

- [ ] **G1** Overview menampilkan semua cabang + jumlah teknisi
- [ ] **G2** Tab **Kelola User** → form Tambah User per cabang
- [ ] **G3** Buat user teknisi/admin/qc di cabang Jember → sukses (cek di list)
- [ ] **G4** Buat user di cabang Kudus → sukses
- [ ] **G5** **Rolling teknisi**: pilih teknisi → cabang tujuan → alasan → klik Rolling → branch_id berubah, home_branch_id tetap
- [ ] **G6** Daftar staff menampilkan " (rolling)" jika branch_id != home_branch_id
- [ ] **G7** Link **QC Jember** → buka `/qc`
- [ ] **G8** Supervisor TIDAK bisa akses `/users` sebagai admin (menu admin tidak ada)

---

## H. FITUR LAPOR (SEMUA ROLE)

- [ ] **H1** Tombol **Lapor** muncul di header semua dashboard (admin, teknisi, qc, owner, supervisor, engineer)
- [ ] **H2** Klik Lapor → modal terbuka (tipe: Bug/Request/Lainnya, judul, deskripsi, prioritas)
- [ ] **H3** Submit laporan → toast "Laporan terkirim"
- [ ] **H4** Laporan muncul di Engineer → Tab Laporan Bug
- [ ] **H5** Validasi: judul & deskripsi kosong → error toast

---

## I. SCOPE DATA PER CABANG

- [ ] **I1** Teknisi Jember → antrian service hanya Jember
- [ ] **I2** Admin Kudus → transaksi/customer/absensi hanya Kudus
- [ ] **I3** Owner → **BranchSelector** di header (Semua Cabang / Jember / Kudus)
- [ ] **I4** Owner pilih "Jember" → data/analytics hanya Jember
- [ ] **I5** Owner pilih "Semua Cabang" → data gabungan
- [ ] **I6** Supervisor → lihat semua cabang (selector)
- [ ] **I7** Teknisi Stock Toko → hanya stock toko cabangnya

---

## J. CLOSING PER CABANG

- [ ] **J1** Admin buat closing → `branch_id` tersimpan (cek DB)
- [ ] **J2** Owner → tab Closing → tiap closing menampilkan **nama cabang**
- [ ] **J3** Owner approve closing → tetap berfungsi (toast + Telegram)
- [ ] **J4** Owner filter closing per cabang via BranchSelector

---

## K. IMPORT BARANG (UI)

- [ ] **K1** Buka Inventaris → klik **Import Barang** → modal terbuka
- [ ] **K2** Upload file `DATA_BARANG_...xls` → preview muncul (nama, SKU, harga, stok, kategori)
- [ ] **K3** Jumlah barang terbaca sesuai file (~500)
- [ ] **K4** Klik Import → toast "Berhasil import X barang"
- [ ] **K5** Cek di list inventaris → barang muncul dengan `buy_price` terisi
- [ ] **K6** Import ulang file yang sama → tidak duplikat (upsert by SKU)

---

## L. MIGRASI & REGRESI (yang sudah fix — JANGAN RUSAK)

- [ ] **L1** Upload foto transaksi → Worker → Telegram → preview muncul ✅
- [ ] **L2** Upload 1 foto → foto tampil (Worker URL, token tidak expose)
- [ ] **L3** Upload HEIC → convert JPEG + loading bar per foto
- [ ] **L4** Edit transaksi → caption Telegram update / delete old message
- [ ] **L5** Statistik split payment + multi-jenis benar
- [ ] **L6** Fitur Hapus Draft → reset semua field
- [ ] **L7** Add Service → list auto-refresh (event new-service)
- [ ] **L8** 69 unit test tetap pass

---

## Catatan

- Data yang perlu dicek: `branch_id` sudah terisi di tabel bisnis (JBR untuk existing)
- Kalau ada bug saat test, catat: role, halaman, langkah, error message
- RLS branch BELUM diaktifkan (Phase 5) — data masih terbaca semua secara teknis, tapi query sudah di-filter per cabang
