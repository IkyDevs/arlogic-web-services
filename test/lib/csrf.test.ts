import { describe, it, expect } from "vitest";

const { validateOrigin, corsHeaders } = await import("@/lib/csrf");

function makeRequest(url: string, origin?: string, referer?: string): Request {
  const headers: Record<string, string> = {};
  if (origin) headers["origin"] = origin;
  if (referer) headers["referer"] = referer;
  return new Request(url, { headers });
}

describe("validateOrigin", () => {
  it("allows requests without origin or referer (same-origin)", () => {
    const req = new Request("http://localhost:3000/api/test");
    expect(validateOrigin(req)).toBe(true);
  });

  it("allows requests where origin matches request host", () => {
    const req = makeRequest("https://app.example.com/api/test", "https://app.example.com");
    expect(validateOrigin(req)).toBe(true);
  });

  it("allows requests on localhost:3000", () => {
    const req = makeRequest("http://localhost:3000/api/test", "http://localhost:3000");
    expect(validateOrigin(req)).toBe(true);
  });

  it("allows referer matching request host", () => {
    const req = makeRequest("https://app.example.com/api/test", undefined, "https://app.example.com/admin");
    expect(validateOrigin(req)).toBe(true);
  });

  it("blocks requests from different host origin", () => {
    const req = makeRequest("https://app.example.com/api/test", "https://evil-site.com");
    expect(validateOrigin(req)).toBe(false);
  });

  it("blocks requests with different host referer", () => {
    const req = makeRequest("https://app.example.com/api/test", undefined, "https://evil-site.com/phishing");
    expect(validateOrigin(req)).toBe(false);
  });

  it("prefers origin over referer when both present", () => {
    const req = makeRequest("https://app.example.com/api/test", "https://evil.com", "https://app.example.com/admin");
    expect(validateOrigin(req)).toBe(false);
  });

  it("allows origin with path/trailing slash", () => {
    const req = makeRequest("https://app.example.com/api/test", "https://app.example.com/");
    expect(validateOrigin(req)).toBe(true);
  });

  it("supports x-forwarded-host header", () => {
    const req = new Request("https://internal/api/test", {
      headers: {
        origin: "https://custom-domain.com",
        "x-forwarded-host": "custom-domain.com",
      },
    });
    expect(validateOrigin(req)).toBe(true);
  });
});

describe("corsHeaders", () => {
  it("returns wildcard origin and methods", () => {
    const headers = corsHeaders();
    expect(headers["Access-Control-Allow-Origin"]).toBe("*");
    expect(headers["Access-Control-Allow-Methods"]).toContain("POST");
  });
});
