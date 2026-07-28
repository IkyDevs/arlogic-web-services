# Testing & QA Plan
## EPIC-001: Enterprise Multi Branch System

---

## 1. Testing Strategy

### 1.1 Test Levels

| Level | Scope | Owner | Duration |
|-------|-------|-------|----------|
| **Unit Tests** | Individual functions (auth, authorization, queries) | Developers | Ongoing |
| **Integration Tests** | API endpoints with database | Developers | 1-2 weeks |
| **System Tests** | End-to-end workflows (create order → QC → pickup) | QA | 1 week |
| **UAT** | Real-world scenarios with stakeholders | Business | 1 week |
| **Performance Tests** | Load testing with multi-branch queries | DevOps | 2-3 days |

---

## 2. Unit Tests

### 2.1 Authorization Function Tests

**Test File**: `lib/auth/__tests__/authorize.test.ts`

```typescript
describe('authorize', () => {
  
  test('Owner can perform any operation', async () => {
    const context = { userId: 'owner-uuid', userRole: 'owner', branchId: 'jember' };
    expect(await authorize(context, 'create:service_order')).not.toThrow();
  });
  
  test('Non-assigned user cannot perform operation', async () => {
    const context = { userId: 'user-uuid', userRole: 'admin', branchId: 'kudus' };
    // User assigned to jember only
    expect(() => authorize(context, 'create:service_order')).toThrow(ForbiddenError);
  });
  
  test('Tech cannot create service order', async () => {
    const context = { userId: 'tech-uuid', userRole: 'technician', branchId: 'jember' };
    expect(() => authorize(context, 'create:service_order')).toThrow(ForbiddenError);
  });
  
  test('Manager can create service order in own branch', async () => {
    const context = { userId: 'mgr-uuid', userRole: 'manager', branchId: 'jember' };
    expect(await authorize(context, 'create:service_order')).not.toThrow();
  });
});
```

### 2.2 Query Branch Filtering Tests

**Test File**: `lib/services/__tests__/serviceOrderService.test.ts`

```typescript
describe('getServiceOrders', () => {
  
  test('Query includes branch filter', async () => {
    const orders = await getServiceOrders('jember-uuid');
    
    // Verify all returned orders belong to jember branch
    orders.forEach(order => {
      expect(order.branch_id).toBe('jember-uuid');
    });
  });
  
  test('Different branch returns different data', async () => {
    const jemberOrders = await getServiceOrders('jember-uuid');
    const kudusOrders = await getServiceOrders('kudus-uuid');
    
    // Jember and Kudus should have different service orders
    expect(jemberOrders).not.toEqual(kudusOrders);
  });
  
  test('Technician sees only assigned orders', async () => {
    const orders = await getServiceOrdersForTech('tech-uuid', 'jember-uuid');
    
    // All orders should be assigned to this technician
    orders.forEach(order => {
      expect(order.assigned_teknisi_id).toBe('tech-uuid');
    });
  });
});
```

---

## 3. Integration Tests

### 3.1 API Endpoint Tests

**Test File**: `app/api/__tests__/service-orders.test.ts`

```typescript
describe('GET /api/service-orders', () => {
  
  test('Admin can see own branch orders', async () => {
    const response = await fetch('/api/service-orders', {
      headers: { 'Authorization': 'Bearer admin-token-jember' }
    });
    
    expect(response.status).toBe(200);
    const data = await response.json();
    
    // All orders should be from jember branch
    data.data.forEach(order => {
      expect(order.branch_id).toBe('jember-uuid');
    });
  });
  
  test('Admin cannot see other branch orders', async () => {
    // Admin for jember tries to access kudus data
    const response = await fetch('/api/service-orders?branch_id=kudus-uuid', {
      headers: { 'Authorization': 'Bearer admin-token-jember' }
    });
    
    // Should return 403 or data from jember only (not kudus)
    expect(response.status).toBe(403 || 200);
    if (response.status === 200) {
      const data = await response.json();
      data.data.forEach(order => {
        expect(order.branch_id).toBe('jember-uuid');
      });
    }
  });
  
  test('Owner can see all branches', async () => {
    const response = await fetch('/api/service-orders', {
      headers: { 'Authorization': 'Bearer owner-token' }
    });
    
    expect(response.status).toBe(200);
    const data = await response.json();
    
    // Should have orders from multiple branches
    const branchIds = [...new Set(data.data.map(o => o.branch_id))];
    expect(branchIds.length).toBeGreaterThan(1);
  });
});

describe('POST /api/service-orders', () => {
  
  test('Service order automatically assigned to user branch', async () => {
    const response = await fetch('/api/service-orders', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer admin-token-jember' },
      body: JSON.stringify({
        customer_name: 'John Doe',
        device_brand: 'Apple',
        // No branch_id in body
      })
    });
    
    expect(response.status).toBe(201);
    const data = await response.json();
    
    // Should automatically be assigned to jember
    expect(data.data.branch_id).toBe('jember-uuid');
    expect(data.data.branch_name).toBe('Cabang Jember');
  });
  
  test('Service order creation fails for technician', async () => {
    const response = await fetch('/api/service-orders', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer tech-token-jember' },
      body: JSON.stringify({ customer_name: 'John Doe' })
    });
    
    expect(response.status).toBe(403);
  });
});
```

### 3.2 Database RLS Tests

**Test File**: `db/__tests__/rls.test.ts`

```typescript
describe('RLS Policies', () => {
  
  test('Non-owner cannot query other branch data', async () => {
    // Simulate admin from jember querying kudus data
    const result = await supabaseClientAsAdminJember
      .from('service_orders')
      .select('*')
      .eq('branch_id', 'kudus-uuid');
    
    // RLS should prevent access or return 0 rows
    expect(result.error || result.data.length).toBeFalsy();
  });
  
  test('Owner can query all branches', async () => {
    const result = await supabaseClientAsOwner
      .from('service_orders')
      .select('*');
    
    // Should return orders from multiple branches
    const branchIds = [...new Set(result.data.map(o => o.branch_id))];
    expect(branchIds.length).toBeGreaterThan(1);
  });
  
  test('Cannot UPDATE record to different branch', async () => {
    const result = await supabaseClientAsAdminJember
      .from('service_orders')
      .update({ branch_id: 'kudus-uuid' })
      .eq('id', 'order-uuid');
    
    // RLS should prevent this
    expect(result.error).toBeTruthy();
  });
});
```

---

## 4. System Tests (End-to-End)

### 4.1 Service Order Workflow - Jember Branch

**Scenario**: Service order created in Jember, worked on by Jember staff, QC by Jember supervisor, picked up

```gherkin
Feature: Multi-branch service order workflow

Scenario: Jember admin creates and manages service order
  Given Admin "Siti" is logged into Cabang Jember
  When Siti creates new service order for customer "John Doe"
  Then Service order is created with branch_id = "jember-uuid"
  And Service order is visible in Jember dashboard
  
  When Technician "Rudi" logs into Cabang Jember
  And Rudi takes the service order
  Then Assigned_teknisi_id = "rudi-uuid"
  And Order moves to "assigned" status
  
  When Rudi completes work and submits for QC
  Then Order moves to "qc_pending" status
  
  When Supervisor "Eka" logs into Cabang Jember
  And Eka reviews the service order
  And Eka approves quality
  Then Order moves to "completed" status
  
  When Siti marks service as picked up
  Then Order moves to "done" status
  And Cannot be modified further
```

### 4.2 Cross-Functional User - Jember & Kudus

**Scenario**: Technician "Rudi" works in both Jember and Kudus

```gherkin
Feature: User with multiple branch assignments

Scenario: Technician works in multiple branches
  Given Rudi is assigned to Jember (Technician) and Kudus (Technician)
  When Rudi logs in
  Then Default branch is Jember
  And Dashboard shows Jember assignment
  
  When Rudi clicks branch selector
  Then Available branches: Jember, Kudus
  
  When Rudi selects Kudus
  Then Session updated to Kudus
  And Dashboard reloaded with Kudus data
  And Cannot see Jember's assigned services
  
  When Rudi switches back to Jember
  Then Session updated to Jember
  And Sees Jember's assigned services again
```

### 4.3 Owner Cross-Branch Reporting

**Scenario**: Owner generates company-wide report

```gherkin
Feature: Owner views company-wide metrics

Scenario: Owner generates revenue report for all branches
  Given Owner "Andi" is logged in
  When Andi navigates to Reports
  And Selects "All Branches"
  Then Report shows revenue breakdown:
    | Branch | Revenue | Transactions |
    | Jember | 50M | 100 |
    | Kudus | 30M | 60 |
    | Total | 80M | 160 |
  
  When Andi clicks "View Jember"
  Then Dashboard switches to Jember context
  And Shows only Jember data
  And Andi can drill into branch details
```

---

## 5. UAT Checklist

### 5.1 User Management UAT

**Test Case 1**: Create new user assigned to branch

```
✓ Create user "Eva" with email eva@arlogic.com
✓ Assign to Cabang Jember as Admin
✓ User receives welcome email
✓ Eva logs in and sees Jember dashboard
✓ Eva can create service orders in Jember
✓ Eva cannot see Kudus data
```

**Test Case 2**: Assign user to multiple branches

```
✓ Create user "Doni"
✓ Assign to Cabang Jember as Technician
✓ Assign to Cabang Kudus as Manager
✓ Doni logs in (default: Jember)
✓ Doni sees Technician dashboard (limited)
✓ Doni switches to Kudus
✓ Doni sees Manager dashboard (full)
✓ Different permissions in different branches
```

**Test Case 3**: Remove user from branch

```
✓ Remove Eva from Jember
✓ Eva's session invalidated
✓ Eva must log in again
✓ Eva can see error: "No branch access"
✓ Eva needs reassignment to access system
```

### 5.2 Data Isolation UAT

**Test Case 1**: Admin cannot see other branch data

```
✓ Admin A (Jember) logs in
✓ Service orders: Only Jember visible
✓ Transactions: Only Jember visible
✓ Inventory: Only Jember visible
✓ Admin A cannot access Kudus even by URL manipulation
```

**Test Case 2**: Service order assignment integrity

```
✓ Create service order in Jember
✓ Jember staff can see and work on it
✓ Kudus staff cannot see it
✓ QC from Kudus cannot approve Jember order
✓ Cannot move service order to different branch
```

### 5.3 Owner Privilege UAT

**Test Case 1**: Owner sees all branches

```
✓ Owner logs in
✓ Dashboard shows company-wide statistics
✓ Can select branch to switch context
✓ Can switch back to all-branches view
✓ Can create new branch
✓ Can assign users to branches
✓ Can view all user assignments
```

### 5.4 Performance UAT

**Test Case 1**: Response times acceptable

```
✓ Dashboard loads in < 2 seconds
✓ Service order list loads in < 1 second
✓ Branch selector dropdown opens immediately
✓ Branch switching completes in < 3 seconds
✓ Queries work smoothly with 10+ branches
```

---

## 6. Authorization & Permission Tests

### 6.1 Role-Based Operation Tests

| Role | Create Order | Approve QC | Manage Users | See All Branches |
|------|--------------|-----------|--------------|------------------|
| Owner | ✓ All | ✓ All | ✓ All | ✓ Yes |
| Manager | ✓ Own | ✓ Own | ❌ | ❌ |
| Admin | ✓ Own | ❌ | ❌ | ❌ |
| Technician | ❌ | ❌ | ❌ | ❌ |
| QC | ❌ | ✓ Own | ❌ | ❌ |

**Test Execution**:
```
For each role/operation:
  1. Attempt operation
  2. Verify: Success (✓) or Denied (❌)
  3. Check authorization error message
  4. Verify no data leakage
```

---

## 7. Data Integrity Tests

### 7.1 Branch Assignment Validation

```sql
-- Test 1: All users have valid branch assignments
SELECT COUNT(*) FROM user_branch_assignments
WHERE user_id NOT IN (SELECT id FROM profiles)
  OR branch_id NOT IN (SELECT id FROM branches);
-- Should return 0

-- Test 2: Every operational record has valid branch
SELECT COUNT(*) FROM service_orders
WHERE branch_id NOT IN (SELECT id FROM branches);
-- Should return 0
```

### 7.2 Cascading Delete Tests

```
Test 1: Delete branch cascades
  1. Create Branch "Test"
  2. Create service order in "Test" branch
  3. Delete Branch "Test"
  4. Verify: Service order deleted (CASCADE)
  5. Verify: No orphaned records

Test 2: Delete user cascades
  1. Create User "Test User"
  2. Assign to branches
  3. Delete User
  4. Verify: All assignments deleted (CASCADE)
```

---

## 8. Security Tests

### 8.1 Authorization Bypass Tests

```
Test 1: Cannot send branch_id in request
  - POST /api/service-orders with branch_id in body
  - Result: branch_id ignored, auto-set from session
  - Verify: Service order created in user's branch, not requested branch

Test 2: Cannot modify branch_id in request header
  - POST with X-Branch-ID: kudus
  - User is from jember
  - Result: 403 Forbidden or data created in jember

Test 3: Cannot access data via direct URL
  - GET /api/service-orders?branch_id=kudus (as jember user)
  - Result: 403 Forbidden or empty result

Test 4: JWT tampering
  - Modify token to change branch_id claim
  - Result: Token validation fails or branch_id ignored
```

### 8.2 RLS Policy Tests

```
Test 1: SELECT query respects RLS
  - Query as non-owner
  - Result: Only assigned branch data returned

Test 2: INSERT blocked if not in branch
  - Try INSERT to jember (assigned to kudus only)
  - Result: RLS policy blocks insertion

Test 3: UPDATE blocked across branches
  - Try UPDATE branch_id from jember to kudus
  - Result: RLS policy blocks update
```

---

## 9. Regression Tests

### 9.1 Existing Functionality

Verify all existing features still work:

```
✓ Service order creation
✓ Technician queue assignment
✓ QC review and approval
✓ Sparepart request workflow
✓ Inventory management
✓ Transaction recording
✓ Daily closing
✓ Report generation
✓ Telegram integration
✓ Customer feedback
✓ Attendance tracking
```

### 9.2 API Backward Compatibility

```
✓ Existing API endpoints still work
✓ Existing response formats preserved
✓ No breaking changes to clients
✓ Migration path for future API versions
```

---

## 10. Performance & Load Tests

### 10.1 Multi-Branch Query Performance

```
Scenario: Owner queries all branches
  - 10 branches
  - 1000 service orders
  - Expected: < 500ms

Scenario: Manager queries own branch
  - 1 branch
  - 500 service orders
  - Expected: < 100ms

Scenario: Dashboard loads with all data
  - All widgets populated
  - Charts rendered
  - Expected: < 2 seconds
```

### 10.2 Concurrent User Tests

```
Scenario: 50 concurrent users logged in
  - 30 from Jember branch
  - 20 from Kudus branch
  - Each querying their data simultaneously
  - Expected: All queries succeed, no errors
```

---

## 11. Sign-Off

### 11.1 QA Sign-Off Checklist

- [ ] All unit tests passing
- [ ] All integration tests passing
- [ ] All system tests completed
- [ ] All UAT scenarios completed
- [ ] No critical/high bugs remaining
- [ ] Performance acceptable
- [ ] Security tests passed
- [ ] Data integrity verified
- [ ] Authorization working correctly
- [ ] Rollback tested and documented

### 11.2 Stakeholder Sign-Off

- [ ] Business stakeholders approved
- [ ] Technical leads approved
- [ ] Security team approved
- [ ] DevOps team approved
- [ ] No blockers for production deployment

