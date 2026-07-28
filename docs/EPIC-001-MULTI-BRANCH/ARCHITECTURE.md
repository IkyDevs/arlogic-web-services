# Technical Architecture

## EPIC-001: Enterprise Multi Branch System

---

## 1. High-Level System Architecture

### Current → Target

```
CURRENT (Single Branch):
┌─────────────────────────────────────────┐
│            Browser (React 19)           │
│  Admin│Teknisi│QC│Owner Dashboards    │
└──────────────────┬──────────────────────┘
                   │
         ┌─────────▼──────────┐
         │  Next.js API       │
         │  Routes            │
         └──────────┬─────────┘
                    │
         ┌──────────▼─────────┐
         │ Supabase Auth      │
         │ Single-branch DB   │
         └────────────────────┘

TARGET (Multi Branch):
┌─────────────────────────────────────────┐
│            Browser (React 19)           │
│  [Branch Selector]                      │
│  Admin│Teknisi│QC│Owner Dashboards    │
└──────────────────┬──────────────────────┘
                   │
         ┌─────────▼──────────┐
         │ Scope Middleware   │
         │ Extract branch_id  │
         │ from session       │
         └──────────┬─────────┘
                    │
         ┌──────────▼──────────┐
         │  Authorization     │
         │  Check: role + op   │
         └──────────┬──────────┘
                    │
         ┌──────────▼──────────┐
         │ Repository Layer   │
         │ Add WHERE          │
         │ branch_id = X      │
         └──────────┬──────────┘
                    │
         ┌──────────▼─────────┐
         │ Supabase Auth      │
         │ + Postgres DB      │
         │ Multi-branch ready │
         └────────────────────┘
```

---

## 2. Branch Scope Strategy

### 2.1 Single Branch Per User (1:1 Model)

Every user is assigned to exactly ONE branch.

```
profiles table
├── id (UUID)
├── email
├── full_name
├── role (owner|manager|admin|technician|qc)
├── branch_id (FK→branches.id) ← Single assignment
├── created_at
└── updated_at
```

**Key Points**:

- Branch stored directly in profiles (not M:N table)
- Each user has exactly one branch_id
- Transfer to different branch = UPDATE profiles.branch_id
- Simpler than many-to-many, matches current business model

See **DECISIONS.md → ADR-004** for why this approach.

### 2.2 Flow: How Branch Gets to Query

```
1. User Logs In
   ├─ Email + password → Supabase Auth
   ├─ Get user.id from JWT
   ├─ Query: SELECT * FROM profiles WHERE id = user.id
   ├─ Extract: branch_id, role
   └─ Store in session/JWT: { userId, branchId, role }

2. Request Arrives
   ├─ Extract JWT from Authorization header
   ├─ Decode JWT → { userId, branchId, role }
   ├─ Store in request.context = { userId, branchId, role }
   └─ ❌ NEVER accept branch_id from request body/params

3. Authorization
   ├─ Check: Does user have permission for this operation?
   ├─ Check: Does this operation allow role = user.role?
   └─ If NO → return 403 Forbidden

4. Repository Query
   ├─ Query uses request.context.branchId
   ├─ WHERE branch_id = request.context.branchId ← ENFORCED
   └─ Returns only branch-scoped data

5. Response
   ├─ Include branch_id in response (for audit)
   └─ Client receives: { data: [...], branch_id: "jember-uuid" }
```

---

## 3. Branch Context (Runtime Object)

### 3.1 What is Branch Context?

**Not a database table.** A runtime object created after successful authentication.

```typescript
BranchContext {
  // Identity
  userId: string;
  email: string;
  role: "owner" | "manager" | "admin" | "technician" | "qc";

  // Branch scope (current session)
  branchId: string;
  branchName: string;

  // Authorization
  permissions: Permission[];

  // Future-ready (prepared but not used yet)
  companyId?: string;  // For Multi-Company expansion
}
```

**Purpose**: Encapsulate all branch scope into single object. Passed through entire request lifecycle.

### 3.2 JWT Flow with Branch Context

```
User submits credentials
    ↓
Supabase Auth validates
    ↓
JWT token created (contains user_id + email)
    ↓
Load from profiles: branch_id, role
    ↓
Load permissions based on role
    ↓
CREATE BranchContext object
    ↓
Store in:
  - JWT claims (compact)
  - Session cache (full object)
    ↓
Every API request:
  1. Extract JWT
  2. Decode → Get BranchContext
  3. Pass to middleware
  4. Pass to repository layer
    ↓
Repository uses branchId for queries
    ↓
Response includes branch_id for audit
```

### 3.3 BranchContext Lifecycle

```
Login
  │
  ├─ POST /login
  │  │
  │  ├─ Supabase: signIn(email, password)
  │  │
  │  ├─ Query: SELECT from profiles WHERE id = auth.uid()
  │  │
  │  ├─ Create BranchContext {
  │  │    userId: profile.id,
  │  │    email: profile.email,
  │  │    role: profile.role,
  │  │    branchId: profile.branch_id,
  │  │    permissions: getPermissionsFor(profile.role),
  │  │    companyId: null (reserved for future)
  │  │  }
  │  │
  │  └─ Return: { token, context }
  │
  ├─ Store in Browser:
  │  ├─ localStorage: { token, context }
  │  └─ Zustand store: context
  │
  └─ Every Request:
     │
     ├─ Extract: Authorization: "Bearer <JWT>"
     │
     ├─ Decode JWT → BranchContext
     │
     ├─ Middleware: Validate context still valid
     │
     ├─ Authorization: Check permissions
     │
     ├─ Repository: Query with branch_id
     │
     └─ Response: Include branch_id

Logout
  └─ Clear: localStorage, token, context
```

### 3.4 Permission-Based Authorization

Instead of checking role directly:

```typescript
// ❌ WRONG (Role-based)
if (user.role === "admin") {
  // Create service order
}

// ✅ CORRECT (Permission-based)
if (hasPermission("service_order.create.own_branch")) {
  // Create service order
}
```

**How it works**:

```typescript
function hasPermission(permissionKey: string): boolean {
  // Look up in context.permissions
  return context.permissions.some((p) => p.key === permissionKey);
}

// BranchContext includes full permission list loaded on login
context.permissions = [
  { key: "service_order.create.own_branch", description: "Create service" },
  { key: "transaction.create.own_branch", description: "Create transaction" },
  { key: "qc.approve.own_branch", description: "Approve QC" },
  // ... etc, based on role
];
```

---

## 4. Authentication & Session

### 4.1 Login Process

```typescript
// 1. Sign in with Supabase
const { data, error } = await supabase.auth.signInWithPassword({
  email: "admin@arlogic.com",
  password: "password",
});

// 2. Get user profile (includes branch_id)
const { data: profile } = await supabase
  .from("profiles")
  .select("id, email, role, branch_id")
  .eq("id", data.user.id)
  .single();

// 3. Store in session
const session = {
  userId: profile.id,
  email: profile.email,
  role: profile.role,
  branchId: profile.branch_id, // ← Loaded from DB
};

// 4. Store in localStorage + Zustand auth store
localStorage.setItem("session", JSON.stringify(session));
```

### 3.2 Session Extraction (Per Request)

```typescript
// Middleware extracts from JWT/session for EVERY request
export async function getSessionContext(request: NextRequest) {
  // Get JWT from Authorization header or cookie
  const token = request.headers.get("authorization")?.split("Bearer ")[1];

  // Decode JWT (Supabase does this)
  const { userId, branchId } = jwtDecode(token);

  // Validate: User still assigned to this branch?
  const isValid = await db
    .from("profiles")
    .select("branch_id")
    .eq("id", userId)
    .single();

  if (isValid.data.branch_id !== branchId) {
    throw new UnauthorizedError("Session branch mismatch");
  }

  return { userId, branchId, role: profile.role };
}
```

---

## 4. Authorization Flow

### 4.1 Per-Request Authorization

```
Incoming Request
    ↓
[1] Middleware: Extract branch_id from session
    ├─ Source: JWT token (trusted)
    ├─ ❌ Never from: request body, query params, headers sent by client
    └─ Result: request.context = { userId, branchId, role }
    ↓
[2] Validation: Is user assigned to this branch?
    ├─ Query: SELECT * FROM profiles WHERE id = userId
    ├─ Check: returned.branch_id === branchId
    └─ If NO → return 403 Forbidden
    ↓
[3] Authorization: Does role permit operation?
    ├─ Operation: 'create:service_order'
    ├─ Role permissions: Check RBAC matrix
    └─ If role doesn't have permission → return 403
    ↓
[4] Repository: Query with branch filter
    ├─ All queries: WHERE branch_id = request.context.branchId
    ├─ Cannot be overridden by request params
    └─ Enforced at repository layer
    ↓
[5] Response: Include branch_id for audit
    ├─ Response: { success: true, data: [...], branch_id: user_branch }
    └─ Audit log: userId, branchId, operation, success/fail
```

### 4.2 Role-Based Permission Check

```typescript
const PERMISSIONS = {
  owner: {
    "create:service_order": true,
    "approve:qc": true,
    "view:all_branches": true,
    "manage:users": true,
    "manage:branches": true,
  },
  manager: {
    "create:service_order": true,
    "approve:qc": true,
    "view:own_branch": true,
    "manage:users": false,
  },
  admin: {
    "create:service_order": true,
    "view:own_branch": true,
  },
  technician: {
    "update:own_service": true,
    "request:sparepart": true,
  },
  qc: {
    "review:qc": true,
    "approve:qc": true,
  },
};

export async function authorize(context, operation) {
  const { userId, branchId, role } = context;

  // Special case: Owner can do anything
  if (role === "owner") return;

  // Check role has permission
  if (!PERMISSIONS[role][operation]) {
    throw new ForbiddenError(`Role ${role} cannot ${operation}`);
  }
}
```

---

## 5. Repository Layer (Branch Enforcement)

### 5.1 Query Pattern: Always Include Branch Filter

```typescript
// ❌ WRONG - No branch isolation
export async function getServiceOrders() {
  return db.from("service_orders").select("*");
  // Returns ALL service orders (wrong!)
}

// ✅ CORRECT - Branch enforced
export async function getServiceOrders(branchId: string) {
  return db.from("service_orders").select("*").eq("branch_id", branchId); // ← MANDATORY
}

// ✅ CORRECT - Used in API routes
export async function GET(request: NextRequest) {
  const { branchId } = await getSessionContext(request);

  // Repository layer enforces branch filter
  const orders = await getServiceOrders(branchId);

  return NextResponse.json({ data: orders, branch_id: branchId });
}
```

### 5.2 Service Layer Pattern

```typescript
// lib/services/serviceOrderService.ts

export async function getServiceOrders(
  branchId: string, // ← Always required
  filters?: { status?: string },
) {
  let query = db.from("service_orders").select("*").eq("branch_id", branchId); // ← Enforced here

  if (filters?.status) {
    query = query.eq("status", filters.status);
  }

  return query;
}

export async function createServiceOrder(
  branchId: string, // ← Always required
  data: ServiceOrderInput,
) {
  return db
    .from("service_orders")
    .insert({
      ...data,
      branch_id: branchId, // ← Forced from session, not from input
    })
    .select()
    .single();
}
```

### 5.3 Middleware Setup

```typescript
// middleware.ts

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;

  // Skip public routes
  if (["/login", "/tracking", "/feedback"].some((p) => path.startsWith(p))) {
    return NextResponse.next();
  }

  // 1. Extract session
  const session = await getSession(request);
  if (!session?.user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // 2. Get branch context
  const profile = await getProfile(session.user.id);
  const branchId = profile.branch_id;

  // 3. Add to request context (for API routes)
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-branch-id", branchId);
  requestHeaders.set("x-user-id", session.user.id);
  requestHeaders.set("x-user-role", profile.role);

  return NextResponse.next({
    request: { headers: requestHeaders },
  });
}
```

---

## 6. Why No RLS?

### Application-Level Isolation (Chosen)

```
Enforcement Points:
1. Middleware:    Extract branch_id from session
2. Authorization: Check role permission
3. Repository:    Add WHERE branch_id = X to queries
```

**Benefits**:

- Testable (unit tests for each layer)
- Debuggable (stack traces show problem)
- Version controlled (code in git)
- Team expertise aligned (middleware/repo patterns known)

**Why Not RLS?**

- Adds complexity (PostgreSQL-specific)
- Harder to test (requires database setup)
- Harder to version control (policies in database)
- Current scale doesn't justify it (5-10 branches is small)
- Team would need to learn RLS patterns

See **DECISIONS.md → ADR-007** for full rationale.

### Future: Can Add RLS as Defense-in-Depth

If security requirements change or team grows:

```sql
-- Add RLS policy later, WITHOUT changing app code
CREATE POLICY branch_isolation ON service_orders
  FOR ALL
  USING (branch_id IN (
    SELECT branch_id FROM profiles WHERE id = auth.uid()
  ));
```

Schema already supports it (indexes are in place).

---

## 7. No Denormalization

### Why Store Only branch_id (Not branch_name)?

```
Option A (Chosen): Store only branch_id
  service_orders { id, branch_id, ..., status }
  → Need: SELECT s.*, b.name FROM service_orders s JOIN branches b ...

Option B (Not chosen): Store branch_id + branch_name
  service_orders { id, branch_id, branch_name, ..., status }
  → Need: Trigger to keep branch_name in sync
  → Risk: Divergence if trigger fails
```

**Why Option A?**

- Single source of truth (branch name only in branches table)
- JOIN performance: < 100ms (branches table = 10 rows)
- Not a bottleneck (profiling shows other factors dominate)
- YAGNI (don't optimize until proven necessary)

See **DECISIONS.md → ADR-008** for full rationale.

### Query Pattern

```typescript
// Repository handles JOIN transparently
export async function getServiceOrdersWithBranchInfo(branchId: string) {
  return db
    .from("service_orders as so")
    .select("so.*, b.name as branch_name")
    .join("branches as b", "so.branch_id", "b.id")
    .eq("so.branch_id", branchId);
}

// Consumer doesn't care about JOIN:
const orders = await getServiceOrdersWithBranchInfo(userBranchId);
console.log(orders[0].branch_name); // Works the same
```

---

## 8. Architecture Decision Records

For detailed rationale on all architectural choices, see **DECISIONS.md**:

| ADR     | Decision                                         |
| ------- | ------------------------------------------------ |
| ADR-001 | Single database, multi-tenant (not separate DBs) |
| ADR-002 | Use branch_id for isolation key                  |
| ADR-003 | Branch from session only (never from request)    |
| ADR-004 | 1:1 user-branch (not many-to-many)               |
| ADR-005 | Repository layer isolation (not RLS)             |
| ADR-006 | No user_branch_assignments table                 |
| ADR-007 | Defer RLS until needed                           |
| ADR-008 | No branch_name denormalization                   |

---

## 9. System Diagram

```
┌────────────────────────────────────────────────┐
│              CLIENT LAYER                      │
│  React Components (Admin/Teknisi/QC/Owner)    │
│  [Branch Selector visible in UI]              │
└──────────────┬───────────────────────────────┘
               │
        ┌──────▼──────────┐
        │  Auth Store     │
        │  - userId       │
        │  - branchId     │
        │  - role         │
        └──────┬──────────┘
               │
     ┌─────────▼──────────────┐
     │ Next.js API Routes     │
     │ (app/api/*/route.ts)   │
     └─────────┬──────────────┘
               │
    ┌──────────▼───────────┐
    │ Scope Middleware      │
    │ Extract: branchId     │
    │ From: JWT/session     │
    └──────────┬────────────┘
               │
    ┌──────────▼────────────┐
    │ Authorization Check   │
    │ - Role permission?    │
    │ - Valid branch?       │
    └──────────┬────────────┘
               │
    ┌──────────▼───────────────┐
    │ Repository Layer         │
    │ WHERE branch_id = X      │
    │ (all queries enforced)   │
    └──────────┬───────────────┘
               │
    ┌──────────▼──────────────┐
    │ Supabase PostgreSQL     │
    │ - branches table        │
    │ - profiles (branch_id)  │
    │ - service_orders        │
    │ - All operational data  │
    └─────────────────────────┘
```

---

## 10. Summary

| Component           | Implementation                              | Notes                   |
| ------------------- | ------------------------------------------- | ----------------------- |
| **Isolation**       | Application layer (middleware + repository) | No RLS (team expertise) |
| **User-Branch**     | 1:1 direct in profiles table                | Single branch per user  |
| **Branch Context**  | From session/JWT (never request)            | Security enforcement    |
| **Queries**         | Repository layer adds WHERE branch_id = X   | Enforced at data layer  |
| **Denormalization** | None (join branches for name)               | Simple, maintainable    |
| **Schema**          | 3 categories: Global, Master, Operational   | See DATABASE.md         |
| **Future**          | Can add RLS if needed                       | No current need         |

---

## 10. Future Evolution: Multi-Company Readiness

### 10.1 Current Architecture (Today)

```
Arlogic Group (Organization)
    │
    └── Arlogic Watch Service (1 company)
        │
        ├── Jember Branch
        ├── Kudus Branch
        └── Surabaya Branch
```

### 10.2 Future Architecture (Prepared)

```
Arlogic Group (Parent)
    │
    ├── Arlogic Watch Service (Company 1)
    │   ├── Jember Branch
    │   └── Kudus Branch
    │
    ├── GOKKI (Company 2)
    │   ├── Jember Branch
    │   └── Bali Branch
    │
    └── Future Product (Company 3)
        └── Branches...
```

### 10.3 How Current Architecture Supports Future Expansion

**Branch Context is Prepared**:

```typescript
BranchContext {
  userId: string;
  role: string;
  branchId: string;      // Used today
  companyId?: string;    // Prepared for future (NOT used)
  permissions: [];
}
```

**Database Schema Ready**:

```sql
-- Today: branch_id everywhere
SELECT * FROM service_orders WHERE branch_id = X;

-- Future: Add company_id (no breaking changes)
SELECT * FROM service_orders
WHERE company_id = X AND branch_id = Y;

-- Existing queries still work (company_id can have default value)
```

### 10.4 Migration Path (When Multi-Company Needed)

**No architectural changes needed. Only database expansion:**

```sql
-- Step 1: Add company_id to all operational tables
ALTER TABLE branches ADD COLUMN company_id UUID;
ALTER TABLE service_orders ADD COLUMN company_id UUID;
ALTER TABLE layanan ADD COLUMN company_id UUID;
-- ... all operational tables

-- Step 2: Update BranchContext to use companyId
// Already prepared in code, just activate

-- Step 3: Update queries to include company_id
SELECT * FROM service_orders
WHERE company_id = context.companyId
  AND branch_id = context.branchId;

-- Step 4: Update permissions for multi-company access
// Branch-level permissions become company-level
// Company admins can see all branches in their company
```

**Timeline**: When needed (future decision, not now)

### 10.5 ⚠️ Important: NOT Part of EPIC-001

**This is architecture READINESS, not implementation.**

EPIC-001 will:

- ✅ Create BranchContext with companyId placeholder
- ✅ Design schemas ready for company_id column
- ✅ Document migration path

EPIC-001 will NOT:

- ❌ Implement multi-company functionality
- ❌ Add company_id to database
- ❌ Create company management endpoints
- ❌ Change any query logic

**Decision**: Prepared vs Implemented

- **Prepared** (EPIC-001): Architecture can support multi-company
- **Implemented** (Future): Actually use multi-company features

This approach follows **YAGNI principle** (You Aren't Gonna Need It) while maintaining **forward compatibility**.
