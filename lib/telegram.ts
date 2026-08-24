import { getSupabaseAdmin } from "@/lib/supabase/admin";

const TG_API = "https://api.telegram.org/bot";

export const TELEGRAM_CHANNEL_TYPES = [
  "attendance",
  "service",
  "layanan",
  "inventory",
  "stock_transfer",
  "closing",
  "customer",
  "kaspin",
  "buku_kas",
  "teknisi_update",
  "qc_update",
  "expense",
] as const;

export type TelegramChannelType = (typeof TELEGRAM_CHANNEL_TYPES)[number];

// Fallback env (legacy) — dipakai bila nilai belum diisi via UI Engineer Dashboard
export const CHANNELS: Record<TelegramChannelType, string | undefined> = {
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
  expense: process.env.TELEGRAM_CHAT_ID,
};

interface CachedTelegramConfig {
  botToken?: string;
  globalChannels: Partial<Record<TelegramChannelType, string>>;
  branchChannels: Map<string, Partial<Record<TelegramChannelType, string>>>;
  branches: Array<{ id: string; code: string | null; name: string }>;
}

let telegramConfigCache: { data: CachedTelegramConfig; expiresAt: number } | null = null;
const TELEGRAM_CONFIG_TTL_MS = 60_000;

export function invalidateTelegramConfig() {
  telegramConfigCache = null;
}

async function loadTelegramConfig(): Promise<CachedTelegramConfig> {
  if (telegramConfigCache && Date.now() < telegramConfigCache.expiresAt) {
    return telegramConfigCache.data;
  }

  try {
    const admin = getSupabaseAdmin();
    const [cfgRes, chanRes, branchRes] = await Promise.all([
      (admin.from("telegram_config") as any).select("bot_token").limit(1).maybeSingle(),
      (admin.from("telegram_channels") as any).select("channel_type, branch_id, chat_id").eq("enabled", true),
      admin.from("branches").select("id, code, name"),
    ]);

    const data: CachedTelegramConfig = {
      botToken: cfgRes.data?.bot_token || undefined,
      globalChannels: {},
      branchChannels: new Map(),
      branches: branchRes.data || [],
    };

    for (const row of chanRes.data || []) {
      if (!row.chat_id) continue;
      const type = row.channel_type as TelegramChannelType;
      if (!row.branch_id) {
        data.globalChannels[type] = row.chat_id;
      } else {
        const perBranch = data.branchChannels.get(row.branch_id) || {};
        perBranch[type] = row.chat_id;
        data.branchChannels.set(row.branch_id, perBranch);
      }
    }

    if (!data.botToken && process.env.TELEGRAM_BOT_TOKEN) {
      data.botToken = process.env.TELEGRAM_BOT_TOKEN;
    }

    telegramConfigCache = { data, expiresAt: Date.now() + TELEGRAM_CONFIG_TTL_MS };
    return data;
  } catch (error) {
    console.error("Failed to load telegram config from DB, using env fallback:", error);
    // Jangan cache kegagalan terlalu lama agar retry cepat
    const fallback: CachedTelegramConfig = {
      botToken: process.env.TELEGRAM_BOT_TOKEN || undefined,
      globalChannels: { ...CHANNELS },
      branchChannels: new Map(),
      branches: [],
    };
    telegramConfigCache = { data: fallback, expiresAt: Date.now() + 10_000 };
    return fallback;
  }
}

export async function getBotToken(): Promise<string | undefined> {
  const cfg = await loadTelegramConfig();
  return cfg.botToken ?? process.env.TELEGRAM_BOT_TOKEN ?? undefined;
}

function normalizeBranchKey(value: string): string {
  return value.toUpperCase().replace(/ARLOGIC\s*/i, "").trim().replace(/\s+/g, "_");
}

/**
 * Nilai efektif dari env legacy untuk tiap tipe × scope (global & per-cabang).
 * Dipakai UI sebagai placeholder agar konfigurasi yang sedang berjalan terlihat.
 */
export function getEnvChannelDefaults(
  branches: Array<{ id: string; code: string | null; name: string }>,
): Record<string, Partial<Record<TelegramChannelType, string>>> {
  const result: Record<string, Partial<Record<TelegramChannelType, string>>> = {
    global: { ...CHANNELS },
  };

  for (const b of branches) {
    const perBranch: Partial<Record<TelegramChannelType, string>> = {};
    for (const type of TELEGRAM_CHANNEL_TYPES) {
      const byCode = b.code
        ? process.env[`TELEGRAM_CHANNEL_${type.toUpperCase()}_${normalizeBranchKey(b.code)}`]
        : undefined;
      const byName = process.env[`TELEGRAM_CHANNEL_${type.toUpperCase()}_${normalizeBranchKey(b.name)}`];
      const value = byCode || byName;
      if (value) perBranch[type] = value;
    }
    result[b.id] = perBranch;
  }

  return result;
}

/**
 * Resolve channel dengan prioritas:
 * 1. DB per-cabang (match by branch_id / kode / nama)
 * 2. DB global
 * 3. Env legacy dinamis: TELEGRAM_CHANNEL_{TIPE}_{CABANG}
 * 4. Env legacy global: TELEGRAM_CHANNEL_{TIPE}
 */
export async function getChannel(
  type: TelegramChannelType,
  branchCode?: string,
  branchName?: string
): Promise<string | undefined> {
  const cfg = await loadTelegramConfig();
  const rawKey = branchCode || branchName;

  if (rawKey) {
    const normalized = normalizeBranchKey(rawKey);
    const branch = cfg.branches.find(
      (b) =>
        normalizeBranchKey(b.code || "") === normalized ||
        normalizeBranchKey(b.name) === normalized ||
        b.id === rawKey,
    );
    if (branch) {
      const hit = cfg.branchChannels.get(branch.id)?.[type];
      if (hit) return hit;
    }

    // Legacy env dinamis per-cabang
    const envDynamic = process.env[`TELEGRAM_CHANNEL_${type.toUpperCase()}_${normalized}`];
    if (envDynamic) return envDynamic;
  }

  return cfg.globalChannels[type] ?? CHANNELS[type];
}

export interface TelegramMessageResult {
  url: string;
  chat_id: string;
  message_id: number;
  file_id: string;
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
  const botToken = await getBotToken();
  if (!botToken) throw new Error("TELEGRAM_BOT_TOKEN not configured");
  const url = `${TG_API}${botToken}/${method}`;
  const options: RequestInit = isFormData
    ? { method: "POST", body }
    : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) };
  return fetchTelegramWithRetry(url, options);
}

async function getFileUrl(fileId: string): Promise<string | null> {
  try {
    const result = await tgPost("getFile", { file_id: fileId });
    if (!result?.file_path) return null;
    const botToken = await getBotToken();
    return `https://api.telegram.org/file/bot${botToken}/${result.file_path}`;
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

  return { url: url || "", chat_id, message_id, file_id: fileId };
}

export async function resolveChatId(channelUsername: string): Promise<string> {
  try {
    const result = await tgPost("getChat", { chat_id: channelUsername });
    return String(result.id);
  } catch {
    return channelUsername;
  }
}

export async function editMessageCaption(chatId: string, messageId: number, caption: string): Promise<boolean> {
  try {
    await tgPost("editMessageCaption", { chat_id: chatId, message_id: messageId, caption });
    return true;
  } catch {
    return false;
  }
}

export async function deleteTelegramMessage(chatId: string | number, messageId: number): Promise<boolean> {
  try {
    await tgPost("deleteMessage", { chat_id: chatId, message_id: messageId });
    return true;
  } catch {
    return false;
  }
}

function isVideoName(name: string): boolean {
  return /\.(mp4|mov|webm|3gp|3gpp|avi)$/i.test(name)
}

function isVideoFileTg(f: { name: string; mime_type?: string }): boolean {
  return !!f.mime_type?.startsWith('video/') || isVideoName(f.name)
}

export async function uploadMultipleToTelegram(
  files: Array<{ buffer: Buffer; name: string; mime_type?: string }>,
  caption: string,
  channelType: TelegramChannelType = "service",
  branchCode?: string,
): Promise<TelegramMessageResult[]> {
  const channelId = await getChannel(channelType, branchCode);
  const botToken = await getBotToken();
  if (!botToken) throw new Error("TELEGRAM_BOT_TOKEN not configured");
  if (!channelId) throw new Error(`Channel ID for ${channelType} not configured`);
  if (!files?.length) return [];

  const toBlob = (buffer: Buffer, mime: string): Blob => new Blob([new Uint8Array(buffer)], { type: mime || "image/jpeg" });

  if (files.length === 1) {
    const f = files[0];
    if (isVideoFileTg(f)) {
      const formData = new FormData();
      formData.append("chat_id", channelId);
      formData.append("video", toBlob(f.buffer, f.mime_type || "video/mp4"), f.name);
      if (caption) formData.append("caption", caption);
      formData.append("parse_mode", "HTML");
      const result = await tgPost("sendVideo", formData, true);
      const chat_id = String(result.chat.id);
      const message_id = result.message_id;
      const fileId = result.video?.file_id || "";
      const url = fileId ? await getFileUrl(fileId) : "";
      return [{ url: url || "", chat_id, message_id, file_id: fileId }];
    }
    const result = await sendPhotoBlob(channelId, toBlob(f.buffer, f.mime_type || "image/jpeg"), f.name, caption);
    return [result];
  }

  const media = files.map((f, idx) => ({
    type: isVideoFileTg(f) ? "video" : "photo",
    media: `attach://file_${idx}`,
    ...(idx === 0 && caption ? { caption } : {}),
  }));

  const formData = new FormData();
  formData.append("chat_id", channelId);
  formData.append("media", JSON.stringify(media));
  files.forEach((f, idx) =>
    formData.append(`file_${idx}`, toBlob(f.buffer, f.mime_type || "image/jpeg"), `${idx}.${isVideoFileTg(f) ? "mp4" : "jpg"}`),
  );

  const sendResult = await tgPost("sendMediaGroup", formData, true);

  if (!Array.isArray(sendResult)) {
    throw new Error("Telegram sendMediaGroup returned non-array result");
  }

  const results: TelegramMessageResult[] = [];
  for (let i = 0; i < sendResult.length; i++) {
    const r = sendResult[i];
    const chat_id = String(r.chat.id);
    const message_id = r.message_id;
    const photoArr = Array.isArray(r.photo) && r.photo.length > 0 ? r.photo : null;
    const fileId = photoArr ? photoArr[photoArr.length - 1].file_id : r.video?.file_id || "";
    const url = await getFileUrl(fileId);
    results.push({ url: url || "", chat_id, message_id, file_id: fileId });
  }

  return results;
}

export async function uploadToTelegram(
  file: File | Blob,
  fileName: string,
  caption: string,
  channelType: TelegramChannelType = "service",
): Promise<string> {
  const channelId = await getChannel(channelType);
  const botToken = await getBotToken();
  if (!botToken) throw new Error("TELEGRAM_BOT_TOKEN not configured");
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
  const chatId = (await getChannel("buku_kas")) || (await getChannel("layanan"));
  const botToken = await getBotToken();
  if (!botToken) throw new Error("TELEGRAM_BOT_TOKEN not configured");
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
