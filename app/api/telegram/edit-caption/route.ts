import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { editMessageCaption } from '@/lib/telegram'

export async function POST(request: NextRequest) {
  try {
    const { service_order_id, new_caption } = await request.json()

    if (!service_order_id || !new_caption) {
      return NextResponse.json({ error: 'service_order_id and new_caption required' }, { status: 400 })
    }

    const supabase = await createClient()

    // Cari dokumentasi TERBARU (stage qc > progress > initial) — yang captionnya paling relevan
    const { data: docs } = await supabase
      .from('service_documentation')
      .select('id, telegram_chat_id, telegram_message_id, stage')
      .eq('service_order_id', service_order_id)
      .neq('telegram_chat_id', '')
      .neq('telegram_message_id', 0)
      .order('created_at', { ascending: false }) // TERBARU dulu
      .limit(5)

    if (!docs || docs.length === 0) {
      return NextResponse.json({ error: 'No telegram message found for this service order' }, { status: 404 })
    }

    // Debug: log what we found
    console.log('📝 Edit caption — found docs:', docs.map(d => ({ id: d.id, stage: d.stage, chat_id: d.telegram_chat_id, msg_id: d.telegram_message_id })))
    console.log('📝 New caption:', new_caption.substring(0, 200) + '...')

    // Coba edit caption di SEMUA dokumentasi yang punya telegram ref
    let lastError = ''
    for (const doc of docs) {
      if (doc.telegram_chat_id && doc.telegram_message_id) {
        const ok = await editMessageCaption(doc.telegram_chat_id, doc.telegram_message_id, new_caption)
        if (ok) {
          console.log(`✅ Caption edited for doc ${doc.id} (stage: ${doc.stage})`)
          return NextResponse.json({ success: true, edited_doc_id: doc.id, stage: doc.stage })
        }
        lastError = `Failed for doc ${doc.id} (stage: ${doc.stage})`
        console.warn('⚠️', lastError)
      }
    }

    return NextResponse.json({ error: lastError || 'Failed to edit caption on any message' }, { status: 500 })
  } catch (error: any) {
    console.error('❌ Edit caption error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
