'use client'

interface QCStatsProps {
  services: any[]
  filteredServices: any[]
  teknisiList: string[]
}

export default function QCStats({ services, filteredServices, teknisiList }: QCStatsProps) {
  return (
    <div className="p-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
        <p className="text-xs text-slate-400">Total Review</p>
        <p className="text-2xl font-bold text-slate-900">{services.length}</p>
      </div>
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
        <p className="text-xs text-slate-400">Teknisi Aktif</p>
        <p className="text-2xl font-bold text-slate-900">{teknisiList.length}</p>
      </div>
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
        <p className="text-xs text-slate-400">Pending Review</p>
        <p className="text-2xl font-bold text-blue-600">{filteredServices.length}</p>
      </div>
    </div>
  )
}
