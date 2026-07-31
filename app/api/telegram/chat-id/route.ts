import { NextRequest, NextResponse } from 'next/server'
import { CHANNELS } from '@/lib/telegram'

export async function GET(request: NextRequest) {
  const type = request.nextUrl.searchParams.get('type') || 'layanan'
  const chatId = (CHANNELS as any)[type] || (CHANNELS as any).layanan || ''
  return NextResponse.json({ chat_id: chatId, type })
}
