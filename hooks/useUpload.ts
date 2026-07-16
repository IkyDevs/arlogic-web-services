import { useState, useCallback, useRef } from 'react'
import toast from 'react-hot-toast'

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Gagal memuat gambar ke memori browser'))
    img.src = src
  })
}

async function processOne(file: File, index: number, prefix = 'service'): Promise<File> {
  let sourceBlob: Blob = file

  if (/\.heic$/i.test(file.name) || file.type === 'image/heic' || file.type === 'image/heif') {
    const heic2any = (await import('heic2any')).default
    const result = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.85 })
    sourceBlob = Array.isArray(result) ? result[0] : result
  }

  const imageSrc = URL.createObjectURL(sourceBlob)

  const img = new Image()
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve()
    img.onerror = () => reject(new Error('Gagal memuat gambar ke memori browser'))
    img.src = imageSrc
  })
  URL.revokeObjectURL(imageSrc)

  let { width, height } = img
  const maxDim = 1600
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
  if (!ctx) throw new Error('Gagal menginisialisasi canvas')

  ctx.fillStyle = '#FFFFFF'
  ctx.fillRect(0, 0, width, height)
  ctx.drawImage(img, 0, 0, width, height)

  const compressedBlob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error('Canvas gagal memproses biner gambar'))
    }, 'image/jpeg', 0.70)
  })

  const cleanFile = new File([compressedBlob], `${prefix}_${Date.now()}_${index}.jpg`, { type: 'image/jpeg' })
  return cleanFile
}

export async function compressFiles(
  files: File[],
  onProgress?: (done: number, total: number) => void,
  prefix = 'service',
): Promise<File[]> {
  const compressed: File[] = []
  for (let i = 0; i < files.length; i++) {
    const result = await processOne(files[i], i, prefix)
    compressed.push(result)
    onProgress?.(i + 1, files.length)
  }

  const totalBytes = compressed.reduce((s, f) => s + f.size, 0)
  if (totalBytes > 4 * 1024 * 1024) {
    throw new Error(`Ukuran total foto terlalu besar (${(totalBytes / 1024 / 1024).toFixed(1)}MB). Pilih foto dengan resolusi lebih rendah.`)
  }

  return compressed
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

    const totalBytes = files.reduce((s, f) => s + f.size, 0)
    if (totalBytes > 4 * 1024 * 1024) {
      toast.error(`Ukuran total terlalu besar (${(totalBytes / 1024 / 1024).toFixed(1)}MB). Gunakan resolusi lebih rendah.`)
      return []
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
      const timer = setTimeout(() => controller.abort(), 30000)

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
