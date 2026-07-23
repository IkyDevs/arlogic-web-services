import { createClient } from "@/lib/supabase/client";
import { NextResponse } from "next/server";
import { sendExpenseTelegramNotification } from "@/lib/telegram";
import { validateOrigin } from "@/lib/csrf";
import { rateLimitIP } from "@/lib/rate-limit";
import { expenseSchema } from "@/lib/validation/schemas";

export async function POST(request: Request) {
  try {
    if (!validateOrigin(request)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const rl = rateLimitIP(request)
    if (!rl.allowed) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 })
    }

    const body = await request.json();
    const parsed = expenseSchema.parse(body);

    const supabase = createClient();

    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role, full_name")
      .eq("id", authUser.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 403 });
    }

    if (profile.role !== "admin") {
      return NextResponse.json({ error: "Only admin can create expenses" }, { status: 403 });
    }

    const { data: expense, error: insertError } = await supabase
      .from("expenses")
      .insert({
        item_name: parsed.item_name,
        amount: parsed.amount,
        payment_method: parsed.payment_method,
        handled_by: parsed.handled_by || authUser.id,
        handled_by_name: profile.full_name,
        notes: parsed.notes,
        proof_photo_urls: parsed.proof_photo_urls || [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (insertError) {
      console.error("Error creating expense:", insertError);
      return NextResponse.json({ error: "Failed to create expense", details: insertError.message }, { status: 500 });
    }

    let telegramMessageId = 0;
    try {
      const telegramResult = await sendExpenseTelegramNotification({
        expenseId: expense.id,
        itemName: parsed.item_name,
        amount: parsed.amount,
        paymentMethod: parsed.payment_method,
        handledByName: profile.full_name,
        notes: parsed.notes,
        proofPhotoUrls: parsed.proof_photo_urls || [],
        createdAt: new Date().toISOString(),
      });
      telegramMessageId = telegramResult.messageId || 0;
      await supabase.from("expenses").update({
        telegram_chat_id: process.env.TELEGRAM_CHAT_ID || "",
        telegram_message_id: telegramMessageId,
        updated_at: new Date().toISOString(),
      }).eq("id", expense.id);
    } catch (telegramError) {
      console.warn("Failed to send Telegram notification:", telegramError);
    }

    await supabase.from("activity_logs").insert({
      user_id: authUser.id,
      action: "expense_created",
      details: { expense_id: expense.id, item_name: parsed.item_name, amount: parsed.amount },
    });

    return NextResponse.json({
      success: true,
      message: "Expense created successfully",
      data: { ...expense, telegram_message_id: telegramMessageId },
    });
  } catch (error: any) {
    console.error("[Expense API Error]", error);
    return NextResponse.json({ error: "Internal server error", details: error.message }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const supabase = createClient();

    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(request.url);
    const startDate = url.searchParams.get("start_date");
    const endDate = url.searchParams.get("end_date");
    const paymentMethod = url.searchParams.get("payment_method");
    const handledBy = url.searchParams.get("handled_by");
    const limit = parseInt(url.searchParams.get("limit") || "50");
    const offset = parseInt(url.searchParams.get("offset") || "0");

    let query = supabase
      .from("expenses")
      .select("*, profiles(full_name, role)", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (startDate) query = query.gte("created_at", `${startDate}T00:00:00`);
    if (endDate) query = query.lte("created_at", `${endDate}T23:59:59`);
    if (paymentMethod) query = query.eq("payment_method", paymentMethod);
    if (handledBy) query = query.eq("handled_by", handledBy);

    const { data: expenses, error, count } = await query;

    if (error) {
      console.error("Error fetching expenses:", error);
      return NextResponse.json({ error: "Failed to fetch expenses", details: error.message }, { status: 500 });
    }

    let summary = {};
    if (expenses && expenses.length > 0) {
      const totalAmount = expenses.reduce((sum, e) => sum + parseFloat(e.amount), 0);
      const today = new Date().toISOString().split("T")[0];
      const todayExpenses = expenses.filter((e) => e.created_at.split("T")[0] === today);
      summary = { total_amount: totalAmount, total_count: expenses.length, today_count: todayExpenses.length, today_amount: todayExpenses.reduce((s, e) => s + parseFloat(e.amount), 0) };
    }

    return NextResponse.json({
      success: true,
      data: expenses || [],
      summary,
      pagination: { total: count || 0, limit, offset, has_more: (count || 0) > offset + limit },
    });
  } catch (error: any) {
    console.error("[Expenses List Error]", error);
    return NextResponse.json({ error: "Internal server error", details: error.message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json({ error: "Expense ID is required" }, { status: 400 });
    }

    const supabase = createClient();

    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile } = await supabase.from("profiles").select("role").eq("id", authUser.id).single();
    if (profile?.role !== "admin") {
      return NextResponse.json({ error: "Only admin can update expenses" }, { status: 403 });
    }

    const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (body.item_name !== undefined) updateData.item_name = body.item_name;
    if (body.amount !== undefined) updateData.amount = parseFloat(body.amount);
    if (body.payment_method !== undefined) updateData.payment_method = body.payment_method;
    if (body.handled_by !== undefined) updateData.handled_by = body.handled_by;
    if (body.handled_by_name !== undefined) updateData.handled_by_name = body.handled_by_name;
    if (body.notes !== undefined) updateData.notes = body.notes;
    if (body.proof_photo_urls !== undefined) updateData.proof_photo_urls = body.proof_photo_urls;

    const { data: expense, error: updateError } = await supabase
      .from("expenses").update(updateData).eq("id", id).select().single();

    if (updateError) {
      return NextResponse.json({ error: "Failed to update expense", details: updateError.message }, { status: 500 });
    }

    await supabase.from("activity_logs").insert({
      user_id: authUser.id, action: "expense_updated", details: { expense_id: id, ...updateData },
    });

    return NextResponse.json({ success: true, message: "Expense updated successfully", data: expense });
  } catch (error: any) {
    console.error("[Expense Update Error]", error);
    return NextResponse.json({ error: "Internal server error", details: error.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const url = new URL(request.url);
    const id = url.searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "Expense ID is required" }, { status: 400 });
    }

    const supabase = createClient();

    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile } = await supabase.from("profiles").select("role").eq("id", authUser.id).single();
    if (profile?.role !== "admin") {
      return NextResponse.json({ error: "Only admin can delete expenses" }, { status: 403 });
    }

    const { data: expense } = await supabase.from("expenses").select("*").eq("id", id).single();
    const { error: deleteError } = await supabase.from("expenses").delete().eq("id", id);
    if (deleteError) {
      return NextResponse.json({ error: "Failed to delete expense", details: deleteError.message }, { status: 500 });
    }

    await supabase.from("activity_logs").insert({
      user_id: authUser.id, action: "expense_deleted", details: { expense_id: id, item_name: expense?.item_name },
    });

    return NextResponse.json({ success: true, message: "Expense deleted successfully" });
  } catch (error: any) {
    console.error("[Expense Delete Error]", error);
    return NextResponse.json({ error: "Internal server error", details: error.message }, { status: 500 });
  }
}
