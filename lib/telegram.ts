// lib/telegram.ts
// Telegram Storage Service - Upload foto ke channel terpisah

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN

const CHANNELS = {
  attendance: process.env.TELEGRAM_CHANNEL_ATTENDANCE,
  service: process.env.TELEGRAM_CHANNEL_SERVICE,
  layanan: process.env.TELEGRAM_CHANNEL_LAYANAN,
  inventory: process.env.TELEGRAM_CHANNEL_INVENTORY,
  stock_transfer: process.env.TELEGRAM_CHANNEL_STOCK_TRANSFER,
  closing: process.env.TELEGRAM_CHANNEL_CLOSING,
  customer: process.env.TELEGRAM_CHANNEL_CUSTOMER,
  kaspin: process.env.TELEGRAM_CHANNEL_KASPIN,
} as const

export type TelegramChannelType = keyof typeof CHANNELS

export interface TelegramMessageResult {
  url: string
  chat_id: string
  message_id: number
}

async function sendPhotoBlob(
  channelId: string,
  blob: Blob,
  fileName: string,
  caption?: string
): Promise<TelegramMessageResult> {
  const formData = new FormData()
  formData.append('chat_id', channelId)
  formData.append('photo', blob, fileName)
  if (caption) formData.append('caption', caption)

  const response = await fetch(
    `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendPhoto`,
    { method: 'POST', body: formData }
  )

  const rawText = await response.text()
  let data: any
  try {
    data = JSON.parse(rawText)
  } catch (parseError) {
    console.error('❌ Telegram non-JSON response in sendPhoto:', rawText)
    throw new Error(`Telegram API returned invalid response (status ${response.status})`)
  }

  if (!data.ok) {
    throw new Error(data.description || 'Telegram API error')
  }

  const chat_id = String(data.result.chat.id)
  const message_id = data.result.message_id
  const photoArray = data.result.photo
  const fileId = photoArray[photoArray.length - 1].file_id

  const fileResponse = await fetch(
    `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getFile?file_id=${fileId}`
  )
  const fileData = await fileResponse.json()

  if (!fileData.ok) {
    throw new Error(fileData.description || 'Failed to get file URL')
  }

  return {
    url: `https://api.telegram.org/file/bot${TELEGRAM_BOT_TOKEN}/${fileData.result.file_path}`,
    chat_id,
    message_id,
  }
}

async function sendSinglePhoto(
  channelId: string, blob: Blob, fileName: string, caption: string | undefined
): Promise<TelegramMessageResult | null> {
  try {
    return await sendPhotoBlob(channelId, blob, fileName, caption)
  } catch (e: any) {
    console.error(`❌ sendSinglePhoto failed for ${fileName}: ${e.message}`)
    return null
  }
}

async function getFileUrl(fileId: string): Promise<string | null> {
  try {
    const res = await fetch(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getFile?file_id=${fileId}`
    )
    const data = await res.json()
    if (!data.ok) return null
    return `https://api.telegram.org/file/bot${TELEGRAM_BOT_TOKEN}/${data.result.file_path}`
  } catch {
    return null
  }
}

export async function editMessageCaption(
  chatId: string,
  messageId: number,
  caption: string
): Promise<boolean> {
  try {
    const res = await fetch(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/editMessageCaption`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, message_id: messageId, caption }),
      }
    )
    const data = await res.json()
    if (!data.ok) {
      console.warn('⚠️ editMessageCaption failed:', data.description)
      return false
    }
    return true
  } catch (e: any) {
    console.error('❌ editMessageCaption error:', e.message)
    return false
  }
}

export async function uploadMultipleToTelegram(
  files: Array<{ buffer: Buffer; name: string }>,
  caption: string,
  channelType: TelegramChannelType = 'service'
): Promise<TelegramMessageResult[]> {
  const channelId = CHANNELS[channelType]

  if (!TELEGRAM_BOT_TOKEN) throw new Error('TELEGRAM_BOT_TOKEN not configured')
  if (!channelId) throw new Error(`Channel ID for ${channelType} not configured`)
  if (!files || files.length === 0) return []

  const results: TelegramMessageResult[] = []
  const toBlob = (buffer: Buffer): Blob =>
    new Blob([new Uint8Array(buffer)], { type: 'image/jpeg' })

  const CHUNK_SIZE = 10
  for (let i = 0; i < files.length; i += CHUNK_SIZE) {
    const chunk = files.slice(i, i + CHUNK_SIZE)
    let chunkOk = false

    // Try sendMediaGroup first (groups photos into one album)
    try {
      const media = chunk.map((f, idx) => ({
        type: 'photo' as const,
        media: `attach://photo_${idx}`,
        ...(idx === 0 ? { caption } : {}),
      }))

      const formData = new FormData()
      formData.append('chat_id', channelId)
      formData.append('media', JSON.stringify(media))
      chunk.forEach((f, idx) => {
        formData.append(`photo_${idx}`, toBlob(f.buffer), `photo_${idx}.jpg`)
      })

      const res = await fetch(
        `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMediaGroup`,
        { method: 'POST', body: formData }
      )
      const raw = await res.text()
      const data = JSON.parse(raw)

      if (data.ok && Array.isArray(data.result)) {
        const processed = await Promise.allSettled(
          data.result.map(async (r: any) => {
            const chat_id = String(r.chat.id)
            const message_id = r.message_id
            const photoArray = r.photo
            const fileId = photoArray[photoArray.length - 1].file_id
            const url = await getFileUrl(fileId)
            return { url: url || '', chat_id, message_id }
          })
        )
        for (const r of processed) {
          if (r.status === 'fulfilled' && r.value.url) results.push(r.value)
        }
        chunkOk = true
      }
    } catch (e: any) {
      console.warn(`⚠️ sendMediaGroup chunk ${i / CHUNK_SIZE + 1} failed: ${e.message}`)
    }

    // Fallback: send each photo individually, skip failures
    if (!chunkOk) {
      console.log(`   Sending ${chunk.length} photos individually (fallback)`)
      for (let fi = 0; fi < chunk.length; fi++) {
        const blob = toBlob(chunk[fi].buffer)
        const result = await sendSinglePhoto(
          channelId, blob, chunk[fi].name,
          fi === 0 && i === 0 ? caption : undefined
        )
        if (result) results.push(result)
      }
    }
  }

  return results
}

export async function uploadToTelegram(
  file: File | Blob,
  fileName: string,
  caption: string,
  channelType: TelegramChannelType = 'service'
): Promise<string> {
  const channelId = CHANNELS[channelType]
  
  if (!TELEGRAM_BOT_TOKEN) {
    throw new Error('TELEGRAM_BOT_TOKEN not configured')
  }
  
  if (!channelId) {
    throw new Error(`Channel ID for ${channelType} not configured`)
  }

  try {
    const formData = new FormData()
    formData.append('chat_id', channelId)
    formData.append('photo', file, fileName)
    formData.append('caption', caption)

    const response = await fetch(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendPhoto`,
      {
        method: 'POST',
        body: formData,
      }
    )

    const rawText = await response.text()
    let data: any
    try {
      data = JSON.parse(rawText)
    } catch (parseError) {
      console.error('❌ Telegram non-JSON response:', rawText)
      throw new Error(`Telegram API returned invalid response (status ${response.status})`)
    }

    if (!data.ok) {
      throw new Error(data.description || 'Telegram API error')
    }

    const photoArray = data.result.photo
    const fileId = photoArray[photoArray.length - 1].file_id

    const fileResponse = await fetch(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getFile?file_id=${fileId}`
    )
    const fileData = await fileResponse.json()

    if (!fileData.ok) {
      throw new Error(fileData.description || 'Failed to get file URL')
    }

    return `https://api.telegram.org/file/bot${TELEGRAM_BOT_TOKEN}/${fileData.result.file_path}`

  } catch (error: any) {
    console.error('❌ Telegram upload error:', error)
    throw error
  }
}