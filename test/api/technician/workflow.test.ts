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

describe("POST /api/technician/request-sparepart", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 409 when not in_progress status", async () => {
    const mockSupabase = createMockSupabase({
      single: vi.fn().mockResolvedValue({
        data: {
          id: "service-123",
          status: "assigned",
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

    const { POST } = await import("@/app/api/technician/request-sparepart/route");
    const request = new Request("http://localhost:3000/api/technician/request-sparepart", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        serviceOrderId: "123e4567-e89b-12d3-a456-426614174000",
        sparepart: "Baterai CR2032",
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(409);
  });
});

describe("POST /api/technician/submit-qc", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 409 when not in_progress status", async () => {
    const mockSupabase = createMockSupabase({
      single: vi.fn().mockResolvedValue({
        data: {
          id: "service-123",
          status: "assigned",
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

    const { POST } = await import("@/app/api/technician/submit-qc/route");
    const request = new Request("http://localhost:3000/api/technician/submit-qc", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        serviceOrderId: "123e4567-e89b-12d3-a456-426614174000",
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(409);
  });

  it("returns 422 when no items exist", async () => {
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

    let callCount = 0;
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
      if (table === "service_items" && callCount === 0) {
        callCount++;
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue({
            data: [],
            error: null,
          }),
        };
      }
      return originalFrom(table);
    });

    const { POST } = await import("@/app/api/technician/submit-qc/route");
    const request = new Request("http://localhost:3000/api/technician/submit-qc", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        serviceOrderId: "123e4567-e89b-12d3-a456-426614174000",
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(422);
  });
});

describe("POST /api/technician/retract-qc", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 409 when not in qc_pending or revision_required", async () => {
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

    const { POST } = await import("@/app/api/technician/retract-qc/route");
    const request = new Request("http://localhost:3000/api/technician/retract-qc", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        serviceOrderId: "123e4567-e89b-12d3-a456-426614174000",
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(409);
  });
});
