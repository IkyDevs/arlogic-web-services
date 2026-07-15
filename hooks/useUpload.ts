import { useState } from 'react'
import toast from 'react-hot-toast'
import heic2any from 'heic2any'

const isHeic = (file: File) =>
  /\.heic$/i.test(file.name) || file.type === 'image/heic' || file.type === 'image/heif'

const convertHeicToJpeg = async (file: File): Promise<File> => {
  let result: Blob | Blob[]
  try {
    result = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.92 })
  } catch (e) {
    console.error('❌ heic2any conversion failed:', e)
    throw e
  }
  const blob = Array.isArray(result) ? result[0] : result
  const jpgName = file.name.replace(/\.heic$/i, '.jpg').replace(/\.heif$/i, '.jpg')
  return new File([blob], jpgName, { type: 'image/jpeg' })
}

const compressImageOnClient = (file: File): Promise<Blob> => {
  return new Promise((resolve) => {
    const img = new Image()
    const objectUrl = URL.createObjectURL(file)

    img.onload = () => {
      try {
        const canvas = document.createElement('canvas')
        // Telegram recommends max 1280px — use 1600px for better quality
        const maxDimension = 1600
        let width = img.width
        let height = img.height

        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width)
            width = maxDimension
          } else {
            width = Math.round((width * maxDimension) / height)
            height = maxDimension
          }
        }

        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          URL.revokeObjectURL(objectUrl)
          resolve(file)
          return
        }

        // White background agar PNG transparan tidak jadi hitam
        ctx.fillStyle = '#FFFFFF'
        ctx.fillRect(0, 0, width, height)
        ctx.drawImage(img, 0, 0, width, height)

        canvas.toBlob(
          (blob) => {
            URL.revokeObjectURL(objectUrl)
            resolve(blob || file)
          },
          'image/jpeg',
          0.92
        )
      } catch {
        URL.revokeObjectURL(objectUrl)
        resolve(file)
      }
    }

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      resolve(file)
    }

    img.src = objectUrl
  })
}

export interface UploadFileResult {
  url: string
  chat_id: string
  message_id: number
}

export function useUpload() {
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)

  const uploadFiles = async (
    files: File[],
    options: { 
      type: 'attendance' | 'service' | 'layanan' | 'inventory' | 'teknisi_update' | 'qc_update'
      caption?: string
      formData?: Record<string, any>
    }
  ): Promise<UploadFileResult[]> => {
    if (!files || files.length === 0) {
      toast.error('Tidak ada file untuk diupload')
      return []
    }

    setUploading(true)
    setProgress(0)

    try {
      for (const file of files) {
        if (file.size > 20 * 1024 * 1024) {
          toast.error(`File "${file.name}" terlalu besar. Maksimal 20MB`)
          return []
        }
        if (!file.type.startsWith('image/')) {
          toast.error(`File "${file.name}" bukan gambar`)
          return []
        }
      }

      // Process files sequentially (avoid mobile memory overload)
      const compressed: File[] = []
      const total = files.length

      for (let i = 0; i < total; i++) {
        const file = files[i]
        const pct = Math.round(((i) / total) * 40)
        setProgress(pct)

        try {
          const workFile = isHeic(file) ? await convertHeicToJpeg(file) : file
          if (workFile.type === 'image/jpeg' && workFile.size <= 200 * 1024) {
            compressed.push(workFile)
          } else {
            const blob = await compressImageOnClient(workFile)
            const jpgName = workFile.name.replace(/\.[^.]+$/i, '.jpg')
            compressed.push(new File([blob], jpgName, { type: 'image/jpeg' }))
          }
        } catch {
          compressed.push(file)
        }
        setProgress(Math.round(((i + 1) / total) * 40))
      }

      const formData = new FormData()
      for (const f of compressed) {
        formData.append('files', f)
      }
      
      formData.append('type', options.type)
      if (options.caption) formData.append('caption', options.caption)
      if (options.formData) formData.append('formData', JSON.stringify(options.formData))

      const progressInterval = setInterval(() => {
        setProgress(prev => Math.min(prev + 3, 90))
      }, 300)

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      })

      clearInterval(progressInterval)
      setProgress(100)

      const rawText = await response.text()
      let data: any
      try {
        data = JSON.parse(rawText)
      } catch (parseError) {
        console.error('❌ Server non-JSON response:', rawText)
        throw new Error(`Server returned invalid response (Status ${response.status}). ${rawText.slice(0, 150)}`)
      }

      if (!response.ok) {
        throw new Error(data.details || data.error || `Upload failed (Status ${response.status})`)
      }

      if (!data.urls || data.urls.length === 0) {
        console.error('❌ Upload returned 0 URLs — Telegram upload may have failed silently')
        toast.error('Foto gagal dikirim ke Telegram. Service tetap tersimpan tanpa foto.')
        return []
      }

      const results: UploadFileResult[] = (data.urls || []).map((url: string, i: number) => ({
        url,
        chat_id: data.messages?.[i]?.chat_id || '',
        message_id: data.messages?.[i]?.message_id || 0,
      }))
      toast.success(`${results.length} foto berhasil diupload!`)
      return results
      
    } catch (error: any) {
      console.error('❌ Upload error:', error)
      toast.error(error.message || 'Gagal upload foto, coba lagi')
      return []
    } finally {
      setUploading(false)
      setTimeout(() => setProgress(0), 1000)
    }
  }

  const uploadFile = async (
    file: File,
    options: { 
      type: 'attendance' | 'service' | 'layanan' | 'inventory' | 'teknisi_update' | 'qc_update'
      caption?: string
      formData?: Record<string, any>
    }
  ): Promise<UploadFileResult | null> => {
    const results = await uploadFiles([file], options)
    return results.length > 0 ? results[0] : null
  }

  return { uploadFile, uploadFiles, uploading, progress }
}
