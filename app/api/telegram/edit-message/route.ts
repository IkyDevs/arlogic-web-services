import { NextRequest, NextResponse } from 'next/server'
import { telegramEditMessageSchema } from '@/lib/validation/schemas'

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const parsed = telegramEditMessageSchema.parse(body)

    if (!TELEGRAM_BOT_TOKEN) {
      return NextResponse.json({ error: 'TELEGRAM_BOT_TOKEN not configured' }, { status: 500 })
    }

    const endpoint = parsed.is_caption ? 'editMessageCaption' : 'editMessageText'
    const payload: Record<string, unknown> = {
      chat_id: parsed.chat_id,
      message_id: parsed.message_id,
      parse_mode: 'HTML',
    }

    if (parsed.is_caption) {
      payload.caption = parsed.text
    } else {
      payload.text = parsed.text
    }

    const response = await fetch(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/${endpoint}`,
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
