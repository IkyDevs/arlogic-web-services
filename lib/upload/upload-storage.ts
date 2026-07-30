import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { uploadServiceConfig } from './upload-config'
import { SignedUrl, UploadFileRecord } from './upload-types'

const BUCKET = uploadServiceConfig.supabaseBucket

export async function generateSignedUploadUrls(
  files: Array<{ filename: string; mime_type: string }>,
  sessionId: string,
): Promise<SignedUrl[]> {
  const sb = getSupabaseAdmin() as any

  await ensureBucket()

  const results: SignedUrl[] = await Promise.all(
    files.map(async (f, i) => {
      const path = `sessions/${sessionId}/${i}_${Date.now()}_${f.filename}`
      try {
        const { data, error } = await sb.storage
          .from(BUCKET)
          .createSignedUploadUrl(path)

        if (error || !data) {
          throw new Error(error?.message || 'Failed to create signed URL')
        }

        const { data: urlData } = sb.storage
          .from(BUCKET)
          .getPublicUrl(path)

        return {
          file_id: '',
          signed_url: data.signedUrl,
          filename: f.filename,
          public_url: urlData.publicUrl,
        }
      } catch (e) {
        throw new Error(`Signed URL failed for ${f.filename}: ${(e as Error).message}`)
      }
    }),
  )

  return results
}

async function ensureBucket(): Promise<void> {
  const sb = getSupabaseAdmin() as any
  try {
    const { data: buckets } = await sb.storage.listBuckets()
    if (!buckets?.find((b: any) => b.name === BUCKET)) {
      await sb.storage.createBucket(BUCKET, {
        public: true,
        fileSizeLimit: uploadServiceConfig.maxSizeMB * 1024 * 1024,
      })
    }
  } catch {
    // bucket might already exist
  }
}

export async function downloadFromSupabase(path: string): Promise<Buffer> {
  const sb = getSupabaseAdmin() as any
  const { data, error } = await sb.storage
    .from(BUCKET)
    .download(path)

  if (error) throw new Error(`Failed to download from Supabase: ${error.message}`)
  if (!data) throw new Error('No data returned from Supabase download')

  const arrayBuffer = await data.arrayBuffer()
  return Buffer.from(arrayBuffer)
}

export async function deleteFromSupabase(path: string): Promise<void> {
  const sb = getSupabaseAdmin() as any
  const { error } = await sb.storage
    .from(BUCKET)
    .remove([path])

  if (error) {
    console.error('[UploadStorage] Delete error:', error.message)
  }
}

export async function cleanupSessionFiles(sessionId: string, files: UploadFileRecord[]): Promise<void> {
  const paths = files
    .map(f => f.supabase_path)
    .filter((p): p is string => !!p)

  if (paths.length === 0) return

  const sb = getSupabaseAdmin() as any
  const { error } = await sb.storage
    .from(BUCKET)
    .remove(paths)

  if (error) {
    console.error('[UploadStorage] Cleanup error:', error.message)
  }
}

export async function listStaleFiles(prefix: string, olderThanMs: number): Promise<string[]> {
  const sb = getSupabaseAdmin() as any
  const { data, error } = await sb.storage
    .from(BUCKET)
    .list(prefix)

  if (error) return []

  const cutoff = Date.now() - olderThanMs
  const stale: string[] = []

  for (const item of data || []) {
    const created = new Date(item.created_at || 0).getTime()
    if (created < cutoff) {
      stale.push(`${prefix}/${item.name}`)
    }
  }

  return stale
}
