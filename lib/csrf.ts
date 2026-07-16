const ALLOWED_ORIGINS = [
  process.env.NEXT_PUBLIC_APP_URL,
  "http://localhost:3000",
].filter(Boolean) as string[];

export function validateOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  const referer = request.headers.get("referer");

  // No origin/referer = internal/browser same-origin request, allow
  if (!origin && !referer) return true;

  const source = origin || referer || "";
  return ALLOWED_ORIGINS.some((allowed) => source.startsWith(allowed));
}

export function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": process.env.NEXT_PUBLIC_APP_URL || "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Credentials": "true",
  };
}
