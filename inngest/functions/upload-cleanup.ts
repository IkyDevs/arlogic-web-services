import { inngest } from '@/inngest/client'
import {
  getSessionById,
  getFilesBySessionId,
  getExpiredSessions,
  createAuditLog,
} from '@/lib/upload/upload-repository'
import { cleanupSessionFiles } from '@/lib/upload/upload-storage'
import { UPLOAD_EVENTS } from '@/lib/upload/upload-types'
import { UploadFileRecord } from '@/lib/upload/upload-types'

export const cleanupUploadSession = inngest.createFunction(
  {
    id: 'cleanup-upload-session',
    name: 'Cleanup Upload Session',
    retries: 0,
    triggers: [{ event: UPLOAD_EVENTS.CLEANUP_STARTED }],
  },
  async ({ event, step }) => {
    const { session_id } = event.data as { session_id: string }

    const session = await step.run('get-session', async () => {
      return getSessionById(session_id)
    })

    if (!session) {
      return { status: 'not_found', session_id }
    }

    await createAuditLog({
      session_id,
      event: 'CLEANUP_STARTED',
      status: session.status,
      details: { session_status: session.status },
    })

    const files: UploadFileRecord[] = await step.run('get-files', async () => {
      return getFilesBySessionId(session_id)
    })

    await step.run('cleanup-storage', async () => {
      await cleanupSessionFiles(session_id, files)
    })

    await createAuditLog({
      session_id,
      event: 'CLEANUP_COMPLETED',
      status: session.status,
      details: { files_cleaned: files.length },
    })

    return { status: 'cleaned', files_cleaned: files.length }
  },
)

export const batchCleanupExpired = inngest.createFunction(
  {
    id: 'batch-cleanup-expired',
    name: 'Batch Cleanup Expired Sessions',
    retries: 0,
    triggers: [{ cron: '0 */6 * * *' }],
  },
  async ({ step }) => {
    const expiredSessions = await step.run('get-expired', async () => {
      return getExpiredSessions(24)
    })

    let cleaned = 0
    for (const session of expiredSessions) {
      try {
        const files: UploadFileRecord[] = await getFilesBySessionId(session.id)
        await cleanupSessionFiles(session.id, files)
        cleaned++
      } catch (e) {
        console.error(`[Cleanup] Failed to cleanup session ${session.id}:`, e)
      }
    }

    return { cleaned, total: expiredSessions.length }
  },
)
