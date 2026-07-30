import { inngest } from '@/inngest/client'
import {
  getSessionById,
  updateSessionStatus,
  createAuditLog,
} from '@/lib/upload/upload-repository'
import { UPLOAD_EVENTS, TransactionType } from '@/lib/upload/upload-types'
import { enqueueUpload } from '@/lib/upload/upload-queue'

export const retryUploadSession = inngest.createFunction(
  {
    id: 'retry-upload-session',
    name: 'Retry Upload Session',
    retries: 0,
    triggers: [{ event: UPLOAD_EVENTS.RETRY_STARTED }],
  },
  async ({ event, step }) => {
    const { session_id, transaction_type, transaction_id, retry_count } = event.data as {
      session_id: string
      transaction_type: TransactionType
      transaction_id: string
      retry_count: number
    }

    await step.run('validate', async () => {
      const session = await getSessionById(session_id)
      if (!session) throw new Error(`Session ${session_id} not found`)
      if ((session.retry_count || 0) > 5) {
        throw new Error(`Session ${session_id} exceeded max retries`)
      }
    })

    await step.run('update-for-retry', async () => {
      await updateSessionStatus(session_id, 'QUEUED', {
        retry_count,
        error_message: null,
      })

      await createAuditLog({
        session_id,
        event: 'RETRY_STARTED',
        status: 'QUEUED',
        details: { retry_count, delay_ms: Math.min(1000 * Math.pow(2, retry_count), 60000) },
      })
    })

    await enqueueUpload(session_id, transaction_type, transaction_id, '')

    return { status: 'retrying', retry_count }
  },
)
