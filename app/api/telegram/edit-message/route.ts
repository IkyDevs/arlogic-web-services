import { NextRequest, NextResponse } from 'next/server'

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN

export async function POST(request: NextRequest) {
  try {
    const { chat_id, message_id, text, is_caption } = await request.json()

    if (!chat_id || !message_id || !text) {
      return NextResponse.json({ error: 'chat_id, message_id, and text required' }, { status: 400 })
    }

    if (!TELEGRAM_BOT_TOKEN) {
      return NextResponse.json({ error: 'TELEGRAM_BOT_TOKEN not configured' }, { status: 500 })
    }

    const endpoint = is_caption ? 'editMessageCaption' : 'editMessageText'
    const body: any = {
      chat_id,
      message_id,
      parse_mode: 'HTML',
    }

    if (is_caption) {
      body.caption = text
    } else {
      body.text = text
    }

    const response = await fetch(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/${endpoint}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }
    )

    const data = await response.json()

    if (!data.ok) {
      console.error('❌ Telegram API error:', data.description)
      return NextResponse.json({ error: data.description }, { status: 400 })
    }

    return NextResponse.json({ success: true, message: 'Message edited successfully' })
  } catch (error: any) {
    console.error('❌ Edit message error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
