import { useState } from 'react'
import toast from 'react-hot-toast'

interface UploadOptions {
  type: 'attendance' | 'service'
  onProgress?: (progress: number) => void
}

export function useUpload() {
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)

  const uploadFile = async (file: File, options: UploadOptions): Promise<string | null> => {
    setUploading(true)
    setProgress(0)

    try {
      // Validate file size (max 10MB before compression)
      if (file.size > 10 * 1024 * 1024) {
        toast.error('File too large. Max 10MB')
        return null
      }

      // Validate file type
      if (!file.type.startsWith('image/')) {
        toast.error('Only image files are allowed')
        return null
      }

      const formData = new FormData()
      formData.append('file', file)
      formData.append('type', options.type)

      // Simulate progress
      const progressInterval = setInterval(() => {
        setProgress(prev => Math.min(prev + 10, 90))
      }, 200)

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      })

      clearInterval(progressInterval)
      setProgress(100)

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Upload failed')
      }

      console.log(`Uploaded: ${data.fileName}`);
      console.log(`Compression: ${data.compressionRatio} saved`);
      console.log(`Original: ${(data.originalSize / 1024).toFixed(1)}KB → Compressed: ${(data.compressedSize / 1024).toFixed(1)}KB`);

      toast.success(`Photo uploaded! (${data.compressionRatio} smaller)`);

      return data.url
    } catch (error) {
      console.error('Upload error:', error)
      toast.error('Failed to upload photo')
      return null
    } finally {
      setUploading(false)
      setTimeout(() => setProgress(0), 1000)
    }
  }

  return {
    uploadFile,
    uploading,
    progress,
  }
}
