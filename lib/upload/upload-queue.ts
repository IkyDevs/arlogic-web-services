import { inngest } from '@/inngest/client'
import { UPLOAD_EVENTS, TransactionType } from './upload-types'

export async function enqueueUpload(
  sessionId: string,
  transactionType: TransactionType,
  transactionId: string,
  createdBy: string,
): Promise<void> {
  await inngest.send({
    name: UPLOAD_EVENTS.SESSION_QUEUED,
    data: {
      session_id: sessionId,
      transaction_type: transactionType,
      transaction_id: transactionId,
      created_by: createdBy,
    },
  })
}

export async function enqueueRetry(
  sessionId: string,
  transactionType: TransactionType,
  transactionId: string,
  retryCount: number,
): Promise<void> {
  await inngest.send({
    name: UPLOAD_EVENTS.RETRY_STARTED,
    data: {
      session_id: sessionId,
      transaction_type: transactionType,
      transaction_id: transactionId,
      retry_count: retryCount,
    },
  })
}

export async function enqueueCleanup(
  sessionId: string,
): Promise<void> {
  await inngest.send({
    name: UPLOAD_EVENTS.CLEANUP_STARTED,
    data: {
      session_id: sessionId,
    },
  })
}
