import { useState } from 'react'
import toast from 'react-hot-toast'

const compressImageOnClient = (file: File): Promise<Blob> => {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      // Telegram recommends max 1280px for photos in media groups
      const maxDimension = 1280
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
      if (ctx) {
        ctx.drawImage(img, 0, 0, width, height)
        // High quality — Telegram supports up to 10MB per photo
        canvas.toBlob(
          (blob) => {
            URL.revokeObjectURL(img.src)
            resolve(blob || file)
          },
          'image/jpeg',
          0.92
        )
      } else {
        URL.revokeObjectURL(img.src)
        resolve(file)
      }
    }
    img.onerror = () => {
      URL.revokeObjectURL(img.src)
      resolve(file)
    }
    img.src = URL.createObjectURL(file)
  })
}

export function useUpload() {
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)

  const uploadFiles = async (
    files: File[],
    options: { 
      type: 'attendance' | 'service' | 'layanan' | 'inventory'
      caption?: string
      formData?: Record<string, any>
    }
  ): Promise<string[]> => {
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

      // Compress all files in parallel
      const compressed = await Promise.all(
        files.map(async (file) => {
          if (file.size > 200 * 1024) {
            try {
              const blob = await compressImageOnClient(file)
              return new File([blob], file.name, { type: 'image/jpeg' })
            } catch {
              return file
            }
          }
          return file
        })
      )

      const formData = new FormData()
      for (const f of compressed) {
        formData.append('files', f)
      }
      
      formData.append('type', options.type)
      if (options.caption) formData.append('caption', options.caption)
      if (options.formData) formData.append('formData', JSON.stringify(options.formData))

      const progressInterval = setInterval(() => {
        setProgress(prev => Math.min(prev + 5, 90))
      }, 200)

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
        throw new Error('No URLs returned from server')
      }

      toast.success(`${data.urls.length} foto berhasil diupload!`)
      return data.urls
      
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
      type: 'attendance' | 'service' | 'layanan' | 'inventory'
      caption?: string
      formData?: Record<string, any>
    }
  ): Promise<string | null> => {
    const urls = await uploadFiles([file], options)
    return urls.length > 0 ? urls[0] : null
  }

  return { uploadFile, uploadFiles, uploading, progress }
}
