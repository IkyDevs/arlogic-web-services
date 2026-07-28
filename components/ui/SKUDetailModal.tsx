"use client"

import { motion } from "framer-motion"
import { X } from "lucide-react"
import type { TransactionServiceItem } from "@/lib/domain/transaction/types"
import { jenisLayananLabels } from "@/lib/domain/transaction/enums"
import { formatRupiah } from "@/lib/domain/shared/formatters"

interface SKUDetailModalProps {
  isOpen: boolean
  onClose: () => void
  items: TransactionServiceItem[]
}

export default function SKUDetailModal({ isOpen, onClose, items }: SKUDetailModalProps) {
  if (!isOpen) return null

  const grandTotal = items.reduce((s, item) => {
    return s + item.skus.reduce((ss, sku) => ss + (sku.nominal || 0), 0)
  }, 0)

  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[80] p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-white dark:bg-[#1c1c1c] rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl border border-gray-200 dark:border-white/10"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white dark:bg-[#1c1c1c] z-10 flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-white/10 rounded-t-2xl">
          <h2 className="text-sm font-bold text-gray-900 dark:text-gray-100">Detail SKU</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 dark:hover:bg-white/10 rounded-lg transition-colors">
            <X className="w-4 h-4 text-gray-400" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {items.map((item, idx) => (
            <div key={idx} className="border border-gray-200 dark:border-white/10 rounded-xl overflow-hidden">
              <div className="bg-gray-50 dark:bg-white/5 px-4 py-2 border-b border-gray-200 dark:border-white/10">
                <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                  {jenisLayananLabels[item.jenis_layanan] || item.jenis_layanan}
                </p>
              </div>
              <div className="p-3 space-y-2">
                {item.skus.map((sku, skuIdx) => (
                  <div
                    key={skuIdx}
                    className="flex items-center justify-between p-2 bg-white dark:bg-white/5 rounded-lg border border-gray-100 dark:border-white/5"
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-gray-900 dark:bg-white" />
                      <span className="text-sm text-gray-700 dark:text-gray-300">
                        {sku.sku || "-"}
                      </span>
                    </div>
                    <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                      {formatRupiah(sku.nominal)}
                    </span>
                  </div>
                ))}
                <div className="flex items-center justify-between pt-2 border-t border-gray-100 dark:border-white/10">
                  <span className="text-xs text-gray-500">Subtotal</span>
                  <span className="text-sm font-bold text-gray-900 dark:text-gray-100">
                    {formatRupiah(item.skus.reduce((s, sku) => s + (sku.nominal || 0), 0))}
                  </span>
                </div>
              </div>
            </div>
          ))}

          <div className="flex items-center justify-between p-4 bg-gray-900 dark:bg-white rounded-xl">
            <span className="text-sm font-semibold text-white dark:text-gray-900">Grand Total</span>
            <span className="text-lg font-bold text-white dark:text-gray-900">
              {formatRupiah(grandTotal)}
            </span>
          </div>
        </div>
      </motion.div>
    </div>
  )
}