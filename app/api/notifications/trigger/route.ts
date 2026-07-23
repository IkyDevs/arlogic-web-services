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

    if (targetUserId) {
      userIds = [targetUserId];
    } else if (targetRoles && targetRoles.length > 0) {
      const { data: users } = await supabase
        .from("profiles")
        .select("id")
        .in("role", targetRoles);
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
