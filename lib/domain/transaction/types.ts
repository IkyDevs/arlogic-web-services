import type { JenisLayanan, MetodePembayaran, LeadSource } from "./enums"

// ─── SKU Item ──────────────────────────────────────────────────────
export interface SKUItem {
  sku: string
  nominal: number
}

// ─── Transaction Service Item ──────────────────────────────────────
export interface TransactionServiceItem {
  jenis_layanan: JenisLayanan
  skus: SKUItem[]
  notes: string
}

// ─── Transaction (Layanan) ─────────────────────────────────────────
export interface TransactionData {
  id?: string
  customer_name: string
  customer_whatsapp: string
  items: TransactionServiceItem[]
  handled_by: string
  handled_by_name: string
  metode_pembayaran: MetodePembayaran
  lead_source: LeadSource
  lead_source_custom?: string | null
  status: "active" | "completed" | "cancelled"
  photo_urls: string[]
  photo_url?: string
  notes?: string
  created_by?: string
  created_by_name?: string
  split_payment: boolean
  metode_pembayaran_1?: MetodePembayaran
  nominal_1: number
  metode_pembayaran_2?: MetodePembayaran
  nominal_2: number
  telegram_chat_id?: string
  telegram_message_id?: number
  created_at?: string
  updated_at?: string
}

// ─── Transaction Analytics ─────────────────────────────────────────
export interface TransactionAnalytics {
  total: number
  totalRevenue: number
  totalExpenses: number
  netRevenue: number
  active: number
  completed: number
  cancelled: number
  jenisCount: Record<string, number>
  metodeRevenue: Record<string, number>
  metodeCount: Record<string, number>
  staffStats: Record<string, { count: number; revenue: number }>
}

// ─── Split Payment ─────────────────────────────────────────────────
export interface SplitPayment {
  enabled: boolean
  metode_1: MetodePembayaran
  nominal_1: number
  metode_2?: MetodePembayaran
  nominal_2: number
}

// ─── Payment Status ────────────────────────────────────────────────
export type PaymentStatus = "lunas" | "belum_lunas"

// ─── Legacy Layanan Row (from DB) ──────────────────────────────────
export interface LegacyLayananRow {
  id: string
  customer_name: string
  customer_whatsapp?: string
  jenis_layanan: string
  handled_by: string
  handled_by_name: string
  metode_pembayaran: string
  lead_source: string
  lead_source_custom?: string
  detail_sku?: string
  nominal: number
  notes?: string
  photo_url?: string
  photo_urls?: string[]
  created_by: string
  created_by_name: string
  status: string
  split_payment?: boolean
  metode_pembayaran_1?: string
  nominal_1?: number
  metode_pembayaran_2?: string
  nominal_2?: number
  telegram_chat_id?: string
  telegram_message_id?: number
  created_at: string
  updated_at?: string
  layanan_items?: LegacyLayananItemRow[]
}

export interface LegacyLayananItemRow {
  id: string
  layanan_id: string
  jenis_layanan: string
  detail_sku?: string
  notes?: string
  nominal: number
  created_at: string
}