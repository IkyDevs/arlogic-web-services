/**
 * Helper terpusat untuk menyimpan metadata Telegram hasil upload.
 *
 * INVARIANT: DB hanya menyimpan URL + referensi Telegram (chat_id, message_id,
 * file_id). Blob/foto TIDAK pernah masuk database — Telegram adalah source of
 * truth storage (keputusan D7, PLAN_TELEGRAM_SOT).
 */

export interface UploadResult {
  url: string
  chat_id: string
  message_id: number
  file_id?: string
}

export interface TelegramMetadata {
  telegram_chat_id: string | null
  telegram_message_id: number | null
  telegram_message_ids: number[]
  telegram_file_ids: string[]
  telegram_sync: string
}

export function buildTelegramMetadata(results: UploadResult[]): TelegramMetadata {
  return {
    telegram_chat_id: results[0]?.chat_id || null,
    telegram_message_id: results[0]?.message_id ?? null,
    telegram_message_ids: results
      .map((r) => r.message_id)
      .filter((n): n is number => typeof n === 'number' && Number.isFinite(n)),
    telegram_file_ids: results
      .map((r) => r.file_id || '')
      .filter(Boolean),
    telegram_sync: 'synced',
  }
}

export function buildPhotoUrls(results: UploadResult[]): string[] {
  return results.map((r) => r.url).filter(Boolean)
}

/**
 * Menulis metadata upload ke baris yang sudah ada (update by id).
 * Semua kolom telegram_* diseragamkan dari satu helper.
 */
export async function updateTelegramMetadata(
  supabase: {
    from: (table: string) => {
      update: (data: Record<string, unknown>) => {
        eq: (column: string, value: string | number) => Promise<{ error: { message: string } | null }>
      }
    }
  },
  table: string,
  idColumn: string,
  idValue: string | number,
  metadata: TelegramMetadata,
  extra: Record<string, unknown> = {},
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from(table)
    .update({ ...metadata, ...extra })
    .eq(idColumn, idValue)
  return { error: error?.message || null }
}
