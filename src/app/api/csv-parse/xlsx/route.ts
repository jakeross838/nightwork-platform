import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { ApiError, withApiError } from "@/lib/api/errors";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Parse an .xlsx file to `{ headers: string[], rows: {header: value}[] }`
 * for the client-side CSV importer. Reads the first worksheet, treats row 1
 * as headers, and returns subsequent non-empty rows.
 */
export const POST = withApiError(async (request: NextRequest) => {
  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) throw new ApiError("No file uploaded", 400);

  const arrayBuffer = await file.arrayBuffer();
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(arrayBuffer);
  const ws = wb.worksheets[0];
  if (!ws) throw new ApiError("Workbook has no worksheets", 400);

  const headers: string[] = [];
  const firstRow = ws.getRow(1);
  firstRow.eachCell((cell) => {
    headers.push(extractText(cell.value));
  });

  const rows: Array<Record<string, string>> = [];
  for (let r = 2; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const obj: Record<string, string> = {};
    let hasAny = false;
    headers.forEach((h, i) => {
      const cell = row.getCell(i + 1);
      const v = extractText(cell.value);
      obj[h] = v;
      if (v) hasAny = true;
    });
    if (hasAny) rows.push(obj);
  }

  return NextResponse.json({ headers, rows });
});

function extractText(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number") return String(value);
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "object") {
    const v = value as { text?: string; richText?: Array<{ text: string }>; result?: unknown };
    if (typeof v.text === "string") return v.text.trim();
    if (Array.isArray(v.richText)) return v.richText.map((r) => r.text).join("").trim();
    if (v.result !== undefined) return extractText(v.result);
  }
  return String(value).trim();
}
