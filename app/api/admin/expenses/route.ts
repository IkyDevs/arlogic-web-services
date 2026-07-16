import { createClient } from "@/lib/supabase/client";
import { NextResponse } from "next/server";
import { sendExpenseTelegramNotification } from "@/lib/telegram";
import { validateOrigin } from "@/lib/csrf";
import { rateLimitIP } from "@/lib/rate-limit";

export async function POST(request: Request) {
  try {
    // CSRF & rate limit checks
    if (!validateOrigin(request)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const rl = rateLimitIP(request)
    if (!rl.allowed) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 })
    }

    const body = await request.json();
    const {
      item_name,
      amount,
      payment_method,
      handled_by,
      handled_by_name,
      notes,
      proof_photo_urls = [],
    } = body;

    // Validate required fields
    if (!item_name || !amount || !payment_method || !handled_by) {
      return NextResponse.json(
        {
          error:
            "Missing required fields: item_name, amount, payment_method, handled_by",
        },
        { status: 400 },
      );
    }

    // Validate amount is positive number
    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      return NextResponse.json(
        { error: "Amount must be a positive number" },
        { status: 400 },
      );
    }

    const supabase = createClient();

    // Verify user authentication
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();
    if (!authUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user is admin
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role, full_name")
      .eq("id", authUser.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 403 });
    }

    if (profile?.role !== "admin") {
      return NextResponse.json(
        { error: "Only admin can create expenses" },
        { status: 403 },
      );
    }

    // Create expense record
    const { data: expense, error: insertError } = await supabase
      .from("expenses")
      .insert({
        item_name,
        amount: amountNum,
        payment_method,
        handled_by,
        handled_by_name: handled_by_name || profile.full_name,
        notes,
        proof_photo_urls,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (insertError) {
      console.error("Error creating expense:", insertError);
      return NextResponse.json(
        { error: "Failed to create expense", details: insertError.message },
        { status: 500 },
      );
    }

    // Send Telegram notification
    let telegramMessageId = 0;
    try {
      const telegramResult = await sendExpenseTelegramNotification({
        expenseId: expense.id,
        itemName: item_name,
        amount: amountNum,
        paymentMethod: payment_method,
        handledByName: handled_by_name || profile.full_name,
        notes,
        proofPhotoUrls: proof_photo_urls,
        createdAt: new Date().toISOString(),
      });

      telegramMessageId = telegramResult.messageId || 0;

      // Update expense with Telegram info
      await supabase
        .from("expenses")
        .update({
          telegram_chat_id: process.env.TELEGRAM_CHAT_ID || "",
          telegram_message_id: telegramMessageId,
          updated_at: new Date().toISOString(),
        })
        .eq("id", expense.id);
    } catch (telegramError) {
      console.warn("Failed to send Telegram notification:", telegramError);
      // Continue even if Telegram fails
    }

    // Create activity log
    await supabase.from("activity_logs").insert({
      user_id: authUser.id,
      action: "expense_created",
      details: {
        expense_id: expense.id,
        item_name,
        amount: amountNum,
        payment_method,
        handled_by_name: handled_by_name || profile.full_name,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Expense created successfully",
      data: {
        ...expense,
        telegram_message_id: telegramMessageId,
      },
    });
  } catch (error: any) {
    console.error("Error in expense creation API:", error);
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
    const startDate = url.searchParams.get("start_date");
    const endDate = url.searchParams.get("end_date");
    const paymentMethod = url.searchParams.get("payment_method");
    const handledBy = url.searchParams.get("handled_by");
    const limit = parseInt(url.searchParams.get("limit") || "50");
    const offset = parseInt(url.searchParams.get("offset") || "0");

    // Build query
    let query = supabase
      .from("expenses")
      .select("*, profiles(full_name, role)", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    // Apply filters
    if (startDate) {
      query = query.gte("created_at", `${startDate}T00:00:00`);
    }
    if (endDate) {
      query = query.lte("created_at", `${endDate}T23:59:59`);
    }
    if (paymentMethod) {
      query = query.eq("payment_method", paymentMethod);
    }
    if (handledBy) {
      query = query.eq("handled_by", handledBy);
    }

    const { data: expenses, error, count } = await query;

    if (error) {
      console.error("Error fetching expenses:", error);
      return NextResponse.json(
        { error: "Failed to fetch expenses", details: error.message },
        { status: 500 },
      );
    }

    // Get summary stats
    let summary = {};
    if (expenses && expenses.length > 0) {
      const totalAmount = expenses.reduce(
        (sum, expense) => sum + parseFloat(expense.amount),
        0,
      );
      const today = new Date().toISOString().split("T")[0];
      const todayExpenses = expenses.filter(
        (e) => e.created_at.split("T")[0] === today,
      );
      const todayAmount = todayExpenses.reduce(
        (sum, expense) => sum + parseFloat(expense.amount),
        0,
      );

      summary = {
        total_amount: totalAmount,
        total_count: expenses.length,
        today_count: todayExpenses.length,
        today_amount: todayAmount,
      };
    }

    return NextResponse.json({
      success: true,
      data: expenses || [],
      summary,
      pagination: {
        total: count || 0,
        limit,
        offset,
        has_more: (count || 0) > offset + limit,
      },
    });
  } catch (error: any) {
    console.error("Error in expenses list API:", error);
    return NextResponse.json(
      { error: "Internal server error", details: error.message },
      { status: 500 },
    );
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const {
      id,
      item_name,
      amount,
      payment_method,
      handled_by,
      handled_by_name,
      notes,
      proof_photo_urls,
    } = body;

    if (!id) {
      return NextResponse.json(
        { error: "Expense ID is required" },
        { status: 400 },
      );
    }

    const supabase = createClient();

    // Verify user authentication
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();
    if (!authUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user is admin
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", authUser.id)
      .single();

    if (profile?.role !== "admin") {
      return NextResponse.json(
        { error: "Only admin can update expenses" },
        { status: 403 },
      );
    }

    // Prepare update data
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (item_name !== undefined) updateData.item_name = item_name;
    if (amount !== undefined) updateData.amount = parseFloat(amount);
    if (payment_method !== undefined)
      updateData.payment_method = payment_method;
    if (handled_by !== undefined) updateData.handled_by = handled_by;
    if (handled_by_name !== undefined)
      updateData.handled_by_name = handled_by_name;
    if (notes !== undefined) updateData.notes = notes;
    if (proof_photo_urls !== undefined)
      updateData.proof_photo_urls = proof_photo_urls;

    // Update expense
    const { data: expense, error: updateError } = await supabase
      .from("expenses")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (updateError) {
      console.error("Error updating expense:", updateError);
      return NextResponse.json(
        { error: "Failed to update expense", details: updateError.message },
        { status: 500 },
      );
    }

    // Create activity log
    await supabase.from("activity_logs").insert({
      user_id: authUser.id,
      action: "expense_updated",
      details: {
        expense_id: id,
        ...updateData,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Expense updated successfully",
      data: expense,
    });
  } catch (error: any) {
    console.error("Error in expense update API:", error);
    return NextResponse.json(
      { error: "Internal server error", details: error.message },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const url = new URL(request.url);
    const id = url.searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "Expense ID is required" },
        { status: 400 },
      );
    }

    const supabase = createClient();

    // Verify user authentication
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();
    if (!authUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user is admin
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", authUser.id)
      .single();

    if (profile?.role !== "admin") {
      return NextResponse.json(
        { error: "Only admin can delete expenses" },
        { status: 403 },
      );
    }

    // Get expense before deletion for log
    const { data: expense } = await supabase
      .from("expenses")
      .select("*")
      .eq("id", id)
      .single();

    // Delete expense
    const { error: deleteError } = await supabase
      .from("expenses")
      .delete()
      .eq("id", id);

    if (deleteError) {
      console.error("Error deleting expense:", deleteError);
      return NextResponse.json(
        { error: "Failed to delete expense", details: deleteError.message },
        { status: 500 },
      );
    }

    // Create activity log
    await supabase.from("activity_logs").insert({
      user_id: authUser.id,
      action: "expense_deleted",
      details: {
        expense_id: id,
        item_name: expense?.item_name,
        amount: expense?.amount,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Expense deleted successfully",
    });
  } catch (error: any) {
    console.error("Error in expense deletion API:", error);
    return NextResponse.json(
      { error: "Internal server error", details: error.message },
      { status: 500 },
    );
  }
}
