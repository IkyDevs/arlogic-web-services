# Feature List

## Core Features

| Feature | Status | Description |
|---------|--------|-------------|
| Authentication & RBAC | ✅ | 5 roles: admin, teknisi, supervisor, owner, customer |
| Service Order Management | ✅ | Full CRUD with invoice, token tracking |
| Transaction Management | ✅ | Multi-payment method, DP, expense |
| Inventory Management | ✅ | Store + warehouse stock, category management |
| Attendance System | ✅ | Check-in/out with photo, location, work duration |
| User Management | ✅ | Role management, profile editing |
| Closing Dashboard | ✅ | End-of-day reconciliation |
| Export Reports | ✅ | Excel/PDF export |
| Template Management | ✅ | Message templates |
| Customer Portal | ✅ | Public tracking page + feedback |
| Telegram Integration | ✅ | Photo upload, caption generation |
| QC Workflow | ✅ | QC review, approve/reject, revision |
| Draft System | ✅ | Auto-save on forms (Layanan, Service, QC Review) |
| Discount System | ✅ | Custom discount with % calculation |

## Dashboard Features

| Feature | Admin | Teknisi | QC | Owner |
|---------|-------|---------|----|-------|
| Hero KPIs | ✅ | ✅ | ✅ | ✅ |
| Revenue Analytics | ✅ | ❌ | ❌ | ✅ |
| Trend Charts | ✅ | ❌ | ❌ | ✅ |
| Activity Feed | ✅ | ✅ | ❌ | ❌ |
| Service Queue | ❌ | ✅ | ✅ | ❌ |
| Technician Performance | ❌ | ✅ | ❌ | ✅ |
| Item Editing | ❌ | ❌ | ✅ | ❌ |
| Customer Management | ✅ | ✅ | ✅ | ✅ |

## Recent Changes (V27)

| Feature | Description |
|---------|-------------|
| Grouping Jenis Layanan | Multi-item transaksi ditampilkan per Type (UI-only) |
| Fix Edit Transaction | Extra items tidak hilang saat edit, data 100% identik |
| Konsistensi Data | `jenis_layanan` menyimpan nilai enum valid, label hanya untuk Telegram |

## Recent Changes (V26)

| Feature | Description |
|---------|-------------|
| Sparepart Modal | Simplified add sparepart outside timeline |
| QC Submit Notes | Optional teknisi notes on QC submission |
| Caption Format | Updated UPDATE QC caption format |
| QC Item Editing | Full CRUD on items (price, qty, name, add, delete) |
| Discount System | Custom discount with % calculation |
| Photo Preview | Image preview modal with navigation |
| QC Draft System | Auto-save/restore draft on QC Review |

## Upcoming

| Feature | Priority |
|---------|----------|
| Multi-branch support | Low |
| Advanced reporting | Medium |
| WhatsApp native integration | High |
