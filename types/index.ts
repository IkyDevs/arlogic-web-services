export type UserRole = 'admin' | 'teknisi' | 'supervisor' | 'owner' | 'customer'

// Layanan Types
export type JenisLayanan =
  | 'ambil_jam_service'
  | 'order_online'
  | 'beli_jam'
  | 'pengeluaran'
  | 'dp_service'
  | 'service_langsung';

export type MetodePembayaran =
  | 'cash'
  | 'edc_mandiri'
  | 'tf_bca'
  | 'bri'
  | 'kudus'
  | 'edc_bca'
  | 'tf_mandiri'
  | 'qris';

export type LeadSource =
  | 'instagram'
  | 'wom'
  | 'dekat_lewat'
  | 'google'
  | 'dash'
  | 'facebook'
  | 'old'
  | 'tiktok'
  | 'tulis_sendiri';

export interface Layanan {
  id: string;
  customer_name: string;
  customer_whatsapp: string;
  jenis_layanan: JenisLayanan;
  handled_by: string;
  handled_by_name: string;
  metode_pembayaran: MetodePembayaran;
  lead_source: LeadSource;
  lead_source_custom?: string;
  detail_sku: string;
  nominal: number;
  status: 'active' | 'cancelled' | 'completed';
  created_by: string;
  created_by_name: string;
  created_at: string;
  updated_at: string;
  notes?: string;
}

// Label mappings for display
export const jenisLayananLabels: Record<JenisLayanan, string> = {
  ambil_jam_service: 'Ambil Jam Service',
  order_online: 'Order Online',
  beli_jam: 'Beli Jam',
  pengeluaran: 'Pengeluaran',
  dp_service: 'DP Service',
  service_langsung: 'Service Langsung'
};

export const metodePembayaranLabels: Record<MetodePembayaran, string> = {
  cash: 'Cash',
  edc_mandiri: 'EDC Mandiri',
  tf_bca: 'Transfer BCA',
  bri: 'BRI',
  kudus: 'Kudus',
  edc_bca: 'EDC BCA',
  tf_mandiri: 'Transfer Mandiri',
  qris: 'QRIS'
};

export const leadSourceLabels: Record<LeadSource, string> = {
  instagram: 'Instagram',
  wom: 'WOM (Word of Mouth)',
  dekat_lewat: 'Dekat / Lewat',
  google: 'Google',
  dash: '-',
  facebook: 'Facebook',
  old: 'Old Customer',
  tiktok: 'TikTok',
  tulis_sendiri: 'Tulis Sendiri'
};

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
  // Watch-specific fields
  watch_brand?: string
  watch_model?: string
  watch_year?: number
  watch_movement?: string
  watch_condition?: string
  watch_accessories?: string[]
  watch_serial_number?: string
  serial_number?: string
  request?: string
  notes?: string
  start_date?: string
  done_date?: string
  work_duration?: string
  completion_notes?: string
  warranty_months?: number
  warranty_expiry?: string
  // Joined data
  last_update?: { created_at: string }
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
