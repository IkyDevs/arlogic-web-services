import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.setConfig({ testTimeout: 30000 });

const TEST_BOT_TOKEN = "test:bot_token";
const mockFetch = vi.fn();

beforeEach(() => {
  mockFetch.mockReset();
  vi.stubEnv("TELEGRAM_BOT_TOKEN", TEST_BOT_TOKEN);
  vi.stubEnv("TELEGRAM_CHANNEL_SERVICE", "@test_channel");
  vi.stubEnv("TELEGRAM_CHANNEL_LAYANAN", "@test_channel");
  vi.stubEnv("TELEGRAM_CHANNEL_BUKU_KAS", "@test_buku_kas");

  vi.stubGlobal("fetch", mockFetch);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.resetModules();
});

function makeFetchResponse(ok: boolean, overrides: Record<string, any> = {}): any {
  const result = {
    message_id: 123,
    chat: { id: -100123456789 },
    photo: [{ file_id: "test_fid", file_unique_id: "fuid" }],
    ...overrides,
  };
  const body = JSON.stringify({ ok, result, description: ok ? undefined : "API error" });
  return {
    ok: true,
    text: () => Promise.resolve(body),
    json: () => Promise.resolve(JSON.parse(body)),
  };
}

describe("sendTelegramMessage", () => {
  it("sends a text message and returns messageId/chatId", async () => {
    const { sendTelegramMessage } = await import("@/lib/telegram");

    // sendMessage call (tgPost doesn't call getFile for text-only messages)
    mockFetch.mockResolvedValueOnce(makeFetchResponse(true));

    const result = await sendTelegramMessage({
      chatId: "@test_channel",
      text: "Test message",
    });

    expect(result.messageId).toBe(123);
    expect(result.chatId).toBe("-100123456789");
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("throws on Telegram API error response", async () => {
    const { sendTelegramMessage } = await import("@/lib/telegram");
    // mockImplementation so every retry attempt gets the same error
    mockFetch.mockImplementation(() => Promise.resolve({
      ok: true,
      status: 200,
      text: () => Promise.resolve(JSON.stringify({ ok: false, description: "API error: bad request" })),
    } as any));

    await expect(sendTelegramMessage({
      chatId: "@test",
      text: "test",
    })).rejects.toThrow("API error");
  });
});

describe("editMessageCaption", () => {
  it("returns true on success", async () => {
    const { editMessageCaption } = await import("@/lib/telegram");
    mockFetch.mockResolvedValueOnce(makeFetchResponse(true));

    const result = await editMessageCaption("@test", 123, "New caption");
    expect(result).toBe(true);
  });

  it("returns false on API error", async () => {
    const { editMessageCaption } = await import("@/lib/telegram");
    mockFetch.mockImplementation(() => Promise.resolve({
      ok: true,
      status: 200,
      text: () => Promise.resolve(JSON.stringify({ ok: false, description: "API error" })),
    } as any));

    const result = await editMessageCaption("@test", 123, "New caption");
    expect(result).toBe(false);
  });

  it("returns false on fetch error", async () => {
    const { editMessageCaption } = await import("@/lib/telegram");
    mockFetch.mockRejectedValue(new Error("Network error"));

    const result = await editMessageCaption("@test", 123, "New caption");
    expect(result).toBe(false);
  });
});

describe("uploadMultipleToTelegram", () => {
  it("returns empty array when no files", async () => {
    const { uploadMultipleToTelegram } = await import("@/lib/telegram");
    const result = await uploadMultipleToTelegram([], "caption", "service");
    expect(result).toEqual([]);
  });

  it("sends single file via sendPhoto", async () => {
    const { uploadMultipleToTelegram } = await import("@/lib/telegram");
    // sendPhoto + getFile
    mockFetch.mockResolvedValueOnce(makeFetchResponse(true, { file_path: "photos/test.jpg" }));

    const results = await uploadMultipleToTelegram(
      [{ buffer: Buffer.from("img"), name: "test.jpg" }],
      "caption",
      "service",
    );

    expect(results.length).toBe(1);
    expect(results[0].chat_id).toBe("-100123456789");
    expect(results[0].message_id).toBe(123);
  });

  it("sends multiple files via sendMediaGroup", async () => {
    const { uploadMultipleToTelegram } = await import("@/lib/telegram");
    const groupResult = [
      { message_id: 201, chat: { id: -100123456789 }, photo: [{ file_id: "fid_0", file_unique_id: "fuid_0" }] },
      { message_id: 202, chat: { id: -100123456789 }, photo: [{ file_id: "fid_1", file_unique_id: "fuid_1" }] },
      { message_id: 203, chat: { id: -100123456789 }, photo: [{ file_id: "fid_2", file_unique_id: "fuid_2" }] },
    ];
    const body = JSON.stringify({ ok: true, result: groupResult });
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: () => Promise.resolve(body),
      json: () => Promise.resolve(JSON.parse(body)),
    });
    // getFile calls for each photo
    mockFetch.mockResolvedValue({ ok: true, text: () => Promise.resolve(JSON.stringify({ ok: true, result: { file_path: "photos/test.jpg" } })) });

    const results = await uploadMultipleToTelegram(
      [
        { buffer: Buffer.from("img1"), name: "a.jpg" },
        { buffer: Buffer.from("img2"), name: "b.jpg" },
        { buffer: Buffer.from("img3"), name: "c.jpg" },
      ],
      "Album caption",
      "service",
    );

    expect(results.length).toBe(3);
    expect(results[0].chat_id).toBe("-100123456789");
    expect(results[0].message_id).toBe(201);
    expect(results[2].message_id).toBe(203);
  });
});

describe("sendExpenseTelegramNotification", () => {
  it("sends text message when no proof photos", async () => {
    const { sendExpenseTelegramNotification } = await import("@/lib/telegram");
    mockFetch.mockResolvedValueOnce(makeFetchResponse(true));

    const result = await sendExpenseTelegramNotification({
      expenseId: "exp-1",
      itemName: "Test item",
      amount: 50000,
      paymentMethod: "cash",
      handledByName: "Admin",
      notes: "",
      proofPhotoUrls: [],
      createdAt: new Date().toISOString(),
    });

    expect(result.messageId).toBe(123);
  });

  it("sends photo when proof URLs provided", async () => {
    const { sendExpenseTelegramNotification } = await import("@/lib/telegram");
    // First fetch: download photo
    mockFetch.mockResolvedValueOnce({
      ok: true,
      blob: () => Promise.resolve(new Blob(["test"], { type: "image/jpeg" })),
    } as any);
    // Second fetch: sendPhoto to Telegram
    mockFetch.mockResolvedValueOnce(makeFetchResponse(true));

    const result = await sendExpenseTelegramNotification({
      expenseId: "exp-2",
      itemName: "Test with photo",
      amount: 25000,
      paymentMethod: "qris",
      handledByName: "Staff",
      notes: "test notes",
      proofPhotoUrls: ["https://example.com/photo.jpg"],
      createdAt: new Date().toISOString(),
    });

    expect(result.messageId).toBe(123);
  });
});
