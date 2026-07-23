'use client'

import { motion } from 'framer-motion'
import { Eye, CheckCircle } from 'lucide-react'

interface QCServiceListProps {
  services: any[]
  onViewDetails: (service: any) => void
}

export default function QCServiceList({ services, onViewDetails }: QCServiceListProps) {
  const formatRupiah = (nominal: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(nominal)
  }

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    })
  }

  if (services.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-8 text-center text-slate-400">
          <CheckCircle className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>Tidak ada service pending QC</p>
          <p className="text-sm">Semua service sudah direview</p>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <CheckCircle className="w-5 h-5 text-blue-600" />
        <h3 className="font-semibold text-slate-900">List Service yang Harus Direview</h3>
        <span className="bg-blue-600 text-white text-xs px-2 py-0.5 rounded-full">
          {services.length}
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {services.map((service, idx) => (
          <motion.div
            key={service.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.03 }}
            className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden hover:shadow-md hover:border-slate-300 transition-all flex flex-col"
          >
            <div className="p-4 flex-1 flex flex-col gap-3">
              {/* Header: invoice + status */}
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-xs font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                  {service.invoice_number}
                </span>
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 bg-yellow-500 rounded-full animate-pulse" />
                  <span className="text-[10px] font-medium text-yellow-700 bg-yellow-50 px-1.5 py-0.5 rounded-full border border-yellow-200">
                    Pending QC
                  </span>
                </div>
              </div>

              {/* Customer */}
              <div>
                <p className="font-semibold text-slate-900 text-sm">{service.customer_name}</p>
                <p className="text-xs text-slate-500">
                  {service.customer_phone || '-'}
                </p>
              </div>

              {/* Watch info */}
              <div className="text-xs text-slate-500 bg-slate-50 rounded-lg p-2.5 border border-slate-200">
                <span className="font-medium text-slate-700">
                  {service.watch_brand || service.device_brand || '-'}
                </span>
                {service.watch_model && <span> {service.watch_model}</span>}
              </div>

              {/* Teknisi + Date */}
              <div className="flex items-center justify-between text-xs text-slate-400 mt-auto">
                <span>Teknisi: {service.teknisi_name || '-'}</span>
                <span>{formatDate(service.created_at)}</span>
              </div>

              {/* Cost */}
              {service.final_cost ? (
                <div className="flex items-center justify-between pt-2 border-t border-slate-200">
                  <span className="text-xs text-slate-500">Total Biaya</span>
                  <span className="font-bold text-blue-600">{formatRupiah(service.final_cost)}</span>
                </div>
              ) : null}
            </div>

            {/* Action */}
            <div className="px-4 pb-4 mt-auto">
              <button
                onClick={() => onViewDetails(service)}
                className="w-full py-2.5 bg-slate-900 text-white text-sm font-medium rounded-xl hover:bg-slate-800 transition-all flex items-center justify-center gap-2"
              >
                <Eye className="w-4 h-4" />
                Review
              </button>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  )
}
