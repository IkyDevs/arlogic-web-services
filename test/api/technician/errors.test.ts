import { describe, it, expect } from "vitest";
import { errorResponse, successResponse, createApiError } from "@/lib/api/technician/errors";

describe("errors", () => {
  describe("createApiError", () => {
    it("creates error with code and message", () => {
      const error = createApiError("UNAUTHENTICATED", "Not logged in");
      expect(error).toEqual({
        code: "UNAUTHENTICATED",
        message: "Not logged in",
      });
    });

    it("creates error with details", () => {
      const error = createApiError("VALIDATION_ERROR", "Invalid input", {
        field: "email",
        reason: "invalid format",
      });
      expect(error).toEqual({
        code: "VALIDATION_ERROR",
        message: "Invalid input",
        details: { field: "email", reason: "invalid format" },
      });
    });
  });

  describe("errorResponse", () => {
    it("returns 401 for UNAUTHENTICATED", async () => {
      const error = createApiError("UNAUTHENTICATED", "Not logged in");
      const response = errorResponse(error);
      expect(response.status).toBe(401);

      const body = await response.json();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("UNAUTHENTICATED");
    });

    it("returns 403 for FORBIDDEN", async () => {
      const error = createApiError("FORBIDDEN", "Access denied");
      const response = errorResponse(error);
      expect(response.status).toBe(403);
    });

    it("returns 404 for SERVICE_NOT_FOUND", async () => {
      const error = createApiError("SERVICE_NOT_FOUND", "Service not found");
      const response = errorResponse(error);
      expect(response.status).toBe(404);
    });

    it("returns 404 for ITEM_NOT_FOUND", async () => {
      const error = createApiError("ITEM_NOT_FOUND", "Item not found");
      const response = errorResponse(error);
      expect(response.status).toBe(404);
    });

    it("returns 409 for INVALID_STATUS_TRANSITION", async () => {
      const error = createApiError("INVALID_STATUS_TRANSITION", "Cannot transition");
      const response = errorResponse(error);
      expect(response.status).toBe(409);
    });

    it("returns 409 for CONCURRENT_MODIFICATION", async () => {
      const error = createApiError("CONCURRENT_MODIFICATION", "State changed");
      const response = errorResponse(error);
      expect(response.status).toBe(409);
    });

    it("returns 422 for VALIDATION_ERROR", async () => {
      const error = createApiError("VALIDATION_ERROR", "Invalid input");
      const response = errorResponse(error);
      expect(response.status).toBe(422);
    });

    it("returns 500 for INTERNAL_ERROR", async () => {
      const error = createApiError("INTERNAL_ERROR", "Server error");
      const response = errorResponse(error);
      expect(response.status).toBe(500);
    });

    it("allows custom status code", async () => {
      const error = createApiError("INTERNAL_ERROR", "Custom");
      const response = errorResponse(error, 503);
      expect(response.status).toBe(503);
    });
  });

  describe("successResponse", () => {
    it("returns 200 with data", async () => {
      const data = { id: "123", name: "Test" };
      const response = successResponse(data);
      expect(response.status).toBe(200);

      const body = await response.json();
      expect(body.success).toBe(true);
      expect(body.data).toEqual(data);
      expect(body.message).toBeUndefined();
    });

    it("returns 200 with data and message", async () => {
      const data = { id: "123" };
      const response = successResponse(data, "Created successfully");
      const body = await response.json();
      expect(body.success).toBe(true);
      expect(body.data).toEqual(data);
      expect(body.message).toBe("Created successfully");
    });

    it("handles null data", async () => {
      const response = successResponse(null);
      const body = await response.json();
      expect(body.success).toBe(true);
      expect(body.data).toBeNull();
    });
  });
});
