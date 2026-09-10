import { NextResponse } from "next/server";

export type ErrorCode =
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "SERVICE_NOT_FOUND"
  | "ITEM_NOT_FOUND"
  | "INVALID_STATUS_TRANSITION"
  | "NOT_ASSIGNED_TECHNICIAN"
  | "VALIDATION_ERROR"
  | "CONCURRENT_MODIFICATION"
  | "INTERNAL_ERROR";

export interface ApiError {
  code: ErrorCode;
  message: string;
  details?: Record<string, unknown>;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  message?: string;
  data?: T;
  error?: ApiError;
}

const ERROR_STATUS_MAP: Record<ErrorCode, number> = {
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  SERVICE_NOT_FOUND: 404,
  ITEM_NOT_FOUND: 404,
  INVALID_STATUS_TRANSITION: 409,
  NOT_ASSIGNED_TECHNICIAN: 403,
  VALIDATION_ERROR: 422,
  CONCURRENT_MODIFICATION: 409,
  INTERNAL_ERROR: 500,
};

export function errorResponse(error: ApiError, status?: number): NextResponse {
  const httpStatus = status || ERROR_STATUS_MAP[error.code] || 500;
  return NextResponse.json(
    { success: false, error },
    { status: httpStatus }
  );
}

export function successResponse<T>(data: T, message?: string): NextResponse {
  const response: ApiResponse<T> = {
    success: true,
    data,
  };
  if (message) {
    response.message = message;
  }
  return NextResponse.json(response);
}

export function createApiError(
  code: ErrorCode,
  message: string,
  details?: Record<string, unknown>
): ApiError {
  return { code, message, details };
}
