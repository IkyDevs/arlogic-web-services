import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

// Create table script for manual setup in Supabase SQL editor
export const CREATE_TABLE_SQL = `CREATE TABLE IF NOT EXISTS closings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  closing_date DATE NOT NULL,
  total_transactions INTEGER NOT NULL DEFAULT 0,
  total_expected BIGINT NOT NULL DEFAULT 0,
  total_actual BIGINT NOT NULL DEFAULT 0,
  difference BIGINT NOT NULL DEFAULT 0,
  difference_notes TEXT,
  detail JSONB DEFAULT '{}',
  notes TEXT,
  status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'rejected')) DEFAULT 'pending',
  admin_notes TEXT,
  rejection_reason TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  telegram_chat_id TEXT DEFAULT '',
  telegram_message_id BIGINT DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_closings_date ON closings(closing_date);
CREATE INDEX IF NOT EXISTS idx_closings_status ON closings(status);

-- Grant access (service_role bypasses RLS but this ensures anon can too)
ALTER TABLE closings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Full access via service_role" ON closings USING (true) WITH CHECK (true);`;

// Use service_role to bypass RLS
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

const CHANNEL_CLOSING = process.env.TELEGRAM_CHANNEL_CLOSING;

function fmtRupiah(n: number) {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(n);
}

function buildClosingMessage(closing: any): string {
  const d = new Date(closing.closing_date);
  const dayNames = ["Minggu","Senin","Selasa","Rabu","Kamis","Jumat","Sabtu"];
  const monthNames = ["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"];
  const dateStr = `${dayNames[d.getDay()]}, ${d.getDate()} ${monthNames[d.getMonth()]}, ${d.getFullYear()}`;

  const detail = closing.detail || {};
  const paymentLines = Object.entries(detail)
    .map(([method, val]: [string, any]) => ` > ${method}: ${fmtRupiah(val.actual || 0)}`)
    .join("\n");

  const diffStatus = closing.difference === 0 ? "DONE" : "SELISIH";
  const ownerStatus = closing.status === "approved" ? "Approve" : "waiting approve owner";

  let msg = `CLOSING
tanggal : ${dateStr}
total keseluruhan : ${fmtRupiah(closing.total_expected)}
total payment:
${paymentLines}
status : ${diffStatus}
owner : ${ownerStatus}`;

  if (closing.admin_notes) {
    msg += `\nnotes: ${closing.admin_notes}`;
  }
  if (closing.difference_notes) {
    msg += `\ncatatan selisih: ${closing.difference_notes}`;
  }

  return msg;
}

async function sendTelegramMessage(text: string): Promise<{ chat_id: string; message_id: number } | null> {
  if (!TELEGRAM_BOT_TOKEN || !CHANNEL_CLOSING) return null;
  try {
    const res = await fetch(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: CHANNEL_CLOSING, text, parse_mode: "HTML" }),
      }
    );
    const data = await res.json();
    if (!data.ok) {
      console.error("❌ Telegram sendMessage error:", data.description);
      return null;
    }
    return { chat_id: String(data.result.chat.id), message_id: data.result.message_id };
  } catch (e: any) {
    console.error("❌ Telegram sendMessage failed:", e.message);
    return null;
  }
}

async function editTelegramMessage(chatId: string, messageId: number, text: string): Promise<boolean> {
  if (!TELEGRAM_BOT_TOKEN) return false;
  try {
    const res = await fetch(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/editMessageText`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, message_id: messageId, text, parse_mode: "HTML" }),
      }
    );
    const data = await res.json();
    if (!data.ok) {
      console.error("❌ Telegram editMessageText error:", data.description);
      return false;
    }
    return true;
  } catch (e: any) {
    console.error("❌ Telegram editMessageText failed:", e.message);
    return false;
  }
}

async function handleAction(action: string, payload: any) {
  switch (action) {
    case "create": {
      const { data, error } = await supabase.from("closings").insert(payload.data).select().single();
      if (error) throw error;

      // Send to Telegram
      const msg = buildClosingMessage(data);
      const tgRef = await sendTelegramMessage(msg);
      if (tgRef) {
        const { error: updateErr } = await supabase
          .from("closings")
          .update({ telegram_chat_id: tgRef.chat_id, telegram_message_id: tgRef.message_id })
          .eq("id", data.id);
        if (!updateErr) data.telegram_chat_id = tgRef.chat_id;
        if (!updateErr) data.telegram_message_id = tgRef.message_id;
      }

      return data;
    }
    case "approve": {
      const { data, error } = await supabase
        .from("closings")
        .update({ status: "approved", admin_notes: payload.admin_notes || null, updated_at: new Date().toISOString() })
        .eq("id", payload.id)
        .select()
        .single();
      if (error) throw error;

      // Edit Telegram caption if we have the message reference
      if (data.telegram_chat_id && data.telegram_message_id) {
        const msg = buildClosingMessage(data);
        await editTelegramMessage(data.telegram_chat_id, data.telegram_message_id, msg);
      } else {
        // Fallback: send new message
        const msg = buildClosingMessage(data);
        await sendTelegramMessage(msg);
      }

      return data;
    }
    case "list": {
      const { data, error } = await supabase.from("closings").select("*").order("created_at", { ascending: false }).limit(50);
      if (error) throw error;
      return data;
    }
    default:
      throw new Error("Invalid action");
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const result = await handleAction(body.action, body);
    return NextResponse.json({ success: true, data: result });
  } catch (error: any) {
    // If table doesn't exist, provide setup instructions
    if (error.message?.includes("relation") && error.message?.includes("does not exist")) {
      return NextResponse.json({
        success: false,
        error: "Table 'closings' belum ada. Jalankan SQL berikut di Supabase SQL Editor:\n\n" + CREATE_TABLE_SQL,
        needsSetup: true,
        sql: CREATE_TABLE_SQL,
      }, { status: 200 });
    }
    console.error("Closing API error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// GET endpoint to return the SQL for setup
export async function GET() {
  return NextResponse.json({ sql: CREATE_TABLE_SQL });
}
