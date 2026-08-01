import { NextRequest, NextResponse } from 'next/server'
import { CHANNELS, getChannel } from '@/lib/telegram'
import { createClient } from '@/lib/supabase/server'

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

export async function GET(request: NextRequest) {
  const type = request.nextUrl.searchParams.get('type') || 'layanan'
  // Branch eksplisit, atau resolve otomatis dari user login
  const branch = request.nextUrl.searchParams.get('branch') || (await resolveBranchFromRequest()) || undefined
  const chatId = getChannel(type as keyof typeof CHANNELS, branch) || CHANNELS.layanan || ''
  return NextResponse.json({ chat_id: chatId, type, branch })
}
