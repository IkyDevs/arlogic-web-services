import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock Supabase client
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
        data: { user: { id: "user-123", email: "test@example.com" } },
        error: null,
      }),
    },
  };
};

describe("transitionServiceStatus", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("transitions from assigned to in_progress", async () => {
    const mockSupabase = createMockSupabase({
      single: vi.fn().mockResolvedValue({
        data: { id: "service-123", status: "assigned", assigned_teknisi_id: "user-123" },
        error: null,
        count: 1,
      }),
    });

    const { transitionServiceStatus } = await import("@/lib/api/technician/transition");
    const result = await transitionServiceStatus(
      mockSupabase as any,
      "service-123",
      "assigned",
      "in_progress"
    );

    expect(result.success).toBe(true);
    expect(result.newStatus).toBe("in_progress");
    expect(mockSupabase.from).toHaveBeenCalledWith("service_orders");
  });

  it("throws INVALID_STATUS_TRANSITION when status mismatch", async () => {
    const mockSupabase = createMockSupabase({
      single: vi.fn()
        .mockResolvedValueOnce({
          data: null,
          error: null,
          count: 0,
        })
        .mockResolvedValueOnce({
          data: { status: "in_progress" },
          error: null,
        }),
    });

    const { transitionServiceStatus } = await import("@/lib/api/technician/transition");

    await expect(
      transitionServiceStatus(
        mockSupabase as any,
        "service-123",
        "assigned",
        "in_progress"
      )
    ).rejects.toMatchObject({
      code: "INVALID_STATUS_TRANSITION",
    });
  });

  it("throws SERVICE_NOT_FOUND when service does not exist", async () => {
    const mockSupabase = createMockSupabase({
      single: vi.fn()
        .mockResolvedValueOnce({
          data: null,
          error: null,
          count: 0,
        })
        .mockResolvedValueOnce({
          data: null,
          error: null,
        }),
    });

    const { transitionServiceStatus } = await import("@/lib/api/technician/transition");

    await expect(
      transitionServiceStatus(
        mockSupabase as any,
        "nonexistent",
        "assigned",
        "in_progress"
      )
    ).rejects.toMatchObject({
      code: "SERVICE_NOT_FOUND",
    });
  });
});

describe("insertTimeline", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("inserts timeline entry", async () => {
    const mockSupabase = createMockSupabase({
      insert: vi.fn().mockResolvedValue({ error: null }),
    });

    const { insertTimeline } = await import("@/lib/api/technician/transition");

    await expect(
      insertTimeline(
        mockSupabase as any,
        "service-123",
        "user-123",
        "in_progress",
        "Service started",
        { action: "start_service" }
      )
    ).resolves.toBeUndefined();

    expect(mockSupabase.from).toHaveBeenCalledWith("service_timeline");
  });

  it("throws INTERNAL_ERROR on insert failure", async () => {
    const mockSupabase = createMockSupabase({
      insert: vi.fn().mockResolvedValue({ error: { message: "Insert failed" } }),
    });

    const { insertTimeline } = await import("@/lib/api/technician/transition");

    await expect(
      insertTimeline(
        mockSupabase as any,
        "service-123",
        "user-123",
        "in_progress",
        "Service started"
      )
    ).rejects.toMatchObject({
      code: "INTERNAL_ERROR",
    });
  });
});
