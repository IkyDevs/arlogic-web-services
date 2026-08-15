'use client'

import { ClipboardCheck, Wrench, Clock, Eye } from 'lucide-react'

interface Props {
  teknisiName: string
  review: any[]
  processing: any[]
  pending: any[]
  onViewDetails: (svc: any) => void
  onApprovePending: (id: string, approve: boolean) => void
  approvingId: string | null
}

export default function TeknisiTrackingView({
  teknisiName,
  review,
  processing,
  pending,
  onViewDetails,
  onApprovePending,
  approvingId,
}: Props) {
  const Column = ({ title, icon: Icon, count, children }: any) => (
    <div className="bg-gray-50 dark:bg-white/5 p-3 rounded-xl border border-gray-200 dark:border-white/10">
      <div className="flex items-center gap-2 mb-3 text-gray-700 dark:text-gray-200 font-bold text-sm">
        <Icon className="w-4 h-4" /> {title} ({count})
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  )

  const cardCls =
    "p-3 bg-white dark:bg-[#1c1c1c] rounded-lg border border-gray-200 dark:border-white/10 hover:shadow-md hover:border-slate-300 dark:hover:border-white/20 transition-all"

  return (
    <div>
      <div className="mb-4">
        <h2 className="font-semibold text-slate-900 dark:text-gray-100">{teknisiName}</h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">Rekap kerja teknisi</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Kiri: Submit QC */}
        <Column title="Submit QC" icon={ClipboardCheck} count={review.length}>
          {review.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-4">Tidak ada service menunggu QC</p>
          ) : (
            review.map((s: any) => (
              <div key={s.id} className={cardCls}>
                <p className="font-mono text-xs font-semibold text-slate-500">{s.invoice_number}</p>
                <p className="text-sm font-semibold text-slate-900 dark:text-gray-100 mt-1">{s.customer_name}</p>
                <p className="text-xs text-slate-500">{s.watch_brand || s.device_brand || '-'}</p>
                <button
                  onClick={() => onViewDetails(s)}
                  className="mt-2 w-full py-1.5 bg-slate-900 text-white text-xs font-medium rounded-lg hover:bg-slate-800 transition-all flex items-center justify-center gap-1"
                >
                  <Eye className="w-3 h-3" /> Review
                </button>
              </div>
            ))
          )}
        </Column>

        {/* Tengah: Sedang Digarap */}
        <Column title="Sedang Digarap" icon={Wrench} count={processing.length}>
          {processing.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-4">Tidak ada service sedang digarap</p>
          ) : (
            processing.map((s: any) => (
              <div key={s.id} className={cardCls}>
                <p className="font-mono text-xs font-semibold text-slate-500">{s.invoice_number}</p>
                <p className="text-sm font-semibold text-slate-900 dark:text-gray-100 mt-1">{s.customer_name}</p>
                <p className="text-xs text-slate-500">{s.watch_brand || s.device_brand || '-'}</p>
              </div>
            ))
          )}
        </Column>

        {/* Kanan: Pending Ajuan Teknisi */}
        <Column title="Pending Ajuan Teknisi" icon={Clock} count={pending.length}>
          {pending.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-4">Tidak ada pending dari teknisi</p>
          ) : (
            pending.map((s: any) => (
              <div key={s.id} className={cardCls}>
                <p className="font-mono text-xs font-semibold text-slate-500">{s.invoice_number}</p>
                <p className="text-sm font-semibold text-slate-900 dark:text-gray-100 mt-1">{s.customer_name}</p>
                <div className="bg-amber-50 dark:bg-amber-950/20 rounded-lg p-2 mt-2 border border-amber-200 dark:border-amber-800">
                  <p className="text-[10px] font-medium text-amber-800 dark:text-amber-300">Alasan:</p>
                  <p className="text-xs text-amber-700 dark:text-amber-400">{s._pendingReason || s.message || '-'}</p>
                </div>
                <div className="flex gap-2 mt-2">
                  <button
                    onClick={() => onApprovePending(s.id, true)}
                    disabled={approvingId === s.id}
                    className="flex-1 py-1.5 text-xs bg-emerald-600 text-white font-medium rounded-lg hover:bg-emerald-700 disabled:opacity-50"
                  >
                    {approvingId === s.id ? '...' : 'Setuju'}
                  </button>
                  <button
                    onClick={() => onApprovePending(s.id, false)}
                    disabled={approvingId === s.id}
                    className="flex-1 py-1.5 text-xs bg-red-500 text-white font-medium rounded-lg hover:bg-red-600 disabled:opacity-50"
                  >
                    Tolak
                  </button>
                </div>
              </div>
            ))
          )}
        </Column>
      </div>
    </div>
  )
}