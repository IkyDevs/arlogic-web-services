import { NextRequest, NextResponse } from 'next/server'
import { telegramMessageSchema } from '@/lib/validation/schemas'

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN

const CHANNELS = {
  transaction: process.env.TELEGRAM_CHANNEL_LAYANAN,
  dp: process.env.TELEGRAM_CHANNEL_LAYANAN,
  inventory: process.env.TELEGRAM_CHANNEL_INVENTORY,
  service: process.env.TELEGRAM_CHANNEL_SERVICE,
  attendance: process.env.TELEGRAM_CHANNEL_ATTENDANCE,
  customer: process.env.TELEGRAM_CHANNEL_CUSTOMER,
  kaspin: process.env.TELEGRAM_CHANNEL_KASPIN,
} as const

type TelegramChannelType = keyof typeof CHANNELS

async function sendMessage(
  channelId: string,
  message: string,
): Promise<{ success: boolean; chat_id?: string; message_id?: number }> {
  if (!TELEGRAM_BOT_TOKEN) {
    console.error('TELEGRAM_BOT_TOKEN not configured')
    return { success: false }
  }

  try {
    const response = await fetch(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: channelId, text: message, parse_mode: 'HTML' }),
      }
    )

    const data = await response.json()

    if (!data.ok) {
      console.error('Telegram API error:', data.description)
      return { success: false }
    }

    return {
      success: true,
      chat_id: String(data.result.chat.id),
      message_id: data.result.message_id,
    }
  } catch (error: any) {
    console.error('Failed to send message to Telegram:', error.message)
    return { success: false }
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const parsed = telegramMessageSchema.parse(body)

    const channelType = (parsed.type || 'transaction') as TelegramChannelType
    const channelId = CHANNELS[channelType]

    if (!channelId) {
      return NextResponse.json(
        { error: `Channel ${channelType} not configured` },
        { status: 400 }
      )
    }

    const result = await sendMessage(channelId, parsed.message)

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: 'Message sent to Telegram',
        channel: channelType,
        chat_id: result.chat_id,
        message_id: result.message_id,
      })
    } else {
      return NextResponse.json(
        { error: 'Failed to send message to Telegram' },
        { status: 500 }
      )
    }
  } catch (error: any) {
    console.error('[Telegram API Error]', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  })
}
