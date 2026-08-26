import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import type { SupabaseClient } from "@supabase/supabase-js";
import { detectFormat, parseStockFile } from "@/lib/domain/inventory/importFile";
import {
  autoMapColumns,
  buildMappedRows,
  calculateImpact,
  columnMapToFieldMapping,
  fieldMappingToColumnMap,
  validateFieldMapping,
  validateRows,
  type FieldMapping,
  type ParsedTable,
} from "@/lib/domain/inventory/import";
import {
  applyStoreStockImport,
  type StoreStockImportLine,
} from "@/lib/domain/inventory/service";

describe("detectFormat (multi-format parser)", () => {
  it("menerima csv/xlsx/xls", () => {
    expect(detectFormat("a.csv")).toBe("csv");
    expect(detectFormat("b.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")).toBe("xlsx");
    expect(detectFormat("c.XLS")).toBe("xls");
  });
  it("menolak format tidak didukung", () => {
    expect(detectFormat("d.pdf")).toBeNull();
    expect(detectFormat("e.txt")).toBeNull();
    expect(detectFormat("f.json")).toBeNull();
    expect(detectFormat("g.png", "image/png")).toBeNull();
  });
});

describe("parseStockFile", () => {
  it("parsing CSV → tabel ternormalisasi", async () => {
    const file = new File(
      ["produkSku,namaProduk,jumlahStock\nSP001,Battery,25\n"],
      "stok.csv",
      { type: "text/csv" },
    );
    const { table, sheetNames } = await parseStockFile(file, "csv");
    expect(sheetNames).toHaveLength(1);
    expect(table.headers).toEqual(["produkSku", "namaProduk", "jumlahStock"]);
    expect(table.rows).toHaveLength(1);
    expect(table.rows[0]["produkSku"]).toBe("SP001");
    expect(Number(table.rows[0]["jumlahStock"])).toBe(25);
  });

  it("XLSX multiple sheet: default sheet pertama, bisa pilih sheet lain", async () => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.aoa_to_sheet([
        ["produkSku", "jumlahStock"],
        ["SP001", 20],
      ]),
      "Sparepart",
    );
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.aoa_to_sheet([
        ["kodeJam", "stokJam"],
        ["J001", 5],
      ]),
      "Jam",
    );
    const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" });
    const file = new File([buf], "multi.xlsx");

    const r1 = await parseStockFile(file, "xlsx");
    expect(r1.sheetNames).toEqual(["Sparepart", "Jam"]);
    expect(r1.table.headers).toEqual(["produkSku", "jumlahStock"]);

    const r2 = await parseStockFile(file, "xlsx", "Jam");
    expect(r2.table.headers).toEqual(["kodeJam", "stokJam"]);
    expect(String(r2.table.rows[0]["kodeJam"])).toBe("J001");
  });

  it("file rusak → ditolak dengan pesan jelas", async () => {
    const file = new File([new Uint8Array([1, 2, 3, 4])], "rusak.xlsx");
    await expect(parseStockFile(file, "xlsx")).rejects.toThrow(
      /rusak|valid/i,
    );
  });
});

describe("validateRows (baris invalid & duplikat)", () => {
  const table: ParsedTable = {
    headers: ["produkSku", "namaProduk", "jumlahStock", "catatan"],
    rows: [
      { produkSku: "SP001", namaProduk: "Battery", jumlahStock: 25, catatan: "x" },
      { produkSku: "", namaProduk: "Tanpa SKU", jumlahStock: 3, catatan: "" },
      { produkSku: "SP002", namaProduk: "Gasket", jumlahStock: "abc", catatan: "" },
      { produkSku: "sp001", namaProduk: "Battery", jumlahStock: 25, catatan: "" },
    ],
  };

  it("auto-mapping kolom umum; sisanya ignore", () => {
    const map = autoMapColumns(table.headers);
    expect(map["produkSku"]).toBe("sku");
    expect(map["namaProduk"]).toBe("name");
    expect(map["jumlahStock"]).toBe("quantity");
    expect(map["catatan"]).toBe("ignore");
  });

  it("validasi: qty bukan angka, sku kosong, SKU duplikat (case-insensitive)", () => {
    const map = autoMapColumns(table.headers);
    const res = validateRows(table, map);
    expect(res.valid).toHaveLength(1);
    expect(res.valid[0]).toMatchObject({ sku: "SP001", quantity: 25 });
    expect(res.duplicateCount).toBe(1);
    expect(res.skippedEmpty).toBe(0);
    expect(res.errors.some((e) => e.error === "Quantity bukan angka")).toBe(true);
    expect(res.errors.some((e) => e.error === "SKU kosong")).toBe(true);
    expect(res.errors.some((e) => e.error === "SKU duplikat dalam file")).toBe(true);
  });

  it("mapping wajib hilang -> error jelas", () => {
    const res = validateRows(table, { produkSku: "ignore", namaProduk: "name", jumlahStock: "quantity", catatan: "ignore" });
    expect(res.errors[0].error).toContain("Mapping SKU");
  });

  it("baris kosong total diabaikan, bukan error", () => {
    const t: ParsedTable = {
      headers: ["sku", "qty"],
      rows: [{ sku: "", qty: "" }, { sku: "SP001", qty: 5 }],
    };
    const res = validateRows(t, { sku: "sku", qty: "quantity" });
    expect(res.valid).toHaveLength(1);
    expect(res.errors).toHaveLength(0);
    expect(res.skippedEmpty).toBe(1);
  });
});

describe("calculateImpact (delta = imported - current)", () => {
  it("20->25=+5, 15->10=-5, 10->10=0, sku tak dikenal -> notFound", () => {
    const current = new Map([["SP001", 20], ["SP002", 15], ["SP003", 10]]);
    const impact = calculateImpact(
      [
        { rowNumber: 2, sku: "SP001", quantity: 25 },
        { rowNumber: 3, sku: "SP002", quantity: 10 },
        { rowNumber: 4, sku: "SP003", quantity: 10 },
        { rowNumber: 5, sku: "SP999", quantity: 4 },
      ],
      current,
    );
    expect(impact.lines.map((l) => l.delta)).toEqual([5, -5, 0]);
    expect(impact.increase).toBe(1);
    expect(impact.decrease).toBe(1);
    expect(impact.noChange).toBe(1);
    expect(impact.notFound).toEqual([{ sku: "SP999", quantity: 4 }]);
  });

  it("kasus spesifik +5, -5, 0 sesuai requirement", () => {
    const current = new Map([["SP001", 20], ["SP002", 15], ["SP003", 8]]);
    const impact = calculateImpact(
      [
        { rowNumber: 2, sku: "SP001", quantity: 25 },
        { rowNumber: 3, sku: "SP002", quantity: 10 },
        { rowNumber: 4, sku: "SP003", quantity: 8 },
      ],
      current,
    );
    expect(impact.lines).toEqual([
      { sku: "SP001", current: 20, imported: 25, delta: 5 },
      { sku: "SP002", current: 15, imported: 10, delta: -5 },
      { sku: "SP003", current: 8, imported: 8, delta: 0 },
    ]);
  });
});

describe("model mapping System Field ← Kolom File", () => {
  const table: ParsedTable = {
    headers: ["produkSku", "namaProduk", "jumlahStock", "hargaJual", "catatan"],
    rows: [
      { produkSku: "SP001", namaProduk: "Battery", jumlahStock: 25, hargaJual: 15000, catatan: "x" },
      { produkSku: "SP002", namaProduk: "Gasket", jumlahStock: 10, hargaJual: "", catatan: "" },
    ],
  };

  it("field → kolom; required wajib; optional boleh kosong", () => {
    const mapping: FieldMapping = { sku: "produkSku", quantity: "jumlahStock" };
    expect(validateFieldMapping(table, mapping)).toEqual({ ok: true });

    const tanpaQty = validateFieldMapping(table, { sku: "produkSku" });
    expect(tanpaQty.ok).toBe(false);
    expect(tanpaQty.error).toContain("Quantity");

    const tanpaSku = validateFieldMapping(table, { quantity: "jumlahStock" });
    expect(tanpaSku.ok).toBe(false);
    expect(tanpaSku.error).toContain("SKU");
  });

  it("satu kolom file tidak boleh ke dua system field", () => {
    const res = validateFieldMapping(table, {
      sku: "produkSku",
      name: "produkSku",
      quantity: "jumlahStock",
    });
    expect(res.ok).toBe(false);
    expect(res.error).toContain("dua field");
  });

  it("kolom yang tak dipetakan (unused) tidak masuk payload", () => {
    const mapping: FieldMapping = { sku: "produkSku", quantity: "jumlahStock" };
    const colMap = fieldMappingToColumnMap(mapping);
    // hargaJual & catatan sengaja tidak dipetakan
    expect(colMap).toEqual({ produkSku: "sku", jumlahStock: "quantity" });

    const res = buildMappedRows(table, mapping);
    expect(res.valid).toHaveLength(2);
    expect(res.valid.map((r) => r.sku)).toEqual(["SP001", "SP002"]);
    // payload hanya berisi sku/name/quantity — tidak ada kolom file lain
    expect(Object.keys(res.valid[0]).sort()).toEqual(["name", "quantity", "rowNumber", "sku"]);
  });

  it("auto-map hanya suggestion; override admin diikuti payload", () => {
    const suggestion = columnMapToFieldMapping(autoMapColumns(table.headers));
    expect(suggestion).toMatchObject({
      sku: "produkSku",
      name: "namaProduk",
      quantity: "jumlahStock",
    });

    const overridden: FieldMapping = { ...suggestion, sku: "catatan", name: undefined };
    const res = buildMappedRows(
      {
        headers: table.headers,
        rows: table.rows.map((r, i) => ({ ...r, catatan: `ALT-${i + 1}` })),
      },
      overridden,
    );
    expect(res.valid.map((r) => r.sku)).toEqual(["ALT-1", "ALT-2"]);
  });

  it("supplier selalu diabaikan (opsi 1) meski dipetakan", () => {
    const colMap = fieldMappingToColumnMap({
      sku: "produkSku",
      quantity: "jumlahStock",
      supplier: "namaSupplier",
    });
    expect(Object.values(colMap)).not.toContain("namaSupplier");
    expect(colMap["namaSupplier"]).toBeUndefined();
  });
});

describe("raw error & baris instruksi template (fix audit)", () => {
  const mapping = { produkSku: "sku", jumlahStock: "quantity" } as Record<string, "sku" | "quantity">;

  it("error qty membawa nilai mentah cell penyebab", () => {
    const res = validateRows(
      { headers: ["produkSku", "jumlahStock"], rows: [{ produkSku: "SP002", jumlahStock: "abc" }] },
      mapping,
    );
    expect(res.valid).toHaveLength(0);
    expect(res.errors[0].raw).toEqual({ sku: "SP002", quantity: "abc" });
    expect(res.errors[0].error).toBe("Quantity bukan angka");
  });

  it("baris instruksi template (struktur nyata DATA_BARANG) terdeteksi & diberi pesan jelas", () => {
    const res = validateRows(
      {
        headers: ["KODE", "NAMA BARANG", "STOK"],
        rows: [
          {
            KODE: "Data Kolom ini jangan di edit dan tidak boleh kosong.",
            "NAMA BARANG": "Data dapat diubah maksimal 80 karakter.",
            STOK: "Jangan ubah data stok ini Perubahan data stok diabaikan.",
          },
          { KODE: "401020SW", "NAMA BARANG": "Baterai smartwatch", STOK: 2 },
        ],
      },
      { KODE: "sku", "NAMA BARANG": "name", STOK: "quantity" },
    );
    expect(res.valid).toHaveLength(1);
    const tpl = res.errors[0];
    expect(tpl.isTemplateRow).toBe(true);
    expect(tpl.error).toContain("instruksi template");
    expect(tpl.raw?.sku).toContain("jangan di edit");
  });

  it("'1.000' / '1,000' DITOLAK — tidak dikonversi diam-diam menjadi 1", () => {
    const res = validateRows(
      {
        headers: ["sku", "qty"],
        rows: [
          { sku: "SP-A", qty: "1.000" },
          { sku: "SP-B", qty: "1,000" },
          { sku: "SP-C", qty: "7" },
        ],
      },
      { sku: "sku", qty: "quantity" },
    );
    // Tidak ada silent corruption: SP-A tidak masuk valid sbg qty=1
    expect(res.valid.map((r) => r.sku)).toEqual(["SP-C"]);
    expect(res.valid[0].quantity).toBe(7);
    const sepErrors = res.errors.filter((e) => e.error.includes("ambigu"));
    expect(sepErrors).toHaveLength(2);
    expect(sepErrors[0].raw?.quantity).toBe("1.000");
  });

  it("qty kosong, strip '-', dan desimal tetap ditolak dengan pesan spesifik", () => {
    const res = validateRows(
      {
        headers: ["sku", "qty"],
        rows: [
          { sku: "SP-D", qty: "" },
          { sku: "SP-E", qty: "-" },
          { sku: "SP-F", qty: 2.5 },
        ],
      },
      { sku: "sku", qty: "quantity" },
    );
    expect(res.errors.map((e) => e.error)).toEqual([
      "Quantity kosong",
      "Quantity bukan angka",
      "Quantity harus bilangan >= 0",
    ]);
    // teks pendek '-' BUKAN template
    expect(res.errors.every((e) => !e.isTemplateRow)).toBe(true);
  });
});

// ─── applyStoreStockImport (mock SupabaseClient.rpc) ────────────────

interface RpcCall {
  fn: string;
  args: Record<string, unknown>;
}

function fakeSupabase(script: Array<Error | null>, calls: RpcCall[]): SupabaseClient {
  let i = 0;
  return {
    rpc: async (fn: string, args?: Record<string, unknown>) => {
      calls.push({ fn, args: args ?? {} });
      const step = script[i++] ?? null;
      return { data: null, error: step };
    },
  } as unknown as SupabaseClient;
}

describe("applyStoreStockImport", () => {
  const branchId = "branch-1";
  const lines: StoreStockImportLine[] = [
    { inventoryId: "inv-a", sku: "SP001", delta: 5 },
    { inventoryId: "inv-b", sku: "SP002", delta: -5 },
    { inventoryId: "inv-c", sku: "SP003", delta: 3 },
  ];

  it("sukses: semua delta diterapkan via adjust_store_stock dengan branch terkunci", async () => {
    const calls: RpcCall[] = [];
    const result = await applyStoreStockImport(
      fakeSupabase([null, null, null], calls),
      lines,
      { branchId },
    );
    expect(result.status).toBe("success");
    expect(result.appliedCount).toBe(3);
    expect(calls).toHaveLength(3);
    expect(calls.every((c) => c.fn === "adjust_store_stock")).toBe(true);
    expect(calls[0].args["p_branch_id"]).toBe(branchId);
    expect(calls[0].args["p_delta"]).toBe(5);
    expect(calls[1].args["p_delta"]).toBe(-5);
    expect(calls.every((c) => c.args["p_source"] === "adjustment")).toBe(true);
  });

  it("gagal di tengah: berhenti + kompensasi baris yang sudah terpasang (LIFO)", async () => {
    const calls: RpcCall[] = [];
    const result = await applyStoreStockImport(
      fakeSupabase([null, new Error("INSUFFICIENT_STOCK: sisa stok 2"), null, null], calls),
      lines,
      { branchId },
    );
    expect(result.status).toBe("failed");
    expect(result.failure?.sku).toBe("SP002");
    expect(result.appliedCount).toBe(1);
    expect(result.compensatedCount).toBe(1);
    // urutan rpc: apply A(+5), apply B(fail), kompensasi A(-5)
    expect(calls).toHaveLength(3);
    expect(calls[2].args["p_inventory_id"]).toBe("inv-a");
    expect(calls[2].args["p_delta"]).toBe(-5);
  });

  it("kompensasi ikut gagal → status partial + daftar eksplisit", async () => {
    const calls: RpcCall[] = [];
    const result = await applyStoreStockImport(
      fakeSupabase(
        [null, null, new Error("FORBIDDEN_BRANCH"), new Error("boom")],
        calls,
      ),
      lines,
      { branchId },
    );
    expect(result.status).toBe("partial");
    expect(result.failure?.sku).toBe("SP003");
    // LIFO: SP002 dikompensasi duluan dan gagal; SP001 sukses dikompensasi
    expect(result.compensatedCount).toBe(1);
    expect(result.compensationFailed).toHaveLength(1);
    expect(result.compensationFailed[0].sku).toBe("SP002");
    expect(calls).toHaveLength(5);
  });

  it("onProgress terpanggil per baris berhasil", async () => {
    const progress: Array<[number, number]> = [];
    await applyStoreStockImport(fakeSupabase([null, null], []), lines.slice(0, 2), {
      branchId,
      onProgress: (applied, total) => progress.push([applied, total]),
    });
    expect(progress).toEqual([[1, 2], [2, 2]]);
  });

  it("tidak ada mutation saat delta 0 saja (pre-confirm safety)", async () => {
    const calls: RpcCall[] = [];
    const result = await applyStoreStockImport(
      fakeSupabase([], calls),
      [{ inventoryId: "inv-x", sku: "SPX", delta: 0 }],
      { branchId },
    );
    expect(result.status).toBe("success");
    expect(result.appliedCount).toBe(0);
    expect(calls).toHaveLength(0);
  });
});
