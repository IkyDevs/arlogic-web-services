import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    let query = supabase
      .from('layanan')
      .select(`
        *,
        handled_by_profile:profiles!handled_by(id, full_name),
        created_by_profile:profiles!created_by(id, full_name)
      `)
      .order('created_at', { ascending: false })

    if (profile?.role !== 'owner' && profile?.role !== 'admin') {
      query = query.or(`created_by.eq.${user.id},handled_by.eq.${user.id}`)
    }

    const { data, error } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data })
  } catch (error: any) {
    console.error('[Layanan GET Error]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const {
      customer_name,
      customer_whatsapp,
      jenis_layanan,
      handled_by,
      metode_pembayaran,
      lead_source,
      lead_source_custom,
      detail_sku,
      nominal
    } = body

    if (!customer_name || !jenis_layanan) {
      return NextResponse.json({
        error: 'Customer name and service type are required'
      }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('layanan')
      .insert({
        customer_name,
        customer_whatsapp,
        jenis_layanan,
        handled_by: handled_by || null,
        metode_pembayaran,
        lead_source: lead_source_custom || lead_source,
        lead_source_custom: lead_source_custom || null,
        detail_sku,
        nominal: nominal ? parseFloat(nominal) : 0,
        created_by: user.id
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, data })
  } catch (error: any) {
    console.error('[Layanan POST Error]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { id, ...updateData } = body

    if (!id) {
      return NextResponse.json({ error: 'Transaction ID is required' }, { status: 400 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    const { data: existing } = await supabase
      .from('layanan')
      .select('*')
      .eq('id', id)
      .single()

    if (!existing) {
      return NextResponse.json({ error: 'Transaction not found' }, { status: 404 })
    }

    const isOwnerOrAdmin = profile?.role === 'owner' || profile?.role === 'admin'
    const isCreator = existing.created_by === user.id
    const isHandler = existing.handled_by === user.id

    if (!isOwnerOrAdmin && !isCreator && !isHandler) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 })
    }

    const cleanData: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(updateData)) {
      if (value !== undefined) cleanData[key] = value
    }
    if (cleanData.nominal !== undefined) {
      cleanData.nominal = parseFloat(cleanData.nominal as string) || 0
    }

    const { data, error } = await supabase
      .from('layanan')
      .update(cleanData)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, data })
  } catch (error: any) {
    console.error('[Layanan PUT Error]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
