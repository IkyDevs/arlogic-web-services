import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { uploadMultipleToTelegram } from '@/lib/telegram'
import { validateOrigin } from '@/lib/csrf'
import { rateLimitIP } from '@/lib/rate-limit'
import { UploadType } from '@/lib/validation/schemas'
import { uploadConfig, isAllowedFile } from '@/lib/uploadConfig'
import sharp from 'sharp'

const BUCKET_NAME = 'uploads'
const MB = 1024 * 1024

const CHANNEL_MAP: Record<string, 'attendance' | 'service' | 'layanan' | 'inventory' | 'kaspin' | 'teknisi_update' | 'qc_update'> = {
  attendance: 'attendance',
  service: 'service',
  layanan: 'layanan',
  inventory: 'inventory',
  kaspin: 'kaspin',
  teknisi_update: 'teknisi_update',
  qc_update: 'qc_update',
}

function log(...args: any[]) {
  if (uploadConfig.isDev) console.log('[Upload API]', ...args)
}

function warn(...args: any[]) {
  console.warn('[Upload API]', ...args)
}

function err(...args: any[]) {
  console.error('[Upload API]', ...args)
}

async function ensureBucket() {
  const sb = getSupabaseAdmin()
  try {
    const { data: buckets } = await sb.storage.listBuckets()
    if (!buckets?.find((b: any) => b.name === BUCKET_NAME)) {
      await sb.storage.createBucket(BUCKET_NAME, { public: true, fileSizeLimit: uploadConfig.IMAGE_MAX_SIZE_BYTES })
      log(`Created bucket "${BUCKET_NAME}"`)
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
    warn(`SUPABASE FAILED: ${(e as Error).message}`)
    return null
  }
}

export async function POST(request: NextRequest) {
  const profile: Record<string, number> = {}
  const tStart = performance.now()

  try {
    const contentLength = parseInt(request.headers.get('content-length') || '0', 10)
    const maxBody = uploadConfig.IMAGE_MAX_SIZE_MB * 4 * 1024 * 1024
    if (contentLength > maxBody) {
      return NextResponse.json({ error: `Request terlalu besar (${(contentLength / 1024 / 1024).toFixed(1)}MB). Maksimal ${maxBody / 1024 / 1024}MB.` }, { status: 413 })
    }

    if (!validateOrigin(request)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const rl = rateLimitIP(request)
    if (!rl.allowed) {
      warn(`RATE LIMITED: ${request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'}`)
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

    const maxFiles = uploadConfig.IMAGE_MAX_FILES
    if (files.length > maxFiles) {
      return NextResponse.json({ error: `Maksimal ${maxFiles} foto per upload.` }, { status: 400 })
    }

    let totalSize = 0
    for (const f of files) {
      if (f.size > uploadConfig.IMAGE_MAX_SIZE_BYTES) {
        return NextResponse.json({ error: `"${f.name}" terlalu besar (max ${uploadConfig.IMAGE_MAX_SIZE_MB}MB)` }, { status: 400 })
      }
      if (!isAllowedFile(f)) {
        return NextResponse.json({ error: `"${f.name}" bukan format gambar yang didukung` }, { status: 400 })
      }
      totalSize += f.size
    }

    if (totalSize > uploadConfig.IMAGE_MAX_SIZE_MB * uploadConfig.IMAGE_MAX_FILES * MB) {
      return NextResponse.json({ error: `Total ukuran terlalu besar (${(totalSize / 1024 / 1024).toFixed(1)}MB). Maksimal ${uploadConfig.IMAGE_MAX_SIZE_MB * uploadConfig.IMAGE_MAX_FILES}MB.` }, { status: 400 })
    }

    const typeResult = UploadType.safeParse(type)
    const channelType = typeResult.success ? typeResult.data : 'service'

    // Parallel file reading with auto-compression for files > 2MB
    const tProcess = performance.now()
    const timestamp = Date.now()
    const processedFiles: Array<{ buffer: Buffer; name: string }> = []

    const COMPRESS_THRESHOLD = 2 * 1024 * 1024
    const fileBuffers = await Promise.all(
      files.map(async (file) => {
        try {
          const arrayBuffer = await file.arrayBuffer()
          let buffer: Buffer = Buffer.from(arrayBuffer)
          let ext = file.name.split('.').pop() || 'jpg'
          if (buffer.length > COMPRESS_THRESHOLD) {
            try {
              const compressed = await sharp(buffer)
                .resize(1920, 1920, { fit: 'inside', withoutEnlargement: true })
                .jpeg({ quality: 80 })
                .toBuffer()
              if (compressed.length < buffer.length) {
                buffer = compressed
                ext = 'jpg'
              }
            } catch {
              // compression gagal, pakai original
            }
          }
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

    log(`Processing ${processedFiles.length} files (${(totalSize / (1024 * 1024)).toFixed(1)}MB), type=${type}`)

    // Upload to Telegram
    const tTelegram = performance.now()
    const telegramResults = await uploadMultipleToTelegram(processedFiles, caption, channelType)
    profile.uploadTelegram = Math.round(performance.now() - tTelegram)

    if (telegramResults.length === 0) {
      err('TELEGRAM FAILED: no results returned')
      return NextResponse.json({ error: 'Foto gagal dikirim ke Telegram. Coba lagi dengan file lebih kecil.' }, { status: 502 })
    }

    if (telegramResults.length < processedFiles.length) {
      warn(`TELEGRAM PARTIAL: ${telegramResults.length}/${processedFiles.length} uploaded`)
    } else {
      log(`TELEGRAM OK: ${telegramResults.length} photos`)
    }

    // Upload to Supabase Storage in parallel
    const tSupabase = performance.now()
    const supabaseUrls: (string | null)[] = await Promise.all(
      processedFiles.map((f) => uploadToSupabase(f.buffer, f.name))
    )
    profile.uploadSupabase = Math.round(performance.now() - tSupabase)

    const supabaseSuccess = supabaseUrls.filter(Boolean).length
    if (supabaseSuccess < processedFiles.length) {
      warn(`SUPABASE PARTIAL: ${supabaseSuccess}/${processedFiles.length} uploaded`)
    }

    const permanentUrls = supabaseUrls.map((u, i) => u || telegramResults[i]?.url || '')
    const fileIds = telegramResults.map(r => r.file_id || '')

    // Save to photos table (fire-and-forget, non-blocking)
    const tDb = performance.now()
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
      warn(`DATABASE FAILED: ${e.message}`)
    })
    profile.databaseInsert = Math.round(performance.now() - tDb)

    profile.total = Math.round(performance.now() - tStart)

    log(`UPLOAD COMPLETE: ${telegramResults.length} photos in ${(profile.total / 1000).toFixed(1)}s`)

    const response = {
      success: true,
      urls: permanentUrls,
      telegram_urls: telegramResults.map(r => r.url),
      file_ids: fileIds,
      messages: telegramResults.map(r => ({ chat_id: r.chat_id, message_id: r.message_id })),
      count: telegramResults.length,
      storage: 'supabase',
      channel: type,
    }

    // Profiling only in development
    if (uploadConfig.isDev) {
      return NextResponse.json({ ...response, profiling: profile })
    }

    return NextResponse.json(response)
  } catch (error: any) {
    const msg = error?.message || ''
    err(`ERROR: ${msg}`)
    if (msg.includes('TELEGRAM_BOT_TOKEN') || msg.includes('not configured')) {
      return NextResponse.json({ error: 'Konfigurasi Telegram tidak lengkap' }, { status: 500 })
    }
    if (msg.includes('timeout') || msg.includes('abort')) {
      return NextResponse.json({ error: 'Koneksi ke Telegram timeout. Coba lagi.' }, { status: 504 })
    }
    return NextResponse.json({ error: 'Upload gagal', details: msg }, { status: 500 })
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
