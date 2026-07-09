import { describe, it, expect } from "vitest";

function formatRupiah(n: number): string {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(n);
}

function fmtDate(d: string): string {
  return new Date(d).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function fmtDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = Math.floor(minutes % 60);
  return h > 0 ? `${h}j ${m}m` : `${m}m`;
}

function getPaymentLabel(method: string): string {
  const labels: Record<string, string> = {
    cash: "Cash", qris: "QRIS", tf_bca: "TF BCA", tf_mandiri: "TF Mandiri",
    edc_bca: "EDC BCA", edc_mandiri: "EDC Mandiri", bri: "BRI", kudus: "Kudus",
  };
  return labels[method] || method;
}

describe("Utility Functions", () => {
  describe("formatRupiah", () => {
    it("formats basic number", () => {
      expect(formatRupiah(50000)).toBe("Rp 50.000");
    });
    it("formats zero", () => {
      expect(formatRupiah(0)).toBe("Rp 0");
    });
    it("formats large number", () => {
      expect(formatRupiah(1000000)).toBe("Rp 1.000.000");
    });
    it("handles decimal", () => {
      expect(formatRupiah(1500.5)).toBe("Rp 1.501");
    });
  });

  describe("fmtDuration", () => {
    it("converts minutes to hours and minutes", () => {
      expect(fmtDuration(90)).toBe("1j 30m");
    });
    it("handles less than an hour", () => {
      expect(fmtDuration(45)).toBe("45m");
    });
    it("handles exact hours", () => {
      expect(fmtDuration(120)).toBe("2j 0m");
    });
    it("handles zero", () => {
      expect(fmtDuration(0)).toBe("0m");
    });
  });

  describe("getPaymentLabel", () => {
    it("returns label for known methods", () => {
      expect(getPaymentLabel("cash")).toBe("Cash");
      expect(getPaymentLabel("qris")).toBe("QRIS");
      expect(getPaymentLabel("tf_bca")).toBe("TF BCA");
    });
    it("returns method itself for unknown", () => {
      expect(getPaymentLabel("unknown")).toBe("unknown");
    });
  });

  describe("fmtDate", () => {
    it("formats date correctly", () => {
      const result = fmtDate("2026-07-09T14:30:00");
      expect(result).toContain("09");
      expect(result).toContain("Jul");
      expect(result).toContain("2026");
    });
  });
});
