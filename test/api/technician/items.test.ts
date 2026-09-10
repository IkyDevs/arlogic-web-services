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

describe("POST /api/technician/update-item", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 404 when item not found", async () => {
    const mockSupabase = createMockSupabase({
      single: vi.fn().mockResolvedValue({
        data: null,
        error: { message: "Not found" },
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

    const { POST } = await import("@/app/api/technician/update-item/route");
    const request = new Request("http://localhost:3000/api/technician/update-item", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        itemId: "123e4567-e89b-12d3-a456-426614174000",
        name: "Updated Name",
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(404);
  });

  it("returns 422 when updating finalized item", async () => {
    const mockSupabase = createMockSupabase({
      single: vi.fn().mockResolvedValue({
        data: {
          id: "item-123",
          service_order_id: "service-123",
          name: "Item",
          quantity: 1,
          price: 50000,
          is_final: true,
        },
        error: null,
      }),
    });

    const { createClient } = await import("@/lib/supabase/server");
    (createClient as any).mockResolvedValue(mockSupabase);

    const originalFrom = mockSupabase.from;
    let callCount = 0;
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
      if (table === "service_orders" && callCount === 0) {
        callCount++;
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: {
              id: "service-123",
              status: "in_progress",
              assigned_teknisi_id: "user-123",
            },
            error: null,
          }),
        };
      }
      return originalFrom(table);
    });

    const { POST } = await import("@/app/api/technician/update-item/route");
    const request = new Request("http://localhost:3000/api/technician/update-item", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        itemId: "123e4567-e89b-12d3-a456-426614174000",
        name: "Updated Name",
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(422);
  });
});

describe("POST /api/technician/delete-item", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 404 when item not found", async () => {
    const mockSupabase = createMockSupabase({
      single: vi.fn().mockResolvedValue({
        data: null,
        error: { message: "Not found" },
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

    const { POST } = await import("@/app/api/technician/delete-item/route");
    const request = new Request("http://localhost:3000/api/technician/delete-item", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        itemId: "123e4567-e89b-12d3-a456-426614174000",
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(404);
  });

  it("returns 422 when deleting finalized item", async () => {
    const mockSupabase = createMockSupabase({
      single: vi.fn().mockResolvedValue({
        data: {
          id: "item-123",
          service_order_id: "service-123",
          name: "Item",
          is_final: true,
        },
        error: null,
      }),
    });

    const { createClient } = await import("@/lib/supabase/server");
    (createClient as any).mockResolvedValue(mockSupabase);

    const originalFrom = mockSupabase.from;
    let callCount = 0;
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
      if (table === "service_orders" && callCount === 0) {
        callCount++;
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: {
              id: "service-123",
              status: "in_progress",
              assigned_teknisi_id: "user-123",
            },
            error: null,
          }),
        };
      }
      return originalFrom(table);
    });

    const { POST } = await import("@/app/api/technician/delete-item/route");
    const request = new Request("http://localhost:3000/api/technician/delete-item", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        itemId: "123e4567-e89b-12d3-a456-426614174000",
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(422);
  });
});
