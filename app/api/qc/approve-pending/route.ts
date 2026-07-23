import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
    if (profile?.role !== 'supervisor' && profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Hanya QC/Admin yang bisa approve' }, { status: 403 })
    }

    const body = await request.json()
    const { serviceOrderId, approve } = body
    if (!serviceOrderId) return NextResponse.json({ error: 'serviceOrderId required' }, { status: 400 })

    if (approve) {
      await supabase.from('service_timeline').insert({
        service_order_id: serviceOrderId, teknisi_id: user.id, status: 'pending_approved',
        message: 'QC menyetujui permintaan pending teknisi',
        details: { action: 'pending_approved', approved_by: user.id },
      })
      return NextResponse.json({ success: true, message: 'Pending disetujui. Service aktif kembali.' })
    } else {
      await supabase.from('service_orders').update({ assigned_teknisi_id: null }).eq('id', serviceOrderId)
      await supabase.from('service_timeline').insert({
        service_order_id: serviceOrderId, teknisi_id: user.id, status: 'pending_rejected',
        message: 'QC menolak permintaan pending teknisi. Service kembali ke antrian.',
        details: { action: 'pending_rejected', rejected_by: user.id },
      })
      return NextResponse.json({ success: true, message: 'Pending ditolak. Service kembali ke antrian.' })
    }
  } catch (error: any) {
    console.error('[Approve Pending Error]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
