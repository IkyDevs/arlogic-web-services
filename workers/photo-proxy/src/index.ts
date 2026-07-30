export interface Env {
  TELEGRAM_BOT_TOKEN: string
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    const path = url.pathname

    const match = path.match(/^\/photos\/(.+)$/)
    if (!match) {
      return new Response('Not Found', { status: 404 })
    }

    const fileId = match[1]

    if (!env.TELEGRAM_BOT_TOKEN) {
      return new Response('Missing token', { status: 500 })
    }

    const getFileUrl = `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/getFile`
    const res = await fetch(getFileUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ file_id: fileId }),
    })
    const data: any = await res.json()

    if (!data.ok || !data.result?.file_path) {
      return new Response('Not found', { status: 404 })
    }

    const fileUrl = `https://api.telegram.org/file/bot${env.TELEGRAM_BOT_TOKEN}/${data.result.file_path}`
    const fileRes = await fetch(fileUrl)

    return new Response(fileRes.body, {
      headers: {
        'Content-Type': fileRes.headers.get('content-type') || 'image/jpeg',
        'Cache-Control': 'public, max-age=604800',
        'Access-Control-Allow-Origin': '*',
      },
    })
  },
}
