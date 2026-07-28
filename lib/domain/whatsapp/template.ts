// ─── WhatsApp Template Builder (Reusable) ──────────────────────────
import type { ServiceItem } from "../service-order/types"

export function getGreeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return "Pagi"
  if (hour < 15) return "Siang"
  if (hour < 18) return "Sore"
  return "Malam"
}

export interface WhatsAppPickupData {
  customerName: string
  csName: string
  jasaItems: { name: string; price: number }[]
  sparepartItems: { name: string; price: number }[]
  downPayment: number
  total: number
  discount: number
  remaining: number
}

export function buildPickupTemplate(data: WhatsAppPickupData): string {
  const greeting = getGreeting()
  const lines: string[] = [
    "Assalamu'alaikum.",
    "",
    `Selamat ${greeting} Kak ${data.customerName},`,
    "",
    `Saya ${data.csName} dari Arlogic ex. Juragan7am ingin menginformasikan bahwa jam tangan Anda telah lolos Quality Control dan sudah siap untuk diambil.`,
    "",
    "Berikut rincian biaya:",
    "",
  ]

  if (data.sparepartItems.length > 0) {
    lines.push("Sparepart")
    for (const item of data.sparepartItems) {
      lines.push(`${item.name} : Rp ${item.price.toLocaleString("id-ID")}`)
    }
    lines.push("")
  }

  if (data.jasaItems.length > 0) {
    lines.push("Jasa")
    for (const item of data.jasaItems) {
      lines.push(`${item.name} : Rp ${item.price.toLocaleString("id-ID")}`)
    }
    lines.push("")
  }

  lines.push(`DP`)
  lines.push(`Rp ${data.downPayment.toLocaleString("id-ID")}`)
  lines.push("")
  lines.push(`Total`)
  lines.push(`Rp ${data.total.toLocaleString("id-ID")}`)
  lines.push("")
  lines.push(`Diskon`)
  lines.push(`Rp ${data.discount.toLocaleString("id-ID")}`)
  lines.push("")
  lines.push(`Sisa Pembayaran`)
  lines.push(`Rp ${data.remaining.toLocaleString("id-ID")}`)
  lines.push("")
  lines.push("Terima kasih 🙏😊")

  return lines.join("\n")
}

export function buildServiceItemLines(items: ServiceItem[]): { jasa: { name: string; price: number }[]; sparepart: { name: string; price: number }[] } {
  const jasa: { name: string; price: number }[] = []
  const sparepart: { name: string; price: number }[] = []

  for (const item of items) {
    const entry = { name: item.name, price: item.price * item.quantity }
    if (item.item_type === "jasa") {
      jasa.push(entry)
    } else {
      sparepart.push(entry)
    }
  }

  return { jasa, sparepart }
}