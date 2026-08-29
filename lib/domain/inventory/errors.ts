// ─── Inventory Domain Errors ────────────────────────────────────────
// Deterministic error classes for inventory operations.
// Each error has a stable `code` for UI mapping and a human-readable `message`.

export class InventoryError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "InventoryError";
    this.code = code;
  }
}

export class InsufficientStockError extends InventoryError {
  constructor(message = "Stok tidak mencukupi") {
    super("INSUFFICIENT_STOCK", message);
    this.name = "InsufficientStockError";
  }
}

export class InsufficientAvailableError extends InventoryError {
  constructor(message = "Stok tersedia tidak mencukupi") {
    super("INSUFFICIENT_AVAILABLE", message);
    this.name = "InsufficientAvailableError";
  }
}

export class BalanceNotFoundError extends InventoryError {
  constructor(message = "Balance tidak ditemukan") {
    super("BALANCE_NOT_FOUND", message);
    this.name = "BalanceNotFoundError";
  }
}

export class ForbiddenError extends InventoryError {
  constructor(message = "Tidak berwenang") {
    super("FORBIDDEN", message);
    this.name = "ForbiddenError";
  }
}

export class ForbiddenBranchError extends InventoryError {
  constructor(message = "Tidak berwenang untuk cabang ini") {
    super("FORBIDDEN_BRANCH", message);
    this.name = "ForbiddenBranchError";
  }
}

export class DuplicateMovementError extends InventoryError {
  constructor(message = "Operasi sudah pernah dilakukan") {
    super("DUPLICATE_MOVEMENT", message);
    this.name = "DuplicateMovementError";
  }
}

export class InvalidQuantityError extends InventoryError {
  constructor(message = "Quantity harus positif") {
    super("INVALID_QUANTITY", message);
    this.name = "InvalidQuantityError";
  }
}

export class InvalidDeltaError extends InventoryError {
  constructor(message = "Delta tidak valid") {
    super("INVALID_DELTA", message);
    this.name = "InvalidDeltaError";
  }
}

export class InvalidItemError extends InventoryError {
  constructor(message = "Item tidak valid") {
    super("INVALID_ITEM", message);
    this.name = "InvalidItemError";
  }
}

export class InvalidLocationError extends InventoryError {
  constructor(message = "Location tidak valid") {
    super("INVALID_LOCATION", message);
    this.name = "InvalidLocationError";
  }
}

export class InvalidReferenceError extends InventoryError {
  constructor(message = "Reference tidak valid") {
    super("INVALID_REFERENCE", message);
    this.name = "InvalidReferenceError";
  }
}

export class TransferSameLocationError extends InventoryError {
  constructor(message = "Source dan destination tidak boleh sama") {
    super("TRANSFER_SAME_LOCATION", message);
    this.name = "TransferSameLocationError";
  }
}

export class InvalidMovementTypeError extends InventoryError {
  constructor(message = "Tipe gerakan tidak valid") {
    super("INVALID_MOVEMENT_TYPE", message);
    this.name = "InvalidMovementTypeError";
  }
}

// ─── Error Mapping ──────────────────────────────────────────────────
// Map PostgreSQL error codes to domain errors.

const ERROR_MAP: Record<string, new (msg?: string) => InventoryError> = {
  INSUFFICIENT_STOCK: InsufficientStockError,
  INSUFFICIENT_AVAILABLE: InsufficientAvailableError,
  BALANCE_NOT_FOUND: BalanceNotFoundError,
  FORBIDDEN: ForbiddenError,
  FORBIDDEN_BRANCH: ForbiddenBranchError,
  DUPLICATE_MOVEMENT: DuplicateMovementError,
  INVALID_QUANTITY: InvalidQuantityError,
  INVALID_DELTA: InvalidDeltaError,
  INVALID_ITEM: InvalidItemError,
  INVALID_LOCATION: InvalidLocationError,
  INVALID_REFERENCE: InvalidReferenceError,
  TRANSFER_SAME_LOCATION: TransferSameLocationError,
  INVALID_MOVEMENT_TYPE: InvalidMovementTypeError,
};

/**
 * Map a raw PostgreSQL error message to a domain error.
 * Extracts the error code from the message if present.
 * Checks longer (more specific) codes first to avoid partial matches.
 */
export function mapDatabaseError(err: unknown): InventoryError {
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

  // Default: wrap as generic InventoryError
  return new InventoryError("UNKNOWN", msg);
}
