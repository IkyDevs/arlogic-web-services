import { NextRequest, NextResponse } from 'next/server'
import { uploadMultipleToTelegram } from '@/lib/telegram'
import { validateOrigin } from '@/lib/csrf'
import { rateLimitIP } from '@/lib/rate-limit'

const MAX_FILES = 20;
const MAX_FILE_SIZE = 20 * 1024 * 1024;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'image/avif'];

let sharpModule: any = null;
async function getSharp() {
  if (sharpModule !== undefined) return sharpModule;
  try {
    sharpModule = (await import('sharp')).default;
  } catch {
    sharpModule = null;
  }
  return sharpModule;
}

const CHANNEL_MAP: Record<string, 'attendance' | 'service' | 'layanan' | 'inventory' | 'kaspin' | 'teknisi_update' | 'qc_update'> = {
  attendance: 'attendance',
  service: 'service',
  layanan: 'layanan',
  inventory: 'inventory',
  kaspin: 'kaspin',
  teknisi_update: 'teknisi_update',
  qc_update: 'qc_update',
};

export async function POST(request: NextRequest) {
  try {
    if (!validateOrigin(request)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const rl = rateLimitIP(request)
    if (!rl.allowed) {
      return NextResponse.json(
        { error: 'Too many requests' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil((rl.resetAt - Date.now()) / 1000)) } },
      )
    }

    let formData: FormData;
    try {
      formData = await request.formData()
    } catch {
      return NextResponse.json({ error: 'Gagal membaca form data. Ukuran file mungkin terlalu besar.' }, { status: 400 })
    }

    const files = formData.getAll('files') as File[]
    const type = (formData.get('type') as string) || ''
    const caption = (formData.get('caption') as string) || ''

    if (!files.length) {
      return NextResponse.json({ error: 'Tidak ada file yang diupload' }, { status: 400 })
    }
    if (files.length > MAX_FILES) {
      return NextResponse.json({ error: `Maksimal ${MAX_FILES} file per upload` }, { status: 400 })
    }

    for (const f of files) {
      if (f.size > MAX_FILE_SIZE) {
        return NextResponse.json({ error: `"${f.name}" terlalu besar (max 20MB)` }, { status: 400 })
      }
      if (!ALLOWED_TYPES.includes(f.type) && !f.name.match(/\.(jpg|jpeg|png|webp|heic|heif|avif)$/i)) {
        return NextResponse.json({ error: `"${f.name}" bukan format gambar yang didukung` }, { status: 400 })
      }
    }

    const sharp = await getSharp();
    const processedFiles: Array<{ buffer: Buffer; name: string }> = [];
    const timestamp = Date.now();

    for (const file of files) {
      try {
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        if (sharp && !file.type.startsWith('image/jpeg')) {
          try {
            const optimized = await sharp(buffer).jpeg({ quality: 80 }).toBuffer();
            processedFiles.push({ buffer: optimized, name: `${type}/${timestamp}_${Math.random().toString(36).substring(2, 8)}.jpg` });
            continue;
          } catch { /* fallback to original */ }
        }

        processedFiles.push({ buffer, name: `${type}/${timestamp}_${Math.random().toString(36).substring(2, 8)}.jpg` });
      } catch {
        // skip failed file
      }
    }

    if (processedFiles.length === 0) {
      return NextResponse.json({ error: 'Gagal memproses file' }, { status: 500 })
    }

    const channelType = CHANNEL_MAP[type] || 'service';
    const telegramResults = await uploadMultipleToTelegram(processedFiles, caption, channelType);

    if (telegramResults.length === 0) {
      return NextResponse.json({ error: 'Foto gagal dikirim ke Telegram. Coba lagi dengan file lebih kecil.' }, { status: 502 })
    }

    return NextResponse.json({
      success: true,
      urls: telegramResults.map(r => r.url),
      messages: telegramResults.map(r => ({ chat_id: r.chat_id, message_id: r.message_id })),
      count: telegramResults.length,
      storage: 'telegram',
      channel: channelType,
    });
  } catch (error: any) {
    const msg = error?.message || '';
    if (msg.includes('TELEGRAM_BOT_TOKEN') || msg.includes('not configured')) {
      return NextResponse.json({ error: 'Konfigurasi Telegram tidak lengkap' }, { status: 500 })
    }
    if (msg.includes('timeout') || msg.includes('abort')) {
      return NextResponse.json({ error: 'Koneksi ke Telegram timeout. Coba lagi.' }, { status: 504 })
    }
    return NextResponse.json({ error: 'Upload gagal', details: msg }, { status: 500 });
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
    },
  });
}
