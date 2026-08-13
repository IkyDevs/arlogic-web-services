'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ClipboardCheck, Wrench, Clock, Eye } from 'lucide-react'

export default function TeknisiTrackingView({ teknisiName, onViewDetails }: { teknisiName: string, onViewDetails: (svc: any) => void }) {
  const [data, setData] = useState<{ review: any[], processing: any[], pending: any[] }>({ review: [], processing: [], pending: [] });
  const supabase = createClient();

  useEffect(() => {
    const fetchTracking = async () => {
      const { data: svc } = await supabase
        .from("service_orders")
        .select("*, profiles:assigned_teknisi_id(full_name)")
        .eq("profiles.full_name", teknisiName);
      
      if (!svc) return;

      setData({
        review: svc.filter(s => s.status === 'qc_pending'),
        processing: svc.filter(s => ['assigned', 'in_progress', 'sparepart_ready'].includes(s.status)),
        pending: svc.filter(s => ['req_sparepart_admin', 'po_pending', 'revision_required'].includes(s.status))
      });
    }
    fetchTracking();
  }, [teknisiName]);

  const Column = ({ title, services, icon: Icon }: any) => (
    <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
      <div className="flex items-center gap-2 mb-3 text-gray-700 font-bold">
        <Icon className="w-4 h-4" /> {title} ({services.length})
      </div>
      <div className="space-y-2">
        {services.map((s: any) => (
          <div key={s.id} onClick={() => onViewDetails(s)} className="p-3 bg-white rounded-lg border border-gray-200 cursor-pointer hover:bg-gray-100">
            <p className="text-sm font-semibold">{s.invoice_number}</p>
            <p className="text-xs text-gray-500">{s.customer_name}</p>
          </div>
        ))}
      </div>
    </div>
  )

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <Column title="Review QC" services={data.review} icon={ClipboardCheck} />
      <Column title="Sedang Digarap" services={data.processing} icon={Wrench} />
      <Column title="Pending" services={data.pending} icon={Clock} />
    </div>
  )
}