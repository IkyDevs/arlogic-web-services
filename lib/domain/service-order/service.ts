import { createClient } from "@/lib/supabase/client"
import { getSupabaseAdmin } from "@/lib/supabase/admin"
import type {
  ServiceOrder,
  ServiceItem,
  ServiceTimeline,
  ServiceStatus,
  FinalServiceSnapshot,
} from "./types"
import { validateServiceItem } from "../shared/validation"

// ─── Service Item CRUD (Single Source of Truth) ────────────────────
export async function fetchServiceItems(serviceOrderId: string, finalOnly = false): Promise<ServiceItem[]> {
  const supabase = createClient()
  let query = supabase.from("service_items").select("*").eq("service_order_id", serviceOrderId)
  if (finalOnly) query = query.eq("is_final", true)
  const { data, error } = await query.order("created_at", { ascending: true })
  if (error) throw error
  return (data || []) as ServiceItem[]
}

export async function fetchFinalServiceItems(serviceOrderId: string): Promise<ServiceItem[]> {
  return fetchServiceItems(serviceOrderId, true)
}

export async function addServiceItem(
  serviceOrderId: string,
  item: {
    item_type: "jasa" | "sparepart"
    name: string
    quantity: number
    price: number
  },
  userId: string,
  teknisiName?: string,
): Promise<ServiceItem> {
  const errors = validateServiceItem(item)
  if (errors.length > 0) throw new Error(errors.map((e) => e.message).join("; "))

  const supabase = createClient()
  const { data, error } = await supabase
    .from("service_items")
    .insert({
      service_order_id: serviceOrderId,
      item_type: item.item_type,
      name: item.name,
      quantity: item.quantity,
      price: item.price,
      is_final: false,
    })
    .select()
    .single()

  if (error) throw error

  // Add to timeline WITHOUT nominal
  const itemTypeLabel = item.item_type === "jasa" ? "Jasa" : "Sparepart"
  await supabase.from("service_timeline").insert({
    service_order_id: serviceOrderId,
    teknisi_id: userId,
    status: "item_added",
    message: `Tambah ${itemTypeLabel}\n${item.name}`,
    details: { action: "add_item", item_type: item.item_type, item_id: data?.id },
  })

  return data as ServiceItem
}

export async function updateServiceItem(
  itemId: string,
  updates: Partial<Pick<ServiceItem, "name" | "quantity" | "price">>,
  userId: string,
): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase.from("service_items").update(updates).eq("id", itemId)
  if (error) throw error

  // Log to timeline WITHOUT nominal
  if (updates.price || updates.quantity) {
    await supabase.from("service_timeline").insert({
      service_order_id: (await supabase.from("service_items").select("service_order_id").eq("id", itemId).single()).data
        ?.service_order_id,
      teknisi_id: userId,
      status: "item_updated",
      message: `Item diupdate`,
      details: { action: "update_item", item_id: itemId },
    })
  }
}

export async function deleteServiceItem(itemId: string, userId: string): Promise<string> {
  const supabase = createClient()
  const { data: item } = await supabase.from("service_items").select("service_order_id, name").eq("id", itemId).single()
  if (!item) throw new Error("Item not found")

  const { error } = await supabase.from("service_items").delete().eq("id", itemId)
  if (error) throw error

  await supabase.from("service_timeline").insert({
    service_order_id: item.service_order_id,
    teknisi_id: userId,
    status: "item_deleted",
    message: `Item dihapus`,
    details: { action: "delete_item", item_id: itemId, name: item.name },
  })

  return item.service_order_id
}

export async function updateServiceItemPrice(itemId: string, price: number, userId: string): Promise<void> {
  return updateServiceItem(itemId, { price }, userId)
}

// ─── Finalize Service Items (QC Approve) ──────────────────────────
export async function finalizeServiceItems(serviceOrderId: string): Promise<FinalServiceSnapshot> {
  const supabase = createClient()

  const { data: existingItems } = await supabase
    .from("service_items")
    .select("*")
    .eq("service_order_id", serviceOrderId)
    .eq("is_final", true)

  if (existingItems && existingItems.length > 0) {
    await supabase.from("service_items").update({ is_final: false }).eq("service_order_id", serviceOrderId).eq("is_final", true)
  }

  const { data: items, error: fetchError } = await supabase
    .from("service_items")
    .select("*")
    .eq("service_order_id", serviceOrderId)
    .eq("is_final", false)

  if (fetchError) throw fetchError
  if (!items || items.length === 0) throw new Error("Tidak ada item untuk difinalisasi")

  const itemIds = items.map((i) => i.id)
  const { error: updateError } = await supabase
    .from("service_items")
    .update({ is_final: true })
    .in("id", itemIds)

  if (updateError) throw updateError

  const jasaItems = items.filter((i) => i.item_type === "jasa")
  const sparepartItems = items.filter((i) => i.item_type === "sparepart")
  const totalJasa = jasaItems.reduce((s, i) => s + i.price * i.quantity, 0)
  const totalSparepart = sparepartItems.reduce((s, i) => s + i.price * i.quantity, 0)
  const grandTotal = totalJasa + totalSparepart

  await supabase
    .from("service_orders")
    .update({
      final_sparepart_total: totalSparepart,
      final_jasa_total: totalJasa,
    })
    .eq("id", serviceOrderId)

  return {
    service_order_id: serviceOrderId,
    items: items as ServiceItem[],
    total_jasa: totalJasa,
    total_sparepart: totalSparepart,
    grand_total: grandTotal,
    timestamp: new Date().toISOString(),
  }
}

// ─── QC Approve ────────────────────────────────────────────────────
export async function qcApprove(
  serviceOrderId: string,
  reviewerId: string,
  notes?: string,
  totalCost?: number,
  discount?: number,
): Promise<void> {
  const supabase = createClient()

  const updatedData: Record<string, unknown> = {
    status: "completed",
  }

  if (totalCost !== undefined) updatedData.final_cost = totalCost
  if (discount !== undefined) {
    updatedData.discount = discount
    updatedData.discount_percentage = 0
  }

  const { error: updateError } = await supabase.from("service_orders").update(updatedData).eq("id", serviceOrderId)
  if (updateError) throw updateError

  await supabase.from("qc_reviews").insert({
    service_order_id: serviceOrderId,
    reviewer_id: reviewerId,
    status: "approved",
    notes: notes || null,
  })

  await finalizeServiceItems(serviceOrderId)

  await supabase.from("service_timeline").insert({
    service_order_id: serviceOrderId,
    teknisi_id: reviewerId,
    status: "completed",
    message: "QC Approve — Service selesai dan siap diambil",
    details: { action: "qc_approve", reviewer_id: reviewerId },
  })
}

// ─── QC Reject ─────────────────────────────────────────────────────
export async function qcReject(
  serviceOrderId: string,
  reviewerId: string,
  notes: string,
): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase.from("service_orders").update({ status: "revision_required" }).eq("id", serviceOrderId)
  if (error) throw error

  await supabase.from("qc_reviews").insert({
    service_order_id: serviceOrderId,
    reviewer_id: reviewerId,
    status: "rejected",
    notes,
  })

  await supabase.from("service_timeline").insert({
    service_order_id: serviceOrderId,
    teknisi_id: reviewerId,
    status: "revision_required",
    message: `QC Reject — ${notes}`,
    details: { action: "qc_reject", reviewer_id: reviewerId, reason: notes },
  })
}

// ─── QC Recall ─────────────────────────────────────────────────────
export async function qcRecall(
  serviceOrderId: string,
  qcId: string,
  reason: string,
): Promise<void> {
  const supabase = createClient()

  const { data: service } = await supabase
    .from("service_orders")
    .select("status")
    .eq("id", serviceOrderId)
    .single()

  if (!service || service.status !== "completed") {
    throw new Error("Service harus dalam status completed untuk di-recall")
  }

  const { error: recallError } = await supabase.from("qc_recalls").insert({
    service_order_id: serviceOrderId,
    qc_id: qcId,
    reason,
  })
  if (recallError) throw recallError

  await supabase
    .from("service_orders")
    .update({
      status: "revision_required",
      qc_recalled: true,
      qc_recalled_at: new Date().toISOString(),
      qc_recall_reason: reason,
    })
    .eq("id", serviceOrderId)

  await supabase.from("service_timeline").insert({
    service_order_id: serviceOrderId,
    teknisi_id: qcId,
    status: "qc_recalled",
    message: `QC Recall — ${reason}`,
    details: {
      action: "qc_recall",
      qc_id: qcId,
      reason,
      timestamp: new Date().toISOString(),
    },
  })
}

// ─── Teknisi Recall (before QC approve) ────────────────────────────
export async function teknisiRecall(serviceOrderId: string, teknisiId: string): Promise<void> {
  const supabase = createClient()

  const { data: service } = await supabase
    .from("service_orders")
    .select("status")
    .eq("id", serviceOrderId)
    .single()

  if (!service || service.status !== "qc_pending") {
    throw new Error("Service harus dalam status qc_pending untuk ditarik kembali")
  }

  await supabase.from("service_orders").update({ status: "in_progress" }).eq("id", serviceOrderId)

  await supabase.from("service_timeline").insert({
    service_order_id: serviceOrderId,
    teknisi_id: teknisiId,
    status: "in_progress",
    message: "Service ditarik kembali oleh teknisi untuk revisi",
    details: { action: "teknisi_recall" },
  })
}

// ─── Fetch Timeline (without nominal for customer-facing) ──────────
export async function fetchTimeline(serviceOrderId: string): Promise<ServiceTimeline[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("service_timeline")
    .select("*")
    .eq("service_order_id", serviceOrderId)
    .order("created_at", { ascending: true })
  if (error) throw error
  return (data || []) as ServiceTimeline[]
}

// ─── Fetch Service Order ───────────────────────────────────────────
export async function fetchServiceOrder(id: string): Promise<ServiceOrder | null> {
  const supabase = createClient()
  const { data, error } = await supabase.from("service_orders").select("*").eq("id", id).single()
  if (error) throw error
  return data as ServiceOrder
}

// ─── Compute Payment Totals ────────────────────────────────────────
export function computePaymentTotals(
  items: ServiceItem[],
  downPayment: number,
  discount: number,
): {
  totalJasa: number
  totalSparepart: number
  grandTotal: number
  remaining: number
  isLunas: boolean
} {
  const totalJasa = items.filter((i) => i.item_type === "jasa").reduce((s, i) => s + i.price * i.quantity, 0)
  const totalSparepart = items.filter((i) => i.item_type === "sparepart").reduce((s, i) => s + i.price * i.quantity, 0)
  const grandTotal = totalJasa + totalSparepart
  const remaining = grandTotal - downPayment - discount
  return {
    totalJasa,
    totalSparepart,
    grandTotal,
    remaining,
    isLunas: remaining <= 0,
  }
}