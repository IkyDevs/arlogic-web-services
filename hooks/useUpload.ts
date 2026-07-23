/**
 * Legacy useUpload hook — backward compatible wrapper.
 * No compression. Files pass through as-is.
 * New code should use usePhotoUpload directly.
 */

import { useState, useCallback, useRef } from 'react'
import toast from 'react-hot-toast'

export interface UploadFileResult {
  url: string
  chat_id: string
  message_id: number
}

interface UploadOptions {
  type: 'attendance' | 'service' | 'layanan' | 'inventory' | 'teknisi_update' | 'qc_update'
  caption?: string
}

export function useUpload() {
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const abortRef = useRef(false)

  const uploadFiles = useCallback(async (
    files: File[],
    options: UploadOptions,
  ): Promise<UploadFileResult[]> => {
    if (!files?.length) return []
    abortRef.current = false

    if (files.length > 10) {
      toast.error('Maksimal 10 foto per upload. Pisahkan jadi beberapa kali upload.')
      return []
    }

    for (const f of files) {
      if (f.size > 20 * 1024 * 1024) { toast.error(`"${f.name}" terlalu besar (max 20MB)`); return [] }
      if (!f.type.startsWith('image/') && !f.name.match(/\.(jpg|jpeg|png|webp|heic|heif|avif)$/i)) {
        toast.error(`"${f.name}" bukan gambar`); return []
      }
    }

    setUploading(true)
    setProgress(5)

    try {
      setProgress(30)
      const formData = new FormData()
      for (const f of files) formData.append('files', f, f.name)
      formData.append('type', options.type)
      if (options.caption) formData.append('caption', options.caption)

      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), 120000)

      let res: Response
      try {
        res = await fetch('/api/upload', { method: 'POST', body: formData, signal: controller.signal })
        clearTimeout(timer)
      } catch (fetchErr: any) {
        clearTimeout(timer)
        throw new Error(fetchErr.name === 'AbortError' ? 'Koneksi tidak stabil. Coba lagi.' : 'Tidak dapat terhubung ke server.')
      }

      if (abortRef.current) return []

      const text = await res.text()
      let data: any
      try { data = JSON.parse(text) } catch {
        throw new Error(`Server error (HTTP ${res.status}). ${text.slice(0, 150).replace(/\n/g, ' ')}`)
      }
      if (!res.ok) throw new Error(data.details || data.error || `Upload gagal (${res.status})`)
      if (!data.urls?.length) throw new Error('Foto gagal dikirim. Coba lagi.')

      setProgress(100)
      const results: UploadFileResult[] = data.urls.map((url: string, i: number) => ({
        url,
        chat_id: data.messages?.[i]?.chat_id || '',
        message_id: data.messages?.[0]?.message_id || 0,
      }))

      toast.success(`${results.length} foto berhasil`)
      return results

    } catch (e: any) {
      const msg = e.message || ''
      if (msg.includes('koneksi') || msg.includes('Server error') || msg.includes('timeout') || msg.includes('network')) {
        toast.error(msg)
      } else {
        toast.error(msg || 'Gagal upload')
      }
      return []
    } finally {
      setUploading(false)
      setTimeout(() => setProgress(0), 500)
    }
  }, [])

  const uploadFile = useCallback(async (
    file: File,
    options: UploadOptions,
  ): Promise<UploadFileResult | null> => {
    const results = await uploadFiles([file], options)
    return results[0] || null
  }, [uploadFiles])

  const cancel = useCallback(() => { abortRef.current = true }, [])

  return { uploadFile, uploadFiles, uploading, progress, cancel }
}
