import { describe, it, expect } from "vitest";
import { detectVideoCodec } from "@/lib/video/transcode";

function bytes(s: string): Uint8Array {
  return new TextEncoder().encode(s);
}

describe("detectVideoCodec", () => {
  it("identifies HEVC via hvc1 atom", () => {
    expect(detectVideoCodec(bytes("....ftypmp42....hvc1.1.6.L93"))).toBe(
      "hevc",
    );
  });

  it("identifies HEVC via hev1 atom", () => {
    expect(detectVideoCodec(bytes("....ftypisom....hev1.1.6.L120"))).toBe(
      "hevc",
    );
  });

  it("identifies H.264 via avc1", () => {
    expect(detectVideoCodec(bytes("....ftypisom....avc1.640028"))).toBe(
      "h264",
    );
  });

  it("returns other for non-video bytes", () => {
    expect(detectVideoCodec(bytes("{\"jpeg\":true}"))).toBe("other");
  });

  it("returns other for empty input", () => {
    expect(detectVideoCodec(new Uint8Array(0))).toBe("other");
  });
});