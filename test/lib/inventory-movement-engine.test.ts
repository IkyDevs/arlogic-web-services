import { describe, expect, it } from "vitest";
import {
  InventoryError,
  InsufficientStockError,
  InsufficientAvailableError,
  BalanceNotFoundError,
  ForbiddenError,
  ForbiddenBranchError,
  DuplicateMovementError,
  InvalidQuantityError,
  InvalidDeltaError,
  InvalidItemError,
  InvalidLocationError,
  InvalidReferenceError,
  TransferSameLocationError,
  mapDatabaseError,
} from "@/lib/domain/inventory/errors";

describe("Inventory Error Classes", () => {
  it("InventoryError has correct code and message", () => {
    const err = new InventoryError("TEST_CODE", "test message");
    expect(err.code).toBe("TEST_CODE");
    expect(err.message).toBe("test message");
    expect(err.name).toBe("InventoryError");
    expect(err).toBeInstanceOf(Error);
  });

  it("InsufficientStockError has correct defaults", () => {
    const err = new InsufficientStockError();
    expect(err.code).toBe("INSUFFICIENT_STOCK");
    expect(err.name).toBe("InsufficientStockError");
  });

  it("InsufficientAvailableError has correct defaults", () => {
    const err = new InsufficientAvailableError();
    expect(err.code).toBe("INSUFFICIENT_AVAILABLE");
    expect(err.name).toBe("InsufficientAvailableError");
  });

  it("BalanceNotFoundError has correct defaults", () => {
    const err = new BalanceNotFoundError();
    expect(err.code).toBe("BALANCE_NOT_FOUND");
    expect(err.name).toBe("BalanceNotFoundError");
  });

  it("ForbiddenError has correct defaults", () => {
    const err = new ForbiddenError();
    expect(err.code).toBe("FORBIDDEN");
    expect(err.name).toBe("ForbiddenError");
  });

  it("ForbiddenBranchError has correct defaults", () => {
    const err = new ForbiddenBranchError();
    expect(err.code).toBe("FORBIDDEN_BRANCH");
    expect(err.name).toBe("ForbiddenBranchError");
  });

  it("DuplicateMovementError has correct defaults", () => {
    const err = new DuplicateMovementError();
    expect(err.code).toBe("DUPLICATE_MOVEMENT");
    expect(err.name).toBe("DuplicateMovementError");
  });

  it("InvalidQuantityError has correct defaults", () => {
    const err = new InvalidQuantityError();
    expect(err.code).toBe("INVALID_QUANTITY");
    expect(err.name).toBe("InvalidQuantityError");
  });

  it("InvalidDeltaError has correct defaults", () => {
    const err = new InvalidDeltaError();
    expect(err.code).toBe("INVALID_DELTA");
    expect(err.name).toBe("InvalidDeltaError");
  });

  it("InvalidItemError has correct defaults", () => {
    const err = new InvalidItemError();
    expect(err.code).toBe("INVALID_ITEM");
    expect(err.name).toBe("InvalidItemError");
  });

  it("InvalidLocationError has correct defaults", () => {
    const err = new InvalidLocationError();
    expect(err.code).toBe("INVALID_LOCATION");
    expect(err.name).toBe("InvalidLocationError");
  });

  it("InvalidReferenceError has correct defaults", () => {
    const err = new InvalidReferenceError();
    expect(err.code).toBe("INVALID_REFERENCE");
    expect(err.name).toBe("InvalidReferenceError");
  });

  it("TransferSameLocationError has correct defaults", () => {
    const err = new TransferSameLocationError();
    expect(err.code).toBe("TRANSFER_SAME_LOCATION");
    expect(err.name).toBe("TransferSameLocationError");
  });
});

describe("mapDatabaseError", () => {
  it("maps INSUFFICIENT_STOCK error", () => {
    const err = mapDatabaseError(new Error("INSUFFICIENT_STOCK: stok tidak cukup"));
    expect(err).toBeInstanceOf(InsufficientStockError);
    expect(err.code).toBe("INSUFFICIENT_STOCK");
  });

  it("maps INSUFFICIENT_AVAILABLE error", () => {
    const err = mapDatabaseError(new Error("INSUFFICIENT_AVAILABLE: stok tersedia tidak cukup"));
    expect(err).toBeInstanceOf(InsufficientAvailableError);
    expect(err.code).toBe("INSUFFICIENT_AVAILABLE");
  });

  it("maps BALANCE_NOT_FOUND error", () => {
    const err = mapDatabaseError(new Error("BALANCE_NOT_FOUND: balance tidak ditemukan"));
    expect(err).toBeInstanceOf(BalanceNotFoundError);
    expect(err.code).toBe("BALANCE_NOT_FOUND");
  });

  it("maps FORBIDDEN error", () => {
    const err = mapDatabaseError(new Error("FORBIDDEN: tidak berwenang"));
    expect(err).toBeInstanceOf(ForbiddenError);
    expect(err.code).toBe("FORBIDDEN");
  });

  it("maps FORBIDDEN_BRANCH error", () => {
    const err = mapDatabaseError(new Error("FORBIDDEN_BRANCH: tidak berwenang cabang"));
    expect(err).toBeInstanceOf(ForbiddenBranchError);
    expect(err.code).toBe("FORBIDDEN_BRANCH");
  });

  it("maps DUPLICATE_MOVEMENT error", () => {
    const err = mapDatabaseError(new Error("DUPLICATE_MOVEMENT: operasi sudah dilakukan"));
    expect(err).toBeInstanceOf(DuplicateMovementError);
    expect(err.code).toBe("DUPLICATE_MOVEMENT");
  });

  it("maps INVALID_QUANTITY error", () => {
    const err = mapDatabaseError(new Error("INVALID_QUANTITY: harus positif"));
    expect(err).toBeInstanceOf(InvalidQuantityError);
    expect(err.code).toBe("INVALID_QUANTITY");
  });

  it("maps INVALID_DELTA error", () => {
    const err = mapDatabaseError(new Error("INVALID_DELTA: tidak valid"));
    expect(err).toBeInstanceOf(InvalidDeltaError);
    expect(err.code).toBe("INVALID_DELTA");
  });

  it("maps INVALID_ITEM error", () => {
    const err = mapDatabaseError(new Error("INVALID_ITEM: tidak valid"));
    expect(err).toBeInstanceOf(InvalidItemError);
    expect(err.code).toBe("INVALID_ITEM");
  });

  it("maps INVALID_LOCATION error", () => {
    const err = mapDatabaseError(new Error("INVALID_LOCATION: tidak valid"));
    expect(err).toBeInstanceOf(InvalidLocationError);
    expect(err.code).toBe("INVALID_LOCATION");
  });

  it("maps INVALID_REFERENCE error", () => {
    const err = mapDatabaseError(new Error("INVALID_REFERENCE: tidak valid"));
    expect(err).toBeInstanceOf(InvalidReferenceError);
    expect(err.code).toBe("INVALID_REFERENCE");
  });

  it("maps TRANSFER_SAME_LOCATION error", () => {
    const err = mapDatabaseError(new Error("TRANSFER_SAME_LOCATION: source = dest"));
    expect(err).toBeInstanceOf(TransferSameLocationError);
    expect(err.code).toBe("TRANSFER_SAME_LOCATION");
  });

  it("wraps unknown errors as InventoryError", () => {
    const err = mapDatabaseError(new Error("some unknown error"));
    expect(err).toBeInstanceOf(InventoryError);
    expect(err.code).toBe("UNKNOWN");
    expect(err.message).toBe("some unknown error");
  });

  it("handles non-Error inputs", () => {
    const err = mapDatabaseError("string error");
    expect(err).toBeInstanceOf(InventoryError);
    expect(err.code).toBe("UNKNOWN");
  });
});
