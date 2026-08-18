// ─── Domain Formatters (Single Source of Truth) ────────────────────

export function formatRupiah(n: number): string {
  const formatted = new Intl.NumberFormat("id-ID", {
    maximumFractionDigits: 0,
  }).format(n)
  return `Rp ${formatted}`
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

// ─── Local Date Helpers (WIB) ─────────────────────────────────────
// `toISOString()` selalu UTC — filter "hari ini" memakai UTC salah
// untuk zona Asia/Jakarta (00:00–06:59 WIB dihitung sebagai hari
// kemarin). Helper ini menghasilkan tanggal/rentang dalam WIB.
const WIB = "Asia/Jakarta"

export function localDateISO(date: string | Date = new Date()): string {
  const d = typeof date === "string" ? new Date(date) : date
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: WIB,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d)
}

export function localDayRange(date: string | Date = new Date(), tz = WIB) {
  const d = typeof date === "string" ? new Date(date) : date
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d)
  const y = parts.find((p) => p.type === "year")!.value
  const m = parts.find((p) => p.type === "month")!.value
  const day = parts.find((p) => p.type === "day")!.value
  // Offset eksplisit +07:00 supaya timestamptz Postgres diinterpretasi benar
  return {
    start: `${y}-${m}-${day}T00:00:00+07:00`,
    end: `${y}-${m}-${day}T23:59:59.999+07:00`,
  }
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