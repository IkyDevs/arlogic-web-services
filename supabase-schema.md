# Supabase Schema Documentation

## Table: notifications

| Column | Type | Default | Description |
|--------|------|---------|-------------|
| id | uuid | gen_random_uuid() | Primary key |
| user_id | uuid | — | FK to profiles(id) ON DELETE CASCADE |
| title | text | — | Notification title |
| message | text | — | Notification message |
| type | text | 'info' | Category: transaction, service_new, qc_approved, etc. |
| link | text | — | Optional deep-link URL |
| data | jsonb | — | Optional metadata payload |
| is_read | boolean | false | Read status |
| created_at | timestamptz | now() | Creation timestamp |

### Indexes
- `idx_notifications_user` on `user_id`
- `idx_notifications_read` on `is_read`
- `idx_notifications_type` on `type`
- `idx_notifications_created` on `created_at DESC`

### Notes
- Must enable Realtime: `ALTER PUBLICATION supabase_realtime ADD TABLE notifications;`
- API: `GET /api/notifications`, `PUT /api/notifications`, `POST /api/notifications/trigger`

## Table: service_orders

| Column | Type | Default | Description |
|--------|------|---------|-------------|
| id | uuid | gen_random_uuid() | Primary key |
| invoice_number | text | — | Unique invoice number |
| token | text | — | Tracking token |
| token_expires_at | timestamptz | — | Token expiry |
| customer_name | text | — | Customer name |
| customer_phone | text | — | Customer phone |
| serial_number | text | — | Device serial |
| device_type | text | — | Device type |
| device_brand | text | — | Device brand |
| device_model | text | — | Device model |
| watch_brand | text | — | Watch brand |
| watch_model | text | — | Watch model |
| watch_year | integer | — | Watch year |
| watch_movement | text | — | Watch movement type |
| watch_condition | text | — | Watch condition |
| watch_accessories | jsonb | — | Watch accessories |
| category | text | — | Service category |
| issue_description | text | — | Issue description |
| request | text | — | Customer request |
| notes | text | — | Internal notes |
| down_payment | numeric | — | Down payment |
| status | text | 'pending' | Service status |
| po_status | text | — | PO status |
| po_sparepart | text | — | PO sparepart |
| po_requested_at | timestamptz | — | PO request time |
| po_admin_response | text | — | PO admin response |
| assigned_teknisi_id | uuid | — | Assigned teknisi |
| created_at | timestamptz | now() | Creation time |
| completed_at | timestamptz | — | Completion time |
| start_date | timestamptz | — | Work start date |
| done_date | timestamptz | — | Work done date |
| work_duration | text | — | Work duration |
| estimated_cost | numeric | — | Estimated cost |
| final_cost | numeric | — | Final cost |
| discount | integer | 0 | Discount amount (V26) |
| discount_percentage | numeric(5,2) | 0 | Discount % (V26) |
| completion_notes | text | — | Completion notes |
| qc_submit_notes | text | — | Teknisi notes on QC submit (V26) |
| warranty_months | integer | — | Warranty months |
| warranty_expiry | timestamptz | — | Warranty expiry |

## Table: service_items

| Column | Type | Default |
|--------|------|---------|
| id | uuid | gen_random_uuid() |
| service_order_id | uuid | — (FK) |
| item_type | text | — (jasa/sparepart) |
| name | text | — |
| quantity | integer | 1 |
| price | numeric | 0 |
| notes | text | — |
| created_at | timestamptz | now() |

## Table: service_timeline

| Column | Type | Default |
|--------|------|---------|
| id | uuid | gen_random_uuid() |
| service_order_id | uuid | — (FK) |
| teknisi_id | uuid | — (FK) |
| status | text | — |
| message | text | — |
| photo_url | text | — |
| details | jsonb | — |
| created_at | timestamptz | now() |

## Table: service_documentation

| Column | Type | Default |
|--------|------|---------|
| id | uuid | gen_random_uuid() |
| service_order_id | uuid | — (FK) |
| photo_url | text | — |
| stage | text | — (initial_condition/progress/qc) |
| uploaded_by | uuid | — (FK) |
| telegram_chat_id | text | — |
| telegram_message_id | integer | — |
| created_at | timestamptz | now() |

## Table: qc_reviews

| Column | Type | Default |
|--------|------|---------|
| id | uuid | gen_random_uuid() |
| service_order_id | uuid | — (FK) |
| reviewer_id | uuid | — (FK) |
| status | text | — (approved/rejected) |
| notes | text | — |
| created_at | timestamptz | now() |

## Table: layanan (Transactions)

| Column | Type | Default |
|--------|------|---------|
| id | uuid | gen_random_uuid() |
| customer_name | text | — |
| customer_whatsapp | text | — |
| metode_pembayaran | text | — |
| jenis_layanan | text | — |
| nominal | numeric | — |
| detail_sku | text | — |
| handled_by_name | text | — |
| photo_urls | text | — (JSON array) |
| status | text | 'active' |
| notes | text | — |
| created_at | timestamptz | now() |

## Indexes

| Table | Index | Column |
|-------|-------|--------|
| service_orders | idx_status | status |
| service_orders | idx_assigned_teknisi | assigned_teknisi_id |
| service_orders | idx_invoice | invoice_number |
| service_items | idx_service_order | service_order_id |
| service_timeline | idx_service_order | service_order_id |
| service_documentation | idx_service_order | service_order_id |
| layanan | idx_created_at | created_at |
