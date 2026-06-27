import { useState } from 'react'
import toast from 'react-hot-toast'

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
      // Validasi setiap file
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

      const formData = new FormData()
      
      // Append semua files
      for (const file of files) {
        formData.append('files', file)
      }
      
      formData.append('type', options.type)
      if (options.caption) {
        formData.append('caption', options.caption)
      }
      if (options.formData) {
        formData.append('formData', JSON.stringify(options.formData))
      }

      const progressInterval = setInterval(() => {
        setProgress(prev => Math.min(prev + 5, 90))
      }, 300)

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      })

      clearInterval(progressInterval)
      setProgress(100)

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || data.details || 'Upload failed')
      }

      if (!data.urls || data.urls.length === 0) {
        throw new Error('No URLs returned from server')
      }

      console.log(`✅ Upload success: ${data.count || data.urls.length} files (channel: ${data.channel || 'telegram'})`)
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

  // Single file upload (backward compatibility)
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

  return {
    uploadFile,
    uploadFiles,
    uploading,
    progress,
  }
}