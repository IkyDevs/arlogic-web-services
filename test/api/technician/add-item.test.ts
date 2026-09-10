import { describe, it, expect, vi, beforeEach } from "vitest";

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
    delete: vi.fn().mockReturnThis(),
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

describe("POST /api/technician/add-item", () => {
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

    const { POST } = await import("@/app/api/technician/add-item/route");
    const request = new Request("http://localhost:3000/api/technician/add-item", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        serviceOrderId: "123e4567-e89b-12d3-a456-426614174000",
        itemType: "jasa",
        name: "Service Jam",
        quantity: 1,
        price: 50000,
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(401);
  });

  it("returns 403 when not assigned technician", async () => {
    const mockSupabase = createMockSupabase({
      single: vi.fn().mockResolvedValue({
        data: {
          id: "service-123",
          status: "in_progress",
          assigned_teknisi_id: "other-user",
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

    const { POST } = await import("@/app/api/technician/add-item/route");
    const request = new Request("http://localhost:3000/api/technician/add-item", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        serviceOrderId: "123e4567-e89b-12d3-a456-426614174000",
        item_type: "jasa",
        name: "Service Jam",
        quantity: 1,
        price: 50000,
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(403);
  });

  it("returns 409 when invalid status", async () => {
    const mockSupabase = createMockSupabase({
      single: vi.fn().mockResolvedValue({
        data: {
          id: "service-123",
          status: "completed",
          assigned_teknisi_id: "user-123",
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

    const { POST } = await import("@/app/api/technician/add-item/route");
    const request = new Request("http://localhost:3000/api/technician/add-item", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        serviceOrderId: "123e4567-e89b-12d3-a456-426614174000",
        item_type: "jasa",
        name: "Service Jam",
        quantity: 1,
        price: 50000,
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(409);
  });

  it("returns 422 for invalid item payload", async () => {
    const mockSupabase = createMockSupabase({
      single: vi.fn().mockResolvedValue({
        data: {
          id: "service-123",
          status: "in_progress",
          assigned_teknisi_id: "user-123",
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

    const { POST } = await import("@/app/api/technician/add-item/route");
    const request = new Request("http://localhost:3000/api/technician/add-item", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        serviceOrderId: "123e4567-e89b-12d3-a456-426614174000",
        item_type: "invalid",
        name: "",
        quantity: 0,
        price: -1000,
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(422);
  });
});
