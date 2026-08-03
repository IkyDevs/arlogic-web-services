import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("branch")?.trim();
  const name = request.nextUrl.searchParams.get("name")?.trim();
  const id = request.nextUrl.searchParams.get("id")?.trim();

  if (!code && !name && !id) {
    return NextResponse.json({ error: "Branch is required" }, { status: 400 });
  }

  try {
    const supabase = getSupabaseAdmin();
    let query = supabase
      .from("branches")
      .select("id, name, phone");

    query = code ? query.eq("code", code) : name ? query.eq("name", name) : query.eq("id", id!);
    const { data, error } = await query.maybeSingle();
    const branch = data as { id: string; name: string; phone: string | null } | null;

    if (error || !branch) {
      return NextResponse.json({ error: "Branch contact not found" }, { status: 404 });
    }

    let phone = branch.phone?.trim() || null;
    if (!phone) {
      const { data: admin } = await supabase
        .from("profiles")
        .select("phone")
        .eq("branch_id", branch.id)
        .eq("role", "admin")
        .not("phone", "is", null)
        .limit(1)
        .maybeSingle();
      phone = (admin as { phone: string | null } | null)?.phone?.trim() || null;
    }

    if (!phone) {
      return NextResponse.json({ error: "Branch admin phone is not configured" }, { status: 404 });
    }

    return NextResponse.json({
      name: branch.name,
      phone,
    });
  } catch {
    return NextResponse.json({ error: "Unable to load branch contact" }, { status: 500 });
  }
}
