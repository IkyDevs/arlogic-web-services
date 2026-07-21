import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { editMessageCaption, resolveChatId } from '@/lib/telegram'

export async function POST(request: NextRequest) {
  try {
    const { service_order_id, new_caption, channel } = await request.json()

    if (!service_order_id || !new_caption) {
      return NextResponse.json({ error: 'service_order_id and new_caption required' }, { status: 400 })
    }

    const supabase = await createClient()

    let targetChatId = '';
    if (channel && process.env[`TELEGRAM_CHANNEL_${channel.toUpperCase()}`]) {
      targetChatId = await resolveChatId(process.env[`TELEGRAM_CHANNEL_${channel.toUpperCase()}`]!);
    }

    let query = supabase
      .from('service_documentation')
      .select('id, telegram_chat_id, telegram_message_id, stage')
      .eq('service_order_id', service_order_id)
      .neq('telegram_chat_id', '')
      .neq('telegram_message_id', 0)
      .eq('stage', 'qc')
      .order('created_at', { ascending: true }); // Paling lama/pertama dulu

    if (targetChatId) {
      query = query.eq('telegram_chat_id', targetChatId);
    }

    // Ambil data
    const { data: docs_result } = await query;

    if (!docs_result || docs_result.length === 0) {
      return NextResponse.json({ error: 'No telegram message found for this service order with QC stage' }, { status: 404 })
    }

    // Cari dokumen pertama yang punya ref telegram (itu adalah foto ke-1 dari media group yang punya caption)
    const firstDocWithRef = docs_result[0]; 

    if (firstDocWithRef) {
      const ok = await editMessageCaption(firstDocWithRef.telegram_chat_id, firstDocWithRef.telegram_message_id, new_caption)
      if (ok) {
        return NextResponse.json({ success: true, edited_doc_id: firstDocWithRef.id, stage: firstDocWithRef.stage })
      }
    }

    return NextResponse.json({ error: 'Failed to edit caption on the relevant message' }, { status: 500 })
  } catch (error: any) {
    console.error('❌ Edit caption error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
