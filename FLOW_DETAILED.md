# ARLOGIC WEB SERVICES — FULL FLOW & FITUR DOCUMENTATION

## Generated: 2026-08-02
## Source: Codebase Audit (Full Audit)

---

## 1. ARSITEKTUR & TEKNOLOGI

| Layer | Teknologi |
|-------|-----------|
| **Frontend** | Next.js 16 (App Router), React 19, Tailwind CSS 4, TypeScript |
| **Backend** | Next.js API Routes, Supabase Client/Server/Admin, Inngest |
| **Database** | Supabase PostgreSQL, UUID PK, Foreign Key Relational |
| **Storage** | AWS S3 (Cloudflare R2), Supabase Storage |
| **State** | Zustand (authStore, serviceStore, transactionStore, notificationStore) |
| **UI** | Radix UI, Lucide Icons, Framer Motion, Recharts |
| **Auth** | Supabase Auth (cookie-based SSR + client-side) |
| **Background Jobs** | Inngest: upload worker, retry, cleanup |
| **Mobile** | Responsive, MobileBottomNav component |
| **Monitoring** | Sentry, Vercel Analytics |
| **Telegram** | Bot integration (service notifications, closing, expenses, chat) |

---

## 2. ROLE SYSTEM (8 ROLES)

| Role | Profile Column | Dashboard | Scope |
|------|----------------|-----------|-------|
| **admin** | profiles.branch_id | `/admin` | Per cabang (branch_id) |
| **teknisi** | profiles.branch_id | `/teknisi` | Per cabang, hanya service sendiri |
| **qc** | profiles.branch_id | `/qc` | Per cabang, review pending |
| **supervisor** | profiles.branch_id = null OR set | `/supervisor` | Semua cabang |
| **owner** | profiles.branch_id = null | `/owner` | Semua cabang (global analytics) |
| **engineer** | profiles.branch_id | `/engineer` | Per cabang + stock approver |
| **manager** | profiles.branch_id | (shared) | Per cabang |
| **admin_gudang** | profiles.branch_id | (shared) | Gudang / stock management |

### Flag tambahan di profil:
- `is_stock_approver: boolean` — untuk pastikan stok hanya di approve oleh role tertentu
- `is_engineer: boolean` — untuk engineer dashboard

### RBAC (Role Based Access Control)
- **Owner**: bisa lihat semua cabang (tanpa branch filter), switch branch di selector
- **Supervisor**: bisa lihat semua cabang (tanpa branch filter di dashboard)
- **Admin/Teknisi/QC**: hanya cabang masing-masing (scoped by branch_id)
- **Engineer**: diliput per cabang + stock approval

---

## 3. BRANCH / MULTI-CABANG

### Current Branches (di tabel `branches`)
- Jember (JBR) — **Pusat** (is_central = true)
- Kudus (KDS) — cabang

### Branch Context Runtime (tidak di database tapi di React Context)
```typescript
const { branchId } = useBranchScope()
// or
const { activeBranch, branches, setActiveBranchId, isGlobal } = useBranch()
```

### Semua data di-scope via `branch_id` di 30 tabel:
1. profiles
2. service_orders
3. service_items
4. service_timeline
5. service_documentation
6. service_jasa
7. sparepart_requests
8. sparepart_conversations
9. attendance
10. activity_logs
11. customers
12. closings
13. expenses
14. notifications
15. reports
16. announcements
17. inventory (via stock_toko & stock_gudang)
18. inventory_stocks (branch_id per lokasi)
19. stock_transfers
20. stock_toko (per branch)
21. stock_gudang (pusat)
22. trackings_logs
23. feedbacks
24. layanan (transactions)
25. layanan_items
26. upload sessions/drafts/events
27. whatsapp_templates
28. qc_reviews
29. qc_recalls

### Branch Selector (semua dashboard)
Setiap dashboard memiliki BranchSelector untuk memilih cabang (hanya untuk role global seperti Owner, Supervisor). Role per cabang tidak bisa memilih branch lain.

---

## 4. ADD SERVICE FLOW (Admin / Kasir)

### Tahap Detail

#### Step 1: Customer
- Nama (required)
- Nomor WhatsApp
- Additional Phone (optional)
- Upload foto KTP/Customer bisa (optional)

#### Step 2: Device / Watch
- Brand: ROLEX, OMEGA, TAG HEUER, CASIO, SEIKO, CITIZEN, TISSOT, LONGINES, BREITLING, CARTIER, APPLE WATCH, SAMSUNG WATCH, GARMIN, FOSSIL, SWATCH
- Model (free text)
- Watch Movement: AUTOMATIC, QUARTZ, DIGITAL, ANALOG-DIGITAL, SMARTWATCH
- Condition: NEW, EXCELLENT, GOOD, FAIR, POOR
- Serial Number (optional)
- Category (optional)
- Accessories: Multi-select (+ tali, + box, + dokumen, etc)

#### Step 3: Photos
- Upload up to 5 foto jam tangan (kondisi awal)
- Camera support, Drag&Drop, atau Select File
- HEIC conversion automatic (via heic2any)
- Upload via R2 to `service` bucket

#### Step 4: Issue & Payment
- Issue Description (wajib)
- Customer Request / Catatan (optional)
- Down Payment (angka) + Metode Pembayaran (Cash, QRIS, Transfer, EDC, dll)
- QR Code dihasilkan untuk tracking

### Data yang diinsert:
1. `service_orders` - tabel service utama (invoice_number, token, data customer & device, status = 'pending', `branch_id`)
2. `service_documentation` - foto kondisi awal (photo_url, stage='initial_condition', `branch_id`)
3. `layanan` - down payment transaksi (jenis_layanan='dp_service', nominal, `branch_id`)
4. `customers` - data customer (phone, name, aktivitas) + point system
5. `activity_logs` - log aktivitas pembuatan service

### Token & QR
- Token auto-generated (prefix `SVC-` atau random)
- QR Code menampilkan: `https://arlogic.net/tracking/{token}`
- Tokens bisa invalidated jika expired (token_expires_at)

### Status awal: `pending`

---

## 5. TEKNISI FLOW (E2E)

### 5.1 Queue List (Halaman Utama Teknisi)

**Fitur:** 3 Tabs
1. **Available**: Semua service dengan status `pending` (menunggu). Bisa di-take.
2. **My Projects**: Service dengan status `assigned`, `in_progress`, `req_sparepart_admin`, `po_pending`
   Grouped by status: Active + Pending (teknisi pending)
3. **Pending Approval**: Service dengan status tl status `pending_teknisi` (ditunda by teknisi, waiting QC approve)

### 5.2 Take Project (Ambil Service)
- Teknisi klik "Ambil" → `service_orders.status` = `assigned`, `assigned_teknisi_id` = tektnisi.id
- Service pindah ke tab "My Projects"
- Auto-generar timeline entry: `status: assigned`, message: "Teknisi {nama} mengambil service"
- File modified: `QueueList.tsx`, `ServiceDetailModal.tsx`

### 5.3 Progress Update (Update Pengerjaan)
**Steps:**
1. Update foto progress (minimal 1 foto)
2. Tambah catatan pengerjaan (opsional)
3. Save Progress: Upload foto -> insert ke `service_documentation` + timeline entry

**Tersedia tombol:** "TERUSKAN" atau "CANCEL"

### 5.4 Add Jasa (To Service)
- Dari master database `service_jasa` (lookup)
- Teknisi input keyword -> dropdown autocomplete -> select
- Edit harga per item (default_price dari database, editable)
- Mengubah item jasa yang sudah terpasang
- Hapus/Add

**Insert:**
- `service_items` (item_type='jasa', name, quantity, price, is_final=false, `branch_id`)
- `service_timeline` (status='item_added', message='service item', details, `branch_id`)

### 5.5 Add Sparepart (Tambahkan Sparepart)
- Free form row-based entry (nama + quantity + notes + price)
- Non-inventory (bukan dari database inventory)
- Minimal 1 sparepart
- Insert: `service_items` (item_type='sparepart', `branch_id`), `service_timeline` (`branch_id`)

### 5.6 Request Sparepart ke Admin (Optional)
- Teknisi request sparepart telepon admin
- Entry: nama sparepart, quantity, source_type (warehouse/store)
- Status awal: `pending`
- Field: admin_response, responded_at
- Menu "Pending" -> admin: approve/reject

### 5.7 Sparepart Chat (Admin-Teknisi Conversation)
- For patrun: `sparepart_conversations` table
- Sender_id, sender_name, sender_role, creaeated_at, is_read
- For each request id

### 5.8 Sparepart Ready Adminsito
- Admin menandai service sparepart yang sudah ready (PO diterima)
- Service status di update ke `sparepart_ready`

### 5.9 Proses Pending (Pendingulus Function)
- Adi: teknisi bisa hold (mint pending)
- Pending Reason text - expiry/halangan/menungu
- Trigger event `pending_teknisi`
- `service_timeline`: status=`pending_teknisi`, details pending_reason
- QC harus approve / reject pending

### 5.10 Submit QC (Final Submit)
- Tidor semua jasa/spareparts) sudah terkumpul
- Foto sebanyak 5 foto kondisi akhir
- Final cost (total jasa + sparepart quantities)
- Checklist unture make (cum)

#### Submit QC steps:
1. Baku jasa/sparepart tersimpan
2. Upload foto kondisi akhir (2 gh.G, now ax)
3. Submit ke QC
   - `service_orders.status` = `qc_pending`
   - `service_timeline` entry created with status=`submitted_to_qc`
   - `branch_id` di semua tabel di-set

### 5.11 Teknisi Recall (before QC approves)
- Teknisi bisa "Pra" standar repetitive hingga NO QC approved
- Kondisi: service status = `qc_pending`
- Klik "Recall" — status becom `in_progress`
- Timeline moral: status => `in_progress` (recalled)

---

## 6. QC REVIEW FLOW (Human review / QC)

### 6.1 QC Service List
- Resources: qc role atau super
- Filter by teknisi or "all"
- Data items:
  - Semua services dg status `qc_pending`
  - QC / supervisor bisa filter berdasarkan branch_id (per cabang)

### 6.2 QC Review Modal
Informasi:
- Device/service info
- Final items (jasa + sparepart) dari teknisi
- Foto kondisi awal + setelah
- Approval form (review, notes)

### 6.3 QC APPROVE
Trigger Success:
- `service_orders.status` → `completed`
- `qc_reviews` insert (status:`approved`, reviewer_id, notes)
- `finalizeServiceItems(service_order_id)`:
  - Mark all `service_items.is_final = true`
  - Perhitungan: total_jasa, total_sparepart, grand_total
  - Set `service_orders.final_sparepart_total`, `final_jasa_total`
- Timeline entry: "QC Approve — Service selesai dan siap diambil"

### 6.4 QC REJECT (Revision)
Trigger Failure:
- `service_orders.status` → `revision_required`
- `qc_reviews` insert (status=`rejected`)
- Timeline: "QC Reject — {alasan}"

### 6.5 QC Recall (from completed)
- Completed services can be recalled (only from `completed` status)
- Recall: service goes to `revision_required`, QC recalled record stored
- `qc_recalls` table: reason, qc_id, timestamp (service to revision)

### 6.6 Pending Approval (Tech pending)
- "pending_approved" — approve teknisi pending (QC approval)
- "pending_rejected" — reject heat (service goes back to queue）

---

## 7. TRANSACTION FLOW (Layanan / Cash Register)

### 7. Layana Dashboard
**Component:** `TransactionManagement.tsx` — digunakan oleh Admin, Teknisi, QC, Supervisor

### 7 Jenis Layanan:
| Jenis | Arti | Detail |
|-------|------|--------|
| `service_langsung` | Servis langsung | Service langsung ke counter (tanpa service order) |
| `dp_service` | DP Service (down payment for service) | Terkait ke service_orders via relation |
| `ambil_jam_service` | Ambil Jam Service | Piutang kembali jam servised |
| `beli_jam` | Jual Jam Tangan | Over the counter |
| `order_online` | Order Online | Dropship atau online order |
| `pengeluaran` | Pengeluaran / Expense | Pengeluaran harian |
| `cashdraw` | Cash Draw | Uang tarik (internal) |

### Split Payments (2 metode)
- Split ke 2 metode pembayaran (contoh: Cash 50% + TRisc 50%)
- fields: `metode_pembayaran_1`, `nominal_1`, `metode_pembayaran_2`, `nominal_2`
- Country: `split_payment = true`

### Multi-Item Transactions
- `layanan_items` tabel (per layanan ID)
- Allowed: lebih dari 1 transmisi per transaksi
- Per data: SKU, nominal, etc

### Transaction Reports:
- Today
- Yesterday
- This month
- Filter by Payment Method

---

## 8. STOCK MANAGEMENT / INVENTORY

### 8.1 Inventory Management (Admin)
Undergone files:
- `InventoryManagement.tsx`: CRUD items (item_name, sku, category, price, stock)
- `InventoryCard.tsx`: Per item with stock view
- `CategoryManager.tsx`: CRUD categories
- `POSection.tsx`: Sparepart PO section

### 8.2 Stock
- **stock_gudang**: Warehouse (usi, no branch, pusat)
- **stock_toko**: Store per branch (2 stok kedua ian) level)

### 8.3 Transfer (Stock Transfer)
User roles: admin dan teknisi_stock
- Transfer from gudang ke gudang lain (short alaplue)
- Status: `pending` → `confirmed` konfirmasi
- Stock Approvers (dipilih user (profile.is_stock_approver)

### 8.4 Teknisi Stock
- Teknisi bisa melihat stock tokubm proper" (read only)
- Per branch via `stock_toko`

### 8.5 Excel Export/Import
- `/export` to Excel Import Barang via bot excel

---

## 9. DAILY MENUTUP (Daily Closing/CashOut)

### Steps:
1. Hitung hari ini → possible
2. Input nilai actual (semua uang` / transactions)
3. Hitung selisih: **expected** (-) **actual** = difference
4. Telegram notifikasi → group/satuan channel
5. Owner Approve atau kita "Reject"
   - Approve: `status = approved`
   - Reject: `status = rejected`, reason required

### Sequence:
```mermaid
graph TD;
    1[Admin: calculate total transaksi] > 2[Set data == actual?] -> 3[Kemungkinan difference] --> 4[Send Telegram to Owner Channel];
    4 --> 5[Owner: Approve / Reject — dengan alasan]
```

### Structure, Relations:
- **closings_table**: date, transactions, expected_amount, actual_amount, rejection, branch_id
-**spring similar**: with expiresOnce policy

---

## 10. PELANGGAN (Customer Management)

### Curved:
1. Customer data sinchronization (auto)
2. setiap service = user; labia
3. duplikut check: phone ur number baru set
4. Point system (points dari nominal)

### Core Tab:
1. **Recent**: List pelanggan terakir (dari terakhir, last transaction)
2. **Search** (Customer top)
  - by nama
  - by phone
3. **Import**: dari Kalau Excel (numerology format)

### Web:
- synchr=automatically every time employees navigate `services`
- WhatsApp contact button

---

## 11. TELEGRAM INTEGRATION (BOT)

### Penerapan
| Feature | chat | Form |
|---------|------|------|
| New service notification | service_order channel | create new service — notifikasi teknisi |
| Progress photo | dari channel per cabang | refer join unlink admin |
| Admin closing | closing group →channel type message |
| Spare Part Requests | dari request | technik user  send to admin|
| Pending SP hook channel Wilayah |

### Infrastructure:
- `/api/telegram/` routes (bojok hook) +`process` wallet
- Worker: Cloudflare URL prefix + channel re-routing (JBRMaxgikm).

---

## 12. AUDIT LEAD / ACTIVITY LOG

log) untuk lihat dan trans define apa yang di done'actio

### Funcek
```
action -> user_id + tempoat + timestamp + bra | branchir best to query
```

**Tracking for**: admin and / orir/atau cashManaging.

Events:
- `service_taken`, `sp predicts e added`, `payment_created` , `service evolution(testificar are we set):itally node} left|p|view
t’ morning
summerizing, subsequently if'debug

---

### 13. TRACKING PAGE (Customer Virtual)

#### Public Flow
1. Input token on racker page "in person"
2. Search the token (random generated patch
- queue_position (graphical boots)
  Info: Orders Way ibsh

Akum details:
1. Works payment (depos come)
2. Panoramf (if done)
3. Feedback uyu appla

### KUPOS:
1. Input user token search (1..5 char min) 4
2. The authentication

---

## 14. UPDATE & NOTIFICATIONS DET:

### Inapp notifications,
    withBars 'ORDER' : bells dll
### Tz (ureaderasha/
prod with telegram'telegram'>
atthere portabel ts fully basic

### Tong ERP visit ung
essage.create & communicationsp
▌ resource ▏ ⬚⬜

---

## 15: Survey FAQ émpact:

### PDF Covetralle (administration → export old chunking archived)
Command: 
### PDF Reports 「· REPORT ·」
| Report   | 1. invent global – handle |
| 2+ missing monthly 1 month
| 3+ me- hrs gch 

--- Generals All illustratem  

S in perspective, su usage fréquent lreffect clearly:

---

## 16. OWNER ANALYTICS DASHBOARD

### 7 chart sectors:
1. Revenue by day with totals
2. Top customers
4. customer source
5. In filed: with branch selector or all→branches render
6. Completion_totals &h
any concurrency ✅ crappy growth (booséayanan)

---

## ** 17. ENG岗位 Workshop Dash-Point **

Press stream:
— **announcements**: multi dialog atump Edit Button ~;
— Report flow 101 engineer** full workflow
— Bug reports (report concepttrans engineer submits diamond log ve

---

## ** 18. Surveiponents Structure	 (all)**

```
components/admin/   24  files:
    AdminDashboardAnalytics.tsx   (Owner analytics + summary)
    AdminSidebar.tsx
    AttendanceDashboard.tsx        (User & E attestation with 'branch_id')
    CategoryManager.tsx
    ClosingApproval.tsx
    ClosingDashboard.tsx
    CustomerAutocomplete.tsx
    DashboardCharts.tsx
    DoneService.tsx
    ExportReports.tsx
    ImportBarangModal.tsx
    InventoryCard.tsx
    InventoryFilter.tsx
    InventoryImportForm.tsx  
    InventoryManagement.tsx (CRUD)
    POSection.tsx
    QRCodeGenerator.tsx
    RoleManagement.tsx
    ServiceInput.tsx
    ServiceList.tsx
    SparepartChat.tsx
    SparepartReadyModal.tsx
    TemplateManager.tsx

components/layanan/        — 5 files:
     LayananForm.tsx
     LayananList.tsx
     TransactionManagement.tsx
     CashdrawForm.tsx
     PengeluaranForm.tsx

components/owner/           8 file:
     sure/Revenue deps Revenue/Visits export + shapers=”,

components/qc/SECO — 5 file:
    QCReviewModal**.tsx
    QCStats
    QCSidebar
    QCServiceList
    QCRecallModal
    AttendaceReport

components/teknisi/:               — 15 file:
   AddJasaModal.tsx, (lege+ inclusivity masih tadi)
   AddSparepartModal.tsx,
   AttendanceModal
   KaspinUpdate.tsx,  (rmSystem optional), casin
   QueueList.tsx — taku space da
   RequestSparepartModal.tsx
   ServiceDetailModal.tsx
   etc plein
```

---

## 19 DATABASE QUALITY PURSUIT — Full ER view:

■■■ Table kuras
| ... | profilc, service_orders, service_items, service_timeline, ... | Notification .... Spin e..., dll |

**Multi-branch** included Part CT amenities stored| each-label, from headquarters United to indent fe... and more's used.

% ■ triggers & policies B → the same table list.

---^ above errata, more social with directories all to
This report's".