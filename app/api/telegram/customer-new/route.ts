import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { customerNewSchema } from "@/lib/validation/schemas";

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN!;
const CHANNEL_CUSTOMER = process.env.TELEGRAM_CHANNEL_CUSTOMER!;

function formatName(name: string, phone: string): string {
  const clean = phone.replace(/\D/g, "");
  const last4 = clean.slice(-4);
  if (!last4 || name.endsWith(` ${last4}`)) return name.trim();
  return `${name.trim()} ${last4}`;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = customerNewSchema.parse(body);

    const cleanPhone = parsed.phone.replace(/\D/g, "");
    if (!cleanPhone) {
      return NextResponse.json({ error: "invalid phone" }, { status: 400 });
    }

    const supabase = getSupabaseAdmin() as any;

    const { data: existing } = await supabase
      .from("customers")
      .select("id, name")
      .eq("phone", cleanPhone)
      .maybeSingle();

    if (existing) {
      await supabase
        .from("customers")
        .update({ last_transaction: new Date().toISOString() })
        .eq("id", existing.id);

      return NextResponse.json({ status: "existing", name: existing.name });
    }

    const formattedName = formatName(parsed.name, cleanPhone);

    await supabase.from("customers").insert({
      name: formattedName,
      phone: cleanPhone,
    });

    if (TELEGRAM_BOT_TOKEN && CHANNEL_CUSTOMER) {
      const msg = `CUSTOMER BARU \nnama cs: ${formattedName}\nno. wa: ${cleanPhone}`;
      await fetch(
        `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: CHANNEL_CUSTOMER, text: msg }),
        }
      );
    }

    return NextResponse.json({ status: "new", name: formattedName, sent: true });
  } catch (e: any) {
    console.error("[Customer New Error]", e.message);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
