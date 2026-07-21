import { NextRequest, NextResponse } from 'next/server'
import { resolveChatId, sendTelegramMessage } from '@/lib/telegram'

export async function POST(request: NextRequest) {
  try {
    const { new_caption, channel } = await request.json()

    if (!new_caption) {
      return NextResponse.json({ error: 'new_caption required' }, { status: 400 })
    }

    let chatId = '';
    if (channel && process.env[`TELEGRAM_CHANNEL_${channel.toUpperCase()}`]) {
      chatId = await resolveChatId(process.env[`TELEGRAM_CHANNEL_${channel.toUpperCase()}`]!);
    }

    if (!chatId) {
      return NextResponse.json({ error: 'Channel not configured' }, { status: 400 })
    }

    await sendTelegramMessage({ chatId, text: new_caption });

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('❌ Send message error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
