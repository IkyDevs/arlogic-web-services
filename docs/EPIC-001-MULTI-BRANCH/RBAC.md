# Role-Based Access Control & Permission-Based Authorization

## EPIC-001: Enterprise Multi Branch System

---

## 1. Authorization Model

EPIC-001 uses a **two-layer authorization model**:

### Layer 1: Role (Job Title)

```
owner | manager | admin | technician | qc
```

### Layer 2: Permissions (Capabilities)

```
permission_key = resource + action + scope

Examples:
  - "branch.read.all" (Owner: read any branch)
  - "branch.read.own" (Manager: read own branch)
  - "service_order.create.own" (Admin: create in own branch)
  - "transaction.create.own" (Admin: create in own branch)
  - "qc.approve.own" (QC: approve in own branch)
```

### Why Two Layers?

| Aspect                              | Role-Only | Permission-Based          |
| ----------------------------------- | --------- | ------------------------- |
| Easy to understand                  | ✅ Yes    | Need to learn permissions |
| Easy to change roles                | ✅ Yes    | Same process              |
| Easy to grant selective permissions | ❌ No     | ✅ Yes (future)           |
| Easy to scale                       | ❌ No     | ✅ Yes                    |

---

## 2. Permission Key Format

All permission keys follow pattern:

```
resource.action.scope

resource  = What (service_order, transaction, qc, branch)
action    = How (create, read, update, delete, approve)
scope     = Where (own, all)
```

### Examples

```
// Owner permissions
branch.create               - Create new branch
branch.read.all             - Read any branch
user.manage.all             - Manage any user
service_order.read.all      - Read any service order

// Manager permissions
branch.read.own             - Read own branch
user.manage.own             - Manage branch staff
service_order.read.own      - Read own branch orders
transaction.create.own      - Create transactions

// Admin permissions
service_order.create.own    - Create service orders
service_order.assign.own    - Assign technician
transaction.create.own      - Create transactions
inventory.manage.own        - Manage inventory

// Technician permissions
service_order.read.own      - Read assigned orders
service_order.update.own    - Update own work
sparepart.request.own       - Request sparepart

// QC permissions
qc.review.own               - Review in own branch
qc.approve.own              - Approve/reject QC
```

---

## 3. Role Definitions with Permissions

### 3.1 Owner (Global Admin)

**Assignment**: System-wide role (no branch assignment)

**Permissions**:

```
// Branch management
- branch.create
- branch.read.all
- branch.update.all
- branch.delete.all

// User management
- user.manage.all
- user.assign.all
- user.delete.all

// Operational access
- service_order.read.all
- transaction.read.all
- transaction.approve.all
- inventory.read.all

// System administration
- activity.read.all
- system.settings
```

**Special Behavior**:

- Queries without branch filter (gets all branches)
- Can switch branch context in dashboard
- Can see company-wide analytics

---

### 3.2 Manager (Branch Manager)

**Assignment**: 1 branch (profiles.branch_id)

**Permissions**:

```
// Branch operations
- branch.read.own
- branch.update.own

// User management (own branch)
- user.manage.own
- user.assign.own

// Operations
- service_order.read.own
- service_order.create.own
- service_order.assign.own
- transaction.read.own
- transaction.create.own
- transaction.approve.own
- inventory.read.own
- inventory.manage.own
```

**Behavior**:

- All queries scoped to own branch
- Can manage branch staff
- Can approve daily closing

---

### 3.3 Admin (Branch Administrator)

**Assignment**: 1 branch (profiles.branch_id)

**Permissions**:

```
// Operations (own branch)
- service_order.create.own
- service_order.assign.own
- transaction.create.own
- transaction.read.own
- inventory.manage.own
- expense.create.own

// User management (limited)
// (no user management - manager's role)
```

**Behavior**:

- Cannot manage users
- Cannot approve closing
- Daily operations only

---

### 3.4 Technician (Service Staff)

**Assignment**: 1 branch (profiles.branch_id)

**Permissions**:

```
// Limited operations
- service_order.read.own      (assigned to me)
- service_order.update.own    (own work only)
- sparepart.request.own
- attendance.check_in.own
- attendance.check_out.own
```

**Behavior**:

- Can only see assigned services
- Cannot access financial data
- Cannot manage anything

---

### 3.5 QC (Quality Control)

**Assignment**: 1 branch (profiles.branch_id)

**Permissions**:

```
// QC operations (own branch)
- service_order.read.own
- qc.review.own
- qc.approve.own
- qc.reject.own
```

**Behavior**:

- Can only review services in own branch
- Cannot modify approved services
- Cannot access financial data

---

## 4. Authorization Check Implementation

### 4.1 hasPermission() Function

```typescript
function hasPermission(permissionKey: string): boolean {
  // BranchContext contains full permission list loaded on login
  return context.permissions.some((p) => p.key === permissionKey);
}
```

### 4.2 API Route Pattern

```typescript
export async function POST(request: NextRequest) {
  const { branchId, permissions } = await getSessionContext(request);

  // Check permission
  if (!hasPermission("service_order.create.own")) {
    return NextResponse.json(
      { error: "Role cannot create service orders" },
      { status: 403 },
    );
  }

  // Proceed (branch_id enforced at repository layer)
  const serviceOrder = await createServiceOrder(branchId, data);
  return NextResponse.json({ success: true, data: serviceOrder });
}
```

### 4.3 Repository Pattern

```typescript
// Repository doesn't check role or permission
// Authorization already checked by middleware

export async function getServiceOrders(branchId: string) {
  // Simply apply branch filter
  // Permission check already done
  return db.from("service_orders").select("*").eq("branch_id", branchId);
}
```

---

## 5. BranchContext Structure

Loaded on login, contains all authorization info:

```typescript
BranchContext {
  // Identity
  userId: string;
  email: string;

  // Role (global)
  role: "owner" | "manager" | "admin" | "technician" | "qc";

  // Branch scope
  branchId: string;
  branchName: string;

  // Permissions (role-specific)
  permissions: [
    { key: "service_order.create.own", description: "Create order" },
    { key: "transaction.create.own", description: "Create transaction" },
    // ... all permissions for this role
  ];

  // Future (prepared, not used)
  companyId?: string;
}
```

---

## 6. Permission Matrix

### Full Permission Matrix by Role

| Permission               | Owner | Manager | Admin | Technician | QC  |
| ------------------------ | ----- | ------- | ----- | ---------- | --- |
| branch.create            | ✅    | ❌      | ❌    | ❌         | ❌  |
| branch.read.all          | ✅    | ❌      | ❌    | ❌         | ❌  |
| branch.read.own          | ❌    | ✅      | ❌    | ❌         | ❌  |
| user.manage.all          | ✅    | ❌      | ❌    | ❌         | ❌  |
| user.manage.own          | ❌    | ✅      | ❌    | ❌         | ❌  |
| service_order.create.own | ✅    | ✅      | ✅    | ❌         | ❌  |
| service_order.read.all   | ✅    | ❌      | ❌    | ❌         | ❌  |
| service_order.read.own   | ❌    | ✅      | ✅    | ✅         | ✅  |
| service_order.assign.own | ✅    | ✅      | ✅    | ❌         | ❌  |
| transaction.create.own   | ✅    | ✅      | ✅    | ❌         | ❌  |
| transaction.read.all     | ✅    | ❌      | ❌    | ❌         | ❌  |
| transaction.read.own     | ❌    | ✅      | ✅    | ❌         | ❌  |
| qc.approve.own           | ✅    | ❌      | ❌    | ❌         | ✅  |
| qc.reject.own            | ✅    | ❌      | ❌    | ❌         | ✅  |
| sparepart.request        | ✅    | ✅      | ✅    | ✅         | ❌  |
| inventory.manage.own     | ✅    | ✅      | ✅    | ❌         | ❌  |

---

## 7. Single Branch Per User

Reminder: Each user is assigned to **exactly ONE branch** (1:1 model).

```sql
profiles
├── id
├── email
├── role
└── branch_id ← Exactly one (not M:N)
```

**Branch Transfer**:

```sql
-- User moves to different branch
UPDATE profiles SET branch_id = 'new-branch-uuid' WHERE id = 'user-uuid';

-- User must re-login (session branch_id no longer valid)
```

---

## 8. Authorization Validation Points

### Point 1: Middleware (Extract Context)

```typescript
// Extract from JWT/session
const { userId, branchId, permissions } = getBranchContext(request);
```

### Point 2: Authorization (Check Permission)

```typescript
// Validate user has permission
if (!permissions.some(p => p.key === "service_order.create.own")) {
  return 403 Forbidden;
}
```

### Point 3: Repository (Apply Scope)

```typescript
// Enforce branch isolation in queries
WHERE branch_id = context.branchId;
```

---

## 9. Special Case: Owner Role

Owner doesn't have profiles.branch_id set to single branch.

**Instead**:

```typescript
// Check if role = 'owner'
if (user.role === "owner") {
  // Allow all branch queries (no WHERE branch_id filter)
  return getAllServiceOrders(); // All branches
} else {
  // Non-owner: scoped query
  return getServiceOrdersByBranch(user.branchId); // Own branch only
}
```

---

## 10. Domain Boundaries

See **DOMAINS.md** for complete domain architecture.

Each domain defines:

- Responsibility
- Owned entities
- Public interfaces
- Permission requirements

---

## 11. Summary

| Aspect                  | Implementation                  |
| ----------------------- | ------------------------------- |
| **Authorization Model** | Two-layer (Role → Permissions)  |
| **Permission Format**   | resource.action.scope           |
| **User-Branch Binding** | 1:1 (no M:N)                    |
| **Special Role**        | Owner (can query all branches)  |
| **Authorization Check** | hasPermission(key)              |
| **Repository Pattern**  | Applies branch_id filter        |
| **BranchContext**       | Runtime object with permissions |

See **ARCHITECTURE.md** and **DATABASE.md** for related content.
