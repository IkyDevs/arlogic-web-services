import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const TELEGRAM_CHANNEL = process.env.TELEGRAM_CHANNEL_SERVICE || '@arlogic_storage'
const BATCH_SIZE = 20

async function getFile(fileId: string): Promise<boolean> {
  if (!TELEGRAM_BOT_TOKEN) return false
  try {
    const res = await fetch(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getFile?file_id=${fileId}`,
      { signal: AbortSignal.timeout(10000) }
    )
    const data = await res.json()
    return data?.ok === true && !!data.result?.file_path
  } catch {
    return false
  }
}

async function reuploadPhoto(photoData: string, filename: string, caption: string): Promise<string | null> {
  if (!TELEGRAM_BOT_TOKEN) return null
  try {
    const buffer = Buffer.from(photoData, 'base64')
    const blob = new Blob([buffer], { type: 'image/jpeg' })
    const formData = new FormData()
    formData.append('chat_id', TELEGRAM_CHANNEL)
    formData.append('photo', blob, filename)
    formData.append('caption', caption || `Keep-alive re-upload: ${filename}`)

    const res = await fetch(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendPhoto`,
      { method: 'POST', body: formData, signal: AbortSignal.timeout(30000) }
    )
    const data = await res.json()
    if (data?.ok && data.result?.photo?.length > 0) {
      const photos = data.result.photo
      return photos[photos.length - 1].file_id
    }
    return null
  } catch (e) {
    console.error('[KeepAlive] Re-upload failed:', (e as Error).message)
    return null
  }
}

export async function GET(request: Request) {
  try {
    // Auth check via secret
    const authHeader = request.headers.get('authorization')
    const expectedToken = process.env.CRON_SECRET
    if (expectedToken && authHeader !== `Bearer ${expectedToken}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!TELEGRAM_BOT_TOKEN) {
      return NextResponse.json({ error: 'TELEGRAM_BOT_TOKEN not configured' }, { status: 500 })
    }

    const sb = getSupabaseAdmin()
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    // Ambil foto yang perlu dicek (refreshed_at > 30 hari atau belum pernah)
    const { data: photos, error } = await (sb
      .from('photos') as any)
      .select('*')
      .or(`refreshed_at.lt.${thirtyDaysAgo.toISOString()},refreshed_at.is.null`)
      .limit(BATCH_SIZE)

    if (error) {
      console.error('[KeepAlive] Query error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!photos || photos.length === 0) {
      return NextResponse.json({ success: true, checked: 0, message: 'No photos need refresh' })
    }

    let checked = 0
    let refreshed = 0
    let failed = 0

    for (const photo of photos) {
      checked++
      const isAlive = await getFile(photo.file_id)

      if (isAlive) {
        // File masih hidup, update timestamp
        await (sb.from('photos') as any)
          .update({ refreshed_at: new Date().toISOString(), refresh_count: (photo.refresh_count || 0) + 1, last_verified_at: new Date().toISOString() })
          .eq('id', photo.id)
        continue
      }

      // File expired - re-upload from photo_data
      if (!photo.photo_data) {
        console.warn(`[KeepAlive] No photo_data for ${photo.id}, skipping`)
        failed++
        continue
      }

      const newFileId = await reuploadPhoto(photo.photo_data, photo.filename || `photo_${photo.id}.jpg`, `Keep-alive: ${photo.filename || photo.id}`)

      if (newFileId) {
        await (sb.from('photos') as any)
          .update({
            file_id: newFileId,
            refreshed_at: new Date().toISOString(),
            refresh_count: (photo.refresh_count || 0) + 1,
            last_verified_at: new Date().toISOString(),
          })
          .eq('id', photo.id)
        refreshed++
        console.log(`[KeepAlive] Re-uploaded ${photo.id}: ${photo.file_id} -> ${newFileId}`)
      } else {
        failed++
        console.error(`[KeepAlive] Failed to re-upload ${photo.id}`)
      }
    }

    return NextResponse.json({
      success: true,
      checked,
      refreshed,
      failed,
      message: `Checked ${checked}, refreshed ${refreshed}, failed ${failed}`,
    })
  } catch (error: any) {
    console.error('[KeepAlive] Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
