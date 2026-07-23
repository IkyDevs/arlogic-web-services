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

const makeSuccessResponse = () => ({
  ok: true,
  text: () =>
    Promise.resolve(
      JSON.stringify({
        success: true,
        urls: ["https://example.com/photo.jpg"],
        messages: [{ chat_id: "-100123", message_id: 1 }],
        file_ids: ["file_id_1"],
        count: 1,
        storage: "supabase",
        channel: "service",
      }),
    ),
  json: () =>
    Promise.resolve({
      success: true,
      urls: ["https://example.com/photo.jpg"],
      messages: [{ chat_id: "-100123", message_id: 1 }],
      file_ids: ["file_id_1"],
      count: 1,
      storage: "supabase",
      channel: "service",
    }),
});

describe("useUpload (legacy)", () => {
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
      text: () => Promise.resolve(JSON.stringify({ error: "Upload failed", details: "Server error" })),
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

  it("uploadFiles returns results on success", async () => {
    const { useUpload } = await import("@/hooks/useUpload");
    const { result } = renderHook(() => useUpload());
    mockFetch.mockResolvedValueOnce(makeSuccessResponse());

    await act(async () => {
      const file = createMockFile("test.jpg", "image/jpeg", 100 * 1024);
      const res = await result.current.uploadFiles([file], { type: "service" });
      expect(res).toHaveLength(1);
      expect(res[0].url).toBe("https://example.com/photo.jpg");
      expect(res[0].chat_id).toBe("-100123");
    });
  });

  it("uploads multiple files in single batch request", async () => {
    const { useUpload } = await import("@/hooks/useUpload");
    const { result } = renderHook(() => useUpload());

    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: () =>
        Promise.resolve(
          JSON.stringify({
            success: true,
            urls: ["https://ex.com/1.jpg", "https://ex.com/2.jpg"],
            messages: [
              { chat_id: "-100", message_id: 1 },
              { chat_id: "-100", message_id: 2 },
            ],
            file_ids: ["f1", "f2"],
            count: 2,
            storage: "supabase",
            channel: "service",
          }),
        ),
      json: () =>
        Promise.resolve({
          success: true,
          urls: ["https://ex.com/1.jpg", "https://ex.com/2.jpg"],
          messages: [
            { chat_id: "-100", message_id: 1 },
            { chat_id: "-100", message_id: 2 },
          ],
          file_ids: ["f1", "f2"],
          count: 2,
          storage: "supabase",
          channel: "service",
        }),
    });

    await act(async () => {
      const f1 = createMockFile("a.jpg", "image/jpeg", 50 * 1024);
      const f2 = createMockFile("b.jpg", "image/jpeg", 50 * 1024);
      const res = await result.current.uploadFiles([f1, f2], { type: "service" });
      expect(res).toHaveLength(2);
      expect(res[0].url).toBe("https://ex.com/1.jpg");
      expect(res[1].url).toBe("https://ex.com/2.jpg");
    });
  });
});

describe("usePhotoUpload", () => {
  it("initializes with empty photos", async () => {
    const { usePhotoUpload } = await import("@/hooks/usePhotoUpload");
    const { result } = renderHook(() => usePhotoUpload());
    expect(result.current.photos).toEqual([]);
    expect(result.current.uploading).toBe(false);
    expect(result.current.hasChanges).toBe(false);
  });

  it("rejects non-image files", async () => {
    const { usePhotoUpload } = await import("@/hooks/usePhotoUpload");
    const { result } = renderHook(() => usePhotoUpload());

    await act(async () => {
      const pdf = createMockFile("doc.pdf", "application/pdf");
      const added = await result.current.addPhotos([pdf], { type: "service" });
      expect(added).toEqual([]);
    });
  });

  it("accepts image files and creates previews", async () => {
    vi.stubGlobal("URL.createObjectURL", vi.fn(() => "blob:test"));
    vi.stubGlobal("URL.revokeObjectURL", vi.fn());

    const { usePhotoUpload } = await import("@/hooks/usePhotoUpload");
    const { result } = renderHook(() => usePhotoUpload());

    await act(async () => {
      const img = createMockFile("photo.jpg", "image/jpeg", 100 * 1024);
      const added = await result.current.addPhotos([img], { type: "service" });
      expect(added).toHaveLength(1);
      expect(added[0].name).toBe("photo.jpg");
      expect(added[0].status).toBe("ready");
    });

    vi.unstubAllGlobals();
  });

  it("batches multiple files in single addPhotos call", async () => {
    vi.stubGlobal("URL.createObjectURL", vi.fn(() => "blob:test"));
    vi.stubGlobal("URL.revokeObjectURL", vi.fn());

    const { usePhotoUpload } = await import("@/hooks/usePhotoUpload");
    const { result } = renderHook(() => usePhotoUpload());

    await act(async () => {
      const f1 = createMockFile("a.jpg", "image/jpeg", 100 * 1024);
      const f2 = createMockFile("b.png", "image/png", 200 * 1024);
      const added = await result.current.addPhotos([f1, f2], { type: "service" });
      expect(added).toHaveLength(2);
    });

    vi.unstubAllGlobals();
  });

  it("addPhotos returns ready photos with preview", async () => {
    vi.stubGlobal("URL.createObjectURL", vi.fn(() => "blob:test"));
    vi.stubGlobal("URL.revokeObjectURL", vi.fn());

    const { usePhotoUpload } = await import("@/hooks/usePhotoUpload");
    const { result } = renderHook(() => usePhotoUpload());

    await act(async () => {
      const img = createMockFile("photo.jpg", "image/jpeg", 100 * 1024);
      const added = await result.current.addPhotos([img], { type: "service" });
      expect(added).toHaveLength(1);
      expect(added[0].status).toBe("ready");
      expect(added[0].name).toBe("photo.jpg");
    });

    await act(async () => {
      result.current.removePhoto(result.current.photos[0]?.id || "");
    });

    expect(result.current.photos).toHaveLength(0);
    vi.unstubAllGlobals();
  });
});
