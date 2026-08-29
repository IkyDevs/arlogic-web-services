import type { SupabaseClient } from "@supabase/supabase-js";
import { mapDatabaseError } from "./errors";

// ─── Stock Transfer Domain Service ─────────────────────────────────
// T003: Transfer lifecycle management.
// All physical mutations go through T002 Movement Engine.

export type TransferStatus = "DRAFT" | "PENDING" | "APPROVED" | "REJECTED";

export interface StockTransfer {
  id: string;
  status: TransferStatus;
  source_location_id: string;
  dest_location_id: string;
  notes: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  submitted_at: string | null;
  submitted_by: string | null;
  resolved_at: string | null;
  resolved_by: string | null;
  reject_reason: string | null;
}

export interface StockTransferItem {
  id: string;
  transfer_id: string;
  stock_item_id: string;
  requested_quantity: number;
}

export interface StockTransferWithItems extends StockTransfer {
  items: StockTransferItem[];
  source_location_name?: string;
  dest_location_name?: string;
}

export interface CreateTransferParams {
  source_location_id: string;
  dest_location_id: string;
  notes?: string;
  items: Array<{
    stock_item_id: string;
    requested_quantity: number;
  }>;
}

export interface UpdateTransferParams {
  notes?: string;
  items?: Array<{
    id?: string; // existing item ID for updates
    stock_item_id: string;
    requested_quantity: number;
  }>;
}

// ─── CRUD Operations ───────────────────────────────────────────────

/**
 * Create a new DRAFT transfer.
 */
export async function createTransfer(
  supabase: SupabaseClient,
  params: CreateTransferParams,
): Promise<StockTransfer> {
  // Validate source != destination
  if (params.source_location_id === params.dest_location_id) {
    throw new Error("INVALID_LOCATION: source dan destination tidak boleh sama");
  }

  // Validate has items
  if (!params.items || params.items.length === 0) {
    throw new Error("EMPTY_TRANSFER: transfer harus memiliki minimal 1 item");
  }

  // Validate quantities
  for (const item of params.items) {
    if (item.requested_quantity <= 0) {
      throw new Error("INVALID_QUANTITY: quantity harus positif");
    }
  }

  // Create transfer
  const { data: transfer, error: transferError } = await supabase
    .from("stock_transfers")
    .insert({
      source_location_id: params.source_location_id,
      dest_location_id: params.dest_location_id,
      notes: params.notes || null,
    })
    .select()
    .single();

  if (transferError) throw mapDatabaseError(transferError);

  // Create items
  const items = params.items.map((item) => ({
    transfer_id: transfer.id,
    stock_item_id: item.stock_item_id,
    requested_quantity: item.requested_quantity,
  }));

  const { error: itemsError } = await supabase
    .from("stock_transfer_items")
    .insert(items);

  if (itemsError) throw mapDatabaseError(itemsError);

  // Create audit trail
  const { error: historyError } = await supabase
    .from("stock_transfer_history")
    .insert({
      transfer_id: transfer.id,
      action: "CREATED",
    });

  if (historyError) throw mapDatabaseError(historyError);

  return transfer;
}

/**
 * Update a DRAFT transfer (items and notes).
 */
export async function updateTransfer(
  supabase: SupabaseClient,
  transferId: string,
  params: UpdateTransferParams,
): Promise<StockTransfer> {
  // Get current transfer
  const { data: current, error: fetchError } = await supabase
    .from("stock_transfers")
    .select("status")
    .eq("id", transferId)
    .single();

  if (fetchError) throw mapDatabaseError(fetchError);

  if (current.status !== "DRAFT") {
    throw new Error("INVALID_TRANSITION: hanya DRAFT yang dapat diedit");
  }

  // Update notes if provided
  if (params.notes !== undefined) {
    const { error } = await supabase
      .from("stock_transfers")
      .update({ notes: params.notes, updated_at: new Date().toISOString() })
      .eq("id", transferId);

    if (error) throw mapDatabaseError(error);
  }

  // Update items if provided
  if (params.items !== undefined) {
    // Delete existing items
    const { error: deleteError } = await supabase
      .from("stock_transfer_items")
      .delete()
      .eq("transfer_id", transferId);

    if (deleteError) throw mapDatabaseError(deleteError);

    // Insert new items
    const items = params.items.map((item) => ({
      transfer_id: transferId,
      stock_item_id: item.stock_item_id,
      requested_quantity: item.requested_quantity,
    }));

    const { error: insertError } = await supabase
      .from("stock_transfer_items")
      .insert(items);

    if (insertError) throw mapDatabaseError(insertError);
  }

  // Return updated transfer
  const { data: updated, error: returnError } = await supabase
    .from("stock_transfers")
    .select()
    .eq("id", transferId)
    .single();

  if (returnError) throw mapDatabaseError(returnError);

  return updated;
}

/**
 * Get transfer with items.
 */
export async function getTransfer(
  supabase: SupabaseClient,
  transferId: string,
): Promise<StockTransferWithItems> {
  const { data: transfer, error: transferError } = await supabase
    .from("stock_transfers")
    .select("*, source_location:branches!stock_transfers_source_location_id_fkey(name), dest_location:branches!stock_transfers_dest_location_id_fkey(name)")
    .eq("id", transferId)
    .single();

  if (transferError) throw mapDatabaseError(transferError);

  const { data: items, error: itemsError } = await supabase
    .from("stock_transfer_items")
    .select("*")
    .eq("transfer_id", transferId);

  if (itemsError) throw mapDatabaseError(itemsError);

  return {
    ...transfer,
    items: items || [],
    source_location_name: transfer.source_location?.name,
    dest_location_name: transfer.dest_location?.name,
  };
}

/**
 * List transfers with optional filters.
 */
export async function listTransfers(
  supabase: SupabaseClient,
  filters?: {
    status?: TransferStatus;
    source_location_id?: string;
    dest_location_id?: string;
    created_by?: string;
    limit?: number;
    offset?: number;
  },
): Promise<StockTransferWithItems[]> {
  let query = supabase
    .from("stock_transfers")
    .select("*, source_location:branches!stock_transfers_source_location_id_fkey(name), dest_location:branches!stock_transfers_dest_location_id_fkey(name)")
    .order("created_at", { ascending: false });

  if (filters?.status) {
    query = query.eq("status", filters.status);
  }
  if (filters?.source_location_id) {
    query = query.eq("source_location_id", filters.source_location_id);
  }
  if (filters?.dest_location_id) {
    query = query.eq("dest_location_id", filters.dest_location_id);
  }
  if (filters?.created_by) {
    query = query.eq("created_by", filters.created_by);
  }

  const limit = filters?.limit ?? 50;
  const offset = filters?.offset ?? 0;
  query = query.range(offset, offset + limit - 1);

  const { data: transfers, error } = await query;

  if (error) throw mapDatabaseError(error);

  // Fetch items for each transfer
  const result: StockTransferWithItems[] = [];
  for (const transfer of transfers || []) {
    const { data: items } = await supabase
      .from("stock_transfer_items")
      .select("*")
      .eq("transfer_id", transfer.id);

    result.push({
      ...transfer,
      items: items || [],
      source_location_name: transfer.source_location?.name,
      dest_location_name: transfer.dest_location?.name,
    });
  }

  return result;
}

// ─── Lifecycle Operations ───────────────────────────────────────────

/**
 * Submit a DRAFT transfer → PENDING.
 * Reserves source stock for all items.
 */
export async function submitTransfer(
  supabase: SupabaseClient,
  transferId: string,
): Promise<void> {
  const { error } = await supabase.rpc("submit_stock_transfer", {
    p_transfer_id: transferId,
  });

  if (error) throw mapDatabaseError(error);
}

/**
 * Approve a PENDING transfer → APPROVED.
 * Executes atomic transfer via T002.
 */
export async function approveTransfer(
  supabase: SupabaseClient,
  transferId: string,
  notes?: string,
): Promise<void> {
  const { error } = await supabase.rpc("approve_stock_transfer", {
    p_transfer_id: transferId,
    p_notes: notes || null,
  });

  if (error) throw mapDatabaseError(error);
}

/**
 * Reject a PENDING transfer → REJECTED.
 * Releases reservations for all items.
 */
export async function rejectTransfer(
  supabase: SupabaseClient,
  transferId: string,
  reason: string,
): Promise<void> {
  if (!reason || reason.trim() === "") {
    throw new Error("REJECT_REASON_REQUIRED: alasan reject wajib diisi");
  }

  const { error } = await supabase.rpc("reject_stock_transfer", {
    p_transfer_id: transferId,
    p_reason: reason,
  });

  if (error) throw mapDatabaseError(error);
}
