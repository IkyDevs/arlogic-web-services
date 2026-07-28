# EPIC-001: Enterprise Multi Branch Architecture

**Status:** 📋 Documentation Phase
**Version:** 1.0
**Date:** July 28, 2026
**Lead:** Architecture Team

---

## Objective

Transform Arlogic Watch Service from a single-branch architecture to a **multi-branch (multi-outlet) system** while maintaining all existing business flows and ensuring complete data isolation between branches.

Each branch can operate independently with:

- Isolated data access via branch_id scoping
- Role-based visibility (Owner sees all branches, Managers see only their assigned branch)
- Unified backend infrastructure with per-branch user assignments
- Independent reporting and analytics per branch

---

## Scope

### In Scope ✅

- **Database Schema Evolution**: Add `branch_id` to all operational tables
- **Authentication & Authorization**: Extend to include branch context
- **API Layer**: Modify all endpoints to enforce branch scope
- **Frontend Routing**: Add branch selector and branch-aware dashboards
- **User Management**: Assign users to branches with role-based visibility
- **Data Migration**: Migrate existing single-branch data to default branch
- **Role-Based Access Control**: Enforce branch isolation by role
- **Reporting**: Branch-specific analytics and reporting

### Out of Scope ❌

- Changing existing business workflows
- Modifying transaction logic
- Telegram integration changes
- R2/Cloud storage changes
- Changing UI component library
- Performance optimization (separate initiative)

---

## Current Status

| Phase         | Status                     | Owner             |
| ------------- | -------------------------- | ----------------- |
| Documentation | 🔄 **PHASE 2 IN PROGRESS** | Architecture Team |
| Design Review | ⏳ Pending                 | Lead Engineer     |

**Phase 2 (Current)**: Architecture Review Revisions

- ✅ Separated Identity Domain from Master Data
- ✅ Added Branch Context runtime object
- ✅ Implemented Permission-Based Authorization
- ✅ Created DOMAINS.md with domain boundaries
- ✅ Added Future Evolution section (Multi-Company readiness)
- 🔄 Consistency check in progress

---

## Document Index

### Core Architecture Documents

| Document            | Purpose                                                  | Status             |
| ------------------- | -------------------------------------------------------- | ------------------ |
| **ARCHITECTURE.md** | System-wide design, Branch Context, Future Evolution     | ✅ Updated Phase 2 |
| **DATABASE.md**     | Entity design, domain categorization, branch_id strategy | ✅ Updated Phase 2 |
| **RBAC.md**         | Permission-based authorization, role definitions         | ✅ Updated Phase 2 |
| **DOMAINS.md**      | Domain boundaries, responsibilities, interfaces          | ✅ Created Phase 2 |
| **DECISIONS.md**    | Architecture decision records (12 ADRs)                  | ✅ Updated Phase 2 |

### Business & Requirements

| Document     | Purpose                                   | Status            |
| ------------ | ----------------------------------------- | ----------------- |
| **PRD.md**   | Product requirements, acceptance criteria | ✅ Complete       |
| **API.md**   | Endpoint specifications and examples      | ⏳ Pending update |
| **UI-UX.md** | Frontend wireframes and components        | ⏳ Pending update |

### Implementation Planning

| Document                | Purpose                           | Status            |
| ----------------------- | --------------------------------- | ----------------- |
| **MIGRATION.md**        | Step-by-step migration strategy   | ⏳ Pending update |
| **TESTING.md**          | QA checklist and test plans       | ⏳ Pending update |
| **tasks/TASK-\*.md**    | 12 Implementation tasks (001-012) | ⏳ Pending review |
| Implementation Planning | ⏳ Pending                        | Dev Team          |
| Sprint Planning         | ⏳ Pending                        | Product Manager   |
| Development             | ⏳ Pending                        | Dev Team          |
| QA & Testing            | ⏳ Pending                        | QA Team           |
| Deployment              | ⏳ Pending                        | DevOps            |

---

## Key Documentation Files

### 1. **PRD.md** - Product Requirements Document

- Business context and problem statement
- Goals and non-goals
- Functional and non-functional requirements
- User stories and acceptance criteria

### 2. **ARCHITECTURE.md** - Technical Architecture (Core Document)

- High-level system architecture
- Branch scope strategy
- Authentication and authorization flows
- Repository, middleware, and security strategies
- ADR (Architecture Decision Records)

### 3. **DATABASE.md** - Database Design

- Entity Branch definition
- Relational design and foreign keys
- branch_id strategy and indexing
- Data isolation approach
- ERD (Entity Relationship Diagram)

### 4. **RBAC.md** - Role-Based Access Control

- Role definitions (Owner, Manager, Admin, Teknisi, QC)
- Permission matrix
- Authorization rules per branch
- Branch scope enforcement

### 5. **API.md** - API Specification

- Endpoint modifications for branch scope
- New endpoints for branch management
- Request/response formats
- Authorization headers
- Error handling

### 6. **UI-UX.md** - User Interface Design

- Branch selector component
- Dashboard variations per role
- Branch management interface
- User interface wireframes (ASCII)

### 7. **MIGRATION.md** - Data Migration Strategy

- Existing data handling
- Default branch assignment
- Validation strategy
- Rollback procedures
- Zero-downtime migration

### 8. **TESTING.md** - QA & Testing Plan

- Integration test scenarios
- Permission/authorization tests
- Branch isolation verification
- Regression test checklist
- Data validation procedures

### 9. **TASK-001 to TASK-012** - Implementation Tasks

- 12 focused, sequenced implementation tasks
- Each with clear objectives, dependencies, and acceptance criteria
- Risk identification and rollback plans

---

## Implementation Tasks Overview

| Task     | Title                                                | Priority    | Difficulty | Est. Days |
| -------- | ---------------------------------------------------- | ----------- | ---------- | --------- |
| TASK-001 | Database Schema: Add branch_id to core tables        | 🔴 Critical | ⭐⭐       | 2         |
| TASK-002 | Database Schema: Add branch_id to transaction tables | 🔴 Critical | ⭐⭐       | 2         |
| TASK-003 | Database Indexes: Add branch-scoped indexes          | 🟠 High     | ⭐⭐       | 1         |
| TASK-004 | Database RLS Policies: Implement branch isolation    | 🟠 High     | ⭐⭐⭐     | 2         |
| TASK-005 | Auth: Add branch context to JWT & session            | 🟠 High     | ⭐⭐       | 2         |
| TASK-006 | Auth: Create branch assignment system                | 🟠 High     | ⭐⭐⭐     | 2         |
| TASK-007 | API: Add branch_id to request/response handling      | 🟠 High     | ⭐⭐       | 3         |
| TASK-008 | API: Create branch management endpoints              | 🟠 High     | ⭐⭐       | 2         |
| TASK-009 | Frontend: Create branch selector component           | 🟠 High     | ⭐⭐       | 2         |
| TASK-010 | Frontend: Update dashboards for branch scope         | 🟠 High     | ⭐⭐⭐     | 4         |
| TASK-011 | Migration: Prepare & execute data migration          | 🟠 High     | ⭐⭐⭐     | 2         |
| TASK-012 | Testing & Deployment: QA, UAT, Production            | 🟠 High     | ⭐⭐⭐     | 3         |

---

## Architecture Principles

### 1. **Single Branch Per User**

Each user is assigned to exactly one branch at any given time.

- User's branch stored directly in `profiles.branch_id`
- Simpler data model, easier maintenance
- Branch change requires admin intervention (direct update)

### 2. **Branch Scope from Session**

Every request derives branch context from authenticated user session.

- Branch_id flows: User → Session → API → Repository → Database
- Backend-driven validation (never trusting frontend)
- Frontend cannot send or override branch_id

### 3. **Role-Based Visibility**

- **Owner**: Special role that can see ALL branches by querying without branch filter
- **Manager/Admin/Teknisi/QC**: Can only access their assigned branch
- Role-based authorization enforced at middleware and repository layer

### 4. **Repository Layer Enforcement**

All branch isolation enforced through application code:

- Middleware extracts user's branch_id from session
- Repository layer adds `WHERE branch_id = user_branch_id` to all queries
- Authorization layer validates operation permission
- No RLS policies (simpler, more maintainable for current team)

### 5. **Zero Business Flow Changes**

- All existing service workflows remain identical
- Multi-branch is purely a data isolation layer
- All operational logic unchanged

---

## Progress Tracking

### Phase 1: Documentation ⏳

- [x] Analyze current architecture
- [ ] Create all documentation files
- [ ] Design review & approval

### Phase 2: Design ⏳

- [ ] Finalize database schema
- [ ] API contract review
- [ ] Frontend wireframe approval

### Phase 3: Development ⏳

- [ ] Database schema migration (with zero downtime)
- [ ] Backend API modifications
- [ ] Frontend component updates

### Phase 4: Testing ⏳

- [ ] Integration testing
- [ ] Security/permission testing
- [ ] Data isolation verification

### Phase 5: Deployment ⏳

- [ ] Staging deployment
- [ ] UAT with stakeholders
- [ ] Production deployment
- [ ] Post-deployment monitoring

---

## Quick Links

- 📄 [Product Requirements Document](./PRD.md)
- 🏗️ [Technical Architecture](./ARCHITECTURE.md)
- 🗄️ [Database Design](./DATABASE.md)
- 👥 [RBAC & Permissions](./RBAC.md)
- 🔌 [API Specification](./API.md)
- 🎨 [UI/UX Design](./UI-UX.md)
- 📦 [Migration Strategy](./MIGRATION.md)
- ✅ [Testing Plan](./TESTING.md)

---

## Key Contacts

- **Product Manager**: [TBD]
- **Tech Lead**: [TBD]
- **Architecture**: [TBD]
- **Backend Lead**: [TBD]
- **Frontend Lead**: [TBD]
- **QA Lead**: [TBD]

---

## Success Criteria

✅ All data is properly isolated by branch
✅ Owner sees all branches, Managers see only their branch
✅ All existing workflows function identically
✅ No data loss during migration
✅ Zero downtime deployment
✅ All integration tests pass
✅ 100% authorization tests pass
✅ Rollback tested and verified

---

## Document Metadata

| Property         | Value               |
| ---------------- | ------------------- |
| Created          | July 28, 2026       |
| Last Updated     | July 28, 2026       |
| Version          | 1.0                 |
| Status           | Documentation Phase |
| Approval Status  | Pending             |
| Next Review Date | TBD                 |

---

## Key Architecture Decisions (Phase 2)

### 1. Domain-Driven Architecture

System organized into **10 distinct domains** with clear boundaries:

```
Identity Domain (Auth & Users) ← Foundational layer
    ↓
Branch Context (Runtime object)
    ↓
Branch Domain (Multi-branch structure)
    ↓
├── Transaction Domain (Financials)
├── Service Domain (Watch service workflow)
├── Inventory Domain (Stock management)
├── Attendance Domain (Employee tracking)
├── Expense Domain (Cost tracking)
├── Notification Domain (Real-time alerts)
├── Activity Log Domain (Audit trail)
└── Reference Domain (Global configs)
```

**See DOMAINS.md** for complete specifications including:

- Responsibility per domain
- Owned entities
- Public interfaces
- Dependency rules

### 2. Branch Context (Runtime Object)

Critical concept: **NOT a database table**, but runtime object built on login.

```typescript
BranchContext {
  userId: string;           // Authenticated user
  role: "owner"|"manager"|"admin"|"technician"|"qc";
  branchId: string;         // Current branch scope
  branchName: string;
  permissions: Permission[];  // What user can do
  companyId?: string;       // Prepared for multi-company (not used)
}
```

**Purpose**: Encapsulates all branch scope. Passed through entire request lifecycle.

**See ARCHITECTURE.md Section 3** for JWT flow and lifecycle.

### 3. Permission-Based Authorization

Authorization uses **two layers**:

```
Role (owner, manager, admin, technician, qc)
    ↓
Permissions (resource.action.scope format)
    ↓
Examples:
  - "branch.read.all" (Owner: read any branch)
  - "transaction.create.own" (Admin: create in own branch)
  - "qc.approve.own" (QC: approve in own branch)
```

**Code Pattern**:

```typescript
// ✅ CORRECT (Permission-based)
if (hasPermission("service_order.create.own")) {
  await createServiceOrder(branchId, data);
}

// ❌ WRONG (Role-based)
if (user.role === "admin") {
  await createServiceOrder(branchId, data);
}
```

**Benefits**: Scalable, maintainable, auditable, future-proof

**See RBAC.md** for complete permission matrix and implementation patterns.

### 4. Identity Domain Separated from Master Data

**Identity Domain** includes:

- User profiles
- Roles
- Permissions
- Authentication
- (Future: MFA, audit login, session management)

**Master Data** includes:

- Branches (organizational structure)
- Reference data (watch brands, models, categories)

This separation prepares for future Identity Domain expansion.

**See DOMAINS.md** for all 10 domain specifications.

### 5. Multi-Company Readiness (Future-Proofed)

Current architecture is prepared for **future** multi-company expansion:

```
Today (EPIC-001):
  Arlogic Watch Service → Jember, Kudus (branches)

Future (when needed):
  Arlogic Group
  ├── Arlogic Watch Service → Jember, Kudus
  ├── GOKKI → Jember, Bali
  └── Future Product → ...
```

**How**: BranchContext includes `companyId` field (prepared, not used):

- Zero breaking changes today
- Ready to activate when needed
- Clear migration path documented

**Important**: NOT part of EPIC-001 implementation. Only shows architecture readiness.

**See ARCHITECTURE.md Section 10** for Future Evolution details.

---

## New Documents in Phase 2

### DOMAINS.md (NEW)

Describes 10 distinct domains with:

- Responsibility
- Owned Entities
- Public Interfaces
- Dependency Rules
- Domain Communication Patterns
- Future Multi-Company Evolution

### Updated ARCHITECTURE.md

- **Section 3**: Added Branch Context concept and JWT flow diagram
- **Section 10**: Added Future Evolution section (Multi-Company readiness)

### Updated DATABASE.md

- **Section 3**: Separated Identity Domain from Branch Domain from Reference Domain
- Added table categorization by domain
- Explained branch_id strategy for each domain type

### Updated RBAC.md

- Implemented Permission-Based Authorization (not role-only)
- Added permission key format and examples
- Updated role definitions with specific permissions
- Added authorization check patterns and code examples

### Updated DECISIONS.md

- **ADR-009**: Why separate Identity Domain from Master Data?
- **ADR-010**: Why include companyId in BranchContext?
- **ADR-011**: Why use Permission-Based Authorization?
- **ADR-012**: Why use Domain-Driven Architecture?

---

## Consistency Standards (Phase 2)

All documents now use consistent terminology:

| Term                 | Definition                              | Usage                       |
| -------------------- | --------------------------------------- | --------------------------- |
| **Identity Domain**  | User authentication, roles, permissions | Not "Master Data for users" |
| **Branch Context**   | Runtime object (not database table)     | Passed through requests     |
| **Permission-Based** | Check permission keys (not direct role) | `hasPermission("key")`      |
| **Domain Boundary**  | Clear separation between domains        | Each domain owns entities   |
| **branch_id**        | Primary isolation key                   | Every operational record    |
