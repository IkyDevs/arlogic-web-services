import { NextRequest, NextResponse } from 'next/server'
import { CHANNELS, getChannel } from '@/lib/telegram'

export async function GET(request: NextRequest) {
  const type = request.nextUrl.searchParams.get('type') || 'layanan'
  const branch = request.nextUrl.searchParams.get('branch') || undefined
  const chatId = getChannel(type as keyof typeof CHANNELS, branch) || (CHANNELS as any).layanan || ''
  return NextResponse.json({ chat_id: chatId, type, branch })
}
