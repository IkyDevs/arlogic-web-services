# Architecture Review - Revision Notes
## EPIC-001: Enterprise Multi Branch System

**Date**: July 28, 2026  
**Version**: 1.1 (Revised)

---

## Summary of Changes

This document tracks all revisions made to EPIC-001 documentation based on architecture review feedback.

### Revision Decisions Applied

✅ **REVISION 1**: Remove M:N user-branch mapping  
✅ **REVISION 2**: Remove RLS (use application-layer only)  
✅ **REVISION 3**: Remove branch_name denormalization  
✅ **REVISION 4**: Audit and categorize tables (Global/Master/Operational)  
✅ **REVISION 5**: Create DECISIONS.md with ADRs  
✅ **REVISION 6**: Update all documents for consistency  

---

## Updated Documents

### ✅ README.md
- Updated architecture principles (1:1 instead of M:N)
- Added "Repository Layer Enforcement" principle
- Removed M:N and RLS references
- Clarified backend-driven security model

### ✅ DATABASE.md  
- Complete rewrite with new structure:
  - Removed user_branch_assignments explanation
  - Added "Single Branch Per User Model" section
  - Introduced table categorization: **Global**, **Master**, **Operational**
  - Removed denormalization examples
  - Updated schema examples for 1:1 model
- Kept migration planning (will be updated next)

### ✅ ARCHITECTURE.md
- Complete rewrite with new focus:
  - 1:1 user-branch model (removed M:N flow diagrams)
  - Application-layer isolation (removed RLS policies)
  - Simple session extraction (no user_branch_assignments table)
  - Removed all references to branch_name denormalization
  - Simplified authorization flow
  - Added "Why No RLS?" section with rationale
  - Updated system diagram to show middleware-based isolation

### ✅ RBAC.md
- Updated role definitions (removed M:N complexity):
  - Owner: Global role, queries all branches
  - Manager/Admin/Technician/QC: 1:1 branch assignment
- Removed cross-functional user scenarios (M:N not supported)
- Updated permission matrix (simpler, no per-branch role variance)
- Simplified authorization model
- Added code examples for 1:1 enforcement

### ✅ DECISIONS.md (NEW)
- Created comprehensive ADR document with 8 decisions:
  - ADR-001: Single database multi-tenant
  - ADR-002: Use branch_id for isolation
  - ADR-003: Branch from session only
  - ADR-004: 1:1 user-branch (not M:N) ← KEY DECISION
  - ADR-005: App-layer isolation (not RLS) ← KEY DECISION
  - ADR-006: No user_branch_assignments table
  - ADR-007: Defer RLS until needed
  - ADR-008: No branch_name denormalization ← KEY DECISION
- Each ADR includes Context, Decision, Rationale, Consequences, Status

---

## Documents Needing Updates (Next Steps)

### ⏳ MIGRATION.md
- [ ] Remove user_branch_assignments migration steps
- [ ] Remove RLS policy creation steps
- [ ] Update "Phase 6" (currently about user assignments M:N)
- [ ] Simplify user assignment to: UPDATE profiles SET branch_id = default_branch
- [ ] Remove "Trigger to keep branch_name in sync" section
- [ ] Keep migration phases 1-5 (schema changes are same)

**Key Changes**:
- Step 3: Simpler user assignment (direct UPDATE, not M:N insert)
- Remove RLS enable/policy steps
- Remove branch_name denormalization triggers

### ⏳ TESTING.md
- [ ] Remove M:N assignment test scenarios
- [ ] Remove RLS policy test cases
- [ ] Update "Cross-Functional User" scenario (removed - no multi-branch users)
- [ ] Remove "user_branch_assignments" validation tests
- [ ] Keep authorization tests (still relevant)
- [ ] Keep branch isolation tests

**Key Changes**:
- Scenario: "User removed from branch" → becomes "User transferred to branch"
- Remove scenario: "User assigned to multiple branches"
- Update scope validation to use profiles.branch_id

### ⏳ API.md
- [ ] Remove user-branch assignment endpoints:
  - ❌ DELETE /api/users/:userId/branch/:branchId
  - ❌ PUT /api/users/:userId/branch/:branchId (update role)
- [ ] Update /api/users to reflect 1:1 model:
  - ✅ POST /api/users (create user with single branch)
  - ✅ PUT /api/users/:id (update branch_id directly)
  - ❌ No "assign to multiple branches"
- [ ] Remove branch-switch endpoint (no branch context switching mid-session)
- [ ] Remove branch selector component requirements
- [ ] Keep all service/transaction/inventory endpoints (unchanged)

**Key Changes**:
- User creation assigns exactly one branch (not multiple)
- User update can change branch_id (not update role per-branch)
- No branch switching in session (must re-login for different branch)

### ⏳ UI-UX.md
- [ ] Remove Branch Selector component (users bound to single branch)
- [ ] Remove branch switching behavior
- [ ] Remove Manager/Admin with multiple branch options
- [ ] Remove "Scenario 2: Cross-Functional User Switching"
- [ ] Update dashboards:
  - Manager dashboard: Single branch only (no context switch)
  - Admin dashboard: Single branch only
  - Technician dashboard: Single branch only
  - Owner dashboard: Company-wide (no switch needed)
- [ ] Remove user assignment modal with multiple branches

**Key Changes**:
- No per-user branch selector in navbar
- Dashboard loads with user's single assigned branch
- Branch changes require admin action + re-login
- Simpler UI (one branch per user session)

### ⏳ All TASK Files (TASK-001 to TASK-012)
- [ ] TASK-001: No changes needed (schema changes same)
- [ ] TASK-002: No changes needed (schema changes same)
- [ ] TASK-003: Remove RLS index optimization mentions
- [ ] TASK-004: **REMOVE ENTIRELY** (no RLS implementation)
- [ ] TASK-005: Update to reflect 1:1 user-branch model
- [ ] TASK-006: **REMOVE ENTIRELY** (no user-branch assignment system)
- [ ] TASK-007: Simplify (no branch switching, just profile.branch_id)
- [ ] TASK-008: Remove user-branch assignment endpoints
- [ ] TASK-009: **REMOVE ENTIRELY** (no branch selector component)
- [ ] TASK-010: Update dashboards (no branch context switching)
- [ ] TASK-011: Simplify user assignment migration step
- [ ] TASK-012: Remove RLS, M:N, branch_selector tests

**Impact**:
- Total tasks reduced from 12 to 10 (remove TASK-004, TASK-006, TASK-009)
- TASK-004-012-SUMMARY.md needs complete rewrite
- Effort estimation changes (fewer tasks = less time)

---

## Key Architectural Changes

### Before (Rejected)
```
Many-to-Many User Branch:
  user → user_branch_assignments → branch
  
RLS Policies:
  CREATE POLICY ... ON service_orders
  USING (branch_id IN (SELECT ...))
  
Branch Name Denormalization:
  service_orders { id, branch_id, branch_name, ... }
  with triggers to sync
  
Branch Selector UI:
  User can switch branches mid-session
```

### After (Approved)
```
One-to-One User Branch:
  profiles { id, email, branch_id }
  ↓
  branch change = UPDATE + re-login
  
Application-Layer Isolation:
  Middleware → Authorization → Repository
  WHERE branch_id = user.branch_id
  
No Denormalization:
  service_orders { id, branch_id, ... }
  → JOIN branches for name
  
No Branch Switching:
  Branch fixed per session
  → Transfer requires re-login
```

---

## Consistency Checks

### Terms to Search & Replace

| Old | New | Examples |
|-----|-----|----------|
| `user_branch_assignments` | ❌ Remove | "Many-to-many user-branch mapping" |
| `default_branch_id` | ✅ Keep | "User's primary branch" → Just "User's branch" |
| `RLS policies` | ❌ Remove | "Row-Level Security" sections |
| `branch_name denormalization` | ❌ Remove | "Cached branch_name" references |
| `active_branch` | ❌ Remove | "Current branch context switching" |
| `branch selector` | ❌ Remove | "Component to switch branches" |
| `M:N relationship` | ❌ Remove | "Many-to-many user assignments" |
| `multiple branches per user` | ❌ Remove | "Cross-functional scenarios" |

### Documents to Verify

- ✅ README.md - Updated
- ✅ DATABASE.md - Updated  
- ✅ ARCHITECTURE.md - Updated
- ✅ RBAC.md - Updated
- ✅ DECISIONS.md - Created
- ⏳ PRD.md - Check for M:N references
- ⏳ MIGRATION.md - Major updates needed
- ⏳ TESTING.md - Update test scenarios
- ⏳ API.md - Remove assignment endpoints
- ⏳ UI-UX.md - Remove branch selector
- ⏳ TASK files - Consolidate tasks

---

## Effort Estimation (Revised)

### Task Count Changes
- **Before**: 12 tasks
- **After**: ~10 tasks (remove TASK-004, TASK-006, TASK-009)
- **Savings**: ~18% fewer tasks

### Time Estimation (Per Task)
| TASK | Before | After | Change |
|------|--------|-------|--------|
| TASK-001 | 2d | 2d | Same |
| TASK-002 | 2d | 2d | Same |
| TASK-003 | 1d | 1d | Same |
| TASK-004 | 2d | ❌ Removed | -2d |
| TASK-005 | 2d | 1d | -1d (simpler) |
| TASK-006 | 2d | ❌ Removed | -2d |
| TASK-007 | 3d | 2d | -1d (simpler) |
| TASK-008 | 2d | 1d | -1d (fewer endpoints) |
| TASK-009 | 2d | ❌ Removed | -2d |
| TASK-010 | 4d | 3d | -1d (no switching) |
| TASK-011 | 2d | 1d | -1d (simpler migration) |
| TASK-012 | 3d | 2d | -1d (fewer tests) |
| **TOTAL** | **27d** | **18d** | **-9d (33% reduction)** |

---

## Next Steps

1. **Update Remaining Documents** (Priority Order):
   - MIGRATION.md (critical for implementation)
   - TESTING.md (needed before implementation)
   - API.md (needed before coding)
   - UI-UX.md (UX review stage)
   - PRD.md (final review)

2. **Update Task Files**:
   - Consolidate TASK-004-012-SUMMARY.md with new task list
   - Create individual TASK files (TASK-004 through TASK-010)

3. **Final Review**:
   - Consistency check across all documents
   - Verify no M:N/RLS/denormalization references
   - Confirm DECISIONS.md covers all major choices

4. **Approval Stage**:
   - Architecture team review
   - Business stakeholder sign-off
   - Ready for implementation planning

---

## Review Checklist

- [x] README updated with 1:1 model
- [x] DATABASE.md rewritten (categorized tables)
- [x] ARCHITECTURE.md rewritten (app-layer isolation)
- [x] RBAC.md updated (1:1 user-branch)
- [x] DECISIONS.md created (8 ADRs)
- [ ] MIGRATION.md updated (remove M:N/RLS steps)
- [ ] TESTING.md updated (remove M:N scenarios)
- [ ] API.md updated (remove assignment endpoints)
- [ ] UI-UX.md updated (remove branch selector)
- [ ] PRD.md reviewed for consistency
- [ ] TASK files consolidated (10 tasks instead of 12)
- [ ] Effort estimation updated
- [ ] Final consistency check complete

---

## Sign-Off

**Revision Prepared By**: Architecture Review Process  
**Date**: July 28, 2026  
**Status**: ✅ **READY FOR REMAINING UPDATES**

Next phase: Complete remaining document updates (MIGRATION, TESTING, API, UI-UX, TASKS).

