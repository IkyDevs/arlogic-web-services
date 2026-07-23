import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { uploadMultipleToTelegram } from '@/lib/telegram'
import { validateOrigin } from '@/lib/csrf'
import { rateLimitIP } from '@/lib/rate-limit'
import { UploadType } from '@/lib/validation/schemas'

const BUCKET_NAME = 'uploads'
const MAX_FILES = 10
const MAX_FILE_SIZE = 20 * 1024 * 1024
const MAX_TOTAL_SIZE = 50 * 1024 * 1024
const MAX_BODY_SIZE = 60 * 1024 * 1024
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'image/avif']

const CHANNEL_MAP: Record<string, 'attendance' | 'service' | 'layanan' | 'inventory' | 'kaspin' | 'teknisi_update' | 'qc_update'> = {
  attendance: 'attendance',
  service: 'service',
  layanan: 'layanan',
  inventory: 'inventory',
  kaspin: 'kaspin',
  teknisi_update: 'teknisi_update',
  qc_update: 'qc_update',
}

async function ensureBucket() {
  const sb = getSupabaseAdmin()
  try {
    const { data: buckets } = await sb.storage.listBuckets()
    if (!buckets?.find(b => b.name === BUCKET_NAME)) {
      await sb.storage.createBucket(BUCKET_NAME, { public: true, fileSizeLimit: MAX_FILE_SIZE })
    }
    return true
  } catch {
    return false
  }
}

async function uploadToSupabase(buffer: Buffer, fileName: string): Promise<string | null> {
  const sb = getSupabaseAdmin()
  try {
    await ensureBucket()
    const { data } = await sb.storage.from(BUCKET_NAME).upload(fileName, buffer, {
      contentType: 'image/jpeg',
      upsert: true,
    })
    if (!data) return null
    const { data: { publicUrl } } = sb.storage.from(BUCKET_NAME).getPublicUrl(fileName)
    return publicUrl
  } catch (e) {
    console.warn('Supabase storage upload failed:', e)
    return null
  }
}

export async function POST(request: NextRequest) {
  const profile: Record<string, number> = {}
  const tStart = performance.now()

  try {
    const contentLength = parseInt(request.headers.get('content-length') || '0', 10)
    if (contentLength > MAX_BODY_SIZE) {
      return NextResponse.json({ error: `Request terlalu besar (${(contentLength / 1024 / 1024).toFixed(1)}MB). Maksimal ${MAX_BODY_SIZE / 1024 / 1024}MB.` }, { status: 413 })
    }

    if (!validateOrigin(request)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const rl = rateLimitIP(request)
    if (!rl.allowed) {
      return NextResponse.json(
        { error: 'Too many requests' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil((rl.resetAt - Date.now()) / 1000)) } },
      )
    }

    let formData: FormData
    try {
      formData = await request.formData()
    } catch {
      return NextResponse.json({ error: 'Gagal membaca form data. File terlalu besar.' }, { status: 400 })
    }
    profile.readFormData = Math.round(performance.now() - tStart)

    const files = formData.getAll('files') as File[]
    const type = (formData.get('type') as string) || ''
    const caption = (formData.get('caption') as string) || ''

    if (!files.length) {
      return NextResponse.json({ error: 'Tidak ada file yang diupload' }, { status: 400 })
    }
    if (files.length > MAX_FILES) {
      return NextResponse.json({ error: `Maksimal ${MAX_FILES} foto per upload.` }, { status: 400 })
    }

    const totalSize = files.reduce((s, f) => s + f.size, 0)
    if (totalSize > MAX_TOTAL_SIZE) {
      return NextResponse.json({ error: `Total ukuran terlalu besar (${(totalSize / 1024 / 1024).toFixed(1)}MB). Maksimal ${MAX_TOTAL_SIZE / 1024 / 1024}MB.` }, { status: 400 })
    }

    for (const f of files) {
      if (f.size > MAX_FILE_SIZE) {
        return NextResponse.json({ error: `"${f.name}" terlalu besar (max ${MAX_FILE_SIZE / 1024 / 1024}MB)` }, { status: 400 })
      }
      if (!ALLOWED_TYPES.includes(f.type) && !f.name.match(/\.(jpg|jpeg|png|webp|heic|heif|avif)$/i)) {
        return NextResponse.json({ error: `"${f.name}" bukan format gambar yang didukung` }, { status: 400 })
      }
    }

    const typeResult = UploadType.safeParse(type)
    const channelType = typeResult.success ? typeResult.data : 'service'

    // Read all files in parallel, pass through as-is (no compression, no conversion)
    const tProcess = performance.now()
    const timestamp = Date.now()
    const processedFiles: Array<{ buffer: Buffer; name: string }> = []

    const fileBuffers = await Promise.all(
      files.map(async (file) => {
        try {
          const arrayBuffer = await file.arrayBuffer()
          const buffer = Buffer.from(arrayBuffer)
          const ext = file.name.split('.').pop() || 'jpg'
          const name = `${type}/${timestamp}_${Math.random().toString(36).substring(2, 8)}.${ext}`
          return { buffer, name }
        } catch {
          return null
        }
      }),
    )

    for (const result of fileBuffers) {
      if (result) processedFiles.push(result)
    }
    profile.processFiles = Math.round(performance.now() - tProcess)

    if (processedFiles.length === 0) {
      return NextResponse.json({ error: 'Gagal memproses file' }, { status: 500 })
    }

    // Upload to Telegram (parallel via sendMediaGroup)
    const tTelegram = performance.now()
    const telegramResults = await uploadMultipleToTelegram(processedFiles, caption, channelType)
    profile.uploadTelegram = Math.round(performance.now() - tTelegram)

    if (telegramResults.length === 0) {
      return NextResponse.json({ error: 'Foto gagal dikirim ke Telegram. Coba lagi dengan file lebih kecil.' }, { status: 502 })
    }

    if (telegramResults.length < processedFiles.length) {
      console.warn(`Only ${telegramResults.length}/${processedFiles.length} photos uploaded to Telegram`)
    }

    // Upload to Supabase Storage in parallel
    const tSupabase = performance.now()
    const supabaseUrls: (string | null)[] = await Promise.all(
      processedFiles.map((f) => uploadToSupabase(f.buffer, f.name))
    )
    profile.uploadSupabase = Math.round(performance.now() - tSupabase)

    const permanentUrls = supabaseUrls.map((u, i) => u || telegramResults[i]?.url || '')
    const fileIds = telegramResults.map(r => r.file_id || '')

    // Save to photos table (fire-and-forget, non-blocking)
    const sb = getSupabaseAdmin()
    const photoRecords = processedFiles.map((f, i) => ({
      file_id: telegramResults[i]?.file_id || '',
      file_unique_id: '',
      file_size: f.buffer.length,
      photo_data: f.buffer.toString('base64'),
      filename: f.name,
      stage: type,
      uploaded_by: null,
    }))

    ;(sb.from('photos') as any).insert(photoRecords).then().catch((e: any) => {
      console.warn('[Upload] Failed to save photo records:', e.message)
    })

    profile.total = Math.round(performance.now() - tStart)

    return NextResponse.json({
      success: true,
      urls: permanentUrls,
      telegram_urls: telegramResults.map(r => r.url),
      file_ids: fileIds,
      messages: telegramResults.map(r => ({ chat_id: r.chat_id, message_id: r.message_id })),
      count: telegramResults.length,
      storage: 'supabase',
      channel: type,
      profiling: profile,
    })
  } catch (error: any) {
    const msg = error?.message || ''
    if (msg.includes('TELEGRAM_BOT_TOKEN') || msg.includes('not configured')) {
      return NextResponse.json({ error: 'Konfigurasi Telegram tidak lengkap' }, { status: 500 })
    }
    if (msg.includes('timeout') || msg.includes('abort')) {
      return NextResponse.json({ error: 'Koneksi ke Telegram timeout. Coba lagi.' }, { status: 504 })
    }
    console.error('[Upload API Error]', error)
    return NextResponse.json({ error: 'Upload gagal', details: msg, profiling: { total: Math.round(performance.now() - tStart) } }, { status: 500 })
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
    },
  })
}
