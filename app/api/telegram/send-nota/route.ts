import { NextResponse } from "next/server";
import { getChannel } from "@/lib/telegram";

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const caption = (formData.get("caption") as string) || "🧾 NOTA TRANSAKSI";
    const branchCode = (formData.get("branch_code") as string) || "";
    const branchName = (formData.get("branch_name") as string) || "";

    if (!file) {
      return NextResponse.json(
        { error: "File foto nota tidak ditemukan" },
        { status: 400 }
      );
    }

    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) {
      return NextResponse.json(
        { error: "TELEGRAM_BOT_TOKEN belum dikonfigurasi" },
        { status: 500 }
      );
    }

    // Resolve channel dynamically per branch
    const channelId =
      getChannel("service", branchCode, branchName) ||
      process.env.TELEGRAM_CHANNEL_SERVICE ||
      process.env.TELEGRAM_CHANNEL_LAYANAN;

    if (!channelId) {
      return NextResponse.json(
        { error: "Telegram channel service/cabang belum dikonfigurasi" },
        { status: 400 }
      );
    }

    // Prepare Telegram SendPhoto FormData
    const tgFormData = new FormData();
    tgFormData.append("chat_id", channelId);
    tgFormData.append("photo", file, file.name || "nota.png");
    tgFormData.append("caption", caption);
    tgFormData.append("parse_mode", "HTML");

    const tgRes = await fetch(
      `https://api.telegram.org/bot${botToken}/sendPhoto`,
      {
        method: "POST",
        body: tgFormData,
      }
    );

    const tgData = await tgRes.json();

    if (!tgData.ok) {
      return NextResponse.json(
        {
          error: tgData.description || "Gagal mengirim nota ke Telegram",
          tg_response: tgData,
        },
        { status: 500 }
      );
    }

    const resultPhoto = tgData.result?.photo;
    const fileId = resultPhoto
      ? resultPhoto[resultPhoto.length - 1]?.file_id
      : null;

    return NextResponse.json({
      success: true,
      message_id: tgData.result?.message_id,
      chat_id: channelId,
      file_id: fileId,
    });
  } catch (err: any) {
    console.error("Error in /api/telegram/send-nota:", err);
    return NextResponse.json(
      { error: err.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}
