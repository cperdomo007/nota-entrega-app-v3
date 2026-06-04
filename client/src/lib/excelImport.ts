import * as XLSX from "xlsx";

export type ExcelRow = Record<string, unknown>;

function normalizeHeader(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "");
}

export async function readExcelRows(file: File): Promise<ExcelRow[]> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array", cellDates: false });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) return [];

  return XLSX.utils.sheet_to_json<ExcelRow>(sheet, {
    defval: "",
    raw: false,
  });
}

export function pickCell(row: ExcelRow, aliases: string[]) {
  const normalizedAliases = new Set(aliases.map(normalizeHeader));

  for (const [key, value] of Object.entries(row)) {
    if (normalizedAliases.has(normalizeHeader(key))) {
      return String(value ?? "").trim();
    }
  }

  return "";
}

export function toMoneyNumber(value: string) {
  const normalized = value.replace(/\s/g, "").replace(",", ".");
  const number = Number(normalized);
  return Number.isFinite(number) ? number : null;
}

export function toInteger(value: string, fallback = 0) {
  const number = Number(value.replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(number) ? Math.trunc(number) : fallback;
}

export function toBoolean(value: string) {
  const normalized = value.trim().toLowerCase();
  return ["1", "si", "sí", "s", "true", "verdadero", "yes", "y", "serial"].includes(normalized);
}

export function exportExcelRows(fileName: string, sheetName: string, rows: Record<string, unknown>[]) {
  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  XLSX.writeFile(workbook, fileName);
}
