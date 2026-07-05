# Database Schema

## Core Tables

### auth.users (Supabase Managed)
- id UUID PK
- email TEXT
- raw_user_meta_data JSONB
- created_at TIMESTAMPTZ

### public.profiles
- id UUID PK (FK to auth.users)
- email TEXT
- full_name TEXT
- role TEXT (admin, teknisi, supervisor, owner, customer)
- created_at TIMESTAMPTZ
- updated_at TIMESTAMPTZ

### public.service_orders
- id UUID PK
- invoice_number TEXT UNIQUE
- token TEXT UNIQUE
- token_expires_at TIMESTAMPTZ
- customer_name TEXT
- customer_phone TEXT
- device_type TEXT (smartphone, smartwatch, dll)
- device_brand TEXT
- device_model TEXT
- issue_description TEXT
- request TEXT
- notes TEXT
- status TEXT (pending, assigned, in_progress, waiting_sparepart, qc_pending, completed, cancelled)
- assigned_teknisi_id UUID (FK profiles)
- estimated_cost NUMERIC
- final_cost NUMERIC
- created_at TIMESTAMPTZ
- updated_at TIMESTAMPTZ

### public.service_items
- id UUID PK
- service_order_id UUID (FK service_orders)
- item_type TEXT (jasa, sparepart)
- name TEXT
- quantity INT
- price NUMERIC
- created_at TIMESTAMPTZ

### public.service_timeline
- id UUID PK
- service_order_id UUID (FK service_orders)
- message TEXT
- status TEXT
- photo_url TEXT
- details JSONB
- created_at TIMESTAMPTZ

### public.layanan
- id UUID PK
- customer_name TEXT
- customer_whatsapp TEXT
- jenis_layanan TEXT
- handled_by UUID (FK profiles)
- handled_by_name TEXT
- metode_pembayaran TEXT
- lead_source TEXT
- lead_source_custom TEXT
- detail_sku TEXT
- nominal NUMERIC DEFAULT 0
- notes TEXT
- photo_url TEXT
- created_by UUID (FK profiles)
- created_by_name TEXT
- status TEXT DEFAULT 'active'
- created_at TIMESTAMPTZ
- updated_at TIMESTAMPTZ

### public.attendances
- id UUID PK
- teknisi_id UUID (FK profiles)
- type TEXT (check_in, check_out)
- photo_url TEXT
- check_in TIMESTAMPTZ
- check_out TIMESTAMPTZ
- overtime_minutes INT DEFAULT 0
- notes TEXT
- created_at TIMESTAMPTZ

### public.inventory
- id UUID PK
- item_name TEXT
- sku TEXT
- category TEXT
- store_stock INT DEFAULT 0
- warehouse_stock INT DEFAULT 0
- unit TEXT DEFAULT 'pcs'
- min_stock INT DEFAULT 0
- price NUMERIC DEFAULT 0
- photo_url TEXT
- created_at TIMESTAMPTZ
- updated_at TIMESTAMPTZ

### public.stock_transfers
- id UUID PK
- inventory_id UUID (FK inventory)
- from_location TEXT (warehouse/store)
- to_location TEXT (warehouse/store)
- quantity INT
- notes TEXT
- photo_url TEXT
- created_by UUID (FK profiles)
- created_at TIMESTAMPTZ

### public.categories
- id UUID PK
- name TEXT UNIQUE
- created_at TIMESTAMPTZ

### public.warranties
- id UUID PK
- service_order_id UUID (FK service_orders)
- warranty_period_months INT
- warranty_notes TEXT
- created_at TIMESTAMPTZ

### public.feedbacks
- id UUID PK
- service_order_id UUID (FK service_orders)
- customer_name TEXT
- rating INT
- comment TEXT
- created_at TIMESTAMPTZ

### public.notifications
- id UUID PK
- user_id UUID (FK profiles)
- message TEXT
- type TEXT
- read BOOLEAN DEFAULT false
- created_at TIMESTAMPTZ

## Planned Tables

### public.pra_services (planned)
- id UUID PK
- kategori TEXT (mudah, lumayan, hard, ambil cepat)
- customer_name TEXT
- customer_whatsapp TEXT
- brand TEXT
- series TEXT
- kendala TEXT
- request TEXT
- keterangan TEXT
- masuk TIMESTAMPTZ
- dp NUMERIC DEFAULT 0
- status TEXT DEFAULT 'pending'
- created_by UUID (FK profiles)
- created_at TIMESTAMPTZ
- updated_at TIMESTAMPTZ

### public.stock_transfers (planned)
- id UUID PK
- from_location TEXT (warehouse, store)
- to_location TEXT
- inventory_id UUID (FK inventory)
- quantity INT
- notes TEXT
- photo_url TEXT
- created_by UUID (FK profiles)
- created_at TIMESTAMPTZ

## Triggers & Functions
- `update_updated_at_column()` - auto update updated_at
- `handle_new_user()` - auto create profile on signup
- `update_layanan_updated_at()` - specific for layanan table

## Indexes
- service_orders.token (unique)
- service_orders.invoice_number (unique)
- service_items.service_order_id
- service_timeline.service_order_id
- attendances.teknisi_id + created_at
- inventory.item_name, inventory.sku
- layanan.created_by, layanan.status
