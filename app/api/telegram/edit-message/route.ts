import { NextRequest, NextResponse } from 'next/server'
import { telegramEditMessageSchema } from '@/lib/validation/schemas'
import { getBotToken, replaceTelegramDocumentation, deleteTelegramMessage } from '@/lib/telegram'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const parsed = telegramEditMessageSchema.parse(body)

    if (parsed.is_caption) {
      const supabase = await createClient()

      // Try service_documentation first (QC flow)
      const { data: doc } = await supabase
        .from('service_documentation')
        .select('id')
        .eq('telegram_chat_id', parsed.chat_id)
        .eq('telegram_message_id', parsed.message_id)
        .single()

      if (doc) {
        const result = await replaceTelegramDocumentation(doc.id, {
          newCaption: parsed.text,
        });

        if (result.success) {
          return NextResponse.json({ success: true, message: 'Caption replaced successfully' });
        }

        return NextResponse.json({ error: result.error || 'Failed to replace caption' }, { status: 500 })
      }

      // Try layanan table (transaction flow)
      const { data: layanan } = await supabase
        .from('layanan')
        .select('id, telegram_file_ids')
        .eq('telegram_chat_id', parsed.chat_id)
        .eq('telegram_message_id', parsed.message_id)
        .single()

      if (layanan) {
        const oldFileIds = (layanan.telegram_file_ids as string[]) || []
        const oldFileId = oldFileIds[0]

        if (!oldFileId) {
          return NextResponse.json({ error: 'No file_id available for resend' }, { status: 400 })
        }

        // Send new message with old file_id + new caption
        const TELEGRAM_BOT_TOKEN = await getBotToken()
        if (!TELEGRAM_BOT_TOKEN) {
          return NextResponse.json({ error: 'TELEGRAM_BOT_TOKEN not configured' }, { status: 500 })
        }

        const formData = new URLSearchParams()
        formData.append('chat_id', String(parsed.chat_id))
        formData.append('photo', oldFileId)
        formData.append('caption', parsed.text)

        const tgResponse = await fetch(
          `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendPhoto`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: formData.toString(),
          }
        )

        const tgData = await tgResponse.json()

        if (!tgData.ok) {
          console.error('Telegram API error:', tgData.description)
          return NextResponse.json({ error: tgData.description }, { status: 400 })
        }

        const newChatId = String(tgData.result.chat.id)
        const newMessageId = tgData.result.message_id
        const newFileId = tgData.result.photo[tgData.result.photo.length - 1].file_id

        // Update layanan record with new message info
        const { error: updateError } = await supabase
          .from('layanan')
          .update({
            telegram_chat_id: newChatId,
            telegram_message_id: newMessageId,
            telegram_message_ids: [newMessageId],
            telegram_file_ids: [newFileId],
            telegram_sync: 'synced',
          } as any)
          .eq('id', layanan.id)

        if (updateError) {
          console.error('Failed to update layanan:', updateError)
          // Rollback: delete the new message
          try {
            await deleteTelegramMessage(newChatId, newMessageId)
          } catch {
            // Non-fatal
          }
          return NextResponse.json({ error: `Failed to update record: ${updateError.message}` }, { status: 500 })
        }

        // Delete old message
        try {
          await deleteTelegramMessage(String(parsed.chat_id), parsed.message_id)
        } catch {
          // Non-fatal
        }

        return NextResponse.json({ success: true, message: 'Caption replaced successfully' })
      }

      return NextResponse.json({ error: 'No record found for this message' }, { status: 404 })
    }

    // Text editing (non-caption) — keep existing behavior
    const TELEGRAM_BOT_TOKEN = await getBotToken()
    if (!TELEGRAM_BOT_TOKEN) {
      return NextResponse.json({ error: 'TELEGRAM_BOT_TOKEN not configured' }, { status: 500 })
    }

    const payload: Record<string, unknown> = {
      chat_id: parsed.chat_id,
      message_id: parsed.message_id,
      parse_mode: 'HTML',
      text: parsed.text,
    }

    const response = await fetch(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/editMessageText`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }
    )

    const data = await response.json()

    if (!data.ok) {
      console.error('Telegram API error:', data.description)
      return NextResponse.json({ error: data.description }, { status: 400 })
    }

    return NextResponse.json({ success: true, message: 'Message edited successfully' })
  } catch (error: any) {
    console.error('[Edit Message Error]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
