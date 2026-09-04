import { describe, expect, it } from "vitest";
import {
  TransferError,
  TransferNotFoundError,
  InvalidTransitionError,
  ForbiddenError,
  ForbiddenBranchError,
  EmptyTransferError,
  InvalidQuantityError,
  DuplicateTransitionError,
  TransferTerminalError,
  ConcurrentModificationError,
  ApprovalFailedError,
  InvalidLocationError,
  RejectReasonRequiredError,
  ReservationInsufficientError,
  mapDatabaseError,
} from "@/lib/domain/transfer/errors";

describe("Transfer Error Classes", () => {
  it("TransferError has correct code and message", () => {
    const err = new TransferError("TEST_CODE", "test message");
    expect(err.code).toBe("TEST_CODE");
    expect(err.message).toBe("test message");
    expect(err.name).toBe("TransferError");
    expect(err).toBeInstanceOf(Error);
  });

  it("TransferNotFoundError has correct defaults", () => {
    const err = new TransferNotFoundError();
    expect(err.code).toBe("TRANSFER_NOT_FOUND");
    expect(err.name).toBe("TransferNotFoundError");
  });

  it("InvalidTransitionError has correct defaults", () => {
    const err = new InvalidTransitionError();
    expect(err.code).toBe("INVALID_TRANSITION");
    expect(err.name).toBe("InvalidTransitionError");
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

  it("EmptyTransferError has correct defaults", () => {
    const err = new EmptyTransferError();
    expect(err.code).toBe("EMPTY_TRANSFER");
    expect(err.name).toBe("EmptyTransferError");
  });

  it("InvalidQuantityError has correct defaults", () => {
    const err = new InvalidQuantityError();
    expect(err.code).toBe("INVALID_QUANTITY");
    expect(err.name).toBe("InvalidQuantityError");
  });

  it("DuplicateTransitionError has correct defaults", () => {
    const err = new DuplicateTransitionError();
    expect(err.code).toBe("DUPLICATE_TRANSITION");
    expect(err.name).toBe("DuplicateTransitionError");
  });

  it("TransferTerminalError has correct defaults", () => {
    const err = new TransferTerminalError();
    expect(err.code).toBe("TRANSFER_TERMINAL");
    expect(err.name).toBe("TransferTerminalError");
  });

  it("ConcurrentModificationError has correct defaults", () => {
    const err = new ConcurrentModificationError();
    expect(err.code).toBe("CONCURRENT_MODIFICATION");
    expect(err.name).toBe("ConcurrentModificationError");
  });

  it("ApprovalFailedError has correct defaults", () => {
    const err = new ApprovalFailedError();
    expect(err.code).toBe("APPROVAL_FAILED");
    expect(err.name).toBe("ApprovalFailedError");
  });

  it("InvalidLocationError has correct defaults", () => {
    const err = new InvalidLocationError();
    expect(err.code).toBe("INVALID_LOCATION");
    expect(err.name).toBe("InvalidLocationError");
  });

  it("RejectReasonRequiredError has correct defaults", () => {
    const err = new RejectReasonRequiredError();
    expect(err.code).toBe("REJECT_REASON_REQUIRED");
    expect(err.name).toBe("RejectReasonRequiredError");
  });

  it("ReservationInsufficientError has correct defaults", () => {
    const err = new ReservationInsufficientError();
    expect(err.code).toBe("RESERVATION_RELEASED");
    expect(err.name).toBe("ReservationInsufficientError");
  });
});

describe("mapDatabaseError", () => {
  it("maps TRANSFER_NOT_FOUND error", () => {
    const err = mapDatabaseError(new Error("TRANSFER_NOT_FOUND: tidak ditemukan"));
    expect(err).toBeInstanceOf(TransferNotFoundError);
    expect(err.code).toBe("TRANSFER_NOT_FOUND");
  });

  it("maps INVALID_TRANSITION error", () => {
    const err = mapDatabaseError(new Error("INVALID_TRANSITION: tidak valid"));
    expect(err).toBeInstanceOf(InvalidTransitionError);
    expect(err.code).toBe("INVALID_TRANSITION");
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

  it("maps EMPTY_TRANSFER error", () => {
    const err = mapDatabaseError(new Error("EMPTY_TRANSFER: tidak ada item"));
    expect(err).toBeInstanceOf(EmptyTransferError);
    expect(err.code).toBe("EMPTY_TRANSFER");
  });

  it("maps INVALID_QUANTITY error", () => {
    const err = mapDatabaseError(new Error("INVALID_QUANTITY: harus positif"));
    expect(err).toBeInstanceOf(InvalidQuantityError);
    expect(err.code).toBe("INVALID_QUANTITY");
  });

  it("maps DUPLICATE_TRANSITION error", () => {
    const err = mapDatabaseError(new Error("DUPLICATE_TRANSITION: sudah dilakukan"));
    expect(err).toBeInstanceOf(DuplicateTransitionError);
    expect(err.code).toBe("DUPLICATE_TRANSITION");
  });

  it("maps TRANSFER_TERMINAL error", () => {
    const err = mapDatabaseError(new Error("TRANSFER_TERMINAL: status terminal"));
    expect(err).toBeInstanceOf(TransferTerminalError);
    expect(err.code).toBe("TRANSFER_TERMINAL");
  });

  it("maps CONCURRENT_MODIFICATION error", () => {
    const err = mapDatabaseError(new Error("CONCURRENT_MODIFICATION: sudah dimodifikasi"));
    expect(err).toBeInstanceOf(ConcurrentModificationError);
    expect(err.code).toBe("CONCURRENT_MODIFICATION");
  });

  it("maps APPROVAL_FAILED error", () => {
    const err = mapDatabaseError(new Error("APPROVAL_FAILED: persetujuan gagal"));
    expect(err).toBeInstanceOf(ApprovalFailedError);
    expect(err.code).toBe("APPROVAL_FAILED");
  });

  it("maps INVALID_LOCATION error", () => {
    const err = mapDatabaseError(new Error("INVALID_LOCATION: source = dest"));
    expect(err).toBeInstanceOf(InvalidLocationError);
    expect(err.code).toBe("INVALID_LOCATION");
  });

  it("maps REJECT_REASON_REQUIRED error", () => {
    const err = mapDatabaseError(new Error("REJECT_REASON_REQUIRED: alasan wajib"));
    expect(err).toBeInstanceOf(RejectReasonRequiredError);
    expect(err.code).toBe("REJECT_REASON_REQUIRED");
  });

  it("maps RESERVATION_RELEASED error", () => {
    const err = mapDatabaseError(new Error("RESERVATION_RELEASED: reservasi telah dilepas"));
    expect(err).toBeInstanceOf(ReservationInsufficientError);
    expect(err.code).toBe("RESERVATION_RELEASED");
  });

  it("wraps unknown errors as TransferError", () => {
    const err = mapDatabaseError(new Error("some unknown error"));
    expect(err).toBeInstanceOf(TransferError);
    expect(err.code).toBe("UNKNOWN");
    expect(err.message).toBe("some unknown error");
  });

  it("handles non-Error inputs", () => {
    const err = mapDatabaseError("string error");
    expect(err).toBeInstanceOf(TransferError);
    expect(err.code).toBe("UNKNOWN");
  });
});
