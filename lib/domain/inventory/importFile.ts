import * as XLSX from "xlsx";
import type { ParsedTable } from "./import";

// ─── Multi-format file parser -> normalized ParsedTable ────────────
// Format didukung: csv, xlsx, xls. Format lain DITOLAK.
// Parser hanya mengubah file menjadi data terstruktur; tanpa logika stok.

export type SupportedFormat = "csv" | "xlsx" | "xls";

export function detectFormat(
  filename: string,
  mimeType?: string,
): SupportedFormat | null {
  const ext = filename.toLowerCase().split(".").pop() ?? "";
  if (ext === "csv" || mimeType === "text/csv") return "csv";
  if (ext === "xlsx") return "xlsx";
  if (ext === "xls") return "xls";
  return null;
}

export interface WorkbookSheetInfo {
  names: string[];
}

export async function parseStockFile(
  file: File,
  format: SupportedFormat,
  sheetName?: string,
): Promise<{ table: ParsedTable; sheetNames: string[] }> {
  const buf = await file.arrayBuffer();

  // Jangan percaya ekstensi: xlsx wajib ZIP (PK), xls wajib ZIP atau OLE2.
  // Tanpa ini XLSX.read diam-diam mem-parsing byte acak sbg teks → sheet kosong.
  const sig = new Uint8Array(buf.slice(0, 4));
  const isZip = sig[0] === 0x50 && sig[1] === 0x4b && sig[2] === 0x03 && sig[3] === 0x04;
  const isOle2 =
    sig[0] === 0xd0 && sig[1] === 0xcf && sig[2] === 0x11 && sig[3] === 0xe0;
  if (
    (format === "xlsx" && !isZip) ||
    (format === "xls" && !isZip && !isOle2)
  ) {
    throw new Error("File rusak atau bukan spreadsheet yang valid");
  }

  let wb: XLSX.WorkBook;
  try {
    wb = XLSX.read(buf, { type: "array", raw: false });
  } catch {
    throw new Error("File rusak atau bukan spreadsheet yang valid");
  }

  const sheetNames = wb.SheetNames;
  if (sheetNames.length === 0) throw new Error("File kosong (tidak ada sheet)");

  let target = sheetName && sheetNames.includes(sheetName)
    ? sheetName
    : sheetNames[0];

  // CSV dibaca XLSX sebagai satu sheet; abaikan pilihan sheet
  if (format === "csv" && sheetNames.length > 1) target = sheetNames[0];

  const ws = wb.Sheets[target];
  const rows = XLSX.utils.sheet_to_json<Record<string, string | number>>(ws, {
    defval: "",
  });

  if (rows.length === 0) {
    // ambil headers saja bila ada baris header tanpa data
    const ref = ws["!ref"];
    if (!ref) throw new Error("File kosong");
  }

  const headers =
    rows.length > 0
      ? Object.keys(rows[0])
      : [];
  return { table: { headers, rows }, sheetNames };
}
