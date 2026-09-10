import { NextResponse } from "next/server";
import { requireTechnician, AuthError } from "@/lib/api/technician/auth";
import { validateServiceOrderId } from "@/lib/api/technician/validation";
import { errorResponse, successResponse, createApiError } from "@/lib/api/technician/errors";
import { transitionWithTimeline } from "@/lib/api/technician/transition";
import { rateLimitIP } from "@/lib/rate-limit";

export async function POST(request: Request) {
  const rl = rateLimitIP(request);
  if (!rl.allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  try {
    const { supabase, user, profile } = await requireTechnician(request);

    const body = await request.json();
    const serviceOrderId = validateServiceOrderId(body.serviceOrderId);

    const { data: service, error: fetchError } = await supabase
      .from("service_orders")
      .select("id, status, assigned_teknisi_id, invoice_number, customer_name")
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
          "You are not assigned to this service",
          { assignedTo: service.assigned_teknisi_id }
        ),
        403
      );
    }

    if (service.status !== "assigned") {
      return errorResponse(
        createApiError(
          "INVALID_STATUS_TRANSITION",
          `Cannot start service from status '${service.status}'`,
          { currentStatus: service.status, expectedStatus: "assigned" }
        ),
        409
      );
    }

    const result = await transitionWithTimeline(
      supabase,
      serviceOrderId,
      "assigned",
      "in_progress",
      user.id,
      "in_progress",
      "Service dimulai oleh teknisi",
      { start_date: new Date().toISOString() },
      { action: "start_service" }
    );

    return successResponse(
      {
        serviceOrderId,
        previousStatus: result.previousStatus,
        newStatus: result.newStatus,
      },
      "Service berhasil dimulai"
    );
  } catch (error) {
    if (error instanceof AuthError) {
      return errorResponse(
        createApiError(error.code as any, error.message),
        error.code === "UNAUTHENTICATED" ? 401 : 403
      );
    }

    console.error("Start service error:", error);
    return errorResponse(
      createApiError("INTERNAL_ERROR", "Internal server error"),
      500
    );
  }
}
