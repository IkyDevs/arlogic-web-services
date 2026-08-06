import { uploadServiceConfig } from './upload/upload-config'

function envBool(key: string, fallback: boolean): boolean {
  const val = typeof process !== 'undefined' ? process.env?.[key] : undefined
  return val === 'true' || val === '1' || (fallback && val === undefined)
}

function envInt(key: string, fallback: number): number {
  const raw = typeof process !== 'undefined' ? process.env?.[key] : undefined
  return parseInt(raw || '', 10) || fallback
}

/**
 * Unified upload configuration — jadikan `uploadServiceConfig` sebagai satu-satunya sumber
 * kebenaran. Nilai shared (max files, size, allowed types) diambil dari `upload/upload-config.ts`.
 * Nama legacy (IMAGE_*) tetap diekspor untuk menjaga konsumen lama tetap kompatibel.
 */
export const uploadConfig = {
  IMAGE_COMPRESSION_ENABLED: envBool('IMAGE_COMPRESSION_ENABLED', true),
  IMAGE_RESIZE_ENABLED: envBool('IMAGE_RESIZE_ENABLED', false),
  IMAGE_KEEP_ORIGINAL: envBool('IMAGE_KEEP_ORIGINAL', true),
  IMAGE_KEEP_EXIF: envBool('IMAGE_KEEP_EXIF', true),
  IMAGE_PARALLEL_UPLOAD: envBool('IMAGE_PARALLEL_UPLOAD', true),
  IMAGE_PARALLEL_PROCESSING: envBool('IMAGE_PARALLEL_PROCESSING', true),
  IMAGE_MAX_SIZE_MB: uploadServiceConfig.maxSizeMB,
  IMAGE_MAX_FILES: uploadServiceConfig.maxFiles,
  IMAGE_UPLOAD_TIMEOUT: envInt('IMAGE_UPLOAD_TIMEOUT', 120),
  IMAGE_ALLOWED_TYPES: uploadServiceConfig.allowedTypes,
  get IMAGE_MAX_SIZE_BYTES(): number {
    return this.IMAGE_MAX_SIZE_MB * 1024 * 1024
  },
  get isDev(): boolean {
    return (typeof process !== 'undefined' && process.env?.NODE_ENV) !== 'production'
  },
} as const

export function getAllowedExtensionsPattern(): RegExp {
  return /\.(jpg|jpeg|png|webp|heic|heif|avif|mp4|mov|webm|3gp)$/i
}

export { isAllowedMime, isAllowedFile } from './upload/upload-config'