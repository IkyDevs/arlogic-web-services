import { NextResponse } from "next/server";
import { getBotToken, getChannel } from "@/lib/telegram";

export async function POST(req: Request) {
  try {
    console.log("[send-nota] POST request received");
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const caption = (formData.get("caption") as string) || "🧾 NOTA TRANSAKSI";
    const branchCode = (formData.get("branch_code") as string) || "";
    const branchName = (formData.get("branch_name") as string) || "";

    console.log("[send-nota] Parsed formData:", {
      hasFile: !!file,
      fileName: file?.name,
      fileSize: file?.size,
      captionLength: caption.length,
      branchCode,
      branchName,
    });

    if (!file) {
      console.error("[send-nota] ERROR: File not found in formData");
      return NextResponse.json(
        { error: "File foto nota tidak ditemukan" },
        { status: 400 },
      );
    }

    const botToken = await getBotToken();
    if (!botToken) {
      console.error("[send-nota] ERROR: TELEGRAM_BOT_TOKEN not configured");
      return NextResponse.json(
        { error: "TELEGRAM_BOT_TOKEN belum dikonfigurasi" },
        { status: 500 },
      );
    }

    // Resolve channel dynamically per branch - use "layanan" type for transaction channel
    // This will look for TELEGRAM_CHANNEL_LAYANAN_{branchCode} or fall back to TELEGRAM_CHANNEL_LAYANAN
    const channelId =
      (await getChannel("layanan", branchCode, branchName)) ||
      (await getChannel("layanan"));

    console.log("[send-nota] Resolved channelId:", channelId, {
      branchCode,
      branchName,
      fallback: !branchCode && !branchName,
    });

    if (!channelId) {
      console.error("[send-nota] ERROR: Channel ID not resolved");
      return NextResponse.json(
        { error: "Telegram channel service/cabang belum dikonfigurasi" },
        { status: 400 },
      );
    }

    // Prepare Telegram SendPhoto FormData
    const tgFormData = new FormData();
    tgFormData.append("chat_id", channelId);
    tgFormData.append("photo", file, file.name || "nota.png");
    tgFormData.append("caption", caption);
    tgFormData.append("parse_mode", "HTML");

    console.log("[send-nota] Sending to Telegram API...");
    const tgRes = await fetch(
      `https://api.telegram.org/bot${botToken}/sendPhoto`,
      {
        method: "POST",
        body: tgFormData,
      },
    );

    const tgData = await tgRes.json();
    console.log("[send-nota] Telegram response status:", tgRes.status);
    console.log("[send-nota] Telegram response:", tgData);

    if (!tgData.ok) {
      console.error("[send-nota] ERROR: Telegram API returned error", tgData);
      return NextResponse.json(
        {
          error: tgData.description || "Gagal mengirim nota ke Telegram",
          tg_response: tgData,
        },
        { status: 500 },
      );
    }

    const resultPhoto = tgData.result?.photo;
    const fileId = resultPhoto
      ? resultPhoto[resultPhoto.length - 1]?.file_id
      : null;

    console.log("[send-nota] SUCCESS:", {
      messageId: tgData.result?.message_id,
      channelId,
      fileId,
    });

    return NextResponse.json({
      success: true,
      message_id: tgData.result?.message_id,
      chat_id: channelId,
      file_id: fileId,
    });
  } catch (err: any) {
    console.error("[send-nota] EXCEPTION:", err);
    return NextResponse.json(
      { error: err.message || "Internal Server Error" },
      { status: 500 },
    );
  }
}
