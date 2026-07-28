// ─── Transaction Domain Enums ──────────────────────────────────────

export const JENIS_LAYANAN = [
  "service_langsung",
  "beli_jam",
  "custom_strap",
  "ambil_jam_service",
  "order_online",
  "dp_service",
  "pengeluaran",
  "cashdraw",
] as const
export type JenisLayanan = (typeof JENIS_LAYANAN)[number]

export const METODE_PEMBAYARAN = [
  "cash",
  "qris",
  "edc",
  "edc_mandiri",
  "edc_bca",
  "tf_bca",
  "tf_mandiri",
  "bri",
  "kudus",
  "transfer",
] as const
export type MetodePembayaran = (typeof METODE_PEMBAYARAN)[number]

export const LEAD_SOURCE = [
  "instagram",
  "wom",
  "dekat_lewat",
  "google",
  "dash",
  "facebook",
  "old",
  "tiktok",
  "tulis_sendiri",
] as const
export type LeadSource = (typeof LEAD_SOURCE)[number]

// ─── Labels ────────────────────────────────────────────────────────
export const jenisLayananLabels: Record<string, string> = {
  service_langsung: "Service Langsung",
  beli_jam: "Beli Jam",
  custom_strap: "Custom Strap",
  ambil_jam_service: "Ambil Jam Service",
  order_online: "Order Online",
  dp_service: "DP Service",
  pengeluaran: "Pengeluaran",
  cashdraw: "Cashdraw",
}

export const metodePembayaranLabels: Record<string, string> = {
  cash: "Cash",
  qris: "QRIS",
  edc: "EDC",
  edc_mandiri: "EDC Mandiri",
  edc_bca: "EDC BCA",
  tf_bca: "Transfer BCA",
  tf_mandiri: "Transfer Mandiri",
  bri: "BRI",
  kudus: "Kudus",
  transfer: "Transfer",
}

export const leadSourceLabels: Record<string, string> = {
  instagram: "Instagram",
  wom: "WOM (Word of Mouth)",
  dekat_lewat: "Dekat / Lewat",
  google: "Google",
  dash: "-",
  facebook: "Facebook",
  old: "Old Customer",
  tiktok: "TikTok",
  tulis_sendiri: "Tulis Sendiri",
}