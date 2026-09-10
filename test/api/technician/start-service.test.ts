import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock dependencies
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("@/lib/rate-limit", () => ({
  rateLimitIP: vi.fn().mockReturnValue({ allowed: true, remaining: 29 }),
}));

const mockUser = { id: "user-123", email: "teknisi@example.com" };
const mockProfile = {
  id: "user-123",
  email: "teknisi@example.com",
  full_name: "Teknisi Test",
  role: "teknisi",
  branch_id: "branch-1",
};

const createMockSupabase = (overrides: Record<string, any> = {}) => {
  const mockChain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    ...overrides,
  };

  return {
    from: vi.fn().mockReturnValue(mockChain),
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: mockUser },
        error: null,
      }),
    },
  };
};

describe("POST /api/technician/start-service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when unauthenticated", async () => {
    const { createClient } = await import("@/lib/supabase/server");
    (createClient as any).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: null },
          error: { message: "Not authenticated" },
        }),
      },
    });

    const { POST } = await import("@/app/api/technician/start-service/route");
    const request = new Request("http://localhost:3000/api/technician/start-service", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ serviceOrderId: "123e4567-e89b-12d3-a456-426614174000" }),
    });

    const response = await POST(request);
    expect(response.status).toBe(401);
  });

  it("returns 403 when non-technician", async () => {
    const { createClient } = await import("@/lib/supabase/server");
    (createClient as any).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: mockUser },
          error: null,
        }),
      },
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { ...mockProfile, role: "customer" },
          error: null,
        }),
      }),
    });

    const { POST } = await import("@/app/api/technician/start-service/route");
    const request = new Request("http://localhost:3000/api/technician/start-service", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ serviceOrderId: "123e4567-e89b-12d3-a456-426614174000" }),
    });

    const response = await POST(request);
    expect(response.status).toBe(403);
  });

  it("returns 404 when service not found", async () => {
    const mockSupabase = createMockSupabase({
      single: vi.fn().mockResolvedValue({
        data: null,
        error: { message: "Not found" },
      }),
    });

    const { createClient } = await import("@/lib/supabase/server");
    (createClient as any).mockResolvedValue(mockSupabase);

    // Override profile fetch
    const originalFrom = mockSupabase.from;
    mockSupabase.from = vi.fn().mockImplementation((table: string) => {
      if (table === "profiles") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: mockProfile,
            error: null,
          }),
        };
      }
      return originalFrom(table);
    });

    const { POST } = await import("@/app/api/technician/start-service/route");
    const request = new Request("http://localhost:3000/api/technician/start-service", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ serviceOrderId: "123e4567-e89b-12d3-a456-426614174000" }),
    });

    const response = await POST(request);
    expect(response.status).toBe(404);
  });

  it("returns 403 when not assigned technician", async () => {
    const mockSupabase = createMockSupabase({
      single: vi.fn().mockResolvedValue({
        data: {
          id: "service-123",
          status: "assigned",
          assigned_teknisi_id: "other-user",
          invoice_number: "INV-001",
          customer_name: "Customer",
        },
        error: null,
      }),
    });

    const { createClient } = await import("@/lib/supabase/server");
    (createClient as any).mockResolvedValue(mockSupabase);

    const originalFrom = mockSupabase.from;
    mockSupabase.from = vi.fn().mockImplementation((table: string) => {
      if (table === "profiles") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: mockProfile,
            error: null,
          }),
        };
      }
      return originalFrom(table);
    });

    const { POST } = await import("@/app/api/technician/start-service/route");
    const request = new Request("http://localhost:3000/api/technician/start-service", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ serviceOrderId: "123e4567-e89b-12d3-a456-426614174000" }),
    });

    const response = await POST(request);
    expect(response.status).toBe(403);

    const body = await response.json();
    expect(body.error.code).toBe("NOT_ASSIGNED_TECHNICIAN");
  });

  it("returns 409 when invalid status transition", async () => {
    const mockSupabase = createMockSupabase({
      single: vi.fn().mockResolvedValue({
        data: {
          id: "service-123",
          status: "in_progress",
          assigned_teknisi_id: "user-123",
          invoice_number: "INV-001",
          customer_name: "Customer",
        },
        error: null,
      }),
    });

    const { createClient } = await import("@/lib/supabase/server");
    (createClient as any).mockResolvedValue(mockSupabase);

    const originalFrom = mockSupabase.from;
    mockSupabase.from = vi.fn().mockImplementation((table: string) => {
      if (table === "profiles") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: mockProfile,
            error: null,
          }),
        };
      }
      return originalFrom(table);
    });

    const { POST } = await import("@/app/api/technician/start-service/route");
    const request = new Request("http://localhost:3000/api/technician/start-service", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ serviceOrderId: "123e4567-e89b-12d3-a456-426614174000" }),
    });

    const response = await POST(request);
    expect(response.status).toBe(409);

    const body = await response.json();
    expect(body.error.code).toBe("INVALID_STATUS_TRANSITION");
  });
});
