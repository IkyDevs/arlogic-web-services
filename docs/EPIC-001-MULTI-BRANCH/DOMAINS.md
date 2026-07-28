# Domain Boundaries
## EPIC-001: Enterprise Multi Branch System

---

## Overview

Arlogic Watch Service architecture is organized into distinct **domains**, each with clear responsibilities, owned entities, and public interfaces. This modular design enables scalability, maintainability, and future growth.

### Domain Model

```
┌─────────────────────────────────────────────────────────┐
│                  Identity Domain                        │
│  (Users, Roles, Permissions, Authentication)           │
└────────────────────┬────────────────────────────────────┘
                     │
        ┌────────────▼──────────────┐
        │   Branch Context          │
        │   (Runtime Object)        │
        └────────────┬──────────────┘
                     │
    ┌────────────────┼────────────────┐
    │                │                │
    ▼                ▼                ▼
┌──────────┐   ┌──────────┐   ┌──────────────┐
│  Branch  │   │Transaction│  │  Service    │
│ Domain   │   │ Domain    │  │  Domain     │
└──────────┘   └──────────┘   └──────────────┘
    │                │                │
    ├─ Branches      ├─ Transactions  ├─ Service Orders
    ├─ Branch Mgmt   ├─ Customers     ├─ Timeline
    └─ Settings      ├─ Payment       ├─ Documentation
                     └─ Receipts      ├─ QC Reviews
                                      └─ Warranty

    Plus Supporting Domains:
    ├─ Inventory Domain (Stock, Transfers)
    ├─ Attendance Domain (Check-in/out)
    ├─ Expense Domain (Operating costs)
    ├─ Notification Domain (Real-time alerts)
    └─ Activity Log Domain (Audit trail)
```

---

## 1. Identity Domain

**Responsibility**: User authentication, authorization, and access control

### Owned Entities

```
profiles
├── id (UUID)
├── email (UNIQUE)
├── full_name
├── role (owner|manager|admin|technician|qc)
├── branch_id (FK→branches) ← Single branch per user
├── created_at
└── updated_at

roles (reference/global)
├── id
├── name (owner, manager, admin, etc.)
└── description

permissions (reference/global)
├── id
├── permission_key (e.g., "branch.read.all", "transaction.create.self")
├── description
└── resource
```

### Public Interfaces

```typescript
// Authentication
login(email, password) → JWT + BranchContext
logout() → void
refreshToken(JWT) → JWT + BranchContext

// Authorization
hasPermission(permission: string) → boolean
getPermissions() → Permission[]
```

### Dependency Rules

- ✅ **Can depend on**: Nothing (foundational domain)
- ❌ **Cannot depend on**: Any other domain (no circular deps)
- ⬅️ **Others depend on**: All domains (for auth checks)

### Design Principles

1. **Single Source of Truth**: User's branch is in profiles.branch_id (1:1)
2. **No M:N Complexity**: Users assigned to exactly one branch at a time
3. **Permission-Based**: Authorization based on permissions, not direct role checks
4. **Branch Context**: Runtime object built after successful authentication

---

## 2. Branch Domain

**Responsibility**: Multi-branch organizational structure and branch-level configuration

### Owned Entities

```
branches (branch master data)
├── id (UUID)
├── name
├── code (UNIQUE)
├── location
├── phone
├── email
├── address
├── city
├── province
├── postal_code
├── status (active|inactive|paused)
├── is_deleted (soft delete)
├── created_at
├── updated_at
└── created_by (FK→profiles)
```

### Public Interfaces

```typescript
// Branch Management (Owner only)
createBranch(branchData) → Branch
updateBranch(branchId, updates) → Branch
deactivateBranch(branchId) → void
listBranches() → Branch[]

// Branch Context
getBranchContext(userId) → BranchContext
validateBranchAccess(userId, branchId) → boolean
```

### Dependency Rules

- ✅ **Can depend on**: Identity Domain (for user validation)
- ❌ **Cannot depend on**: Other operational domains
- ⬅️ **Operational domains depend on**: Branch Domain (for branch_id FK)

### Design Principles

1. **Master Data**: Branches table is immutable reference data
2. **Soft Delete**: Deleted branches preserved for historical data
3. **Owner-Only**: Only Owner role can manage branches
4. **Single Source**: One branch registry for entire system

---

## 3. Branch Context (Runtime Object)

**Not a domain, but a critical architectural concept**

Built after successful authentication, carries branch scope through entire request.

### Structure

```typescript
BranchContext {
  // Current authentication
  userId: string;
  email: string;
  role: "owner" | "manager" | "admin" | "technician" | "qc";
  
  // Branch scope (current session)
  branchId: string;
  branchName: string;
  
  // Future-ready (not used yet)
  companyId?: string;
  
  // Authorization
  permissions: Permission[];
}
```

### Lifecycle

```
1. User submits credentials
        ↓
2. Supabase auth validates → JWT token
        ↓
3. Load profiles.branch_id
        ↓
4. Load permissions based on role
        ↓
5. Create BranchContext object
        ↓
6. Store in session + JWT claims
        ↓
7. Every API request extracts BranchContext
        ↓
8. Repository layer uses branchId for queries
        ↓
9. Authorization layer checks permissions
```

### Why BranchContext?

- **Encapsulation**: All branch scope in one object
- **Consistency**: Single source of truth per request
- **Type Safety**: TypeScript interfaces for compile-time checks
- **Future Ready**: `companyId` ready for Multi-Company expansion

---

## 4. Transaction Domain

**Responsibility**: Financial transactions, customer relationships, and payment tracking

### Owned Entities

```
layanan (transactions)
├── id (UUID)
├── branch_id (FK→branches)
├── customer_name
├── metode_pembayaran
├── jenis_layanan
├── nominal
├── created_at
└── updated_at

layanan_items (transaction line items)
├── id
├── layanan_id (FK)
├── branch_id (FK)
├── item_type
├── name
├── quantity
└── price

customers (customer master)
├── id
├── phone (UNIQUE)
├── name
├── email
├── address
└── created_at

expenses (operating expenses)
├── id
├── branch_id (FK)
├── item_name
├── amount
├── category
└── created_at
```

### Public Interfaces

```typescript
// Transactions
createTransaction(branchId, transactionData) → Transaction
listTransactions(branchId) → Transaction[]
getTransaction(branchId, transactionId) → Transaction

// Reporting
getRevenueSummary(branchId, dateRange) → RevenueReport
getExpenseReport(branchId, dateRange) → ExpenseReport
```

### Dependency Rules

- ✅ **Can depend on**: Branch Domain (for branch validation)
- ✅ **Can depend on**: Identity Domain (for user who created it)
- ❌ **Cannot depend on**: Service Domain (unrelated business flows)
- ⬅️ **Depends on it**: Notification Domain (payment alerts)

### Design Principles

1. **Branch-Scoped**: All transactions isolated by branch_id
2. **Immutable History**: Transactions never deleted (audit trail)
3. **Multi-Item**: Support line items per transaction
4. **Customer Master**: Reusable customer records across branches

---

## 5. Service Domain

**Responsibility**: Watch service order lifecycle, quality control, and completion

### Owned Entities

```
service_orders (main service records)
├── id (UUID)
├── branch_id (FK→branches)
├── invoice_number (UNIQUE)
├── token (tracking token)
├── customer_name
├── device info (brand, model, movement, etc.)
├── status (pending → assigned → in_progress → qc_pending → completed → done)
├── assigned_teknisi_id (FK→profiles)
├── created_at
└── completed_at

service_items (jasa/sparepart per service)
├── id
├── service_order_id (FK)
├── branch_id (FK)
├── item_type (jasa|sparepart)
├── name
├── quantity
└── price

service_timeline (activity log)
├── id
├── service_order_id (FK)
├── branch_id (FK)
├── status
├── message
└── created_at

service_documentation (photos)
├── id
├── service_order_id (FK)
├── branch_id (FK)
├── photo_url
├── stage (initial|progress|qc)
└── uploaded_by (FK→profiles)

qc_reviews (quality control)
├── id
├── service_order_id (FK)
├── branch_id (FK)
├── reviewer_id (FK→profiles)
├── status (approved|rejected)
├── notes
└── created_at
```

### Public Interfaces

```typescript
// Service Management
createServiceOrder(branchId, orderData) → ServiceOrder
assignTechnician(branchId, serviceId, techId) → void
updateServiceProgress(branchId, serviceId, update) → void
submitForQC(branchId, serviceId) → void

// QC Process
listPendingQC(branchId) → ServiceOrder[]
approveQC(branchId, reviewId) → void
rejectQC(branchId, reviewId, reason) → void

// Tracking (public)
getServiceByToken(token) → ServiceOrderPublic
```

### Dependency Rules

- ✅ **Can depend on**: Branch Domain, Identity Domain, Inventory Domain
- ❌ **Cannot depend on**: Transaction Domain (separate workflows)
- ⬅️ **Depends on it**: Notification Domain (status changes)

### Design Principles

1. **State Machine**: Clear status progression (pending → done)
2. **Branch-Scoped**: All records isolated by branch_id
3. **Public Tracking**: Customers can track via token (no login)
4. **Immutable Timeline**: Activity log never modified

---

## 6. Inventory Domain

**Responsibility**: Stock management, sparepart tracking, and inventory transfers

### Owned Entities

```
inventory (stock levels)
├── id (UUID)
├── branch_id (FK→branches)
├── sku (UNIQUE per branch)
├── name
├── quantity
├── location (store|warehouse)
├── created_at
└── updated_at

stock_transfers (inter-location moves)
├── id
├── branch_id (FK)
├── from_location
├── to_location
├── quantity
├── created_at
└── completed_at
```

### Public Interfaces

```typescript
// Inventory Management
getInventory(branchId) → InventoryItem[]
updateStock(branchId, sku, delta) → void
requestSparepart(branchId, techId, sparepart) → Request
approveSparepart(branchId, requestId) → void

// Stock Transfer
transferStock(branchId, from, to, quantity) → Transfer
```

### Dependency Rules

- ✅ **Can depend on**: Branch Domain, Identity Domain
- ❌ **Cannot depend on**: Service or Transaction domains
- ⬅️ **Depends on it**: Service Domain (sparepart requests)

---

## 7. Attendance Domain

**Responsibility**: Employee check-in/out tracking and time management

### Owned Entities

```
attendances (daily attendance)
├── id (UUID)
├── branch_id (FK→branches)
├── user_id (FK→profiles)
├── check_in_time
├── check_out_time
├── status (present|absent|late)
└── created_at
```

### Public Interfaces

```typescript
checkIn(branchId, userId) → Attendance
checkOut(branchId, userId) → void
getAttendanceReport(branchId, dateRange) → Attendance[]
```

### Dependency Rules

- ✅ **Can depend on**: Branch Domain, Identity Domain
- ❌ **Cannot depend on**: Any other domain

---

## 8. Expense Domain

**Responsibility**: Operating expense tracking and cost management

### Owned Entities

```
expenses (operating costs)
├── id (UUID)
├── branch_id (FK→branches)
├── item_name
├── amount
├── category
├── notes
├── created_at
└── created_by (FK→profiles)

closings (daily financial closing)
├── id (UUID)
├── branch_id (FK)
├── close_date
├── total_revenue
├── total_expenses
├── net_profit
└── approved_by (FK→profiles)
```

### Public Interfaces

```typescript
createExpense(branchId, expenseData) → Expense
listExpenses(branchId, dateRange) → Expense[]
getExpenseReport(branchId, dateRange) → ExpenseReport
createClosing(branchId, closingData) → Closing
```

### Dependency Rules

- ✅ **Can depend on**: Branch Domain, Identity Domain
- ❌ **Cannot depend on**: Service or Transaction domains

---

## 9. Notification Domain

**Responsibility**: Real-time alerts, user notifications, and system messages

### Owned Entities

```
notifications (user notifications)
├── id (UUID)
├── branch_id (FK→branches) ← nullable for system-wide
├── user_id (FK→profiles)
├── title
├── message
├── type (service_update|payment|qc|etc)
├── is_read
└── created_at
```

### Public Interfaces

```typescript
sendNotification(userId, message) → Notification
notifyBranch(branchId, message) → void
markAsRead(notificationId) → void
subscribeToUpdates(userId) → WebSocket
```

### Dependency Rules

- ✅ **Can depend on**: All domains (observes their events)
- ⬅️ **Others notify through**: Notification Domain (pub/sub)

### Design Principles

1. **Event-Driven**: Subscribes to events from other domains
2. **Optional Branch**: Null branch_id = system-wide notification
3. **Real-Time**: WebSocket support for live updates

---

## 10. Activity Log Domain

**Responsibility**: Audit trail, compliance, and historical tracking

### Owned Entities

```
activity_logs (audit trail)
├── id (UUID)
├── branch_id (FK→branches) ← nullable for system-wide
├── user_id (FK→profiles)
├── entity_type (service_order|transaction|etc)
├── entity_id
├── action (create|update|delete|approve)
├── changes (JSONB - what changed)
├── created_at
└── ip_address
```

### Public Interfaces

```typescript
logActivity(log: ActivityLog) → void
getAuditTrail(branchId, entityType, dateRange) → ActivityLog[]
getUserActivity(branchId, userId) → ActivityLog[]
```

### Dependency Rules

- ✅ **Can depend on**: All domains (observes their events)
- ⬅️ **Others log through**: Activity Log Domain (async)

### Design Principles

1. **Immutable**: Never modified (append-only log)
2. **Comprehensive**: Logs all significant actions
3. **Traceable**: Includes user, timestamp, IP address
4. **Queryable**: Supports audit queries by user/entity/time

---

## 11. Global Reference Domain

**Responsibility**: System-wide reference data and configurations

### Owned Entities

```
roles (role definitions)
├── id
├── name (owner|manager|admin|technician|qc)
└── description

permissions (permission definitions)
├── id
├── permission_key (e.g., "branch.read.all")
├── description
└── resource

watch_brands (reference data)
├── id
├── name

watch_models (reference data)
├── id
├── brand_id (FK)
├── name

service_categories (reference data)
├── id
├── name
└── description
```

### Public Interfaces

```typescript
// Configuration
getRoles() → Role[]
getPermissions() → Permission[]

// Reference Data
getWatchBrands() → WatchBrand[]
getServiceCategories() → ServiceCategory[]
```

### Dependency Rules

- ✅ **Can depend on**: Nothing (foundational)
- ❌ **Cannot depend on**: Any other domain
- ⬅️ **All domains depend on**: Reference Domain

---

## Domain Communication Patterns

### Synchronous (Request/Response)

```
API Layer
    ↓
Authorization (check permissions)
    ↓
Repository (apply branch filter)
    ↓
Domain Logic
    ↓
Response
```

### Asynchronous (Events)

```
Service Domain creates service
    ↓
Emit: "ServiceCreated" event
    ↓
Notification Domain: Send notification
Activity Log Domain: Log action
Inventory Domain: Check sparepart stock
```

---

## Consistency Rules

### Rule 1: Branch Isolation
Every table in operational domains must have `branch_id` (except reference data).

### Rule 2: Data Ownership
Each domain owns its entities. Cross-domain queries only through public interfaces.

### Rule 3: No Circular Dependencies
If A depends on B, B cannot depend on A.

### Rule 4: Permission-Based Authorization
Authorization checks use permissions, not roles.

```
❌ WRONG:
if (user.role == "admin") { ... }

✅ CORRECT:
if (hasPermission("transaction.create.self")) { ... }
```

### Rule 5: Branch Context Always Available
Every request must have BranchContext with:
- userId
- branchId
- permissions

---

## Future: Multi-Company Evolution

Current architecture supports future expansion to **Multi-Company**:

```
Today:
  Arlogic Group (1 company)
  └── Arlogic Watch Service (1 company, multi-branch)

Future:
  Arlogic Group (parent)
  ├── Arlogic Watch Service (company 1, multi-branch)
  ├── GOKKI (company 2, multi-branch)
  └── Future Product (company 3, multi-branch)
```

### Preparation Strategy

1. **BranchContext includes companyId** (prepared, not used yet)
2. **Domain boundaries already company-aware** (can add companyId to all tables)
3. **No breaking changes needed** when multi-company added
4. **Future migration path clear** (add company_id column, update queries)

### Example Future Evolution

```sql
-- Add company support (future, not implemented now)
ALTER TABLE branches ADD COLUMN company_id UUID;
ALTER TABLE profiles ADD COLUMN company_id UUID;
ALTER TABLE service_orders ADD COLUMN company_id UUID;
-- ... all operational tables

-- Update queries
SELECT * FROM service_orders 
WHERE company_id = ? AND branch_id = ? AND ...;
```

**Important**: This is **NOT part of EPIC-001 implementation**. It only shows that current architecture is future-proof.

---

## Domain Governance

### Adding New Domain

1. Define: Responsibility and owned entities
2. Specify: Public interfaces
3. Document: Dependency rules
4. Review: Against existing domains
5. Ensure: No circular dependencies
6. Add: To this document

### Modifying Existing Domain

1. Impact analysis: What domains depend on this?
2. Public interface: Can we keep it stable?
3. Breaking changes: What versions affected?
4. Migration: How to transition?

---

## Summary Matrix

| Domain | Responsibility | Tables | Branch-Scoped? |
|--------|----------------|--------|----------------|
| Identity | Auth & Users | profiles, roles, permissions | No (1 per system) |
| Branch | Multi-branch structure | branches | No (master data) |
| Transaction | Financial records | layanan, expenses | ✅ YES |
| Service | Watch service workflow | service_orders, qc_reviews | ✅ YES |
| Inventory | Stock management | inventory, stock_transfers | ✅ YES |
| Attendance | Employee tracking | attendances | ✅ YES |
| Expense | Cost tracking | expenses, closings | ✅ YES |
| Notification | Real-time alerts | notifications | Partial (nullable) |
| Activity Log | Audit trail | activity_logs | Partial (nullable) |
| Reference | Global config | roles, permissions, watch_* | No (global) |

---

## References

- See **ARCHITECTURE.md** for system-wide design
- See **DATABASE.md** for entity definitions
- See **RBAC.md** for authorization model
- See **DECISIONS.md** for design rationale

