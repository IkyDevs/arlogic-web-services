'use client'

import { ClipboardCheck, Clock, Users, CheckCircle, AlertTriangle } from "lucide-react";

interface QCStatsProps {
  services: any[];
  filteredServices: any[];
  teknisiList: string[];
}

export default function QCStats({ services, filteredServices, teknisiList }: QCStatsProps) {
  // Compute breakdown metrics
  const totalPending = services.length;
  const activeTeknisi = teknisiList.length;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-4">
      <div className="bg-white dark:bg-[#1c1c1c] rounded-xl border border-gray-200 dark:border-white/10 p-4 shadow-sm flex items-center gap-3">
        <div className="w-10 h-10 bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 rounded-xl flex items-center justify-center flex-shrink-0">
          <Clock className="w-5 h-5" />
        </div>
        <div>
          <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">Pending Review QC</p>
          <p className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100">{totalPending}</p>
        </div>
      </div>

      <div className="bg-white dark:bg-[#1c1c1c] rounded-xl border border-gray-200 dark:border-white/10 p-4 shadow-sm flex items-center gap-3">
        <div className="w-10 h-10 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-xl flex items-center justify-center flex-shrink-0">
          <Users className="w-5 h-5" />
        </div>
        <div>
          <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">Teknisi Aktif</p>
          <p className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100">{activeTeknisi}</p>
        </div>
      </div>

      <div className="bg-white dark:bg-[#1c1c1c] rounded-xl border border-gray-200 dark:border-white/10 p-4 shadow-sm flex items-center gap-3">
        <div className="w-10 h-10 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 rounded-xl flex items-center justify-center flex-shrink-0">
          <ClipboardCheck className="w-5 h-5" />
        </div>
        <div>
          <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">Terfilter Saat Ini</p>
          <p className="text-xl sm:text-2xl font-bold text-emerald-600 dark:text-emerald-400">{filteredServices.length}</p>
        </div>
      </div>

      <div className="bg-white dark:bg-[#1c1c1c] rounded-xl border border-gray-200 dark:border-white/10 p-4 shadow-sm flex items-center gap-3">
        <div className="w-10 h-10 bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 rounded-xl flex items-center justify-center flex-shrink-0">
          <AlertTriangle className="w-5 h-5" />
        </div>
        <div>
          <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">Perlu Perhatian</p>
          <p className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100">
            {services.filter(s => s.status === 'revision_required' || s.is_urgent).length}
          </p>
        </div>
      </div>
    </div>
  );
}
