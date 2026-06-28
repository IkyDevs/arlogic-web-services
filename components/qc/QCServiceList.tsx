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
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="p-4 border-b border-slate-200 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <CheckCircle className="w-5 h-5 text-blue-600" />
          <h3 className="font-semibold text-slate-900">Daftar Service QC</h3>
          <span className="bg-blue-600 text-white text-xs px-2 py-0.5 rounded-full">
            {services.length}
          </span>
        </div>
      </div>

      <div className="divide-y divide-slate-200">
        {services.map((service) => (
          <div key={service.id} className="p-4 hover:bg-slate-50 transition-all">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className="font-mono text-sm font-medium">{service.invoice_number}</span>
                  <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full">Pending QC</span>
                  <span className="text-xs text-slate-400">| {service.teknisi_name}</span>
                </div>
                <p className="font-medium text-slate-900">{service.customer_name}</p>
                <div className="flex items-center gap-4 text-sm text-slate-500 mt-1 flex-wrap">
                  <span>{service.watch_brand || '-'} {service.watch_model || ''}</span>
                  <span>•</span>
                  <span>{formatDate(service.created_at)}</span>
                  {service.final_cost && (
                    <>
                      <span>•</span>
                      <span className="font-medium text-blue-600">{formatRupiah(service.final_cost)}</span>
                    </>
                  )}
                </div>
              </div>
              <button
                onClick={() => onViewDetails(service)}
                className="px-4 py-2 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-800 transition-all flex items-center gap-2"
              >
                <Eye className="w-4 h-4" />
                Review
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
