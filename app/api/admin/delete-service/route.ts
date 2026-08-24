import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { validateOrigin } from "@/lib/csrf";
import { rateLimitIP } from "@/lib/rate-limit";

const ALLOWED_ROLES = ["admin", "engineer"];

/**
 * Hard delete service order.
 * Hanya role admin/engineer. Urutan: bersihkan tracking_logs dulu (FK NO ACTION),
 * lalu hapus service_orders — tabel terkait lainnya ikut CASCADE otomatis,
 * dan layanan.linked_service_order_id otomatis SET NULL (DP bisa dipakai ulang).
 */
export async function POST(request: NextRequest) {
  if (!validateOrigin(request)) {
    return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  }

  const rl = rateLimitIP(request);
  if (!rl.allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.role || !ALLOWED_ROLES.includes(profile.role)) {
    return NextResponse.json(
      { error: "Hanya role ADMIN atau ENGINEER yang boleh menghapus service" },
      { status: 403 },
    );
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const serviceOrderId = typeof body.service_order_id === "string" ? body.service_order_id : "";
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(serviceOrderId)) {
    return NextResponse.json({ error: "service_order_id tidak valid" }, { status: 400 });
  }

  const admin = getSupabaseAdmin();

  // Pastikan order ada + simpan identitas untuk audit response
  const { data: order, error: orderErr } = await (admin
    .from("service_orders") as any)
    .select("id, invoice_number, customer_name")
    .eq("id", serviceOrderId)
    .maybeSingle();

  if (orderErr) {
    return NextResponse.json({ error: orderErr.message }, { status: 500 });
  }
  if (!order) {
    return NextResponse.json({ error: "Service tidak ditemukan" }, { status: 404 });
  }

  // 1) tracking_logs punya FK NO ACTION — wajib dibersihkan sebelum header
  const { error: logErr } = await (admin
    .from("tracking_logs") as any)
    .delete()
    .eq("service_order_id", serviceOrderId);
  if (logErr) {
    return NextResponse.json(
      { error: `Gagal menghapus tracking logs: ${logErr.message}` },
      { status: 500 },
    );
  }

  // 2) Hapus header — sisanya (items/timeline/dokumentasi/feedback/garansi/dll)
  //    terhapus otomatis via ON DELETE CASCADE; layanan.linked_* SET NULL
  const { error: delErr } = await (admin
    .from("service_orders") as any)
    .delete()
    .eq("id", serviceOrderId);
  if (delErr) {
    return NextResponse.json(
      { error: `Gagal menghapus service: ${delErr.message}` },
      { status: 500 },
    );
  }

  // 3) Bersihkan sisa id di array linked_service_order_ids (array tidak ikut FK)
  const { error: arrErr } = await (admin.from("layanan") as any)
    .update({ linked_service_order_ids: null })
    .contains("linked_service_order_ids", [serviceOrderId]);

  return NextResponse.json({
    success: true,
    deleted: {
      id: order.id,
      invoice_number: order.invoice_number,
      customer_name: order.customer_name,
      deleted_by: user.id,
      deleted_at: new Date().toISOString(),
    },
    array_cleanup_warning: arrErr ? arrErr.message : null,
  });
}
