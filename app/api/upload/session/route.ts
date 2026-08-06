import { NextRequest, NextResponse } from 'next/server'
import { createSession, createUploadFiles, createAuditLog } from '@/lib/upload/upload-repository'
import { generateSignedUploadUrls } from '@/lib/upload/upload-storage'
import { validateOrigin } from '@/lib/csrf'
import { rateLimitIP } from '@/lib/rate-limit'
import { TransactionType } from '@/lib/upload/upload-types'
import { uploadServiceConfig } from '@/lib/upload/upload-config'

const VALID_TYPES: TransactionType[] = [
  'layanan', 'service', 'attendance', 'inventory',
  'stock_transfer', 'kaspin', 'teknisi_update', 'qc_update',
  'closing', 'sparepart_ready',
]

export async function POST(request: NextRequest) {
  // F0: sistem upload 2-fase (Supabase) dinonaktifkan default. Aktifkan hanya bila dibutuhkan.
  const ENABLED = typeof process !== 'undefined' && process.env?.UPLOAD_TWO_PHASE_ENABLED === '1'
  if (!ENABLED) {
    return NextResponse.json({ error: 'Sistem upload 2-fase dinonaktifkan. Gunakan jalur Telegram (legacyUpload).' }, { status: 410 })
  }

  const tStart = performance.now()

  try {
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

    let body: any
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const { transaction_type, transaction_id, files, caption, created_by } = body

    if (!transaction_type || !VALID_TYPES.includes(transaction_type)) {
      return NextResponse.json({ error: 'Invalid transaction type' }, { status: 400 })
    }

    if (!files?.length) {
      return NextResponse.json({ error: 'No files provided' }, { status: 400 })
    }

    if (!transaction_id) {
      return NextResponse.json({ error: 'transaction_id required' }, { status: 400 })
    }

    if (files.length > uploadServiceConfig.maxFiles) {
      return NextResponse.json(
        { error: `Maksimal ${uploadServiceConfig.maxFiles} files per session` },
        { status: 400 },
      )
    }

    const session = await createSession({
      transaction_type,
      transaction_id,
      created_by: created_by || 'system',
      total_files: files.length,
    })

    const uploadFiles = await createUploadFiles(
      session.id,
      files.map((f: any) => ({
        filename: f.filename,
        file_size: f.file_size || 0,
        mime_type: f.mime_type || 'image/jpeg',
      })),
    )

    const signedUrls = await generateSignedUploadUrls(
      files.map((f: any, i: number) => ({
        filename: f.filename || `photo_${i}.jpg`,
        mime_type: f.mime_type || 'image/jpeg',
      })),
      session.id,
    )

    const signedUrlsWithIds = signedUrls.map((url, i) => ({
      ...url,
      file_id: uploadFiles[i]?.id || '',
    }))

    if (caption && uploadFiles.length > 0) {
      const { savePhotoCaption } = await import('@/lib/upload/upload-repository')
      for (const uf of uploadFiles) {
        await savePhotoCaption({
          upload_file_id: uf.id,
          transaction_type,
          transaction_id,
          caption,
          created_by: created_by || 'system',
        }).catch(() => {})
      }
    }

    await createAuditLog({
      session_id: session.id,
      event: 'SESSION_CREATED',
      status: 'WAITING',
      details: {
        transaction_type,
        transaction_id,
        file_count: files.length,
        duration_ms: Math.round(performance.now() - tStart),
      },
      created_by,
    })

    const totalDuration = Math.round(performance.now() - tStart)

    return NextResponse.json({
      session_id: session.id,
      transaction_id,
      transaction_type,
      signed_urls: signedUrlsWithIds,
      upload_file_ids: uploadFiles.map(f => f.id),
      duration_ms: totalDuration,
    })
  } catch (error: any) {
    console.error('[Upload Session] Error:', error.message)
    return NextResponse.json(
      { error: error.message || 'Gagal membuat upload session' },
      { status: 500 },
    )
  }
}
