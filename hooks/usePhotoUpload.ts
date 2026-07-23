'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import toast from 'react-hot-toast'
import { uploadConfig, isAllowedFile } from '@/lib/uploadConfig'

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

export interface UploadProfiling {
  validation: number
  preview: number
  upload: number
  telegram: number
  supabase: number
  database: number
  total: number
}

const LOG_PREFIX = '[Upload]'
const MB = 1024 * 1024

function generateId(): string {
  return `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
}

function log(...args: any[]) {
  if (uploadConfig.isDev) console.log(LOG_PREFIX, ...args)
}

function warn(...args: any[]) {
  console.warn(LOG_PREFIX, ...args)
}

function error(...args: any[]) {
  console.error(LOG_PREFIX, ...args)
}

export function usePhotoUpload() {
  const [photos, setPhotos] = useState<PhotoFile[]>([])
  const [uploading, setUploading] = useState(false)
  const [overallProgress, setOverallProgress] = useState(0)
  const abortRef = useRef(false)
  const previewUrlsRef = useRef<Set<string>>(new Set())
  const [profiling, setProfiling] = useState<UploadProfiling | null>(null)
  const uploadStartRef = useRef(0)

  const trackPreview = useCallback((url: string) => {
    previewUrlsRef.current.add(url)
  }, [])

  const cleanupPreviews = useCallback(() => {
    const count = previewUrlsRef.current.size
    previewUrlsRef.current.forEach((url) => URL.revokeObjectURL(url))
    previewUrlsRef.current.clear()
    if (count > 0) log(`Cleaned ${count} blob URLs`)
  }, [])

  useEffect(() => {
    return () => {
      cleanupPreviews()
    }
  }, [cleanupPreviews])

  const validateFiles = useCallback((
    rawFiles: File[],
    options: PhotoUploadOptions,
  ): File[] => {
    const t0 = performance.now()
    const maxFiles = options.maxFiles || uploadConfig.IMAGE_MAX_FILES

    if (photos.length + rawFiles.length > maxFiles) {
      toast.error(`Maksimal ${maxFiles} foto per upload`)
      warn(`VALIDATION FAILED: max files exceeded (${photos.length + rawFiles.length} > ${maxFiles})`)
      return []
    }

    const valid = rawFiles.filter((f) => {
      if (!isAllowedFile(f)) {
        toast.error(`"${f.name}" bukan format gambar yang didukung`)
        warn(`VALIDATION FAILED: unsupported format "${f.name}" (${f.type})`)
        return false
      }
      if (f.size > uploadConfig.IMAGE_MAX_SIZE_BYTES) {
        toast.error(`"${f.name}" terlalu besar (max ${uploadConfig.IMAGE_MAX_SIZE_MB}MB)`)
        warn(`VALIDATION FAILED: file too large "${f.name}" (${(f.size / MB).toFixed(1)}MB)`)
        return false
      }
      return true
    })

    const dt = Math.round(performance.now() - t0)
    if (uploadConfig.isDev) setProfiling((p) => p ? { ...p, validation: dt } : null)
    log(`VALIDATION: ${valid.length}/${rawFiles.length} passed (${dt}ms)`)

    return valid
  }, [photos.length])

  const addPhotos = useCallback(async (
    rawFiles: File[],
    options: PhotoUploadOptions = { type: 'service' },
  ): Promise<PhotoFile[]> => {
    const t0 = performance.now()
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

    const tPreviewStart = performance.now()
    const previewPhotos: PhotoFile[] = newPhotos.map((p) => {
      const url = URL.createObjectURL(p.file)
      trackPreview(url)
      return { ...p, preview: url, status: 'ready' as const, progress: 100 }
    })

    setPhotos((prev) => [...prev, ...previewPhotos])

    const previewTime = Math.round(performance.now() - tPreviewStart)
    const totalTime = Math.round(performance.now() - t0)
    if (uploadConfig.isDev) setProfiling({ validation: 0, preview: previewTime, upload: 0, telegram: 0, supabase: 0, database: 0, total: 0 })

    log(`PREVIEW: ${previewPhotos.length} photos (${totalTime}ms)`)
    return previewPhotos
  }, [validateFiles, trackPreview])

  const uploadPhotos = useCallback(async (
    files: PhotoFile[],
    options: PhotoUploadOptions,
  ): Promise<PhotoFile[]> => {
    const t0 = performance.now()
    if (!files?.length || abortRef.current) {
      log('UPLOAD CANCELED: no files or aborted')
      return []
    }

    const maxTotalSize = options.maxTotalSize || (uploadConfig.IMAGE_MAX_SIZE_MB * MB)
    const totalSize = files.reduce((s, f) => s + f.file.size, 0)
    if (totalSize > maxTotalSize) {
      toast.error(`Ukuran total terlalu besar (${(totalSize / MB).toFixed(1)}MB)`)
      warn(`VALIDATION FAILED: total size ${(totalSize / MB).toFixed(1)}MB exceeds ${maxTotalSize / MB}MB`)
      return []
    }

    setUploading(true)
    setOverallProgress(10)
    abortRef.current = false
    uploadStartRef.current = Date.now()

    const uploadFiles = files.map((f) => f.file)

    setPhotos((prev) =>
      prev.map((p) =>
        files.some((f) => f.id === p.id) ? { ...p, status: 'uploading' as const, progress: 10 } : p,
      ),
    )

    log(`UPLOAD START: ${files.length} files, ${(totalSize / MB).toFixed(1)}MB total, type=${options.type}`)

    try {
      const formData = new FormData()
      for (const f of uploadFiles) formData.append('files', f, f.name)
      formData.append('type', options.type)
      if (options.caption) formData.append('caption', options.caption)

      const controller = new AbortController()
      const timeoutSec = uploadConfig.IMAGE_UPLOAD_TIMEOUT
      const timer = setTimeout(() => {
        warn(`UPLOAD FAILED: timeout after ${timeoutSec}s`)
        controller.abort()
      }, timeoutSec * 1000)

      setOverallProgress(30)
      const tUploadStart = performance.now()

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
        const isAbort = fetchErr.name === 'AbortError'
        const msg = isAbort
          ? 'Koneksi tidak stabil. Coba lagi.'
          : 'Tidak dapat terhubung ke server.'
        if (isAbort) warn(`UPLOAD FAILED: abort (${timeoutSec}s timeout)`)
        else warn(`UPLOAD FAILED: network (${fetchErr.message})`)
        throw new Error(msg)
      }

      if (abortRef.current) {
        log('UPLOAD CANCELED: user cancelled')
        return []
      }

      const uploadTime = Math.round(performance.now() - tUploadStart)

      const text = await res.text()
      let data: any
      try {
        data = JSON.parse(text)
      } catch {
        error(`UPLOAD FAILED: non-JSON response (HTTP ${res.status})`)
        throw new Error(`Server error (HTTP ${res.status}). ${text.slice(0, 150).replace(/\n/g, ' ')}`)
      }
      if (!res.ok) {
        error(`UPLOAD FAILED: server error (${res.status})`, data)
        throw new Error(data.details || data.error || `Upload gagal (${res.status})`)
      }
      if (!data.urls?.length) {
        error('UPLOAD FAILED: no URLs in response')
        throw new Error('Foto gagal dikirim. Coba lagi.')
      }

      setOverallProgress(100)

      const backendProfile = data.profiling || {}

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

      const totalTime = Math.round(performance.now() - t0)

      const prof: UploadProfiling = {
        validation: 0,
        preview: 0,
        upload: uploadTime,
        telegram: backendProfile.uploadTelegram || 0,
        supabase: backendProfile.uploadSupabase || 0,
        database: 0,
        total: totalTime,
      }
      if (uploadConfig.isDev) setProfiling(prof)

      const elapsed = ((Date.now() - uploadStartRef.current) / 1000).toFixed(1)
      log(`UPLOAD SUCCESS: ${results.length} photos in ${elapsed}s (telegram=${prof.telegram}ms, supabase=${prof.supabase}ms)`)

      toast.success(`${results.length} foto berhasil diupload`)
      return results
    } catch (e: any) {
      const msg = e.message || ''
      error(`UPLOAD FAILED: ${msg}`)
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
    log('UPLOAD CANCELED: user pressed cancel')
  }, [])

  const reset = useCallback(() => {
    cleanupPreviews()
    setPhotos([])
    setUploading(false)
    setOverallProgress(0)
    setProfiling(null)
    abortRef.current = false
    log('RESET: cleared all photos')
  }, [cleanupPreviews])

  const retryFailed = useCallback(async (options: PhotoUploadOptions) => {
    const failed = photos.filter((p) => p.status === 'error')
    if (!failed.length) return
    log(`RETRY: ${failed.length} failed photos`)
    await uploadPhotos(failed, options)
  }, [photos, uploadPhotos])

  const hasChanges = photos.some((p) => p.status === 'ready' || p.status === 'pending' || p.status === 'error')
  const hasSuccess = photos.some((p) => p.status === 'success')
  const hasError = photos.some((p) => p.status === 'error')

  return {
    photos,
    uploading,
    overallProgress,
    profiling,
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
