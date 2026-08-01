import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const {
      type,
      title,
      message,
      link,
      targetUserId,
      targetRoles,
      data,
    } = body;

    if (!type || !title || !message) {
      return NextResponse.json(
        { error: "type, title, and message are required" },
        { status: 400 },
      );
    }

    let userIds: string[] = [];

    // Scope notifikasi ke cabang user pengirim (kecuali global: owner/engineer/supervisor)
    const { data: callerProfile } = await supabase
      .from("profiles")
      .select("role, branch_id")
      .eq("id", user.id)
      .single();
    const isGlobalRole = callerProfile?.role === "owner" || callerProfile?.role === "engineer" || callerProfile?.role === "supervisor";
    const branchScope = !isGlobalRole && callerProfile?.branch_id
      ? { branch_id: callerProfile.branch_id }
      : {};

    if (targetUserId) {
      userIds = [targetUserId];
    } else if (targetRoles && targetRoles.length > 0) {
      let q = supabase.from("profiles").select("id").in("role", targetRoles);
      if (Object.keys(branchScope).length > 0) q = q.match(branchScope);
      const { data: users } = await q;
      if (users) userIds = users.map((u: any) => u.id);
    } else {
      return NextResponse.json(
        { error: "Either targetUserId or targetRoles is required" },
        { status: 400 },
      );
    }

    const notifications = userIds.map((uid: string) => ({
      user_id: uid,
      title,
      message,
      type,
      link: link || null,
      data: data || null,
    }));

    const { error } = await supabase.from("notifications").insert(notifications);

    if (error) {
      console.error("[Notif Trigger] insert error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, count: notifications.length });
  } catch (error: any) {
    console.error("[Notif Trigger] error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
