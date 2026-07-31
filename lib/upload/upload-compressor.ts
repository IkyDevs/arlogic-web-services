import { uploadServiceConfig } from './upload-config'

const TARGET_KB = uploadServiceConfig.compressTargetKB
const QUALITY = uploadServiceConfig.compressQuality / 100
const MAX_DIM = uploadServiceConfig.compressMaxDimension

export function isHeicFile(file: File): boolean {
  return file.type === 'image/heic' || file.type === 'image/heif' || /\.(heic|heif)$/i.test(file.name)
}

export function heicToJpeg(file: File): Promise<File | null> {
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
      if (!ctx) { resolve(null); return }
      ctx.drawImage(img, 0, 0, width, height)
      canvas.toBlob(
        (blob) => {
          if (blob && blob.size > 0) {
            const name = file.name.replace(/\.[^.]+$/, '.jpg')
            resolve(new File([blob], name, { type: 'image/jpeg' }))
          } else {
            resolve(null)
          }
        },
        'image/jpeg',
        QUALITY,
      )
    }
    img.onerror = () => resolve(null)
    img.src = URL.createObjectURL(file)
  })
}

export function compressImage(file: File): Promise<File> {
  const targetBytes = TARGET_KB * 1024

  if (file.size <= targetBytes) {
    return Promise.resolve(file)
  }

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
          if (blob && blob.size < file.size && blob.size > 0) {
            const name = file.name.replace(/\.[^.]+$/, '.jpg')
            resolve(new File([blob], name, { type: 'image/jpeg' }))
          } else {
            resolve(file)
          }
        },
        'image/jpeg',
        QUALITY,
      )
    }
    img.onerror = () => resolve(file)
    img.src = URL.createObjectURL(file)
  })
}

export async function* compressFilesGenerator(files: File[]): AsyncGenerator<{ index: number; file: File }> {
  for (let i = 0; i < files.length; i++) {
    const compressed = await compressImage(files[i])
    yield { index: i, file: compressed }
  }
}
