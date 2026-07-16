import { describe, it, expect, beforeEach, afterEach } from "vitest";

// Each test file gets its own module instance, so import per-test
let rateLimit: typeof import("@/lib/rate-limit");

async function loadModule() {
  rateLimit = await import("@/lib/rate-limit");
}

describe("rateLimit", () => {
  beforeEach(async () => {
    await loadModule();
  });

  it("allows first request", () => {
    const result = rateLimit.rateLimit("test-key", 5, 60_000);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(4);
    expect(result.resetAt).toBeGreaterThan(Date.now());
  });

  it("allows requests within limit", () => {
    for (let i = 0; i < 4; i++) {
      const result = rateLimit.rateLimit("within-key", 5, 60_000);
      expect(result.allowed).toBe(true);
    }
  });

  it("blocks requests exceeding limit", () => {
    const key = "exceed-key";
    for (let i = 0; i < 5; i++) {
      rateLimit.rateLimit(key, 5, 60_000);
    }
    const result = rateLimit.rateLimit(key, 5, 60_000);
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it("resets after window expires", async () => {
    const key = "reset-key";
    rateLimit.rateLimit(key, 2, 50);
    rateLimit.rateLimit(key, 2, 50);
    let result = rateLimit.rateLimit(key, 2, 50);
    expect(result.allowed).toBe(false);

    await new Promise((r) => setTimeout(r, 60));

    result = rateLimit.rateLimit(key, 2, 50);
    expect(result.allowed).toBe(true);
  });

  it("uses different windows for different keys", () => {
    rateLimit.rateLimit("key-a", 2, 60_000);
    rateLimit.rateLimit("key-a", 2, 60_000);

    const resultA = rateLimit.rateLimit("key-a", 2, 60_000);
    expect(resultA.allowed).toBe(false);

    const resultB = rateLimit.rateLimit("key-b", 2, 60_000);
    expect(resultB.allowed).toBe(true);
  });

  it("returns correct remaining count", () => {
    const key = "remaining-key";
    let result = rateLimit.rateLimit(key, 10, 60_000);
    expect(result.remaining).toBe(9);

    result = rateLimit.rateLimit(key, 10, 60_000);
    expect(result.remaining).toBe(8);

    for (let i = 0; i < 8; i++) rateLimit.rateLimit(key, 10, 60_000);
    result = rateLimit.rateLimit(key, 10, 60_000);
    expect(result.remaining).toBe(0);
    expect(result.allowed).toBe(false);
  });
});

describe("rateLimitIP", () => {
  beforeEach(async () => {
    await loadModule();
  });

  function makeRequest(ip?: string): Request {
    const headers: Record<string, string> = {};
    if (ip) headers["x-forwarded-for"] = ip;
    return new Request("http://localhost:3000/api/test", { headers });
  }

  it("allows first request from IP", () => {
    const req = makeRequest("192.168.1.1");
    const result = rateLimit.rateLimitIP(req);
    expect(result.allowed).toBe(true);
  });

  it("blocks excessive requests from same IP", () => {
    const req = makeRequest("192.168.1.2");
    // Use low limit to test
    for (let i = 0; i < 30; i++) {
      rateLimit.rateLimitIP(req);
    }
    const result = rateLimit.rateLimitIP(req);
    expect(result.allowed).toBe(false);
  });
});
