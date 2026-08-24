import { NextRequest, NextResponse } from "next/server";
import { validateOrigin } from "@/lib/csrf";
import { getChannel, sendTelegramMessage } from "@/lib/telegram";
import { requireTelegramConfigAccess } from "@/lib/api-guards";

export async function POST(request: NextRequest) {
  if (!validateOrigin(request)) {
    return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  }

  const auth = await requireTelegramConfigAccess();
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const chatId =
    (typeof body.chat_id === "string" && body.chat_id.trim()) ||
    (body.channel_type ? await getChannel(body.channel_type, body.branch || undefined) : undefined);

  if (!chatId) {
    return NextResponse.json(
      { success: false, error: "Chat ID belum dikonfigurasi untuk channel ini" },
      { status: 400 },
    );
  }

  try {
    const result = await sendTelegramMessage({
      chatId,
      text: "🤖 <b>Test Message</b>\nKonfigurasi Telegram dari Engineer Dashboard berhasil terkirim.",
    });
    return NextResponse.json({ success: true, chat_id: result.chatId, message_id: result.messageId });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || "Gagal mengirim test message" },
      { status: 502 },
    );
  }
}
