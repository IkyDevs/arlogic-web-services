// ─── Domain Formatters (Single Source of Truth) ────────────────────

export function formatRupiah(n: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n)
}

export function formatDate(
  date: string | Date,
  format: "full" | "date" | "time" | "short" = "full",
): string {
  const d = new Date(date)
  switch (format) {
    case "date":
      return d.toLocaleDateString("id-ID", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    case "time":
      return d.toLocaleTimeString("id-ID", {
        hour: "2-digit",
        minute: "2-digit",
      })
    case "short":
      return d.toLocaleDateString("id-ID", {
        day: "numeric",
        month: "short",
      })
    default:
      return d.toLocaleDateString("id-ID", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
  }
}

export function formatDateISO(date: string | Date): string {
  return new Date(date).toISOString().split("T")[0]
}

export function formatRelativeTime(date: string | Date): string {
  const now = new Date()
  const past = new Date(date)
  const diffMs = now.getTime() - past.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffMins < 1) return "Baru saja"
  if (diffMins < 60) return `${diffMins} menit lalu`
  if (diffHours < 24) return `${diffHours} jam lalu`
  if (diffDays < 7) return `${diffDays} hari lalu`
  return past.toLocaleDateString("id-ID")
}

export function formatPhone(phone: string): string {
  return phone.replace(/\D/g, "")
}

export function truncate(str: string, length: number): string {
  if (str.length <= length) return str
  return str.slice(0, length) + "..."
}