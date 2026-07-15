import { NextRequest, NextResponse } from 'next/server'

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN

export async function POST(request: NextRequest) {
  try {
    const { chat_id, message_id } = await request.json()

    if (!chat_id || !message_id) {
      return NextResponse.json({ error: 'chat_id and message_id required' }, { status: 400 })
    }

    if (!TELEGRAM_BOT_TOKEN) {
      return NextResponse.json({ error: 'TELEGRAM_BOT_TOKEN not configured' }, { status: 500 })
    }

    const response = await fetch(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/deleteMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id, message_id }),
      }
    )

    const data = await response.json()

    if (!data.ok) {
      console.warn('⚠️ Telegram deleteMessage API warning:', data.description)
      // Don't throw — message might already be deleted
      return NextResponse.json({ warning: data.description, success: true })
    }

    return NextResponse.json({ success: true, message: 'Message deleted successfully' })
  } catch (error: any) {
    console.error('❌ Delete message error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
