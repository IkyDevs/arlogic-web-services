# TASKS 004-012: Implementation Tasks Summary

This file provides an overview of tasks 4-12. Each task needs a detailed document following the same structure as TASK-001-003.

---

## TASK-004: Database RLS Policies - Implement Branch Isolation

**Priority**: 🟠 High | **Difficulty**: ⭐⭐⭐ Hard | **Duration**: 2 days

**Objective**: Create Row-Level Security (RLS) policies to enforce branch isolation at database level.

**Scope**:
- Enable RLS on all operational tables
- Create policies for Owner (sees all)
- Create policies for non-Owner (sees only assigned branches)
- Test RLS prevents cross-branch data access
- Document RLS strategy

**Key Tasks**:
- [ ] Enable RLS on all tables: service_orders, layanan, inventory, etc.
- [ ] Create Owner bypass policy (role='owner' → no filter)
- [ ] Create non-Owner restrictive policy (check user_branch_assignments)
- [ ] Test policy effectiveness (SELECT returns 0 for unauthorized branch)
- [ ] Test INSERT prevention (cannot create in unauthorized branch)
- [ ] Performance testing with RLS enabled

**Dependencies**: Requires TASK-003 (indexes) for RLS query performance

**Risk**: RLS policies can be complex; extensive testing needed

**Success Criteria**:
- [x] Direct Supabase queries respect branch isolation
- [x] Non-owner cannot access other branch data
- [x] Owner can see all branches
- [x] Performance not significantly degraded

---

## TASK-005: Authentication - Add Branch Context to JWT & Session

**Priority**: 🟠 High | **Difficulty**: ⭐⭐ Medium | **Duration**: 2 days

**Objective**: Extend authentication system to include branch context (branch_id, role_in_branch).

**Scope**:
- Modify login flow to fetch user's branch assignments
- Add branch_id to JWT claims
- Add branch_id to session/localStorage
- Create auth context hook
- Update getSessionContext to extract branch info

**Key Tasks**:
- [ ] Modify `lib/supabase/profile.ts` to load user_branch_assignments
- [ ] Update `ensureProfile` to include branches array
- [ ] Modify JWT generation to include branch_id
- [ ] Update Zustand auth store to track branches and current branch
- [ ] Create `useAuthContext()` hook for components
- [ ] Update middleware to extract and validate branch_id

**Dependencies**: Requires TASK-001, TASK-002 (user_branch_assignments table)

**Risk**: Auth changes affect all users; thorough testing required

**Success Criteria**:
- [x] JWT includes branch_id claim
- [x] Session has branches array and current branch
- [x] Backend can extract branch_id from request
- [x] No auth failures post-deployment

---

## TASK-006: Authentication - Create Branch Assignment & Switching System

**Priority**: 🟠 High | **Difficulty**: ⭐⭐⭐ Hard | **Duration**: 2 days

**Objective**: Build UI and APIs for assigning users to branches and switching between them.

**Scope**:
- Create user-branch assignment endpoints (POST, PUT, DELETE)
- Create branch switching endpoint
- Build branch selector UI component
- Handle session updates on branch switch
- Manage default branch assignment

**Key Tasks**:
- [ ] Implement `POST /api/users` (assign user to branch)
- [ ] Implement `PUT /api/users/:id/branch/:branchId` (update role)
- [ ] Implement `DELETE /api/users/:id/branch/:branchId` (remove from branch)
- [ ] Implement `POST /api/branch-switch` (switch current branch)
- [ ] Create BranchSelector.tsx component
- [ ] Handle session cookie updates on switch

**Dependencies**: Requires TASK-005 (auth context), TASK-002 (user_branch_assignments table)

**Acceptance Criteria**:
- [x] Users can be assigned to branches
- [x] Users can switch branches without re-login
- [x] Branch selector UI works smoothly
- [x] Session updates correctly on switch

---

## TASK-007: API Layer - Add Branch ID to Request/Response Handling

**Priority**: 🟠 High | **Difficulty**: ⭐⭐ Medium | **Duration**: 3 days

**Objective**: Modify all API routes to enforce branch_id from session and validate branch ownership.

**Scope**:
- Create `getRequestContext()` utility
- Update all GET endpoints to filter by branch_id
- Update all POST endpoints to auto-set branch_id
- Update all PUT/DELETE endpoints to validate branch ownership
- Add authorization checks to each route
- Include branch_id in responses for audit

**Key Tasks**:
- [ ] Create context extraction middleware
- [ ] Update service GET endpoints (service-orders, layanan, inventory)
- [ ] Update transaction POST endpoints
- [ ] Update service order creation to enforce branch
- [ ] Add authorization decorator to routes
- [ ] Test all endpoints enforce branch isolation

**Dependencies**: Requires TASK-004 (RLS), TASK-005 (auth context)

**Success Criteria**:
- [x] All endpoints validate branch context
- [x] Non-assigned branch requests return 403
- [x] Response includes branch_id for audit
- [x] No breaking changes to existing clients

---

## TASK-008: API - Create Branch Management Endpoints

**Priority**: 🟠 High | **Difficulty**: ⭐⭐ Medium | **Duration**: 2 days

**Objective**: Build REST API for branch master data management.

**Scope**:
- GET /api/branches (list accessible branches)
- POST /api/branches (create new branch - Owner only)
- PUT /api/branches/:id (edit branch)
- DELETE /api/branches/:id (soft delete branch)
- GET /api/users (list branch users)
- POST /api/users (assign user)
- PUT /api/users/:id/branch/:branchId (update role)
- DELETE /api/users/:id/branch/:branchId (remove user)

**Key Tasks**:
- [ ] Implement branch CRUD endpoints
- [ ] Implement user-branch assignment endpoints
- [ ] Add ownership validation (Owner only)
- [ ] Add branch existence validation
- [ ] Create error responses (409 on duplicate, 404 on not found)
- [ ] Document endpoints in OpenAPI/Swagger

**Dependencies**: Requires TASK-007 (branch validation framework)

**Acceptance Criteria**:
- [x] Owner can create branches
- [x] Branches can be edited/deactivated
- [x] Users can be assigned to branches
- [x] Non-owner requests rejected

---

## TASK-009: Frontend - Create Branch Selector Component

**Priority**: 🟠 High | **Difficulty**: ⭐⭐ Medium | **Duration**: 2 days

**Objective**: Build intuitive UI component for branch selection.

**Scope**:
- Create BranchSelector dropdown component
- Display current branch prominently
- Show list of accessible branches
- Handle branch switching with API call
- Update session and localStorage on switch
- Show loading state during switch
- Handle errors gracefully

**Key Tasks**:
- [ ] Create BranchSelector.tsx component
- [ ] Implement dropdown UI (Radix UI compatible)
- [ ] Add branch switch functionality
- [ ] Handle loading/error states
- [ ] Add to navigation bar
- [ ] Test on mobile (responsive)
- [ ] Add keyboard navigation

**Dependencies**: Requires TASK-006 (branch switching API), TASK-008 (GET /api/branches)

**Success Criteria**:
- [x] Component integrates into navigation
- [x] Dropdown works smoothly
- [x] Branch switch updates data immediately
- [x] Mobile responsive

---

## TASK-010: Frontend - Update Dashboards for Branch Scope

**Priority**: 🟠 High | **Difficulty**: ⭐⭐⭐ Hard | **Duration**: 4 days

**Objective**: Modify all dashboard pages to display and respect branch context.

**Scope**:
- Update admin dashboard (branch-specific)
- Update manager dashboard (branch-specific)
- Update technician dashboard (personal + branch)
- Update QC dashboard (branch-specific)
- Update owner dashboard (company-wide overview)
- Update all data queries to include branch filter
- Update charts/widgets for branch context
- Add branch name display

**Key Tasks**:
- [ ] Modify app/admin/page.tsx for branch scope
- [ ] Modify app/manager/page.tsx for branch scope
- [ ] Modify app/teknisi/page.tsx for assigned services
- [ ] Modify app/qc/page.tsx for branch QC queue
- [ ] Modify app/owner/page.tsx for company overview
- [ ] Update all data fetch functions to filter by branch
- [ ] Update ServiceOrderForm to show branch (read-only)
- [ ] Update TransactionForm to show branch (read-only)
- [ ] Update LayananList to show branch context
- [ ] Update reports to include branch selector

**Dependencies**: Requires TASK-007 (API layer updated)

**Risk**: Large scope; coordinate across frontend team

**Success Criteria**:
- [x] All dashboards show only branch-specific data
- [x] Owner sees company-wide view
- [x] Manager/Admin see only their branch
- [x] Branch name displayed throughout
- [x] Forms show auto-selected branch (read-only)

---

## TASK-011: Data Migration - Execute Migration & Validation

**Priority**: 🟠 High | **Difficulty**: ⭐⭐⭐ Hard | **Duration**: 2 days

**Objective**: Execute the prepared migration plan from MIGRATION.md with zero downtime.

**Scope**:
- Create default branch
- Migrate existing data to default branch
- Assign all users to default branch
- Validate data integrity
- Verify no data loss
- Create backups before and after

**Key Tasks**:
- [ ] Backup database (full snapshot)
- [ ] Create default branch
- [ ] Run data migration scripts (layanan, service_orders, etc.)
- [ ] Set user default_branch_id
- [ ] Assign all users to default branch
- [ ] Verify all records have branch_id (no NULLs)
- [ ] Run referential integrity checks
- [ ] Test queries work correctly
- [ ] Document migration completion

**Dependencies**: Requires all schema tasks (TASK-001-003)

**Downtime**: 5-15 minutes expected (during bulk UPDATE)

**Risk**: Data loss possible if migration fails; have rollback ready

**Success Criteria**:
- [x] Zero rows have NULL branch_id
- [x] All FK constraints valid
- [x] All users have default_branch_id set
- [x] All users assigned to default branch
- [x] Queries return correct branch-scoped results

---

## TASK-012: Testing & Deployment - QA, UAT, Production

**Priority**: 🟠 High | **Difficulty**: ⭐⭐⭐ Hard | **Duration**: 3 days

**Objective**: Execute comprehensive testing and deploy to production.

**Scope**:
- Run all integration tests
- Execute UAT scenarios
- Verify permission/authorization
- Test branch isolation
- Load test with multiple branches
- Production deployment
- Post-deployment monitoring
- Rollback if needed

**Key Tasks**:
- [ ] Run unit test suite
- [ ] Run integration test suite
- [ ] Execute UAT checklist (from TESTING.md)
- [ ] Test authorization matrix (all role combinations)
- [ ] Test branch isolation (cross-branch attempts)
- [ ] Performance test (owner queries all branches)
- [ ] Test rollback procedure (on staging)
- [ ] Deploy to production (blue-green)
- [ ] Monitor for errors (first 24h)
- [ ] Document any issues
- [ ] Prepare hotfix if needed

**Dependencies**: All TASK-001-011 must be completed

**Sign-off**: Business, Tech, QA, Security all approve

**Success Criteria**:
- [x] All tests passing
- [x] UAT sign-off received
- [x] Zero production errors
- [x] Data isolation verified
- [x] Performance acceptable
- [x] Rollback procedure tested

---

## Task Sequencing & Dependencies

```
Start: TASK-001 & TASK-002 (can run in parallel)
    ↓
TASK-003 (depends on TASK-001, TASK-002)
    ↓
TASK-004 (depends on TASK-003)
    ↓
TASK-005 (depends on TASK-001, TASK-002)
    ├─→ TASK-006 (depends on TASK-005)
    │   ├─→ TASK-007 (depends on TASK-006)
    │   │   ├─→ TASK-008 (depends on TASK-007)
    │   │   │   ├─→ TASK-009 (depends on TASK-008)
    │   │   │   │   └─→ TASK-010 (depends on TASK-009)
    │   │   │   │       └─→ TASK-011 (depends on all)
    │   │   │   │           └─→ TASK-012 (depends on TASK-011)
    │   
    └─→ TASK-011 (ready after TASK-005)

Parallel Opportunities:
  - TASK-001 & TASK-002 (different tables)
  - TASK-005 & TASK-003 (different concerns)
  - TASK-008 & TASK-009 (API + UI can overlap)

Critical Path:
  TASK-001 → TASK-003 → TASK-004 → TASK-005 → 
  TASK-006 → TASK-007 → TASK-010 → TASK-011 → TASK-012
```

---

## Total Effort Estimation

| Task | Duration | Total |
|------|----------|-------|
| TASK-001 | 2 days | 16h |
| TASK-002 | 2 days | 16h |
| TASK-003 | 1 day | 8h |
| TASK-004 | 2 days | 16h |
| TASK-005 | 2 days | 16h |
| TASK-006 | 2 days | 16h |
| TASK-007 | 3 days | 24h |
| TASK-008 | 2 days | 16h |
| TASK-009 | 2 days | 16h |
| TASK-010 | 4 days | 32h |
| TASK-011 | 2 days | 16h |
| TASK-012 | 3 days | 24h |
| **TOTAL** | **27 days** | **216h** |

**With parallelization**: ~15-18 business days
**With 2-person team**: ~8-10 business days

