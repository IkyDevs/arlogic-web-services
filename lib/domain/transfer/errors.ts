// ─── Stock Transfer Domain Errors ──────────────────────────────────
// Deterministic error classes for transfer operations.

export class TransferError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "TransferError";
    this.code = code;
  }
}

export class TransferNotFoundError extends TransferError {
  constructor(message = "Transfer tidak ditemukan") {
    super("TRANSFER_NOT_FOUND", message);
    this.name = "TransferNotFoundError";
  }
}

export class InvalidTransitionError extends TransferError {
  constructor(message = "Transisi status tidak valid") {
    super("INVALID_TRANSITION", message);
    this.name = "InvalidTransitionError";
  }
}

export class ForbiddenError extends TransferError {
  constructor(message = "Tidak berwenang") {
    super("FORBIDDEN", message);
    this.name = "ForbiddenError";
  }
}

export class ForbiddenBranchError extends TransferError {
  constructor(message = "Tidak berwenang untuk cabang ini") {
    super("FORBIDDEN_BRANCH", message);
    this.name = "ForbiddenBranchError";
  }
}

export class EmptyTransferError extends TransferError {
  constructor(message = "Transfer tidak memiliki item") {
    super("EMPTY_TRANSFER", message);
    this.name = "EmptyTransferError";
  }
}

export class InvalidQuantityError extends TransferError {
  constructor(message = "Quantity harus positif") {
    super("INVALID_QUANTITY", message);
    this.name = "InvalidQuantityError";
  }
}

export class DuplicateTransitionError extends TransferError {
  constructor(message = "Transisi sudah pernah dilakukan") {
    super("DUPLICATE_TRANSITION", message);
    this.name = "DuplicateTransitionError";
  }
}

export class TransferTerminalError extends TransferError {
  constructor(message = "Transfer sudah dalam status terminal") {
    super("TRANSFER_TERMINAL", message);
    this.name = "TransferTerminalError";
  }
}

export class ConcurrentModificationError extends TransferError {
  constructor(message = "Data sudah dimodifikasi oleh user lain") {
    super("CONCURRENT_MODIFICATION", message);
    this.name = "ConcurrentModificationError";
  }
}

export class ApprovalFailedError extends TransferError {
  constructor(message = "Persetujuan gagal") {
    super("APPROVAL_FAILED", message);
    this.name = "ApprovalFailedError";
  }
}

export class InvalidLocationError extends TransferError {
  constructor(message = "Source dan destination tidak boleh sama") {
    super("INVALID_LOCATION", message);
    this.name = "InvalidLocationError";
  }
}

export class RejectReasonRequiredError extends TransferError {
  constructor(message = "Alasan reject wajib diisi") {
    super("REJECT_REASON_REQUIRED", message);
    this.name = "RejectReasonRequiredError";
  }
}

export class ReservationInsufficientError extends TransferError {
  constructor(message = "Reservasi tidak mencukupi atau telah dilepas") {
    super("RESERVATION_RELEASED", message);
    this.name = "ReservationInsufficientError";
  }
}

// ─── Error Mapping ──────────────────────────────────────────────────

const ERROR_MAP: Record<string, new (msg?: string) => TransferError> = {
  TRANSFER_NOT_FOUND: TransferNotFoundError,
  INVALID_TRANSITION: InvalidTransitionError,
  FORBIDDEN: ForbiddenError,
  FORBIDDEN_BRANCH: ForbiddenBranchError,
  EMPTY_TRANSFER: EmptyTransferError,
  INVALID_QUANTITY: InvalidQuantityError,
  DUPLICATE_TRANSITION: DuplicateTransitionError,
  TRANSFER_TERMINAL: TransferTerminalError,
  CONCURRENT_MODIFICATION: ConcurrentModificationError,
  APPROVAL_FAILED: ApprovalFailedError,
  INVALID_LOCATION: InvalidLocationError,
  REJECT_REASON_REQUIRED: RejectReasonRequiredError,
  RESERVATION_RELEASED: ReservationInsufficientError,
};

/**
 * Map a raw PostgreSQL error message to a domain error.
 * Checks longer (more specific) codes first to avoid partial matches.
 */
export function mapDatabaseError(err: unknown): TransferError {
  const msg = err instanceof Error ? err.message : String(err);

  // Sort by key length descending to check more specific codes first
  const sortedEntries = Object.entries(ERROR_MAP).sort(
    (a, b) => b[0].length - a[0].length
  );

  for (const [code, ErrorClass] of sortedEntries) {
    if (msg.includes(code)) {
      return new ErrorClass(msg);
    }
  }

  // Default: wrap as generic TransferError
  return new TransferError("UNKNOWN", msg);
}
