import type { SupabaseClient } from "@supabase/supabase-js";
import { createApiError } from "./errors";

export interface TransitionResult {
  success: boolean;
  previousStatus: string;
  newStatus: string;
  affectedRows: number;
  service?: Record<string, unknown>;
}

/**
 * Atomic transition: updates service_orders.status AND inserts service_timeline
 * in a SINGLE PostgreSQL transaction via the technician_transition_service() RPC.
 *
 * If the timeline insert fails, the status update rolls back automatically.
 * Authorization (role + assignment) is enforced server-side inside the RPC.
 */
export async function transitionWithTimeline(
  supabase: SupabaseClient,
  serviceOrderId: string,
  expectedStatus: string | string[],
  newStatus: string,
  _teknisiId: string, // unused — RPC derives identity from auth.uid()
  timelineStatus: string,
  timelineMessage: string,
  additionalUpdates?: Record<string, unknown>,
  timelineDetails?: Record<string, unknown>
): Promise<TransitionResult> {
  // RPC expects a single expected status string; for multi-status transitions
  // (e.g. retract-qc: "qc_pending" | "revision_required"), we validate in the
  // endpoint first and pass the actual current status.
  const expectedStatusStr = Array.isArray(expectedStatus)
    ? expectedStatus[0]
    : expectedStatus;

  const { data, error } = await supabase.rpc("technician_transition_service", {
    p_service_order_id: serviceOrderId,
    p_expected_status: expectedStatusStr,
    p_new_status: newStatus,
    p_timeline_status: timelineStatus,
    p_timeline_message: timelineMessage,
    p_additional_updates: additionalUpdates || null,
    p_timeline_details: timelineDetails || null,
  });

  if (error) {
    // Map PostgreSQL exception codes to application error codes
    const msg = error.message || "";

    if (msg.includes("FORBIDDEN: only technicians")) {
      throw createApiError("FORBIDDEN", "Technician access required");
    }

    if (msg.includes("SERVICE_NOT_FOUND")) {
      throw createApiError("SERVICE_NOT_FOUND", "Service not found");
    }

    if (msg.includes("FORBIDDEN: you can only act on")) {
      throw createApiError(
        "NOT_ASSIGNED_TECHNICIAN",
        "You are not assigned to this service"
      );
    }

    if (msg.includes("INVALID_STATUS_TRANSITION")) {
      // Extract the current status from the error message if possible
      const currentMatch = msg.match(/current: (\w+)/);
      const currentStatus = currentMatch ? currentMatch[1] : "unknown";

      throw createApiError(
        "INVALID_STATUS_TRANSITION",
        `Cannot transition from status '${currentStatus}' to '${newStatus}'`,
        {
          currentStatus,
          expectedStatus: Array.isArray(expectedStatus)
            ? expectedStatus
            : [expectedStatus],
          attemptedStatus: newStatus,
        }
      );
    }

    if (msg.includes("concurrent modification")) {
      throw createApiError(
        "CONCURRENT_MODIFICATION",
        "Service was modified by another request. Please retry."
      );
    }

    // Default: internal error — never leak SQL details
    console.error("Transition RPC error:", error);
    throw createApiError("INTERNAL_ERROR", "Failed to update service status");
  }

  // RPC returns a jsonb object with the result
  const result = data as Record<string, unknown>;

  return {
    success: true,
    previousStatus: (result.previous_status as string) || expectedStatusStr,
    newStatus: (result.new_status as string) || newStatus,
    affectedRows: 1,
    service: {
      id: result.service_id,
      invoice_number: result.invoice_number,
      customer_name: result.customer_name,
    },
  };
}

/**
 * @deprecated Use transitionWithTimeline (atomic RPC) instead.
 * Kept only for backward compatibility with non-transition writes.
 */
export async function insertTimeline(
  supabase: SupabaseClient,
  serviceOrderId: string,
  teknisiId: string,
  status: string,
  message: string,
  details?: Record<string, unknown>
): Promise<void> {
  const { error } = await supabase.from("service_timeline").insert({
    service_order_id: serviceOrderId,
    teknisi_id: teknisiId,
    status,
    message,
    details: details || {},
  });

  if (error) {
    console.error("Timeline insert error:", error);
    throw createApiError("INTERNAL_ERROR", "Failed to create timeline entry");
  }
}
