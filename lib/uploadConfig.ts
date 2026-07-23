/**
 * Centralized Upload Configuration
 *
 * All upload parameters are configured here.
 * Set via environment variables. Defaults apply when env vars are not set.
 * Never hardcode upload parameters in source code.
 */

function env(key: string, fallback: string): string {
  return (typeof process !== 'undefined' && process.env?.[key]) || fallback
}

function envBool(key: string, fallback: boolean): boolean {
  const val = env(key, String(fallback))
  return val === 'true' || val === '1'
}

function envInt(key: string, fallback: number): number {
  return parseInt(env(key, String(fallback)), 10) || fallback
}

export const uploadConfig = {
  // ── Compression & Quality ─────────────────────────────────────────────
  IMAGE_COMPRESSION_ENABLED: envBool('IMAGE_COMPRESSION_ENABLED', false),
  IMAGE_RESIZE_ENABLED: envBool('IMAGE_RESIZE_ENABLED', false),
  IMAGE_KEEP_ORIGINAL: envBool('IMAGE_KEEP_ORIGINAL', true),
  IMAGE_KEEP_EXIF: envBool('IMAGE_KEEP_EXIF', true),

  // ── File Limits ───────────────────────────────────────────────────────
  IMAGE_MAX_SIZE_MB: envInt('IMAGE_MAX_SIZE_MB', 15),
  IMAGE_MAX_FILES: envInt('IMAGE_MAX_FILES', 10),

  // ── Performance ───────────────────────────────────────────────────────
  IMAGE_PARALLEL_UPLOAD: envBool('IMAGE_PARALLEL_UPLOAD', true),
  IMAGE_PARALLEL_PROCESSING: envBool('IMAGE_PARALLEL_PROCESSING', true),

  // ── Timeouts ──────────────────────────────────────────────────────────
  IMAGE_UPLOAD_TIMEOUT: envInt('IMAGE_UPLOAD_TIMEOUT', 120),

  // ── UI ────────────────────────────────────────────────────────────────
  IMAGE_REAL_PROGRESS: envBool('IMAGE_REAL_PROGRESS', true),

  // ── Allowed MIME types ───────────────────────────────────────────────
  IMAGE_ALLOWED_TYPES: env('IMAGE_ALLOWED_TYPES', 'image/jpeg,image/png,image/webp,image/heic,image/heif')
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean),

  // ── Derived ───────────────────────────────────────────────────────────
  get IMAGE_MAX_SIZE_BYTES(): number { return this.IMAGE_MAX_SIZE_MB * 1024 * 1024 },

  // ── Dev mode ──────────────────────────────────────────────────────────
  get isDev(): boolean {
    return env('NODE_ENV', 'development') === 'development'
  },
} as const

export function getAllowedExtensionsPattern(): RegExp {
  return /\.(jpg|jpeg|png|webp|heic|heif|avif)$/i
}

export function isAllowedMime(mime: string): boolean {
  return uploadConfig.IMAGE_ALLOWED_TYPES.includes(mime)
}

export function isAllowedFile(file: { type: string; name: string }): boolean {
  return isAllowedMime(file.type) || getAllowedExtensionsPattern().test(file.name)
}
