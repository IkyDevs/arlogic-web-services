import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user role
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    // If owner or admin, return all records
    // Otherwise return only own records or assigned records
    let query = supabase
      .from('layanan')
      .select(`
        *,
        handled_by_profile:profiles!handled_by(id, full_name),
        created_by_profile:profiles!created_by(id, full_name)
      `)
      .order('created_at', { ascending: false })

    if (profile?.role === 'owner' || profile?.role === 'admin') {
      // Return all
    } else {
      // Return only own records
      query = query.or(`created_by.eq.${user.id},handled_by.eq.${user.id}`)
    }

    const { data, error } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data })
  } catch (error: any) {
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
      service_type,
      handled_by,
      payment_method,
      lead_source,
      lead_source_custom,
      sku_details,
      nominal_pembayaran
    } = body

    // Validate required fields
    if (!customer_name || !service_type) {
      return NextResponse.json({
        error: 'Customer name and service type are required'
      }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('layanan')
      .insert({
        customer_name,
        customer_whatsapp,
        service_type,
        handled_by: handled_by || null,
        payment_method,
        lead_source: lead_source_custom || lead_source,
        lead_source_custom: lead_source_custom || null,
        sku_details,
        nominal_pembayaran: nominal_pembayaran ? parseFloat(nominal_pembayaran) : 0,
        created_by: user.id
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, data })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
