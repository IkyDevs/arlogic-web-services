"use client"

import { useMemo } from "react"
import { CheckCircle } from "lucide-react"
import { formatRupiah } from "@/lib/domain/shared/formatters"

interface Item {
  item_type: string
  name: string
  quantity: number
  price: number
}

interface ServiceCostBreakdownProps {
  items: Item[]
  dp: number
  discount: number
  /**
   * Visual variant saja — tidak mengubah kalkulasi/data.
   * "default": tampilan light existing (Admin/Owner consumer tidak berubah).
   * "glacier": tampilan gelap untuk Tracking Page (token --gl-* didefinisikan
   * di app/tracking/[[...slug]]/glacier.css pada wrapper .glacier).
   */
  variant?: "default" | "glacier"
}

const STYLES = {
  default: {
    headerDot: "bg-slate-900",
    headerLabel: "text-xs font-semibold text-slate-500 uppercase tracking-wider",
    headerBorder: "border-b border-slate-200",
    groupLabel: "text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 px-0.5",
    itemName: "text-sm text-slate-800 truncate",
    itemQty: "text-[10px] text-slate-400 flex-shrink-0",
    itemPrice: "text-sm font-medium text-slate-900 tabular-nums flex-shrink-0 ml-4",
    subtotalRow: "border-b border-slate-100",
    subtotalLabel: "text-[11px] font-medium text-slate-500",
    subtotalValue: "text-xs font-semibold text-slate-700 tabular-nums",
    separator: "border-t border-slate-300 my-2",
    totalLabel: "text-sm font-bold text-slate-900",
    totalValue: "text-sm font-bold text-slate-900 tabular-nums",
    dpValue: "text-sm font-semibold text-emerald-600 tabular-nums",
    discountValue: "text-sm font-semibold text-red-500 tabular-nums",
    remainingLabel: "text-sm font-bold text-slate-900",
    lunasValue: "flex items-center gap-1.5 text-sm font-bold text-emerald-600 tabular-nums",
    remainingValue: "text-sm font-bold text-slate-900 tabular-nums",
    rowLabel: "text-sm text-slate-600",
    sparepartDot: "bg-amber-500",
    jasaDot: "bg-blue-500",
  },
  glacier: {
    headerDot: "bg-[color:var(--gl-accent)]",
    headerLabel: "text-xs font-semibold text-[color:var(--gl-text-secondary)] uppercase tracking-wider",
    headerBorder: "border-b border-[color:var(--gl-border)]",
    groupLabel: "text-[10px] font-bold text-[color:var(--gl-text-muted)] uppercase tracking-wider mb-1.5 px-0.5",
    itemName: "text-sm text-[color:var(--gl-text)] truncate",
    itemQty: "text-[10px] text-[color:var(--gl-text-muted)] flex-shrink-0",
    itemPrice: "text-sm font-medium text-[color:var(--gl-text)] tabular-nums flex-shrink-0 ml-4",
    subtotalRow: "border-b border-[color:var(--gl-border)]",
    subtotalLabel: "text-[11px] font-medium text-[color:var(--gl-text-secondary)]",
    subtotalValue: "text-xs font-semibold text-[color:var(--gl-text)] tabular-nums",
    separator: "border-t border-[color:var(--gl-border)] my-2",
    totalLabel: "text-sm font-bold text-[color:var(--gl-text)]",
    totalValue: "text-sm font-bold text-[color:var(--gl-accent-strong)] tabular-nums",
    dpValue: "text-sm font-semibold text-emerald-400 tabular-nums",
    discountValue: "text-sm font-semibold text-red-400 tabular-nums",
    remainingLabel: "text-sm font-bold text-[color:var(--gl-text)]",
    lunasValue: "flex items-center gap-1.5 text-sm font-bold text-emerald-400 tabular-nums",
    remainingValue: "text-sm font-bold text-[color:var(--gl-accent-strong)] tabular-nums",
    rowLabel: "text-sm text-[color:var(--gl-text-secondary)]",
    sparepartDot: "bg-amber-400",
    jasaDot: "bg-[color:var(--gl-accent)]",
  },
} as const

export default function ServiceCostBreakdown({ items, dp, discount, variant = "default" }: ServiceCostBreakdownProps) {
  const s = STYLES[variant]
  const sparepartItems = useMemo(() => items.filter((i) => i.item_type === "sparepart"), [items])
  const jasaItems = useMemo(() => items.filter((i) => i.item_type === "jasa"), [items])
  const totalSparepart = useMemo(() => sparepartItems.reduce((s, i) => s + i.price * i.quantity, 0), [sparepartItems])
  const totalJasa = useMemo(() => jasaItems.reduce((s, i) => s + i.price * i.quantity, 0), [jasaItems])
  const totalTagihan = totalSparepart + totalJasa
  const remaining = Math.max(0, totalTagihan - dp - discount)
  const isLunas = remaining <= 0

  if (items.length === 0) return null

  return (
    <div className="space-y-1">
      {/* Header */}
      <div className={`flex items-center gap-2 px-0.5 pb-2 mb-2 ${s.headerBorder}`}>
        <div className={`w-2 h-2 rounded-full ${s.headerDot}`} />
        <span className={s.headerLabel}>Rincian Biaya</span>
      </div>

      {/* SPAREPART */}
      {sparepartItems.length > 0 && (
        <div>
          <p className={s.groupLabel}>Sparepart</p>
          <div className="space-y-1">
            {sparepartItems.map((item, i) => (
              <div key={i} className="flex justify-between items-center px-0.5 py-1">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <span className={`w-1 h-1 rounded-full ${s.sparepartDot} flex-shrink-0`} />
                  <span className={s.itemName}>{item.name}</span>
                  {item.quantity > 1 && <span className={s.itemQty}>x{item.quantity}</span>}
                </div>
                <span className={s.itemPrice}>{formatRupiah(item.price * item.quantity)}</span>
              </div>
            ))}
          </div>
          <div className={`flex justify-between items-center pt-1 pb-1.5 px-0.5 ${s.subtotalRow}`}>
            <span className={s.subtotalLabel}>Subtotal Sparepart</span>
            <span className={s.subtotalValue}>{formatRupiah(totalSparepart)}</span>
          </div>
        </div>
      )}

      {/* JASA */}
      {jasaItems.length > 0 && (
        <div className={sparepartItems.length > 0 ? "mt-2" : ""}>
          <p className={s.groupLabel}>Jasa</p>
          <div className="space-y-1">
            {jasaItems.map((item, i) => (
              <div key={i} className="flex justify-between items-center px-0.5 py-1">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <span className={`w-1 h-1 rounded-full ${s.jasaDot} flex-shrink-0`} />
                  <span className={s.itemName}>{item.name}</span>
                  {item.quantity > 1 && <span className={s.itemQty}>x{item.quantity}</span>}
                </div>
                <span className={s.itemPrice}>{formatRupiah(item.price * item.quantity)}</span>
              </div>
            ))}
          </div>
          <div className={`flex justify-between items-center pt-1 pb-1.5 px-0.5 ${s.subtotalRow}`}>
            <span className={s.subtotalLabel}>Subtotal Jasa</span>
            <span className={s.subtotalValue}>{formatRupiah(totalJasa)}</span>
          </div>
        </div>
      )}

      {/* Separator */}
      <div className={s.separator} />

      {/* Total Tagihan */}
      <div className="flex justify-between items-center px-0.5 py-1.5">
        <span className={s.totalLabel}>Total Tagihan</span>
        <span className={s.totalValue}>{formatRupiah(totalTagihan)}</span>
      </div>

      {/* DP */}
      {dp > 0 && (
        <div className="flex justify-between items-center px-0.5 py-1">
          <span className={s.rowLabel}>DP</span>
          <span className={s.dpValue}>-{formatRupiah(dp)}</span>
        </div>
      )}

      {/* Diskon */}
      {discount > 0 && (
        <div className="flex justify-between items-center px-0.5 py-1">
          <span className={s.rowLabel}>Diskon</span>
          <span className={s.discountValue}>-{formatRupiah(discount)}</span>
        </div>
      )}

      {/* Separator */}
      <div className={s.separator} />

      {/* Sisa Pembayaran */}
      <div className="flex justify-between items-center px-0.5 py-2">
        <span className={s.remainingLabel}>Sisa Pembayaran</span>
        {isLunas ? (
          <span className={s.lunasValue}>
            <CheckCircle className="w-4 h-4" /> LUNAS
          </span>
        ) : (
          <span className={s.remainingValue}>{formatRupiah(remaining)}</span>
        )}
      </div>
    </div>
  )
}
