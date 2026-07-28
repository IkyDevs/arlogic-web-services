# API Specification
## EPIC-001: Enterprise Multi Branch System

---

## 1. Core Principle: Branch in Session, Not in Request

**Critical Rule**: 
- `branch_id` is NEVER sent in request body, query params, or headers by client
- `branch_id` is ALWAYS derived from authenticated session
- Backend enforces: `branch_id = session.branch_id`
- If user not assigned to branch, request rejected with 403

---

## 2. API Layer Architecture

### 2.1 Request Flow

```
Client Request
    ↓
Extract JWT from Authorization header / Cookies
    ↓
Verify JWT signature (Supabase)
    ↓
Get User Profile + Branch Assignment
    ↓
Extract: user_id, branch_id, role, assigned_branches
    ↓
Store in RequestContext
    ↓
Validate: Is user assigned to requested branch?
    ↓
Check: Does role permit this operation?
    ↓
Execute with branch_id enforced
    ↓
Response with branch_id included (for audit)
```

### 2.2 Middleware Implementation

```typescript
// middleware.ts

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  
  // Skip public routes
  if (['/login', '/tracking', '/feedback'].includes(path)) {
    return NextResponse.next();
  }
  
  // 1. Get session
  const session = await getSession(request);
  if (!session?.user) {
    return NextResponse.redirect(new URL('/login', request.url));
  }
  
  // 2. Get branch context
  const branchId = request.cookies.get('x-branch-id')?.value 
    || session.profile?.default_branch_id;
  
  // 3. Add to headers for route handlers
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-branch-id', branchId);
  requestHeaders.set('x-user-id', session.user.id);
  requestHeaders.set('x-user-role', session.profile.role);
  
  return NextResponse.next({
    request: { headers: requestHeaders },
  });
}
```

### 2.3 Context Helper

```typescript
// lib/api-context.ts

export async function getRequestContext(request: NextRequest) {
  const userId = request.headers.get('x-user-id');
  const branchId = request.headers.get('x-branch-id');
  const userRole = request.headers.get('x-user-role');
  
  if (!userId || !branchId) {
    throw new UnauthorizedError('Missing authentication context');
  }
  
  // Validate user is assigned to branch
  const assignment = await db
    .from('user_branch_assignments')
    .select('*')
    .eq('user_id', userId)
    .eq('branch_id', branchId)
    .single();
  
  if (!assignment) {
    throw new ForbiddenError('User not assigned to this branch');
  }
  
  return {
    userId,
    branchId,
    userRole,
    roleInBranch: assignment.role,  // May differ from global role
  };
}
```

---

## 3. Modified Endpoints (Existing Functionality)

### 3.1 Service Orders API

#### GET /api/service-orders
**Get service orders for current branch**

```http
GET /api/service-orders?status=pending&limit=20&offset=0
Authorization: Bearer <jwt>
```

**Response**:
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "branch_id": "jember-uuid",
      "branch_name": "Cabang Jember",
      "invoice_number": "INV-001",
      "customer_name": "John Doe",
      "status": "pending",
      "created_at": "2026-07-28T10:00:00Z",
      ...
    }
  ],
  "count": 15,
  "total": 150,
  "branch_id": "jember-uuid"  // Confirm branch context
}
```

**Authorization**: Admin, Manager, QC, Technician (filtered by assignment)

**Backend**:
```typescript
export async function GET(request: NextRequest) {
  const { branchId, userRole, roleInBranch } = await getRequestContext(request);
  const { status, limit = 20, offset = 0 } = Object.fromEntries(
    new URLSearchParams(request.nextUrl.search)
  );
  
  // Build query with branch filter
  let query = db
    .from('service_orders')
    .select('*')
    .eq('branch_id', branchId);  // ← MANDATORY
  
  if (status) query = query.eq('status', status);
  
  // Role-based filtering
  if (roleInBranch === 'technician') {
    query = query.eq('assigned_teknisi_id', userId);  // Only own orders
  }
  
  const { data, count, error } = await query
    .range(offset, offset + limit - 1)
    .order('created_at', { ascending: false });
  
  if (error) throw new DatabaseError(error);
  
  return NextResponse.json({
    success: true,
    data,
    count,
    branch_id: branchId,
  });
}
```

---

#### POST /api/service-orders
**Create new service order (automatically for current branch)**

```http
POST /api/service-orders
Authorization: Bearer <jwt>
Content-Type: application/json

{
  "customer_name": "Jane Smith",
  "customer_phone": "+62-8123456789",
  "device_brand": "Apple",
  "device_model": "Watch Series 7",
  "watch_model": "Rolex Submariner",
  "issue_description": "Not working",
  ...
}
```

**Note**: No `branch_id` in request body. It's added from session.

**Response**:
```json
{
  "success": true,
  "data": {
    "id": "new-uuid",
    "branch_id": "jember-uuid",  ← Automatically set
    "branch_name": "Cabang Jember",  ← From branch master
    "invoice_number": "INV-NEW",
    "status": "pending",
    "created_at": "2026-07-28T10:00:00Z"
  }
}
```

**Authorization**: Admin, Manager (own branch only)

**Backend**:
```typescript
export async function POST(request: NextRequest) {
  const { branchId, userRole, roleInBranch } = await getRequestContext(request);
  
  // Check permission
  if (!['admin', 'manager'].includes(roleInBranch)) {
    return NextResponse.json(
      { error: 'Role cannot create service orders' },
      { status: 403 }
    );
  }
  
  const body = await request.json();
  
  // Force branch_id from session (ignore if in body)
  const serviceOrder = {
    ...body,
    branch_id: branchId,  // ← ENFORCED
    created_by: userId,
  };
  
  const { data, error } = await db
    .from('service_orders')
    .insert([serviceOrder])
    .select()
    .single();
  
  if (error) throw new DatabaseError(error);
  
  // Fetch branch name for response
  const branch = await db.from('branches').select('name').eq('id', branchId).single();
  
  return NextResponse.json({
    success: true,
    data: { ...data, branch_name: branch.name },
  }, { status: 201 });
}
```

---

### 3.2 Transactions (Layanan) API

#### GET /api/layanan
**Get transactions for current branch**

```http
GET /api/layanan?date_from=2026-07-01&date_to=2026-07-31&payment_method=cash
Authorization: Bearer <jwt>
```

**Response**:
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "branch_id": "jember-uuid",
      "branch_name": "Cabang Jember",
      "customer_name": "John Doe",
      "nominal": 150000,
      "metode_pembayaran": "cash",
      "created_at": "2026-07-28T10:00:00Z"
    }
  ],
  "branch_id": "jember-uuid"
}
```

**Authorization**: Admin, Manager (own branch only)

---

#### POST /api/layanan
**Create transaction (automatically for current branch)**

```http
POST /api/layanan
Authorization: Bearer <jwt>
Content-Type: application/json

{
  "customer_name": "Jane Smith",
  "metode_pembayaran": "transfer",
  "jenis_layanan": "REPAIR",
  "nominal": 250000,
  "detail_sku": "...",
  "notes": "..."
}
```

**Note**: `branch_id` is automatically set from session.

**Response**: Transaction created with `branch_id` set.

**Authorization**: Admin (own branch only)

---

### 3.3 Inventory API

#### GET /api/inventory
**Get inventory for current branch only**

```http
GET /api/inventory?sku=BEARING-001
Authorization: Bearer <jwt>
```

**Backend**: Always filter by `branch_id`.

---

#### POST /api/inventory
**Create inventory item for current branch**

```http
POST /api/inventory
Authorization: Bearer <jwt>

{
  "sku": "BEARING-001",
  "name": "Bearing Swiss",
  "quantity": 10,
  "location": "store"
}
```

**Note**: `branch_id` automatically added from session.

---

## 4. New Endpoints: Branch Management

### 4.1 GET /api/branches
**Get branches accessible to user**

```http
GET /api/branches
Authorization: Bearer <jwt>
```

**Response (Owner)**:
```json
{
  "success": true,
  "data": [
    {
      "id": "jember-uuid",
      "name": "Cabang Jember",
      "code": "JMB001",
      "location": "Jember",
      "status": "active",
      "member_count": 12,
      "created_at": "2026-01-01T00:00:00Z"
    },
    {
      "id": "kudus-uuid",
      "name": "Cabang Kudus",
      "code": "KDS001",
      "location": "Kudus",
      "status": "active",
      "member_count": 8,
      "created_at": "2026-02-01T00:00:00Z"
    }
  ],
  "is_owner": true,
  "count": 2
}
```

**Response (Manager)**:
```json
{
  "success": true,
  "data": [
    {
      "id": "jember-uuid",
      "name": "Cabang Jember",
      "code": "JMB001",
      "location": "Jember",
      "status": "active",
      "member_count": 12,
      "created_at": "2026-01-01T00:00:00Z"
    }
  ],
  "is_owner": false,
  "count": 1
}
```

**Authorization**: All authenticated users (returns filtered list)

**Backend**:
```typescript
export async function GET(request: NextRequest) {
  const { userId, userRole } = await getRequestContext(request);
  
  if (userRole === 'owner') {
    // Owner sees all branches
    const branches = await db.from('branches').select('*').eq('status', 'active');
    return NextResponse.json({ data: branches, is_owner: true });
  }
  
  // Others see only assigned branches
  const assignments = await db
    .from('user_branch_assignments')
    .select('branch_id')
    .eq('user_id', userId)
    .eq('is_active', true);
  
  const branchIds = assignments.map(a => a.branch_id);
  
  const branches = await db
    .from('branches')
    .select('*')
    .in('id', branchIds)
    .eq('status', 'active');
  
  return NextResponse.json({ data: branches, is_owner: false });
}
```

---

### 4.2 POST /api/branches
**Create new branch (Owner only)**

```http
POST /api/branches
Authorization: Bearer <jwt>
Content-Type: application/json

{
  "name": "Cabang Surabaya",
  "code": "SBY001",
  "location": "Surabaya",
  "city": "Surabaya",
  "province": "Jawa Timur",
  "phone": "+62-31-xxxx-xxxx",
  "email": "surabaya@arlogic.com",
  "address": "Jl. Ahmad Yani No. 123"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "id": "surabaya-uuid",
    "name": "Cabang Surabaya",
    "code": "SBY001",
    "status": "active",
    "created_at": "2026-07-28T10:00:00Z",
    "created_by": "owner-uuid"
  }
}
```

**Authorization**: Owner only

**Backend**:
```typescript
export async function POST(request: NextRequest) {
  const { userRole } = await getRequestContext(request);
  
  if (userRole !== 'owner') {
    return NextResponse.json(
      { error: 'Only owner can create branches' },
      { status: 403 }
    );
  }
  
  const body = await request.json();
  
  const { data, error } = await db
    .from('branches')
    .insert([{ ...body, created_by: userId }])
    .select()
    .single();
  
  if (error) throw new DatabaseError(error);
  
  return NextResponse.json({ success: true, data }, { status: 201 });
}
```

---

### 4.3 GET /api/users
**Get users in current branch (Manager/Owner only)**

```http
GET /api/users
Authorization: Bearer <jwt>
```

**Response**:
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "email": "technician@arlogic.com",
      "full_name": "Rudi Hartono",
      "role_in_branch": "technician",
      "assigned_at": "2026-06-01T00:00:00Z",
      "is_active": true
    }
  ],
  "branch_id": "jember-uuid"
}
```

**Authorization**: Manager, Owner (branch-scoped)

---

### 4.4 POST /api/users
**Assign user to branch (Owner only)**

```http
POST /api/users
Authorization: Bearer <jwt>

{
  "email": "newuser@arlogic.com",
  "full_name": "Siti Nur Azizah",
  "gender": "female",
  "branch_id": "jember-uuid",
  "role": "admin"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "user_id": "new-uuid",
    "email": "newuser@arlogic.com",
    "branch_id": "jember-uuid",
    "role": "admin",
    "assigned_at": "2026-07-28T10:00:00Z"
  }
}
```

**Authorization**: Owner only

---

### 4.5 PUT /api/users/:userId/branch/:branchId
**Update user's role in branch**

```http
PUT /api/users/user-uuid/branch/branch-uuid
Authorization: Bearer <jwt>

{
  "role": "manager"
}
```

**Authorization**: Owner only

---

### 4.6 DELETE /api/users/:userId/branch/:branchId
**Remove user from branch**

```http
DELETE /api/users/user-uuid/branch/branch-uuid
Authorization: Bearer <jwt>
```

**Response**:
```json
{
  "success": true,
  "message": "User removed from branch"
}
```

**Authorization**: Owner only

**Backend**:
```typescript
export async function DELETE(
  request: NextRequest,
  { params }: { params: { userId: string; branchId: string } }
) {
  const { userRole } = await getRequestContext(request);
  
  if (userRole !== 'owner') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }
  
  // Delete assignment
  await db
    .from('user_branch_assignments')
    .delete()
    .eq('user_id', params.userId)
    .eq('branch_id', params.branchId);
  
  // If user has no more branches, set default_branch_id to NULL
  const remaining = await db
    .from('user_branch_assignments')
    .select('branch_id')
    .eq('user_id', params.userId);
  
  if (remaining.length === 0) {
    await db
      .from('profiles')
      .update({ default_branch_id: null })
      .eq('id', params.userId);
  }
  
  return NextResponse.json({ success: true });
}
```

---

### 4.7 POST /api/branch-switch
**Switch to different branch (update session)**

```http
POST /api/branch-switch
Authorization: Bearer <jwt>

{
  "branch_id": "kudus-uuid"
}
```

**Response**:
```json
{
  "success": true,
  "message": "Switched to Cabang Kudus",
  "branch_id": "kudus-uuid",
  "role_in_branch": "technician"
}
```

**Backend**:
```typescript
export async function POST(request: NextRequest) {
  const { userId } = await getRequestContext(request);
  const { branch_id } = await request.json();
  
  // Verify user is assigned to branch
  const assignment = await db
    .from('user_branch_assignments')
    .select('role')
    .eq('user_id', userId)
    .eq('branch_id', branch_id)
    .single();
  
  if (!assignment) {
    return NextResponse.json(
      { error: 'Not assigned to this branch' },
      { status: 403 }
    );
  }
  
  // Update session cookie
  const response = NextResponse.json({
    success: true,
    branch_id,
    role_in_branch: assignment.role,
  });
  
  response.cookies.set({
    name: 'x-branch-id',
    value: branch_id,
    secure: true,
    httpOnly: true,
    path: '/',
  });
  
  return response;
}
```

---

## 5. Error Handling

### 5.1 Error Response Format

```json
{
  "success": false,
  "error": {
    "code": "AUTHORIZATION_ERROR",
    "message": "User not assigned to this branch",
    "details": "User abc-123 not found in user_branch_assignments for branch xyz-789"
  },
  "status": 403,
  "timestamp": "2026-07-28T10:00:00Z",
  "request_id": "req-12345"
}
```

### 5.2 Common Error Codes

| Code | Status | Meaning | Solution |
|------|--------|---------|----------|
| `AUTHENTICATION_REQUIRED` | 401 | No JWT token | Login |
| `INVALID_TOKEN` | 401 | JWT expired/invalid | Refresh token |
| `AUTHORIZATION_ERROR` | 403 | User not assigned to branch | Request access |
| `FORBIDDEN` | 403 | Role cannot perform operation | Use different role |
| `BRANCH_NOT_FOUND` | 404 | Branch doesn't exist | Check branch_id |
| `RESOURCE_NOT_FOUND` | 404 | Resource not in branch | Wrong branch context |
| `VALIDATION_ERROR` | 400 | Invalid request data | Fix data |
| `DATABASE_ERROR` | 500 | Database error | Retry or contact support |

---

## 6. API Response Headers

All responses include:
```
X-Branch-ID: jember-uuid
X-User-ID: user-uuid
X-Request-ID: unique-request-id
Content-Type: application/json
```

---

## 7. Backward Compatibility

### 7.1 Existing Endpoints

All existing endpoints modified to add:
- `branch_id` in request context (extracted from session)
- `branch_id` in response (for audit)
- Branch validation on all operations

### 7.2 API Versioning

Current version: `v1` (multi-branch)

Future: If needed, add header `Accept: application/vnd.arlogic.v2+json`

### 7.3 Migration Path

1. **Phase 1** (Current): Single default branch, all data assigned to it
2. **Phase 2** (Future): Multiple branches, full branch isolation
3. **Phase 3** (Future): Cross-branch operations for Owner

