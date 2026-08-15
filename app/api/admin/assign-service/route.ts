import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { rateLimitIP } from "@/lib/rate-limit";

// POST - Assign service to technician
export async function POST(request: Request) {
  const supabase = await createClient();
  
  // Rate limiting
  const rl = rateLimitIP(request);
  if (!rl.allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  // Auth check
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { serviceOrderId, confirmation } = body;

  if (!serviceOrderId) {
    return NextResponse.json({ error: "serviceOrderId required" }, { status: 400 });
  }

  if (!confirmation) {
    return NextResponse.json({ error: "Confirmation required" }, { status: 400 });
  }

  // Verify service exists and is in pending status
  const { data: service, error: fetchError } = await supabase
    .from("service_orders")
    .select("id, status, assigned_teknisi_id, invoice_number, customer_name, branch_id")
    .eq("id", serviceOrderId)
    .single();

  if (fetchError || !service) {
    return NextResponse.json({ error: "Service not found" }, { status: 404 });
  }

  // Block cross-branch pickup: teknisi hanya bisa ambil service dari cabangnya sendiri
  const { data: teknisiProfile } = await supabase
    .from("profiles")
    .select("branch_id")
    .eq("id", user.id)
    .maybeSingle();

  if (
    teknisiProfile?.branch_id &&
    service.branch_id &&
    teknisiProfile.branch_id !== service.branch_id
  ) {
    return NextResponse.json(
      { error: "Service dari cabang lain. Tidak bisa diambil." },
      { status: 403 },
    );
  }

  // Check if service is already assigned
  if (service.assigned_teknisi_id) {
    return NextResponse.json({ 
      error: "Service already assigned to another technician",
      assignedTo: service.assigned_teknisi_id 
    }, { status: 400 });
  }

  // Check if service is still pending
  if (service.status !== "pending") {
    return NextResponse.json({ 
      error: "Service status is not pending",
      currentStatus: service.status 
    }, { status: 400 });
  }

  // Check technician's active projects limit (max 2)
  const { count: activeCount } = await supabase
    .from("service_orders")
    .select("*", { count: "exact", head: true })
    .eq("assigned_teknisi_id", user.id)
    .in("status", ["assigned", "in_progress", "qc_pending"]);

  if ((activeCount || 0) >= 2) {
    return NextResponse.json({ 
      error: "Maksimal 2 proyek aktif. Selesaikan proyek lain dulu.",
      activeCount 
    }, { status: 400 });
  }

  // Assign service to technician
  const { error: updateError } = await supabase
    .from("service_orders")
    .update({ 
      assigned_teknisi_id: user.id,
      status: "assigned",
      start_date: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq("id", serviceOrderId);

  if (updateError) {
    return NextResponse.json({ error: "Failed to assign service" }, { status: 500 });
  }

  // Add timeline entry
  await supabase.from("service_timeline").insert({
    service_order_id: serviceOrderId,
    teknisi_id: user.id,
    status: "assigned",
    message: `Service diambil oleh teknisi`,
    details: { action: "take_project" },
  });

  return NextResponse.json({
    success: true,
    message: "Service berhasil diambil!",
    data: { serviceOrder: serviceOrderId, assignedTo: user.id }
  });
}

// GET - Check if service can be taken (for confirmation popup)
export async function GET(request: Request) {
  const supabase = await createClient();
  
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const serviceOrderId = url.searchParams.get("serviceOrderId");
  const teknisiId = url.searchParams.get("teknisiId");

  if (!serviceOrderId) {
    return NextResponse.json({ error: "serviceOrderId required" }, { status: 400 });
  }

  // Get service details
  const { data: service } = await supabase
    .from("service_orders")
    .select("id, status, assigned_teknisi_id, invoice_number, customer_name, branch_id, watch_brand, device_brand, watch_model, device_model, issue_description, created_at")
    .eq("id", serviceOrderId)
    .single();

  if (!service) {
    return NextResponse.json({ error: "Service not found" }, { status: 404 });
  }

  // Check if already assigned
  const isAssigned = !!service.assigned_teknisi_id;
  let branchMismatch = false;
  if (!isAssigned && service.status === "pending") {
    const { data: teknisiProfile } = await supabase
      .from("profiles")
      .select("branch_id")
      .eq("id", user.id)
      .maybeSingle();
    branchMismatch = !!(
      teknisiProfile?.branch_id &&
      service.branch_id &&
      teknisiProfile.branch_id !== service.branch_id
    );
  }
  const canAssign = !isAssigned && service.status === "pending" && teknisiId === user.id && !branchMismatch;

  // Count active projects for this technician
  const { count: activeCount } = await supabase
    .from("service_orders")
    .select("*", { count: "exact", head: true })
    .eq("assigned_teknisi_id", user.id)
    .in("status", ["assigned", "in_progress", "qc_pending"]);

  const maxActiveReached = (activeCount || 0) >= 2;

  return NextResponse.json({
    success: true,
    data: {
      service: {
        id: service.id,
        invoice_number: service.invoice_number,
        customer_name: service.customer_name,
        watch_brand: (service as any).watch_brand || (service as any).device_brand,
        watch_model: (service as any).watch_model || (service as any).device_model,
        issue_description: service.issue_description,
        created_at: service.created_at,
      },
      canAssign,
      isAssigned,
      maxActiveReached,
      activeCount,
    }
  });
}