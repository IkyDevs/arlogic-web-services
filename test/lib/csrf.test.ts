import { describe, it, expect, vi, beforeEach } from "vitest";

const mockAppUrl = "https://arlogic-web-services.vercel.app";

// Set env BEFORE importing the module
vi.stubEnv("NEXT_PUBLIC_APP_URL", mockAppUrl);

// Need to re-set in beforeEach for tests that run after other imports
beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_APP_URL", mockAppUrl);
});

const { validateOrigin, corsHeaders } = await import("@/lib/csrf");

describe("validateOrigin", () => {
  function makeRequest(origin?: string, referer?: string): Request {
    const headers: Record<string, string> = {};
    if (origin) headers["origin"] = origin;
    if (referer) headers["referer"] = referer;
    return new Request("http://localhost:3000/api/test", { headers });
  }

  it("allows same-origin requests without origin header", () => {
    const req = new Request("http://localhost:3000/api/test");
    expect(validateOrigin(req)).toBe(true);
  });

  it("allows requests from NEXT_PUBLIC_APP_URL", () => {
    const req = makeRequest(mockAppUrl);
    expect(validateOrigin(req)).toBe(true);
  });

  it("allows requests from localhost:3000", () => {
    const req = makeRequest("http://localhost:3000");
    expect(validateOrigin(req)).toBe(true);
  });

  it("allows requests with referer from APP_URL", () => {
    const req = makeRequest(undefined, `${mockAppUrl}/admin`);
    expect(validateOrigin(req)).toBe(true);
  });

  it("blocks requests from unknown origins", () => {
    const req = makeRequest("https://evil-site.com");
    expect(validateOrigin(req)).toBe(false);
  });

  it("blocks requests from unknown referers", () => {
    const req = makeRequest(undefined, "https://evil-site.com/phishing");
    expect(validateOrigin(req)).toBe(false);
  });

  it("prefers origin over referer when both present", () => {
    const req = makeRequest("https://evil.com", `${mockAppUrl}/admin`);
    expect(validateOrigin(req)).toBe(false);
  });

  it("allows app url with trailing paths", () => {
    const req = makeRequest(`${mockAppUrl}/admin/dashboard`);
    expect(validateOrigin(req)).toBe(true);
  });
});

describe("corsHeaders", () => {
  it("returns object with CORS headers", () => {
    const headers = corsHeaders();
    expect(headers["Access-Control-Allow-Origin"]).toBe(mockAppUrl);
    expect(headers["Access-Control-Allow-Methods"]).toContain("POST");
  });
});
