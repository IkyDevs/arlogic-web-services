// ─── Service Order Domain Types ────────────────────────────────────

export type ServiceStatus =
  | "pending"
  | "assigned"
  | "in_progress"
  | "req_sparepart_admin"
  | "po_pending"
  | "sparepart_ready"
  | "qc_pending"
  | "revision_required"
  | "completed"
  | "done"
  | "cancelled"

export type ServiceItemType = "jasa" | "sparepart"

export const SERVICE_ITEM_TYPES = ["jasa", "sparepart"] as const

export const serviceStatusLabels: Record<ServiceStatus, string> = {
  pending: "Menunggu",
  assigned: "Ditugaskan",
  in_progress: "Dalam Pengerjaan",
  req_sparepart_admin: "Request PO",
  po_pending: "PO Pending",
  sparepart_ready: "Sparepart Ready",
  qc_pending: "Quality Check",
  revision_required: "Perlu Revisi",
  completed: "Selesai QC",
  done: "Sudah Diambil",
  cancelled: "Dibatalkan",
}

export interface ServiceOrder {
  id: string
  invoice_number: string
  token: string
  token_expires_at?: string
  customer_name: string
  customer_phone: string
  serial_number?: string
  device_type: string
  device_brand: string
  device_model?: string
  watch_brand?: string
  watch_model?: string
  watch_year?: number
  watch_movement?: string
  watch_condition?: string
  watch_accessories?: string[]
  category?: string
  issue_description: string
  request?: string
  notes?: string
  down_payment: number
  payment_method: string
  status: ServiceStatus
  assigned_teknisi_id?: string
  po_status?: string
  po_sparepart?: string
  po_requested_at?: string
  po_admin_response?: string
  created_at: string
  completed_at?: string
  start_date?: string
  done_date?: string
  work_duration?: string
  estimated_cost: number
  final_cost: number
  discount: number
  discount_percentage: number
  completion_notes?: string
  qc_submit_notes?: string
  warranty_months: number
  warranty_expiry?: string
  teknisi_pending_reason?: string
  pending_teknisi_approved?: boolean | null
}

export interface ServiceItem {
  id: string
  service_order_id: string
  item_type: ServiceItemType
  name: string
  quantity: number
  price: number
  is_final: boolean
  created_at: string
}

export interface ServiceTimeline {
  id: string
  service_order_id: string
  teknisi_id?: string
  status: string
  message: string
  photo_url?: string
  details?: Record<string, unknown>
  created_at: string
}

export interface QCReview {
  id: string
  service_order_id: string
  reviewer_id: string
  status: "approved" | "rejected"
  notes?: string
  created_at: string
}

export interface QCRecall {
  id: string
  service_order_id: string
  qc_id: string
  reason: string
  created_at: string
}

export interface FinalServiceSnapshot {
  service_order_id: string
  items: ServiceItem[]
  total_jasa: number
  total_sparepart: number
  grand_total: number
  timestamp: string
}