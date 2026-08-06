import { NextRequest, NextResponse } from 'next/server'
import {
  getSessionById,
  updateSessionStatus,
  createAuditLog,
} from '@/lib/upload/upload-repository'
import { enqueueUpload, enqueueCleanup } from '@/lib/upload/upload-queue'
import { validateOrigin } from '@/lib/csrf'

export async function POST(request: NextRequest) {
  // F0: sistem upload 2-fase (Supabase) dinonaktifkan default. Aktifkan hanya bila dibutuhkan.
  const ENABLED = typeof process !== 'undefined' && process.env?.UPLOAD_TWO_PHASE_ENABLED === '1'
  if (!ENABLED) {
    return NextResponse.json({ error: 'Sistem upload 2-fase dinonaktifkan. Gunakan jalur Telegram (legacyUpload).' }, { status: 410 })
  }

  try {
    if (!validateOrigin(request)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { session_id } = await request.json()

    if (!session_id) {
      return NextResponse.json({ error: 'Session ID required' }, { status: 400 })
    }

    const session = await getSessionById(session_id)
    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    if (session.status !== 'WAITING') {
      return NextResponse.json(
        { error: `Session in invalid status: ${session.status}` },
        { status: 409 },
      )
    }

    await updateSessionStatus(session_id, 'QUEUED')

    await createAuditLog({
      session_id,
      event: 'SESSION_QUEUED',
      status: 'QUEUED',
      details: {
        transaction_type: session.transaction_type,
        transaction_id: session.transaction_id,
      },
      created_by: session.created_by,
    })

    await enqueueUpload(
      session_id,
      session.transaction_type as any,
      session.transaction_id || '',
      session.created_by || '',
    )

    await enqueueCleanup(session_id)

    return NextResponse.json({
      session_id,
      status: 'QUEUED',
      message: 'Upload session queued for processing',
    })
  } catch (error: any) {
    console.error('[Upload Complete] Error:', error.message)
    return NextResponse.json(
      { error: error.message || 'Gagal memproses upload' },
      { status: 500 },
    )
  }
}
