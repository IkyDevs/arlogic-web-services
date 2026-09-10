import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import type { User } from "@supabase/supabase-js";

export type UserRole = "admin" | "teknisi" | "supervisor" | "owner" | "qc" | "engineer" | "manager" | "admin_gudang" | "customer";

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  teknisi_name?: string;
  phone?: string;
  avatar_url?: string;
  branch_id?: string | null;
  home_branch_id?: string | null;
  created_at: string;
  updated_at: string;
}

export interface AuthContext {
  supabase: ReturnType<typeof createClient> extends Promise<infer T> ? T : never;
  user: User;
  profile: Profile;
}

export async function requireAuth(request: Request): Promise<AuthContext> {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    throw new AuthError("UNAUTHENTICATED", "Authentication required");
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (profileError || !profile) {
    throw new AuthError("UNAUTHENTICATED", "User profile not found");
  }

  return { supabase, user, profile: profile as Profile };
}

export async function requireTechnician(request: Request): Promise<AuthContext> {
  const ctx = await requireAuth(request);

  const allowedRoles: UserRole[] = ["teknisi"];
  if (!allowedRoles.includes(ctx.profile.role)) {
    throw new AuthError("FORBIDDEN", "Technician access required");
  }

  return ctx;
}

export class AuthError extends Error {
  code: string;

  constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.name = "AuthError";
  }
}
