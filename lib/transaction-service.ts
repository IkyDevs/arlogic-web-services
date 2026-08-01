import { createClient } from "@/lib/supabase/client";
import type { MetodePembayaran, LeadSource } from "@/types";

// ─── Types ──────────────────────────────────────────────────────────────

export interface SKUItem {
  sku: string;
  nominal: number;
}

export interface TransactionServiceItem {
  jenis_layanan: string;
  skus: SKUItem[];
  notes: string;
}

export interface TransactionData {
  id?: string;
  customer_name: string;
  customer_whatsapp: string;
  items: TransactionServiceItem[];
  handled_by: string;
  handled_by_name: string;
  metode_pembayaran: string;
  lead_source: string;
  lead_source_custom?: string | null;
  status?: "active" | "completed" | "cancelled";
  photo_urls?: string[];
  photo_url?: string;
  notes?: string;
  created_by?: string;
  created_by_name?: string;
  split_payment?: boolean;
  metode_pembayaran_1?: string;
  nominal_1?: number;
  metode_pembayaran_2?: string;
  nominal_2?: number;
  telegram_chat_id?: string;
  telegram_message_id?: number;
  created_at?: string;
  updated_at?: string;
}

export interface TransactionAnalytics {
  total: number;
  totalRevenue: number;
  totalExpenses: number;
  netRevenue: number;
  active: number;
  completed: number;
  cancelled: number;
  jenisCount: Record<string, number>;
  metodeRevenue: Record<string, number>;
  metodeCount: Record<string, number>;
  staffStats: Record<string, { count: number; revenue: number }>;
}

// ─── Helpers ────────────────────────────────────────────────────────────

export function formatRupiah(n: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(n);
}

// ─── SKU Parsing ────────────────────────────────────────────────────────

export function parseSKUs(detailSku: string | null | undefined, nominal: number | null | undefined): SKUItem[] {
  if (!detailSku) {
    if (nominal) return [{ sku: "", nominal: nominal }];
    return [];
  }
  try {
    const parsed = JSON.parse(detailSku);
    if (Array.isArray(parsed)) return parsed as SKUItem[];
  } catch {}
  if (nominal) return [{ sku: detailSku, nominal: nominal }];
  return [{ sku: detailSku, nominal: 0 }];
}

export function serializeSKUs(skus: SKUItem[]): string {
  return JSON.stringify(skus);
}

// ─── Total Calculation ──────────────────────────────────────────────────

export function calculateItemSubtotal(skus: SKUItem[]): number {
  return skus.reduce((s, sku) => s + (sku.nominal || 0), 0);
}

export function calculateTransactionTotal(items: TransactionServiceItem[]): number {
  return items.reduce((s, item) => s + calculateItemSubtotal(item.skus), 0);
}

// ─── Analytics ──────────────────────────────────────────────────────────

export function computeAnalytics(data: TransactionData[]): TransactionAnalytics {
  let totalRevenue = 0, totalExpenses = 0;
  const jenisCount: Record<string, number> = {};
  const metodeRevenue: Record<string, number> = {};
  const metodeCount: Record<string, number> = {};
  const staffStats: Record<string, { count: number; revenue: number }> = {};
  let active = 0, completed = 0, cancelled = 0;

  for (const tx of data) {
    const allJenis = tx.items?.map((i) => i.jenis_layanan) || [tx["jenis_layanan" as keyof typeof tx] as string || "Lainnya"];
    const nominal = calculateTransactionTotal(tx.items || []);
    const isExpense = allJenis.includes("pengeluaran") || (tx as any).jenis_layanan === "pengeluaran";

    for (const j of allJenis) {
      jenisCount[j] = (jenisCount[j] || 0) + 1;
    }

    if (isExpense) totalExpenses += nominal;
    else totalRevenue += nominal;

    const m = tx.metode_pembayaran || "unknown";
    metodeRevenue[m] = (metodeRevenue[m] || 0) + (isExpense ? -nominal : nominal);
    metodeCount[m] = (metodeCount[m] || 0) + 1;

    const staff = tx.handled_by_name || "Unknown";
    if (!staffStats[staff]) staffStats[staff] = { count: 0, revenue: 0 };
    staffStats[staff].count++;
    if (!isExpense) staffStats[staff].revenue += nominal;

    if (tx.status === "active") active++;
    else if (tx.status === "completed") completed++;
    else if (tx.status === "cancelled") cancelled++;
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
    metodeRevenue,
    metodeCount,
    staffStats,
  };
}

// ─── Validation ─────────────────────────────────────────────────────────

export interface ValidationError {
  field: string;
  message: string;
}

export function validateTransaction(data: {
  customer_name: string;
  customer_whatsapp: string;
  items: TransactionServiceItem[];
  handled_by: string;
}): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!data.customer_name.trim()) {
    errors.push({ field: "customer_name", message: "Nama customer wajib diisi" });
  }
  if (!data.customer_whatsapp.trim()) {
    errors.push({ field: "customer_whatsapp", message: "Nomor WhatsApp wajib diisi" });
  }
  if (!data.handled_by) {
    errors.push({ field: "handled_by", message: "Pilih yang melayani" });
  }
  if (!data.items || data.items.length === 0) {
    errors.push({ field: "items", message: "Minimal 1 layanan wajib diisi" });
  }

  const seenJenis = new Set<string>();
  for (let i = 0; i < (data.items || []).length; i++) {
    const item = data.items[i];
    if (!item.jenis_layanan) {
      errors.push({ field: `items[${i}].jenis_layanan`, message: "Jenis layanan wajib dipilih" });
    }
    if (seenJenis.has(item.jenis_layanan)) {
      errors.push({ field: `items[${i}].jenis_layanan`, message: `Duplicate jenis layanan: ${item.jenis_layanan}` });
    }
    seenJenis.add(item.jenis_layanan);

    if (!item.skus || item.skus.length === 0) {
      errors.push({ field: `items[${i}].skus`, message: `Minimal 1 SKU untuk ${item.jenis_layanan}` });
    }
    for (let j = 0; j < (item.skus || []).length; j++) {
      const sku = item.skus[j];
      if (sku.nominal < 0) {
        errors.push({ field: `items[${i}].skus[${j}].nominal`, message: "Nominal tidak boleh negatif" });
      }
    }
  }

  return errors;
}

export function validateNoDuplicateJenis(items: TransactionServiceItem[]): boolean {
  const seen = new Set<string>();
  for (const item of items) {
    if (seen.has(item.jenis_layanan)) return false;
    seen.add(item.jenis_layanan);
  }
  return true;
}

function formatRupiahStatic(n: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(n);
}

// ─── Mapper (Legacy → New) ─────────────────────────────────────────────

export function mapLegacyTransaction(row: any): TransactionData {
  if (row.items) return row as TransactionData;

  const items: TransactionServiceItem[] = [];
  const hasItems = Array.isArray(row.layanan_items) && row.layanan_items.length > 0;
  const mainJenis = row.jenis_layanan || "service_langsung";

  if (hasItems) {
    for (const li of row.layanan_items) {
      if (!li.jenis_layanan) continue;
      const existing = items.find((i) => i.jenis_layanan === li.jenis_layanan);
      if (existing) {
        existing.skus.push(...parseSKUs(li.detail_sku, li.nominal));
      } else {
        items.push({
          jenis_layanan: li.jenis_layanan,
          skus: parseSKUs(li.detail_sku, li.nominal),
          notes: li.notes || "",
        });
      }
    }
  }

  if (items.length === 0) {
    const mainJenis = row.jenis_layanan || "service_langsung";
    items.push({
      jenis_layanan: mainJenis,
      skus: parseSKUs(row.detail_sku, row.nominal),
      notes: row.notes || "",
    });
  }

  const total = calculateTransactionTotal(items);

  return {
    id: row.id,
    customer_name: row.customer_name,
    customer_whatsapp: row.customer_whatsapp || "",
    items,
    handled_by: row.handled_by,
    handled_by_name: row.handled_by_name,
    metode_pembayaran: row.metode_pembayaran || "cash",
    lead_source: row.lead_source || "instagram",
    lead_source_custom: row.lead_source_custom,
    status: row.status || "active",
    photo_urls: row.photo_urls || (row.photo_url ? [row.photo_url] : []),
    photo_url: row.photo_url,
    notes: row.notes,
    created_by: row.created_by,
    created_by_name: row.created_by_name,
    split_payment: row.split_payment,
    metode_pembayaran_1: row.metode_pembayaran_1,
    nominal_1: row.nominal_1,
    metode_pembayaran_2: row.metode_pembayaran_2,
    nominal_2: row.nominal_2,
    telegram_chat_id: row.telegram_chat_id,
    telegram_message_id: row.telegram_message_id,
    created_at: row.created_at,
    updated_at: row.updated_at,
    ...(mainJenis === "pengeluaran" || mainJenis === "cashdraw"
      ? { jenis_layanan: mainJenis, nominal: row.nominal, detail_sku: row.detail_sku }
      : {}),
  };
}

// ─── CRUD ───────────────────────────────────────────────────────────────

function getSupabase() {
  return createClient();
}

export async function fetchAllTransactions(dateFilter?: string): Promise<TransactionData[]> {
  const supabase = getSupabase();
  let query = supabase.from("layanan").select("*, layanan_items(*)");
  if (dateFilter) {
    query = query
      .gte("created_at", dateFilter + "T00:00:00")
      .lte("created_at", dateFilter + "T23:59:59");
  }
  query = query.order("created_at", { ascending: false });
  if (!dateFilter) query = query.limit(200);

  const { data, error } = await query;
  if (error) throw error;

  return (data || []).map(mapLegacyTransaction);
}

export async function fetchTransactionById(id: string): Promise<TransactionData | null> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("layanan")
    .select("*, layanan_items(*)")
    .eq("id", id)
    .single();

  if (error) throw error;
  if (!data) return null;

  return mapLegacyTransaction(data);
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
  });
  if (errors.length > 0) {
    throw new Error(errors.map((e) => e.message).join("; "));
  }

  const total = calculateTransactionTotal(tx.items);
  const firstItem = tx.items[0];

  const supabase = getSupabase();
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
    })
    .select("id, created_at")
    .single();

  if (layananError) throw layananError;

  if (tx.items.length > 0 && newLayanan?.id) {
    const itemRows = tx.items.map((item) => ({
      layanan_id: newLayanan.id,
      jenis_layanan: item.jenis_layanan,
      detail_sku: serializeSKUs(item.skus),
      notes: item.notes || "",
      nominal: calculateItemSubtotal(item.skus),
    }));
    const { error: itemErr } = await supabase
      .from("layanan_items")
      .insert(itemRows);
    if (itemErr) console.error("Gagal simpan items:", itemErr);
  }

  return { ...tx, id: newLayanan.id, created_at: newLayanan.created_at };
}

export async function updateTransaction(
  id: string,
  tx: Partial<TransactionData>,
): Promise<void> {
  const supabase = getSupabase();

  const updatePayload: Record<string, unknown> = {};

  if (tx.customer_name !== undefined) updatePayload.customer_name = tx.customer_name.trim();
  if (tx.customer_whatsapp !== undefined) updatePayload.customer_whatsapp = tx.customer_whatsapp.trim();
  if (tx.handled_by !== undefined) updatePayload.handled_by = tx.handled_by;
  if (tx.handled_by_name !== undefined) updatePayload.handled_by_name = tx.handled_by_name;
  if (tx.metode_pembayaran !== undefined) updatePayload.metode_pembayaran = tx.metode_pembayaran;
  if (tx.lead_source !== undefined) updatePayload.lead_source = tx.lead_source;
  if (tx.lead_source_custom !== undefined) updatePayload.lead_source_custom = tx.lead_source_custom;
  if (tx.notes !== undefined) updatePayload.notes = tx.notes;
  if (tx.status !== undefined) updatePayload.status = tx.status;
  if (tx.photo_urls !== undefined) {
    updatePayload.photo_urls = tx.photo_urls;
    updatePayload.photo_url = tx.photo_urls[0] || null;
  }
  if (tx.split_payment !== undefined) updatePayload.split_payment = tx.split_payment;
  if (tx.metode_pembayaran_1 !== undefined) updatePayload.metode_pembayaran_1 = tx.metode_pembayaran_1;
  if (tx.nominal_1 !== undefined) updatePayload.nominal_1 = tx.nominal_1;
  if (tx.metode_pembayaran_2 !== undefined) updatePayload.metode_pembayaran_2 = tx.metode_pembayaran_2;
  if (tx.nominal_2 !== undefined) updatePayload.nominal_2 = tx.nominal_2;
  if (tx.telegram_chat_id !== undefined) updatePayload.telegram_chat_id = tx.telegram_chat_id;
  if (tx.telegram_message_id !== undefined) updatePayload.telegram_message_id = tx.telegram_message_id;

  if (tx.items !== undefined) {
    const total = calculateTransactionTotal(tx.items);
    const firstItem = tx.items[0];
    updatePayload.jenis_layanan = firstItem?.jenis_layanan || "service_langsung";
    updatePayload.detail_sku = firstItem?.skus?.[0]?.sku || null;
    updatePayload.nominal = total;

    const { error: updateError } = await supabase
      .from("layanan")
      .update(updatePayload)
      .eq("id", id);

    if (updateError) throw updateError;

    await supabase.from("layanan_items").delete().eq("layanan_id", id);

    if (tx.items.length > 0) {
      const itemRows = tx.items.map((item) => ({
        layanan_id: id,
        jenis_layanan: item.jenis_layanan,
        detail_sku: serializeSKUs(item.skus),
        notes: item.notes || "",
        nominal: calculateItemSubtotal(item.skus),
      }));
      const { error: itemErr } = await supabase.from("layanan_items").insert(itemRows);
      if (itemErr) console.error("Gagal simpan items:", itemErr);
    }
  } else {
    const { error: updateError } = await supabase
      .from("layanan")
      .update(updatePayload)
      .eq("id", id);
    if (updateError) throw updateError;
  }
}

export async function deleteTransaction(id: string): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase.from("layanan").delete().eq("id", id);
  if (error) throw error;
}

export async function updateTransactionStatus(
  id: string,
  status: "active" | "completed" | "cancelled",
): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase.from("layanan").update({ status }).eq("id", id);
  if (error) throw error;
}

// ─── Customer Management ────────────────────────────────────────────────

export async function syncCustomer(
  name: string,
  phone: string,
  branchId?: string | null,
): Promise<void> {
  const supabase = getSupabase();
  const custPhone = phone.replace(/\D/g, "");
  if (!name || !custPhone) return;

  const last4 = custPhone.slice(-4);
  const rawName = name.trim().replace(/^CS\s*/i, "");
  const baseName = rawName.endsWith(` ${last4}`) ? rawName : `${rawName} ${last4}`;
  const custName = baseName.startsWith("CS ") ? baseName : `CS ${baseName}`;

  const { data: existingCust } = await supabase
    .from("customers")
    .select("id")
    .eq("phone", custPhone)
    .eq("branch_id", branchId || "")
    .maybeSingle();

  if (existingCust) {
    await supabase
      .from("customers")
      .update({ last_transaction: new Date().toISOString(), branch_id: branchId || null })
      .eq("id", existingCust.id);
  } else {
    const { error: insertErr } = await supabase
      .from("customers")
      .insert({ name: custName, phone: custPhone, branch_id: branchId || null });
    if (!insertErr) {
      fetch("/api/telegram", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "customer",
          message: `CUSTOMER BARU \nnama cs: ${custName}\nno. wa: ${custPhone}`,
        }),
      }).catch(() => {});
    }
  }
}