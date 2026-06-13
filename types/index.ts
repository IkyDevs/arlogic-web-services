export type UserRole = 'admin' | 'teknisi' | 'supervisor' | 'owner' | 'customer'

export interface Profile {
  id: string
  email: string
  full_name: string
  role: UserRole
  teknisi_name?: string
  phone?: string
  created_at: string
  updated_at: string
}

export interface ServiceOrder {
  id: string
  invoice_number: string
  token: string
  customer_name: string
  customer_phone: string
  device_type: string
  device_brand: string
  device_model?: string
  issue_description: string
  status: 'pending' | 'assigned' | 'in_progress' | 'qc_pending' | 'completed' | 'cancelled'
  assigned_teknisi_id?: string
  estimated_cost?: number
  final_cost?: number
  created_at: string
  completed_at?: string
  token_expires_at?: string
}

export interface ServiceItem {
  id: string
  service_order_id: string
  item_type: 'jasa' | 'sparepart'
  name: string
  quantity: number
  price: number
  created_at: string
}

export interface ServiceDocumentation {
  id: string
  service_order_id: string
  photo_url: string
  stage: string
  uploaded_by: string
  created_at: string
}

export interface Attendance {
  id: string
  teknisi_id: string
  photo_url: string
  location?: string
  check_in: string
  check_out?: string
  created_at: string
}

export interface Inventory {
  id: string
  item_name: string
  sku: string
  store_stock: number
  warehouse_stock: number
  unit: string
  min_stock: number
  created_at: string
  updated_at: string
}

export interface QCReview {
  id: string
  service_order_id: string
  reviewer_id: string
  status: 'approved' | 'rejected'
  notes?: string
  created_at: string
}

export interface ActivityLog {
  id: string
  user_id: string
  action: string
  details?: any
  created_at: string
}
