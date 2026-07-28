// ─── Shared Domain Types ────────────────────────────────────────────

export type UserRole = "admin" | "teknisi" | "supervisor" | "owner" | "customer"

export interface Profile {
  id: string
  email: string
  full_name: string
  role: UserRole
  teknisi_name?: string
  phone?: string
  gender?: string
  avatar_url?: string
  created_at: string
  updated_at: string
}

export interface Customer {
  id: string
  name: string
  phone: string
  point: number
  profesi?: string
  email?: string
  alamat?: string
  last_transaction: string
  created_at: string
}