// lib/telegram.ts
// Telegram Storage Service - Upload foto ke channel terpisah

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN

const CHANNELS = {
  attendance: process.env.TELEGRAM_CHANNEL_ATTENDANCE,
  service: process.env.TELEGRAM_CHANNEL_SERVICE,
  layanan: process.env.TELEGRAM_CHANNEL_LAYANAN,
  inventory: process.env.TELEGRAM_CHANNEL_INVENTORY,
  stock_transfer: process.env.TELEGRAM_CHANNEL_STOCK_TRANSFER,
} as const

export type TelegramChannelType = keyof typeof CHANNELS

async function sendPhotoBlob(
  channelId: string,
  blob: Blob,
  fileName: string,
  caption?: string
): Promise<string> {
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
}

export async function uploadMultipleToTelegram(
  files: Array<{ buffer: Buffer; name: string }>,
  caption: string,
  channelType: TelegramChannelType = 'service'
): Promise<string[]> {
  const channelId = CHANNELS[channelType]

  if (!TELEGRAM_BOT_TOKEN) {
    throw new Error('TELEGRAM_BOT_TOKEN not configured')
  }

  if (!channelId) {
    throw new Error(`Channel ID for ${channelType} not configured`)
  }

  if (!files || files.length === 0) {
    return []
  }

  const urls: string[] = []

  const toBlob = (buffer: Buffer): Blob =>
    new Blob([new Uint8Array(buffer)], { type: 'image/jpeg' })

  try {
    const CHUNK_SIZE = 10
    for (let i = 0; i < files.length; i += CHUNK_SIZE) {
      const chunk = files.slice(i, i + CHUNK_SIZE)

      const media = chunk.map((file, index) => ({
        type: 'photo',
        media: `attach://photo_${index}`,
        ...(index === 0 ? { caption } : {}),
      }))

      const formData = new FormData()
      formData.append('chat_id', channelId)
      formData.append('media', JSON.stringify(media))

      chunk.forEach((file, index) => {
        formData.append(
          `photo_${index}`,
          toBlob(file.buffer),
          `photo_${index}.jpg`
        )
      })

      const response = await fetch(
        `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMediaGroup`,
        { method: 'POST', body: formData }
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

      for (const result of data.result) {
        const photoArray = result.photo
        const fileId = photoArray[photoArray.length - 1].file_id

        const fileResponse = await fetch(
          `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getFile?file_id=${fileId}`
        )
        const fileData = await fileResponse.json()

        if (!fileData.ok) {
          throw new Error(fileData.description || 'Failed to get file URL')
        }

        urls.push(`https://api.telegram.org/file/bot${TELEGRAM_BOT_TOKEN}/${fileData.result.file_path}`)
      }
    }
  } catch (error: any) {
    console.error('❌ sendMediaGroup failed, falling back to sendPhoto:', error.message)
    console.error('   Caption length:', caption.length, 'chars, Files:', files.length)
    
    for (let fi = 0; fi < files.length; fi++) {
      const file = files[fi]
      try {
        console.log(`   Fallback sending photo ${fi + 1}/${files.length}: ${file.name}`)
        const url = await sendPhotoBlob(
          channelId,
          toBlob(file.buffer),
          file.name,
          fi === 0 ? caption : undefined
        )
        urls.push(url)
      } catch (fallbackError: any) {
        console.error(`❌ Fallback sendPhoto failed for ${file.name}:`, fallbackError.message)
        throw fallbackError
      }
    }
  }

  return urls
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

    // Dapatkan file_id
    const photoArray = data.result.photo
    const fileId = photoArray[photoArray.length - 1].file_id

    // Dapatkan file URL
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