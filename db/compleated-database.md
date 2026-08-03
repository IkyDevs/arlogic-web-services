## Table `profiles`

### Columns

| Name                | Type          | Constraints |
| ------------------- | ------------- | ----------- |
| `id`                | `uuid`        | Primary     |
| `email`             | `text`        | Unique      |
| `full_name`         | `text`        |             |
| `role`              | `text`        |             |
| `teknisi_name`      | `text`        | Nullable    |
| `phone`             | `text`        | Nullable    |
| `gender`            | `text`        | Nullable    |
| `avatar_url`        | `text`        | Nullable    |
| `created_at`        | `timestamptz` | Nullable    |
| `updated_at`        | `timestamptz` | Nullable    |
| `branch_id`         | `uuid`        | Nullable    |
| `home_branch_id`    | `uuid`        | Nullable    |
| `is_stock_approver` | `bool`        | Nullable    |
| `is_engineer`       | `bool`        | Nullable    |

## Table `service_orders`

### Columns

| Name                       | Type          | Constraints |
| -------------------------- | ------------- | ----------- |
| `id`                       | `uuid`        | Primary     |
| `invoice_number`           | `text`        | Unique      |
| `token`                    | `text`        |             |
| `token_expires_at`         | `timestamptz` | Nullable    |
| `customer_name`            | `text`        |             |
| `customer_phone`           | `text`        |             |
| `serial_number`            | `text`        | Nullable    |
| `device_type`              | `text`        | Nullable    |
| `device_brand`             | `text`        | Nullable    |
| `device_model`             | `text`        | Nullable    |
| `watch_brand`              | `text`        | Nullable    |
| `watch_model`              | `text`        | Nullable    |
| `watch_year`               | `int4`        | Nullable    |
| `watch_condition`          | `text`        | Nullable    |
| `watch_accessories`        | `_text`       | Nullable    |
| `watch_serial_number`      | `text`        | Nullable    |
| `category`                 | `text`        | Nullable    |
| `down_payment`             | `numeric`     | Nullable    |
| `payment_method`           | `text`        | Nullable    |
| `payment_proof_url`        | `text`        | Nullable    |
| `issue_description`        | `text`        |             |
| `request`                  | `text`        | Nullable    |
| `notes`                    | `text`        | Nullable    |
| `status`                   | `text`        | Nullable    |
| `assigned_teknisi_id`      | `uuid`        | Nullable    |
| `po_status`                | `text`        | Nullable    |
| `po_sparepart`             | `text`        | Nullable    |
| `po_requested_at`          | `timestamptz` | Nullable    |
| `po_admin_response`        | `text`        | Nullable    |
| `created_at`               | `timestamptz` | Nullable    |
| `completed_at`             | `timestamptz` | Nullable    |
| `start_date`               | `timestamptz` | Nullable    |
| `done_date`                | `timestamptz` | Nullable    |
| `work_duration`            | `text`        | Nullable    |
| `estimated_cost`           | `numeric`     | Nullable    |
| `final_cost`               | `numeric`     | Nullable    |
| `completion_notes`         | `text`        | Nullable    |
| `warranty_months`          | `int4`        | Nullable    |
| `warranty_expiry`          | `timestamptz` | Nullable    |
| `watch_movement`           | `text`        | Nullable    |
| `condition_checklist`      | `jsonb`       | Nullable    |
| `picked_up_at`             | `timestamptz` | Nullable    |
| `picked_up_by`             | `uuid`        | Nullable    |
| `discount`                 | `int4`        | Nullable    |
| `discount_percentage`      | `numeric`     | Nullable    |
| `qc_submit_notes`          | `text`        | Nullable    |
| `teknisi_pending_reason`   | `text`        | Nullable    |
| `pending_teknisi_approved` | `bool`        | Nullable    |
| `approved_items_snapshot`  | `jsonb`       | Nullable    |
| `items_approved_at`        | `timestamptz` | Nullable    |
| `items_approved_by`        | `uuid`        | Nullable    |
| `qc_recalled`              | `bool`        | Nullable    |
| `qc_recalled_at`           | `timestamptz` | Nullable    |
| `qc_recall_reason`         | `text`        | Nullable    |
| `teknisi_can_recall`       | `bool`        | Nullable    |
| `final_sparepart_total`    | `numeric`     | Nullable    |
| `final_jasa_total`         | `numeric`     | Nullable    |
| `upload_status`            | `text`        | Nullable    |
| `branch_id`                | `uuid`        | Nullable    |

## Table `service_items`

### Columns

| Name               | Type          | Constraints |
| ------------------ | ------------- | ----------- |
| `id`               | `uuid`        | Primary     |
| `service_order_id` | `uuid`        | Nullable    |
| `item_type`        | `text`        | Nullable    |
| `name`             | `text`        |             |
| `quantity`         | `int4`        | Nullable    |
| `price`            | `numeric`     |             |
| `created_at`       | `timestamptz` | Nullable    |
| `is_final`         | `bool`        | Nullable    |
| `branch_id`        | `uuid`        | Nullable    |
| `inventory_id`     | `uuid`        | Nullable    |

## Table `service_documentation`

### Columns

| Name                  | Type          | Constraints |
| --------------------- | ------------- | ----------- |
| `id`                  | `uuid`        | Primary     |
| `service_order_id`    | `uuid`        | Nullable    |
| `photo_url`           | `text`        |             |
| `stage`               | `text`        |             |
| `uploaded_by`         | `uuid`        | Nullable    |
| `created_at`          | `timestamptz` | Nullable    |
| `telegram_chat_id`    | `text`        | Nullable    |
| `telegram_message_id` | `int8`        | Nullable    |
| `branch_id`           | `uuid`        | Nullable    |

## Table `service_timeline`

### Columns

| Name               | Type          | Constraints |
| ------------------ | ------------- | ----------- |
| `id`               | `uuid`        | Primary     |
| `service_order_id` | `uuid`        | Nullable    |
| `teknisi_id`       | `uuid`        | Nullable    |
| `status`           | `text`        |             |
| `message`          | `text`        |             |
| `photo_url`        | `text`        | Nullable    |
| `details`          | `jsonb`       | Nullable    |
| `created_at`       | `timestamptz` | Nullable    |
| `branch_id`        | `uuid`        | Nullable    |

## Table `attendances`

### Columns

| Name                  | Type          | Constraints |
| --------------------- | ------------- | ----------- |
| `id`                  | `uuid`        | Primary     |
| `teknisi_id`          | `uuid`        | Nullable    |
| `photo_url`           | `text`        |             |
| `location`            | `text`        | Nullable    |
| `check_in`            | `timestamptz` | Nullable    |
| `check_out`           | `timestamptz` | Nullable    |
| `status`              | `text`        | Nullable    |
| `work_duration`       | `text`        | Nullable    |
| `total_minutes`       | `int4`        | Nullable    |
| `created_at`          | `timestamptz` | Nullable    |
| `overtime_minutes`    | `int4`        | Nullable    |
| `is_overtime`         | `bool`        | Nullable    |
| `notes`               | `text`        | Nullable    |
| `telegram_chat_id`    | `text`        | Nullable    |
| `telegram_message_id` | `int8`        | Nullable    |
| `telegram_file_id`    | `text`        | Nullable    |
| `branch_id`           | `uuid`        | Nullable    |

## Table `inventory`

### Columns

| Name                | Type          | Constraints |
| ------------------- | ------------- | ----------- |
| `id`                | `uuid`        | Primary     |
| `item_name`         | `text`        |             |
| `sku`               | `text`        | Unique      |
| `store_stock`       | `int4`        | Nullable    |
| `warehouse_stock`   | `int4`        | Nullable    |
| `unit`              | `text`        |             |
| `min_stock`         | `int4`        | Nullable    |
| `category`          | `text`        | Nullable    |
| `price`             | `numeric`     | Nullable    |
| `photo_url`         | `text`        | Nullable    |
| `compatible_brands` | `_text`       | Nullable    |
| `compatible_models` | `_text`       | Nullable    |
| `created_at`        | `timestamptz` | Nullable    |
| `updated_at`        | `timestamptz` | Nullable    |
| `branch_id`         | `uuid`        | Nullable    |
| `buy_price`         | `numeric`     | Nullable    |

## Table `categories`

### Columns

| Name          | Type          | Constraints |
| ------------- | ------------- | ----------- |
| `id`          | `uuid`        | Primary     |
| `name`        | `text`        | Unique      |
| `description` | `text`        | Nullable    |
| `created_at`  | `timestamptz` | Nullable    |

## Table `qc_reviews`

### Columns

| Name               | Type          | Constraints |
| ------------------ | ------------- | ----------- |
| `id`               | `uuid`        | Primary     |
| `service_order_id` | `uuid`        | Nullable    |
| `reviewer_id`      | `uuid`        | Nullable    |
| `status`           | `text`        | Nullable    |
| `notes`            | `text`        | Nullable    |
| `created_at`       | `timestamptz` | Nullable    |

## Table `activity_logs`

### Columns

| Name         | Type          | Constraints |
| ------------ | ------------- | ----------- |
| `id`         | `uuid`        | Primary     |
| `user_id`    | `uuid`        | Nullable    |
| `action`     | `text`        |             |
| `details`    | `jsonb`       | Nullable    |
| `created_at` | `timestamptz` | Nullable    |
| `branch_id`  | `uuid`        | Nullable    |

## Table `contact_logs`

### Columns

| Name               | Type          | Constraints |
| ------------------ | ------------- | ----------- |
| `id`               | `uuid`        | Primary     |
| `service_order_id` | `uuid`        | Nullable    |
| `teknisi_id`       | `uuid`        | Nullable    |
| `contact_method`   | `text`        | Nullable    |
| `message`          | `text`        | Nullable    |
| `notes`            | `text`        | Nullable    |
| `created_at`       | `timestamptz` | Nullable    |

## Table `watch_database`

### Columns

| Name               | Type          | Constraints |
| ------------------ | ------------- | ----------- |
| `id`               | `uuid`        | Primary     |
| `brand`            | `text`        |             |
| `model`            | `text`        |             |
| `watch_type`       | `text`        | Nullable    |
| `year_from`        | `int4`        | Nullable    |
| `year_to`          | `int4`        | Nullable    |
| `reference_number` | `text`        | Nullable    |
| `image_url`        | `text`        | Nullable    |
| `created_at`       | `timestamptz` | Nullable    |

## Table `warranties`

### Columns

| Name               | Type          | Constraints |
| ------------------ | ------------- | ----------- |
| `id`               | `uuid`        | Primary     |
| `service_order_id` | `uuid`        | Nullable    |
| `warranty_number`  | `text`        | Unique      |
| `issued_at`        | `timestamptz` | Nullable    |
| `expiry_date`      | `timestamptz` |             |
| `terms`            | `text`        | Nullable    |
| `created_at`       | `timestamptz` | Nullable    |

## Table `feedbacks`

### Columns

| Name               | Type          | Constraints     |
| ------------------ | ------------- | --------------- |
| `id`               | `uuid`        | Primary         |
| `service_order_id` | `uuid`        | Nullable Unique |
| `customer_name`    | `text`        |                 |
| `rating`           | `int4`        |                 |
| `comment`          | `text`        | Nullable        |
| `teknisi_id`       | `uuid`        | Nullable        |
| `created_at`       | `timestamptz` | Nullable        |
| `branch_id`        | `uuid`        | Nullable        |

## Table `notifications`

### Columns

| Name         | Type          | Constraints |
| ------------ | ------------- | ----------- |
| `id`         | `uuid`        | Primary     |
| `user_id`    | `uuid`        | Nullable    |
| `title`      | `text`        |             |
| `message`    | `text`        |             |
| `type`       | `text`        | Nullable    |
| `link`       | `text`        | Nullable    |
| `data`       | `jsonb`       | Nullable    |
| `is_read`    | `bool`        | Nullable    |
| `created_at` | `timestamptz` | Nullable    |
| `branch_id`  | `uuid`        | Nullable    |

## Table `layanan`

### Columns

| Name                      | Type          | Constraints |
| ------------------------- | ------------- | ----------- |
| `id`                      | `uuid`        | Primary     |
| `created_at`              | `timestamptz` | Nullable    |
| `updated_at`              | `timestamptz` | Nullable    |
| `customer_name`           | `text`        |             |
| `customer_whatsapp`       | `text`        | Nullable    |
| `handled_by`              | `uuid`        | Nullable    |
| `payment_method`          | `text`        | Nullable    |
| `lead_source`             | `text`        | Nullable    |
| `lead_source_custom`      | `text`        | Nullable    |
| `sku_details`             | `text`        | Nullable    |
| `nominal_pembayaran`      | `numeric`     | Nullable    |
| `created_by`              | `uuid`        | Nullable    |
| `created_by_name`         | `text`        | Nullable    |
| `handled_by_name`         | `text`        | Nullable    |
| `status`                  | `text`        | Nullable    |
| `jenis_layanan`           | `text`        |             |
| `metode_pembayaran`       | `text`        | Nullable    |
| `detail_sku`              | `text`        | Nullable    |
| `nominal`                 | `numeric`     | Nullable    |
| `notes`                   | `text`        | Nullable    |
| `photo_url`               | `text`        | Nullable    |
| `photo_urls`              | `_text`       |             |
| `telegram_chat_id`        | `text`        | Nullable    |
| `telegram_message_id`     | `int8`        | Nullable    |
| `linked_service_order_id` | `uuid`        | Nullable    |
| `split_payment`           | `bool`        | Nullable    |
| `metode_pembayaran_1`     | `text`        | Nullable    |
| `nominal_1`               | `numeric`     | Nullable    |
| `metode_pembayaran_2`     | `text`        | Nullable    |
| `nominal_2`               | `numeric`     | Nullable    |
| `dp_applied`              | `bool`        | Nullable    |
| `upload_status`           | `text`        |             |
| `upload_retry_count`      | `int4`        | Nullable    |
| `upload_error`            | `text`        | Nullable    |
| `telegram_file_id`        | `text`        | Nullable    |
| `upload_session_key`      | `text`        | Nullable    |
| `branch_id`               | `uuid`        | Nullable    |

## Table `service_jasa`

### Columns

| Name            | Type          | Constraints |
| --------------- | ------------- | ----------- |
| `id`            | `uuid`        | Primary     |
| `name`          | `text`        | Unique      |
| `default_price` | `numeric`     | Nullable    |
| `description`   | `text`        | Nullable    |
| `created_at`    | `timestamptz` | Nullable    |

## Table `sparepart_requests`

### Columns

| Name               | Type          | Constraints |
| ------------------ | ------------- | ----------- |
| `id`               | `uuid`        | Primary     |
| `service_order_id` | `uuid`        | Nullable    |
| `teknisi_id`       | `uuid`        | Nullable    |
| `sparepart_name`   | `text`        |             |
| `sparepart_sku`    | `text`        | Nullable    |
| `quantity`         | `int4`        | Nullable    |
| `source_type`      | `text`        | Nullable    |
| `status`           | `text`        | Nullable    |
| `admin_response`   | `text`        | Nullable    |
| `responded_at`     | `timestamptz` | Nullable    |
| `created_at`       | `timestamptz` | Nullable    |
| `inventory_id`     | `uuid`        | Nullable    |
| `branch_id`        | `uuid`        | Nullable    |

## Table `sparepart_conversations`

### Columns

| Name                   | Type          | Constraints |
| ---------------------- | ------------- | ----------- |
| `id`                   | `uuid`        | Primary     |
| `sparepart_request_id` | `uuid`        | Nullable    |
| `sender_id`            | `uuid`        | Nullable    |
| `sender_name`          | `text`        | Nullable    |
| `sender_role`          | `text`        | Nullable    |
| `message`              | `text`        |             |
| `is_read`              | `bool`        | Nullable    |
| `created_at`           | `timestamptz` | Nullable    |
| `branch_id`            | `uuid`        | Nullable    |

## Table `stock_transfers`

### Columns

| Name            | Type          | Constraints |
| --------------- | ------------- | ----------- |
| `id`            | `uuid`        | Primary     |
| `inventory_id`  | `uuid`        | Nullable    |
| `from_location` | `text`        |             |
| `to_location`   | `text`        |             |
| `quantity`      | `int4`        |             |
| `notes`         | `text`        | Nullable    |
| `photo_url`     | `text`        | Nullable    |
| `created_by`    | `uuid`        | Nullable    |
| `created_at`    | `timestamptz` | Nullable    |
| `branch_id`     | `uuid`        | Nullable    |
| `status`        | `text`        | Nullable    |
| `confirmed_by`  | `uuid`        | Nullable    |
| `confirmed_at`  | `timestamptz` | Nullable    |

## Table `closings`

### Columns

| Name                  | Type          | Constraints |
| --------------------- | ------------- | ----------- |
| `id`                  | `uuid`        | Primary     |
| `closing_date`        | `date`        |             |
| `total_transactions`  | `int4`        |             |
| `total_expected`      | `int8`        |             |
| `total_actual`        | `int8`        |             |
| `difference`          | `int8`        |             |
| `detail`              | `jsonb`       | Nullable    |
| `notes`               | `text`        | Nullable    |
| `status`              | `text`        |             |
| `admin_notes`         | `text`        | Nullable    |
| `rejection_reason`    | `text`        | Nullable    |
| `created_by`          | `uuid`        | Nullable    |
| `created_at`          | `timestamptz` | Nullable    |
| `updated_at`          | `timestamptz` | Nullable    |
| `difference_notes`    | `text`        | Nullable    |
| `telegram_chat_id`    | `text`        | Nullable    |
| `telegram_message_id` | `int8`        | Nullable    |
| `branch_id`           | `uuid`        | Nullable    |

## Table `customers`

### Columns

| Name               | Type          | Constraints |
| ------------------ | ------------- | ----------- |
| `id`               | `uuid`        | Primary     |
| `name`             | `text`        |             |
| `phone`            | `text`        |             |
| `last_transaction` | `timestamptz` | Nullable    |
| `created_at`       | `timestamptz` | Nullable    |
| `point`            | `int4`        | Nullable    |
| `profesi`          | `text`        | Nullable    |
| `email`            | `text`        | Nullable    |
| `alamat`           | `text`        | Nullable    |
| `branch_id`        | `uuid`        | Nullable    |

## Table `tracking_logs`

### Columns

| Name               | Type          | Constraints |
| ------------------ | ------------- | ----------- |
| `id`               | `uuid`        | Primary     |
| `service_order_id` | `uuid`        | Nullable    |
| `token`            | `text`        |             |
| `visited_at`       | `timestamptz` | Nullable    |

## Table `expenses`

### Columns

| Name              | Type          | Constraints |
| ----------------- | ------------- | ----------- |
| `id`              | `uuid`        | Primary     |
| `created_at`      | `timestamptz` | Nullable    |
| `updated_at`      | `timestamptz` | Nullable    |
| `item_name`       | `text`        |             |
| `amount`          | `numeric`     |             |
| `payment_method`  | `text`        |             |
| `handled_by`      | `uuid`        | Nullable    |
| `handled_by_name` | `text`        | Nullable    |
| `notes`           | `text`        | Nullable    |
| `photo_url`       | `text`        | Nullable    |
| `photo_urls`      | `_text`       | Nullable    |
| `created_by`      | `uuid`        | Nullable    |
| `created_by_name` | `text`        | Nullable    |
| `branch_id`       | `uuid`        | Nullable    |

## Table `layanan_items`

### Columns

| Name            | Type          | Constraints |
| --------------- | ------------- | ----------- |
| `id`            | `uuid`        | Primary     |
| `layanan_id`    | `uuid`        | Nullable    |
| `jenis_layanan` | `text`        |             |
| `detail_sku`    | `text`        | Nullable    |
| `notes`         | `text`        | Nullable    |
| `nominal`       | `numeric`     | Nullable    |
| `created_at`    | `timestamptz` | Nullable    |
| `branch_id`     | `uuid`        | Nullable    |

## Table `photos`

### Columns

| Name                       | Type          | Constraints |
| -------------------------- | ------------- | ----------- |
| `id`                       | `uuid`        | Primary     |
| `file_id`                  | `text`        |             |
| `file_unique_id`           | `text`        |             |
| `file_size`                | `int4`        | Nullable    |
| `photo_data`               | `text`        | Nullable    |
| `filename`                 | `text`        |             |
| `mime_type`                | `text`        |             |
| `service_order_id`         | `uuid`        | Nullable    |
| `service_documentation_id` | `uuid`        | Nullable    |
| `stage`                    | `text`        | Nullable    |
| `uploaded_by`              | `uuid`        | Nullable    |
| `created_at`               | `timestamptz` | Nullable    |
| `refreshed_at`             | `timestamptz` | Nullable    |
| `refresh_count`            | `int4`        | Nullable    |
| `last_verified_at`         | `timestamptz` | Nullable    |
| `layanan_id`               | `uuid`        | Nullable    |
| `transaction_id`           | `uuid`        | Nullable    |
| `upload_status`            | `text`        |             |
| `retry_count`              | `int4`        | Nullable    |
| `upload_error`             | `text`        | Nullable    |
| `queue_job_id`             | `text`        | Nullable    |
| `uploaded_at`              | `timestamptz` | Nullable    |

## Table `whatsapp_templates`

### Columns

| Name               | Type          | Constraints |
| ------------------ | ------------- | ----------- |
| `id`               | `uuid`        | Primary     |
| `template_name`    | `text`        | Unique      |
| `template_content` | `text`        |             |
| `placeholders`     | `jsonb`       | Nullable    |
| `created_at`       | `timestamptz` | Nullable    |
| `updated_at`       | `timestamptz` | Nullable    |

## Table `upload_sessions`

### Columns

| Name                   | Type                | Constraints     |
| ---------------------- | ------------------- | --------------- |
| `id`                   | `uuid`              | Primary         |
| `upload_session_code`  | `text`              | Nullable Unique |
| `idempotency_key`      | `text`              | Nullable Unique |
| `user_id`              | `uuid`              | Nullable        |
| `client_id`            | `uuid`              | Nullable        |
| `device_id`            | `text`              | Nullable        |
| `ip_address`           | `inet`              | Nullable        |
| `user_agent`           | `text`              | Nullable        |
| `metadata`             | `jsonb`             | Nullable        |
| `processing_status`    | `processing_status` | Nullable        |
| `type`                 | `varchar`           | Nullable        |
| `total_files`          | `int4`              | Nullable        |
| `completed_files`      | `int4`              | Nullable        |
| `failed_files`         | `int4`              | Nullable        |
| `total_original_size`  | `int8`              | Nullable        |
| `total_processed_size` | `int8`              | Nullable        |
| `compression_ratio`    | `numeric`           | Nullable        |
| `last_error_code`      | `text`              | Nullable        |
| `last_error_message`   | `text`              | Nullable        |
| `version`              | `int4`              | Nullable        |
| `created_at`           | `timestamptz`       | Nullable        |
| `updated_at`           | `timestamptz`       | Nullable        |
| `completed_at`         | `timestamptz`       | Nullable        |
| `expired_at`           | `timestamptz`       | Nullable        |
| `deleted_at`           | `timestamptz`       | Nullable        |

## Table `upload_drafts`

### Columns

| Name                    | Type                | Constraints |
| ----------------------- | ------------------- | ----------- |
| `id`                    | `uuid`              | Primary     |
| `session_id`            | `uuid`              | Nullable    |
| `user_id`               | `uuid`              | Nullable    |
| `entity_type`           | `media_entity`      | Nullable    |
| `entity_id`             | `uuid`              | Nullable    |
| `field_name`            | `media_field`       | Nullable    |
| `storage_provider`      | `varchar`           | Nullable    |
| `storage_bucket`        | `varchar`           | Nullable    |
| `storage_path`          | `text`              | Nullable    |
| `telegram_chat_id`      | `text`              | Nullable    |
| `telegram_file_id`      | `text`              | Nullable    |
| `telegram_message_id`   | `int8`              | Nullable    |
| `telegram_caption_hash` | `text`              | Nullable    |
| `telegram_uploaded_at`  | `timestamptz`       | Nullable    |
| `telegram_status`       | `telegram_status`   | Nullable    |
| `media_type`            | `media_type`        | Nullable    |
| `checksum_sha256`       | `varchar`           | Nullable    |
| `original_filename`     | `text`              | Nullable    |
| `extension`             | `text`              | Nullable    |
| `mime`                  | `text`              | Nullable    |
| `width`                 | `int4`              | Nullable    |
| `height`                | `int4`              | Nullable    |
| `duration`              | `int4`              | Nullable    |
| `size_original`         | `int8`              | Nullable    |
| `size_processed`        | `int8`              | Nullable    |
| `compression_quality`   | `int4`              | Nullable    |
| `compression_ratio`     | `numeric`           | Nullable    |
| `orientation`           | `int4`              | Nullable    |
| `converted_format`      | `text`              | Nullable    |
| `processing_status`     | `processing_status` | Nullable    |
| `lifecycle_status`      | `lifecycle_status`  | Nullable    |
| `version`               | `int4`              | Nullable    |
| `retry_count`           | `int4`              | Nullable    |
| `last_retry_at`         | `timestamptz`       | Nullable    |
| `next_retry_at`         | `timestamptz`       | Nullable    |
| `last_error`            | `text`              | Nullable    |
| `queued_at`             | `timestamptz`       | Nullable    |
| `processing_at`         | `timestamptz`       | Nullable    |
| `completed_at`          | `timestamptz`       | Nullable    |
| `created_at`            | `timestamptz`       | Nullable    |
| `updated_at`            | `timestamptz`       | Nullable    |
| `expired_at`            | `timestamptz`       | Nullable    |
| `used_at`               | `timestamptz`       | Nullable    |
| `deleted_at`            | `timestamptz`       | Nullable    |

## Table `media_files`

### Columns

| Name                  | Type           | Constraints |
| --------------------- | -------------- | ----------- |
| `id`                  | `uuid`         | Primary     |
| `draft_id`            | `uuid`         | Nullable    |
| `user_id`             | `uuid`         | Nullable    |
| `entity_type`         | `media_entity` | Nullable    |
| `entity_id`           | `uuid`         | Nullable    |
| `field_name`          | `media_field`  | Nullable    |
| `storage_provider`    | `varchar`      | Nullable    |
| `storage_bucket`      | `varchar`      | Nullable    |
| `storage_path`        | `text`         | Nullable    |
| `telegram_file_id`    | `text`         | Nullable    |
| `telegram_message_id` | `int8`         | Nullable    |
| `media_type`          | `media_type`   | Nullable    |
| `checksum_sha256`     | `varchar`      | Nullable    |
| `mime`                | `text`         | Nullable    |
| `size`                | `int8`         | Nullable    |
| `version`             | `int4`         | Nullable    |
| `metadata`            | `jsonb`        | Nullable    |
| `created_at`          | `timestamptz`  | Nullable    |
| `updated_at`          | `timestamptz`  | Nullable    |
| `deleted_at`          | `timestamptz`  | Nullable    |

## Table `media_events`

### Columns

| Name         | Type               | Constraints |
| ------------ | ------------------ | ----------- |
| `id`         | `uuid`             | Primary     |
| `draft_id`   | `uuid`             | Nullable    |
| `session_id` | `uuid`             | Nullable    |
| `event`      | `media_event_type` |             |
| `payload`    | `jsonb`            | Nullable    |
| `actor_id`   | `uuid`             | Nullable    |
| `actor_type` | `text`             | Nullable    |
| `source`     | `text`             | Nullable    |
| `created_at` | `timestamptz`      | Nullable    |

## Table `qc_recalls`

### Columns

| Name               | Type          | Constraints |
| ------------------ | ------------- | ----------- |
| `id`               | `uuid`        | Primary     |
| `service_order_id` | `uuid`        | Nullable    |
| `qc_id`            | `uuid`        | Nullable    |
| `reason`           | `text`        |             |
| `created_at`       | `timestamptz` | Nullable    |

## Table `upload_logs`

### Columns

| Name             | Type          | Constraints |
| ---------------- | ------------- | ----------- |
| `id`             | `uuid`        | Primary     |
| `photo_id`       | `uuid`        | Nullable    |
| `transaction_id` | `uuid`        | Nullable    |
| `event`          | `text`        |             |
| `message`        | `text`        | Nullable    |
| `retry_count`    | `int4`        | Nullable    |
| `error`          | `text`        | Nullable    |
| `created_at`     | `timestamptz` | Nullable    |

## Table `branches`

### Columns

| Name         | Type          | Constraints |
| ------------ | ------------- | ----------- |
| `id`         | `uuid`        | Primary     |
| `name`       | `text`        |             |
| `code`       | `text`        | Unique      |
| `address`    | `text`        | Nullable    |
| `phone`      | `text`        | Nullable    |
| `email`      | `text`        | Nullable    |
| `logo_url`   | `text`        | Nullable    |
| `is_active`  | `bool`        | Nullable    |
| `created_at` | `timestamptz` | Nullable    |
| `is_central` | `bool`        | Nullable    |

## Table `inventory_stocks`

### Columns

| Name            | Type          | Constraints |
| --------------- | ------------- | ----------- |
| `id`            | `uuid`        | Primary     |
| `inventory_id`  | `uuid`        | Nullable    |
| `location_type` | `text`        |             |
| `branch_id`     | `uuid`        | Nullable    |
| `quantity`      | `int4`        | Nullable    |
| `created_at`    | `timestamptz` | Nullable    |
| `updated_at`    | `timestamptz` | Nullable    |

## Table `reports`

### Columns

| Name             | Type          | Constraints |
| ---------------- | ------------- | ----------- |
| `id`             | `uuid`        | Primary     |
| `report_type`    | `text`        |             |
| `title`          | `text`        |             |
| `description`    | `text`        |             |
| `module`         | `text`        | Nullable    |
| `priority`       | `text`        | Nullable    |
| `attachment_url` | `text`        | Nullable    |
| `branch_id`      | `uuid`        | Nullable    |
| `created_by`     | `uuid`        | Nullable    |
| `status`         | `text`        | Nullable    |
| `status_notes`   | `text`        | Nullable    |
| `created_at`     | `timestamptz` | Nullable    |
| `updated_at`     | `timestamptz` | Nullable    |

## Table `announcements`

### Columns

| Name               | Type          | Constraints |
| ------------------ | ------------- | ----------- |
| `id`               | `uuid`        | Primary     |
| `title`            | `text`        |             |
| `message`          | `text`        |             |
| `target_branch_id` | `uuid`        | Nullable    |
| `created_by`       | `uuid`        | Nullable    |
| `created_at`       | `timestamptz` | Nullable    |

## Table `branch_assignments`

### Columns

| Name         | Type          | Constraints |
| ------------ | ------------- | ----------- |
| `id`         | `uuid`        | Primary     |
| `profile_id` | `uuid`        | Nullable    |
| `branch_id`  | `uuid`        | Nullable    |
| `start_date` | `timestamptz` | Nullable    |
| `end_date`   | `timestamptz` | Nullable    |
| `reason`     | `text`        | Nullable    |
| `created_by` | `uuid`        | Nullable    |
| `created_at` | `timestamptz` | Nullable    |

## Table `stock_gudang`

### Columns

| Name           | Type          | Constraints     |
| -------------- | ------------- | --------------- |
| `id`           | `uuid`        | Primary         |
| `inventory_id` | `uuid`        | Nullable Unique |
| `quantity`     | `int4`        | Nullable        |
| `updated_at`   | `timestamptz` | Nullable        |

## Table `stock_toko`

### Columns

| Name           | Type          | Constraints |
| -------------- | ------------- | ----------- |
| `id`           | `uuid`        | Primary     |
| `inventory_id` | `uuid`        | Nullable    |
| `branch_id`    | `uuid`        | Nullable    |
| `quantity`     | `int4`        | Nullable    |
| `updated_at`   | `timestamptz` | Nullable    |

## Custom Types / Enums

### `media_type`

`IMAGE` | `VIDEO` | `PDF` | `DOCUMENT` | `AUDIO` | `OTHER`

### `processing_status`

`IDLE` | `VALIDATING` | `PROCESSING` | `READY` | `UPLOADING` | `SUCCESS` | `FAILED`

### `telegram_status`

`PENDING` | `UPLOADING` | `SUCCESS` | `FAILED`

### `lifecycle_status`

`DRAFT` | `ATTACHED` | `FINALIZED` | `EXPIRED` | `DELETED`

### `media_entity`

`SERVICE` | `QC` | `ATTENDANCE` | `INVENTORY` | `KASPIN` | `USER_AVATAR` | `SYSTEM_ASSET`

### `media_field`

`BEFORE_PHOTO` | `AFTER_PHOTO` | `QC_PHOTO` | `ATTENDANCE_PHOTO` | `RECEIPT` | `AVATAR` | `DOCUMENT`

### `media_event_type`

`VALIDATED` | `COMPRESSED` | `UPLOADED` | `READY` | `ATTACHED` | `FINALIZED` | `TELEGRAM_SENT` | `FAILED` | `RETRY`

## RLS Policies

### `tracking_logs`

| Policy                                       | Command | Roles  | Action     | USING                      | WITH CHECK                 |
| -------------------------------------------- | ------- | ------ | ---------- | -------------------------- | -------------------------- |
| `Anyone can insert tracking_logs`            | INSERT  | public | PERMISSIVE | —                          | `true`                     |
| `Authenticated users can read tracking_logs` | SELECT  | public | PERMISSIVE | `(auth.uid() IS NOT NULL)` | —                          |
| `anon_insert`                                | INSERT  | public | PERMISSIVE | —                          | `true`                     |
| `auth_all_tracking`                          | ALL     | public | PERMISSIVE | `(auth.uid() IS NOT NULL)` | `(auth.uid() IS NOT NULL)` |

### `photos`

| Policy                        | Command | Roles  | Action     | USING                      | WITH CHECK                 |
| ----------------------------- | ------- | ------ | ---------- | -------------------------- | -------------------------- |
| `Allow all for authenticated` | ALL     | public | PERMISSIVE | `(auth.uid() IS NOT NULL)` | `(auth.uid() IS NOT NULL)` |

### `upload_logs`

| Policy                        | Command | Roles  | Action     | USING                      | WITH CHECK                 |
| ----------------------------- | ------- | ------ | ---------- | -------------------------- | -------------------------- |
| `Allow all for authenticated` | ALL     | public | PERMISSIVE | `(auth.uid() IS NOT NULL)` | `(auth.uid() IS NOT NULL)` |

### `whatsapp_templates`

| Policy                                                     | Command | Roles  | Action     | USING                                                                                           | WITH CHECK |
| ---------------------------------------------------------- | ------- | ------ | ---------- | ----------------------------------------------------------------------------------------------- | ---------- |
| `Allow admin to manage whatsapp_templates`                 | ALL     | public | PERMISSIVE | `(( SELECT profiles.role    FROM profiles   WHERE (profiles.id = auth.uid())) = 'admin'::text)` | —          |
| `Allow all authenticated users to read whatsapp_templates` | SELECT  | public | PERMISSIVE | `(auth.uid() IS NOT NULL)`                                                                      | —          |

### `closings`

| Policy                              | Command | Roles  | Action     | USING                                                                                                                        | WITH CHECK                                                                                                                   |
| ----------------------------------- | ------- | ------ | ---------- | ---------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `Admin and owner can view closings` | SELECT  | public | PERMISSIVE | `(auth.uid() IN ( SELECT profiles.id    FROM profiles   WHERE (profiles.role = ANY (ARRAY['admin'::text, 'owner'::text]))))` | —                                                                                                                            |
| `Admin can insert closings`         | INSERT  | public | PERMISSIVE | —                                                                                                                            | `(auth.uid() IN ( SELECT profiles.id    FROM profiles   WHERE (profiles.role = ANY (ARRAY['admin'::text, 'owner'::text]))))` |
| `Owner can update closings`         | UPDATE  | public | PERMISSIVE | `(auth.uid() IN ( SELECT profiles.id    FROM profiles   WHERE (profiles.role = 'owner'::text)))`                             | —                                                                                                                            |
| `public_all_access`                 | ALL     | public | PERMISSIVE | `(auth.uid() IS NOT NULL)`                                                                                                   | `(auth.uid() IS NOT NULL)`                                                                                                   |

### `expenses`

| Policy                        | Command | Roles  | Action     | USING                                                                                                                                                                             | WITH CHECK                                                                                                                                                                        |
| ----------------------------- | ------- | ------ | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `expenses_admin_owner_all`    | ALL     | public | PERMISSIVE | `(EXISTS ( SELECT 1    FROM profiles   WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['admin'::text, 'owner'::text])))))`                                      | —                                                                                                                                                                                 |
| `expenses_admin_owner_delete` | DELETE  | public | PERMISSIVE | `(EXISTS ( SELECT 1    FROM profiles   WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['admin'::text, 'owner'::text])))))`                                      | —                                                                                                                                                                                 |
| `expenses_admin_owner_update` | UPDATE  | public | PERMISSIVE | `(EXISTS ( SELECT 1    FROM profiles   WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['admin'::text, 'owner'::text])))))`                                      | —                                                                                                                                                                                 |
| `expenses_staff_create`       | INSERT  | public | PERMISSIVE | —                                                                                                                                                                                 | `(EXISTS ( SELECT 1    FROM profiles   WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['admin'::text, 'teknisi'::text, 'supervisor'::text, 'owner'::text])))))` |
| `expenses_staff_read`         | SELECT  | public | PERMISSIVE | `(EXISTS ( SELECT 1    FROM profiles   WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['admin'::text, 'teknisi'::text, 'supervisor'::text, 'owner'::text])))))` | —                                                                                                                                                                                 |
| `public_all_access`           | ALL     | public | PERMISSIVE | `(auth.uid() IS NOT NULL)`                                                                                                                                                        | `(auth.uid() IS NOT NULL)`                                                                                                                                                        |

### `upload_sessions`

| Policy         | Command | Roles         | Action     | USING                    | WITH CHECK               |
| -------------- | ------- | ------------- | ---------- | ------------------------ | ------------------------ |
| `Owner access` | ALL     | authenticated | PERMISSIVE | `(auth.uid() = user_id)` | `(auth.uid() = user_id)` |

### `upload_drafts`

| Policy             | Command | Roles        | Action     | USING                    | WITH CHECK |
| ------------------ | ------- | ------------ | ---------- | ------------------------ | ---------- |
| `Owner access`     | ALL     | public       | PERMISSIVE | `(auth.uid() = user_id)` | —          |
| `service_role_all` | ALL     | service_role | PERMISSIVE | `true`                   | `true`     |

### `media_events`

| Policy         | Command | Roles  | Action     | USING                                                                                                                                      | WITH CHECK |
| -------------- | ------- | ------ | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ---------- |
| `Owner access` | ALL     | public | PERMISSIVE | `(EXISTS ( SELECT 1    FROM upload_drafts   WHERE ((upload_drafts.id = media_events.draft_id) AND (upload_drafts.user_id = auth.uid()))))` | —          |

### `media_files`

| Policy                | Command | Roles        | Action     | USING                    | WITH CHECK |
| --------------------- | ------- | ------------ | ---------- | ------------------------ | ---------- |
| `Owner access`        | ALL     | public       | PERMISSIVE | `(auth.uid() = user_id)` | —          |
| `service_role_update` | UPDATE  | service_role | PERMISSIVE | `true`                   | `true`     |

### `service_timeline`

| Policy              | Command | Roles  | Action     | USING                      | WITH CHECK                 |
| ------------------- | ------- | ------ | ---------- | -------------------------- | -------------------------- |
| `public_all_access` | ALL     | public | PERMISSIVE | `(auth.uid() IS NOT NULL)` | `(auth.uid() IS NOT NULL)` |

### `branches`

| Policy              | Command | Roles  | Action     | USING                      | WITH CHECK                 |
| ------------------- | ------- | ------ | ---------- | -------------------------- | -------------------------- |
| `public_all_access` | ALL     | public | PERMISSIVE | `(auth.uid() IS NOT NULL)` | `(auth.uid() IS NOT NULL)` |

### `inventory_stocks`

| Policy              | Command | Roles  | Action     | USING                      | WITH CHECK                 |
| ------------------- | ------- | ------ | ---------- | -------------------------- | -------------------------- |
| `public_all_access` | ALL     | public | PERMISSIVE | `(auth.uid() IS NOT NULL)` | `(auth.uid() IS NOT NULL)` |

### `reports`

| Policy              | Command | Roles  | Action     | USING                      | WITH CHECK                 |
| ------------------- | ------- | ------ | ---------- | -------------------------- | -------------------------- |
| `public_all_access` | ALL     | public | PERMISSIVE | `(auth.uid() IS NOT NULL)` | `(auth.uid() IS NOT NULL)` |

### `announcements`

| Policy              | Command | Roles  | Action     | USING                      | WITH CHECK                 |
| ------------------- | ------- | ------ | ---------- | -------------------------- | -------------------------- |
| `public_all_access` | ALL     | public | PERMISSIVE | `(auth.uid() IS NOT NULL)` | `(auth.uid() IS NOT NULL)` |

### `branch_assignments`

| Policy              | Command | Roles  | Action     | USING                      | WITH CHECK                 |
| ------------------- | ------- | ------ | ---------- | -------------------------- | -------------------------- |
| `public_all_access` | ALL     | public | PERMISSIVE | `(auth.uid() IS NOT NULL)` | `(auth.uid() IS NOT NULL)` |

### `layanan_items`

| Policy              | Command | Roles  | Action     | USING                      | WITH CHECK                 |
| ------------------- | ------- | ------ | ---------- | -------------------------- | -------------------------- |
| `Allow all`         | ALL     | public | PERMISSIVE | `true`                     | `true`                     |
| `public_all_access` | ALL     | public | PERMISSIVE | `(auth.uid() IS NOT NULL)` | `(auth.uid() IS NOT NULL)` |

### `qc_recalls`

| Policy              | Command | Roles  | Action     | USING                      | WITH CHECK                 |
| ------------------- | ------- | ------ | ---------- | -------------------------- | -------------------------- |
| `public_all_access` | ALL     | public | PERMISSIVE | `(auth.uid() IS NOT NULL)` | `(auth.uid() IS NOT NULL)` |

### `profiles`

| Policy              | Command | Roles  | Action     | USING                      | WITH CHECK                 |
| ------------------- | ------- | ------ | ---------- | -------------------------- | -------------------------- |
| `public_all_access` | ALL     | public | PERMISSIVE | `(auth.uid() IS NOT NULL)` | `(auth.uid() IS NOT NULL)` |

### `inventory`

| Policy              | Command | Roles  | Action     | USING                      | WITH CHECK                 |
| ------------------- | ------- | ------ | ---------- | -------------------------- | -------------------------- |
| `public_all_access` | ALL     | public | PERMISSIVE | `(auth.uid() IS NOT NULL)` | `(auth.uid() IS NOT NULL)` |

### `categories`

| Policy              | Command | Roles  | Action     | USING                      | WITH CHECK                 |
| ------------------- | ------- | ------ | ---------- | -------------------------- | -------------------------- |
| `public_all_access` | ALL     | public | PERMISSIVE | `(auth.uid() IS NOT NULL)` | `(auth.uid() IS NOT NULL)` |

### `qc_reviews`

| Policy              | Command | Roles  | Action     | USING                      | WITH CHECK                 |
| ------------------- | ------- | ------ | ---------- | -------------------------- | -------------------------- |
| `public_all_access` | ALL     | public | PERMISSIVE | `(auth.uid() IS NOT NULL)` | `(auth.uid() IS NOT NULL)` |

### `contact_logs`

| Policy              | Command | Roles  | Action     | USING                      | WITH CHECK                 |
| ------------------- | ------- | ------ | ---------- | -------------------------- | -------------------------- |
| `public_all_access` | ALL     | public | PERMISSIVE | `(auth.uid() IS NOT NULL)` | `(auth.uid() IS NOT NULL)` |

### `service_items`

| Policy              | Command | Roles  | Action     | USING                      | WITH CHECK                 |
| ------------------- | ------- | ------ | ---------- | -------------------------- | -------------------------- |
| `public_all_access` | ALL     | public | PERMISSIVE | `(auth.uid() IS NOT NULL)` | `(auth.uid() IS NOT NULL)` |

### `service_orders`

| Policy                       | Command | Roles  | Action     | USING                                                                                                                                                                                    | WITH CHECK                 |
| ---------------------------- | ------- | ------ | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------- |
| `admin_all`                  | ALL     | public | PERMISSIVE | `(auth.uid() IN ( SELECT profiles.id    FROM profiles   WHERE (profiles.role = ANY (ARRAY['admin'::text, 'owner'::text]))))`                                                             | —                          |
| `anon_select_by_token`       | SELECT  | public | PERMISSIVE | `true`                                                                                                                                                                                   | —                          |
| `auth_all`                   | ALL     | public | PERMISSIVE | `(auth.uid() IS NOT NULL)`                                                                                                                                                               | `(auth.uid() IS NOT NULL)` |
| `customer_tracking`          | SELECT  | public | PERMISSIVE | `((token = current_setting('app.current_token'::text, true)) OR (auth.uid() IS NOT NULL))`                                                                                               | —                          |
| `supervisor_all`             | ALL     | public | PERMISSIVE | `(auth.uid() IN ( SELECT profiles.id    FROM profiles   WHERE (profiles.role = ANY (ARRAY['supervisor'::text, 'admin'::text, 'owner'::text]))))`                                         | —                          |
| `teknisi_select_own_service` | SELECT  | public | PERMISSIVE | `((assigned_teknisi_id = auth.uid()) OR (auth.uid() IN ( SELECT profiles.id    FROM profiles   WHERE (profiles.role = ANY (ARRAY['supervisor'::text, 'admin'::text, 'owner'::text])))))` | —                          |

### `activity_logs`

| Policy              | Command | Roles  | Action     | USING                      | WITH CHECK                 |
| ------------------- | ------- | ------ | ---------- | -------------------------- | -------------------------- |
| `public_all_access` | ALL     | public | PERMISSIVE | `(auth.uid() IS NOT NULL)` | `(auth.uid() IS NOT NULL)` |

### `attendances`

| Policy              | Command | Roles  | Action     | USING                      | WITH CHECK                 |
| ------------------- | ------- | ------ | ---------- | -------------------------- | -------------------------- |
| `public_all_access` | ALL     | public | PERMISSIVE | `(auth.uid() IS NOT NULL)` | `(auth.uid() IS NOT NULL)` |

### `customers`

| Policy                                     | Command | Roles  | Action     | USING                      | WITH CHECK                 |
| ------------------------------------------ | ------- | ------ | ---------- | -------------------------- | -------------------------- |
| `Authenticated users can insert customers` | INSERT  | public | PERMISSIVE | —                          | `(auth.uid() IS NOT NULL)` |
| `Authenticated users can read customers`   | SELECT  | public | PERMISSIVE | `(auth.uid() IS NOT NULL)` | —                          |
| `Authenticated users can update customers` | UPDATE  | public | PERMISSIVE | `(auth.uid() IS NOT NULL)` | —                          |
| `public_all_access`                        | ALL     | public | PERMISSIVE | `(auth.uid() IS NOT NULL)` | `(auth.uid() IS NOT NULL)` |

### `service_documentation`

| Policy              | Command | Roles  | Action     | USING                      | WITH CHECK                 |
| ------------------- | ------- | ------ | ---------- | -------------------------- | -------------------------- |
| `public_all_access` | ALL     | public | PERMISSIVE | `(auth.uid() IS NOT NULL)` | `(auth.uid() IS NOT NULL)` |

### `watch_database`

| Policy              | Command | Roles  | Action     | USING                      | WITH CHECK                 |
| ------------------- | ------- | ------ | ---------- | -------------------------- | -------------------------- |
| `public_all_access` | ALL     | public | PERMISSIVE | `(auth.uid() IS NOT NULL)` | `(auth.uid() IS NOT NULL)` |

### `warranties`

| Policy              | Command | Roles  | Action     | USING                      | WITH CHECK                 |
| ------------------- | ------- | ------ | ---------- | -------------------------- | -------------------------- |
| `public_all_access` | ALL     | public | PERMISSIVE | `(auth.uid() IS NOT NULL)` | `(auth.uid() IS NOT NULL)` |

### `service_jasa`

| Policy              | Command | Roles  | Action     | USING                      | WITH CHECK                 |
| ------------------- | ------- | ------ | ---------- | -------------------------- | -------------------------- |
| `public_all_access` | ALL     | public | PERMISSIVE | `(auth.uid() IS NOT NULL)` | `(auth.uid() IS NOT NULL)` |

### `sparepart_conversations`

| Policy              | Command | Roles  | Action     | USING                      | WITH CHECK                 |
| ------------------- | ------- | ------ | ---------- | -------------------------- | -------------------------- |
| `public_all_access` | ALL     | public | PERMISSIVE | `(auth.uid() IS NOT NULL)` | `(auth.uid() IS NOT NULL)` |

### `layanan`

| Policy              | Command | Roles  | Action     | USING                      | WITH CHECK                 |
| ------------------- | ------- | ------ | ---------- | -------------------------- | -------------------------- |
| `public_all_access` | ALL     | public | PERMISSIVE | `(auth.uid() IS NOT NULL)` | `(auth.uid() IS NOT NULL)` |

### `stock_transfers`

| Policy              | Command | Roles  | Action     | USING                      | WITH CHECK                 |
| ------------------- | ------- | ------ | ---------- | -------------------------- | -------------------------- |
| `public_all_access` | ALL     | public | PERMISSIVE | `(auth.uid() IS NOT NULL)` | `(auth.uid() IS NOT NULL)` |

### `feedbacks`

| Policy              | Command | Roles  | Action     | USING                      | WITH CHECK                 |
| ------------------- | ------- | ------ | ---------- | -------------------------- | -------------------------- |
| `public_all_access` | ALL     | public | PERMISSIVE | `(auth.uid() IS NOT NULL)` | `(auth.uid() IS NOT NULL)` |

### `stock_gudang`

| Policy              | Command | Roles  | Action     | USING                      | WITH CHECK                 |
| ------------------- | ------- | ------ | ---------- | -------------------------- | -------------------------- |
| `public_all_access` | ALL     | public | PERMISSIVE | `(auth.uid() IS NOT NULL)` | `(auth.uid() IS NOT NULL)` |

### `stock_toko`

| Policy              | Command | Roles  | Action     | USING                      | WITH CHECK                 |
| ------------------- | ------- | ------ | ---------- | -------------------------- | -------------------------- |
| `public_all_access` | ALL     | public | PERMISSIVE | `(auth.uid() IS NOT NULL)` | `(auth.uid() IS NOT NULL)` |

### `sparepart_requests`

| Policy              | Command | Roles  | Action     | USING                      | WITH CHECK                 |
| ------------------- | ------- | ------ | ---------- | -------------------------- | -------------------------- |
| `public_all_access` | ALL     | public | PERMISSIVE | `(auth.uid() IS NOT NULL)` | `(auth.uid() IS NOT NULL)` |
