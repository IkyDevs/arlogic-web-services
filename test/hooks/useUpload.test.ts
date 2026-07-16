import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

const mockFetch = vi.fn();

vi.mock("react-hot-toast", () => ({
  default: { success: vi.fn(), error: vi.fn() },
  success: vi.fn(),
  error: vi.fn(),
}));

beforeEach(() => {
  vi.stubGlobal("fetch", mockFetch);
});

afterEach(() => {
  vi.unstubAllGlobals();
  mockFetch.mockReset();
});

function createMockFile(name: string, type: string, size: number = 500 * 1024): File {
  const blob = new Blob([new ArrayBuffer(size)], { type });
  return new File([blob], name, { type });
}

describe("useUpload", () => {
  it("returns initial state", async () => {
    const { useUpload } = await import("@/hooks/useUpload");
    const { result } = renderHook(() => useUpload());
    expect(result.current.uploading).toBe(false);
    expect(result.current.progress).toBe(0);
  });

  it("returns empty array for empty files", async () => {
    const { useUpload } = await import("@/hooks/useUpload");
    const { result } = renderHook(() => useUpload());
    const res = await act(async () => result.current.uploadFiles([], { type: "service" }));
    expect(res).toEqual([]);
  });

  it("returns empty array for oversized files", async () => {
    const { useUpload } = await import("@/hooks/useUpload");
    const { result } = renderHook(() => useUpload());
    const bigFile = createMockFile("big.jpg", "image/jpeg", 25 * 1024 * 1024);
    const res = await act(async () => result.current.uploadFiles([bigFile], { type: "service" }));
    expect(res).toEqual([]);
  });

  it("returns empty array for non-image files", async () => {
    const { useUpload } = await import("@/hooks/useUpload");
    const { result } = renderHook(() => useUpload());
    const pdf = createMockFile("doc.pdf", "application/pdf");
    const res = await act(async () => result.current.uploadFiles([pdf], { type: "service" }));
    expect(res).toEqual([]);
  });

  it("handles network error gracefully", async () => {
    const { useUpload } = await import("@/hooks/useUpload");
    const { result } = renderHook(() => useUpload());
    mockFetch.mockRejectedValueOnce(new TypeError("Failed to fetch"));

    await act(async () => {
      // Small JPEG file will skip compression
      const file = createMockFile("test.jpg", "image/jpeg", 100 * 1024);
      const res = await result.current.uploadFiles([file], { type: "service" });
      expect(res).toEqual([]);
    });
  });

  it("handles server error gracefully", async () => {
    const { useUpload } = await import("@/hooks/useUpload");
    const { result } = renderHook(() => useUpload());
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: () => Promise.resolve({ error: "Upload failed", details: "Server error" }),
    });

    await act(async () => {
      const file = createMockFile("test.jpg", "image/jpeg", 100 * 1024);
      const res = await result.current.uploadFiles([file], { type: "service" });
      expect(res).toEqual([]);
    });
  });

  it("handles abort/cancellation", async () => {
    const { useUpload } = await import("@/hooks/useUpload");
    const { result } = renderHook(() => useUpload());

    act(() => result.current.cancel());

    await act(async () => {
      const file = createMockFile("test.jpg", "image/jpeg", 100 * 1024);
      const res = await result.current.uploadFiles([file], { type: "service" });
      expect(res).toEqual([]);
    });
  });

  it("uploadFile returns null on failure", async () => {
    const { useUpload } = await import("@/hooks/useUpload");
    const { result } = renderHook(() => useUpload());
    mockFetch.mockRejectedValueOnce(new Error("Network error"));

    await act(async () => {
      const file = createMockFile("test.jpg", "image/jpeg", 100 * 1024);
      const res = await result.current.uploadFile(file, { type: "service" });
      expect(res).toBeNull();
    });
  });
});
