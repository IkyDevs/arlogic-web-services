import { describe, it, expect } from "vitest";
import {
  normalizePhone,
  buildWhatsAppUrl,
  buildTimelineUpdateMessage,
  isValidWhatsAppPhone,
} from "@/lib/whatsapp";

describe("normalizePhone", () => {
  it("converts 081234567890 to 6281234567890", () => {
    expect(normalizePhone("081234567890")).toBe("6281234567890");
  });

  it("converts +6281234567890 to 6281234567890", () => {
    expect(normalizePhone("+6281234567890")).toBe("6281234567890");
  });

  it("keeps 6281234567890 as-is", () => {
    expect(normalizePhone("6281234567890")).toBe("6281234567890");
  });

  it("handles formatted input 08 1234-5678-90", () => {
    expect(normalizePhone("08 1234-5678-90")).toBe("6281234567890");
  });

  it("handles input with parentheses and dashes", () => {
    expect(normalizePhone("(0812) 345-678-90")).toBe("6281234567890");
  });

  it("returns null for empty string", () => {
    expect(normalizePhone("")).toBeNull();
  });

  it("returns null for null/undefined", () => {
    expect(normalizePhone(null)).toBeNull();
    expect(normalizePhone(undefined)).toBeNull();
  });

  it("returns null for too short number", () => {
    expect(normalizePhone("0812345")).toBeNull();
  });

  it("returns null for non-Indonesian prefix", () => {
    expect(normalizePhone("1234567890")).toBeNull();
  });
});

describe("buildWhatsAppUrl", () => {
  it("builds correct URL with encoded message", () => {
    const url = buildWhatsAppUrl("6281234567890", "Hello World");
    expect(url).toBe("https://wa.me/6281234567890?text=Hello%20World");
  });

  it("encodes special characters", () => {
    const url = buildWhatsAppUrl("6281234567890", "Halo & terima kasih!");
    expect(url).toContain("https://wa.me/6281234567890?text=");
    expect(url).toContain("Halo%20%26%20terima%20kasih!");
  });

  it("preserves line breaks in encoded message", () => {
    const url = buildWhatsAppUrl("6281234567890", "Line 1\nLine 2");
    expect(url).toContain("Line%201%0ALine%202");
  });
});

describe("buildTimelineUpdateMessage", () => {
  it("wraps caption with greeting and closing", () => {
    const msg = buildTimelineUpdateMessage("Service selesai");
    expect(msg).toContain("Halo Kak, berikut update service jam Kakak");
    expect(msg).toContain("Service selesai");
    expect(msg).toContain("Terima kasih sudah menunggu");
  });

  it("preserves the original caption exactly", () => {
    const caption = "tanggal : Senin, 01 Januari (01), 2026\nteknisi : Budi\nupdate: Diagnosis awal\nstatus: diagnosis";
    const msg = buildTimelineUpdateMessage(caption);
    expect(msg).toContain(caption);
  });

  it("preserves line breaks in caption", () => {
    const caption = "Line 1\nLine 2\nLine 3";
    const msg = buildTimelineUpdateMessage(caption);
    expect(msg).toContain("Line 1\nLine 2\nLine 3");
  });

  it("trims whitespace from caption", () => {
    const msg = buildTimelineUpdateMessage("  Service selesai  ");
    expect(msg).toContain("Service selesai");
  });
});

describe("isValidWhatsAppPhone", () => {
  it("returns true for valid 08 number", () => {
    expect(isValidWhatsAppPhone("081234567890")).toBe(true);
  });

  it("returns true for valid 62 number", () => {
    expect(isValidWhatsAppPhone("6281234567890")).toBe(true);
  });

  it("returns false for empty string", () => {
    expect(isValidWhatsAppPhone("")).toBe(false);
  });

  it("returns false for null", () => {
    expect(isValidWhatsAppPhone(null)).toBe(false);
  });

  it("returns false for too short number", () => {
    expect(isValidWhatsAppPhone("0812345")).toBe(false);
  });
});
