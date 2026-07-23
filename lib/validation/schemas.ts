import { z } from 'zod'

export const UploadType = z.enum([
  'attendance', 'service', 'layanan', 'inventory', 'kaspin',
  'teknisi_update', 'qc_update',
])

export const uploadSchema = z.object({
  type: UploadType,
  caption: z.string().max(4000).default(''),
  files: z.instanceof(File).array().min(1).max(10),
})

export const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  full_name: z.string().min(1),
  role: z.enum(['admin', 'teknisi', 'supervisor', 'owner', 'customer']),
  gender: z.enum(['male', 'female', 'other']).default('other'),
})

export const deleteUserSchema = z.object({
  userId: z.string().uuid(),
})

export const layananSchema = z.object({
  customer_name: z.string().min(1),
  customer_whatsapp: z.string().optional(),
  jenis_layanan: z.string().min(1),
  handled_by: z.string().optional(),
  metode_pembayaran: z.string().optional(),
  lead_source: z.string().optional(),
  detail_sku: z.string().optional(),
  nominal: z.number().min(0).optional(),
  notes: z.string().optional(),
})

export const closingSchema = z.object({
  action: z.enum(['create', 'approve', 'list']),
  closingId: z.string().uuid().optional(),
  admin_notes: z.string().optional(),
  total_cash: z.number().min(0).optional(),
  total_edc: z.number().min(0).optional(),
  total_transfer: z.number().min(0).optional(),
  total_qris: z.number().min(0).optional(),
})

export const telegramMessageSchema = z.object({
  type: z.string().min(1),
  message: z.string().min(1).max(4000),
})

export const telegramEditCaptionSchema = z.object({
  service_order_id: z.string().uuid(),
  new_caption: z.string().min(1).max(4000),
  channel: z.string().optional(),
})

export const telegramDeleteMessageSchema = z.object({
  chat_id: z.union([z.string(), z.number()]),
  message_id: z.number(),
})

export const telegramEditMessageSchema = z.object({
  chat_id: z.union([z.string(), z.number()]),
  message_id: z.number(),
  text: z.string().min(1).max(4000),
  is_caption: z.boolean().default(false),
})

export const customerNewSchema = z.object({
  name: z.string().min(1),
  phone: z.string().min(1),
})

export const expenseSchema = z.object({
  item_name: z.string().min(1),
  amount: z.number().min(0),
  payment_method: z.string().min(1),
  handled_by: z.string().optional(),
  notes: z.string().optional(),
  proof_photo_urls: z.array(z.string()).optional(),
})

export const servicePickupSchema = z.object({
  serviceOrderId: z.string().uuid(),
})
