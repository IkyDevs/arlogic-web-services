import { serve } from 'inngest/next'
import { inngest } from '@/inngest/client'
import { processUploadSession } from '@/inngest/functions/upload-worker'
import { retryUploadSession } from '@/inngest/functions/upload-retry'
import { cleanupUploadSession, batchCleanupExpired } from '@/inngest/functions/upload-cleanup'

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    processUploadSession,
    retryUploadSession,
    cleanupUploadSession,
    batchCleanupExpired,
  ],
})
