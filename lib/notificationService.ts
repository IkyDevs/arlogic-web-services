import { createClient } from "@/lib/supabase/client";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export type NotifType =
  | "transaction"
  | "transaction_update"
  | "transaction_cancel"
  | "service_new"
  | "service_taken"
  | "service_pending"
  | "service_pending_approved"
  | "service_pending_rejected"
  | "service_qc_submit"
  | "service_qc_revision"
  | "service_qc_approved"
  | "service_done"
  | "service_ready"
  | "customer_new"
  | "customer_return"
  | "sparepart_request"
  | "sparepart_approved"
  | "sparepart_rejected"
  | "sparepart_ready"
  | "feedback"
  | "reminder"
  | "info"
  | "warning"
  | "error";

const NOTIF_ICONS: Record<NotifType, string> = {
  transaction: "💳",
  transaction_update: "✏️",
  transaction_cancel: "❌",
  service_new: "🔧",
  service_taken: "👨‍🔧",
  service_pending: "⏸️",
  service_pending_approved: "✅",
  service_pending_rejected: "🚫",
  service_qc_submit: "📋",
  service_qc_revision: "🔄",
  service_qc_approved: "✅",
  service_done: "🎉",
  service_ready: "📦",
  customer_new: "👤",
  customer_return: "🔄",
  sparepart_request: "📦",
  sparepart_approved: "✅",
  sparepart_rejected: "❌",
  sparepart_ready: "📦",
  feedback: "⭐",
  reminder: "⏰",
  info: "ℹ️",
  warning: "⚠️",
  error: "🚨",
};

const NOTIF_COLORS: Record<NotifType, string> = {
  transaction: "bg-blue-500",
  transaction_update: "bg-amber-500",
  transaction_cancel: "bg-red-500",
  service_new: "bg-indigo-500",
  service_taken: "bg-purple-500",
  service_pending: "bg-yellow-500",
  service_pending_approved: "bg-emerald-500",
  service_pending_rejected: "bg-red-500",
  service_qc_submit: "bg-orange-500",
  service_qc_revision: "bg-amber-500",
  service_qc_approved: "bg-emerald-500",
  service_done: "bg-emerald-500",
  service_ready: "bg-blue-500",
  customer_new: "bg-teal-500",
  customer_return: "bg-cyan-500",
  sparepart_request: "bg-orange-500",
  sparepart_approved: "bg-emerald-500",
  sparepart_rejected: "bg-red-500",
  sparepart_ready: "bg-blue-500",
  feedback: "bg-amber-500",
  reminder: "bg-red-500",
  info: "bg-slate-500",
  warning: "bg-yellow-500",
  error: "bg-red-500",
};

export interface CreateNotificationInput {
  user_id: string;
  title: string;
  message: string;
  type: NotifType;
  link?: string;
  data?: Record<string, unknown>;
}

export function getNotifIcon(type: string): string {
  return NOTIF_ICONS[type as NotifType] || "ℹ️";
}

export function getNotifColor(type: string): string {
  return NOTIF_COLORS[type as NotifType] || "bg-slate-500";
}

export async function createNotification(input: CreateNotificationInput) {
  const supabase = createClient();
  const { error } = await supabase.from("notifications").insert({
    user_id: input.user_id,
    title: input.title,
    message: input.message,
    type: input.type,
    link: input.link || null,
    data: input.data || null,
  });
  if (error) console.error("[NotificationService] insert error:", error);
  return { error };
}

export async function createNotificationServer(input: CreateNotificationInput) {
  const supabase = getSupabaseAdmin();
  const { error } = await (supabase as any).from("notifications").insert([
    {
      user_id: input.user_id,
      title: input.title,
      message: input.message,
      type: input.type,
      link: input.link || null,
      data: input.data || null,
    },
  ]);
  if (error) console.error("[NotificationService] server insert error:", error);
  return { error };
}

export async function notifyRole(
  role: string,
  input: Omit<CreateNotificationInput, "user_id">,
) {
  const supabase = createClient();
  const { data: users } = await supabase
    .from("profiles")
    .select("id")
    .eq("role", role);
  if (!users || users.length === 0) return;
  const notifications = users.map((u) => ({
    user_id: u.id,
    title: input.title,
    message: input.message,
    type: input.type,
    link: input.link || null,
    data: input.data || null,
  }));
  const { error } = await supabase.from("notifications").insert(notifications);
  if (error) console.error("[NotificationService] notifyRole error:", error);
}

export async function notifyAdmins(input: Omit<CreateNotificationInput, "user_id">) {
  return notifyRole("admin", input);
}

export async function notifyOwners(input: Omit<CreateNotificationInput, "user_id">) {
  return notifyRole("owner", input);
}

export async function notifyQC(input: Omit<CreateNotificationInput, "user_id">) {
  return notifyRole("qc", input);
}

export async function notifyTeknisi(
  teknisiId: string,
  input: Omit<CreateNotificationInput, "user_id">,
) {
  return createNotification({ ...input, user_id: teknisiId });
}

/** Build role-based recipient list for a given type */
export function getRecipientRolesForType(
  type: NotifType,
): ("admin" | "owner" | "qc" | "teknisi")[] {
  switch (type) {
    case "transaction":
    case "transaction_update":
    case "transaction_cancel":
    case "customer_new":
    case "customer_return":
      return ["admin", "owner"];

    case "service_new":
      return ["admin", "owner"];
    case "service_taken":
      return ["admin", "owner"];
    case "service_pending":
      return ["admin", "owner", "qc"];
    case "service_pending_approved":
    case "service_pending_rejected":
      return ["teknisi", "admin"];
    case "service_qc_submit":
      return ["qc", "admin"];
    case "service_qc_revision":
      return ["teknisi", "admin"];
    case "service_qc_approved":
      return ["teknisi", "admin", "owner"];
    case "service_done":
      return ["admin", "owner"];
    case "service_ready":
      return ["admin", "owner"];

    case "sparepart_request":
      return ["admin"];
    case "sparepart_approved":
    case "sparepart_rejected":
    case "sparepart_ready":
      return ["teknisi"];

    case "feedback":
      return ["admin", "owner"];

    default:
      return ["admin", "owner"];
  }
}

const POLL_INTERVAL = 15000;
let pollTimers: Map<string, ReturnType<typeof setInterval>> = new Map();

export function startPolling(
  userId: string,
  onUpdate: (unread: number) => void,
) {
  stopPolling(userId);
  const timer = setInterval(async () => {
    const supabase = createClient();
    const { count } = await supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("is_read", false);
    if (count !== null) onUpdate(count);
  }, POLL_INTERVAL);
  pollTimers.set(userId, timer);
}

export function stopPolling(userId: string) {
  const timer = pollTimers.get(userId);
  if (timer) {
    clearInterval(timer);
    pollTimers.delete(userId);
  }
}
