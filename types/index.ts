// =====================================================
// WATCH SERVICE MANAGEMENT SYSTEM - TYPE DEFINITIONS
// =====================================================

// =====================================================
// USER & AUTH TYPES
// =====================================================

export type UserRole = 'admin' | 'teknisi' | 'supervisor' | 'owner' | 'customer'

export interface Profile {
  id: string
  email: string
  full_name: string
  role: UserRole
  teknisi_name?: string
  phone?: string
  avatar_url?: string
  created_at: string
  updated_at: string
}

// =====================================================
// SERVICE ORDER TYPES
// =====================================================

export type ServiceStatus =
  | 'pending'
  | 'assigned'
  | 'in_progress'
  | 'qc_pending'
  | 'completed'
  | 'cancelled'

export type WatchMovement = 'automatic' | 'quartz' | 'mechanical' | 'smartwatch' | 'other'
export type WatchCondition = 'new' | 'excellent' | 'good' | 'fair' | 'poor'

export interface ServiceOrder {
  id: string
  invoice_number: string
  token: string
  token_expires_at?: string

  // Customer Information
  customer_name: string
  customer_phone: string
  serial_number?: string

  // Device Information
  device_type: string
  device_brand: string
  device_model?: string

  // Watch Specific Fields
  watch_brand?: string
  watch_model?: string
  watch_year?: number
  watch_movement?: WatchMovement
  watch_condition?: WatchCondition
  watch_accessories?: string[]

  // Service Information
  issue_description: string
  request?: string
  notes?: string

  // Status
  status: ServiceStatus

  // Assignment
  assigned_teknisi_id?: string

  // Timeline
  created_at: string
  completed_at?: string
  start_date?: string
  done_date?: string
  work_duration?: string

  // Financial
  estimated_cost?: number
  final_cost?: number

  // Completion
  completion_notes?: string

  // Warranty
  warranty_months?: number
  warranty_expiry?: string

  // Extended (for UI)
  last_update?: {
    id: string
    message: string
    status: string
    created_at: string
    photo_url?: string
  }
}

// =====================================================
// SERVICE ITEM TYPES
// =====================================================

export type ItemType = 'jasa' | 'sparepart'

export interface ServiceItem {
  id: string
  service_order_id: string
  item_type: ItemType
  name: string
  quantity: number
  price: number
  created_at: string
}

// =====================================================
// SERVICE DOCUMENTATION TYPES
// =====================================================

export interface ServiceDocumentation {
  id: string
  service_order_id: string
  photo_url: string
  stage: string
  uploaded_by: string
  created_at: string
}

// =====================================================
// SERVICE TIMELINE TYPES
// =====================================================

export interface ServiceTimeline {
  id: string
  service_order_id: string
  teknisi_id?: string
  status: string
  message: string
  photo_url?: string
  details?: any
  created_at: string
}

// =====================================================
// ATTENDANCE TYPES
// =====================================================

export interface Attendance {
  id: string
  teknisi_id: string
  photo_url: string
  location?: string
  check_in: string
  check_out?: string
  status: 'checked_in' | 'checked_out'
  created_at: string
}

// =====================================================
// INVENTORY TYPES
// =====================================================

export interface Inventory {
  id: string
  item_name: string
  sku: string
  store_stock: number
  warehouse_stock: number
  unit: string
  min_stock: number
  compatible_brands?: string[]
  compatible_models?: string[]
  created_at: string
  updated_at: string
}

// =====================================================
// QC REVIEW TYPES
// =====================================================

export interface QCReview {
  id: string
  service_order_id: string
  reviewer_id: string
  status: 'approved' | 'rejected'
  notes?: string
  created_at: string
}

// =====================================================
// ACTIVITY LOG TYPES
// =====================================================

export interface ActivityLog {
  id: string
  user_id: string
  action: string
  details?: any
  created_at: string
}

// =====================================================
// CONTACT LOG TYPES
// =====================================================

export type ContactMethod = 'whatsapp' | 'call' | 'sms' | 'email'

export interface ContactLog {
  id: string
  service_order_id: string
  teknisi_id: string
  contact_method: ContactMethod
  message?: string
  notes?: string
  created_at: string
}

// =====================================================
// NOTIFICATION TYPES
// =====================================================

export type NotificationType = 'info' | 'success' | 'warning' | 'error'

export interface Notification {
  id: string
  user_id: string
  title: string
  message: string
  type: NotificationType
  is_read: boolean
  link?: string
  created_at: string
}

// =====================================================
// LAYANAN (TRANSACTION) TYPES
// =====================================================

export type JenisLayanan =
  | 'ambil_jam_service'
  | 'order_online'
  | 'beli_jam'
  | 'pengeluaran'
  | 'dp_service'
  | 'service_langsung'

export type MetodePembayaran =
  | 'cash'
  | 'edc_mandiri'
  | 'tf_bca'
  | 'bri'
  | 'kudus'
  | 'edc_bca'
  | 'tf_mandiri'
  | 'qris'

export type LeadSource =
  | 'instagram'
  | 'wom'
  | 'dekat_lewat'
  | 'google'
  | 'dash'
  | 'facebook'
  | 'old'
  | 'tiktok'
  | 'tulis_sendiri'

export interface Layanan {
  id: string
  customer_name: string
  customer_whatsapp: string
  jenis_layanan: JenisLayanan
  handled_by: string
  handled_by_name: string
  metode_pembayaran: MetodePembayaran
  lead_source: LeadSource
  lead_source_custom?: string
  detail_sku?: string
  nominal: number
  status: 'active' | 'cancelled' | 'completed'
  photo_url?: string
  created_by: string
  created_by_name: string
  created_at: string
  updated_at: string
  notes?: string
}

// =====================================================
// WATCH DATABASE TYPES
// =====================================================

export interface WatchDatabase {
  id: string
  brand: string
  model: string
  movement: WatchMovement
  year_from?: number
  year_to?: number
  reference_number?: string
  image_url?: string
  created_at: string
}

// =====================================================
// WARRANTY TYPES
// =====================================================

export interface Warranty {
  id: string
  service_order_id: string
  warranty_number: string
  issued_at: string
  expiry_date: string
  terms?: string
  created_at: string
}

// =====================================================
// LABEL MAPPINGS FOR DISPLAY
// =====================================================

export const jenisLayananLabels: Record<JenisLayanan, string> = {
  ambil_jam_service: 'Ambil Jam Service',
  order_online: 'Order Online',
  beli_jam: 'Beli Jam',
  pengeluaran: 'Pengeluaran',
  dp_service: 'DP Service',
  service_langsung: 'Service Langsung'
}

export const metodePembayaranLabels: Record<MetodePembayaran, string> = {
  cash: 'Cash',
  edc_mandiri: 'EDC Mandiri',
  tf_bca: 'Transfer BCA',
  bri: 'BRI',
  kudus: 'Kudus',
  edc_bca: 'EDC BCA',
  tf_mandiri: 'Transfer Mandiri',
  qris: 'QRIS'
}

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
}

export const serviceStatusLabels: Record<ServiceStatus, string> = {
  pending: 'Menunggu',
  assigned: 'Ditugaskan',
  in_progress: 'Dalam Pengerjaan',
  qc_pending: 'Quality Check',
  completed: 'Selesai',
  cancelled: 'Dibatalkan'
}

export const watchMovementLabels: Record<WatchMovement, string> = {
  automatic: 'Automatic',
  quartz: 'Quartz',
  mechanical: 'Mechanical',
  smartwatch: 'Smartwatch',
  other: 'Other'
}

export const watchConditionLabels: Record<WatchCondition, string> = {
  new: 'New',
  excellent: 'Excellent',
  good: 'Good',
  fair: 'Fair',
  poor: 'Poor'
}

// =====================================================
// HELPER FUNCTIONS
// =====================================================

export const formatRupiah = (nominal: number): string => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(nominal)
}

export const formatDate = (date: string | Date, format: 'full' | 'date' | 'time' = 'full'): string => {
  const d = new Date(date)

  if (format === 'date') {
    return d.toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    })
  }

  if (format === 'time') {
    return d.toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  return d.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

export const getRelativeTime = (date: string | Date): string => {
  const now = new Date()
  const past = new Date(date)
  const diffMs = now.getTime() - past.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffMins < 1) return 'Baru saja'
  if (diffMins < 60) return `${diffMins} menit lalu`
  if (diffHours < 24) return `${diffHours} jam lalu`
  if (diffDays < 7) return `${diffDays} hari lalu`
  return past.toLocaleDateString()
}

export const getStatusColor = (status: ServiceStatus): string => {
  const colors: Record<ServiceStatus, string> = {
    pending: 'bg-yellow-100 text-yellow-700 border-yellow-200',
    assigned: 'bg-blue-100 text-blue-700 border-blue-200',
    in_progress: 'bg-purple-100 text-purple-700 border-purple-200',
    qc_pending: 'bg-orange-100 text-orange-700 border-orange-200',
    completed: 'bg-green-100 text-green-700 border-green-200',
    cancelled: 'bg-red-100 text-red-700 border-red-200'
  }
  return colors[status]
}

// =====================================================
// DASHBOARD STATS TYPES
// =====================================================

export interface DashboardStats {
  totalUsers: number
  totalServices: number
  totalInventory: number
  pendingServices: number
  completedToday: number
  pendingSparepart: number
  revenue: number
  revenueGrowth: number
}

export interface TeknisiStats {
  completedToday: number
  completedThisMonth: number
  inProgress: number
  pendingQueue: number
  averageTime: number
  rating: number
  totalEarnings: number
}

export interface ChartData {
  date: string
  revenue: number
  count: number
}

export interface TopTeknisi {
  name: string
  count: number
  avatar?: string
}
