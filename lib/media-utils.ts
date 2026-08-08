import { isVideoFile } from '@/lib/upload/upload-config'

export type MediaType = 'image' | 'video'

export function mediaTypeFromFile(file: File): MediaType {
  return isVideoFile(file) ? 'video' : 'image'
}

/** True if media should render as playable video. */
export function isPlayableVideo(
  mediaType?: string | null,
  url?: string | null,
): boolean {
  if (mediaType === 'video') return true
  if (mediaType === 'image') return false
  if (!url) return false
  return /\.(mp4|mov|webm|3gp|3gpp|m4v)(\?|$)/i.test(url)
}

export function mediaTypeFromUrl(url?: string | null): MediaType {
  return isPlayableVideo(null, url) ? 'video' : 'image'
}
