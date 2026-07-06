import { useState } from 'react'
import toast from 'react-hot-toast'

// Helper function to compress images on the client side using Canvas API
const compressImageOnClient = (file: File): Promise<Blob> => {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        const maxDimension = 1280
        let width = img.width
        let height = img.height

        // Calculate new dimensions maintaining aspect ratio
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
          canvas.toBlob(
            (blob) => {
              resolve(blob || file)
            },
            'image/jpeg',
            0.85 // Quality setting (0.85 is standard compression sweet-spot)
          )
        } else {
          resolve(file)
        }
      }
      img.onerror = () => resolve(file)
      img.src = e.target?.result as string
    }
    reader.onerror = () => resolve(file)
    reader.readAsDataURL(file)
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
      
      // Compress and append all files
      for (const file of files) {
        let fileToUpload: Blob | File = file
        
        // Only compress if file is larger than 100KB to avoid unnecessary processing on tiny images
        if (file.type.startsWith('image/') && file.size > 100 * 1024) {
          try {
            console.log(`📸 Compressing ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)...`)
            fileToUpload = await compressImageOnClient(file)
            console.log(`📉 Compressed ${file.name} to ${(fileToUpload.size / 1024).toFixed(2)} KB`)
          } catch (compressError) {
            console.error(`⚠️ Client-side compression failed for ${file.name}, using original:`, compressError)
          }
        }

        const uploadFileObj = fileToUpload instanceof File 
          ? fileToUpload 
          : new File([fileToUpload], file.name, { type: file.type || 'image/jpeg' })

        formData.append('files', uploadFileObj)
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

      // Read response as text first to handle non-JSON error pages from Vercel gracefully
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