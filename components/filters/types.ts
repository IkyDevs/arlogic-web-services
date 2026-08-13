export interface PeriodValue {
  type: "hari" | "bulan" | "tahun" | "custom"
  date?: string // YYYY-MM-DD
  month?: string // YYYY-MM
  year?: string // YYYY
  range?: { start: string; end: string }
}

export interface PeriodFilterProps {
  value: PeriodValue
  onChange: (value: PeriodValue) => void
  className?: string
  showReset?: boolean
  disabled?: boolean
}

export const DEFAULT_PERIOD: PeriodValue = {
  type: "hari",
  date: new Date().toISOString().split("T")[0],
}

export function getPeriodDisplayLabel(value: PeriodValue): string {
  switch (value.type) {
    case "hari":
      if (!value.date) return "Hari Ini"
      const date = new Date(value.date)
      const today = new Date()
      const yesterday = new Date()
      yesterday.setDate(yesterday.getDate() - 1)

      if (value.date === today.toISOString().split("T")[0]) return "Hari Ini"
      if (value.date === yesterday.toISOString().split("T")[0]) return "Kemarin"

      return date.toLocaleDateString("id-ID", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })

    case "bulan":
      if (!value.month) return "Bulan Ini"
      const [year, month] = value.month.split("-")
      const monthDate = new Date(Number(year), Number(month) - 1)
      const currentMonth = new Date().toISOString().slice(0, 7)

      if (value.month === currentMonth) return "Bulan Ini"

      return monthDate.toLocaleDateString("id-ID", {
        month: "long",
        year: "numeric",
      })

    case "tahun":
      if (!value.year) return "Tahun Ini"
      const currentYear = String(new Date().getFullYear())
      if (value.year === currentYear) return "Tahun Ini"
      return value.year

    case "custom":
      if (!value.range?.start || !value.range?.end) return "Range Tanggal"
      const start = new Date(value.range.start)
      const end = new Date(value.range.end)
      const startStr = start.toLocaleDateString("id-ID", {
        day: "numeric",
        month: "short",
      })
      const endStr = end.toLocaleDateString("id-ID", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
      return `${startStr} - ${endStr}`

    default:
      return "Hari Ini"
  }
}

export function getPeriodShortLabel(value: PeriodValue): string {
  switch (value.type) {
    case "hari":
      return value.date
        ? new Date(value.date).toLocaleDateString("id-ID", {
            day: "numeric",
            month: "short",
          })
        : "Hari Ini"
    case "bulan":
      return value.month
        ? new Date(value.month + "-01").toLocaleDateString("id-ID", {
            month: "short",
            year: "numeric",
          })
        : "Bulan Ini"
    case "tahun":
      return value.year || "Tahun Ini"
    case "custom":
      return "Custom"
    default:
      return "Hari Ini"
  }
}

export function getPeriodIcon(value: PeriodValue): string {
  switch (value.type) {
    case "hari":
      return "Calendar"
    case "bulan":
      return "CalendarDays"
    case "tahun":
      return "CalendarRange"
    case "custom":
      return "Filter"
    default:
      return "Calendar"
  }
}

export const MONTH_NAMES = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
]

export const RANGE_PRESETS = [
  { label: "7 Hari", days: 7 },
  { label: "30 Hari", days: 30 },
  { label: "90 Hari", days: 90 },
]
