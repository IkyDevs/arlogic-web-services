import { NextRequest, NextResponse } from 'next/server'

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN

const CHANNELS = {
  transaction: process.env.TELEGRAM_CHANNEL_LAYANAN,
  dp: process.env.TELEGRAM_CHANNEL_LAYANAN,
  inventory: process.env.TELEGRAM_CHANNEL_INVENTORY,
  service: process.env.TELEGRAM_CHANNEL_SERVICE,
  attendance: process.env.TELEGRAM_CHANNEL_ATTENDANCE,
  customer: process.env.TELEGRAM_CHANNEL_CUSTOMER,
} as const

type TelegramChannelType = keyof typeof CHANNELS

async function sendMessage(
  channelId: string,
  message: string,
): Promise<boolean> {
  if (!TELEGRAM_BOT_TOKEN) {
    console.error('❌ TELEGRAM_BOT_TOKEN not configured')
    return false
  }

  try {
    const response = await fetch(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: channelId,
          text: message,
          parse_mode: 'HTML',
        }),
      }
    )

    const data = await response.json()

    if (!data.ok) {
      console.error('❌ Telegram API error:', data.description)
      return false
    }

    console.log('✅ Message sent to Telegram successfully')
    return true
  } catch (error: any) {
    console.error('❌ Failed to send message to Telegram:', error.message)
    return false
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { type, message, channel } = body

    if (!message) {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      )
    }

    const channelType = (channel || type || 'transaction') as TelegramChannelType
    const channelId = CHANNELS[channelType]

    if (!channelId) {
      console.error(`❌ Channel ID for ${channelType} not configured`)
      return NextResponse.json(
        { error: `Channel ${channelType} not configured` },
        { status: 400 }
      )
    }

    console.log(`📤 Sending Telegram message to channel: ${channelType}`)
    console.log(`📝 Message: ${message.substring(0, 100)}...`)

    const success = await sendMessage(channelId, message)

    if (success) {
      return NextResponse.json(
        {
          success: true,
          message: 'Message sent to Telegram',
          channel: channelType,
        },
        { status: 200 }
      )
    } else {
      return NextResponse.json(
        { error: 'Failed to send message to Telegram' },
        { status: 500 }
      )
    }
  } catch (error: any) {
    console.error('❌ API error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
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
