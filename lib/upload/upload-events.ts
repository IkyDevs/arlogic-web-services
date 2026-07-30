import { UPLOAD_EVENTS, TransactionType } from './upload-types'

export interface SessionQueuedEvent {
  name: typeof UPLOAD_EVENTS.SESSION_QUEUED
  data: {
    session_id: string
    transaction_type: TransactionType
    transaction_id: string
    created_by: string
  }
}

export interface RetryStartedEvent {
  name: typeof UPLOAD_EVENTS.RETRY_STARTED
  data: {
    session_id: string
    transaction_type: TransactionType
    transaction_id: string
    retry_count: number
  }
}

export interface CleanupStartedEvent {
  name: typeof UPLOAD_EVENTS.CLEANUP_STARTED
  data: {
    session_id: string
  }
}

export type UploadEvents = SessionQueuedEvent | RetryStartedEvent | CleanupStartedEvent
