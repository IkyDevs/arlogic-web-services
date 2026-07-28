# Product Requirements Document (PRD)

## EPIC-001: Enterprise Multi Branch Architecture

---

## 1. Background

### Current State

Arlogic Watch Service currently operates as a **single-branch system**:

- All data is stored in one database without tenant/branch isolation
- Users have company-wide roles (Admin, Technician, QC, Owner)
- No organizational hierarchy or outlet separation
- All reports and dashboards show company-wide data

### Business Evolution

Arlogic Group is expanding with multiple branches:

```
Arlogic Group
├── Arlogic Watch Service (Current)
│   ├── Database (Shared, all branches)
│   ├── Cabang Jember
│   ├── Cabang Kudus
│   ├── Cabang lainnya
│   └── HQ
│
├── GOKKI (Separate product)
│   ├── Database (Separate)
│   ├── Cabang Jember
│   └── Cabang Bali
│
└── Future Products (Future)
```

### Strategic Need

- Support multiple independent branches within Arlogic Watch Service
- Each branch should have local management autonomy
- Enable scalability to 5-10+ branches in the next 2 years
- Maintain unified backend infrastructure and reporting at corporate level

---

## 2. Problem Statement

### Current Limitations

**Data Isolation**

- No branch context in system
- Cannot restrict data visibility by branch
- Manager in Jember can accidentally see/modify Kudus branch data

**User Management**

- Roles are global, not scoped to branches
- Cannot assign "Admin" to specific branch
- Cannot have different admin for different branch

**Operational Fragmentation**

- Managers cannot manage their own branch independently
- Requires corporate-level admin involvement for branch operations
- Scaling to multiple branches becomes unmanageable

**Reporting & Analytics**

- All reports are company-wide
- Cannot generate branch-specific KPIs
- Branch managers have no visibility into their own metrics

**Data Security**

- Single point of failure (one database)
- Accidental data contamination between branches
- No audit trail of who accessed which branch data

---

## 3. Goals

### Primary Goals 🎯

1. **Data Isolation**: Each branch's data is logically and physically isolated
   - Manager can only see their branch data
   - Owner can see all branches
   - No cross-branch data leakage

2. **User Management at Branch Level**: Users are assigned to one branch
   - Each user assigned to exactly one branch (1:1 model)
   - User role is fixed per branch assignment
   - Simple, intuitive permission system
   - Branch transfers handled by admin update (not simultaneous multi-branch)

3. **Operational Independence**: Branches can operate autonomously
   - Branch managers handle their own operations
   - Corporate admin maintains overall system
   - Minimal inter-branch dependencies

4. **Scalability**: Support 10+ branches without architectural changes
   - Simple to add new branch
   - Adding branch doesn't degrade performance
   - Query optimization for multi-branch queries

5. **Zero Business Flow Changes**: All existing workflows remain identical
   - Service order flow unchanged
   - Transaction management unchanged
   - QC process unchanged
   - Telegram integration unchanged

### Secondary Goals 📊

- Prepare foundation for future product scaling (GOKKI)
- Enable branch-level analytics and reporting
- Support future branch-specific configurations
- Enable audit trail per branch
- Support branch-level user activity logs

---

## 4. Non-Goals

### What We Will NOT Do ❌

1. **Rebuild Business Logic**: We will not change how services are handled, transactions are processed, or QC is done
2. **Change Telegram Integration**: Telegram channel mapping stays the same, no notification restructuring
3. **Rebuild Reporting System**: Existing reports will be enhanced, not rebuilt
4. **Performance Optimization**: This is not a performance improvement initiative
5. **Change UI Framework**: We keep React/Next.js/TailwindCSS as-is
6. **Migrate to Different Database**: We stay with Supabase PostgreSQL
7. **Break Existing APIs**: We maintain backward compatibility where possible
8. **Data Cleanup**: We don't perform data cleansing beyond migration

---

## 5. Business Requirements

### BR-001: Branch Master Data

Every organization needs to track its branches.

**Requirement**: System must maintain a branch master table with:

- Unique branch ID (primary key)
- Branch name and code
- Location/address information
- Contact details
- Active/inactive status
- Creation and modification timestamps

**Rationale**: Foundation for all multi-branch operations. Allows corporate admin to manage branch registry.

### BR-002: User-Branch Assignment (1:1 Model)

Each user is assigned to exactly one branch.

**Requirement**: User-branch relationship is one-to-one:

- User assigned to exactly one branch (stored in profiles.branch_id)
- User role is fixed for their assigned branch
- Transfer to different branch requires admin action (UPDATE profiles.branch_id)
- User must re-login after branch transfer (session invalidated)

**Rationale**: Simplified model matching current business reality. Employees work at single location. Future multi-branch user support can be added if needed (see ADR-004 in DECISIONS.md).

### BR-003: Role-Based Data Visibility

Different roles must see different data.

**Requirement**:

- **Owner**: Can view and manage all branches' data
- **Manager**: Can only view/manage their assigned branch
- **Admin**: Can only view/manage their assigned branch
- **Technician/QC**: Can only access their assigned branch

**Rationale**: Prevents accidental data access. Enforces data governance.

### BR-004: Backend Validation

Branch context must never come from frontend.

**Requirement**:

- Backend always derives user's branch from authenticated session
- User cannot send branch_id in request headers/body
- If user is not assigned to requested branch, request is rejected
- All API routes validate branch ownership before processing

**Rationale**: Prevents unauthorized branch access. Core security principle.

### BR-005: Cross-Branch Owner Visibility

Owner role requires special handling.

**Requirement**:

- Owner can access all branch data simultaneously
- Owner can switch between branches without re-login
- Queries can optionally include/exclude specific branches
- Owner can generate company-wide reports

**Rationale**: Enables corporate-level oversight and decision-making.

### BR-006: Data Query Filtering

All data queries must be branch-scoped.

**Requirement**:

- All SELECT queries include `WHERE branch_id = X`
- JOIN operations properly scope via branch_id
- Indexes created for branch-scoped queries
- Database-level RLS enforces filtering

**Rationale**: Ensures data isolation at database level, not just application level.

### BR-007: Backward Compatibility

Existing single-branch data must be preserved.

**Requirement**:

- All existing transactions, service orders, and reports remain unchanged
- Migration assigns existing data to default branch
- No data loss during migration
- Reports can show historical data by branch

**Rationale**: Maintains business continuity. Protects historical data integrity.

### BR-008: Transaction Consistency

Multi-branch operations must maintain ACID properties.

**Requirement**:

- All transactions respect branch boundaries
- Cross-branch operations are atomic
- Rollback affects only affected branch
- No data leakage between branches on failure

**Rationale**: Prevents data corruption and ensures data integrity.

---

## 6. Functional Requirements

### FR-001: Branch Selector Component

**User Story**: As a user with access to multiple branches, I want to easily switch between branches.

**Acceptance Criteria**:

- [ ] Branch selector appears in navigation for users with multi-branch access
- [ ] Clicking selector shows available branches
- [ ] Selecting branch reloads dashboard with branch-scoped data
- [ ] Selected branch is persisted in browser session
- [ ] Owner sees all branches in selector
- [ ] Managers see only their assigned branch(es)

### FR-002: Branch Management Dashboard

**User Story**: As a corporate admin, I want to manage branches and assign users to branches.

**Acceptance Criteria**:

- [ ] New "Branch Management" page accessible to Owner/Corporate Admin
- [ ] Can create new branch (ID, name, location, contact)
- [ ] Can edit branch details
- [ ] Can activate/deactivate branch
- [ ] Can view all branches with member count
- [ ] Can assign users to branch with role selection
- [ ] Can remove user from branch

### FR-003: User Assignment to Branch

**User Story**: As a corporate admin, I want to assign users to branches with appropriate roles.

**Acceptance Criteria**:

- [ ] User management page shows branch assignment form
- [ ] Can assign user to single branch with one role
- [ ] Can modify user's branch assignment (admin action)
- [ ] Can change user's role within assigned branch
- [ ] User session invalidated when branch changed (force re-login)
- [ ] Cannot assign user to multiple branches simultaneously
- [ ] List shows user's current branch and role

### FR-004: Dashboard Branch Context

**User Story**: As a branch manager, I want to see only my branch's data.

**Acceptance Criteria**:

- [ ] Admin dashboard shows only assigned branch data
- [ ] Service list filtered to assigned branch
- [ ] Transaction list filtered to assigned branch
- [ ] Inventory shows only assigned branch stock
- [ ] Reports show only assigned branch metrics
- [ ] Owner dashboard shows all branches

### FR-005: Report Branch Filtering

**User Story**: As a manager, I want to filter reports by branch.

**Acceptance Criteria**:

- [ ] Reports have branch selector dropdown
- [ ] Default selection is user's current branch
- [ ] Owner can select "All Branches" for company-wide report
- [ ] Branch-specific reports export branch name and period
- [ ] Historical data properly attributed to branch

### FR-006: Service Order Branch Assignment

**User Story**: As an admin, I want service orders to automatically belong to my branch.

**Acceptance Criteria**:

- [ ] New service order automatically assigned to user's current branch
- [ ] Service order displays branch name
- [ ] Cannot move service order between branches
- [ ] Service order cannot be modified by users in other branch

### FR-007: Transaction Branch Assignment

**User Story**: As a manager, I want transactions to belong to my branch.

**Acceptance Criteria**:

- [ ] New transaction automatically assigned to user's current branch
- [ ] Transaction list shows branch context
- [ ] Cannot create/modify transaction for other branch
- [ ] Closing dashboard shows branch transactions

### FR-008: User Onboarding per Branch

**User Story**: As a corporate admin, I want to easily onboard users to branches.

**Acceptance Criteria**:

- [ ] Create user flow shows branch assignment
- [ ] Can assign user to one or more branches
- [ ] Default branch is selectable
- [ ] User receives email with branch information
- [ ] User login redirects to default branch dashboard

---

## 7. Non-Functional Requirements

### NFR-001: Performance

- Multi-branch queries must complete in < 500ms
- Branch selector must load in < 100ms
- Dashboard must load in < 2s with branch data
- No performance degradation when adding 10+ branches

### NFR-002: Security

- All branch access must be validated at backend
- No branch_id in URL query parameters
- Branch context only from authenticated session
- RLS policies enforce at database level
- Audit log tracks inter-branch admin actions

### NFR-003: Scalability

- Support minimum 10 branches initially
- Must support 50+ branches without redesign
- Add new branch without system reconfiguration
- Linear performance scaling with branch count

### NFR-004: Availability

- Multi-branch migration must have zero downtime
- Branch isolation cannot introduce single point of failure
- Data validation must not block branch operations
- Rollback capability must be maintained at each step

### NFR-005: Maintainability

- All branch-scoped queries must follow consistent pattern
- Branch validation centralized in middleware/utilities
- Branch context passed through consistent parameter
- Documentation of branch-scoping required for new features

### NFR-006: Data Consistency

- No data leakage between branches
- Transaction isolation at branch level
- Concurrent multi-branch operations must be safe
- Backup/restore must preserve branch boundaries

---

## 8. User Stories & Scenarios

### Scenario 1: Multi-Branch Manager Login

```
Given: Manager "Budi" works in Branch Jember
When: Budi logs in
Then:
  - Budi is assigned Branch Jember as default
  - Dashboard shows only Jember data
  - Service list shows only Jember services
  - Branch selector shows only "Jember" (no other options)
  - Reports generated show Jember context
```

### Scenario 2: Owner Cross-Branch View

```
Given: Owner "Andi" needs to review all branches
When: Andi logs in
Then:
  - Dashboard shows company-wide statistics
  - Branch selector shows all branches (Jember, Kudus, etc.)
  - Andi can click branch to see branch-specific data
  - Andi can generate company-wide reports
  - Andi can switch branches without re-login
```

### Scenario 3: Service Order Assignment

```
Given: Admin "Siti" in Branch Kudus creates service order
When: Siti creates new service order
Then:
  - Service order automatically assigned to Branch Kudus
  - Technician "Rudi" in Branch Kudus can see service
  - Technician in Branch Jember cannot see service
  - Service cannot be moved between branches
```

### Scenario 4: Cross-Functional User

```
Given: User "Doni" is Admin in Branch A and Technician in Branch B
When: Doni logs in
Then:
  - Default branch is Branch A
  - Dashboard shows Branch A data with Admin permissions
  - Branch selector shows both Branch A and B
  - Switching to Branch B shows limited Technician dashboard
  - Can switch back to Branch A without re-login
```

### Scenario 5: User Removal

```
Given: Manager "Eva" needs to be removed from Branch Jember
When: Admin removes Eva from Branch Jember
Then:
  - Eva can still access Branch Kudus (if assigned)
  - Eva cannot see or access Branch Jember data
  - Eva's active session in Branch Jember is terminated
  - Audit log records the removal
```

---

## 9. Acceptance Criteria

### AC-001: Data Isolation

- [ ] Manager can only view their branch's service orders
- [ ] Manager cannot create service order for other branch
- [ ] Database query for service orders returns 0 results for non-assigned branch
- [ ] RLS policy prevents direct Supabase access to other branch data

### AC-002: User Assignment

- [ ] User can be assigned to multiple branches
- [ ] User can have different roles per branch
- [ ] User assignment is audited
- [ ] Cannot remove user from all branches

### AC-003: Branch Selector UX

- [ ] Branch selector appears in navigation
- [ ] Easy switching between branches (single click)
- [ ] Current branch clearly indicated
- [ ] Loads new branch data automatically

### AC-004: Dashboard Consistency

- [ ] All dashboards (Admin, Manager, Tech, QC, Owner) work correctly with branch scope
- [ ] Metrics accurately reflect branch data
- [ ] Charts show correct branch data
- [ ] No cross-branch data visible

### AC-005: Report Generation

- [ ] Branch-scoped reports generate correctly
- [ ] Company-wide reports (Owner only) include all branches
- [ ] Report exports include branch name
- [ ] Historical reports show correct branch attribution

### AC-006: Backward Compatibility

- [ ] Existing single-branch data migrated successfully
- [ ] No service orders or transactions lost
- [ ] Historical data accessible with correct branch context
- [ ] Owner can view pre-migration data as "default branch"

### AC-007: Zero Downtime

- [ ] Migration completed with < 5 minutes downtime
- [ ] All APIs functional during migration
- [ ] No data loss or corruption
- [ ] Rollback procedure tested and documented

### AC-008: Authorization

- [ ] All API endpoints validate branch ownership
- [ ] Non-assigned branch request rejected with 403
- [ ] Branch context derived from session, not request
- [ ] Audit trail created for all branch access

---

## 10. Success Metrics

| Metric                      | Target  | Measurement                           |
| --------------------------- | ------- | ------------------------------------- |
| **Data Isolation**          | 100%    | All queries properly scoped by branch |
| **Permission Accuracy**     | 100%    | All permission tests pass             |
| **Uptime During Migration** | 99.9%   | Zero unplanned downtime               |
| **Query Performance**       | < 500ms | Multi-branch queries avg response     |
| **User Adoption**           | 100%    | All staff trained and operational     |
| **Rollback Success**        | 100%    | Tested and documented                 |
| **Data Integrity**          | 100%    | No data loss or corruption            |
| **Audit Compliance**        | 100%    | All access logged and auditable       |
