import { isAllowedFile, isVideoFile, getMaxSizeBytes, getVideoMaxSizeBytes, uploadServiceConfig } from './upload-config'
import { PendingFile } from './upload-types'

export interface ValidationResult {
  valid: boolean
  errors: string[]
  files: File[]
}

export function validateFiles(
  files: File[],
  currentCount: number = 0,
): ValidationResult {
  const errors: string[] = []
  const valid: File[] = []
  const maxFiles = uploadServiceConfig.maxFiles
  const maxSizeBytes = getMaxSizeBytes()

  if (currentCount + files.length > maxFiles) {
    errors.push(`Maksimal ${maxFiles} foto per upload (sudah ada ${currentCount})`)
    return { valid: false, errors, files: [] }
  }

  for (const f of files) {
    if (f.size === 0) {
      errors.push(`"${f.name}" adalah file kosong`)
      continue
    }

    if (!isAllowedFile(f)) {
      errors.push(`"${f.name}" bukan format gambar yang didukung`)
      continue
    }

    const isVideo = isVideoFile(f)
    const maxBytes = isVideo ? getVideoMaxSizeBytes() : maxSizeBytes
    if (f.size > maxBytes) {
      errors.push(`"${f.name}" terlalu besar (max ${isVideo ? uploadServiceConfig.maxVideoSizeMB : uploadServiceConfig.maxSizeMB}MB)`)
      continue
    }

    valid.push(f)
  }

  const totalSize = valid.reduce((s, f) => s + f.size, 0)
  const maxTotal = uploadServiceConfig.maxTotalSizeMB * 1024 * 1024
  if (totalSize > maxTotal) {
    errors.push(`Total ukuran terlalu besar (max ${uploadServiceConfig.maxTotalSizeMB}MB)`)
    return { valid: false, errors, files: [] }
  }

  return { valid: errors.length === 0, errors, files: valid }
}

export function checkDuplicateFiles(
  newFiles: File[],
  existing: PendingFile[],
): { files: File[]; duplicates: string[] } {
  const existingNames = new Set(existing.map(f => f.name))
  const existingSizes = new Set(existing.map(f => f.size))
  const duplicates: string[] = []
  const unique: File[] = []

  for (const f of newFiles) {
    if (existingNames.has(f.name) && existingSizes.has(f.size)) {
      duplicates.push(f.name)
    } else {
      unique.push(f)
    }
  }

  return { files: unique, duplicates }
}

export function validateCorrupted(file: File): Promise<boolean> {
  return new Promise((resolve) => {
    if (!file.type.startsWith('image/')) {
      resolve(true)
      return
    }
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(true)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      resolve(false)
    }
    img.src = url
    setTimeout(() => {
      URL.revokeObjectURL(url)
      resolve(false)
    }, 10000)
  })
}
