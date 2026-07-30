export type UploadSessionStatus =
  | 'WAITING'
  | 'VALIDATING'
  | 'QUEUED'
  | 'UPLOADING'
  | 'VERIFYING'
  | 'SUCCESS'
  | 'FAILED'
  | 'CANCELLED'

export type UploadFileStatus = 'PENDING' | 'UPLOADING' | 'SUCCESS' | 'FAILED'

export type TransactionType =
  | 'layanan'
  | 'service'
  | 'attendance'
  | 'inventory'
  | 'stock_transfer'
  | 'kaspin'
  | 'teknisi_update'
  | 'qc_update'
  | 'closing'
  | 'sparepart_ready'

export interface PendingFile {
  id: string
  file: File
  name: string
  size: number
  type: string
  preview: string
  compressed?: File
  status: 'pending' | 'ready' | 'error'
  error?: string
  uploaded: boolean
}

export interface UploadSession {
  id: string
  transaction_type: TransactionType
  transaction_id: string | null
  status: UploadSessionStatus
  created_by: string
  total_files: number
  completed_files: number
  metadata: Record<string, unknown>
  error_message: string | null
  retry_count: number
  created_at: string
  updated_at: string
}

export interface UploadFileRecord {
  id: string
  session_id: string
  filename: string
  file_size: number
  mime_type: string
  status: UploadFileStatus
  supabase_path: string | null
  telegram_file_id: string | null
  telegram_file_unique_id: string | null
  telegram_chat_id: string | null
  telegram_message_id: number | null
  error_message: string | null
  created_at: string
  updated_at: string
}

export interface UploadAuditLog {
  id: string
  session_id: string | null
  event: string
  status: string
  details: Record<string, unknown>
  duration_ms: number | null
  error_message: string | null
  created_by: string | null
  created_at: string
}

export interface CreateSessionResponse {
  session_id: string
  transaction_id: string
  transaction_type: TransactionType
  signed_urls: SignedUrl[]
  upload_file_ids: string[]
}

export interface SignedUrl {
  file_id: string
  signed_url: string
  filename: string
  public_url: string
}

export interface UploadCompleteResponse {
  session_id: string
  status: UploadSessionStatus
}

export interface UploadServiceConfig {
  maxFiles: number
  maxSizeMB: number
  maxTotalSizeMB: number
  compressTargetKB: number
  compressQuality: number
  compressMaxDimension: number
  allowedTypes: string[]
  supabaseBucket: string
  telegramRetryCount: number
  cleanupTTLHours: number
}

export const UPLOAD_EVENTS = {
  SESSION_CREATED: 'upload.session.created',
  SESSION_QUEUED: 'upload.session.queued',
  WORKER_STARTED: 'upload.worker.started',
  SUPABASE_UPLOADED: 'upload.supabase.completed',
  TELEGRAM_UPLOADED: 'upload.telegram.completed',
  FILE_ID_SAVED: 'upload.file_id.saved',
  CLEANUP_STARTED: 'upload.cleanup.started',
  CLEANUP_COMPLETED: 'upload.cleanup.completed',
  RETRY_STARTED: 'upload.retry.started',
  FAILED: 'upload.failed',
  SUCCESS: 'upload.success',
} as const
