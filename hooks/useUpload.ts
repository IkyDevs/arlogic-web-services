import { useState } from 'react'
import toast from 'react-hot-toast'

export function useUpload() {
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)

  const uploadFile = async (file: File, options: { type: 'attendance' | 'service' }): Promise<string | null> => {
    setUploading(true)
    setProgress(0)

    try {
      // Validate
      if (file.size > 10 * 1024 * 1024) {
        toast.error('File terlalu besar. Maksimal 10MB')
        setUploading(false)
        return null
      }

      if (!file.type.startsWith('image/')) {
        toast.error('Hanya file gambar yang diperbolehkan')
        setUploading(false)
        return null
      }

      const formData = new FormData()
      formData.append('file', file)
      formData.append('type', options.type)

      // Progress simulation
      const progressInterval = setInterval(() => {
        setProgress(prev => Math.min(prev + 10, 90))
      }, 200)

      console.log('📤 Sending upload request...')

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      })

      clearInterval(progressInterval)
      setProgress(100)

      console.log('📥 Response status:', response.status)

      // Parse response
      let data
      const responseText = await response.text()
      console.log('📥 Response text:', responseText)

      try {
        data = JSON.parse(responseText)
      } catch (parseError) {
        console.error('❌ Failed to parse JSON:', parseError)
        console.error('Response was:', responseText)
        throw new Error(`Server error: ${response.status} - ${responseText.substring(0, 100)}`)
      }

      if (!response.ok) {
        throw new Error(data.error || data.details || `Upload failed: ${response.status}`)
      }

      if (!data.url) {
        throw new Error('No URL returned from server')
      }

      console.log('✅ Upload success:', data.fileName)
      toast.success(`Foto berhasil diupload!`)

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
