# Architecture Decision Records (ADR)

## EPIC-001: Enterprise Multi Branch System

---

## ADR-001: Single Database Multi-Branch Architecture

**Title**: Why use a single PostgreSQL database for all branches instead of separate databases per branch?

**Status**: ✅ **ACCEPTED**

### Context

Arlogic Watch Service needs to scale from single-branch to multi-branch (3-10 branches initially).

Two options considered:

1. **Single Database, Multiple Tenants**: All branches in one PostgreSQL database with branch_id isolation
2. **Multiple Databases**: Separate database per branch (complete isolation)

### Decision

Use **single database, multiple tenants** approach.

### Rationale

| Factor                     | Single DB               | Multiple DB                  |
| -------------------------- | ----------------------- | ---------------------------- |
| **Operational Complexity** | Low                     | High (manage 10 DBs)         |
| **Backup & Recovery**      | Simple (one backup)     | Complex (coordinate 10)      |
| **Cross-Branch Reporting** | Native queries          | Requires data aggregation    |
| **Company-wide Analytics** | Easy (one query)        | Difficult (union across DBs) |
| **Cost**                   | Lower (single instance) | Higher (multiple instances)  |
| **Maintenance**            | Unified                 | Fragmented                   |
| **Data Integrity**         | Centralized             | Distributed                  |

### Consequences

✅ **Benefits**:

- Simpler operational model
- Single backup strategy
- Owner dashboard (company-wide reports) easy to implement
- Cost-effective

⚠️ **Risks**:

- Requires careful isolation strategy to prevent data leakage
- Single point of failure (mitigated by backups, replicas)
- Needs strong authentication/authorization layer

### Migration Path

If future scaling requires sharding:

- Can shard by branch_id when database reaches performance limits
- Application-level code already assumes branch_id isolation
- Easier transition than consolidating multiple databases

---

## ADR-002: Why Use branch_id for Data Isolation?

**Title**: Why use branch_id as the isolation key instead of tenant_id or other schemes?

**Status**: ✅ **ACCEPTED**

### Context

Need a column to differentiate data belonging to different branches within same database.

Options:

1. **branch_id**: Direct reference to branches table
2. **tenant_id**: Abstract tenant concept
3. **organization_id**: Hierarchical organization model

### Decision

Use **branch_id** referencing `branches` table directly.

### Rationale

- **Semantic Clarity**: `branch_id` directly maps to business concept (branches)
- **Existing Pattern**: Matches UUID pattern already used for user_id, etc.
- **Performance**: Direct FK reference, no translation needed
- **Simplicity**: No abstraction layer needed
- **Maintainability**: Team understands "branch" vs abstract "tenant"

### Consequences

✅ **Benefits**:

- Clear intent in code and queries
- Easy to understand for new team members
- Direct business semantics
- Performant

⚠️ **Constraints**:

- Tightly couples schema to business model (acceptable for current stage)
- Less flexible for future multi-level hierarchies (unlikely near-term need)

---

## ADR-003: Why Does branch_id Come from User Session, Not Request?

**Title**: Why should branch_id always be derived from authenticated user session and never accepted from client request?

**Status**: ✅ **ACCEPTED**

### Context

Client could potentially send branch_id in:

- Request headers: `X-Branch-ID: kudus-uuid`
- Query parameters: `?branch_id=kudus-uuid`
- Request body: `{ branch_id: "kudus-uuid", ... }`

Two approaches:

1. **Accept from Client**: Frontend sends requested branch
2. **From Session Only**: Backend derives from authenticated user

### Decision

**NEVER accept branch_id from client.** Always use session-derived value.

```typescript
// ❌ WRONG
const { branchId } = await request.json(); // Untrusted source
const result = await query("service_orders").eq("branch_id", branchId);

// ✅ CORRECT
const { branchId } = await getSessionContext(request); // From JWT/session
const result = await query("service_orders").eq("branch_id", branchId);
```

### Rationale

**Security**:

- Prevents authorization bypass (user can't claim access to other branch)
- Single source of truth (session, not request)
- Frontend can be compromised or tampered with
- Backend is trustworthy (we control it)

**Simplicity**:

- No need to validate requested branch against user's assignments
- No ambiguity about current branch context
- Same branch_id for entire request lifecycle

### Consequences

✅ **Benefits**:

- Prevents branch_id injection attacks
- Clear security model
- Easier to audit (consistent enforcement)

⚠️ **Constraints**:

- Cannot change branch within a single request
- Branch switching requires session update + page reload
- Adds session management overhead (acceptable tradeoff)

### Enforcement Points

1. **Middleware**: Extract branch_id from JWT/session
2. **Authorization**: Validate user assigned to branch
3. **Repository**: Use session branch_id, ignore request parameter
4. **API Response**: Include branch_id in response for audit trail

---

## ADR-004: Single Branch Per User (1:1) Model

**Title**: Why use one-to-one user-branch mapping instead of many-to-many?

**Status**: ✅ **ACCEPTED**

### Context

User-branch relationship options:

1. **One-to-One**: Each user assigned to exactly one branch
2. **Many-to-Many**: Each user can be assigned to multiple branches with different roles

### Decision

Use **one-to-one mapping**. Store `branch_id` directly in `profiles` table.

### Rationale

**Current Business Requirements**:

- No current use case for multi-branch users
- Staff work at single location
- Transfers handled by admin (direct UPDATE)

**Simplicity**:

```
Many-to-Many (complex):
  profiles → user_branch_assignments ← branches
  Query: 3 table joins to find user's branch

One-to-One (simple):
  profiles.branch_id → branches
  Query: Direct reference, no joins
```

**Performance**:

- One-to-one: Direct column lookup
- Many-to-many: Subquery required for every branch validation

**Maintenance**:

- Fewer tables to manage
- Fewer indexes needed
- Simpler migration

### YAGNI Principle

> You Aren't Gonna Need It (YAGNI)

Don't build for future multi-branch scenarios until that need exists.

### Consequences

✅ **Benefits**:

- Simpler schema
- Faster queries
- Easier to maintain
- Lower cognitive load

⚠️ **Constraints**:

- Cannot support multi-branch users today
- Transfer requires direct profile update (admin-driven)
- Future: Requires schema change to add user_branch_assignments if needed

### Future Evolution Path

**If** multi-branch users needed later:

```sql
-- Phase 1: Add assignments table
CREATE TABLE user_branch_assignments (
  user_id UUID,
  branch_id UUID,
  role VARCHAR,
  is_active BOOLEAN,
  PRIMARY KEY (user_id, branch_id)
);

-- Phase 2: Keep profiles.branch_id as "default branch"
-- Phase 3: Update queries to check assignments table
-- Phase 4: Deprecate direct branch_id column (optional)
```

Migration would be straightforward since isolation pattern already in place.

---

## ADR-005: Repository Pattern for Branch Isolation (No RLS)

**Title**: Why enforce branch isolation through application code (Repository pattern) rather than database RLS policies?

**Status**: ✅ **ACCEPTED**

### Context

Branch isolation can be enforced at:

1. **Database Level**: Row-Level Security (RLS) policies
2. **Application Level**: Repository layer, middleware, authorization

### Decision

Enforce at **application level** using Repository pattern. Do NOT use RLS.

### Rationale

**Application Architecture Already in Place**:

- Repository pattern established
- Middleware layer for auth/validation
- Authorization checks per operation
- Team expertise in application-level validation

**Maintainability**:

- RLS policies stored in database (harder to version control)
- Application code is testable, debuggable
- Team can review authorization logic alongside features

**Current Scale**:

- 5-10 branches doesn't justify RLS complexity
- Application-level validation sufficient
- RLS adds cognitive overhead with no immediate benefit

**Team Expertise**:

- Team knows middleware/repository patterns
- RLS requires PostgreSQL-specific knowledge
- Policy composition can be complex

### How It Works

```typescript
// Middleware: Extract branch context
export async function middleware(request: NextRequest) {
  const { userId, branchId } = await getSessionContext(request);
  request.headers.set("x-branch-id", branchId);
}

// Repository: Enforce isolation
export async function getServiceOrders(branchId: string) {
  return db.from("service_orders").select("*").eq("branch_id", branchId); // ← Branch isolation
}

// Authorization: Check permission
export async function authorize(user, branch, operation) {
  if (!(await isUserAssignedToBranch(user, branch))) {
    throw new ForbiddenError();
  }
}
```

### Consequences

✅ **Benefits**:

- Easy to understand and maintain
- Testable (unit tests for repository logic)
- Debuggable (stack traces show what went wrong)
- Version controlled (code is in git, not database)
- Team expertise aligned

⚠️ **Risks**:

- No database-level protection (if app bypassed)
- Developer error can leak data (need careful code review)
- Requires discipline (every query must check branch_id)

### Safeguards

1. **Code Review**: Mandatory review of repository changes
2. **Testing**: Unit tests for branch filtering
3. **Linting**: ESLint rules to catch missing branch_id checks
4. **Documentation**: Clear patterns and examples
5. **Audit Logs**: Log access attempts, branch operations

### Future: RLS as Defense in Depth

If security requirements change or data volumes explode:

- Can add RLS policies later without changing application code
- Becomes defense-in-depth layer
- Schema already supports it (indexes in place)

---

## ADR-006: Why Avoid Many-to-Many User Branch Assignments

**Title**: Why not use user_branch_assignments table for flexible role assignment?

**Status**: ✅ **ACCEPTED** (Decision: DON'T use M:N)

### Context

Many-to-many would enable:

- User with Admin role in Branch A
- Same user with Technician role in Branch B
- Different permissions per branch

### Decision

**Don't use M:N.** Keep one-to-one user-branch mapping.

### Rationale

**Current Business Model**:

- Users are employees (hired by branch)
- Users have job titles (fixed role)
- Role doesn't vary by location
- Users don't cover multiple locations

**Example Reality**:

```
Budi: Manager at Jember (full job)
Siti: Admin at Jember (full job)
Rudi: Technician at Jember (full job)

NOT:
Budi: Admin at Jember, Manager at Kudus (impossible - can't be two places)
```

**Simpler Permission Model**:

- One role per user
- One branch per user
- Permission = role + branch

vs.

```
Multiple roles per branch per user:
- user_branch_assignments(user, branch) → [role1, role2, ...]
- Queries become: WHERE user_id = X AND branch_id = Y AND role IN (...)
- Decision logic: for each branch-user-role combo, check permissions
```

### When M:N Would Be Needed

Only if:

- Contractor works multiple branches simultaneously (not current model)
- Person has multiple concurrent job titles (unlikely)
- System tracks person at individual level, not employee level

None of these apply to Arlogic currently.

### Consequences

✅ **Benefits**:

- Clear user model (one employee = one branch)
- Fast permission checks
- Familiar to HR system

⚠️ **Constraints**:

- Transfer = admin action (direct update)
- Cannot support cross-branch secondments
- More difficult to implement multi-branch users if needed later

### Migration Path for Future

```sql
-- If multi-branch users needed:
CREATE TABLE user_branch_assignments (
  user_id UUID,
  branch_id UUID,
  role VARCHAR,
  is_primary BOOLEAN,
  PRIMARY KEY (user_id, branch_id)
);

-- Migrate from profiles.branch_id
INSERT INTO user_branch_assignments
  SELECT id, branch_id, role, true FROM profiles;

-- Update queries to use assignments table
```

---

## ADR-007: Why Not Use Row-Level Security (RLS) Yet

**Title**: Why defer implementing database RLS policies until later stages?

**Status**: ✅ **ACCEPTED**

### Context

RLS could provide:

- Database-level data isolation
- Defense-in-depth layer
- Protection even if application bypassed

### Decision

**Don't implement RLS now.** Use application-level enforcement via Repository pattern.

Add RLS as defense-in-depth layer only if:

- Team size grows (more code reviewers needed)
- Data sensitivity increases
- Regulatory requirements demand it
- Performance metrics justify it

### Rationale

**Current Stage**: Single team, high code quality, small data volume

**Complexity vs. Benefit**:

```
RLS Complexity:
  - PostgreSQL-specific knowledge
  - Hard to debug (policies hidden in database)
  - Version control challenges
  - Policy composition complexity
  - Testing requires database setup

Benefit for 5-10 branches:
  - Minimal (application layer already isolates)
  - Low risk (trusted team)
  - Better tools for app-level debugging
```

**YAGNI Principle**:

> Don't add complexity until you need it.

### Consequences

✅ **Benefits**:

- Simpler deployment
- Easier to test and debug
- Team comfort with technology
- Faster development

⚠️ **Risks**:

- No database-level protection
- Relies on developer discipline
- Bug in code = potential data leak

### Safeguards for Current Stage

1. **Mandatory Code Review**: All data access reviewed
2. **Testing**: Branch isolation tests for every feature
3. **Static Analysis**: Linting for branch_id checks
4. **Audit Logs**: All operations logged
5. **Principle of Least Privilege**: Users only have needed role

### Future: RLS as Enhancement

When RLS warranted:

1. Schema already supports it (indexes ready)
2. Application code doesn't need to change
3. RLS becomes "extra layer" on top of app logic
4. Gradual rollout without major refactoring

---

## ADR-008: Why Avoid Denormalization

**Title**: Why store branch_id directly on operational tables instead of denormalizing branch_name?

**Status**: ✅ **ACCEPTED**

### Context

Options for storing branch info:

1. **No Denormalization** (Simple): `branch_id` only → JOIN branches for name
2. **Denormalization**: `branch_id` + `branch_name` → No JOIN needed

### Decision

**Don't denormalize branch_name.** Store only `branch_id`, JOIN as needed.

### Rationale

**Current Performance**: Not a bottleneck

- Branches table: ~10 rows (negligible)
- Branch name lookups: < 1ms
- JOIN performance: Excellent (small table)

```sql
-- Fast enough for current scale
SELECT s.*, b.name as branch_name
FROM service_orders s
JOIN branches b ON s.branch_id = b.id
WHERE s.branch_id = user_branch_id
ORDER BY s.created_at DESC;
-- Query time: ~50-100ms (dominated by other conditions, not join)
```

**Maintenance Complexity**:

```
With denormalization:
  - Branch name changes require UPDATE on all service_orders rows
  - Trigger needed to keep in sync
  - Risk: Denormalized data could diverge
  - More complex migration

Without denormalization:
  - Branch name stored once
  - Single source of truth
  - Simple update (one row in branches table)
```

**YAGNI Principle**:

> Premature optimization is the root of all evil.

Only denormalize if profiling shows JOIN is bottleneck. It's not.

### When to Denormalize Later

Triggers for reconsidering:

- Dashboard load time > 2 seconds due to JOINs
- Query profiling shows branch name lookup is top 5% of CPU time
- Thousands of queries per second aggregating branch data

Currently: None of these apply.

### Consequences

✅ **Benefits**:

- Single source of truth
- Simpler schema
- Fewer triggers/maintenance points
- Easier to reason about data consistency

⚠️ **Constraints**:

- Every list query requires JOIN to get branch name
- Negligible performance impact (test shows < 100ms)
- Display code must handle JOIN

### Simple Implementation

```typescript
// Repository layer handles JOIN transparently
export async function getServiceOrdersWithBranchName(branchId: string) {
  return db
    .from("service_orders as so")
    .select("so.*, b.name as branch_name")
    .join("branches as b", "so.branch_id", "b.id")
    .eq("so.branch_id", branchId);
  // Consumer gets same data shape, doesn't care about JOIN
}

// Returns: { id, status, ..., branch_name: "Jember" }
```

---

## ADR-009: Separate Identity Domain from Master Data

**Title**: Why is profiles (user accounts) a separate "Identity Domain" and not part of "Master Data"?

**Status**: ✅ **ACCEPTED** (Phase 2 Revision)

### Context

Profiles could be categorized as:

1. **Master Data**: Lookup tables for reference (like branches)
2. **Identity Domain**: Authentication and user management

### Decision

Treat **profiles as separate Identity Domain**, not Master Data.

### Rationale

**Identity vs. Reference Data**:

| Aspect               | Identity                    | Master Data                |
| -------------------- | --------------------------- | -------------------------- |
| **Purpose**          | User authentication & auth  | Business reference         |
| **Change Frequency** | Frequent (new hires, roles) | Rarely (branch list)       |
| **Lifecycle**        | Temporary (employee leaves) | Permanent (branch defined) |
| **Security**         | Critical (passwords, MFA)   | Non-critical reference     |
| **Growth Path**      | Will expand significantly   | Stable structure           |

**Future Evolution**:

Identity Domain will grow to include:

- Login history
- Session management
- MFA (2FA, security keys)
- Audit trail of auth events
- User preferences
- Security settings
- Password history

Master/Reference Data will stay:

- branches
- watch_brands
- watch_models
- service_categories

**Architectural Clarity**:

Separating Identity Domain from Master Data creates clear boundaries:

```
IDENTITY DOMAIN
├── profiles
├── roles
└── permissions

BRANCH DOMAIN
└── branches

REFERENCE DOMAIN
├── watch_brands
├── watch_models
└── service_categories

OPERATIONAL DOMAINS
├── Service Domain
├── Transaction Domain
├── Inventory Domain
└── ... (others)
```

### Consequences

✅ **Benefits**:

- Clear architectural boundaries
- Future-proof for auth expansion
- Easier to explain to team
- Prepared for microservices if needed

⚠️ **Constraints**:

- Requires updating documentation
- No schema changes (same tables)
- Just a conceptual reorganization

### Related Documentation

See **DOMAINS.md** for complete domain architecture.

---

## ADR-010: Include companyId in BranchContext (Future Ready)

**Title**: Why include companyId in BranchContext if not using multi-company yet?

**Status**: ✅ **ACCEPTED** (Phase 2 Revision)

### Context

BranchContext could be:

1. **Minimal**: Only userId, branchId, permissions (what we use today)
2. **Future-Ready**: Also include companyId (prepared but unused)

### Decision

Include **companyId in BranchContext** even though not implemented yet.

```typescript
BranchContext {
  userId: string;
  role: string;
  branchId: string;         // Used today
  companyId?: string;       // Prepared for future
  permissions: [];
}
```

### Rationale

**Business Direction**: Arlogic expanding to multi-company

Current:

```
Arlogic Watch Service (1 company, multi-branch)
```

Future:

```
Arlogic Group (parent)
├── Arlogic Watch Service (company 1)
├── GOKKI (company 2)
└── Future Product (company 3)
```

**Zero Breaking Changes**:

- Adding companyId field doesn't break anything
- Can be null/optional during Phase 1
- When implemented: simply activate the field
- Queries can be updated gradually

**Prepared Architecture Principle**:

> Prepare for evolution without implementing it

This follows the principle:

- Can the system support multi-company? YES (prepared)
- Is it implemented? NO (not done yet)
- Does it add complexity today? NO (just a field)
- Does it enable future? YES (clear migration path)

### How It Works Today

```typescript
// Today: companyId is always null/undefined
BranchContext {
  userId: "user-123",
  branchId: "jember-uuid",
  companyId: null,          // Unused, prepared
  permissions: [...]
}

// Tomorrow: When multi-company implemented
BranchContext {
  userId: "user-123",
  branchId: "jember-uuid",
  companyId: "arlogic-watch-service-uuid",  // Active
  permissions: [...]        // Company-specific now
}

// Queries updated (no app-level refactoring)
SELECT * FROM service_orders
WHERE company_id = context.companyId
  AND branch_id = context.branchId;
```

### Consequences

✅ **Benefits**:

- Zero cost today (unused field)
- Clear migration path when needed
- No architectural debt
- Demonstrates forward-thinking design

⚠️ **Constraints**:

- Adds documentation (explain it's prepared)
- Team understanding (why is it there?)
- Slight cognitive load (unused field)

### Timeline

- **EPIC-001** (Today): Include in design, not implemented
- **EPIC-002 or Future**: Activate when multi-company started
- **Future+2**: Full multi-company implementation

### Related Documentation

See **ARCHITECTURE.md** Section 10: "Future Evolution" for details.

---

## ADR-011: Permission-Based Authorization Over Role-Based Checks

**Title**: Why use permission keys ("branch.read.all") instead of direct role checks (if role=="admin")?

**Status**: ✅ **ACCEPTED** (Phase 2 Revision)

### Context

Authorization can be implemented as:

1. **Role-Based**: Direct role check in code
2. **Permission-Based**: Check permission key from loaded set

### Decision

Use **Permission-Based Authorization**.

```typescript
// ❌ WRONG (Role-based)
if (user.role === "admin") {
  await createServiceOrder(data);
}

// ✅ CORRECT (Permission-based)
if (hasPermission("service_order.create.own")) {
  await createServiceOrder(data);
}
```

### Rationale

**Scalability**:

Today: 5 roles → 40 permission keys

Tomorrow: Might need:

- Admin with limited permissions (e.g., QC only)
- Technician with expanded permissions
- Contractor role with custom permissions
- Selective permission grants

```
Permission-based: Add permission key to role → Works
Role-based: Need new role → Refactor code everywhere
```

**Maintainability**:

Permission-based code is self-documenting:

```typescript
if (hasPermission("qc.approve.own")) {
  // Clear: "Can user approve QC in own branch?"
}

vs.

if (user.role === "manager" || user.role === "qc") {
  // Unclear: "Why are managers approving QC?"
  // Maintenance: If Admin starts approving QC, need code change
}
```

**Testing**:

Permission-based is easier to test:

```typescript
// Test setup
const context = {
  permissions: [
    { key: "service_order.create.own" },
    { key: "service_order.assign.own" },
  ],
};

// Test
expect(hasPermission("service_order.create.own")).toBe(true);
expect(hasPermission("qc.approve.own")).toBe(false);

// Clear what's tested
```

Role-based requires creating fake user objects.

**Compliance & Audit**:

Permission-based logs are clearer:

```
"User attempted action but lacks permission: qc.approve.own"
vs.
"User attempted action but is not admin role"
```

**Future: Selective Permission Grant**

When needed:

```sql
-- Manager with selective QC approval permission (future scenario)
INSERT INTO role_permissions (role, permission_key)
  VALUES ('manager', 'qc.approve.own');

-- Code doesn't change, just works
```

With role-based, would need:

```typescript
if (user.role === "manager" && user.hasQcPermission) {
  // New special handling
}
```

### How It Works

```typescript
// On login: Load permissions for user's role
BranchContext {
  role: "admin",
  permissions: [
    { key: "service_order.create.own" },
    { key: "service_order.assign.own" },
    { key: "transaction.create.own" }
  ]
}

// In route: Check permission
if (!hasPermission("service_order.create.own")) {
  return 403;
}

// Repository: No role check needed (already authorized)
async function createServiceOrder(branchId, data) {
  // Permission already validated
  // Just apply branch_id isolation
  return db.from('service_orders').insert({
    ...data,
    branch_id: branchId
  });
}
```

### Consequences

✅ **Benefits**:

- Scalable to future permission needs
- Self-documenting code
- Easier to test
- Clearer audit logs
- No code changes for role updates (just DB)

⚠️ **Constraints**:

- Requires loading permissions on login
- Team needs to use permission keys consistently
- More documentation (permission key registry)

### Permission Key Registry

See **RBAC.md** for complete permission matrix and key definitions.

### Related Documentation

See **RBAC.md** for permission-based authorization patterns.

---

## ADR-012: Domain-Driven Architecture Organization

**Title**: Why organize codebase using Domain-Driven Design with clear boundaries?

**Status**: ✅ **ACCEPTED** (Phase 2 Revision)

### Context

Code organization can be:

1. **By Layer**: controllers, services, repositories, models
2. **By Feature**: auth, transactions, services
3. **By Domain**: Identity, Branch, Transaction, Service (with internal layers)

### Decision

Use **Domain-Driven Design** with 10 distinct domains, each owning entities and interfaces.

### Rationale

**Team Growth Ready**:

As team expands (1 person → 5 people):

- Domain ownership: "Alice owns Transaction Domain"
- Clear boundaries: No merge conflicts on same service file
- Easier onboarding: "Here's the Service Domain, you own it"

**Feature Independence**:

Domains can evolve independently:

- Service Domain optimization doesn't touch Transaction Domain
- Inventory changes don't affect QC workflow
- Clear dependencies documented

**Scalability**:

When system scales:

- Can extract domain to microservice (clear API)
- Can add new domains without refactoring existing ones
- Easier to test (each domain isolated)

**Documentation**:

Domains in **DOMAINS.md** specify:

- Responsibility: What does this domain do?
- Owned Entities: Which tables?
- Public Interfaces: How to use it?
- Dependency Rules: What depends on what?

This is foundation for team communication and future architecture evolution.

### Domains

```
1. Identity Domain: Auth, users, roles, permissions
2. Branch Domain: Multi-branch organizational structure
3. Transaction Domain: Financial records
4. Service Domain: Watch service workflow
5. Inventory Domain: Stock management
6. Attendance Domain: Employee time tracking
7. Expense Domain: Cost tracking & closing
8. Notification Domain: Real-time alerts
9. Activity Log Domain: Audit trail
10. Reference Domain: Global configs
```

See **DOMAINS.md** for complete specifications.

### Consequences

✅ **Benefits**:

- Clear ownership when team grows
- Easier to document and explain
- Natural for microservices migration
- Self-organized code structure
- Scalable to 10+ developers

⚠️ **Constraints**:

- Requires discipline (don't cross domain boundaries)
- More files to organize
- Team training on DDD principles

### Implementation

Each domain has:

```
src/domains/{domain-name}/
├── entities/          (Database models)
├── repositories/      (Data access)
├── services/          (Business logic)
├── middleware/        (Domain-specific middleware)
├── types.ts          (Domain interfaces)
└── README.md         (Domain documentation)
```

Domains communicate through **public interfaces**, never directly access other domain's repositories.

### Related Documentation

See **DOMAINS.md** for complete domain specifications.

---

## Summary Table

| ADR     | Decision                           | Rationale                                                    |
| ------- | ---------------------------------- | ------------------------------------------------------------ |
| ADR-001 | Single DB, multi-tenant            | Operational simplicity, cost, owner reporting                |
| ADR-002 | Use branch_id                      | Semantic clarity, performance, maintainability               |
| ADR-003 | Branch from session only           | Security, single source of truth, prevent bypass             |
| ADR-004 | 1:1 user-branch (no M:N)           | Current business model, YAGNI, simplicity                    |
| ADR-005 | App-level isolation (no RLS)       | Team expertise, maintainability, current scale               |
| ADR-006 | Avoid user_branch_assignments      | No multi-branch users today, simpler model                   |
| ADR-007 | Defer RLS                          | YAGNI, complexity vs benefit, future-proofing                |
| ADR-008 | No branch_name denormalization     | Not a bottleneck, single source of truth                     |
| ADR-009 | Separate Identity Domain           | Future growth, architectural clarity, expansion path         |
| ADR-010 | Include companyId in BranchContext | Multi-company readiness, zero breaking changes               |
| ADR-011 | Permission-based authorization     | Scalability, maintainability, testability, audit clarity     |
| ADR-012 | Domain-Driven Design organization  | Team scalability, feature independence, future microservices |

---

## Revision History

| Version | Date       | Changes                       |
| ------- | ---------- | ----------------------------- |
| 1.0     | 2026-07-28 | Initial documentation         |
| 1.1     | 2026-07-28 | Architecture review revisions |
