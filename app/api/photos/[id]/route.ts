import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { searchParams } = new URL(request.url)

    const sb = getSupabaseAdmin()
    const { data: photo, error } = await (sb
      .from('photos') as any)
      .select('*')
      .eq('id', id)
      .single()

    if (error || !photo) {
      const { data: doc } = await (sb
        .from('service_documentation') as any)
        .select('photo_url')
        .eq('id', id)
        .maybeSingle()

      if (doc?.photo_url) {
        const res = await fetch(doc.photo_url)
        if (!res.ok) throw new Error('Photo not found')
        const blob = await res.blob()
        return new Response(blob, {
          headers: { 'Content-Type': 'image/jpeg', 'Cache-Control': 'public, max-age=3600' },
        })
      }

      return NextResponse.json({ error: 'Photo not found' }, { status: 404 })
    }

    // Try Telegram CDN
    if (photo.file_id && TELEGRAM_BOT_TOKEN) {
      const fileRes = await fetch(
        `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getFile?file_id=${photo.file_id}`,
        { signal: AbortSignal.timeout(10000) }
      )
      const fileData = await fileRes.json()
      if (fileData.ok && fileData.result?.file_path) {
        (sb.from('photos') as any).update({ last_verified_at: new Date().toISOString() }).eq('id', id).then().catch(() => {})
        const tgUrl = `https://api.telegram.org/file/bot${TELEGRAM_BOT_TOKEN}/${fileData.result.file_path}`
        return NextResponse.redirect(tgUrl)
      }
    }

    // Fallback: base64
    if (photo.photo_data) {
      const buffer = Buffer.from(photo.photo_data, 'base64')
      return new Response(buffer, {
        headers: {
          'Content-Type': photo.mime_type || 'image/jpeg',
          'Cache-Control': 'public, max-age=86400',
        },
      })
    }

    return NextResponse.json({ error: 'Photo not found' }, { status: 404 })
  } catch (error: any) {
    console.error('[Photo Proxy Error]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
