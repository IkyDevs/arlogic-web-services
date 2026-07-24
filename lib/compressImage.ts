'use client'

const COMPRESS_THRESHOLD = 2 * 1024 * 1024
const MAX_DIM = 1920
const JPEG_QUALITY = 0.8

export function compressImage(file: File): Promise<File> {
  if (file.size <= COMPRESS_THRESHOLD) return Promise.resolve(file)

  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(img.src)
      let { width, height } = img
      if (width > MAX_DIM || height > MAX_DIM) {
        const ratio = Math.min(MAX_DIM / width, MAX_DIM / height)
        width = Math.round(width * ratio)
        height = Math.round(height * ratio)
      }
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      if (!ctx) { resolve(file); return }
      ctx.drawImage(img, 0, 0, width, height)
      canvas.toBlob(
        (blob) => {
          if (blob && blob.size < file.size) {
            const name = file.name.replace(/\.[^.]+$/, '.jpg')
            resolve(new File([blob], name, { type: 'image/jpeg' }))
          } else {
            resolve(file)
          }
        },
        'image/jpeg',
        JPEG_QUALITY,
      )
    }
    img.onerror = () => resolve(file)
    img.src = URL.createObjectURL(file)
  })
}

export async function compressFiles(files: File[]): Promise<File[]> {
  return Promise.all(files.map(compressImage))
}
