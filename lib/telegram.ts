const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TG_API = "https://api.telegram.org/bot";

const CHANNELS = {
  attendance: process.env.TELEGRAM_CHANNEL_ATTENDANCE,
  service: process.env.TELEGRAM_CHANNEL_SERVICE,
  layanan: process.env.TELEGRAM_CHANNEL_LAYANAN,
  inventory: process.env.TELEGRAM_CHANNEL_INVENTORY,
  stock_transfer: process.env.TELEGRAM_CHANNEL_STOCK_TRANSFER,
  closing: process.env.TELEGRAM_CHANNEL_CLOSING,
  customer: process.env.TELEGRAM_CHANNEL_CUSTOMER,
  kaspin: process.env.TELEGRAM_CHANNEL_KASPIN,
  buku_kas: process.env.TELEGRAM_CHANNEL_BUKU_KAS,
  teknisi_update: process.env.TELEGRAM_CHANNEL_TEKNISI_UPDATE,
  qc_update: process.env.TELEGRAM_CHANNEL_QC_UPDATE,
} as const;

export type TelegramChannelType = keyof typeof CHANNELS;

export interface TelegramMessageResult {
  url: string;
  chat_id: string;
  message_id: number;
}

const FETCH_TIMEOUT_MS = 15_000;

async function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs = FETCH_TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    return res;
  } finally {
    clearTimeout(timer);
  }
}

// Intelligent retry wrapper:
// - 429 Too Many Requests → parse retry_after, wait exactly that long, DON'T consume retry budget
// - Network/timeout errors → exponential backoff: 2s → 4s → 8s, max 3 retries
async function fetchTelegramWithRetry(
  url: string,
  options: RequestInit,
  retries = 3,
  baseDelay = 2000,
): Promise<any> {
  if (!TELEGRAM_BOT_TOKEN) throw new Error("TELEGRAM_BOT_TOKEN not configured");

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetchWithTimeout(url, options);
      const raw = await res.text();

      let data: any;
      try {
        data = JSON.parse(raw);
      } catch {
        throw new Error(`Telegram API returned non-JSON (HTTP ${res.status})`);
      }

      // Rate limited — wait for retry_after seconds, then retry without consuming budget
      if (res.status === 429 || (data?.ok === false && data?.parameters?.retry_after)) {
        const waitSeconds = data?.parameters?.retry_after || 5;
        await new Promise(r => setTimeout(r, waitSeconds * 1000));
        attempt--;  // don't decrement retry budget
        continue;
      }

      if (!data?.ok) throw new Error(data?.description || "Telegram API error");
      return data.result;
    } catch (e: any) {
      lastError = e;
      if (e.name === "AbortError") {
        if (attempt < retries) {
          const delay = baseDelay * Math.pow(2, attempt);
          await new Promise(r => setTimeout(r, delay));
          continue;
        }
        throw new Error("Telegram API timeout after retries");
      }
      if (attempt < retries) {
        const delay = baseDelay * Math.pow(2, attempt);
        await new Promise(r => setTimeout(r, delay));
        continue;
      }
    }
  }

  throw lastError || new Error("Telegram API request failed");
}

async function tgPost(method: string, body: any, isFormData = false): Promise<any> {
  const url = `${TG_API}${TELEGRAM_BOT_TOKEN}/${method}`;
  const options: RequestInit = isFormData
    ? { method: "POST", body }
    : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) };
  return fetchTelegramWithRetry(url, options);
}

async function getFileUrl(fileId: string): Promise<string | null> {
  try {
    const result = await tgPost("getFile", { file_id: fileId });
    if (!result?.file_path) return null;
    return `${TG_API}${TELEGRAM_BOT_TOKEN}/${result.file_path}`;
  } catch {
    return null;
  }
}

async function sendPhotoBlob(channelId: string, blob: Blob, fileName: string, caption?: string): Promise<TelegramMessageResult> {
  const formData = new FormData();
  formData.append("chat_id", channelId);
  formData.append("photo", blob, fileName);
  if (caption) formData.append("caption", caption);

  const result = await tgPost("sendPhoto", formData, true);
  const chat_id = String(result.chat.id);
  const message_id = result.message_id;
  const fileId = result.photo[result.photo.length - 1].file_id;
  const url = await getFileUrl(fileId);

  return { url: url || "", chat_id, message_id };
}

async function sendSinglePhoto(channelId: string, blob: Blob, fileName: string, caption?: string): Promise<TelegramMessageResult | null> {
  try { return await sendPhotoBlob(channelId, blob, fileName, caption); }
  catch { return null; }
}

export async function editMessageCaption(chatId: string, messageId: number, caption: string): Promise<boolean> {
  try {
    await tgPost("editMessageCaption", { chat_id: chatId, message_id: messageId, caption });
    return true;
  } catch {
    return false;
  }
}

export async function uploadMultipleToTelegram(
  files: Array<{ buffer: Buffer; name: string }>,
  caption: string,
  channelType: TelegramChannelType = "service",
): Promise<TelegramMessageResult[]> {
  const channelId = CHANNELS[channelType];
  if (!TELEGRAM_BOT_TOKEN) throw new Error("TELEGRAM_BOT_TOKEN not configured");
  if (!channelId) throw new Error(`Channel ID for ${channelType} not configured`);
  if (!files?.length) return [];

  const results: TelegramMessageResult[] = [];
  const toBlob = (buffer: Buffer): Blob => new Blob([new Uint8Array(buffer)], { type: "image/jpeg" });
  const CHUNK_SIZE = 10;

  for (let i = 0; i < files.length; i += CHUNK_SIZE) {
    const chunk = files.slice(i, i + CHUNK_SIZE);
    let chunkOk = false;

    if (chunk.length >= 2) {
      try {
        const media = chunk.map((f, idx) => ({
          type: "photo" as const,
          media: `attach://photo_${idx}`,
          ...(idx === 0 ? { caption } : {}),
        }));

        const formData = new FormData();
        formData.append("chat_id", channelId);
        formData.append("media", JSON.stringify(media));
        chunk.forEach((f, idx) => formData.append(`photo_${idx}`, toBlob(f.buffer), `photo_${idx}.jpg`));

        const sendResult = await tgPost("sendMediaGroup", formData, true);
        if (Array.isArray(sendResult)) {
          await Promise.all(sendResult.map(async (r, pi) => {
            try {
              const cid = String(r.chat.id);
              const mid = r.message_id;
              const fid = r.photo[r.photo.length - 1].file_id;
              const url = await getFileUrl(fid);
              if (url) results.push({ url, chat_id: cid, message_id: mid });
              else {
                const fallback = await sendSinglePhoto(channelId, toBlob(chunk[pi].buffer), chunk[pi].name);
                if (fallback) results.push(fallback);
              }
            } catch {
              const fallback = await sendSinglePhoto(channelId, toBlob(chunk[pi].buffer), chunk[pi].name);
              if (fallback) results.push(fallback);
            }
          }));
          chunkOk = true;
        }
      } catch { /* fallback to individual */ }
    }

    if (!chunkOk) {
      for (let fi = 0; fi < chunk.length; fi++) {
        const result = await sendSinglePhoto(channelId, toBlob(chunk[fi].buffer), chunk[fi].name, fi === 0 && i === 0 ? caption : undefined);
        if (result) results.push(result);
      }
    }
  }

  return results;
}

export async function uploadToTelegram(
  file: File | Blob,
  fileName: string,
  caption: string,
  channelType: TelegramChannelType = "service",
): Promise<string> {
  const channelId = CHANNELS[channelType];
  if (!TELEGRAM_BOT_TOKEN) throw new Error("TELEGRAM_BOT_TOKEN not configured");
  if (!channelId) throw new Error(`Channel ID for ${channelType} not configured`);

  const formData = new FormData();
  formData.append("chat_id", channelId);
  formData.append("photo", file, fileName);
  formData.append("caption", caption);

  const result = await tgPost("sendPhoto", formData, true);
  const fileId = result.photo[result.photo.length - 1].file_id;
  const url = await getFileUrl(fileId);
  if (!url) throw new Error("Failed to get Telegram file URL");
  return url;
}

export interface ExpenseNotificationData {
  expenseId: string;
  itemName: string;
  amount: number;
  paymentMethod: string;
  handledByName: string;
  notes?: string;
  proofPhotoUrls: string[];
  createdAt: string;
}

export async function sendExpenseTelegramNotification(
  data: ExpenseNotificationData,
): Promise<{ messageId: number; chatId: string }> {
  const chatId = process.env.TELEGRAM_CHANNEL_BUKU_KAS || CHANNELS.buku_kas || CHANNELS.layanan;
  if (!TELEGRAM_BOT_TOKEN) throw new Error("TELEGRAM_BOT_TOKEN not configured");
  if (!chatId) throw new Error("Telegram chat ID for Buku Kas not configured");

  const formattedDate = new Date(data.createdAt).toLocaleDateString("id-ID", {
    day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
  });

  const caption = [
    data.proofPhotoUrls.length > 0 ? "(foto bukti pengeluaran)" : "",
    "",
    "📋 **PENGELUARAN BARU**",
    "────────────────────",
    `📅 Tanggal: ${formattedDate}`,
    `🛒 Nama Barang: ${data.itemName}`,
    `💰 Nominal: Rp ${data.amount.toLocaleString("id-ID")}`,
    `💳 Jenis Pembayaran: ${data.paymentMethod}`,
    `👤 Operator: ${data.handledByName}`,
    data.notes ? `📝 Catatan: ${data.notes}` : null,
    "────────────────────",
    "#pengeluaran #operasional",
  ].filter(Boolean).join("\n");

  try {
    if (data.proofPhotoUrls.length > 0) {
      try {
        const photoRes = await fetchWithTimeout(data.proofPhotoUrls[0]);
        if (photoRes.ok) {
          const blob = await photoRes.blob();
          const fileName = `expense_${data.expenseId}_${Date.now()}.jpg`;
          const formData = new FormData();
          formData.append("chat_id", chatId);
          formData.append("photo", blob, fileName);
          formData.append("caption", caption);
          formData.append("parse_mode", "Markdown");

          const result = await tgPost("sendPhoto", formData, true);
          return { messageId: result.message_id, chatId: String(result.chat.id) };
        }
      } catch { /* fallback to text */ }
    }

    const result = await tgPost("sendMessage", {
      chat_id: chatId, text: caption, parse_mode: "Markdown",
    });
    return { messageId: result.message_id, chatId: String(result.chat.id) };
  } catch (error: any) {
    console.error("❌ sendExpenseTelegramNotification:", error.message);
    throw error;
  }
}

export async function sendTelegramMessage(options: {
  chatId: string;
  text: string;
  parseMode?: "HTML" | "Markdown";
}): Promise<{ messageId: number; chatId: string }> {
  const result = await tgPost("sendMessage", {
    chat_id: options.chatId,
    text: options.text,
    parse_mode: options.parseMode || "HTML",
  });
  return { messageId: result.message_id, chatId: String(result.chat.id) };
}
