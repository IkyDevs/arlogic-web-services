import { describe, expect, it } from "vitest";
import { computeStockDeltas } from "@/lib/domain/inventory/service";

describe("computeStockDeltas", () => {
  it("mengabaikan baris tanpa inventory_id (jasa / data legacy)", () => {
    const result = computeStockDeltas(
      [{ inventory_id: null }, {}],
      [{}, { inventory_id: undefined }],
    );
    expect(result).toEqual([]);
  });

  it("menghitung pemakaian bertambah sebagai usageDelta positif", () => {
    const deltas = computeStockDeltas(
      [],
      [
        { inventory_id: "a" },
        { inventory_id: "a" },
        { inventory_id: "b", quantity: 2 },
      ],
    );
    expect(deltas).toEqual([
      { inventoryId: "a", usageDelta: 2 },
      { inventoryId: "b", usageDelta: 2 },
    ]);
  });

  it("menghitung rollback saat baris dihapus", () => {
    const deltas = computeStockDeltas([{ inventory_id: "a" }], []);
    expect(deltas).toEqual([{ inventoryId: "a", usageDelta: -1 }]);
  });

  it("quantity dikurangi -> delta negatif sebesar selisih", () => {
    const deltas = computeStockDeltas(
      [{ inventory_id: "a", quantity: 3 }],
      [{ inventory_id: "a", quantity: 1 }],
    );
    expect(deltas).toEqual([{ inventoryId: "a", usageDelta: -2 }]);
  });

  it("net-zero (ganti item sama qty sama) tidak menghasilkan delta", () => {
    const deltas = computeStockDeltas(
      [{ inventory_id: "a" }],
      [{ inventory_id: "a" }],
    );
    expect(deltas).toEqual([]);
  });
});
