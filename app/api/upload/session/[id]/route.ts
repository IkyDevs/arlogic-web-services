import { NextRequest, NextResponse } from 'next/server'
import { getSessionById, getFilesBySessionId } from '@/lib/upload/upload-repository'

export async function GET(
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

    const files = await getFilesBySessionId(id)

    return NextResponse.json({
      ...session,
      files: files.map(f => ({
        id: f.id,
        filename: f.filename,
        file_size: f.file_size,
        status: f.status,
        telegram_file_id: f.telegram_file_id,
        error_message: f.error_message,
      })),
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to get session' },
      { status: 500 },
    )
  }
}
