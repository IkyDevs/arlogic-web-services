'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import toast from 'react-hot-toast'

export type UploadType = 'attendance' | 'service' | 'layanan' | 'inventory' | 'kaspin' | 'teknisi_update' | 'qc_update'

export interface UploadFileResult {
  url: string
  chat_id: string
  message_id: number
  file_id?: string
}

export interface PhotoFile {
  id: string
  file: File
  preview: string
  name: string
  size: number
  status: 'pending' | 'ready' | 'uploading' | 'success' | 'error'
  progress: number
  error?: string
  result?: UploadFileResult
}

export interface PhotoUploadOptions {
  type: UploadType
  caption?: string
  maxFiles?: number
  maxTotalSize?: number
}

const MB = 1024 * 1024
const ALLOWED_MIMES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'image/avif']
const ALLOWED_EXT = /\.(jpg|jpeg|png|webp|heic|heif|avif)$/i

function generateId(): string {
  return `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
}

export function usePhotoUpload() {
  const [photos, setPhotos] = useState<PhotoFile[]>([])
  const [uploading, setUploading] = useState(false)
  const [overallProgress, setOverallProgress] = useState(0)
  const abortRef = useRef(false)
  const previewUrlsRef = useRef<Set<string>>(new Set())

  const trackPreview = useCallback((url: string) => {
    previewUrlsRef.current.add(url)
  }, [])

  const cleanupPreviews = useCallback(() => {
    previewUrlsRef.current.forEach((url) => URL.revokeObjectURL(url))
    previewUrlsRef.current.clear()
  }, [])

  useEffect(() => {
    return () => cleanupPreviews()
  }, [cleanupPreviews])

  const validateFiles = useCallback((
    rawFiles: File[],
    options: PhotoUploadOptions,
  ): File[] => {
    const maxFiles = options.maxFiles || 10

    if (photos.length + rawFiles.length > maxFiles) {
      toast.error(`Maksimal ${maxFiles} foto per upload`)
      return []
    }

    return rawFiles.filter((f) => {
      if (!ALLOWED_MIMES.includes(f.type) && !ALLOWED_EXT.test(f.name)) {
        toast.error(`"${f.name}" bukan format gambar yang didukung`)
        return false
      }
      if (f.size > 20 * MB) {
        toast.error(`"${f.name}" terlalu besar (max 20MB)`)
        return false
      }
      return true
    })
  }, [photos.length])

  const addPhotos = useCallback(async (
    rawFiles: File[],
    options: PhotoUploadOptions = { type: 'service' },
  ): Promise<PhotoFile[]> => {
    const valid = validateFiles(rawFiles, options)
    if (!valid.length) return []

    const newPhotos: PhotoFile[] = valid.map((f) => ({
      id: generateId(),
      file: f,
      preview: '',
      name: f.name,
      size: f.size,
      status: 'pending' as const,
      progress: 0,
    }))

    const previewPhotos: PhotoFile[] = newPhotos.map((p) => {
      const url = URL.createObjectURL(p.file)
      trackPreview(url)
      return { ...p, preview: url, status: 'ready' as const, progress: 100 }
    })

    setPhotos((prev) => [...prev, ...previewPhotos])
    return previewPhotos
  }, [validateFiles, trackPreview])

  const uploadPhotos = useCallback(async (
    files: PhotoFile[],
    options: PhotoUploadOptions,
  ): Promise<PhotoFile[]> => {
    if (!files?.length || abortRef.current) return []

    const maxTotalSize = options.maxTotalSize || 50 * MB
    const totalSize = files.reduce((s, f) => s + f.file.size, 0)
    if (totalSize > maxTotalSize) {
      toast.error(`Ukuran total terlalu besar (${(totalSize / MB).toFixed(1)}MB)`)
      return []
    }

    setUploading(true)
    setOverallProgress(10)
    abortRef.current = false

    const uploadFiles = files.map((f) => f.file)

    setPhotos((prev) =>
      prev.map((p) =>
        files.some((f) => f.id === p.id) ? { ...p, status: 'uploading' as const, progress: 10 } : p,
      ),
    )

    try {
      const formData = new FormData()
      for (const f of uploadFiles) formData.append('files', f, f.name)
      formData.append('type', options.type)
      if (options.caption) formData.append('caption', options.caption)

      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), 120000)

      setOverallProgress(40)

      let res: Response
      try {
        res = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
          signal: controller.signal,
        })
        clearTimeout(timer)
      } catch (fetchErr: any) {
        clearTimeout(timer)
        throw new Error(
          fetchErr.name === 'AbortError'
            ? 'Koneksi tidak stabil. Coba lagi.'
            : 'Tidak dapat terhubung ke server.',
        )
      }

      if (abortRef.current) return []

      const text = await res.text()
      let data: any
      try {
        data = JSON.parse(text)
      } catch {
        throw new Error(`Server error (HTTP ${res.status}). ${text.slice(0, 150).replace(/\n/g, ' ')}`)
      }
      if (!res.ok) throw new Error(data.details || data.error || `Upload gagal (${res.status})`)
      if (!data.urls?.length) throw new Error('Foto gagal dikirim. Coba lagi.')

      setOverallProgress(100)

      const results: PhotoFile[] = files.map((f, i) => ({
        ...f,
        status: 'success' as const,
        progress: 100,
        result: {
          url: data.urls[i] || '',
          chat_id: data.messages?.[i]?.chat_id || '',
          message_id: data.messages?.[i]?.message_id || 0,
          file_id: data.file_ids?.[i] || '',
        },
      }))

      setPhotos((prev) =>
        prev.map((p) => {
          const match = results.find((r) => r.id === p.id)
          return match || p
        }),
      )

      toast.success(`${results.length} foto berhasil diupload`)
      return results
    } catch (e: any) {
      const msg = e.message || ''
      setPhotos((prev) =>
        prev.map((p) =>
          files.some((f) => f.id === p.id)
            ? { ...p, status: 'error' as const, error: msg, progress: 0 }
            : p,
        ),
      )

      if (msg.includes('koneksi') || msg.includes('Server error') || msg.includes('timeout') || msg.includes('network')) {
        toast.error(msg)
      } else {
        toast.error(msg || 'Gagal upload')
      }
      return []
    } finally {
      setUploading(false)
      setTimeout(() => setOverallProgress(0), 500)
    }
  }, [])

  const uploadFile = useCallback(async (
    file: File,
    options: PhotoUploadOptions,
  ): Promise<UploadFileResult | null> => {
    const temp: PhotoFile = {
      id: generateId(),
      file,
      preview: '',
      name: file.name,
      size: file.size,
      status: 'pending',
      progress: 0,
    }
    const results = await uploadPhotos([temp], options)
    return results[0]?.result || null
  }, [uploadPhotos])

  const addAndUpload = useCallback(async (
    rawFiles: File[],
    options: PhotoUploadOptions,
  ): Promise<UploadFileResult[]> => {
    const processed = await addPhotos(rawFiles, options)
    if (!processed.length) return []
    const results = await uploadPhotos(processed, options)
    return results.map((r) => r.result).filter((r): r is UploadFileResult => !!r)
  }, [addPhotos, uploadPhotos])

  const removePhoto = useCallback((id: string) => {
    setPhotos((prev) => {
      const target = prev.find((p) => p.id === id)
      if (target?.preview) {
        URL.revokeObjectURL(target.preview)
        previewUrlsRef.current.delete(target.preview)
      }
      return prev.filter((p) => p.id !== id)
    })
  }, [])

  const cancel = useCallback(() => {
    abortRef.current = true
    setUploading(false)
    setOverallProgress(0)
  }, [])

  const reset = useCallback(() => {
    cleanupPreviews()
    setPhotos([])
    setUploading(false)
    setOverallProgress(0)
    abortRef.current = false
  }, [cleanupPreviews])

  const retryFailed = useCallback(async (options: PhotoUploadOptions) => {
    const failed = photos.filter((p) => p.status === 'error')
    if (!failed.length) return
    await uploadPhotos(failed, options)
  }, [photos, uploadPhotos])

  const hasChanges = photos.some((p) => p.status === 'ready' || p.status === 'pending' || p.status === 'error')
  const hasSuccess = photos.some((p) => p.status === 'success')
  const hasError = photos.some((p) => p.status === 'error')

  return {
    photos,
    uploading,
    overallProgress,
    hasChanges,
    hasSuccess,
    hasError,
    addPhotos,
    uploadPhotos,
    uploadFile,
    addAndUpload,
    removePhoto,
    cancel,
    reset,
    retryFailed,
  }
}
