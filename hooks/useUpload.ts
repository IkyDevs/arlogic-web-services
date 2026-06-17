import { useState } from 'react'
import toast from 'react-hot-toast'

export function useUpload() {
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)

  // Function to compress image in browser
  const compressImage = (file: File, maxWidth: number = 1024, quality: number = 0.75): Promise<File> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.readAsDataURL(file)
      reader.onload = (event) => {
        const img = new Image()
        img.src = event.target?.result as string
        img.onload = () => {
          const canvas = document.createElement('canvas')
          let width = img.width
          let height = img.height

          if (width > maxWidth) {
            height = (height * maxWidth) / width
            width = maxWidth
          }

          canvas.width = width
          canvas.height = height

          const ctx = canvas.getContext('2d')
          ctx?.drawImage(img, 0, 0, width, height)

          canvas.toBlob(
            (blob) => {
              if (blob) {
                const compressedFile = new File([blob], file.name, {
                  type: 'image/jpeg',
                })
                resolve(compressedFile)
              } else {
                reject(new Error('Compression failed'))
              }
            },
            'image/jpeg',
            quality
          )
        }
        img.onerror = () => reject(new Error('Failed to load image'))
      }
      reader.onerror = () => reject(new Error('Failed to read file'))
    })
  }

  const uploadFile = async (file: File, options: { type: 'attendance' | 'service' }): Promise<string | null> => {
    setUploading(true)
    setProgress(0)

    try {
      // Validate file
      if (file.size > 10 * 1024 * 1024) {
        toast.error('File too large. Max 10MB')
        return null
      }

      if (!file.type.startsWith('image/')) {
        toast.error('Only image files are allowed')
        return null
      }

      // Compress image in browser
      setProgress(20)
      const compressedFile = await compressImage(file, 1024, 0.75)
      setProgress(50)

      const formData = new FormData()
      formData.append('file', compressedFile)
      formData.append('type', options.type)

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      })

      setProgress(80)

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Upload failed')
      }

      setProgress(100)
      toast.success('Photo uploaded!')
      return data.url
    } catch (error: any) {
      console.error('Upload error:', error)
      toast.error(error.message || 'Failed to upload photo')
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
