import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { editMessageCaption, resolveChatId } from '@/lib/telegram'
import { telegramEditCaptionSchema } from '@/lib/validation/schemas'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const parsed = telegramEditCaptionSchema.parse(body)

    const supabase = await createClient()

    let targetChatId = '';
    if (parsed.channel && process.env[`TELEGRAM_CHANNEL_${parsed.channel.toUpperCase()}`]) {
      targetChatId = await resolveChatId(process.env[`TELEGRAM_CHANNEL_${parsed.channel.toUpperCase()}`]!);
    }

    let query = supabase
      .from('service_documentation')
      .select('id, telegram_chat_id, telegram_message_id, stage')
      .eq('service_order_id', parsed.service_order_id)
      .neq('telegram_chat_id', '')
      .neq('telegram_message_id', 0)
      .eq('stage', 'qc')
      .order('created_at', { ascending: true });

    if (targetChatId) {
      query = query.eq('telegram_chat_id', targetChatId);
    }

    const { data: docsResult } = await query;

    if (!docsResult || docsResult.length === 0) {
      return NextResponse.json({ error: 'No telegram message found for this service order with QC stage' }, { status: 404 })
    }

    const firstDocWithRef = docsResult[0];

    if (firstDocWithRef) {
      const ok = await editMessageCaption(firstDocWithRef.telegram_chat_id, firstDocWithRef.telegram_message_id, parsed.new_caption)
      if (ok) {
        return NextResponse.json({ success: true, edited_doc_id: firstDocWithRef.id, stage: firstDocWithRef.stage })
      }
    }

    return NextResponse.json({ error: 'Failed to edit caption on the relevant message' }, { status: 500 })
  } catch (error: any) {
    console.error('[Edit Caption Error]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
