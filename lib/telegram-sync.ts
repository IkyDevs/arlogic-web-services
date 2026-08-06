'use client'

/**
 * Protokol sinkronisasi Telegram (D3/D6):
 * - Data berubah, foto TIDAK berubah → edit caption pesan lama (editMessageCaption).
 * - Foto berubah (tambah/hapus) → KIRIM DULU pesan baru, tunggu sukses, BARU hapus pesan lama.
 * Client-side helper yang memanggil route /api/telegram/* yang sudah ada.
 */

export interface TelegramRef {
  chat_id: string | number
  message_ids: number[]
}

function toNumberArray(raw: unknown): number[] {
  if (!Array.isArray(raw)) return []
  return raw.filter((x): x is number => typeof x === 'number' && Number.isFinite(x))
}

/** Ambil referensi Telegram dari record transaksi/dokumentasi (toleran skema lama & baru). */
export function extractTelegramRefs(row: Record<string, unknown> | null | undefined): TelegramRef | null {
  if (!row) return null
  const chatId = (row.telegram_chat_id as string | number | null | undefined)
  const ids = toNumberArray(row.telegram_message_ids)
  const legacySingle = row.telegram_message_id
  if (!chatId) return null
  if (ids.length === 0 && typeof legacySingle === 'number' && Number.isFinite(legacySingle)) {
    return { chat_id: chatId, message_ids: [legacySingle] }
  }
  return ids.length > 0 ? { chat_id: chatId, message_ids: ids } : null
}

/** Edit caption pesan lama (hanya pesan pertama album — batasan Telegram, D1). */
export async function editTelegramCaption(
  chatId: string | number,
  messageId: number,
  caption: string,
): Promise<boolean> {
  try {
    const res = await fetch('/api/telegram/edit-message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, message_id: messageId, text: caption, is_caption: true }),
    })
    return res.ok
  } catch {
    return false
  }
}

/** Hapus pesan lama; dipanggil HANYA setelah pesan baru terkirim sukses (D3). */
export async function deleteTelegramMessages(
  chatId: string | number,
  messageIds: number[],
): Promise<{ ok: boolean; failed: number[] }> {
  const failed: number[] = []
  for (const messageId of messageIds) {
    try {
      const res = await fetch('/api/telegram/delete-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, message_id: messageId }),
      })
      if (!res.ok) failed.push(messageId)
    } catch {
      failed.push(messageId)
    }
  }
  return { ok: failed.length === 0, failed }
}

/** Deteksi perubahan foto (tambah/hapus) dari diff daftar URL lama vs baru. */
export function hasPhotoChanged(oldUrls: string[], newUrls: string[]): boolean {
  const norm = (arr: string[]) => arr.filter(Boolean).sort()
  const a = norm(oldUrls)
  const b = norm(newUrls)
  if (a.length !== b.length) return true
  return a.some((u, i) => u !== b[i])
}