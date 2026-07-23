import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const q = searchParams.get('q')?.trim()
    if (!q || q.length < 2) return NextResponse.json({ data: { services: [], transactions: [], inventory: [], customers: [] } })

    const searchTerm = `%${q}%`

    const [services, transactions, inventory, customers] = await Promise.all([
      supabase
        .from('service_orders')
        .select('id, invoice_number, customer_name, customer_phone, watch_brand, watch_model, status, created_at')
        .or(`invoice_number.ilike.${searchTerm},customer_name.ilike.${searchTerm},customer_phone.ilike.${searchTerm},watch_brand.ilike.${searchTerm},watch_model.ilike.${searchTerm}`)
        .order('created_at', { ascending: false })
        .limit(10),

      supabase
        .from('layanan')
        .select('id, customer_name, customer_whatsapp, jenis_layanan, nominal, metode_pembayaran, created_at, detail_sku')
        .or(`customer_name.ilike.${searchTerm},customer_whatsapp.ilike.${searchTerm},detail_sku.ilike.${searchTerm}`)
        .order('created_at', { ascending: false })
        .limit(10),

      supabase
        .from('inventory')
        .select('id, item_name, sku, category, store_stock, warehouse_stock')
        .or(`item_name.ilike.${searchTerm},sku.ilike.${searchTerm},category.ilike.${searchTerm}`)
        .limit(10),

      supabase
        .from('customers')
        .select('id, name, phone, point')
        .or(`name.ilike.${searchTerm},phone.ilike.${searchTerm}`)
        .limit(10),
    ])

    return NextResponse.json({
      data: {
        services: services.data || [],
        transactions: transactions.data || [],
        inventory: inventory.data || [],
        customers: customers.data || [],
      }
    })
  } catch (error: any) {
    console.error('[Search API Error]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
