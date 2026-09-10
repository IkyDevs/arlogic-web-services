import { NextResponse } from "next/server";
import { requireTechnician, AuthError } from "@/lib/api/technician/auth";
import { validateServiceOrderId, validateItemPayload } from "@/lib/api/technician/validation";
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
    const serviceOrderId = validateServiceOrderId(body.serviceOrderId);
    const itemData = validateItemPayload(body);

    const { data: service, error: fetchError } = await supabase
      .from("service_orders")
      .select("id, status, assigned_teknisi_id")
      .eq("id", serviceOrderId)
      .single();

    if (fetchError || !service) {
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
          `Cannot add items when service status is '${service.status}'`,
          { currentStatus: service.status, allowedStatuses: ALLOWED_STATUSES }
        ),
        409
      );
    }

    const { data: item, error: insertError } = await supabase
      .from("service_items")
      .insert({
        service_order_id: serviceOrderId,
        item_type: itemData.item_type,
        name: itemData.name,
        quantity: itemData.quantity,
        price: itemData.price,
        is_final: false,
      })
      .select()
      .single();

    if (insertError) {
      console.error("Item insert error:", insertError);
      return errorResponse(
        createApiError("INTERNAL_ERROR", "Failed to add item"),
        500
      );
    }

    const itemTypeLabel = itemData.item_type === "jasa" ? "Jasa" : "Sparepart";
    await insertTimeline(
      supabase,
      serviceOrderId,
      user.id,
      "item_added",
      `Tambah ${itemTypeLabel}\n${itemData.name}`,
      { action: "add_item", item_type: itemData.item_type, item_id: item.id }
    );

    return successResponse(
      {
        item: {
          id: item.id,
          itemType: item.item_type,
          name: item.name,
          quantity: item.quantity,
          price: item.price,
        },
      },
      "Item berhasil ditambahkan"
    );
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

    console.error("Add item error:", error);
    return errorResponse(
      createApiError("INTERNAL_ERROR", "Internal server error"),
      500
    );
  }
}
