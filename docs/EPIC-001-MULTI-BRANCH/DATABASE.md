# Database Design

## EPIC-001: Enterprise Multi Branch System

---

## 1. Overview

Database architecture organized by **Domain** (see DOMAINS.md):

- **Identity Domain**: User authentication and roles
- **Branch Domain**: Multi-branch structure
- **Reference Domain**: Global configurations
- **Operational Domains**: Service, Transaction, Inventory, etc.

Each domain owns its entities and public interfaces.

---

## 2. Entity: Branch (Branch Domain)

### 2.1 Table Definition

```
branches
├── id (UUID, PK)
├── name (VARCHAR)
├── code (VARCHAR, UNIQUE)
├── location (TEXT)
├── phone (VARCHAR)
├── email (VARCHAR)
├── address (TEXT)
├── city (VARCHAR)
├── province (VARCHAR)
├── postal_code (VARCHAR)
├── status (ENUM: active|inactive)
├── is_deleted (BOOLEAN) ← Soft delete
├── created_at (TIMESTAMPTZ)
├── updated_at (TIMESTAMPTZ)
└── created_by (UUID, FK→profiles.id)
```

**Purpose**: Master branch registry

- Self-contained (not branch-scoped)
- Referenced by other tables via FK
- Soft-deletable (preserves historical data)

---

## 3. Single Branch Per User Model (Identity Domain)

### 3.1 User Profile (Identity Domain)

Store branch assignment directly in profiles table (1:1 relationship):

```sql
ALTER TABLE profiles ADD COLUMN branch_id UUID NOT NULL
  REFERENCES branches(id) ON DELETE RESTRICT;
```

**Schema**:

```
profiles (Identity Domain - no branch_id scoping)
├── id (UUID, PK, FK→auth.users)
├── email (UNIQUE)
├── full_name
├── gender
├── role (owner|manager|admin|technician|qc)
├── branch_id (FK→branches.id) ← Single branch assignment
├── created_at
└── updated_at
```

**Rationale**:

- Each user assigned to exactly ONE branch (1:1)
- Simpler than M:N table (current business model)
- Branch change = UPDATE profiles.branch_id (admin action)
- Prevents complex permission lookups

**Key Constraint**:

```sql
ALTER TABLE profiles ADD CONSTRAINT chk_branch_not_null
  CHECK (branch_id IS NOT NULL);

ALTER TABLE profiles ADD CONSTRAINT fk_profiles_branch
  FOREIGN KEY (branch_id) REFERENCES branches(id)
  ON DELETE RESTRICT;  -- Cannot delete branch with users
```

---

## 4. Table Categorization by Domain

### 4.1 IDENTITY DOMAIN (System-Wide)

**Definition**: User authentication, roles, permissions. Foundational (no branch_id).

| Table           | Domain    | Purpose                                   | branch_id?   |
| --------------- | --------- | ----------------------------------------- | ------------ |
| **profiles**    | Identity  | User accounts (1:1 branch)                | ❌ (FK only) |
| **roles**       | Reference | Role definitions (owner, manager, etc.)   | ❌           |
| **permissions** | Reference | Permission keys (e.g., "branch.read.all") | ❌           |

**Query Pattern**:

```sql
-- Get user profile
SELECT * FROM profiles WHERE id = user_id;
-- Returns: { id, email, role, branch_id }
-- No WHERE branch_id filter needed (only 1 user)
```

### 4.2 BRANCH DOMAIN

**Definition**: Organizational structure (master data).

| Table    | Purpose                | branch_id?          |
| -------- | ---------------------- | ------------------- |
| branches | Branch master registry | ❌ (self-contained) |

---

### 4.3 REFERENCE DOMAIN (Global)

**Definition**: System-wide reference data used by all branches.

| Table              | Purpose                    | branch_id? |
| ------------------ | -------------------------- | ---------- |
| watch_brands       | Watch brand reference      | ❌         |
| watch_models       | Watch model configurations | ❌         |
| service_categories | Service type categories    | ❌         |
| service_jasa       | Service/labor items        | ❌         |

**Query Pattern**:

```sql
-- No branch filter (global reference)
SELECT * FROM watch_brands WHERE name LIKE 'Rolex%';
```

---

### 4.4 OPERATIONAL TABLES (All need branch_id)

#### Transaction Domain

| Table             | Purpose                 | branch_id? |
| ----------------- | ----------------------- | ---------- |
| **layanan**       | Main transactions       | ✅ YES     |
| **layanan_items** | Transaction line items  | ✅ YES     |
| **expenses**      | Operating expenses      | ✅ YES     |
| **closings**      | Daily financial closing | ✅ YES     |

#### Service Domain

| Table                     | Purpose                 | branch_id? |
| ------------------------- | ----------------------- | ---------- |
| **service_orders**        | Service order records   | ✅ YES     |
| **service_items**         | Service line items      | ✅ YES     |
| **service_documentation** | Photos/documentation    | ✅ YES     |
| **service_timeline**      | Activity timeline       | ✅ YES     |
| **qc_reviews**            | Quality control records | ✅ YES     |

#### Inventory Domain

| Table               | Purpose                  | branch_id? |
| ------------------- | ------------------------ | ---------- |
| **inventory**       | Stock levels             | ✅ YES     |
| **stock_transfers** | Inter-location transfers | ✅ YES     |

#### Support Domains

| Table             | Domain       | Purpose           | branch_id? |
| ----------------- | ------------ | ----------------- | ---------- |
| **attendances**   | Attendance   | Employee check-in | ✅ YES     |
| **feedbacks**     | Service      | Customer feedback | ✅ YES     |
| **notifications** | Notification | User alerts       | Nullable   |
| **activity_logs** | Activity Log | Audit trail       | Nullable   |

**Query Pattern** (all operational queries):

```sql
-- Always scoped by branch
SELECT * FROM service_orders
WHERE branch_id = user_branch_id
  AND status = 'pending';
```

---

## 5. Schema Changes: branch_id Addition

### 5.1 Profiles Table (Identity Domain - FK only)

```sql
ALTER TABLE profiles
  ADD COLUMN branch_id UUID NOT NULL
  REFERENCES branches(id) ON DELETE RESTRICT;
```

**Impact**: User must have valid branch assignment (cannot delete branch if users assigned).

### 5.2 All Operational Tables (FK + NOT NULL)

**Pattern**: All operational tables require branch_id

```sql
-- Service Orders
ALTER TABLE service_orders ADD COLUMN branch_id UUID NOT NULL
  REFERENCES branches(id) ON DELETE CASCADE;

-- Transactions
ALTER TABLE layanan ADD COLUMN branch_id UUID NOT NULL
  REFERENCES branches(id) ON DELETE CASCADE;

-- Inventory
ALTER TABLE inventory ADD COLUMN branch_id UUID NOT NULL
  REFERENCES branches(id) ON DELETE CASCADE;

-- All operational tables follow same pattern
```

**Constraints**:

- NOT NULL: Every record must belong to a branch
- FK: branch_id must exist in branches table
- CASCADE: If branch deleted, related records deleted

### 5.3 Optional Domains (Nullable branch_id)

Some tables can be system-wide or branch-specific:

```sql
-- Notifications (can be system-wide or branch-specific)
ALTER TABLE notifications ADD COLUMN branch_id UUID
  REFERENCES branches(id) ON DELETE SET NULL;
-- NULL = system-wide notification
-- Non-NULL = branch-specific notification

-- Activity Logs (can span system or be branch-scoped)
ALTER TABLE activity_logs ADD COLUMN branch_id UUID
  REFERENCES branches(id) ON DELETE SET NULL;
```

---

## 6. Indexing Strategy

### 6.1 Critical Indexes

```sql
-- Identity/Branch lookups
CREATE UNIQUE INDEX idx_branches_code ON branches(code);
CREATE INDEX idx_profiles_branch_id ON profiles(branch_id);

-- Operational query optimization (CRITICAL)
CREATE INDEX idx_service_orders_branch_id
  ON service_orders(branch_id);
CREATE INDEX idx_service_orders_branch_status
  ON service_orders(branch_id, status);
CREATE INDEX idx_service_orders_branch_created
  ON service_orders(branch_id, created_at DESC);

CREATE INDEX idx_layanan_branch_id ON layanan(branch_id);
CREATE INDEX idx_layanan_branch_created
  ON layanan(branch_id, created_at DESC);

CREATE INDEX idx_inventory_branch_id ON inventory(branch_id);
CREATE INDEX idx_expenses_branch_id ON expenses(branch_id);
CREATE INDEX idx_attendances_branch_id ON attendances(branch_id);

-- All operational queries: WHERE branch_id = X
-- branch_id should ALWAYS be first in composite indexes
```

---

## 7. Branch Context (Runtime Object)

Not a table, but critical for understanding architecture.

```typescript
BranchContext {
  // Identity
  userId: string;
  email: string;
  role: "owner" | "manager" | "admin" | "technician" | "qc";

  // Branch scope (current session)
  branchId: string;
  branchName: string;

  // Permissions
  permissions: Permission[];

  // Future-ready (not used yet)
  companyId?: string;  // Ready for Multi-Company expansion
}
```

Built after successful authentication, passed through every request to Repository layer.

See **ARCHITECTURE.md** Section 3: "Branch Context" for full details.

---

## 8. Foreign Key Strategy

### 8.1 Cascade DELETE (Operational Tables)

```sql
-- If branch deleted, cascade delete all related records
ALTER TABLE service_orders
  ADD CONSTRAINT fk_service_orders_branch
  FOREIGN KEY (branch_id) REFERENCES branches(id)
  ON DELETE CASCADE;
```

**Use Case**: Delete branch → all service_orders deleted

**Risk**: Could lose data accidentally. Mitigation: Use soft-delete on branches table.

### 8.2 RESTRICT (Identity Tables)

```sql
-- Prevent deletion of branch if users assigned
ALTER TABLE profiles
  ADD CONSTRAINT fk_profiles_branch
  FOREIGN KEY (branch_id) REFERENCES branches(id)
  ON DELETE RESTRICT;
```

**Behavior**: DELETE branches WHERE id=X → ERROR (users still assigned)

### 8.3 Soft Delete on Branches

```sql
-- Don't actually delete branches, mark as deleted
ALTER TABLE branches ADD COLUMN is_deleted BOOLEAN DEFAULT false;

-- Archive instead of cascade delete
CREATE TRIGGER prevent_branch_hard_delete
  BEFORE DELETE ON branches
  FOR EACH ROW
  EXECUTE FUNCTION prevent_delete();

-- To "delete" a branch:
UPDATE branches SET is_deleted = true WHERE id = branch_id;
-- Historical data preserved
```

---

## 9. Data Isolation Strategy (Application-Layer)

### 9.1 Query Pattern (All Operational Queries)

Every operational query must include branch filter:

```typescript
// Repository layer enforces this
export async function getServiceOrders(branchId: string) {
  return db.from("service_orders").select("*").eq("branch_id", branchId); // ← MANDATORY filter
}
```

### 9.2 Special Case: Owner Queries

Owner can query without branch filter:

```typescript
export async function getServiceOrders(branchId: string) {
  const profile = await getProfile(userId);

  let query = db.from("service_orders").select("*");

  if (profile.role !== "owner") {
    query = query.eq("branch_id", branchId); // Non-owner: scoped
  }
  // Owner: no filter (gets all branches)

  return query;
}
```

---

## 10. No RLS (Row-Level Security)

**Decision**: Enforce isolation at application layer, not database layer.

See **ARCHITECTURE.md** and **DECISIONS.md → ADR-007** for rationale.

---

## 11. No Denormalization

**Decision**: Store only branch_id, JOIN for metadata.

```sql
-- Store: branch_id only (simple)
SELECT * FROM service_orders WHERE branch_id = 'jember-uuid';

-- Need branch_name? JOIN:
SELECT so.*, b.name as branch_name
FROM service_orders so
JOIN branches b ON so.branch_id = b.id
WHERE so.branch_id = 'jember-uuid';
```

Performance: < 100ms (negligible, not a bottleneck)

See **DECISIONS.md → ADR-008** for rationale.

---

## 12. ERD (Entity Relationship Diagram)

```
┌──────────────┐
│   branches   │
├──────────────┤
│ id (PK)      │
│ name         │
│ code         │
│ status       │
│ is_deleted   │
└──────┬───────┘
       │ FK
       │
┌──────▼────────────┐
│     profiles      │ (Identity Domain)
├───────────────────┤
│ id (PK)           │
│ email             │
│ role              │
│ branch_id (FK) ───┼──┐
│ created_at        │  │
└───────────────────┘  │
                       │
    ┌──────────────────┘
    │
    │ 1:N (all operational tables)
    │
┌───▼──────────────────┐
│  service_orders      │ (Service Domain)
├──────────────────────┤
│ id (PK)              │
│ branch_id (FK) ──────┼──┐
│ invoice_number       │  │
│ status               │  │
└──────────────────────┘  │
                          │
                     ┌────┘
                     │
                     ▼
          (All operational tables
           have same pattern:
           branch_id FK to branches)
```

---

## 13. Domain Boundaries

### Identity Domain (No branch_id scoping)

```
profiles → branch_id (FK reference only)
roles → (global)
permissions → (global)
```

### Branch Domain (Master data)

```
branches → (self-contained)
```

### Operational Domains (All branch-scoped)

```
service_orders → branch_id (mandatory)
layanan → branch_id (mandatory)
inventory → branch_id (mandatory)
... (all operational tables)
```

See **DOMAINS.md** for complete domain architecture.

---

## 14. Migration Notes

See **MIGRATION.md** for step-by-step migration procedure.

**Summary**:

1. Create branches table
2. Add branch_id to profiles
3. Add branch_id to all operational tables
4. Create default branch
5. Assign all users to default branch
6. Create indexes
7. Validate and test
