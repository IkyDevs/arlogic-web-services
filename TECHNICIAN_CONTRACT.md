# Technician Workflow API Contract

## Base URL

```
/api/technician/
```

## Authentication

All endpoints require `Authorization: Bearer <supabase_token>` header.

The token is obtained from Supabase authentication (signInWithPassword, etc.).

## Status Mapping

| Backend (snake_case) | Flutter (camelCase) | Label |
|---------------------|---------------------|-------|
| `pending` | `pending` | Menunggu |
| `assigned` | `assigned` | Ditugaskan |
| `in_progress` | `inProgress` | Dalam Pengerjaan |
| `req_sparepart_admin` | `reqSparepartAdmin` | Request PO |
| `po_pending` | `poPending` | PO Pending |
| `sparepart_ready` | `sparepartReady` | Sparepart Ready |
| `qc_pending` | `qcPending` | Quality Check |
| `revision_required` | `revisionRequired` | Perlu Revisi |
| `completed` | `completed` | Selesai QC |
| `done` | `done` | Sudah Diambil |
| `cancelled` | `cancelled` | Dibatalkan |

## Workflow State Machine

```
assigned → in_progress → qc_pending → completed → done
              ↓              ↑
         req_sparepart_admin → revision_required
              ↓                  ↑
          po_pending             │
              ↓                  │
       sparepart_ready ──────────┘

cancelled (terminal, from any active status)
```

## Error Response Format

All errors follow this structure:

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable message",
    "details": {}
  }
}
```

### Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `UNAUTHENTICATED` | 401 | User not logged in |
| `FORBIDDEN` | 403 | User doesn't have required role |
| `SERVICE_NOT_FOUND` | 404 | Service order doesn't exist |
| `ITEM_NOT_FOUND` | 404 | Service item doesn't exist |
| `NOT_ASSIGNED_TECHNICIAN` | 403 | User is not assigned to this service |
| `INVALID_STATUS_TRANSITION` | 409 | Cannot perform action in current status |
| `CONCURRENT_MODIFICATION` | 409 | State was modified by another request |
| `VALIDATION_ERROR` | 422 | Invalid request payload |
| `INTERNAL_ERROR` | 500 | Server error |

## Success Response Format

```json
{
  "success": true,
  "message": "Optional success message",
  "data": {}
}
```

---

## Endpoints

### 1. Start Service

**POST** `/api/technician/start-service`

Transition: `assigned → in_progress`

#### Request

```json
{
  "serviceOrderId": "uuid"
}
```

#### Authorization

- Authenticated
- Role: teknisi (or admin/supervisor/qc)
- `assigned_teknisi_id` must equal `user.id`
- Current status must be `assigned`

#### Success Response

```json
{
  "success": true,
  "message": "Service berhasil dimulai",
  "data": {
    "serviceOrderId": "uuid",
    "previousStatus": "assigned",
    "newStatus": "in_progress"
  }
}
```

#### Error Examples

```json
// Not assigned
{
  "success": false,
  "error": {
    "code": "NOT_ASSIGNED_TECHNICIAN",
    "message": "You are not assigned to this service",
    "details": { "assignedTo": "other-user-uuid" }
  }
}

// Invalid status
{
  "success": false,
  "error": {
    "code": "INVALID_STATUS_TRANSITION",
    "message": "Cannot start service from status 'in_progress'",
    "details": {
      "currentStatus": "in_progress",
      "expectedStatus": "assigned"
    }
  }
}
```

---

### 2. Add Item

**POST** `/api/technician/add-item`

Add a jasa or sparepart item to the service.

#### Request

```json
{
  "serviceOrderId": "uuid",
  "itemType": "jasa" | "sparepart",
  "name": "Service Jam",
  "quantity": 1,
  "price": 50000
}
```

#### Validation Rules

- `itemType`: Must be `jasa` or `sparepart`
- `name`: Non-empty string
- `quantity`: Positive integer (≥ 1)
- `price`: Non-negative number (≥ 0)

#### Authorization

- Authenticated
- Role: teknisi (or admin/supervisor/qc)
- `assigned_teknisi_id` must equal `user.id`
- Current status must be `in_progress` or `revision_required`

#### Success Response

```json
{
  "success": true,
  "message": "Item berhasil ditambahkan",
  "data": {
    "item": {
      "id": "uuid",
      "itemType": "jasa",
      "name": "Service Jam",
      "quantity": 1,
      "price": 50000
    }
  }
}
```

---

### 3. Update Item

**POST** `/api/technician/update-item`

Update an existing service item.

#### Request

```json
{
  "itemId": "uuid",
  "name": "Updated Name",
  "quantity": 2,
  "price": 75000
}
```

All fields except `itemId` are optional. At least one field must be provided.

#### Authorization

- Authenticated
- Role: teknisi (or admin/supervisor/qc)
- `assigned_teknisi_id` must equal `user.id`
- Current status must be `in_progress` or `revision_required`
- `is_final` must be `false`

#### Success Response

```json
{
  "success": true,
  "message": "Item berhasil diupdate"
}
```

---

### 4. Delete Item

**POST** `/api/technician/delete-item`

Delete a service item.

#### Request

```json
{
  "itemId": "uuid"
}
```

#### Authorization

- Authenticated
- Role: teknisi (or admin/supervisor/qc)
- `assigned_teknisi_id` must equal `user.id`
- Current status must be `in_progress` or `revision_required`
- `is_final` must be `false`

#### Success Response

```json
{
  "success": true,
  "message": "Item berhasil dihapus"
}
```

---

### 5. Request Sparepart

**POST** `/api/technician/request-sparepart`

Request sparepart from admin. Transitions: `in_progress → req_sparepart_admin`

#### Request

```json
{
  "serviceOrderId": "uuid",
  "sparepart": "Baterai CR2032",
  "notes": "Urgent, needed for repair"
}
```

#### Validation Rules

- `sparepart`: Non-empty string
- `notes`: Optional string

#### Authorization

- Authenticated
- Role: teknisi (or admin/supervisor/qc)
- `assigned_teknisi_id` must equal `user.id`
- Current status must be `in_progress`

#### Success Response

```json
{
  "success": true,
  "message": "Request sparepart berhasil dikirim",
  "data": {
    "serviceOrderId": "uuid",
    "previousStatus": "in_progress",
    "newStatus": "req_sparepart_admin"
  }
}
```

---

### 6. Submit for QC

**POST** `/api/technician/submit-qc`

Submit service for quality check. Transitions: `in_progress → qc_pending`

#### Request

```json
{
  "serviceOrderId": "uuid",
  "notes": "Service sudah selesai, mohon dicek"
}
```

#### Validation Rules

- `notes`: Optional string
- At least one service item must exist

#### Authorization

- Authenticated
- Role: teknisi (or admin/supervisor/qc)
- `assigned_teknisi_id` must equal `user.id`
- Current status must be `in_progress`

#### Success Response

```json
{
  "success": true,
  "message": "Service berhasil disubmit untuk QC",
  "data": {
    "serviceOrderId": "uuid",
    "previousStatus": "in_progress",
    "newStatus": "qc_pending"
  }
}
```

---

### 7. Retract from QC

**POST** `/api/technician/retract-qc`

Retract service from QC or after revision. Transitions: `qc_pending/revision_required → in_progress`

#### Request

```json
{
  "serviceOrderId": "uuid"
}
```

#### Authorization

- Authenticated
- Role: teknisi (or admin/supervisor/qc)
- `assigned_teknisi_id` must equal `user.id`
- Current status must be `qc_pending` or `revision_required`

#### Success Response

```json
{
  "success": true,
  "message": "Service berhasil ditarik kembali",
  "data": {
    "serviceOrderId": "uuid",
    "previousStatus": "qc_pending",
    "newStatus": "in_progress"
  }
}
```

---

## Implementation Notes

### Atomic Status Transitions

All status transitions use conditional UPDATE with WHERE clause:

```sql
UPDATE service_orders
SET status = 'new_status', updated_at = NOW()
WHERE id = $service_id
  AND status = 'expected_status'
  AND assigned_teknisi_id = $user_id;
```

If affected rows = 0, the API returns `INVALID_STATUS_TRANSITION` or `CONCURRENT_MODIFICATION`.

### Timeline Events

Every status transition creates a timeline entry in the same logical operation:

```json
{
  "service_order_id": "uuid",
  "teknisi_id": "user-uuid",
  "status": "status_value",
  "message": "Human readable message",
  "details": { "action": "action_name" }
}
```

### Authorization Flow

```
Request → Bearer Token
    ↓
Validate Token (Supabase)
    ↓
Fetch Profile (profiles table)
    ↓
Check Role (teknisi/admin/supervisor/qc)
    ↓
Fetch Service (service_orders table)
    ↓
Check assigned_teknisi_id = user.id
    ↓
Check Status = expected_status
    ↓
Execute Mutation
```

### Rate Limiting

All endpoints are rate-limited to 30 requests per minute per IP address.

---

## Flutter Integration Example

```dart
// Start service
final response = await dio.post(
  '/api/technician/start-service',
  data: {'serviceOrderId': serviceId},
);

if (response.data['success']) {
  final data = response.data['data'];
  // Update local state
  setState(() {
    service = service.copyWith(
      status: ServiceStatus.inProgress, // mapped from snake_case
    );
  });
} else {
  final error = response.data['error'];
  switch (error['code']) {
    case 'NOT_ASSIGNED_TECHNICIAN':
      // Show not assigned error
      break;
    case 'INVALID_STATUS_TRANSITION':
      // Refresh service data
      break;
  }
}
```

### Status Mapping in Flutter

```dart
extension ServiceStatusExtension on ServiceStatus {
  String toBackendString() {
    switch (this) {
      case ServiceStatus.pending:
        return 'pending';
      case ServiceStatus.assigned:
        return 'assigned';
      case ServiceStatus.inProgress:
        return 'in_progress';
      case ServiceStatus.reqSparepartAdmin:
        return 'req_sparepart_admin';
      case ServiceStatus.poPending:
        return 'po_pending';
      case ServiceStatus.sparepartReady:
        return 'sparepart_ready';
      case ServiceStatus.qcPending:
        return 'qc_pending';
      case ServiceStatus.revisionRequired:
        return 'revision_required';
      case ServiceStatus.completed:
        return 'completed';
      case ServiceStatus.done:
        return 'done';
      case ServiceStatus.cancelled:
        return 'cancelled';
    }
  }

  static ServiceStatus fromBackendString(String value) {
    switch (value) {
      case 'pending':
        return ServiceStatus.pending;
      case 'assigned':
        return ServiceStatus.assigned;
      case 'in_progress':
        return ServiceStatus.inProgress;
      case 'req_sparepart_admin':
        return ServiceStatus.reqSparepartAdmin;
      case 'po_pending':
        return ServiceStatus.poPending;
      case 'sparepart_ready':
        return ServiceStatus.sparepartReady;
      case 'qc_pending':
        return ServiceStatus.qcPending;
      case 'revision_required':
        return ServiceStatus.revisionRequired;
      case 'completed':
        return ServiceStatus.completed;
      case 'done':
        return ServiceStatus.done;
      case 'cancelled':
        return ServiceStatus.cancelled;
      default:
        throw ArgumentError('Unknown status: $value');
    }
  }
}
```
