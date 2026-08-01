import { NextRequest, NextResponse } from 'next/server'
import { telegramMessageSchema } from '@/lib/validation/schemas'
import { getChannel, type TelegramChannelType } from '@/lib/telegram'
import { createClient } from '@/lib/supabase/server'

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN

// Map type pesan teks → tipe channel telegram
const TYPE_MAP: Record<string, TelegramChannelType> = {
  transaction: 'layanan',
  dp: 'layanan',
  inventory: 'inventory',
  service: 'service',
  attendance: 'attendance',
  customer: 'customer',
  kaspin: 'kaspin',
}

async function resolveBranchFromRequest(): Promise<string | null> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null
    const { data: profile } = await supabase.from('profiles').select('branch_id').eq('id', user.id).single()
    if (!profile?.branch_id) return null
    const { data: branch } = await supabase.from('branches').select('code').eq('id', profile.branch_id).single()
    return branch?.code || null
  } catch {
    return null
  }
}

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

    const telegramType = TYPE_MAP[parsed.type || 'transaction'] || 'layanan'
    // Branch eksplisit dari body, atau resolve otomatis dari user login
    const branchCode = body.branch || (await resolveBranchFromRequest()) || undefined
    const channelId = getChannel(telegramType, branchCode)

    if (!channelId) {
      return NextResponse.json(
        { error: `Channel ${parsed.type} not configured` },
        { status: 400 }
      )
    }

    const result = await sendMessage(channelId, parsed.message)

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: 'Message sent to Telegram',
        channel: parsed.type,
        branch: branchCode || null,
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
