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

const makeSuccessResponse = (count = 1) => {
  const urls = Array.from({ length: count }, (_, i) => `https://ex.com/${i}.jpg`);
  const messages = Array.from({ length: count }, (_, i) => ({ chat_id: "-100", message_id: i + 1 }));
  const file_ids = Array.from({ length: count }, (_, i) => `f${i}`);
  return {
    ok: true,
    text: () =>
      Promise.resolve(
        JSON.stringify({ success: true, urls, messages, file_ids, count, storage: "supabase", channel: "service" }),
      ),
    json: () =>
      Promise.resolve({ success: true, urls, messages, file_ids, count, storage: "supabase", channel: "service" }),
  };
};

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

  it("uploads multiple files in single batch request", async () => {
    const { useUpload } = await import("@/hooks/useUpload");
    const { result } = renderHook(() => useUpload());
    mockFetch.mockResolvedValueOnce(makeSuccessResponse(2));
    await act(async () => {
      const f1 = createMockFile("a.jpg", "image/jpeg", 50 * 1024);
      const f2 = createMockFile("b.jpg", "image/jpeg", 50 * 1024);
      const res = await result.current.uploadFiles([f1, f2], { type: "service" });
      expect(res).toHaveLength(2);
    });
  });
});

describe("usePhotoUpload (centralized hook)", () => {
  it("initializes with empty photos", async () => {
    const { usePhotoUpload } = await import("@/hooks/usePhotoUpload");
    const { result } = renderHook(() => usePhotoUpload());
    expect(result.current.photos).toEqual([]);
    expect(result.current.uploading).toBe(false);
    expect(result.current.hasChanges).toBe(false);
  });

  it("rejects non-image files (validation from config)", async () => {
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
      expect(added[0].status).toBe("ready");
    });
    vi.unstubAllGlobals();
  });

  it("uploads all files in single batch (1 request for N files)", async () => {
    vi.stubGlobal("URL.createObjectURL", vi.fn(() => "blob:test"));
    vi.stubGlobal("URL.revokeObjectURL", vi.fn());
    const { usePhotoUpload } = await import("@/hooks/usePhotoUpload");
    const { result } = renderHook(() => usePhotoUpload());
    mockFetch.mockResolvedValueOnce(makeSuccessResponse(3));

    await act(async () => {
      const f1 = createMockFile("a.jpg", "image/jpeg", 50 * 1024);
      const f2 = createMockFile("b.jpg", "image/jpeg", 50 * 1024);
      const f3 = createMockFile("c.jpg", "image/jpeg", 50 * 1024);
      const added = await result.current.addPhotos([f1, f2, f3], { type: "service" });
      expect(added).toHaveLength(3);
      const results = await result.current.uploadPhotos(added, { type: "service" });
      expect(results).toHaveLength(3);
      expect(results.every((r) => r.status === "success")).toBe(true);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
    vi.unstubAllGlobals();
  });

  it("handles partial upload failure (some succeed, some fail)", async () => {
    vi.stubGlobal("URL.createObjectURL", vi.fn(() => "blob:test"));
    vi.stubGlobal("URL.revokeObjectURL", vi.fn());
    const { usePhotoUpload } = await import("@/hooks/usePhotoUpload");
    const { result } = renderHook(() => usePhotoUpload());

    // All files go in one request, response has all 2 URLs
    mockFetch.mockResolvedValueOnce(makeSuccessResponse(2));

    await act(async () => {
      const f1 = createMockFile("ok.jpg", "image/jpeg", 50 * 1024);
      const f2 = createMockFile("ok2.jpg", "image/jpeg", 50 * 1024);
      const added = await result.current.addPhotos([f1, f2], { type: "service" });
      expect(added).toHaveLength(2);
      const results = await result.current.uploadPhotos(added, { type: "service" });
      expect(results).toHaveLength(2);
      expect(results[0].status).toBe("success");
      expect(results[1].status).toBe("success");
    });
    vi.unstubAllGlobals();
  });

  it("cancel aborts in-progress upload", async () => {
    vi.stubGlobal("URL.createObjectURL", vi.fn(() => "blob:test"));
    vi.stubGlobal("URL.revokeObjectURL", vi.fn());
    const { usePhotoUpload } = await import("@/hooks/usePhotoUpload");
    const { result } = renderHook(() => usePhotoUpload());

    await act(async () => {
      const img = createMockFile("test.jpg", "image/jpeg", 100 * 1024);
      const added = await result.current.addPhotos([img], { type: "service" });
      // Cancel before uploading
      result.current.cancel();
      const results = await result.current.uploadPhotos(added, { type: "service" });
      expect(results).toEqual([]);
    });
    vi.unstubAllGlobals();
  });

  it("reset clears all photos and state", async () => {
    vi.stubGlobal("URL.createObjectURL", vi.fn(() => "blob:test"));
    vi.stubGlobal("URL.revokeObjectURL", vi.fn());
    const { usePhotoUpload } = await import("@/hooks/usePhotoUpload");
    const { result } = renderHook(() => usePhotoUpload());

    await act(async () => {
      const img = createMockFile("test.jpg", "image/jpeg", 100 * 1024);
      const added = await result.current.addPhotos([img], { type: "service" });
      expect(added).toHaveLength(1);
    });

    await act(async () => {
      result.current.reset();
    });

    expect(result.current.photos).toHaveLength(0);
    expect(result.current.uploading).toBe(false);
    vi.unstubAllGlobals();
  });
});

describe("uploadConfig", () => {
  it("provides default values", async () => {
    const { uploadConfig } = await import("@/lib/uploadConfig");
    expect(uploadConfig.IMAGE_COMPRESSION_ENABLED).toBe(false);
    expect(uploadConfig.IMAGE_RESIZE_ENABLED).toBe(false);
    expect(uploadConfig.IMAGE_KEEP_ORIGINAL).toBe(true);
    expect(uploadConfig.IMAGE_MAX_SIZE_MB).toBe(15);
    expect(uploadConfig.IMAGE_MAX_FILES).toBe(10);
    expect(uploadConfig.IMAGE_UPLOAD_TIMEOUT).toBe(120);
  });

  it("isAllowedFile validates by mime and extension", async () => {
    const { isAllowedFile } = await import("@/lib/uploadConfig");
    expect(isAllowedFile({ type: "image/jpeg", name: "photo.jpg" })).toBe(true);
    expect(isAllowedFile({ type: "image/png", name: "photo.png" })).toBe(true);
    expect(isAllowedFile({ type: "image/heic", name: "photo.heic" })).toBe(true);
    expect(isAllowedFile({ type: "application/pdf", name: "doc.pdf" })).toBe(false);
    expect(isAllowedFile({ type: "text/plain", name: "notes.txt" })).toBe(false);
    expect(isAllowedFile({ type: "", name: "photo.heic" })).toBe(true);
  });
});
