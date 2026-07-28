import type { TransactionServiceItem, SKUItem } from "../transaction/types"

// ─── Validation Error ──────────────────────────────────────────────
export interface ValidationError {
  field: string
  message: string
}

// ─── Required Fields ───────────────────────────────────────────────
export function validateRequired(value: unknown, field: string, label: string): ValidationError | null {
  if (value === undefined || value === null || (typeof value === "string" && value.trim() === "")) {
    return { field, message: `${label} wajib diisi` }
  }
  return null
}

export function validateMinLength(value: string, field: string, label: string, min: number): ValidationError | null {
  if (value.trim().length < min) {
    return { field, message: `${label} minimal ${min} karakter` }
  }
  return null
}

// ─── Nominal / Numeric ────────────────────────────────────────────
export function validateNominal(nominal: number, field: string): ValidationError | null {
  if (nominal < 0) {
    return { field, message: "Nominal tidak boleh negatif" }
  }
  return null
}

export function validateQty(qty: number, field: string): ValidationError | null {
  if (qty < 1) {
    return { field, message: "Quantity minimal 1" }
  }
  return null
}

// ─── Duplicate Check ──────────────────────────────────────────────
export function validateNoDuplicateJenis(items: TransactionServiceItem[]): ValidationError | null {
  const seen = new Set<string>()
  for (const item of items) {
    if (seen.has(item.jenis_layanan)) {
      return {
        field: `items[${items.indexOf(item)}].jenis_layanan`,
        message: `Duplicate jenis layanan: ${item.jenis_layanan}`,
      }
    }
    seen.add(item.jenis_layanan)
  }
  return null
}

export function validateNoDuplicateSKU(skus: SKUItem[]): ValidationError | null {
  const seen = new Set<string>()
  for (const sku of skus) {
    if (sku.sku && seen.has(sku.sku)) {
      return {
        field: "skus",
        message: `Duplicate SKU: ${sku.sku}`,
      }
    }
    if (sku.sku) seen.add(sku.sku)
  }
  return null
}

// ─── Transaction Validation ───────────────────────────────────────
export function validateTransaction(data: {
  customer_name: string
  customer_whatsapp: string
  items: TransactionServiceItem[]
  handled_by: string
}): ValidationError[] {
  const errors: ValidationError[] = []

  const nameErr = validateRequired(data.customer_name, "customer_name", "Nama customer")
  if (nameErr) errors.push(nameErr)

  const waErr = validateRequired(data.customer_whatsapp, "customer_whatsapp", "Nomor WhatsApp")
  if (waErr) errors.push(waErr)

  const handlerErr = validateRequired(data.handled_by, "handled_by", "Pilih yang melayani")
  if (handlerErr) errors.push(handlerErr)

  if (!data.items || data.items.length === 0) {
    errors.push({ field: "items", message: "Minimal 1 layanan wajib diisi" })
  }

  const duplicateJenis = validateNoDuplicateJenis(data.items)
  if (duplicateJenis) errors.push(duplicateJenis)

  for (let i = 0; i < data.items.length; i++) {
    const item = data.items[i]
    const jenisErr = validateRequired(item.jenis_layanan, `items[${i}].jenis_layanan`, "Jenis layanan")
    if (jenisErr) errors.push(jenisErr)

    if (!item.skus || item.skus.length === 0) {
      errors.push({ field: `items[${i}].skus`, message: `Minimal 1 SKU untuk ${item.jenis_layanan || `item ${i + 1}`}` })
    }

    const skuDup = validateNoDuplicateSKU(item.skus)
    if (skuDup) errors.push({ ...skuDup, field: `items[${i}].${skuDup.field}` })

    for (let j = 0; j < item.skus.length; j++) {
      const nomErr = validateNominal(item.skus[j].nominal, `items[${i}].skus[${j}].nominal`)
      if (nomErr) errors.push(nomErr)
    }
  }

  return errors
}

// ─── Service Item Validation ──────────────────────────────────────
export function validateServiceItem(data: {
  name?: string
  price?: number
  quantity?: number
  item_type?: string
}): ValidationError[] {
  const errors: ValidationError[] = []

  const nameErr = validateRequired(data.name, "name", "Nama item")
  if (nameErr) errors.push(nameErr)

  if (data.price !== undefined) {
    const priceErr = validateNominal(data.price, "price")
    if (priceErr) errors.push(priceErr)
  }

  if (data.quantity !== undefined) {
    const qtyErr = validateQty(data.quantity, "quantity")
    if (qtyErr) errors.push(qtyErr)
  }

  return errors
}