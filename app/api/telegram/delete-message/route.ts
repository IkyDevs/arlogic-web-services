import { NextRequest, NextResponse } from 'next/server'
import { telegramDeleteMessageSchema } from '@/lib/validation/schemas'

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const parsed = telegramDeleteMessageSchema.parse(body)

    if (!TELEGRAM_BOT_TOKEN) {
      return NextResponse.json({ error: 'TELEGRAM_BOT_TOKEN not configured' }, { status: 500 })
    }

    const response = await fetch(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/deleteMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: parsed.chat_id, message_id: parsed.message_id }),
      }
    )

    const data = await response.json()

    if (!data.ok) {
      console.warn('Telegram deleteMessage API warning:', data.description)
      return NextResponse.json({ warning: data.description, success: true })
    }

    return NextResponse.json({ success: true, message: 'Message deleted successfully' })
  } catch (error: any) {
    console.error('[Delete Message Error]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
