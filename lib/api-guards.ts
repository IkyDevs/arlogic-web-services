import { createClient } from "@/lib/supabase/server";

const TELEGRAM_SETTINGS_ROLES = ["admin", "owner", "engineer"];

/**
 * Guard untuk konfigurasi Telegram.
 * Mengikuti pola akses dashboard engineer di proxy.ts:
 * role admin/owner/engineer, ATAU teknisi dengan flag is_engineer.
 */
export async function requireTelegramConfigAccess(): Promise<
  { error: string; status: number } | { userId: string; branchId: string | null }
> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized", status: 401 };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, is_engineer, branch_id")
    .eq("id", user.id)
    .maybeSingle();

  const roleOk =
    (!!profile?.role && TELEGRAM_SETTINGS_ROLES.includes(profile.role)) ||
    (profile?.role === "teknisi" && profile?.is_engineer === true);

  if (!roleOk) return { error: "Forbidden", status: 403 };

  return { userId: user.id, branchId: profile?.branch_id ?? null };
}
