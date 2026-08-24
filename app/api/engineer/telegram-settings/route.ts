import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { validateOrigin } from "@/lib/csrf";
import { invalidateTelegramConfig, getEnvChannelDefaults } from "@/lib/telegram";
import { requireTelegramConfigAccess } from "@/lib/api-guards";

function maskToken(token: string | null | undefined): string | null {
  if (!token) return null;
  const tail = token.slice(-4);
  return `••••••••${tail}`;
}

export async function GET(request: NextRequest) {
  const auth = await requireTelegramConfigAccess();
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const admin = getSupabaseAdmin();
  const [cfgRes, chanRes, branchRes] = await Promise.all([
    (admin.from("telegram_config") as any).select("bot_token, updated_at").limit(1).maybeSingle(),
    (admin.from("telegram_channels") as any).select("channel_type, branch_id, chat_id, enabled"),
    admin.from("branches").select("id, name, code").order("name"),
  ]);

  return NextResponse.json({
    bot_token_set: !!cfgRes.data?.bot_token,
    bot_token_masked: maskToken(cfgRes.data?.bot_token),
    bot_token_updated_at: cfgRes.data?.updated_at ?? null,
    channels: chanRes.data ?? [],
    branches: branchRes.data ?? [],
    env_defaults: getEnvChannelDefaults(branchRes.data ?? []),
    user_branch_id: auth.branchId,
  });
}

export async function PUT(request: NextRequest) {
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

  const admin = getSupabaseAdmin();

  try {
    // Bot token: string non-kosong = set; null = hapus; undefined = biarkan
    if (body.bot_token !== undefined) {
      const cfgTable = () => admin.from("telegram_config") as any;
      if (body.bot_token === null || body.bot_token === "") {
        const { error } = await cfgTable().update({
          bot_token: null, updated_by: auth.userId, updated_at: new Date().toISOString(),
        }).neq("id", "00000000-0000-0000-0000-000000000000");
        if (error) throw new Error(`Gagal hapus token: ${error.message}`);
      } else if (typeof body.bot_token === "string") {
        const { data: existing, error: selErr } = await cfgTable().select("id").limit(1).maybeSingle();
        if (selErr) throw new Error(`Gagal baca konfigurasi: ${selErr.message}`);
        const payload = { bot_token: body.bot_token.trim(), updated_by: auth.userId, updated_at: new Date().toISOString() };
        const { error, data } = existing?.id
          ? await cfgTable().update(payload).eq("id", existing.id).select("id")
          : await cfgTable().insert(payload).select("id");
        if (error) throw new Error(`Gagal simpan token: ${error.message}`);
        if (!data || data.length === 0) throw new Error("Tulis token tidak menghasilkan perubahan di database");
      }
    }

    // Channels: upsert manual per baris (aman terhadap unique index NULLS NOT DISTINCT)
    if (Array.isArray(body.channels)) {
      for (const item of body.channels) {
        const channelType = String(item.channel_type || "");
        if (!channelType) continue;
        const branchId = item.branch_id || null;
        const chatId = typeof item.chat_id === "string" ? item.chat_id.trim() : null;
        const enabled = item.enabled !== false;

        const chanTable = () => admin.from("telegram_channels") as any;
        const { data: existing, error: selErr } = await chanTable()
          .select("id")
          .eq("channel_type", channelType)
          .filter("branch_id", branchId === null ? "is" : "eq", branchId)
          .maybeSingle();
        if (selErr) throw new Error(`Gagal baca channel ${channelType}: ${selErr.message}`);

        if (!chatId) {
          if (existing?.id) {
            const { error } = await chanTable().delete().eq("id", existing.id);
            if (error) throw new Error(`Gagal hapus channel ${channelType}: ${error.message}`);
          }
          continue;
        }

        const payload = { chat_id: chatId, enabled, updated_by: auth.userId, updated_at: new Date().toISOString() };
        const { error, data } = existing?.id
          ? await chanTable().update(payload).eq("id", existing.id).select("id")
          : await chanTable().insert({ channel_type: channelType, branch_id: branchId, ...payload }).select("id");
        if (error) throw new Error(`Gagal simpan channel ${channelType}: ${error.message}`);
        if (!data || data.length === 0) throw new Error(`Tulis channel ${channelType} tidak menghasilkan perubahan`);
      }
    }
  } catch (error: any) {
    console.error("[telegram-settings PUT]", error);
    return NextResponse.json(
      { error: error?.message || "Gagal menyimpan konfigurasi Telegram" },
      { status: 500 },
    );
  }

  invalidateTelegramConfig();

  // Read-back: pastikan benar-benar tersimpan
  let savedToken: string | null = null;
  const verify = await Promise.all([
    (admin.from("telegram_config") as any).select("bot_token").limit(1).maybeSingle(),
    (admin.from("telegram_channels") as any).select("channel_type, branch_id, chat_id, enabled"),
  ]);
  savedToken = verify[0].data?.bot_token ?? null;

  return NextResponse.json({
    success: true,
    bot_token_saved: !!savedToken,
    channels_saved: verify[1].data?.length ?? 0,
  });
}
