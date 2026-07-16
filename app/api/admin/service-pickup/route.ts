import { createClient } from "@/lib/supabase/client";
import { NextResponse } from "next/server";
import { sendTelegramMessage } from "@/lib/telegram";
import { validateOrigin } from "@/lib/csrf";
import { rateLimitIP } from "@/lib/rate-limit";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { serviceOrderId } = body;

    // CSRF & rate limit checks
    if (!validateOrigin(request)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const rl = rateLimitIP(request)
    if (!rl.allowed) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 })
    }

    const supabase = createClient();

    // 1. Verify user authentication
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();
    if (!authUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Check if user is admin
    const { data: profile } = await supabase
      .from("profiles")
      .select("role, full_name")
      .eq("id", authUser.id)
      .single();

    if (profile?.role !== "admin") {
      return NextResponse.json(
        { error: "Only admin can mark service as picked up" },
        { status: 403 },
      );
    }

    // 3. Get service order details
    const { data: serviceOrder } = await supabase
      .from("service_orders")
      .select("*, profiles(full_name)")
      .eq("id", serviceOrderId)
      .single();

    if (!serviceOrder) {
      return NextResponse.json(
        { error: "Service order not found" },
        { status: 404 },
      );
    }

    // 4. Check if service is completed
    if (serviceOrder.status !== "completed") {
      return NextResponse.json(
        { error: "Service must be completed before marking as picked up" },
        { status: 400 },
      );
    }

    // 5. Check if already picked up
    if (serviceOrder.picked_up_at) {
      return NextResponse.json(
        { error: "Service already picked up" },
        { status: 400 },
      );
    }

    // 6. Update service order with pickup time
    const { error: updateError } = await supabase
      .from("service_orders")
      .update({
        picked_up_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", serviceOrderId);

    if (updateError) {
      console.error("Error updating service order:", updateError);
      return NextResponse.json(
        { error: "Failed to update service order" },
        { status: 500 },
      );
    }

    // 7. Send Telegram notification if configured
    try {
      await sendTelegramMessage({
        chatId: process.env.TELEGRAM_CHAT_ID || "",
        text: `✅ SERVICE SUDAH DIAMBIL\n\n📦 Order: ${serviceOrder.invoice_number}\n👤 Customer: ${serviceOrder.customer_name}\n📱 Phone: ${serviceOrder.customer_phone}\n⏰ Selesai: ${new Date(serviceOrder.completed_at).toLocaleDateString("id-ID")}\n⏰ Diambil: ${new Date().toLocaleDateString("id-ID")} ${new Date().toLocaleTimeString("id-ID")}\n👤 Admin: ${profile?.full_name || "Admin"}\n\n#servicedone #pickup`,
        parseMode: "HTML",
      });
    } catch (telegramError) {
      console.warn("Failed to send Telegram notification:", telegramError);
      // Continue even if Telegram fails
    }

    // 8. Create activity log
    await supabase.from("activity_logs").insert({
      user_id: authUser.id,
      action: "service_picked_up",
      details: {
        service_order_id: serviceOrderId,
        invoice_number: serviceOrder.invoice_number,
        customer_name: serviceOrder.customer_name,
        picked_up_at: new Date().toISOString(),
      },
    });

    return NextResponse.json({
      success: true,
      message: "Service marked as picked up successfully",
      data: {
        service_order_id: serviceOrderId,
        picked_up_at: new Date().toISOString(),
      },
    });
  } catch (error: any) {
    console.error("Error in service pickup API:", error);
    return NextResponse.json(
      { error: "Internal server error", details: error.message },
      { status: 500 },
    );
  }
}

export async function GET(request: Request) {
  try {
    const supabase = createClient();

    // Verify user authentication
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();
    if (!authUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(request.url);
    const serviceOrderId = url.searchParams.get("serviceOrderId");

    if (!serviceOrderId) {
      return NextResponse.json(
        { error: "serviceOrderId parameter is required" },
        { status: 400 },
      );
    }

    // Get service order with pickup status
    const { data: serviceOrder } = await supabase
      .from("service_orders")
      .select(
        "id, invoice_number, customer_name, status, picked_up_at, completed_at",
      )
      .eq("id", serviceOrderId)
      .single();

    if (!serviceOrder) {
      return NextResponse.json(
        { error: "Service order not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: true,
      data: serviceOrder,
      is_picked_up: !!serviceOrder.picked_up_at,
      can_be_picked_up:
        serviceOrder.status === "completed" && !serviceOrder.picked_up_at,
    });
  } catch (error: any) {
    console.error("Error getting service pickup status:", error);
    return NextResponse.json(
      { error: "Internal server error", details: error.message },
      { status: 500 },
    );
  }
}
