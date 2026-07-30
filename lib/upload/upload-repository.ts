import { getSupabaseAdmin } from '@/lib/supabase/admin'
import {
  UploadSession,
  UploadFileRecord,
  UploadSessionStatus,
  UploadFileStatus,
  TransactionType,
} from './upload-types'

function db() {
  return getSupabaseAdmin() as any
}

export async function createSession(data: {
  transaction_type: TransactionType
  transaction_id: string
  created_by: string
  total_files: number
}): Promise<UploadSession> {
  const { data: session, error } = await db()
    .from('upload_sessions')
    .insert(data)
    .select()
    .single()

  if (error) throw new Error(`Failed to create session: ${error.message}`)
  return session as UploadSession
}

export async function createUploadFiles(
  sessionId: string,
  files: Array<{ filename: string; file_size: number; mime_type: string }>,
): Promise<UploadFileRecord[]> {
  const records = files.map(f => ({
    session_id: sessionId,
    filename: f.filename,
    file_size: f.file_size,
    mime_type: f.mime_type,
    status: 'PENDING' as UploadFileStatus,
  }))

  const { data, error } = await db()
    .from('upload_files')
    .insert(records)
    .select()

  if (error) throw new Error(`Failed to create upload files: ${error.message}`)
  return (data || []) as UploadFileRecord[]
}

export async function getSessionById(id: string): Promise<UploadSession | null> {
  const { data, error } = await db()
    .from('upload_sessions')
    .select('*')
    .eq('id', id)
    .single()

  if (error) return null
  return data as UploadSession
}

export async function getFilesBySessionId(sessionId: string): Promise<UploadFileRecord[]> {
  const { data, error } = await db()
    .from('upload_files')
    .select('*')
    .eq('session_id', sessionId)
    .order('created_at')

  if (error) return []
  return (data || []) as UploadFileRecord[]
}

export async function updateSessionStatus(
  id: string,
  status: UploadSessionStatus,
  extra?: { error_message?: string | null; completed_files?: number; retry_count?: number },
): Promise<void> {
  const update: Record<string, unknown> = { status }
  if (extra?.error_message !== undefined) update.error_message = extra.error_message
  if (extra?.completed_files !== undefined) update.completed_files = extra.completed_files
  if (extra?.retry_count !== undefined) update.retry_count = extra.retry_count

  const { error } = await db()
    .from('upload_sessions')
    .update(update)
    .eq('id', id)

  if (error) throw new Error(`Failed to update session: ${error.message}`)
}

export async function updateUploadFile(
  id: string,
  data: {
    status?: UploadFileStatus
    supabase_path?: string
    telegram_file_id?: string
    telegram_file_unique_id?: string
    telegram_chat_id?: string
    telegram_message_id?: number
    error_message?: string
  },
): Promise<void> {
  const update: Record<string, unknown> = { ...data, updated_at: new Date().toISOString() }
  const { error } = await db()
    .from('upload_files')
    .update(update)
    .eq('id', id)

  if (error) throw new Error(`Failed to update upload file: ${error.message}`)
}

export async function savePhotoCaption(data: {
  upload_file_id: string
  transaction_type: string
  transaction_id: string
  caption: string
  created_by: string
}): Promise<void> {
  const { error } = await db()
    .from('photo_captions')
    .insert(data)

  if (error) throw new Error(`Failed to save photo caption: ${error.message}`)
}

export async function updatePhotoCaption(
  uploadFileId: string,
  caption: string,
  updatedBy: string,
): Promise<void> {
  const { error } = await db()
    .from('photo_captions')
    .update({ caption, updated_by: updatedBy, updated_at: new Date().toISOString() })
    .eq('upload_file_id', uploadFileId)

  if (error) throw new Error(`Failed to update photo caption: ${error.message}`)
}

export async function getPhotoCaption(uploadFileId: string): Promise<string | null> {
  const { data, error } = await db()
    .from('photo_captions')
    .select('caption')
    .eq('upload_file_id', uploadFileId)
    .maybeSingle()

  if (error || !data) return null
  return (data as any).caption as string
}

export async function createAuditLog(data: {
  session_id: string
  event: string
  status: string
  details?: Record<string, unknown>
  duration_ms?: number
  error_message?: string
  created_by?: string
}): Promise<void> {
  const { error } = await db()
    .from('upload_audit_logs')
    .insert({
      session_id: data.session_id,
      event: data.event,
      status: data.status,
      details: data.details || {},
      duration_ms: data.duration_ms || null,
      error_message: data.error_message || null,
      created_by: data.created_by || null,
    })

  if (error) console.error('[UploadRepo] Audit log error:', error.message)
}

export async function getPendingSessions(limit: number = 10): Promise<UploadSession[]> {
  const { data, error } = await db()
    .from('upload_sessions')
    .select('*')
    .in('status', ['QUEUED', 'UPLOADING', 'FAILED'])
    .order('created_at')
    .limit(limit)

  if (error) return []
  return (data || []) as UploadSession[]
}

export async function getExpiredSessions(hours: number = 24): Promise<UploadSession[]> {
  const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString()
  const { data, error } = await db()
    .from('upload_sessions')
    .select('*')
    .in('status', ['SUCCESS', 'FAILED', 'CANCELLED'])
    .lt('updated_at', cutoff)
    .lt('updated_at', cutoff)
    .limit(50)

  if (error) return []
  return (data || []) as UploadSession[]
}

export async function cleanupSessionData(sessionId: string): Promise<void> {
  await db().from('upload_files').delete().eq('session_id', sessionId)
  await db().from('photo_captions').delete().eq('transaction_id', sessionId)
  await db().from('upload_sessions').delete().eq('id', sessionId)
}
