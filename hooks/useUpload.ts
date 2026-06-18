import { useState } from 'react'
import toast from 'react-hot-toast'

export function useUpload() {
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)

  // Compress image di client side (sebelum upload ke server)
  const compressImage = (file: File): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.readAsDataURL(file)
      reader.onload = (event) => {
        const img = new Image()
        img.src = event.target?.result as string
        img.onload = () => {
          const canvas = document.createElement('canvas')
          const MAX_SIZE = 1024
          let width = img.width
          let height = img.height

          if (width > height) {
            if (width > MAX_SIZE) {
              height = Math.round((height * MAX_SIZE) / width)
              width = MAX_SIZE
            }
          } else {
            if (height > MAX_SIZE) {
              width = Math.round((width * MAX_SIZE) / height)
              height = MAX_SIZE
            }
          }

          canvas.width = width
          canvas.height = height
          const ctx = canvas.getContext('2d')
          ctx?.drawImage(img, 0, 0, width, height)

          canvas.toBlob((blob) => {
            if (blob) resolve(blob)
            else reject(new Error('Compression failed'))
          }, 'image/jpeg', 0.75)
        }
        img.onerror = reject
      }
      reader.onerror = reject
    })
  }

  const uploadFile = async (file: File, options: { type: 'attendance' | 'service' }): Promise<string | null> => {
    setUploading(true)
    setProgress(0)

    try {
      // Validate
      if (file.size > 10 * 1024 * 1024) {
        toast.error('File terlalu besar. Maksimal 10MB')
        return null
      }

      if (!file.type.startsWith('image/')) {
        toast.error('Hanya file gambar yang diperbolehkan')
        return null
      }

      // COMPRESS DI CLIENT SIDE
      setProgress(20)
      const compressedBlob = await compressImage(file)
      const compressedFile = new File([compressedBlob], file.name, { type: 'image/jpeg' })

      console.log(`📦 Compressed: ${(file.size / 1024).toFixed(1)}KB → ${(compressedBlob.size / 1024).toFixed(1)}KB`)
      setProgress(50)

      const formData = new FormData()
      formData.append('file', compressedFile)
      formData.append('type', options.type)

      console.log('📤 Sending upload request...')

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      })

      setProgress(80)

      console.log('📥 Response status:', response.status)

      // Parse response
      const responseText = await response.text()

      let data
      try {
        data = JSON.parse(responseText)
      } catch (parseError) {
        console.error('❌ Failed to parse JSON:', parseError)
        console.error('Response was:', responseText)
        throw new Error(`Server error: ${response.status}`)
      }

      if (!response.ok) {
        throw new Error(data.error || data.details || `Upload failed: ${response.status}`)
      }

      if (!data.url) {
        throw new Error('No URL returned from server')
      }

      setProgress(100)
      console.log('✅ Upload success:', data.fileName)
      toast.success('Foto berhasil diupload!')

      return data.url

    } catch (error: any) {
      console.error('❌ Upload error:', error)
      toast.error(error.message || 'Gagal upload foto, coba lagi')
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
