import { describe, it, expect, vi, beforeEach } from "vitest";
import { validateServiceOrderId, validateItemId, validateItemPayload, validateUpdateItemPayload, validateSparepartRequest, validateQcSubmission } from "@/lib/api/technician/validation";

describe("validation", () => {
  describe("validateServiceOrderId", () => {
    it("returns valid UUID", () => {
      const uuid = "123e4567-e89b-12d3-a456-426614174000";
      expect(validateServiceOrderId(uuid)).toBe(uuid);
    });

    it("throws for empty string", () => {
      expect(() => validateServiceOrderId("")).toThrow("serviceOrderId is required");
    });

    it("throws for non-string", () => {
      expect(() => validateServiceOrderId(123)).toThrow("serviceOrderId is required");
    });

    it("throws for invalid UUID format", () => {
      expect(() => validateServiceOrderId("not-a-uuid")).toThrow("serviceOrderId must be a valid UUID");
    });
  });

  describe("validateItemId", () => {
    it("returns valid UUID", () => {
      const uuid = "123e4567-e89b-12d3-a456-426614174000";
      expect(validateItemId(uuid)).toBe(uuid);
    });

    it("throws for empty string", () => {
      expect(() => validateItemId("")).toThrow("itemId is required");
    });
  });

  describe("validateItemPayload", () => {
    it("returns valid jasa item", () => {
      const payload = {
        item_type: "jasa",
        name: "Service Jam",
        quantity: 1,
        price: 50000,
      };
      expect(validateItemPayload(payload)).toEqual(payload);
    });

    it("returns valid sparepart item", () => {
      const payload = {
        item_type: "sparepart",
        name: "Baterai",
        quantity: 2,
        price: 25000,
      };
      expect(validateItemPayload(payload)).toEqual(payload);
    });

    it("trims whitespace from name", () => {
      const payload = {
        item_type: "jasa",
        name: "  Service Jam  ",
        quantity: 1,
        price: 50000,
      };
      expect(validateItemPayload(payload).name).toBe("Service Jam");
    });

    it("throws for invalid item_type", () => {
      expect(() =>
        validateItemPayload({
          item_type: "invalid",
          name: "Test",
          quantity: 1,
          price: 50000,
        })
      ).toThrow("item_type must be 'jasa' or 'sparepart'");
    });

    it("throws for empty name", () => {
      expect(() =>
        validateItemPayload({
          item_type: "jasa",
          name: "",
          quantity: 1,
          price: 50000,
        })
      ).toThrow("name is required and must be non-empty");
    });

    it("throws for zero quantity", () => {
      expect(() =>
        validateItemPayload({
          item_type: "jasa",
          name: "Test",
          quantity: 0,
          price: 50000,
        })
      ).toThrow("quantity must be a positive integer");
    });

    it("throws for negative price", () => {
      expect(() =>
        validateItemPayload({
          item_type: "jasa",
          name: "Test",
          quantity: 1,
          price: -1000,
        })
      ).toThrow("price must be a non-negative number");
    });

    it("allows zero price", () => {
      const payload = {
        item_type: "jasa",
        name: "Test",
        quantity: 1,
        price: 0,
      };
      expect(validateItemPayload(payload)).toEqual(payload);
    });
  });

  describe("validateUpdateItemPayload", () => {
    it("returns valid update with name only", () => {
      const payload = { name: "Updated Name" };
      expect(validateUpdateItemPayload(payload)).toEqual({ name: "Updated Name" });
    });

    it("returns valid update with quantity only", () => {
      const payload = { quantity: 5 };
      expect(validateUpdateItemPayload(payload)).toEqual({ quantity: 5 });
    });

    it("returns valid update with price only", () => {
      const payload = { price: 75000 };
      expect(validateUpdateItemPayload(payload)).toEqual({ price: 75000 });
    });

    it("returns valid update with multiple fields", () => {
      const payload = { name: "Updated", quantity: 3, price: 100000 };
      expect(validateUpdateItemPayload(payload)).toEqual(payload);
    });

    it("throws for empty payload", () => {
      expect(() => validateUpdateItemPayload({})).toThrow("At least one field must be provided for update");
    });

    it("throws for invalid quantity", () => {
      expect(() => validateUpdateItemPayload({ quantity: 0 })).toThrow("quantity must be a positive integer");
    });
  });

  describe("validateSparepartRequest", () => {
    it("returns valid sparepart request", () => {
      const payload = { sparepart: "Baterai CR2032", notes: "Urgent" };
      expect(validateSparepartRequest(payload)).toEqual(payload);
    });

    it("returns valid request without notes", () => {
      const payload = { sparepart: "Baterai CR2032" };
      expect(validateSparepartRequest(payload)).toEqual({ sparepart: "Baterai CR2032" });
    });

    it("trims whitespace", () => {
      const payload = { sparepart: "  Baterai  ", notes: "  Notes  " };
      expect(validateSparepartRequest(payload)).toEqual({
        sparepart: "Baterai",
        notes: "Notes",
      });
    });

    it("throws for empty sparepart", () => {
      expect(() => validateSparepartRequest({ sparepart: "" })).toThrow("sparepart is required and must be non-empty");
    });
  });

  describe("validateQcSubmission", () => {
    it("returns empty object for no payload", () => {
      expect(validateQcSubmission(undefined)).toEqual({});
      expect(validateQcSubmission(null)).toEqual({});
    });

    it("returns notes if provided", () => {
      const payload = { notes: "Service sudah selesai" };
      expect(validateQcSubmission(payload)).toEqual({ notes: "Service sudah selesai" });
    });

    it("trims notes whitespace", () => {
      const payload = { notes: "  Notes  " };
      expect(validateQcSubmission(payload)).toEqual({ notes: "Notes" });
    });
  });
});
