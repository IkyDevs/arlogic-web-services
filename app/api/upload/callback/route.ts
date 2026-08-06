import { NextRequest, NextResponse } from 'next/server'
import {
  getSessionById,
  updateUploadFile,
  updateSessionStatus,
  createAuditLog,
} from '@/lib/upload/upload-repository'
import { enqueueUpload, enqueueCleanup } from '@/lib/upload/upload-queue'

export async function POST(request: NextRequest) {
  // F0: sistem upload 2-fase (Supabase) dinonaktifkan default. Aktifkan hanya bila dibutuhkan.
  const ENABLED = typeof process !== 'undefined' && process.env?.UPLOAD_TWO_PHASE_ENABLED === '1'
  if (!ENABLED) {
    return NextResponse.json({ error: 'Sistem upload 2-fase dinonaktifkan. Gunakan jalur Telegram (legacyUpload).' }, { status: 410 })
  }

  try {
    const { session_id, file_id, status, error_message } = await request.json()

    if (!session_id || !file_id) {
      return NextResponse.json({ error: 'Missing session_id or file_id' }, { status: 400 })
    }

    if (status === 'uploaded') {
      await updateUploadFile(file_id, {
        status: 'SUCCESS',
        error_message: undefined,
      })
    } else if (status === 'failed') {
      await updateUploadFile(file_id, {
        status: 'FAILED',
        error_message: error_message || 'Upload failed',
      })
    }

    const session = await getSessionById(session_id)
    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    const newCompleted = (session.completed_files || 0) + 1
    await updateSessionStatus(session_id, session.status, {
      completed_files: newCompleted,
    })

    await createAuditLog({
      session_id,
      event: 'SUPABASE_UPLOADED',
      status: status === 'uploaded' ? 'SUCCESS' : 'FAILED',
      details: {
        file_id,
        status,
        completed: newCompleted,
        total: session.total_files,
      },
      created_by: session.created_by,
    })

    if (newCompleted >= session.total_files) {
      await updateSessionStatus(session_id, 'QUEUED')

      await enqueueUpload(
        session_id,
        session.transaction_type as any,
        session.transaction_id || '',
        session.created_by || '',
      )

      await enqueueCleanup(session_id)

      await createAuditLog({
        session_id,
        event: 'SESSION_QUEUED',
        status: 'QUEUED',
        details: { files_completed: newCompleted },
        created_by: session.created_by,
      })
    }

    return NextResponse.json({
      session_id,
      completed: newCompleted,
      total: session.total_files,
      status: newCompleted >= session.total_files ? 'QUEUED' : session.status,
    })
  } catch (error: any) {
    console.error('[Upload Callback] Error:', error.message)
    return NextResponse.json(
      { error: error.message || 'Failed to process callback' },
      { status: 500 },
    )
  }
}
