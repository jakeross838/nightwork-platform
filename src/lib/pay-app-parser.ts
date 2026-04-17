/**
 * Pay-app parser for Ross Built G702/G703/PCCO workbooks.
 *
 * Reads an ExcelJS Workbook and extracts:
 *   - G702 summary (original contract, COs, completed, previous certs, etc.)
 *   - G703 line items (cost code, scheduled value, previous applications, this period)
 *   - PCCO change order log (number, description, addition, GC fee, app #)
 *
 * Returns structured data — does NOT write to DB.
 *
 * Convention: dollar amounts returned in CENTS (bigint-compatible).
 * GC fee rates returned as FRACTIONS (0.18, not 18) — matches codebase convention.
 */

import ExcelJS from "exceljs";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface PayAppG702 {
  applicationNumber: number;
  periodTo: string | null;          // ISO date or raw string
  applicationDate: string | null;
  originalContractSum: number;      // cents
  deposit: number;                  // cents
  netChangeOrders: number;          // cents
  contractSumToDate: number;        // cents
  totalCompletedStored: number;     // cents
  lessPreviousPayments: number;     // cents
  currentPaymentDue: number;        // cents
  balanceToFinish: number;          // cents
  previousCOsTotal: number;         // cents (additions from prior apps)
  currentCOsTotal: number;          // cents (additions this period)
}

export interface PayAppG703Line {
  costCode: string;                 // 5-digit, e.g. "09101"
  description: string;
  scheduledValue: number;           // cents (original estimate)
  previousApplications: number;     // cents
  thisPeriod: number;               // cents
  totalToDate: number;              // cents
  percentComplete: number;          // 0-1 decimal
  balanceToFinish: number;          // cents
}

export interface PayAppPCCO {
  pccoNumber: number;
  appNumber: number;                // which draw/app it was billed on
  description: string;
  beginningContractAmount: number;  // cents
  addition: number;                 // cents (can be 0 for fee-only lines)
  gcFeeAmount: number;              // cents (negative = credit)
  gcFeeRate: number;                // fraction (0.18, 0.15, or 0 for "No Fee")
  newContractAmount: number;        // cents
  estimatedDaysAdded: number;
  notes: string;                    // "Credit GC Fee", "No Fee", "Fee at 15%", etc.
}

export interface PayAppParseResult {
  format: "pay-app";
  g702: PayAppG702;
  g703Lines: PayAppG703Line[];
  pccoLog: PayAppPCCO[];
  warnings: string[];
}

// ---------------------------------------------------------------------------
// Cell extraction helpers
// ---------------------------------------------------------------------------

function extractText(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number") return String(value);
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "object") {
    const v = value as {
      text?: string;
      richText?: Array<{ text: string }>;
      result?: unknown;
    };
    if (typeof v.text === "string") return v.text.trim();
    if (Array.isArray(v.richText))
      return v.richText.map((r) => r.text).join("").trim();
    if (v.result !== undefined) return extractText(v.result);
  }
  return String(value).trim();
}

function extractNumber(value: unknown): number | null {
  if (value == null || value === "") return null;
  if (typeof value === "number" && isFinite(value)) return value;
  if (value instanceof Date) return null;
  if (typeof value === "object") {
    const v = value as { result?: unknown };
    if (v.result !== undefined) return extractNumber(v.result);
  }
  const s = String(value).replace(/[$,\s]/g, "");
  if (!s) return null;
  const n = Number(s);
  return isFinite(n) ? n : null;
}

function toCents(dollars: number | null): number {
  return dollars != null ? Math.round(dollars * 100) : 0;
}

function extractDate(value: unknown): string | null {
  if (value == null) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "string") {
    // Try to parse common date formats
    const d = new Date(value);
    if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
    return value.trim() || null;
  }
  if (typeof value === "object") {
    const v = value as { result?: unknown };
    if (v.result !== undefined) return extractDate(v.result);
  }
  return null;
}

function normaliseCostCode(raw: string): string | null {
  const digits = raw.replace(/[^\d]/g, "");
  if (!digits) return null;
  if (digits.length === 5) return digits;
  if (digits.length === 4) return "0" + digits;
  if (digits.length === 3) return "00" + digits;
  return null;
}

// ---------------------------------------------------------------------------
// Detection
// ---------------------------------------------------------------------------

/** Returns true if the workbook looks like a G702/G703 pay-app. */
export function isPayAppWorkbook(wb: ExcelJS.Workbook): boolean {
  const names = wb.worksheets.map((s) => s.name.toLowerCase());
  // Must have at least a G703 sheet or a sheet with "g702" or "g703" in the name.
  const hasG702 = names.some(
    (n) => n.includes("g702") || n.includes("project summary")
  );
  const hasG703 = names.some(
    (n) => n.includes("g703") || n.includes("line item") || n.includes("continuation")
  );
  return hasG702 && hasG703;
}

// ---------------------------------------------------------------------------
// G702 parser
// ---------------------------------------------------------------------------

function parseG702(sheet: ExcelJS.Worksheet, warnings: string[]): PayAppG702 {
  // The Dewberry layout puts key values in column L (12):
  //   Row 3,  Col 10 (J): Application No
  //   Row 18, Col 12 (L): Line 1 — Original Contract Sum
  //   Row 19, Col 12 (L): Deposit
  //   Row 20, Col 12 (L): Line 2 — Net Change Orders
  //   Row 21, Col 12 (L): Line 3 — Contract Sum to Date
  //   Row 22, Col 12 (L): Line 4 — Total Completed & Stored
  //   Row 24, Col 12 (L): Line 5 — Less Previous Payments
  //   Row 26, Col 12 (L): Line 6 — Current Payment Due
  //   Row 27, Col 12 (L): Line 7 — Balance to Finish
  //   Row 5,  Col 10 (J): Period To
  //   Row 7,  Col 10 (J): Application Date
  //   Row 24, Col 3  (C): Previous COs additions total
  //   Row 25, Col 3  (C): Current COs additions total

  // Scan for the "APPLICATION NO" marker to anchor the layout.
  let anchorRow = 3;
  for (let r = 1; r <= 15; r++) {
    const cell = extractText(sheet.getRow(r).getCell(9).value).toLowerCase();
    if (cell.includes("application no")) {
      anchorRow = r;
      break;
    }
  }

  const appNum = extractNumber(sheet.getRow(anchorRow).getCell(10).value) ?? 0;

  // Scan for "ORIGINAL CONTRACT SUM" to anchor the financial rows.
  let finRow = 18;
  for (let r = 15; r <= 25; r++) {
    const cell = extractText(sheet.getRow(r).getCell(7).value).toLowerCase();
    if (cell.includes("original contract sum")) {
      finRow = r;
      break;
    }
  }

  const originalContract = extractNumber(sheet.getRow(finRow).getCell(12).value);
  const deposit = extractNumber(sheet.getRow(finRow + 1).getCell(12).value);
  const netCOs = extractNumber(sheet.getRow(finRow + 2).getCell(12).value);
  const contractToDate = extractNumber(sheet.getRow(finRow + 3).getCell(12).value);
  const totalCompleted = extractNumber(sheet.getRow(finRow + 4).getCell(12).value);
  const lessPrevious = extractNumber(sheet.getRow(finRow + 6).getCell(12).value);
  const currentDue = extractNumber(sheet.getRow(finRow + 8).getCell(12).value);
  const balance = extractNumber(sheet.getRow(finRow + 9).getCell(12).value);

  // Period To + Application Date
  let periodTo: string | null = null;
  let appDate: string | null = null;
  for (let r = 1; r <= 12; r++) {
    const label = extractText(sheet.getRow(r).getCell(9).value).toLowerCase();
    if (label.includes("period to")) {
      periodTo = extractDate(sheet.getRow(r).getCell(10).value);
    }
    if (label.includes("application date")) {
      appDate = extractDate(sheet.getRow(r).getCell(10).value);
    }
  }

  // Previous + Current COs from the Change Order Summary section
  const prevCOs = extractNumber(sheet.getRow(finRow + 6).getCell(3).value);
  const currCOs = extractNumber(sheet.getRow(finRow + 7).getCell(3).value);

  if (originalContract == null) {
    warnings.push("G702: Could not read Original Contract Sum");
  }

  return {
    applicationNumber: Math.round(appNum),
    periodTo,
    applicationDate: appDate,
    originalContractSum: toCents(originalContract),
    deposit: toCents(deposit),
    netChangeOrders: toCents(netCOs),
    contractSumToDate: toCents(contractToDate),
    totalCompletedStored: toCents(totalCompleted),
    lessPreviousPayments: toCents(lessPrevious),
    currentPaymentDue: toCents(currentDue),
    balanceToFinish: toCents(balance),
    previousCOsTotal: toCents(prevCOs),
    currentCOsTotal: toCents(currCOs),
  };
}

// ---------------------------------------------------------------------------
// G703 parser
// ---------------------------------------------------------------------------

function parseG703(sheet: ExcelJS.Worksheet, warnings: string[]): PayAppG703Line[] {
  // Multi-page layout: data rows have a 5-digit cost code in column A.
  // Page breaks have "Total This Page" in column B, headers repeat after.
  // Column layout: A=code, B=description, C=original estimate,
  //   D=previous applications, E=this period, F=total to date,
  //   G=% complete, H=balance to finish, I=proposal amount, J=balance in contract

  const lines: PayAppG703Line[] = [];
  const seen = new Set<string>();

  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    const colA = extractText(row.getCell(1).value);

    // Skip header/page-break/total rows
    const lower = colA.toLowerCase();
    if (
      !colA ||
      lower === "a" ||
      lower === "item" ||
      lower === "no." ||
      lower.includes("project") ||
      lower.includes("address") ||
      lower.includes("continuation") ||
      lower.includes("document") ||
      lower.includes("contractor") ||
      lower.includes("tabulation") ||
      lower.includes("page") ||
      lower.includes("cost breakdown")
    ) {
      return;
    }

    const colB = extractText(row.getCell(2).value).toLowerCase();
    if (colB.includes("total this page") || colB.includes("grand total")) {
      return;
    }

    const code = normaliseCostCode(colA);
    if (!code) return;

    // Deduplicate (multi-page sheets sometimes repeat headers near a code)
    if (seen.has(code)) {
      warnings.push(`G703 row ${rowNumber}: duplicate cost code ${code}, skipped`);
      return;
    }
    seen.add(code);

    const description = extractText(row.getCell(2).value);
    const scheduledVal = extractNumber(row.getCell(3).value);
    const prevApps = extractNumber(row.getCell(4).value);
    const thisPeriod = extractNumber(row.getCell(5).value);
    // Column F (total to date) is often a formula — try to read its result.
    const totalToDate = extractNumber(row.getCell(6).value);
    const pctComplete = extractNumber(row.getCell(7).value);
    const balToFinish = extractNumber(row.getCell(8).value);

    lines.push({
      costCode: code,
      description,
      scheduledValue: toCents(scheduledVal),
      previousApplications: toCents(prevApps),
      thisPeriod: toCents(thisPeriod),
      totalToDate: toCents(totalToDate),
      percentComplete: pctComplete ?? 0,
      balanceToFinish: toCents(balToFinish),
    });
  });

  if (lines.length === 0) {
    warnings.push("G703: No line items found");
  }

  return lines;
}

// ---------------------------------------------------------------------------
// PCCO parser
// ---------------------------------------------------------------------------

function parsePCCO(sheet: ExcelJS.Worksheet, warnings: string[]): PayAppPCCO[] {
  // Layout:
  //   Row 7: headers (PCCO #, App #, DESCRIPTION, BEGINNING..., ADDITION..., GC FEE..., NEW..., EST DAYS)
  //   Row 8: default GC fee rate in col 6 (e.g. 0.18)
  //   Data rows start at 9
  //   Totals rows have "TOTAL" in col 3

  // Read default GC fee rate from row 8, col 6
  let defaultGcRate = 0.18;
  for (let r = 7; r <= 12; r++) {
    const val = extractNumber(sheet.getRow(r).getCell(6).value);
    if (val != null && val > 0 && val < 1) {
      defaultGcRate = val;
      break;
    }
  }

  const entries: PayAppPCCO[] = [];

  sheet.eachRow({ includeEmpty: false }, (row, _rowNumber) => {
    const col1 = extractText(row.getCell(1).value);
    const pccoNum = extractNumber(col1);

    // Skip header, blank, and total rows
    if (pccoNum == null || pccoNum <= 0) return;
    const desc = extractText(row.getCell(3).value).toLowerCase();
    if (desc.includes("total change")) return;

    const appNum = extractNumber(row.getCell(2).value) ?? 0;
    const description = extractText(row.getCell(3).value);
    const beginAmount = extractNumber(row.getCell(4).value);
    const addition = extractNumber(row.getCell(5).value);
    const gcFeeRaw = extractNumber(row.getCell(6).value);
    const newAmount = extractNumber(row.getCell(7).value);
    const daysAdded = extractNumber(row.getCell(8).value) ?? 0;
    const notes = extractText(row.getCell(9).value);

    // Determine GC fee rate for this line:
    // - "No Fee" or "Credit GC Fee" notes → rate = 0
    // - "Fee at 15%" → rate = 0.15
    // - Otherwise → derive from addition and gcFeeAmount, fallback to default
    const notesLower = notes.toLowerCase();
    let gcFeeRate: number;
    if (notesLower.includes("no fee") || notesLower.includes("credit gc fee")) {
      gcFeeRate = 0;
    } else if (notesLower.includes("fee at")) {
      // Parse "Fee at 15%" → 0.15
      const match = notesLower.match(/fee at\s*(\d+(?:\.\d+)?)\s*%/);
      gcFeeRate = match ? Number(match[1]) / 100 : defaultGcRate;
    } else if (addition && gcFeeRaw && addition !== 0) {
      // Derive: gcFeeRate = abs(gcFeeAmount / addition)
      gcFeeRate = Math.abs((gcFeeRaw ?? 0) / (addition ?? 1));
      // Snap to common rates if close
      if (Math.abs(gcFeeRate - 0.18) < 0.005) gcFeeRate = 0.18;
      if (Math.abs(gcFeeRate - 0.15) < 0.005) gcFeeRate = 0.15;
      if (Math.abs(gcFeeRate - 0.20) < 0.005) gcFeeRate = 0.20;
    } else {
      gcFeeRate = defaultGcRate;
    }

    entries.push({
      pccoNumber: Math.round(pccoNum),
      appNumber: Math.round(appNum),
      description,
      beginningContractAmount: toCents(beginAmount),
      addition: toCents(addition),
      gcFeeAmount: toCents(gcFeeRaw),
      gcFeeRate,  // fraction convention (0.18, not 18)
      newContractAmount: toCents(newAmount),
      estimatedDaysAdded: Math.round(daysAdded),
      notes,
    });
  });

  if (entries.length === 0) {
    warnings.push("PCCO: No change order entries found");
  }

  return entries;
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

export function parsePayApp(wb: ExcelJS.Workbook): PayAppParseResult {
  const warnings: string[] = [];

  // Find sheets by name pattern
  const g702Sheet = wb.worksheets.find((s) => {
    const n = s.name.toLowerCase();
    return n.includes("g702") || n.includes("project summary");
  });
  const g703Sheet = wb.worksheets.find((s) => {
    const n = s.name.toLowerCase();
    return n.includes("g703") || n.includes("line item") || n.includes("continuation");
  });
  const pccoSheet = wb.worksheets.find((s) => {
    const n = s.name.toLowerCase();
    return n.includes("pcco") || n.includes("change order log");
  });

  if (!g702Sheet) {
    warnings.push("No G702 (Project Summary) sheet found");
  }
  if (!g703Sheet) {
    warnings.push("No G703 (Line Item Estimate) sheet found — cannot import budget");
  }

  const g702 = g702Sheet
    ? parseG702(g702Sheet, warnings)
    : {
        applicationNumber: 0,
        periodTo: null,
        applicationDate: null,
        originalContractSum: 0,
        deposit: 0,
        netChangeOrders: 0,
        contractSumToDate: 0,
        totalCompletedStored: 0,
        lessPreviousPayments: 0,
        currentPaymentDue: 0,
        balanceToFinish: 0,
        previousCOsTotal: 0,
        currentCOsTotal: 0,
      };

  const g703Lines = g703Sheet ? parseG703(g703Sheet, warnings) : [];
  const pccoLog = pccoSheet ? parsePCCO(pccoSheet, warnings) : [];

  // Cross-check: G702 net COs should approximately equal sum of PCCO additions + fees
  if (pccoLog.length > 0 && g702.netChangeOrders !== 0) {
    const pccoTotal = pccoLog.reduce(
      (s, co) => s + co.addition + co.gcFeeAmount,
      0
    );
    const diff = Math.abs(g702.netChangeOrders - pccoTotal);
    if (diff > 100) {
      // More than $1 off
      warnings.push(
        `Cross-check: G702 net COs ($${(g702.netChangeOrders / 100).toFixed(2)}) differs from ` +
          `PCCO sum ($${(pccoTotal / 100).toFixed(2)}) by $${(diff / 100).toFixed(2)}`
      );
    }
  }

  return { format: "pay-app", g702, g703Lines, pccoLog, warnings };
}
