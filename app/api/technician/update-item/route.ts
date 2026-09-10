import { NextResponse } from "next/server";
import { requireTechnician, AuthError } from "@/lib/api/technician/auth";
import { validateItemId, validateUpdateItemPayload } from "@/lib/api/technician/validation";
import { errorResponse, successResponse, createApiError } from "@/lib/api/technician/errors";
import { insertTimeline } from "@/lib/api/technician/transition";
import { rateLimitIP } from "@/lib/rate-limit";

const ALLOWED_STATUSES = ["in_progress", "revision_required"];

export async function POST(request: Request) {
  const rl = rateLimitIP(request);
  if (!rl.allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  try {
    const { supabase, user } = await requireTechnician(request);

    const body = await request.json();
    const itemId = validateItemId(body.itemId);
    const updates = validateUpdateItemPayload(body);

    const { data: item, error: fetchItemError } = await supabase
      .from("service_items")
      .select("id, service_order_id, name, quantity, price, is_final")
      .eq("id", itemId)
      .single();

    if (fetchItemError || !item) {
      return errorResponse(
        createApiError("ITEM_NOT_FOUND", "Item not found"),
        404
      );
    }

    const { data: service, error: fetchServiceError } = await supabase
      .from("service_orders")
      .select("id, status, assigned_teknisi_id")
      .eq("id", item.service_order_id)
      .single();

    if (fetchServiceError || !service) {
      return errorResponse(
        createApiError("SERVICE_NOT_FOUND", "Service not found"),
        404
      );
    }

    if (service.assigned_teknisi_id !== user.id) {
      return errorResponse(
        createApiError(
          "NOT_ASSIGNED_TECHNICIAN",
          "You are not assigned to this service"
        ),
        403
      );
    }

    if (!ALLOWED_STATUSES.includes(service.status)) {
      return errorResponse(
        createApiError(
          "INVALID_STATUS_TRANSITION",
          `Cannot update items when service status is '${service.status}'`,
          { currentStatus: service.status, allowedStatuses: ALLOWED_STATUSES }
        ),
        409
      );
    }

    if (item.is_final) {
      return errorResponse(
        createApiError(
          "VALIDATION_ERROR",
          "Cannot update finalized items"
        ),
        422
      );
    }

    const priceChanged = updates.price !== undefined && updates.price !== item.price;
    const quantityChanged = updates.quantity !== undefined && updates.quantity !== item.quantity;

    const { error: updateError } = await supabase
      .from("service_items")
      .update(updates)
      .eq("id", itemId);

    if (updateError) {
      console.error("Item update error:", updateError);
      return errorResponse(
        createApiError("INTERNAL_ERROR", "Failed to update item"),
        500
      );
    }

    if (priceChanged || quantityChanged) {
      await insertTimeline(
        supabase,
        item.service_order_id,
        user.id,
        "item_updated",
        "Item diupdate",
        { action: "update_item", item_id: itemId }
      );
    }

    return successResponse(null, "Item berhasil diupdate");
  } catch (error) {
    if (error instanceof AuthError) {
      return errorResponse(
        createApiError(error.code as any, error.message),
        error.code === "UNAUTHENTICATED" ? 401 : 403
      );
    }

    if (error && typeof error === "object" && "code" in error) {
      return errorResponse(error as any);
    }

    console.error("Update item error:", error);
    return errorResponse(
      createApiError("INTERNAL_ERROR", "Internal server error"),
      500
    );
  }
}
