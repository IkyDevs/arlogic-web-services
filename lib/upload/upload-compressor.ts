import { uploadServiceConfig } from './upload-config'

const TARGET_KB = uploadServiceConfig.compressTargetKB
const QUALITY = uploadServiceConfig.compressQuality / 100
const MAX_DIM = uploadServiceConfig.compressMaxDimension

export function isHeicFile(file: File): boolean {
  return file.type === 'image/heic' || file.type === 'image/heif' || /\.(heic|heif)$/i.test(file.name)
}

export function heicToJpeg(file: File): Promise<File | null> {
  const name = file.name.replace(/\.[^.]+$/, '.jpg')

  // Coba native Canvas dulu (Safari/iOS mendukung HEIC)
  const tryCanvas = (): Promise<File | null> =>
    new Promise((resolve) => {
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
            if (blob && blob.size > 0) resolve(new File([blob], name, { type: 'image/jpeg' }))
            else resolve(null)
          },
          'image/jpeg',
          QUALITY,
        )
      }
      img.onerror = () => resolve(null)
      img.src = URL.createObjectURL(file)
    })

  // Fallback: heic2any (WASM, support semua browser termasuk Chrome/Android)
  const tryHeic2any = async (): Promise<File | null> => {
    try {
      const heic2any = (await import('heic2any')).default
      const result: any = await heic2any({
        blob: file,
        toType: 'image/jpeg',
        quality: QUALITY,
      })
      const blob = Array.isArray(result) ? result[0] : result
      if (blob && blob.size > 0) return new File([blob], name, { type: 'image/jpeg' })
      return null
    } catch {
      return null
    }
  }

  return (async () => {
    const canvasResult = await tryCanvas()
    if (canvasResult) return canvasResult
    return tryHeic2any()
  })()
}

/**
 * Konversi batch HEIC/HEIF → JPEG dengan progress + yield (UI tidak freeze).
 * Non-HEIC file langsung diteruskan. Hasil HEIC di-downscale ke max 1920px.
 * `onFileDone` dipanggil per-foto setelah selesai (untuk per-foto loading bar).
 */
export async function convertHeicFiles(
  files: File[],
  onProgress?: (done: number, total: number) => void,
  onFileDone?: (index: number, file: File | null, original: File) => void,
): Promise<{ files: File[]; failed: string[] }> {
  const converted: File[] = []
  const failed: string[] = []
  let done = 0

  for (let i = 0; i < files.length; i++) {
    const f = files[i]
    if (isHeicFile(f)) {
      const jpeg = await heicToJpeg(f)
      if (jpeg) {
        // Downscale hasil konversi supaya ukuran upload kecil
        const resized = await compressImage(jpeg)
        const final = resized.size < jpeg.size ? resized : jpeg
        converted.push(final)
        onFileDone?.(i, final, f)
      } else {
        failed.push(f.name)
        onFileDone?.(i, null, f)
      }
    } else {
      converted.push(f)
      onFileDone?.(i, f, f)
    }
    done++
    onProgress?.(done, files.length)
    // Yield supaya browser bisa repaint (hindari UI "macet")
    await new Promise((r) => setTimeout(r, 30))
  }

  return { files: converted, failed }
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
