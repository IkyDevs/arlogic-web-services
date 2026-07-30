import { createClient } from "@/lib/supabase/client"
import type {
  TransactionData,
  TransactionServiceItem,
  SKUItem,
  TransactionAnalytics,
  PaymentStatus,
  LegacyLayananRow,
  SplitPayment,
  UploadStatus,
} from "./types"
import type { JenisLayanan, MetodePembayaran, LeadSource } from "./enums"
import { validateTransaction } from "../shared/validation"
import type { ValidationError } from "../shared/validation"

// ─── SKU Parsing ───────────────────────────────────────────────────
export function parseSKUs(detailSku: string | null | undefined, nominal: number | null | undefined): SKUItem[] {
  if (!detailSku) {
    if (nominal) return [{ sku: "", nominal }]
    return []
  }
  try {
    const parsed = JSON.parse(detailSku)
    if (Array.isArray(parsed)) return parsed as SKUItem[]
  } catch {}
  if (nominal) return [{ sku: detailSku, nominal }]
  return [{ sku: detailSku, nominal: 0 }]
}

export function serializeSKUs(skus: SKUItem[]): string {
  return JSON.stringify(skus)
}

// ─── Total Calculation ─────────────────────────────────────────────
export function calculateItemSubtotal(skus: SKUItem[]): number {
  return skus.reduce((s, sku) => s + (sku.nominal || 0), 0)
}

export function calculateTransactionTotal(items: TransactionServiceItem[]): number {
  return items.reduce((s, item) => s + calculateItemSubtotal(item.skus), 0)
}

export function calculateRemaining(total: number, downPayment: number, discount: number): number {
  return total - downPayment - discount
}

export function getPaymentStatus(remaining: number): PaymentStatus {
  return remaining <= 0 ? "lunas" : "belum_lunas"
}

// ─── Mapper (Legacy → New) ────────────────────────────────────────
export function mapLegacyTransaction(row: LegacyLayananRow): TransactionData {
  if ((row as any).items) return row as unknown as TransactionData

  const items: TransactionServiceItem[] = []

  if (Array.isArray(row.layanan_items) && row.layanan_items.length > 0) {
    for (const li of row.layanan_items) {
      if (!li.jenis_layanan) continue
      const existing = items.find((i) => i.jenis_layanan === li.jenis_layanan)
      const skus = parseSKUs(li.detail_sku, li.nominal)
      if (existing) {
        existing.skus.push(...skus)
      } else {
        items.push({
          jenis_layanan: li.jenis_layanan as JenisLayanan,
          skus,
          notes: li.notes || "",
        })
      }
    }
  }

  if (items.length === 0) {
    const mainJenis = (row.jenis_layanan || "service_langsung") as JenisLayanan
    items.push({
      jenis_layanan: mainJenis,
      skus: parseSKUs(row.detail_sku, row.nominal),
      notes: row.notes || "",
    })
  }

  return {
    id: row.id,
    customer_name: row.customer_name,
    customer_whatsapp: row.customer_whatsapp || "",
    items,
    handled_by: row.handled_by,
    handled_by_name: row.handled_by_name,
    metode_pembayaran: (row.metode_pembayaran || "cash") as MetodePembayaran,
    lead_source: (row.lead_source || "instagram") as LeadSource,
    lead_source_custom: row.lead_source_custom,
    status: (row.status || "active") as TransactionData["status"],
    photo_urls: row.photo_urls || (row.photo_url ? [row.photo_url] : []),
    photo_url: row.photo_url,
    notes: row.notes,
    created_by: row.created_by,
    created_by_name: row.created_by_name,
    split_payment: row.split_payment || false,
    metode_pembayaran_1: row.metode_pembayaran_1 as MetodePembayaran | undefined,
    nominal_1: row.nominal_1 || 0,
    metode_pembayaran_2: row.metode_pembayaran_2 as MetodePembayaran | undefined,
    nominal_2: row.nominal_2 || 0,
    telegram_chat_id: row.telegram_chat_id,
    telegram_message_id: row.telegram_message_id,
    telegram_file_id: row.telegram_file_id,
    upload_status: (row.upload_status || 'NONE') as UploadStatus,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
}

// ─── Analytics ─────────────────────────────────────────────────────
export function computeAnalytics(data: TransactionData[]): TransactionAnalytics {
  let totalRevenue = 0, totalExpenses = 0
  const jenisCount: Record<string, number> = {}
  const jenisRevenue: Record<string, number> = {}
  const metodeRevenue: Record<string, number> = {}
  const metodeCount: Record<string, number> = {}
  const staffStats: Record<string, { count: number; revenue: number }> = {}
  let active = 0, completed = 0, cancelled = 0

  for (const tx of data) {
    const items = tx.items || []
    const allJenis = items.map((i) => i.jenis_layanan) || []
    const nominal = items.length > 0 ? calculateTransactionTotal(items) : ((tx as any).nominal || 0)
    const isExpense = items.length > 0 ? allJenis.includes("pengeluaran") : (tx as any).jenis_layanan === "pengeluaran"

    // Per-jenis: count transactions + sum revenue per jenis
    if (items.length > 0) {
      for (const item of items) {
        const j = item.jenis_layanan
        jenisCount[j] = (jenisCount[j] || 0) + 1
        const itemNominal = calculateItemSubtotal(item.skus || [])
        jenisRevenue[j] = (jenisRevenue[j] || 0) + itemNominal
      }
    } else if ((tx as any).jenis_layanan) {
      // Fallback: flat data (no items[]), use single jenis_layanan + nominal
      const j = (tx as any).jenis_layanan
      jenisCount[j] = (jenisCount[j] || 0) + 1
      jenisRevenue[j] = (jenisRevenue[j] || 0) + ((tx as any).nominal || 0)
    }

    if (isExpense) totalExpenses += nominal
    else totalRevenue += nominal

    // Split payment: track each method separately
    if (tx.split_payment && tx.metode_pembayaran_1 && tx.metode_pembayaran_2) {
      const n1 = tx.nominal_1 || 0
      const n2 = tx.nominal_2 || 0
      metodeRevenue[tx.metode_pembayaran_1] = (metodeRevenue[tx.metode_pembayaran_1] || 0) + (isExpense ? -n1 : n1)
      metodeRevenue[tx.metode_pembayaran_2] = (metodeRevenue[tx.metode_pembayaran_2] || 0) + (isExpense ? -n2 : n2)
      metodeCount[tx.metode_pembayaran_1] = (metodeCount[tx.metode_pembayaran_1] || 0) + 1
      metodeCount[tx.metode_pembayaran_2] = (metodeCount[tx.metode_pembayaran_2] || 0) + 1
    } else {
      const m = tx.metode_pembayaran || "unknown"
      metodeRevenue[m] = (metodeRevenue[m] || 0) + (isExpense ? -nominal : nominal)
      metodeCount[m] = (metodeCount[m] || 0) + 1
    }

    const staff = tx.handled_by_name || "Unknown"
    if (!staffStats[staff]) staffStats[staff] = { count: 0, revenue: 0 }
    staffStats[staff].count++
    if (!isExpense) staffStats[staff].revenue += nominal

    if (tx.status === "active") active++
    else if (tx.status === "completed") completed++
    else if (tx.status === "cancelled") cancelled++
  }

  return {
    total: data.length,
    totalRevenue,
    totalExpenses,
    netRevenue: totalRevenue - totalExpenses,
    active,
    completed,
    cancelled,
    jenisCount,
    jenisRevenue,
    metodeRevenue,
    metodeCount,
    staffStats,
  }
}

// ─── CRUD ──────────────────────────────────────────────────────────
function getSupabase() {
  return createClient()
}

export async function fetchAllTransactions(dateFilter?: string): Promise<TransactionData[]> {
  const supabase = getSupabase()
  let query = supabase.from("layanan").select("*, layanan_items(*)")
  if (dateFilter) {
    query = query
      .gte("created_at", `${dateFilter}T00:00:00`)
      .lte("created_at", `${dateFilter}T23:59:59`)
  }
  query = query.order("created_at", { ascending: false })
  if (!dateFilter) query = query.limit(200)

  const { data, error } = await query
  if (error) throw error
  return (data || []).map(mapLegacyTransaction)
}

export async function fetchTransactionById(id: string): Promise<TransactionData | null> {
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from("layanan")
    .select("*, layanan_items(*)")
    .eq("id", id)
    .single()
  if (error) throw error
  if (!data) return null
  return mapLegacyTransaction(data)
}

export async function createTransaction(
  tx: TransactionData,
  userId: string,
  userName: string,
): Promise<TransactionData> {
  const errors = validateTransaction({
    customer_name: tx.customer_name,
    customer_whatsapp: tx.customer_whatsapp,
    items: tx.items,
    handled_by: tx.handled_by,
  })
  if (errors.length > 0) {
    throw new ValidationAggregate(errors)
  }

  const total = calculateTransactionTotal(tx.items)
  const firstItem = tx.items[0]

  const supabase = getSupabase()
  const { data: newLayanan, error: layananError } = await supabase
    .from("layanan")
    .insert({
      customer_name: tx.customer_name.trim(),
      customer_whatsapp: tx.customer_whatsapp.trim(),
      jenis_layanan: firstItem?.jenis_layanan || "service_langsung",
      handled_by: tx.handled_by,
      handled_by_name: tx.handled_by_name,
      metode_pembayaran: tx.metode_pembayaran,
      lead_source: tx.lead_source,
      lead_source_custom: tx.lead_source === "tulis_sendiri" ? tx.lead_source_custom : null,
      detail_sku: firstItem?.skus?.[0]?.sku || null,
      nominal: total,
      notes: tx.notes || null,
      photo_url: tx.photo_urls?.[0] || null,
      photo_urls: tx.photo_urls || [],
      telegram_chat_id: tx.telegram_chat_id,
      telegram_message_id: tx.telegram_message_id,
      created_by: userId,
      created_by_name: userName,
      status: "active",
      split_payment: tx.split_payment || false,
      metode_pembayaran_1: tx.metode_pembayaran_1,
      nominal_1: tx.nominal_1,
      metode_pembayaran_2: tx.metode_pembayaran_2,
      nominal_2: tx.nominal_2,
      upload_status: tx.upload_status || 'NONE',
    })
    .select("id, created_at")
    .single()

  if (layananError) throw layananError

  if (tx.items.length > 0 && newLayanan?.id) {
    const itemRows = tx.items.map((item) => ({
      layanan_id: newLayanan.id,
      jenis_layanan: item.jenis_layanan,
      detail_sku: serializeSKUs(item.skus),
      notes: item.notes || "",
      nominal: calculateItemSubtotal(item.skus),
    }))
    const { error: itemErr } = await supabase.from("layanan_items").insert(itemRows)
    if (itemErr) console.error("Gagal simpan items:", itemErr)
  }

  return { ...tx, id: newLayanan.id, created_at: newLayanan.created_at }
}

export async function updateTransaction(
  id: string,
  tx: Partial<TransactionData>,
): Promise<void> {
  const supabase = getSupabase()
  const updatePayload: Record<string, unknown> = {}

  if (tx.customer_name !== undefined) updatePayload.customer_name = tx.customer_name.trim()
  if (tx.customer_whatsapp !== undefined) updatePayload.customer_whatsapp = tx.customer_whatsapp.trim()
  if (tx.handled_by !== undefined) updatePayload.handled_by = tx.handled_by
  if (tx.handled_by_name !== undefined) updatePayload.handled_by_name = tx.handled_by_name
  if (tx.metode_pembayaran !== undefined) updatePayload.metode_pembayaran = tx.metode_pembayaran
  if (tx.lead_source !== undefined) updatePayload.lead_source = tx.lead_source
  if (tx.lead_source_custom !== undefined) updatePayload.lead_source_custom = tx.lead_source_custom
  if (tx.notes !== undefined) updatePayload.notes = tx.notes
  if (tx.status !== undefined) updatePayload.status = tx.status
  if (tx.photo_urls !== undefined) {
    updatePayload.photo_urls = tx.photo_urls
    updatePayload.photo_url = tx.photo_urls[0] || null
  }
  if (tx.split_payment !== undefined) updatePayload.split_payment = tx.split_payment
  if (tx.metode_pembayaran_1 !== undefined) updatePayload.metode_pembayaran_1 = tx.metode_pembayaran_1
  if (tx.nominal_1 !== undefined) updatePayload.nominal_1 = tx.nominal_1
  if (tx.metode_pembayaran_2 !== undefined) updatePayload.metode_pembayaran_2 = tx.metode_pembayaran_2
  if (tx.nominal_2 !== undefined) updatePayload.nominal_2 = tx.nominal_2
  if (tx.upload_status !== undefined) updatePayload.upload_status = tx.upload_status
  if (tx.telegram_file_id !== undefined) updatePayload.telegram_file_id = tx.telegram_file_id

  if (tx.items !== undefined) {
    const total = calculateTransactionTotal(tx.items)
    const firstItem = tx.items[0]
    updatePayload.jenis_layanan = firstItem?.jenis_layanan || "service_langsung"
    updatePayload.detail_sku = firstItem?.skus?.[0]?.sku || null
    updatePayload.nominal = total

    const { error: updateError } = await supabase.from("layanan").update(updatePayload).eq("id", id)
    if (updateError) throw updateError

    await supabase.from("layanan_items").delete().eq("layanan_id", id)

    if (tx.items.length > 0) {
      const itemRows = tx.items.map((item) => ({
        layanan_id: id,
        jenis_layanan: item.jenis_layanan,
        detail_sku: serializeSKUs(item.skus),
        notes: item.notes || "",
        nominal: calculateItemSubtotal(item.skus),
      }))
      const { error: itemErr } = await supabase.from("layanan_items").insert(itemRows)
      if (itemErr) console.error("Gagal simpan items:", itemErr)
    }
  } else {
    const { error: updateError } = await supabase.from("layanan").update(updatePayload).eq("id", id)
    if (updateError) throw updateError
  }
}

export async function deleteTransaction(id: string): Promise<void> {
  const supabase = getSupabase()
  const { error } = await supabase.from("layanan").delete().eq("id", id)
  if (error) throw error
}

export async function updateTransactionStatus(
  id: string,
  status: TransactionData["status"],
): Promise<void> {
  const supabase = getSupabase()
  const { error } = await supabase.from("layanan").update({ status }).eq("id", id)
  if (error) throw error
}

// ─── Customer Sync ─────────────────────────────────────────────────
export async function syncCustomer(name: string, phone: string): Promise<void> {
  const supabase = getSupabase()
  const custPhone = phone.replace(/\D/g, "")
  if (!name || !custPhone) return

  const last4 = custPhone.slice(-4)
  const rawName = name.trim().replace(/^CS\s*/i, "")
  const baseName = rawName.endsWith(` ${last4}`) ? rawName : `${rawName} ${last4}`
  const custName = baseName.startsWith("CS ") ? baseName : `CS ${baseName}`

  const { data: existingCust } = await supabase
    .from("customers")
    .select("id")
    .eq("phone", custPhone)
    .maybeSingle()

  if (existingCust) {
    await supabase
      .from("customers")
      .update({ last_transaction: new Date().toISOString() })
      .eq("id", existingCust.id)
  } else {
    await supabase.from("customers").insert({ name: custName, phone: custPhone })
  }
}

// ─── Validation Aggregate Error ────────────────────────────────────
export class ValidationAggregate extends Error {
  errors: ValidationError[]
  constructor(errors: ValidationError[]) {
    super(errors.map((e) => e.message).join("; "))
    this.name = "ValidationAggregate"
    this.errors = errors
  }
}