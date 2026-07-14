// =====================================================
// WATCH SERVICE MANAGEMENT SYSTEM - TYPE DEFINITIONS
// =====================================================

// =====================================================
// USER & AUTH TYPES
// =====================================================

export type UserRole =
  | "admin"
  | "teknisi"
  | "supervisor"
  | "owner"
  | "customer";

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  teknisi_name?: string;
  phone?: string;
  gender?: string;
  avatar_url?: string;
  created_at: string;
  updated_at: string;
}

// =====================================================
// SERVICE ORDER TYPES
// =====================================================

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
  | "cancelled";

export type WatchMovement =
  | "automatic"
  | "quartz"
  | "mechanical"
  | "smartwatch"
  | "other";
export type WatchCondition = "new" | "excellent" | "good" | "fair" | "poor";

export interface ServiceOrder {
  id: string;
  invoice_number: string;
  token: string;
  token_expires_at?: string;

  // Customer Information
  customer_name: string;
  customer_phone: string;
  serial_number?: string;

  // Device Information
  device_type: string;
  device_brand: string;
  device_model?: string;

  // Watch Specific Fields
  watch_brand?: string;
  watch_model?: string;
  watch_year?: number;
  watch_movement?: WatchMovement;
  watch_condition?: WatchCondition;
  watch_accessories?: string[];
  category?: string;

  // Service Information
  issue_description: string;
  request?: string;
  notes?: string;
  down_payment?: number;

  // Status
  status: ServiceStatus;

  // PO Fields
  po_status?: string;
  po_sparepart?: string;
  po_requested_at?: string;
  po_admin_response?: string;

  // Assignment
  assigned_teknisi_id?: string;

  // Timeline
  created_at: string;
  completed_at?: string;
  start_date?: string;
  done_date?: string;
  work_duration?: string;

  // Financial
  estimated_cost?: number;
  final_cost?: number;

  // Completion
  completion_notes?: string;

  // Warranty
  warranty_months?: number;
  warranty_expiry?: string;

  // Extended (for UI)
  last_update?: {
    id: string;
    message: string;
    status: string;
    created_at: string;
    photo_url?: string;
  };
}

// =====================================================
// SERVICE ITEM TYPES
// =====================================================

export type ItemType = "jasa" | "sparepart";

export interface ServiceItem {
  id: string;
  service_order_id: string;
  item_type: ItemType;
  name: string;
  quantity: number;
  price: number;
  created_at: string;
}

// =====================================================
// SERVICE DOCUMENTATION TYPES
// =====================================================

export interface ServiceDocumentation {
  id: string;
  service_order_id: string;
  photo_url: string;
  stage: string;
  uploaded_by: string;
  created_at: string;
}

// =====================================================
// SERVICE TIMELINE TYPES
// =====================================================

export interface ServiceTimeline {
  id: string;
  service_order_id: string;
  teknisi_id?: string;
  status: string;
  message: string;
  photo_url?: string;
  details?: any;
  created_at: string;
}

// =====================================================
// ATTENDANCE TYPES
// =====================================================

export interface Attendance {
  id: string;
  teknisi_id: string;
  photo_url: string;
  location?: string;
  check_in: string;
  check_out?: string;
  status: "checked_in" | "checked_out";
  work_duration?: string;
  total_minutes?: number;
  created_at: string;
}

// =====================================================
// INVENTORY TYPES
// =====================================================

export interface Inventory {
  id: string;
  item_name: string;
  sku: string;
  store_stock: number;
  warehouse_stock: number;
  unit: string;
  min_stock: number;
  category?: string;
  price?: number;
  photo_url?: string;
  compatible_brands?: string[];
  compatible_models?: string[];
  created_at: string;
  updated_at: string;
}

// =====================================================
// CATEGORY TYPES
// =====================================================

export interface Category {
  id: string;
  name: string;
  description?: string;
  created_at: string;
}

export interface InventoryWithCategory extends Inventory {
  category?: string;
  photo_url?: string;
}

// =====================================================
// QC REVIEW TYPES
// =====================================================

export interface QCReview {
  id: string;
  service_order_id: string;
  reviewer_id: string;
  status: "approved" | "rejected";
  notes?: string;
  created_at: string;
}

// =====================================================
// ACTIVITY LOG TYPES
// =====================================================

export interface ActivityLog {
  id: string;
  user_id: string;
  action: string;
  details?: any;
  created_at: string;
}

// =====================================================
// CONTACT LOG TYPES
// =====================================================

export type ContactMethod = "whatsapp" | "call" | "sms" | "email";

export interface ContactLog {
  id: string;
  service_order_id: string;
  teknisi_id: string;
  contact_method: ContactMethod;
  message?: string;
  notes?: string;
  created_at: string;
}

// =====================================================
// NOTIFICATION TYPES
// =====================================================

export type NotificationType = "info" | "success" | "warning" | "error";

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: NotificationType;
  is_read: boolean;
  link?: string;
  created_at: string;
}

// =====================================================
// LAYANAN (TRANSACTION) TYPES
// =====================================================

export type JenisLayanan =
  | "ambil_jam_service"
  | "order_online"
  | "beli_jam"
  | "dp_service"
  | "service_langsung"
  | "analog_digital"
  | "pengeluaran"
  | "cashdraw";

export type MetodePembayaran =
  | "cash"
  | "edc"
  | "edc_mandiri"
  | "tf_bca"
  | "bri"
  | "kudus"
  | "edc_bca"
  | "tf_mandiri"
  | "qris"
  | "transfer";

export type LeadSource =
  | "instagram"
  | "wom"
  | "dekat_lewat"
  | "google"
  | "dash"
  | "facebook"
  | "old"
  | "tiktok"
  | "tulis_sendiri";

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
  detail_sku?: string;
  nominal: number;
  status: "active" | "cancelled" | "completed";
  photo_url?: string; // legacy single photo
  photo_urls?: string[]; // new multiple photos array
  created_by: string;
  created_by_name: string;
  created_at: string;
  updated_at: string;
  notes?: string;
  telegram_chat_id?: string;
  telegram_message_id?: number;
}

// =====================================================
// WATCH DATABASE TYPES
// =====================================================

export interface WatchDatabase {
  id: string;
  brand: string;
  model: string;
  movement: WatchMovement;
  year_from?: number;
  year_to?: number;
  reference_number?: string;
  image_url?: string;
  created_at: string;
}

// =====================================================
// WARRANTY TYPES
// =====================================================

export interface Warranty {
  id: string;
  service_order_id: string;
  warranty_number: string;
  issued_at: string;
  expiry_date: string;
  terms?: string;
  created_at: string;
}

// =====================================================
// LABEL MAPPINGS FOR DISPLAY
// =====================================================

export const jenisLayananLabels: Record<JenisLayanan, string> = {
  ambil_jam_service: "Ambil Jam Service",
  order_online: "Order Online",
  beli_jam: "Beli Jam",
  dp_service: "DP Service",
  service_langsung: "Service Langsung",
  analog_digital: "ANALOG-DIGITAL",
  pengeluaran: "Pengeluaran",
  cashdraw: "Cashdraw",
};

export const metodePembayaranLabels: Record<MetodePembayaran, string> = {
  cash: "Cash",
  edc: "EDC",
  edc_mandiri: "EDC Mandiri",
  tf_bca: "Transfer BCA",
  bri: "BRI",
  kudus: "Kudus",
  edc_bca: "EDC BCA",
  tf_mandiri: "Transfer Mandiri",
  qris: "QRIS",
  transfer: "Transfer",
};

export const leadSourceLabels: Record<LeadSource, string> = {
  instagram: "Instagram",
  wom: "WOM (Word of Mouth)",
  dekat_lewat: "Dekat / Lewat",
  google: "Google",
  dash: "-",
  facebook: "Facebook",
  old: "Old Customer",
  tiktok: "TikTok",
  tulis_sendiri: "Tulis Sendiri",
};

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
};

export const watchMovementLabels: Record<WatchMovement, string> = {
  automatic: "Automatic",
  quartz: "Quartz",
  mechanical: "Mechanical",
  smartwatch: "Smartwatch",
  other: "Other",
};

export const watchConditionLabels: Record<WatchCondition, string> = {
  new: "New",
  excellent: "Excellent",
  good: "Good",
  fair: "Fair",
  poor: "Poor",
};

// =====================================================
// HELPER FUNCTIONS
// =====================================================

export const formatRupiah = (nominal: number): string => {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(nominal);
};

export const formatDate = (
  date: string | Date,
  format: "full" | "date" | "time" = "full",
): string => {
  const d = new Date(date);

  if (format === "date") {
    return d.toLocaleDateString("id-ID", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  }

  if (format === "time") {
    return d.toLocaleTimeString("id-ID", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  return d.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export const getRelativeTime = (date: string | Date): string => {
  const now = new Date();
  const past = new Date(date);
  const diffMs = now.getTime() - past.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return "Baru saja";
  if (diffMins < 60) return `${diffMins} menit lalu`;
  if (diffHours < 24) return `${diffHours} jam lalu`;
  if (diffDays < 7) return `${diffDays} hari lalu`;
  return past.toLocaleDateString();
};

export const getStatusColor = (status: ServiceStatus): string => {
  const colors: Record<ServiceStatus, string> = {
    pending: "bg-yellow-100 text-yellow-700 border-yellow-200",
    assigned: "bg-blue-100 text-blue-700 border-blue-200",
    in_progress: "bg-purple-100 text-purple-700 border-purple-200",
    req_sparepart_admin: "bg-orange-100 text-orange-700 border-orange-200",
    po_pending: "bg-purple-100 text-purple-700 border-purple-200",
    sparepart_ready: "bg-green-100 text-green-700 border-green-200",
    qc_pending: "bg-indigo-100 text-indigo-700 border-indigo-200",
    revision_required: "bg-yellow-100 text-yellow-700 border-yellow-200",
    completed: "bg-green-100 text-green-700 border-green-200",
    done: "bg-slate-100 text-slate-700 border-slate-200",
    cancelled: "bg-red-100 text-red-700 border-red-200",
  };
  return colors[status];
};

// =====================================================
// DASHBOARD STATS TYPES
// =====================================================

export interface DashboardStats {
  totalUsers: number;
  totalServices: number;
  totalInventory: number;
  pendingServices: number;
  completedToday: number;
  pendingSparepart: number;
  revenue: number;
  revenueGrowth: number;
}

export interface TeknisiStats {
  completedToday: number;
  completedThisMonth: number;
  inProgress: number;
  pendingQueue: number;
  averageTime: number;
  rating: number;
  totalEarnings: number;
}

export interface ChartData {
  date: string;
  revenue: number;
  count: number;
}

export interface TopTeknisi {
  name: string;
  count: number;
  avatar?: string;
}
