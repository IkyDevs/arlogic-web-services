/**
 * Arlogic Photo Proxy & Upload — Cloudflare Worker
 *
 * GET  /photos/:file_id → proxy photo from Telegram with caching
 * POST /upload          → receive files, send to Telegram, return URLs
 */

const TELEGRAM_API = 'https://api.telegram.org'
const CACHE_TTL = 604800 // 7 days

export interface Env {
  TELEGRAM_BOT_TOKEN: string
  TELEGRAM_CHANNEL_ATTENDANCE?: string
  TELEGRAM_CHANNEL_SERVICE?: string
  TELEGRAM_CHANNEL_LAYANAN?: string
  TELEGRAM_CHANNEL_INVENTORY?: string
  TELEGRAM_CHANNEL_KASPIN?: string
  TELEGRAM_CHANNEL_TEKNISI_UPDATE?: string
  TELEGRAM_CHANNEL_QC_UPDATE?: string
}

// ─── Upload: receive files → Telegram → return URLs ────────────────

async function handleUpload(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  // CORS
  const origin = request.headers.get('Origin') || '*'
  const corsHeaders = {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  }

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  if (!env.TELEGRAM_BOT_TOKEN) {
    return new Response(JSON.stringify({ error: 'TELEGRAM_BOT_TOKEN not configured' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  try {
    const formData = await request.formData()
    const files: File[] = []
    const caption = (formData.get('caption') as string) || ''
    const channelType = (formData.get('type') as string) || 'layanan'
    const providedChatId = (formData.get('chat_id') as string) || ''

    // Collect files from form data
    for (const [key, value] of formData.entries()) {
      if (key === 'files' && typeof value === 'object' && value !== null) {
        files.push(value as unknown as File)
      }
    }

    if (files.length === 0) {
      return new Response(JSON.stringify({ error: 'No files provided' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Prefer chat_id from client (resolved dari server production), fallback ke env/dua default
    const envMap: Record<string, string | undefined> = {
      attendance: env.TELEGRAM_CHANNEL_ATTENDANCE,
      service: env.TELEGRAM_CHANNEL_SERVICE,
      layanan: env.TELEGRAM_CHANNEL_LAYANAN,
      inventory: env.TELEGRAM_CHANNEL_INVENTORY,
      kaspin: env.TELEGRAM_CHANNEL_KASPIN,
      teknisi_update: env.TELEGRAM_CHANNEL_TEKNISI_UPDATE,
      qc_update: env.TELEGRAM_CHANNEL_QC_UPDATE,
      closing: env.TELEGRAM_CHANNEL_LAYANAN,
    }
    const chatId = providedChatId || envMap[channelType] || DEFAULT_CHANNELS[channelType] || '@arlogic_layanan'

    // Upload to Telegram
    const botUrl = `${TELEGRAM_API}/bot${env.TELEGRAM_BOT_TOKEN}`
    const results: Array<{ file_id: string; url: string; chat_id: string; message_id: number }> = []

    if (files.length === 1) {
      // Single photo → sendPhoto
      const photoForm = new FormData()
      photoForm.append('chat_id', chatId)
      photoForm.append('photo', files[0], files[0].name)
      if (caption) photoForm.append('caption', caption)
      photoForm.append('parse_mode', 'HTML')

      const res = await fetch(`${botUrl}/sendPhoto`, { method: 'POST', body: photoForm })
      const data: any = await res.json()

      if (!data.ok) {
        return new Response(JSON.stringify({ error: data.description || 'Telegram API error' }), {
          status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const msg = data.result
      const fileId = msg.photo?.[msg.photo.length - 1]?.file_id || ''
      results.push({
        file_id: fileId,
        url: `${botUrl}/getFile?file_id=${fileId}`,
        chat_id: String(msg.chat.id),
        message_id: msg.message_id,
      })
    } else {
      // Multiple photos → sendMediaGroup
      const media = files.map((f, idx) => ({
        type: 'photo',
        media: `attach://file_${idx}`,
        ...(idx === 0 && caption ? { caption } : {}),
      }))

      const mediaForm = new FormData()
      mediaForm.append('chat_id', chatId)
      mediaForm.append('media', JSON.stringify(media))
      files.forEach((f, idx) => mediaForm.append(`file_${idx}`, f, f.name))

      const res = await fetch(`${botUrl}/sendMediaGroup`, { method: 'POST', body: mediaForm })
      const data: any = await res.json()

      if (!data.ok) {
        return new Response(JSON.stringify({ error: data.description || 'Telegram API error' }), {
          status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const workerUrl = (fileId: string) =>
        `${request.url.replace(/\/upload$/, '')}/photos/${fileId}`

      for (const msg of data.result || []) {
        const fileId = msg.photo?.[msg.photo.length - 1]?.file_id || ''
        results.push({
          file_id: fileId,
          url: workerUrl(fileId),
          chat_id: String(msg.chat.id),
          message_id: msg.message_id,
        })
      }
    }

    return new Response(JSON.stringify({
      success: true,
      urls: results.map(r => r.url),
      file_ids: results.map(r => r.file_id),
      messages: results.map(r => ({ chat_id: r.chat_id, message_id: r.message_id })),
      count: results.length,
      storage: 'cloudflare-worker',
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message || 'Upload failed' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
}

// ─── Channel fallbacks (sync dengan .env production) ─────────────

const DEFAULT_CHANNELS: Record<string, string> = {
  attendance: '@jbr_absensi',
  service: '@jbr_praService',
  layanan: '@jbr_transaksi',
  inventory: '@jbr_inventory',
  kaspin: '@arlogic_storage',
  teknisi_update: '@jbr_update_teknisi',
  qc_update: '@jbr_qc_update',
  closing: '@arlogic_storage',
  customer: '@db_customer',
}

// ─── Photo proxy: GET /photos/:file_id ──────────────────────────────

async function handlePhotoProxy(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url)
  const match = url.pathname.match(/^\/photos\/(.+)$/)
  if (!match) return new Response('Not Found', { status: 404 })

  const fileId = match[1]
  if (!env.TELEGRAM_BOT_TOKEN) return new Response('Missing token', { status: 500 })

  // Try cache
  const cache = caches.default
  const cacheKey = `https://photos.cache/${fileId}`
  const cached = await cache.match(cacheKey)
  if (cached) return cached

  // getFile → file_path
  const getFile = await fetch(`${TELEGRAM_API}/bot${env.TELEGRAM_BOT_TOKEN}/getFile`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ file_id: fileId }),
  })
  const fileData: any = await getFile.json()
  if (!fileData.ok || !fileData.result?.file_path) {
    return new Response('Not found', { status: 404 })
  }

  // Download photo
  const fileRes = await fetch(`${TELEGRAM_API}/file/bot${env.TELEGRAM_BOT_TOKEN}/${fileData.result.file_path}`)
  if (!fileRes.ok) return new Response('Failed to fetch', { status: 502 })

  const buffer = await fileRes.arrayBuffer()
  const contentType = fileRes.headers.get('content-type') || 'image/jpeg'

  const response = new Response(buffer, {
    headers: {
      'Content-Type': contentType,
      'Cache-Control': `public, max-age=${CACHE_TTL}`,
      'Access-Control-Allow-Origin': '*',
    },
  })

  try { await cache.put(cacheKey, response.clone()) } catch {}

  return response
}

// ─── Router ──────────────────────────────────────────────────────────

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      })
    }

    if (request.method === 'POST' && (url.pathname === '/upload' || url.pathname === '/upload/')) {
      return handleUpload(request, env)
    }

    if (request.method === 'GET' && url.pathname.startsWith('/photos/')) {
      return handlePhotoProxy(request, env)
    }

    return new Response('Not Found', { status: 404 })
  },
}
