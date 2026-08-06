import { UploadServiceConfig } from './upload-types'

function env(key: string, fallback: string): string {
  return (typeof process !== 'undefined' && process.env?.[key]) || fallback
}

function envInt(key: string, fallback: number): number {
  return parseInt(env(key, String(fallback)), 10) || fallback
}

function envBool(key: string, fallback: boolean): boolean {
  const val = env(key, String(fallback))
  return val === 'true' || val === '1'
}

export const uploadServiceConfig: UploadServiceConfig = {
  maxFiles: envInt('UPLOAD_MAX_FILES', 20),
  maxSizeMB: envInt('UPLOAD_MAX_SIZE_MB', 15),
  maxVideoSizeMB: envInt('UPLOAD_MAX_VIDEO_SIZE_MB', 50),
  maxTotalSizeMB: envInt('UPLOAD_MAX_TOTAL_SIZE_MB', 100),
  compressTargetKB: envInt('UPLOAD_COMPRESS_TARGET_KB', 1024),
  compressQuality: envInt('UPLOAD_COMPRESS_QUALITY', 80),
  compressMaxDimension: envInt('UPLOAD_COMPRESS_MAX_DIM', 1920),
  allowedTypes: env('UPLOAD_ALLOWED_TYPES', 'image/jpeg,image/png,image/webp,image/heic,image/heif,video/mp4,video/quicktime,video/webm,video/3gpp')
    .split(',').map(t => t.trim()).filter(Boolean),
  supabaseBucket: env('UPLOAD_SUPABASE_BUCKET', 'uploads'),
  telegramRetryCount: envInt('UPLOAD_TELEGRAM_RETRY', 3),
  cleanupTTLHours: envInt('UPLOAD_CLEANUP_TTL_HOURS', 24),
}

export function isAllowedMime(mime: string): boolean {
  return uploadServiceConfig.allowedTypes.includes(mime)
}

export function getExtensionPattern(): RegExp {
  return /\.(jpg|jpeg|png|webp|heic|heif|avif)$/i
}

export function isAllowedFile(file: { type: string; name: string }): boolean {
  return isAllowedMime(file.type) || getExtensionPattern().test(file.name)
}

export function getMaxSizeBytes(): number {
  return uploadServiceConfig.maxSizeMB * 1024 * 1024
}

const VIDEO_MIMES = new Set(['video/mp4', 'video/quicktime', 'video/webm', 'video/3gpp', 'video/x-msvideo'])

export function isVideoFile(file: { type: string; name?: string }): boolean {
  if (VIDEO_MIMES.has(file.type)) return true
  return /\.(mp4|mov|webm|3gp|3gpp|avi)$/i.test(file.name || '')
}

export function getVideoMaxSizeBytes(): number {
  return uploadServiceConfig.maxVideoSizeMB * 1024 * 1024
}
