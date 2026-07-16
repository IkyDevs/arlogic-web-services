export function validateOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  const referer = request.headers.get("referer");

  if (!origin && !referer) return true;

  const source = origin || referer || "";

  try {
    const sourceHost = new URL(source).host;
    const requestUrl = new URL(request.url);
    if (requestUrl.host === "localhost:3000") return true;

    const forwarded = request.headers.get("x-forwarded-host");
    const requestHost = forwarded || requestUrl.host;
    return sourceHost === requestHost;
  } catch {
    return false;
  }
}

export function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Credentials": "true",
  };
}
