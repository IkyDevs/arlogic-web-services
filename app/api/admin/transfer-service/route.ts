import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { rateLimitIP } from "@/lib/rate-limit";

export async function POST(request: Request) {
  const supabase = await createClient();

  const rl = rateLimitIP(request);
  if (!rl.allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, branch_id")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden: admin only" }, { status: 403 });
  }

  const body = await request.json();
  const { serviceOrderId, targetBranchId, reason, action } = body;

  if (!serviceOrderId) {
    return NextResponse.json({ error: "serviceOrderId required" }, { status: 400 });
  }

  const { data: service, error: fetchErr } = await supabase
    .from("service_orders")
    .select("id, status, branch_id, transferred_to_branch_id, assigned_teknisi_id, invoice_number, customer_name")
    .eq("id", serviceOrderId)
    .single();

  if (fetchErr || !service) {
    return NextResponse.json({ error: "Service not found" }, { status: 404 });
  }

  if (action === "return") {
    if (service.branch_id !== profile?.branch_id) {
      return NextResponse.json({ error: "Service bukan milik cabang anda" }, { status: 403 });
    }
    if (!service.transferred_to_branch_id) {
      return NextResponse.json({ error: "Service tidak sedang ditransfer" }, { status: 400 });
    }

    const { data: fromBranch } = await supabase
      .from("branches")
      .select("id, name")
      .eq("id", service.transferred_to_branch_id)
      .maybeSingle();

    const { error: updateErr } = await supabase
      .from("service_orders")
      .update({
        transferred_to_branch_id: null,
        assigned_teknisi_id: null,
        status: "pending",
      })
      .eq("id", serviceOrderId);

    if (updateErr) {
      console.error("[Return Service]", updateErr);
      return NextResponse.json({ error: "Failed to return service", detail: updateErr.message }, { status: 500 });
    }

    await supabase.from("service_timeline").insert({
      service_order_id: serviceOrderId,
      teknisi_id: user.id,
      status: "transferred_back",
      message: `Dikembalikan oleh admin ${fromBranch?.name || service.transferred_to_branch_id} ke cabang asal${reason ? `: ${reason}` : ""}`,
      details: {
        action: "transfer_return",
        from_branch: service.transferred_to_branch_id,
        to_branch: service.branch_id,
        from_branch_name: fromBranch?.name || service.transferred_to_branch_id,
        reason: reason || null,
        transferred_by: user.id,
      },
    });

    return NextResponse.json({
      success: true,
      message: `Service berhasil dikembalikan ke cabang asal`,
    });
  }

  if (!targetBranchId) {
    return NextResponse.json({ error: "targetBranchId required" }, { status: 400 });
  }

  if (service.branch_id === targetBranchId) {
    return NextResponse.json({ error: "Target branch same as current branch" }, { status: 400 });
  }

  if (service.transferred_to_branch_id) {
    return NextResponse.json({ error: "Service sudah ditransfer ke cabang lain" }, { status: 400 });
  }

  if (service.assigned_teknisi_id) {
    return NextResponse.json({ error: "Service sudah ditugaskan ke teknisi. Unassign dulu." }, { status: 400 });
  }

  const { data: targetBranch } = await supabase
    .from("branches")
    .select("id, name")
    .eq("id", targetBranchId)
    .maybeSingle();

  if (!targetBranch) {
    return NextResponse.json({ error: "Target branch not found" }, { status: 404 });
  }

  const { data: sourceBranch } = await supabase
    .from("branches")
    .select("id, name")
    .eq("id", service.branch_id)
    .maybeSingle();

  const { error: updateErr } = await supabase
    .from("service_orders")
    .update({
      transferred_to_branch_id: targetBranchId,
      assigned_teknisi_id: null,
      status: "pending",
    })
    .eq("id", serviceOrderId);

  if (updateErr) {
    console.error("[Transfer Service]", updateErr);
    return NextResponse.json({ error: "Failed to transfer service", detail: updateErr.message }, { status: 500 });
  }

  await supabase.from("service_timeline").insert({
    service_order_id: serviceOrderId,
    teknisi_id: user.id,
    status: "transferred",
    message: `Dipindahkan oleh admin ke cabang ${targetBranch?.name || targetBranchId}${reason ? `: ${reason}` : ""}`,
    details: {
      action: "transfer_branch",
      from_branch: service.branch_id,
      to_branch: targetBranchId,
      from_branch_name: sourceBranch?.name || service.branch_id,
      to_branch_name: targetBranch?.name || targetBranchId,
      reason: reason || null,
      transferred_by: user.id,
    },
  });

  return NextResponse.json({
    success: true,
    message: `Service berhasil dipindahkan ke cabang ${targetBranch?.name || targetBranchId}`,
  });
}
