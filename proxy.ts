import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const AUTH_COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 hari — cegah logout tiap browser ditutup

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            const isAuthCookie = name.includes("-auth-token");
            request.cookies.set(name, value);
            response = NextResponse.next({
              request,
            });
            response.cookies.set(
              name,
              value,
              isAuthCookie ? { ...options, maxAge: AUTH_COOKIE_MAX_AGE } : options,
            );
          });
        },
      },
    },
  );

  let user = null;
  try {
    const { data } = await supabase.auth.getUser();
    user = data?.user || null;
  } catch (error) {
    // Gagal sesaat (network/refresh race) → biarkan request lewat,
    // jangan buru-buru logout. Kalau sesi benar-benar mati, halaman
    // yang butuh auth akan gagal sendiri.
    console.error("Auth check skipped (transient):", error);
  }

  // Get user role from profile
  let userRole = null;
  let isEngineer = false;
  if (user) {
    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("role, is_engineer")
        .eq("id", user.id)
        .maybeSingle();

      userRole = profile?.role;
      isEngineer = profile?.is_engineer === true;
    } catch (error) {
      console.error("Error fetching profile in middleware:", error);
    }
  }

  const path = request.nextUrl.pathname;

  // Public routes
  const publicRoutes = ["/login", "/tracking", "/feedback"];
  const isPublicRoute = publicRoutes.some((route) => path.startsWith(route));

  // Redirect to login if not authenticated
  if (!user && !isPublicRoute) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Redirect to dashboard if already logged in and trying to access login
  if (user && path === "/login") {
    const roleDashboard: Record<string, string> = {
      admin: "/admin",
      teknisi: "/teknisi",
      supervisor: "/supervisor",
      qc: "/qc",
      engineer: "/engineer",
      owner: "/owner",
      customer: "/tracking",
    };
    const redirectPath = userRole
      ? roleDashboard[userRole] || "/admin"
      : "/admin";
    return NextResponse.redirect(new URL(redirectPath, request.url));
  }

  // Role-based route protection (only if role exists)
  if (user && userRole && path !== "/login" && path !== "/") {
    // Map role to its allowed dashboard path
    const roleDashboard: Record<string, string> = {
      admin: "/admin",
      teknisi: "/teknisi",
      supervisor: "/supervisor",
      qc: "/qc",
      engineer: "/engineer",
      owner: "/owner",
      customer: "/tracking",
    };

    const roleRoutes: Record<string, string[]> = {
      admin: ["/admin"],
      teknisi: isEngineer ? ["/teknisi", "/engineer"] : ["/teknisi"],
      supervisor: ["/qc", "/supervisor"],
      qc: ["/qc"],
      owner: ["/owner"],
      customer: ["/tracking"],
    };

    const allowedPaths = roleRoutes[userRole] || [];
    const isAllowed = allowedPaths.some((allowedPath) =>
      path.startsWith(allowedPath),
    );
    const dashboard = roleDashboard[userRole] || "/login";

    if (!isAllowed && !isPublicRoute) {
      return NextResponse.redirect(new URL(dashboard, request.url));
    }
  }

  return response;
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|uploads).*)"],
};
