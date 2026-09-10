import { NextResponse } from "next/server";
import { requireTechnician, AuthError } from "@/lib/api/technician/auth";
import { validateServiceOrderId, validateQcSubmission } from "@/lib/api/technician/validation";
import { errorResponse, successResponse, createApiError } from "@/lib/api/technician/errors";
import { transitionWithTimeline } from "@/lib/api/technician/transition";
import { rateLimitIP } from "@/lib/rate-limit";

export async function POST(request: Request) {
  const rl = rateLimitIP(request);
  if (!rl.allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  try {
    const { supabase, user } = await requireTechnician(request);

    const body = await request.json();
    const serviceOrderId = validateServiceOrderId(body.serviceOrderId);
    const qcData = validateQcSubmission(body);

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

    if (service.status !== "in_progress") {
      return errorResponse(
        createApiError(
          "INVALID_STATUS_TRANSITION",
          `Cannot submit for QC when service status is '${service.status}'`,
          { currentStatus: service.status, expectedStatus: "in_progress" }
        ),
        409
      );
    }

    const { data: items, error: itemsError } = await supabase
      .from("service_items")
      .select("id")
      .eq("service_order_id", serviceOrderId)
      .limit(1);

    if (itemsError) {
      console.error("Items check error:", itemsError);
      return errorResponse(
        createApiError("INTERNAL_ERROR", "Failed to check service items"),
        500
      );
    }

    if (!items || items.length === 0) {
      return errorResponse(
        createApiError(
          "VALIDATION_ERROR",
          "Cannot submit service for QC without any items"
        ),
        422
      );
    }

    const result = await transitionWithTimeline(
      supabase,
      serviceOrderId,
      "in_progress",
      "qc_pending",
      user.id,
      "qc_pending",
      "Service disubmit untuk QC",
      {
        qc_submit_notes: qcData.notes || null,
      },
      {
        action: "submit_qc",
        notes: qcData.notes,
      }
    );

    return successResponse(
      {
        serviceOrderId,
        previousStatus: result.previousStatus,
        newStatus: result.newStatus,
      },
      "Service berhasil disubmit untuk QC"
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

    console.error("Submit QC error:", error);
    return errorResponse(
      createApiError("INTERNAL_ERROR", "Internal server error"),
      500
    );
  }
}
