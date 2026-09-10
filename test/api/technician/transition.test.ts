import { describe, it, expect, vi, beforeEach } from "vitest";

function createMockSupabase(topOverrides: Record<string, any> = {}) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
  };

  const base: Record<string, any> = {
    from: vi.fn().mockReturnValue(chain),
    rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: "user-123", email: "test@example.com" } },
        error: null,
      }),
    },
  };

  return { ...base, ...topOverrides } as any;
}

describe("transitionWithTimeline (atomic RPC)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls technician_transition_service RPC with correct parameters", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: {
        success: true,
        previous_status: "assigned",
        new_status: "in_progress",
        service_id: "service-123",
        invoice_number: "INV-001",
        customer_name: "Test Customer",
      },
      error: null,
    });
    const supabase = createMockSupabase({ rpc });

    const { transitionWithTimeline } = await import("@/lib/api/technician/transition");
    const result = await transitionWithTimeline(
      supabase,
      "service-123",
      "assigned",
      "in_progress",
      "user-123",
      "in_progress",
      "Service started",
      { start_date: "2026-01-01" },
      { action: "start_service" }
    );

    expect(result.success).toBe(true);
    expect(result.previousStatus).toBe("assigned");
    expect(result.newStatus).toBe("in_progress");

    expect(rpc).toHaveBeenCalledWith("technician_transition_service", {
      p_service_order_id: "service-123",
      p_expected_status: "assigned",
      p_new_status: "in_progress",
      p_timeline_status: "in_progress",
      p_timeline_message: "Service started",
      p_additional_updates: { start_date: "2026-01-01" },
      p_timeline_details: { action: "start_service" },
    });
  });

  it("maps FORBIDDEN (non-teknisi) RPC error to 403", async () => {
    const supabase = createMockSupabase({
      rpc: vi.fn().mockResolvedValue({
        data: null,
        error: { message: "FORBIDDEN: only technicians may perform this action" },
      }),
    });

    const { transitionWithTimeline } = await import("@/lib/api/technician/transition");

    await expect(
      transitionWithTimeline(
        supabase, "service-123", "assigned", "in_progress",
        "user-123", "in_progress", "Service started"
      )
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("maps SERVICE_NOT_FOUND RPC error to 404", async () => {
    const supabase = createMockSupabase({
      rpc: vi.fn().mockResolvedValue({
        data: null,
        error: { message: "SERVICE_NOT_FOUND: service order does not exist" },
      }),
    });

    const { transitionWithTimeline } = await import("@/lib/api/technician/transition");

    await expect(
      transitionWithTimeline(
        supabase, "nonexistent", "assigned", "in_progress",
        "user-123", "in_progress", "Service started"
      )
    ).rejects.toMatchObject({ code: "SERVICE_NOT_FOUND" });
  });

  it("maps assignment mismatch to NOT_ASSIGNED_TECHNICIAN", async () => {
    const supabase = createMockSupabase({
      rpc: vi.fn().mockResolvedValue({
        data: null,
        error: { message: "FORBIDDEN: you can only act on services assigned to you" },
      }),
    });

    const { transitionWithTimeline } = await import("@/lib/api/technician/transition");

    await expect(
      transitionWithTimeline(
        supabase, "service-123", "assigned", "in_progress",
        "user-123", "in_progress", "Service started"
      )
    ).rejects.toMatchObject({ code: "NOT_ASSIGNED_TECHNICIAN" });
  });

  it("maps INVALID_STATUS_TRANSITION RPC error correctly", async () => {
    const supabase = createMockSupabase({
      rpc: vi.fn().mockResolvedValue({
        data: null,
        error: {
          message: "INVALID_STATUS_TRANSITION: cannot transition from assigned to in_progress (current: qc_pending)",
        },
      }),
    });

    const { transitionWithTimeline } = await import("@/lib/api/technician/transition");

    await expect(
      transitionWithTimeline(
        supabase, "service-123", "assigned", "in_progress",
        "user-123", "in_progress", "Service started"
      )
    ).rejects.toMatchObject({ code: "INVALID_STATUS_TRANSITION" });
  });

  it("maps concurrent modification RPC error to INVALID_STATUS_TRANSITION", async () => {
    const supabase = createMockSupabase({
      rpc: vi.fn().mockResolvedValue({
        data: null,
        error: { message: "INVALID_STATUS_TRANSITION: concurrent modification detected on service" },
      }),
    });

    const { transitionWithTimeline } = await import("@/lib/api/technician/transition");

    await expect(
      transitionWithTimeline(
        supabase, "service-123", "assigned", "in_progress",
        "user-123", "in_progress", "Service started"
      )
    ).rejects.toMatchObject({ code: "INVALID_STATUS_TRANSITION" });
  });

  it("maps unknown RPC error to INTERNAL_ERROR without leaking SQL", async () => {
    const supabase = createMockSupabase({
      rpc: vi.fn().mockResolvedValue({
        data: null,
        error: { message: "relation \"public.wrong_table\" does not exist" },
      }),
    });

    const { transitionWithTimeline } = await import("@/lib/api/technician/transition");

    await expect(
      transitionWithTimeline(
        supabase, "service-123", "assigned", "in_progress",
        "user-123", "in_progress", "Service started"
      )
    ).rejects.toMatchObject({ code: "INTERNAL_ERROR" });
  });

  it("handles array expectedStatus by passing first element to RPC", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: {
        success: true,
        previous_status: "qc_pending",
        new_status: "in_progress",
        service_id: "service-123",
        invoice_number: "INV-001",
        customer_name: "Test",
      },
      error: null,
    });
    const supabase = createMockSupabase({ rpc });

    const { transitionWithTimeline } = await import("@/lib/api/technician/transition");
    await transitionWithTimeline(
      supabase, "service-123",
      ["qc_pending", "revision_required"],
      "in_progress", "user-123", "in_progress", "Retract QC"
    );

    expect(rpc).toHaveBeenCalledWith(
      "technician_transition_service",
      expect.objectContaining({ p_expected_status: "qc_pending" })
    );
  });
});

describe("requireTechnician role restriction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  function mockSupabaseForRole(role: string, userId = "user-test") {
    vi.doMock("@/lib/supabase/server", () => ({
      createClient: vi.fn().mockResolvedValue({
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: { id: userId, email: `${role}@example.com` } },
            error: null,
          }),
        },
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: { id: userId, role, full_name: `${role} User` },
            error: null,
          }),
        }),
      }),
    }));
  }

  it("allows teknisi role", async () => {
    mockSupabaseForRole("teknisi", "user-tech");

    const { requireTechnician } = await import("@/lib/api/technician/auth");
    const ctx = await requireTechnician(new Request("http://localhost"));
    expect(ctx.profile.role).toBe("teknisi");
  });

  it("rejects admin role", async () => {
    mockSupabaseForRole("admin", "user-admin");

    const { requireTechnician } = await import("@/lib/api/technician/auth");

    await expect(
      requireTechnician(new Request("http://localhost"))
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("rejects supervisor role", async () => {
    mockSupabaseForRole("supervisor", "user-sup");

    const { requireTechnician } = await import("@/lib/api/technician/auth");

    await expect(
      requireTechnician(new Request("http://localhost"))
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("rejects qc role", async () => {
    mockSupabaseForRole("qc", "user-qc");

    const { requireTechnician } = await import("@/lib/api/technician/auth");

    await expect(
      requireTechnician(new Request("http://localhost"))
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
