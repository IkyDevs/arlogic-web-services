import { NextRequest, NextResponse } from "next/server";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
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
    const { name, phone } = await request.json();
    if (!name || !phone) {
      return NextResponse.json({ error: "name and phone required" }, { status: 400 });
    }

    const cleanPhone = phone.replace(/\D/g, "");
    if (!cleanPhone) {
      return NextResponse.json({ error: "invalid phone" }, { status: 400 });
    }

    const supabase = await import("@supabase/supabase-js").then((m) =>
      m.createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE)
    );

    // Check if customer exists in customers table
    const { data: existing } = await supabase
      .from("customers")
      .select("id, name")
      .eq("phone", cleanPhone)
      .maybeSingle();

    if (existing) {
      // Update last_transaction
      await supabase
        .from("customers")
        .update({ last_transaction: new Date().toISOString() })
        .eq("id", existing.id);

      return NextResponse.json({ status: "existing", name: existing.name });
    }

    // New customer — format name with last 4 digits
    const formattedName = formatName(name, cleanPhone);

    // Insert into customers table
    await supabase.from("customers").insert({
      name: formattedName,
      phone: cleanPhone,
    });

    // Send to Telegram
    if (TELEGRAM_BOT_TOKEN && CHANNEL_CUSTOMER) {
      const msg = `CUSTOMER BARU 
nama cs: ${formattedName}
no. wa: ${cleanPhone}`;

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
    console.error("❌ customer-new error:", e.message);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
