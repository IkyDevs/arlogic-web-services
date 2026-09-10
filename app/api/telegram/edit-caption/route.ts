import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { replaceTelegramDocumentation } from '@/lib/telegram'
import { telegramEditCaptionSchema } from '@/lib/validation/schemas'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const parsed = telegramEditCaptionSchema.parse(body)

    const supabase = await createClient()

    const { data: docsResult } = await supabase
      .from('service_documentation')
      .select('id, telegram_chat_id, telegram_message_id, stage')
      .eq('service_order_id', parsed.service_order_id)
      .neq('telegram_chat_id', '')
      .neq('telegram_message_id', 0)
      .eq('stage', 'qc')
      .order('created_at', { ascending: true });

    if (!docsResult || docsResult.length === 0) {
      return NextResponse.json({ error: 'No telegram message found for this service order with QC stage' }, { status: 404 })
    }

    const firstDocWithRef = docsResult[0];

    const result = await replaceTelegramDocumentation(firstDocWithRef.id, {
      newCaption: parsed.new_caption,
    });

    if (result.success) {
      return NextResponse.json({
        success: true,
        edited_doc_id: result.newDocId,
        old_doc_id: firstDocWithRef.id,
        stage: firstDocWithRef.stage,
      });
    }

    return NextResponse.json({ error: result.error || 'Failed to replace Telegram documentation' }, { status: 500 })
  } catch (error: any) {
    console.error('[Edit Caption Error]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
