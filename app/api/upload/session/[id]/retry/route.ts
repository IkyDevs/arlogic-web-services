import { NextRequest, NextResponse } from 'next/server'
import {
  getSessionById,
  updateSessionStatus,
  createAuditLog,
} from '@/lib/upload/upload-repository'
import { enqueueUpload } from '@/lib/upload/upload-queue'

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  // F0: sistem upload 2-fase (Supabase) dinonaktifkan default. Aktifkan hanya bila dibutuhkan.
  const ENABLED = typeof process !== 'undefined' && process.env?.UPLOAD_TWO_PHASE_ENABLED === '1'
  if (!ENABLED) {
    return NextResponse.json({ error: 'Sistem upload 2-fase dinonaktifkan. Gunakan jalur Telegram (legacyUpload).' }, { status: 410 })
  }

  const { id } = await params

  try {
    const session = await getSessionById(id)
    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    if (session.status !== 'FAILED') {
      return NextResponse.json(
        { error: `Cannot retry session in status: ${session.status}` },
        { status: 409 },
      )
    }

    await updateSessionStatus(id, 'QUEUED', {
      error_message: undefined,
      retry_count: (session.retry_count || 0) + 1,
    })

    await createAuditLog({
      session_id: id,
      event: 'RETRY_STARTED',
      status: 'QUEUED',
      details: { retry_count: session.retry_count + 1 },
      created_by: session.created_by,
    })

    await enqueueUpload(
      id,
      session.transaction_type as any,
      session.transaction_id || '',
      session.created_by || '',
    )

    return NextResponse.json({
      session_id: id,
      status: 'QUEUED',
      message: 'Retry initiated',
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to retry session' },
      { status: 500 },
    )
  }
}
