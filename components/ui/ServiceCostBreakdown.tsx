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
}

export default function ServiceCostBreakdown({ items, dp, discount }: ServiceCostBreakdownProps) {
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
      <div className="flex items-center gap-2 px-0.5 pb-2 mb-2 border-b border-slate-200">
        <div className="w-2 h-2 rounded-full bg-slate-900" />
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Rincian Biaya</span>
      </div>

      {/* SPAREPART */}
      {sparepartItems.length > 0 && (
        <div>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 px-0.5">Sparepart</p>
          <div className="space-y-1">
            {sparepartItems.map((item, i) => (
              <div key={i} className="flex justify-between items-center px-0.5 py-1">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <span className="w-1 h-1 rounded-full bg-amber-500 flex-shrink-0" />
                  <span className="text-sm text-slate-800 truncate">{item.name}</span>
                  {item.quantity > 1 && <span className="text-[10px] text-slate-400 flex-shrink-0">x{item.quantity}</span>}
                </div>
                <span className="text-sm font-medium text-slate-900 tabular-nums flex-shrink-0 ml-4">{formatRupiah(item.price * item.quantity)}</span>
              </div>
            ))}
          </div>
          <div className="flex justify-between items-center pt-1 pb-1.5 px-0.5 border-b border-slate-100">
            <span className="text-[11px] font-medium text-slate-500">Subtotal Sparepart</span>
            <span className="text-xs font-semibold text-slate-700 tabular-nums">{formatRupiah(totalSparepart)}</span>
          </div>
        </div>
      )}

      {/* JASA */}
      {jasaItems.length > 0 && (
        <div className={sparepartItems.length > 0 ? "mt-2" : ""}>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 px-0.5">Jasa</p>
          <div className="space-y-1">
            {jasaItems.map((item, i) => (
              <div key={i} className="flex justify-between items-center px-0.5 py-1">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <span className="w-1 h-1 rounded-full bg-blue-500 flex-shrink-0" />
                  <span className="text-sm text-slate-800 truncate">{item.name}</span>
                  {item.quantity > 1 && <span className="text-[10px] text-slate-400 flex-shrink-0">x{item.quantity}</span>}
                </div>
                <span className="text-sm font-medium text-slate-900 tabular-nums flex-shrink-0 ml-4">{formatRupiah(item.price * item.quantity)}</span>
              </div>
            ))}
          </div>
          <div className="flex justify-between items-center pt-1 pb-1.5 px-0.5 border-b border-slate-100">
            <span className="text-[11px] font-medium text-slate-500">Subtotal Jasa</span>
            <span className="text-xs font-semibold text-slate-700 tabular-nums">{formatRupiah(totalJasa)}</span>
          </div>
        </div>
      )}

      {/* Separator */}
      <div className="border-t border-slate-300 my-2" />

      {/* Total Tagihan */}
      <div className="flex justify-between items-center px-0.5 py-1.5">
        <span className="text-sm font-bold text-slate-900">Total Tagihan</span>
        <span className="text-sm font-bold text-slate-900 tabular-nums">{formatRupiah(totalTagihan)}</span>
      </div>

      {/* DP */}
      {dp > 0 && (
        <div className="flex justify-between items-center px-0.5 py-1">
          <span className="text-sm text-slate-600">DP</span>
          <span className="text-sm font-semibold text-emerald-600 tabular-nums">-{formatRupiah(dp)}</span>
        </div>
      )}

      {/* Diskon */}
      {discount > 0 && (
        <div className="flex justify-between items-center px-0.5 py-1">
          <span className="text-sm text-slate-600">Diskon</span>
          <span className="text-sm font-semibold text-red-500 tabular-nums">-{formatRupiah(discount)}</span>
        </div>
      )}

      {/* Separator */}
      <div className="border-t border-slate-300 my-2" />

      {/* Sisa Pembayaran */}
      <div className="flex justify-between items-center px-0.5 py-2">
        <span className="text-sm font-bold text-slate-900">Sisa Pembayaran</span>
        {isLunas ? (
          <span className="flex items-center gap-1.5 text-sm font-bold text-emerald-600 tabular-nums">
            <CheckCircle className="w-4 h-4" /> LUNAS
          </span>
        ) : (
          <span className="text-sm font-bold text-slate-900 tabular-nums">{formatRupiah(remaining)}</span>
        )}
      </div>
    </div>
  )
}