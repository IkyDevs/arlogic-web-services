import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// Mock localStorage for Node 22+ compatibility
const lsStore: Record<string, string> = {};
const localStorageMock = {
  getItem: (key: string) => lsStore[key] ?? null,
  setItem: (key: string, value: string) => { lsStore[key] = value; },
  removeItem: (key: string) => { delete lsStore[key]; },
  clear: () => { Object.keys(lsStore).forEach(k => delete lsStore[k]); },
  get length() { return Object.keys(lsStore).length; },
  key: (i: number) => Object.keys(lsStore)[i] ?? null,
};
Object.defineProperty(globalThis, "localStorage", { value: localStorageMock, writable: true });

const mockUser = {
  id: "user-1",
  email: "admin@test.com",
  full_name: "Admin Test",
  role: "admin" as const,
  phone: "08123456789",
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

describe("useAuthStore", () => {
  beforeEach(() => {
    localStorageMock.clear();
  });

  it("initializes with null user and loading true", async () => {
    const { useAuthStore } = await import("@/stores/authStore");
    const state = useAuthStore.getState();
    expect(state.user).toBeNull();
    expect(state.isLoading).toBe(true);
  });

  it("setUser updates user state", async () => {
    const { useAuthStore } = await import("@/stores/authStore");
    useAuthStore.getState().setUser(mockUser);
    expect(useAuthStore.getState().user?.full_name).toBe("Admin Test");
  });

  it("setUser with null clears user", async () => {
    const { useAuthStore } = await import("@/stores/authStore");
    useAuthStore.getState().setUser(mockUser);
    useAuthStore.getState().setUser(null);
    expect(useAuthStore.getState().user).toBeNull();
  });

  it("setIsLoading updates loading state", async () => {
    const { useAuthStore } = await import("@/stores/authStore");
    useAuthStore.getState().setIsLoading(false);
    expect(useAuthStore.getState().isLoading).toBe(false);
  });

  it("logout clears user", async () => {
    const { useAuthStore } = await import("@/stores/authStore");
    useAuthStore.getState().setUser(mockUser);
    useAuthStore.getState().setIsLoading(false);
    useAuthStore.getState().logout();
    expect(useAuthStore.getState().user).toBeNull();
    expect(useAuthStore.getState().isLoading).toBe(false);
  });

  it("persists user to localStorage", async () => {
    const { useAuthStore } = await import("@/stores/authStore");
    useAuthStore.getState().setUser(mockUser);
    const stored = localStorageMock.getItem("auth-storage");
    expect(stored).not.toBeNull();
    const parsed = JSON.parse(stored!);
    expect(parsed.state.user.email).toBe("admin@test.com");
  });

  it("allows updating user multiple times", async () => {
    const { useAuthStore } = await import("@/stores/authStore");
    useAuthStore.getState().setUser(mockUser);
    useAuthStore.getState().setUser({ ...mockUser, full_name: "Updated Name" });
    expect(useAuthStore.getState().user?.full_name).toBe("Updated Name");
  });
});
