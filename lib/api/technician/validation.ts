import { createApiError } from "./errors";

export function validateServiceOrderId(id: unknown): string {
  if (typeof id !== "string" || id.length === 0) {
    throw createApiError("VALIDATION_ERROR", "serviceOrderId is required");
  }

  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(id)) {
    throw createApiError("VALIDATION_ERROR", "serviceOrderId must be a valid UUID");
  }

  return id;
}

export function validateItemId(id: unknown): string {
  if (typeof id !== "string" || id.length === 0) {
    throw createApiError("VALIDATION_ERROR", "itemId is required");
  }

  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(id)) {
    throw createApiError("VALIDATION_ERROR", "itemId must be a valid UUID");
  }

  return id;
}

export interface ItemPayload {
  item_type: "jasa" | "sparepart";
  name: string;
  quantity: number;
  price: number;
}

export function validateItemPayload(item: unknown): ItemPayload {
  if (!item || typeof item !== "object") {
    throw createApiError("VALIDATION_ERROR", "Item payload is required");
  }

  const payload = item as Record<string, unknown>;

  if (!payload.item_type || !["jasa", "sparepart"].includes(payload.item_type as string)) {
    throw createApiError("VALIDATION_ERROR", "item_type must be 'jasa' or 'sparepart'");
  }

  if (!payload.name || typeof payload.name !== "string" || payload.name.trim().length === 0) {
    throw createApiError("VALIDATION_ERROR", "name is required and must be non-empty");
  }

  if (typeof payload.quantity !== "number" || payload.quantity < 1 || !Number.isInteger(payload.quantity)) {
    throw createApiError("VALIDATION_ERROR", "quantity must be a positive integer");
  }

  if (typeof payload.price !== "number" || payload.price < 0) {
    throw createApiError("VALIDATION_ERROR", "price must be a non-negative number");
  }

  return {
    item_type: payload.item_type as "jasa" | "sparepart",
    name: payload.name.trim(),
    quantity: payload.quantity,
    price: payload.price,
  };
}

export interface UpdateItemPayload {
  name?: string;
  quantity?: number;
  price?: number;
}

export function validateUpdateItemPayload(payload: unknown): UpdateItemPayload {
  if (!payload || typeof payload !== "object") {
    throw createApiError("VALIDATION_ERROR", "Update payload is required");
  }

  const data = payload as Record<string, unknown>;
  const result: UpdateItemPayload = {};

  if (data.name !== undefined) {
    if (typeof data.name !== "string" || data.name.trim().length === 0) {
      throw createApiError("VALIDATION_ERROR", "name must be a non-empty string");
    }
    result.name = data.name.trim();
  }

  if (data.quantity !== undefined) {
    if (typeof data.quantity !== "number" || data.quantity < 1 || !Number.isInteger(data.quantity)) {
      throw createApiError("VALIDATION_ERROR", "quantity must be a positive integer");
    }
    result.quantity = data.quantity;
  }

  if (data.price !== undefined) {
    if (typeof data.price !== "number" || data.price < 0) {
      throw createApiError("VALIDATION_ERROR", "price must be a non-negative number");
    }
    result.price = data.price;
  }

  if (Object.keys(result).length === 0) {
    throw createApiError("VALIDATION_ERROR", "At least one field must be provided for update");
  }

  return result;
}

export interface SparepartRequestPayload {
  sparepart: string;
  notes?: string;
}

export function validateSparepartRequest(payload: unknown): SparepartRequestPayload {
  if (!payload || typeof payload !== "object") {
    throw createApiError("VALIDATION_ERROR", "Sparepart request payload is required");
  }

  const data = payload as Record<string, unknown>;

  if (!data.sparepart || typeof data.sparepart !== "string" || data.sparepart.trim().length === 0) {
    throw createApiError("VALIDATION_ERROR", "sparepart is required and must be non-empty");
  }

  return {
    sparepart: data.sparepart.trim(),
    notes: typeof data.notes === "string" ? data.notes.trim() : undefined,
  };
}

export interface QcSubmissionPayload {
  notes?: string;
}

export function validateQcSubmission(payload: unknown): QcSubmissionPayload {
  if (!payload || typeof payload !== "object") {
    return {};
  }

  const data = payload as Record<string, unknown>;

  return {
    notes: typeof data.notes === "string" ? data.notes.trim() : undefined,
  };
}
