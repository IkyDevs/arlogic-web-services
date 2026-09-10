import type { SupabaseClient } from "@supabase/supabase-js";
import { createApiError } from "./errors";

export interface TransitionResult {
  success: boolean;
  previousStatus: string;
  newStatus: string;
  affectedRows: number;
  service?: Record<string, unknown>;
}

export async function transitionServiceStatus(
  supabase: SupabaseClient,
  serviceOrderId: string,
  expectedStatus: string | string[],
  newStatus: string,
  additionalUpdates?: Record<string, unknown>
): Promise<TransitionResult> {
  const statusArray = Array.isArray(expectedStatus) ? expectedStatus : [expectedStatus];

  const updateData: Record<string, unknown> = {
    status: newStatus,
    updated_at: new Date().toISOString(),
  };

  if (additionalUpdates) {
    Object.assign(updateData, additionalUpdates);
  }

  const { data, error, count } = await supabase
    .from("service_orders")
    .update(updateData)
    .eq("id", serviceOrderId)
    .in("status", statusArray)
    .select("id, status, assigned_teknisi_id, invoice_number, customer_name")
    .single();

  if (error) {
    console.error("Transition update error:", error);
    throw createApiError("INTERNAL_ERROR", "Failed to update service status");
  }

  if (!data) {
    const { data: currentService } = await supabase
      .from("service_orders")
      .select("status")
      .eq("id", serviceOrderId)
      .single();

    if (!currentService) {
      throw createApiError("SERVICE_NOT_FOUND", "Service not found");
    }

    throw createApiError(
      "INVALID_STATUS_TRANSITION",
      `Cannot transition from status '${currentService.status}' to '${newStatus}'`,
      {
        currentStatus: currentService.status,
        expectedStatus: statusArray,
        attemptedStatus: newStatus,
      }
    );
  }

  const previousStatus = statusArray.find((s) => s !== newStatus) || statusArray[0];

  return {
    success: true,
    previousStatus,
    newStatus,
    affectedRows: 1,
    service: data,
  };
}

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

export async function transitionWithTimeline(
  supabase: SupabaseClient,
  serviceOrderId: string,
  expectedStatus: string | string[],
  newStatus: string,
  teknisiId: string,
  timelineStatus: string,
  timelineMessage: string,
  additionalUpdates?: Record<string, unknown>,
  timelineDetails?: Record<string, unknown>
): Promise<TransitionResult> {
  const transitionResult = await transitionServiceStatus(
    supabase,
    serviceOrderId,
    expectedStatus,
    newStatus,
    additionalUpdates
  );

  await insertTimeline(
    supabase,
    serviceOrderId,
    teknisiId,
    timelineStatus,
    timelineMessage,
    timelineDetails
  );

  return transitionResult;
}
