/**
 * Central Upload Service — Single Source of Truth for all uploads.
 *
 * Components MUST NOT:
 * - Know about Telegram, Supabase, Cloudflare, Queue, Retry, or Storage
 * - Upload directly to any backend
 * - Handle compression or validation themselves
 *
 * Components only need to call:
 *   UploadService.upload(files, options)
 *
 * Or for two-phase:
 *   UploadService.addFiles(files, sessionKey)  // store to IndexedDB
 *   UploadService.submit(formData, sessionKey)  // submit transaction + enqueue
 */

import {
  PendingFile,
  TransactionType,
  CreateSessionResponse,
  UploadCompleteResponse,
  UploadSessionStatus,
} from './upload-types'
import { uploadServiceConfig } from './upload-config'
import { validateFiles, checkDuplicateFiles, validateCorrupted } from './upload-validator'
import { compressFilesGenerator } from './upload-compressor'
import { generateId, createObjectURL, revokeObjectURL } from './upload-utils'
import {
  saveFileToIndexedDB,
  getFileFromIndexedDB,
  removeFileFromIndexedDB,
  clearSessionFiles,
  saveMetadataToIndexedDB,
  getMetadataFromIndexedDB,
  removeMetadataFromIndexedDB,
} from './indexeddb-storage'

export class UploadService {
  private pendingFiles: Map<string, PendingFile[]> = new Map()

  async addFiles(
    rawFiles: File[],
    sessionKey: string,
    options: {
      maxFiles?: number
      transactionType?: TransactionType
    } = {},
  ): Promise<{ files: PendingFile[]; errors: string[] }> {
    const current = this.pendingFiles.get(sessionKey) || []
    console.log('[DEBUG:UploadService] addFiles ENTER', {
      rawFiles_count: rawFiles.length,
      sessionKey,
      existing_in_map: current.length,
      map_keys: Array.from(this.pendingFiles.keys()),
    })

    const { files: uniqueFiles, duplicates } = checkDuplicateFiles(rawFiles, current)
    const errors: string[] = duplicates.map(
      name => `"${name}" sudah ditambahkan (duplicate)`,
    )
    if (duplicates.length > 0) {
      console.log('[DEBUG:UploadService] duplicates found', duplicates)
    }

    const validation = validateFiles(uniqueFiles, current.length)
    if (!validation.valid) {
      console.log('[DEBUG:UploadService] validation FAILED', { errors: validation.errors })
      errors.push(...validation.errors)
      return { files: [], errors }
    }

    const savedFiles: PendingFile[] = []

    for (const file of validation.files) {
      const isCorrupted = await validateCorrupted(file)
      console.log('[DEBUG:UploadService] validateCorrupted', {
        fileName: file.name,
        result: isCorrupted,
      })
      if (!isCorrupted) {
        errors.push(`"${file.name}" file corrupt atau tidak dapat dibaca`)
        continue
      }

      const pendingId = generateId()
      const preview = createObjectURL(file)
      const indexedDBKey = `${sessionKey}_${pendingId}`

      await saveFileToIndexedDB(indexedDBKey, file)
      console.log('[DEBUG:UploadService] file saved to IndexedDB', {
        indexedDBKey,
        fileName: file.name,
        fileSize: file.size,
      })

      const pendingFile: PendingFile = {
        id: pendingId,
        file,
        name: file.name,
        size: file.size,
        type: file.type,
        preview,
        status: 'ready',
        uploaded: false,
      }

      savedFiles.push(pendingFile)
    }

    const updated = [...current, ...savedFiles]
    this.pendingFiles.set(sessionKey, updated)
    console.log('[DEBUG:UploadService] addFiles DONE', {
      savedFiles_count: savedFiles.length,
      total_in_map: updated.length,
      map_keys: Array.from(this.pendingFiles.keys()),
      file_names: savedFiles.map(f => f.name),
    })

    await saveMetadataToIndexedDB(`meta_${sessionKey}`, {
      files: updated.map(f => ({
        id: f.id,
        name: f.name,
        size: f.size,
        type: f.type,
        status: f.status,
        indexedDBKey: `${sessionKey}_${f.id}`,
      })),
      timestamp: Date.now(),
    })

    return { files: savedFiles, errors }
  }

  async getFiles(sessionKey: string): Promise<PendingFile[]> {
    return this.pendingFiles.get(sessionKey) || []
  }

  async removeFile(sessionKey: string, fileId: string): Promise<void> {
    const current = this.pendingFiles.get(sessionKey) || []
    const target = current.find(f => f.id === fileId)
    if (target) {
      revokeObjectURL(target.preview)
      await removeFileFromIndexedDB(`${sessionKey}_${fileId}`)
    }
    this.pendingFiles.set(
      sessionKey,
      current.filter(f => f.id !== fileId),
    )
  }

  async clearSession(sessionKey: string): Promise<void> {
    const current = this.pendingFiles.get(sessionKey) || []
    current.forEach(f => revokeObjectURL(f.preview))
    this.pendingFiles.delete(sessionKey)
    await clearSessionFiles(sessionKey)
    await removeMetadataFromIndexedDB(`meta_${sessionKey}`)
  }

  async recoverSession(sessionKey: string): Promise<PendingFile[]> {
    const meta = await getMetadataFromIndexedDB<{
      files: Array<{ id: string; name: string; size: number; type: string; indexedDBKey: string }>
      timestamp: number
    }>(`meta_${sessionKey}`)

    if (!meta) return []

    const recovered: PendingFile[] = []

    for (const m of meta.files) {
      const file = await getFileFromIndexedDB(m.indexedDBKey)
      if (file) {
        const preview = createObjectURL(file)
        recovered.push({
          id: m.id,
          file,
          name: m.name,
          size: m.size,
          type: m.type,
          preview,
          status: 'ready',
          uploaded: false,
        })
      }
    }

    this.pendingFiles.set(sessionKey, recovered)
    return recovered
  }

  async submit(
    sessionKey: string,
    formData: {
      transactionType: TransactionType
      caption?: string
      userId: string
      transactionData: Record<string, unknown>
    },
  ): Promise<{
    success: boolean
    session?: CreateSessionResponse
    errors: string[]
  }> {
    const files = this.pendingFiles.get(sessionKey) || []

    if (files.length === 0) {
      return { success: false, errors: ['Tidak ada foto untuk diupload'] }
    }

    const compressedFiles = new Map<string, File>()
    for await (const { index, file } of compressFilesGenerator(
      files.map(f => f.file),
    )) {
      compressedFiles.set(files[index].id, file)
    }

    for (const pf of files) {
      const compressed = compressedFiles.get(pf.id)
      if (compressed) {
        pf.compressed = compressed
        pf.file = compressed
      }
    }

    try {
      const transactionId = (formData.transactionData?.id || formData.transactionData?.temp_id || '') as string

      const body = {
        transaction_type: formData.transactionType,
        transaction_id: transactionId,
        files: files.map(f => ({
          id: f.id,
          filename: f.name,
          file_size: f.file.size,
          mime_type: f.type,
        })),
        caption: formData.caption || '',
        created_by: formData.userId,
      }

      const res = await fetch('/api/upload/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      const data = await res.json()

      if (!res.ok) {
        return {
          success: false,
          errors: [data.error || `Gagal membuat session (${res.status})`],
        }
      }

      this.pendingFiles.set(sessionKey, files.map(f => ({ ...f, status: 'pending' as const })))

      return { success: true, session: data as CreateSessionResponse, errors: [] }
    } catch (e) {
      return {
        success: false,
        errors: [(e as Error).message || 'Gagal terhubung ke server'],
      }
    }
  }

  async uploadToSupabase(
    session: CreateSessionResponse,
    files: PendingFile[],
    onProgress?: (completed: number, total: number) => void,
  ): Promise<{ success: boolean; errors: string[] }> {
    const errors: string[] = []
    let completed = 0

    for (let i = 0; i < session.signed_urls.length; i++) {
      const signedUrl = session.signed_urls[i]
      const file = files[i]
      if (!file || !file.file) {
        errors.push(`File index ${i} tidak ditemukan`)
        completed++
        onProgress?.(completed, session.signed_urls.length)
        continue
      }

      try {
        const res = await fetch(signedUrl.signed_url, {
          method: 'PUT',
          body: file.file,
          headers: {
            'Content-Type': file.type,
            'x-upsert': 'true',
          },
        })

        if (!res.ok) {
          errors.push(`Gagal upload "${file.name}" ke storage`)
        }
      } catch {
        errors.push(`Gagal upload "${file.name}": koneksi terputus`)
      }

      completed++
      onProgress?.(completed, session.signed_urls.length)
    }

    return { success: errors.length === 0, errors }
  }

  async completeSession(sessionId: string): Promise<UploadCompleteResponse> {
    const res = await fetch('/api/upload/complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: sessionId }),
    })

    const data = await res.json()

    if (!res.ok) {
      throw new Error(data.error || 'Gagal menyelesaikan session')
    }

    return data as UploadCompleteResponse
  }

  async checkSessionStatus(sessionId: string): Promise<UploadSessionStatus> {
    const res = await fetch(`/api/upload/session/${sessionId}`, {
      method: 'GET',
    })

    if (!res.ok) return 'FAILED'

    const data = await res.json()
    return data.status as UploadSessionStatus
  }

  async retrySession(sessionId: string): Promise<boolean> {
    try {
      const res = await fetch(`/api/upload/session/${sessionId}/retry`, {
        method: 'POST',
      })
      return res.ok
    } catch {
      return false
    }
  }

  /**
   * MVP LEGACY DIRECT UPLOAD — temporary until queue/Supabase is ready.
   * Uploads files directly to /api/upload (old multipart endpoint).
   * Returns same format as useUpload.uploadFiles().
   */
  async legacyUpload(
    files: File[],
    type: string,
    caption?: string,
    timeout?: number,
  ): Promise<Array<{ url: string; chat_id: string; message_id: number; file_id?: string }>> {
    console.log('[DEBUG:UploadService] legacyUpload CALLED', {
      files_count: files.length,
      file_names: files.map(f => f.name),
      type,
      caption_length: caption?.length || 0,
    })
    const formData = new FormData()
    for (const f of files) formData.append('files', f, f.name)
    formData.append('type', type)
    if (caption) formData.append('caption', caption)

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeout || 120000)

    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
        signal: controller.signal,
      })
      clearTimeout(timer)

      const text = await res.text()
      let data: any
      try { data = JSON.parse(text) } catch {
        throw new Error(`Server error (HTTP ${res.status})`)
      }
      if (!res.ok) throw new Error(data.details || data.error || `Upload gagal (${res.status})`)
      if (!data.urls?.length) throw new Error('Foto gagal dikirim')

      return data.urls.map((url: string, i: number) => ({
        url,
        chat_id: data.messages?.[i]?.chat_id || '',
        message_id: data.messages?.[i]?.message_id || 0,
        file_id: data.file_ids?.[i] || '',
      }))
    } catch (e: any) {
      clearTimeout(timer)
      if (e.name === 'AbortError') throw new Error('Koneksi tidak stabil. Coba lagi.')
      throw e
    }
  }
}

export const uploadService = new UploadService()
