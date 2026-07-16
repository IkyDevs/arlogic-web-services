import { useState, useCallback, useRef } from 'react'
import toast from 'react-hot-toast'

const isHeic = (file: File) =>
  /\.heic$/i.test(file.name) || file.type === 'image/heic' || file.type === 'image/heif'

// Android Chrome rawan error canvas.toBlob — timeout fallback
function canvasToBlobSafe(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => {
    const timeout = setTimeout(() => resolve(null), 8000)
    canvas.toBlob(
      (blob) => { clearTimeout(timeout); resolve(blob) },
      type,
      quality,
    )
  })
}

async function convertHeicToJpeg(file: File): Promise<File> {
  try {
    const heic2any = (await import('heic2any')).default
    const result = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.85 })
    const blob = Array.isArray(result) ? result[0] : result
    const jpgName = file.name.replace(/\.heic$/i, '.jpg').replace(/\.heif$/i, '.jpg')
    return new File([blob], jpgName, { type: 'image/jpeg' })
  } catch {
    return file
  }
}

async function compressImage(file: File): Promise<File> {
  if (file.size <= 300 * 1024) return file

  return new Promise((resolve) => {
    const img = new Image()
    const url = URL.createObjectURL(file)

    const cleanup = () => {
      try { URL.revokeObjectURL(url) } catch { /* noop */ }
      img.src = ''
    }

    const fallback = () => { cleanup(); resolve(file) }
    const timeout = setTimeout(fallback, 15000)

    img.onload = async () => {
      clearTimeout(timeout)
      cleanup()
      const maxDim = 1200
      let { width, height } = img
      if (width > maxDim || height > maxDim) {
        if (width > height) {
          height = Math.round((height * maxDim) / width)
          width = maxDim
        } else {
          width = Math.round((width * maxDim) / height)
          height = maxDim
        }
      }
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d', { willReadFrequently: false })
      if (!ctx) { fallback(); return }
      try {
        ctx.fillStyle = '#FFFFFF'
        ctx.fillRect(0, 0, width, height)
        ctx.drawImage(img, 0, 0, width, height)
        const blob = await canvasToBlobSafe(canvas, 'image/jpeg', 0.8)
        if (blob) {
          const jpgName = file.name.replace(/\.[^.]+$/i, '.jpg')
          resolve(new File([blob], jpgName, { type: 'image/jpeg' }))
        } else {
          fallback()
        }
      } catch {
        fallback()
      }
    }

    img.onerror = () => { clearTimeout(timeout); fallback() }
    img.src = url
  })
}

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

    for (const f of files) {
      if (f.size > 20 * 1024 * 1024) { toast.error(`"${f.name}" terlalu besar (max 20MB)`); return [] }
      if (!f.type.startsWith('image/') && !f.name.match(/\.(jpg|jpeg|png|webp|heic|heif|avif)$/i)) {
        toast.error(`"${f.name}" bukan gambar`); return []
      }
    }

    setUploading(true)
    setProgress(5)

    try {
      // Process files sequentially to reduce memory pressure on Android
      const prepped: File[] = []
      for (const f of files) {
        if (abortRef.current) return []
        const converted = isHeic(f) ? await convertHeicToJpeg(f) : f
        const compressed = await compressImage(converted)
        prepped.push(compressed)
        setProgress(10 + Math.round((prepped.length / files.length) * 30))
      }

      if (abortRef.current) return []
      setProgress(40)

      const formData = new FormData()
      for (const f of prepped) formData.append('files', f)
      formData.append('type', options.type)
      if (options.caption) formData.append('caption', options.caption)

      setProgress(50)

      const controller = new AbortController()
      const fetchTimeout = setTimeout(() => controller.abort(), 60000)

      let res: Response
      try {
        res = await fetch('/api/upload', { method: 'POST', body: formData, signal: controller.signal })
      } catch (fetchErr: any) {
        clearTimeout(fetchTimeout)
        if (fetchErr.name === 'AbortError') throw new Error('Request timeout — koneksi tidak stabil')
        throw new Error('Tidak dapat terhubung ke server. Periksa koneksi internet Anda.')
      }
      clearTimeout(fetchTimeout)

      if (abortRef.current) return []

      let data: any
      try { data = await res.json() }
      catch { throw new Error('Server mengembalikan response tidak valid. Coba lagi.') }

      if (!res.ok) throw new Error(data.details || data.error || `Upload gagal (${res.status})`)

      setProgress(100)
      const results: UploadFileResult[] = (data.urls || []).map((url: string, i: number) => ({
        url,
        chat_id: data.messages?.[i]?.chat_id || '',
        message_id: data.messages?.[i]?.message_id || 0,
      }))

      toast.success(`${results.length} foto berhasil diupload`)
      return results
    } catch (e: any) {
      const msg = e.message || ''
      if (msg.includes('koneksi') || msg.includes('timeout') || msg.includes('network'))
        toast.error(msg)
      else if (msg.includes('503') || msg.includes('502') || msg.includes('504'))
        toast.error('Server sibuk. Coba upload ulang dengan lebih sedikit foto.')
      else
        toast.error(msg || 'Gagal upload foto. Coba lagi dengan file lebih kecil.')
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
