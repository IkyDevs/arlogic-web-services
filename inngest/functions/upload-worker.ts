import { inngest } from '@/inngest/client'
import {
  getSessionById,
  getFilesBySessionId,
  updateSessionStatus,
  updateUploadFile as updateFile,
  createAuditLog,
} from '@/lib/upload/upload-repository'
import { downloadFromSupabase, deleteFromSupabase } from '@/lib/upload/upload-storage'
import { uploadMultipleToTelegram } from '@/lib/telegram'
import { UPLOAD_EVENTS, TransactionType } from '@/lib/upload/upload-types'
import { enqueueRetry } from '@/lib/upload/upload-queue'

export const processUploadSession = inngest.createFunction(
  {
    id: 'process-upload-session',
    name: 'Process Upload Session',
    retries: 0,
    triggers: [{ event: UPLOAD_EVENTS.SESSION_QUEUED }],
  },
  async ({ event, step }) => {
    const { session_id, transaction_type, created_by } = event.data as {
      session_id: string
      transaction_type: TransactionType
      transaction_id: string
      created_by: string
    }
    const startedAt = Date.now()

    const session = await step.run('validate-session', async () => {
      const s = await getSessionById(session_id)
      if (!s) throw new Error(`Session ${session_id} not found`)
      if (s.status !== 'WAITING' && s.status !== 'QUEUED') {
        throw new Error(`Session ${session_id} in invalid status: ${s.status}`)
      }
      return s
    })

    await step.run('update-status', async () => {
      await updateSessionStatus(session_id, 'UPLOADING')
      await createAuditLog({
        session_id,
        event: 'WORKER_STARTED',
        status: 'UPLOADING',
        details: { transaction_type, started_at: new Date().toISOString() },
        created_by,
      })
    })

    const files = await step.run('get-files', async () => {
      return getFilesBySessionId(session_id)
    })

    if (files.length === 0) {
      await step.run('handle-empty', async () => {
        await updateSessionStatus(session_id, 'SUCCESS', { completed_files: 0 })
        await createAuditLog({
          session_id,
          event: 'SUCCESS',
          status: 'SUCCESS',
          details: { message: 'No files to process' },
          created_by,
        })
      })
      return { status: 'SUCCESS', processed: 0 }
    }

    let completedCount = 0
    let hasError = false

    for (let i = 0; i < files.length; i++) {
      const file = files[i]

      if (!file.supabase_path) {
        completedCount++
        await step.run(`mark-skipped-${i}`, async () => {
          await updateFile(file.id, { status: 'FAILED', error_message: 'No Supabase path' })
        })
        continue
      }

      let buffer: Buffer | null = null
      const supabaseStart = Date.now()

      try {
        buffer = await step.run(`download-supabase-${i}`, async () => {
          return downloadFromSupabase(file.supabase_path!)
        }) as unknown as Buffer

        await createAuditLog({
          session_id,
          event: 'SUPABASE_UPLOADED',
          status: 'SUCCESS',
          details: { file_id: file.id, filename: file.filename, size: buffer!.length, duration_ms: Date.now() - supabaseStart },
          created_by,
        })
      } catch (e) {
        hasError = true
        const errMsg = e instanceof Error ? e.message : String(e)
        await updateFile(file.id, { status: 'FAILED', error_message: errMsg })
        await createAuditLog({
          session_id, event: 'SUPABASE_UPLOADED', status: 'FAILED',
          details: { file_id: file.id, error: errMsg },
          error_message: errMsg, created_by,
        })
        continue
      }

      const telegramStart = Date.now()

      try {
        const telegramResults = await step.run(`upload-telegram-${i}`, async () => {
          return uploadMultipleToTelegram(
            [{ buffer: buffer!, name: file.filename || 'photo.jpg' }],
            '',
            transaction_type as any,
          )
        })

        const tgResult = telegramResults[0]
        if (!tgResult) throw new Error('No Telegram result')

        await updateFile(file.id, {
          status: 'SUCCESS',
          telegram_file_id: tgResult.file_id,
          telegram_chat_id: tgResult.chat_id,
          telegram_message_id: tgResult.message_id,
        })

        const telegramDuration = Date.now() - telegramStart
        await createAuditLog({
          session_id, event: 'TELEGRAM_UPLOADED', status: 'SUCCESS',
          details: { file_id: file.id, file_id_telegram: tgResult.file_id, filename: file.filename, duration_ms: telegramDuration },
          duration_ms: telegramDuration, created_by,
        })
        await createAuditLog({
          session_id, event: 'FILE_ID_SAVED', status: 'SUCCESS',
          details: { file_id: file.id, telegram_file_id: tgResult.file_id },
          created_by,
        })
      } catch (e) {
        hasError = true
        const errMsg = e instanceof Error ? e.message : String(e)
        await updateFile(file.id, { status: 'FAILED', error_message: errMsg })
        await createAuditLog({
          session_id, event: 'TELEGRAM_UPLOADED', status: 'FAILED',
          details: { file_id: file.id, error: errMsg },
          error_message: errMsg, created_by,
        })
        continue
      }

      await step.run(`cleanup-supabase-${i}`, async () => {
        try { await deleteFromSupabase(file.supabase_path!) } catch { /* non-fatal */ }
      })

      completedCount++
    }

    const totalDuration = Date.now() - startedAt

    if (hasError || completedCount < files.length) {
      const currentSession = await getSessionById(session_id)
      const retryCount = currentSession?.retry_count || 0

      await updateSessionStatus(session_id, 'FAILED', {
        completed_files: completedCount,
        error_message: `${completedCount}/${files.length} files completed`,
        retry_count: retryCount,
      })

      await createAuditLog({
        session_id, event: 'FAILED', status: 'FAILED',
        details: { completed: completedCount, total: files.length, duration_ms: totalDuration },
        duration_ms: totalDuration, created_by,
      })

      if (retryCount < 5) {
        await enqueueRetry(
          session_id,
          transaction_type,
          event.data.transaction_id || '',
          retryCount + 1,
        )
      }

      return { status: 'FAILED', processed: completedCount, total: files.length, will_retry: retryCount < 5 }
    }

    await updateSessionStatus(session_id, 'SUCCESS', { completed_files: completedCount })
    await createAuditLog({
      session_id, event: 'SUCCESS', status: 'SUCCESS',
      details: { completed: completedCount, total: files.length, duration_ms: totalDuration },
      duration_ms: totalDuration, created_by,
    })

    return { status: 'SUCCESS', processed: completedCount, duration: totalDuration }
  },
)
