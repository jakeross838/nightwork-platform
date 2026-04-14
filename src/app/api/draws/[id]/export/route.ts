import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import ExcelJS from "exceljs";

const ORG_CONTRACTOR_NAME = "ROSS BUILT, LLC";
const ORG_CONTRACTOR_ADDR1 = "305 67th Street West";
const ORG_CONTRACTOR_ADDR2 = "Bradenton, FL 34209";
const ORG_SIGNATORY = "Jake Ross";

// Colors
const NAVY = "1F3864";
const LIGHT_BLUE_BG = "D6E4F0";
const LIGHT_GRAY_BG = "F2F2F2";
const WHITE = "FFFFFF";
const BLACK = "000000";
const HEADER_GOLD = "C5A55A";

// Fonts
const FONT_TITLE: Partial<ExcelJS.Font> = { name: "Calibri", size: 14, bold: true, color: { argb: NAVY } };
const FONT_SUBTITLE: Partial<ExcelJS.Font> = { name: "Calibri", size: 11, bold: true, color: { argb: NAVY } };
const FONT_LABEL: Partial<ExcelJS.Font> = { name: "Calibri", size: 10, bold: true };
const FONT_VALUE: Partial<ExcelJS.Font> = { name: "Calibri", size: 10 };
const FONT_HEADER: Partial<ExcelJS.Font> = { name: "Calibri", size: 9, bold: true, color: { argb: WHITE } };
const FONT_BODY: Partial<ExcelJS.Font> = { name: "Calibri", size: 9 };
const FONT_TOTAL: Partial<ExcelJS.Font> = { name: "Calibri", size: 9, bold: true };
const FONT_GRAND_TOTAL: Partial<ExcelJS.Font> = { name: "Calibri", size: 10, bold: true, color: { argb: NAVY } };

const CURRENCY_FMT = '"$"#,##0.00';
const PERCENT_FMT = "0.0%";

const THIN_BORDER: Partial<ExcelJS.Border> = { style: "thin", color: { argb: "BFBFBF" } };
const THIN_BORDERS: Partial<ExcelJS.Borders> = { top: THIN_BORDER, bottom: THIN_BORDER, left: THIN_BORDER, right: THIN_BORDER };

interface BudgetLineRow {
  id: string;
  cost_code_id: string;
  original_estimate: number;
  revised_estimate: number;
  previous_applications_baseline: number;
  cost_codes: { code: string; description: string; category: string; sort_order: number };
}

function centsToExcel(cents: number): number {
  return cents / 100;
}

function formatDateStr(d: string | null): string {
  if (!d) return "";
  const dt = new Date(d + "T00:00:00");
  return dt.toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "numeric" });
}

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createServerClient();

    // ── Fetch draw ──
    const { data: draw, error } = await supabase
      .from("draws")
      .select(`*, jobs:job_id (id, name, address, client_name, client_email, deposit_percentage, gc_fee_percentage, original_contract_amount)`)
      .eq("id", params.id)
      .is("deleted_at", null)
      .single();

    if (error || !draw) {
      return NextResponse.json({ error: "Draw not found" }, { status: 404 });
    }

    // ── Fetch invoices ──
    const { data: invoices } = await supabase
      .from("invoices")
      .select("id, vendor_name_raw, invoice_number, total_amount, cost_code_id")
      .eq("draw_id", params.id)
      .is("deleted_at", null);

    // ── Fetch budget lines ──
    const { data: fetchedBudgetLines } = await supabase
      .from("budget_lines")
      .select(`
        id, cost_code_id, original_estimate, revised_estimate, previous_applications_baseline,
        cost_codes:cost_code_id (code, description, category, sort_order)
      `)
      .eq("job_id", draw.job_id)
      .is("deleted_at", null);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const allBudgetLines: BudgetLineRow[] = ((fetchedBudgetLines ?? []) as any[]).map(bl => ({
      ...bl,
      cost_codes: Array.isArray(bl.cost_codes) ? bl.cost_codes[0] : bl.cost_codes,
    }));

    // ── Fetch change orders ──
    const { data: changeOrders } = await supabase
      .from("change_orders")
      .select("*")
      .eq("job_id", draw.job_id)
      .eq("status", "executed")
      .is("deleted_at", null)
      .order("pcco_number", { ascending: true });

    // ── Compute G703 line items ──
    const thisPeriodByCostCode = new Map<string, number>();
    for (const inv of invoices ?? []) {
      if (inv.cost_code_id) {
        thisPeriodByCostCode.set(inv.cost_code_id, (thisPeriodByCostCode.get(inv.cost_code_id) ?? 0) + inv.total_amount);
      }
    }

    const g703Lines = allBudgetLines
      .map(bl => {
        const thisPeriod = thisPeriodByCostCode.get(bl.cost_code_id) ?? 0;
        const baseline = bl.previous_applications_baseline ?? 0;
        const previousApplications = baseline;
        const totalToDate = previousApplications + thisPeriod;
        const percentComplete = bl.revised_estimate > 0
          ? totalToDate / bl.revised_estimate
          : (totalToDate > 0 ? 1 : 0);
        const balanceToFinish = bl.revised_estimate - totalToDate;
        return {
          code: bl.cost_codes.code,
          description: bl.cost_codes.description,
          sort_order: bl.cost_codes.sort_order,
          original_estimate: bl.original_estimate,
          revised_estimate: bl.revised_estimate,
          previous_applications: previousApplications,
          this_period: thisPeriod,
          total_to_date: totalToDate,
          percent_complete: percentComplete,
          balance_to_finish: balanceToFinish,
        };
      })
      .filter(r => r.original_estimate > 0 || r.revised_estimate > 0 || r.previous_applications > 0 || r.this_period > 0)
      .sort((a, b) => a.sort_order - b.sort_order);

    // ── Build workbook ──
    const wb = new ExcelJS.Workbook();
    wb.creator = "Ross Command Center";
    wb.created = new Date();

    const job = draw.jobs;
    const jobName = job?.name ?? "Unknown";
    const drawNum = draw.draw_number;

    // ═══════════════════════════════════════════════
    // SHEET 1: G702 — Application for Payment
    // ═══════════════════════════════════════════════
    const ws1 = wb.addWorksheet("Project Summary (G702)", {
      pageSetup: { paperSize: 1 as unknown as ExcelJS.PaperSize, orientation: "portrait", fitToPage: true, fitToWidth: 1, fitToHeight: 1, margins: { left: 0.5, right: 0.5, top: 0.5, bottom: 0.5, header: 0.3, footer: 0.3 } },
    });

    ws1.columns = [
      { width: 3 },   // A — spacer
      { width: 20 },  // B
      { width: 18 },  // C
      { width: 18 },  // D
      { width: 3 },   // E — spacer
      { width: 20 },  // F
      { width: 18 },  // G
      { width: 18 },  // H
    ];

    // Title row
    let r = 1;
    ws1.mergeCells(`B${r}:D${r}`);
    ws1.getCell(`B${r}`).value = "APPLICATION AND CERTIFICATE FOR PAYMENT";
    ws1.getCell(`B${r}`).font = FONT_TITLE;
    ws1.mergeCells(`F${r}:H${r}`);
    ws1.getCell(`F${r}`).value = "AIA DOCUMENT G702";
    ws1.getCell(`F${r}`).font = { ...FONT_SUBTITLE, size: 12 };
    ws1.getCell(`F${r}`).alignment = { horizontal: "right" };

    // Gold accent line
    r = 2;
    for (const col of ["B", "C", "D", "E", "F", "G", "H"]) {
      ws1.getCell(`${col}${r}`).border = { bottom: { style: "medium", color: { argb: HEADER_GOLD } } };
    }
    ws1.getRow(r).height = 6;

    // ── Info blocks ──
    r = 4;
    // Left block: TO OWNER
    ws1.getCell(`B${r}`).value = "TO OWNER:";
    ws1.getCell(`B${r}`).font = FONT_LABEL;
    ws1.getCell(`C${r}`).value = job?.client_name ?? "";
    ws1.getCell(`C${r}`).font = FONT_VALUE;
    r++;
    ws1.getCell(`C${r}`).value = job?.address ?? "";
    ws1.getCell(`C${r}`).font = FONT_VALUE;

    // Right block: APPLICATION NO / PERIOD TO / DATE
    r = 4;
    ws1.getCell(`F${r}`).value = "APPLICATION NO:";
    ws1.getCell(`F${r}`).font = FONT_LABEL;
    ws1.getCell(`G${r}`).value = drawNum;
    ws1.getCell(`G${r}`).font = FONT_VALUE;
    r++;
    ws1.getCell(`F${r}`).value = "PERIOD TO:";
    ws1.getCell(`F${r}`).font = FONT_LABEL;
    ws1.getCell(`G${r}`).value = formatDateStr(draw.period_end);
    ws1.getCell(`G${r}`).font = FONT_VALUE;
    r++;
    ws1.getCell(`F${r}`).value = "APPLICATION DATE:";
    ws1.getCell(`F${r}`).font = FONT_LABEL;
    ws1.getCell(`G${r}`).value = formatDateStr(draw.application_date);
    ws1.getCell(`G${r}`).font = FONT_VALUE;

    r = 7;
    ws1.getCell(`B${r}`).value = "PROJECT:";
    ws1.getCell(`B${r}`).font = FONT_LABEL;
    ws1.getCell(`C${r}`).value = `${jobName} Residence`;
    ws1.getCell(`C${r}`).font = FONT_VALUE;
    r++;
    ws1.getCell(`C${r}`).value = job?.address ?? "";
    ws1.getCell(`C${r}`).font = FONT_VALUE;

    r = 10;
    ws1.getCell(`B${r}`).value = "FROM CONTRACTOR:";
    ws1.getCell(`B${r}`).font = FONT_LABEL;
    ws1.getCell(`C${r}`).value = ORG_CONTRACTOR_NAME;
    ws1.getCell(`C${r}`).font = FONT_VALUE;
    r++;
    ws1.getCell(`C${r}`).value = ORG_CONTRACTOR_ADDR1;
    ws1.getCell(`C${r}`).font = FONT_VALUE;
    r++;
    ws1.getCell(`C${r}`).value = ORG_CONTRACTOR_ADDR2;
    ws1.getCell(`C${r}`).font = FONT_VALUE;

    // ── Lines 1–7 ──
    r = 15;
    // Section header
    ws1.mergeCells(`B${r}:H${r}`);
    ws1.getCell(`B${r}`).value = "CONTRACTOR'S APPLICATION FOR PAYMENT";
    ws1.getCell(`B${r}`).font = { ...FONT_SUBTITLE, size: 11 };
    ws1.getCell(`B${r}`).fill = { type: "pattern", pattern: "solid", fgColor: { argb: LIGHT_BLUE_BG } };
    ws1.getCell(`B${r}`).alignment = { horizontal: "center" };
    ws1.getCell(`B${r}`).border = THIN_BORDERS;

    const g702Lines: Array<{ num: string; label: string; value: number; bold?: boolean }> = [
      { num: "1.", label: "ORIGINAL CONTRACT SUM", value: draw.original_contract_sum },
      { num: "", label: "   Deposit (" + ((job?.deposit_percentage ?? 0.10) * 100).toFixed(0) + "%)", value: draw.deposit_amount },
      { num: "2.", label: "NET CHANGE BY CHANGE ORDERS", value: draw.net_change_orders },
      { num: "3.", label: "CONTRACT SUM TO DATE (Line 1 + 2)", value: draw.contract_sum_to_date, bold: true },
      { num: "4.", label: "TOTAL COMPLETED AND STORED TO DATE", value: draw.total_completed_to_date },
      { num: "5.", label: "LESS PREVIOUS CERTIFICATES FOR PAYMENT", value: draw.less_previous_payments },
      { num: "6.", label: "CURRENT PAYMENT DUE", value: draw.current_payment_due, bold: true },
      { num: "7.", label: "BALANCE TO FINISH, INCLUDING RETAINAGE", value: draw.balance_to_finish },
    ];

    r = 17;
    for (const line of g702Lines) {
      ws1.getCell(`B${r}`).value = line.num;
      ws1.getCell(`B${r}`).font = line.bold ? FONT_LABEL : FONT_VALUE;
      ws1.getCell(`B${r}`).alignment = { horizontal: "right" };
      ws1.mergeCells(`C${r}:F${r}`);
      ws1.getCell(`C${r}`).value = line.label;
      ws1.getCell(`C${r}`).font = line.bold ? FONT_LABEL : FONT_VALUE;
      ws1.mergeCells(`G${r}:H${r}`);
      ws1.getCell(`G${r}`).value = centsToExcel(line.value);
      ws1.getCell(`G${r}`).numFmt = CURRENCY_FMT;
      ws1.getCell(`G${r}`).font = line.bold ? { ...FONT_LABEL, color: { argb: NAVY } } : FONT_VALUE;
      ws1.getCell(`G${r}`).alignment = { horizontal: "right" };
      // Highlight line 6
      if (line.num === "6.") {
        ws1.getCell(`G${r}`).fill = { type: "pattern", pattern: "solid", fgColor: { argb: LIGHT_BLUE_BG } };
        ws1.getCell(`G${r}`).border = THIN_BORDERS;
      }
      for (const col of ["B", "C", "G"]) {
        ws1.getCell(`${col}${r}`).border = { ...ws1.getCell(`${col}${r}`).border, bottom: THIN_BORDER };
      }
      r++;
    }

    // ── Change order summary ──
    r += 2;
    ws1.mergeCells(`B${r}:H${r}`);
    ws1.getCell(`B${r}`).value = "CHANGE ORDER SUMMARY";
    ws1.getCell(`B${r}`).font = FONT_SUBTITLE;
    ws1.getCell(`B${r}`).fill = { type: "pattern", pattern: "solid", fgColor: { argb: LIGHT_BLUE_BG } };
    ws1.getCell(`B${r}`).alignment = { horizontal: "center" };
    ws1.getCell(`B${r}`).border = THIN_BORDERS;
    r++;

    // CO header
    ws1.getCell(`B${r}`).value = "";
    ws1.getCell(`C${r}`).value = "ADDITIONS";
    ws1.getCell(`C${r}`).font = FONT_LABEL;
    ws1.getCell(`C${r}`).alignment = { horizontal: "center" };
    ws1.getCell(`D${r}`).value = "DEDUCTIONS";
    ws1.getCell(`D${r}`).font = FONT_LABEL;
    ws1.getCell(`D${r}`).alignment = { horizontal: "center" };
    r++;

    const cos = changeOrders ?? [];
    if (cos.length === 0) {
      ws1.getCell(`B${r}`).value = "No change orders to date.";
      ws1.getCell(`B${r}`).font = { ...FONT_VALUE, italic: true };
      ws1.mergeCells(`B${r}:D${r}`);
    } else {
      let totalAdditions = 0;
      let totalDeductions = 0;
      for (const co of cos) {
        const amt = co.total_with_fee ?? 0;
        if (amt >= 0) totalAdditions += amt; else totalDeductions += Math.abs(amt);
        ws1.getCell(`B${r}`).value = `PCCO #${co.pcco_number}`;
        ws1.getCell(`B${r}`).font = FONT_VALUE;
        if (amt >= 0) {
          ws1.getCell(`C${r}`).value = centsToExcel(amt);
          ws1.getCell(`C${r}`).numFmt = CURRENCY_FMT;
        } else {
          ws1.getCell(`D${r}`).value = centsToExcel(Math.abs(amt));
          ws1.getCell(`D${r}`).numFmt = CURRENCY_FMT;
        }
        r++;
      }
      ws1.getCell(`B${r}`).value = "TOTALS";
      ws1.getCell(`B${r}`).font = FONT_LABEL;
      ws1.getCell(`C${r}`).value = centsToExcel(totalAdditions);
      ws1.getCell(`C${r}`).numFmt = CURRENCY_FMT;
      ws1.getCell(`C${r}`).font = FONT_TOTAL;
      ws1.getCell(`D${r}`).value = centsToExcel(totalDeductions);
      ws1.getCell(`D${r}`).numFmt = CURRENCY_FMT;
      ws1.getCell(`D${r}`).font = FONT_TOTAL;
      ws1.getCell(`C${r}`).border = { top: { style: "medium", color: { argb: BLACK } } };
      ws1.getCell(`D${r}`).border = { top: { style: "medium", color: { argb: BLACK } } };
    }

    // ── Signature block ──
    r += 4;
    ws1.mergeCells(`B${r}:D${r}`);
    ws1.getCell(`B${r}`).value = "CONTRACTOR: Ross Built Construction Company";
    ws1.getCell(`B${r}`).font = FONT_LABEL;
    r += 2;
    ws1.mergeCells(`B${r}:C${r}`);
    ws1.getCell(`B${r}`).value = `By: ${ORG_SIGNATORY}`;
    ws1.getCell(`B${r}`).font = FONT_VALUE;
    ws1.getCell(`B${r}`).border = { bottom: { style: "thin", color: { argb: BLACK } } };
    ws1.getCell(`D${r}`).value = `Date: ${formatDateStr(draw.application_date)}`;
    ws1.getCell(`D${r}`).font = FONT_VALUE;

    // ═══════════════════════════════════════════════
    // SHEET 2: G703 — Continuation Sheet
    // ═══════════════════════════════════════════════
    const ws2 = wb.addWorksheet("Line Item Estimate (G703)", {
      pageSetup: { paperSize: 1 as unknown as ExcelJS.PaperSize, orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0, margins: { left: 0.4, right: 0.4, top: 0.7, bottom: 0.5, header: 0.3, footer: 0.3 } },
    });

    ws2.columns = [
      { width: 10, key: "item" },      // A — Item No
      { width: 36, key: "desc" },      // B — Description
      { width: 16, key: "original" },  // C — Original Estimate
      { width: 16, key: "previous" },  // D — Previous Applications
      { width: 16, key: "period" },    // E — This Period
      { width: 16, key: "toDate" },    // F — Total to Date
      { width: 10, key: "pct" },       // G — % Complete
      { width: 16, key: "balance" },   // H — Balance to Finish
    ];

    // ── G703 Header block ──
    r = 1;
    ws2.mergeCells(`A${r}:B${r}`);
    ws2.getCell(`A${r}`).value = "CONTINUATION SHEET";
    ws2.getCell(`A${r}`).font = FONT_TITLE;
    ws2.mergeCells(`F${r}:H${r}`);
    ws2.getCell(`F${r}`).value = "AIA DOCUMENT G703";
    ws2.getCell(`F${r}`).font = { ...FONT_SUBTITLE, size: 12 };
    ws2.getCell(`F${r}`).alignment = { horizontal: "right" };

    r = 2;
    for (const col of ["A", "B", "C", "D", "E", "F", "G", "H"]) {
      ws2.getCell(`${col}${r}`).border = { bottom: { style: "medium", color: { argb: HEADER_GOLD } } };
    }
    ws2.getRow(r).height = 6;

    r = 3;
    ws2.getCell(`A${r}`).value = "PROJECT:";
    ws2.getCell(`A${r}`).font = FONT_LABEL;
    ws2.getCell(`B${r}`).value = `${jobName} Residence — ${job?.address ?? ""}`;
    ws2.getCell(`B${r}`).font = FONT_VALUE;
    ws2.getCell(`F${r}`).value = "APPLICATION NO:";
    ws2.getCell(`F${r}`).font = FONT_LABEL;
    ws2.getCell(`G${r}`).value = drawNum;
    ws2.getCell(`G${r}`).font = FONT_VALUE;

    r = 4;
    ws2.getCell(`A${r}`).value = "FROM:";
    ws2.getCell(`A${r}`).font = FONT_LABEL;
    ws2.getCell(`B${r}`).value = "Ross Built Construction, LLC";
    ws2.getCell(`B${r}`).font = FONT_VALUE;
    ws2.getCell(`F${r}`).value = "APPLICATION DATE:";
    ws2.getCell(`F${r}`).font = FONT_LABEL;
    ws2.getCell(`G${r}`).value = formatDateStr(draw.application_date);
    ws2.getCell(`G${r}`).font = FONT_VALUE;

    r = 5;
    ws2.getCell(`F${r}`).value = "PERIOD TO:";
    ws2.getCell(`F${r}`).font = FONT_LABEL;
    ws2.getCell(`G${r}`).value = formatDateStr(draw.period_end);
    ws2.getCell(`G${r}`).font = FONT_VALUE;

    // ── Column headers ──
    r = 7;
    const colHeaders = [
      { col: "A", text: "A\nITEM NO.", width: 10 },
      { col: "B", text: "B\nDESCRIPTION OF WORK", width: 36 },
      { col: "C", text: "C\nORIGINAL ESTIMATE", width: 16 },
      { col: "D", text: "D\nPREVIOUS\nAPPLICATIONS", width: 16 },
      { col: "E", text: "E\nTHIS PERIOD", width: 16 },
      { col: "F", text: "F\nTOTAL\nCOMPLETED TO DATE", width: 16 },
      { col: "G", text: "G\n%", width: 10 },
      { col: "H", text: "H\nBALANCE\nTO FINISH", width: 16 },
    ];

    ws2.getRow(r).height = 40;
    for (const h of colHeaders) {
      const cell = ws2.getCell(`${h.col}${r}`);
      cell.value = h.text;
      cell.font = FONT_HEADER;
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY } };
      cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
      cell.border = THIN_BORDERS;
    }

    // ── Data rows with page subtotals ──
    const PAGE_SIZE = 30;
    let rowsOnPage = 0;
    let pageNum = 1;
    let pageSub = { original: 0, previous: 0, thisPeriod: 0, toDate: 0, balance: 0 };
    const grandTotal = { original: 0, previous: 0, thisPeriod: 0, toDate: 0, balance: 0 };

    r = 8;

    for (let i = 0; i < g703Lines.length; i++) {
      const line = g703Lines[i];
      const isEvenRow = (rowsOnPage % 2 === 0);

      const rowObj = ws2.getRow(r);
      if (isEvenRow) {
        for (let c = 1; c <= 8; c++) {
          rowObj.getCell(c).fill = { type: "pattern", pattern: "solid", fgColor: { argb: LIGHT_GRAY_BG } };
        }
      }

      ws2.getCell(`A${r}`).value = line.code;
      ws2.getCell(`A${r}`).font = FONT_BODY;
      ws2.getCell(`A${r}`).alignment = { horizontal: "center" };

      ws2.getCell(`B${r}`).value = line.description;
      ws2.getCell(`B${r}`).font = FONT_BODY;

      ws2.getCell(`C${r}`).value = centsToExcel(line.original_estimate);
      ws2.getCell(`C${r}`).numFmt = CURRENCY_FMT;
      ws2.getCell(`C${r}`).font = FONT_BODY;
      ws2.getCell(`C${r}`).alignment = { horizontal: "right" };

      ws2.getCell(`D${r}`).value = line.previous_applications > 0 ? centsToExcel(line.previous_applications) : null;
      ws2.getCell(`D${r}`).numFmt = CURRENCY_FMT;
      ws2.getCell(`D${r}`).font = FONT_BODY;
      ws2.getCell(`D${r}`).alignment = { horizontal: "right" };

      ws2.getCell(`E${r}`).value = line.this_period > 0 ? centsToExcel(line.this_period) : null;
      ws2.getCell(`E${r}`).numFmt = CURRENCY_FMT;
      ws2.getCell(`E${r}`).font = { ...FONT_BODY, bold: line.this_period > 0 };
      ws2.getCell(`E${r}`).alignment = { horizontal: "right" };

      ws2.getCell(`F${r}`).value = line.total_to_date > 0 ? centsToExcel(line.total_to_date) : null;
      ws2.getCell(`F${r}`).numFmt = CURRENCY_FMT;
      ws2.getCell(`F${r}`).font = FONT_BODY;
      ws2.getCell(`F${r}`).alignment = { horizontal: "right" };

      ws2.getCell(`G${r}`).value = line.percent_complete > 0 ? line.percent_complete : null;
      ws2.getCell(`G${r}`).numFmt = PERCENT_FMT;
      ws2.getCell(`G${r}`).font = FONT_BODY;
      ws2.getCell(`G${r}`).alignment = { horizontal: "center" };

      ws2.getCell(`H${r}`).value = centsToExcel(line.balance_to_finish);
      ws2.getCell(`H${r}`).numFmt = CURRENCY_FMT;
      ws2.getCell(`H${r}`).font = line.balance_to_finish < 0 ? { ...FONT_BODY, color: { argb: "CC0000" } } : FONT_BODY;
      ws2.getCell(`H${r}`).alignment = { horizontal: "right" };

      // Borders on all data cells
      for (let c = 1; c <= 8; c++) {
        rowObj.getCell(c).border = { left: THIN_BORDER, right: THIN_BORDER, bottom: { style: "hair", color: { argb: "D9D9D9" } } };
      }

      // Accumulate
      pageSub.original += line.original_estimate;
      pageSub.previous += line.previous_applications;
      pageSub.thisPeriod += line.this_period;
      pageSub.toDate += line.total_to_date;
      pageSub.balance += line.balance_to_finish;

      grandTotal.original += line.original_estimate;
      grandTotal.previous += line.previous_applications;
      grandTotal.thisPeriod += line.this_period;
      grandTotal.toDate += line.total_to_date;
      grandTotal.balance += line.balance_to_finish;

      rowsOnPage++;
      r++;

      // Page subtotal every PAGE_SIZE rows (but not at the very end)
      if (rowsOnPage >= PAGE_SIZE && i < g703Lines.length - 1) {
        writeSubtotalRow(ws2, r, `Total Page ${pageNum}`, pageSub);
        r += 2; // blank row after subtotal
        pageSub = { original: 0, previous: 0, thisPeriod: 0, toDate: 0, balance: 0 };
        rowsOnPage = 0;
        pageNum++;

        // Add page break after subtotal row
        ws2.getRow(r - 2).addPageBreak();
      }
    }

    // ── Grand total row ──
    r++;
    const gtRow = ws2.getRow(r);
    ws2.getCell(`A${r}`).value = "";
    ws2.mergeCells(`A${r}:B${r}`);
    ws2.getCell(`A${r}`).value = "GRAND TOTAL";
    ws2.getCell(`A${r}`).font = FONT_GRAND_TOTAL;
    ws2.getCell(`A${r}`).alignment = { horizontal: "right" };
    ws2.getCell(`C${r}`).value = centsToExcel(grandTotal.original);
    ws2.getCell(`C${r}`).numFmt = CURRENCY_FMT;
    ws2.getCell(`C${r}`).font = FONT_GRAND_TOTAL;
    ws2.getCell(`D${r}`).value = grandTotal.previous > 0 ? centsToExcel(grandTotal.previous) : null;
    ws2.getCell(`D${r}`).numFmt = CURRENCY_FMT;
    ws2.getCell(`D${r}`).font = FONT_GRAND_TOTAL;
    ws2.getCell(`E${r}`).value = grandTotal.thisPeriod > 0 ? centsToExcel(grandTotal.thisPeriod) : null;
    ws2.getCell(`E${r}`).numFmt = CURRENCY_FMT;
    ws2.getCell(`E${r}`).font = FONT_GRAND_TOTAL;
    ws2.getCell(`F${r}`).value = grandTotal.toDate > 0 ? centsToExcel(grandTotal.toDate) : null;
    ws2.getCell(`F${r}`).numFmt = CURRENCY_FMT;
    ws2.getCell(`F${r}`).font = FONT_GRAND_TOTAL;
    const grandPct = grandTotal.original > 0 ? grandTotal.toDate / grandTotal.original : 0;
    ws2.getCell(`G${r}`).value = grandPct > 0 ? grandPct : null;
    ws2.getCell(`G${r}`).numFmt = PERCENT_FMT;
    ws2.getCell(`G${r}`).font = FONT_GRAND_TOTAL;
    ws2.getCell(`G${r}`).alignment = { horizontal: "center" };
    ws2.getCell(`H${r}`).value = centsToExcel(grandTotal.balance);
    ws2.getCell(`H${r}`).numFmt = CURRENCY_FMT;
    ws2.getCell(`H${r}`).font = FONT_GRAND_TOTAL;

    for (let c = 1; c <= 8; c++) {
      gtRow.getCell(c).border = { top: { style: "medium", color: { argb: NAVY } }, bottom: { style: "double", color: { argb: NAVY } } };
      gtRow.getCell(c).alignment = { ...gtRow.getCell(c).alignment, horizontal: c <= 2 ? "right" : "right" };
    }

    // ═══════════════════════════════════════════════
    // SHEET 3: PCCO Log (only if change orders exist)
    // ═══════════════════════════════════════════════
    if (cos.length > 0) {
      const ws3 = wb.addWorksheet("Change Order Log (PCCO)", {
        pageSetup: { paperSize: 1 as unknown as ExcelJS.PaperSize, orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0, margins: { left: 0.4, right: 0.4, top: 0.7, bottom: 0.5, header: 0.3, footer: 0.3 } },
      });

      ws3.columns = [
        { width: 10, key: "pcco" },
        { width: 10, key: "app" },
        { width: 36, key: "desc" },
        { width: 18, key: "begin" },
        { width: 16, key: "addDeduct" },
        { width: 14, key: "gcFee" },
        { width: 18, key: "newAmt" },
        { width: 14, key: "days" },
      ];

      // Title
      r = 1;
      ws3.mergeCells(`A${r}:C${r}`);
      ws3.getCell(`A${r}`).value = "POTENTIAL CHANGE ORDER LOG";
      ws3.getCell(`A${r}`).font = FONT_TITLE;
      ws3.mergeCells(`F${r}:H${r}`);
      ws3.getCell(`F${r}`).value = `${jobName} Residence`;
      ws3.getCell(`F${r}`).font = FONT_SUBTITLE;
      ws3.getCell(`F${r}`).alignment = { horizontal: "right" };

      r = 2;
      for (const col of ["A", "B", "C", "D", "E", "F", "G", "H"]) {
        ws3.getCell(`${col}${r}`).border = { bottom: { style: "medium", color: { argb: HEADER_GOLD } } };
      }
      ws3.getRow(r).height = 6;

      // Column headers
      r = 4;
      const pccoHeaders = [
        "PCCO #", "APP #", "DESCRIPTION", "BEGINNING\nCONTRACT AMT",
        "ADDITION /\nDEDUCTION", "GC FEE", "NEW CONTRACT\nAMOUNT", "EST. DAYS\nADDED",
      ];
      ws3.getRow(r).height = 30;
      pccoHeaders.forEach((h, i) => {
        const cell = ws3.getRow(r).getCell(i + 1);
        cell.value = h;
        cell.font = FONT_HEADER;
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY } };
        cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
        cell.border = THIN_BORDERS;
      });

      r = 5;
      let runningContract = draw.original_contract_sum;
      for (const co of cos) {
        const coAmt = co.total_with_fee ?? 0;
        runningContract += coAmt;
        const row = ws3.getRow(r);
        const isEven = ((r - 5) % 2 === 0);
        if (isEven) {
          for (let c = 1; c <= 8; c++) row.getCell(c).fill = { type: "pattern", pattern: "solid", fgColor: { argb: LIGHT_GRAY_BG } };
        }
        row.getCell(1).value = co.pcco_number;
        row.getCell(1).font = FONT_BODY;
        row.getCell(1).alignment = { horizontal: "center" };
        row.getCell(2).value = co.draw_number ?? "";
        row.getCell(2).font = FONT_BODY;
        row.getCell(2).alignment = { horizontal: "center" };
        row.getCell(3).value = co.description ?? "";
        row.getCell(3).font = FONT_BODY;
        row.getCell(4).value = centsToExcel(runningContract - coAmt);
        row.getCell(4).numFmt = CURRENCY_FMT;
        row.getCell(4).font = FONT_BODY;
        row.getCell(5).value = centsToExcel(co.amount ?? 0);
        row.getCell(5).numFmt = CURRENCY_FMT;
        row.getCell(5).font = FONT_BODY;
        row.getCell(6).value = centsToExcel(co.gc_fee_amount ?? 0);
        row.getCell(6).numFmt = CURRENCY_FMT;
        row.getCell(6).font = FONT_BODY;
        row.getCell(7).value = centsToExcel(runningContract);
        row.getCell(7).numFmt = CURRENCY_FMT;
        row.getCell(7).font = FONT_BODY;
        row.getCell(8).value = co.estimated_days_added ?? 0;
        row.getCell(8).font = FONT_BODY;
        row.getCell(8).alignment = { horizontal: "center" };
        for (let c = 1; c <= 8; c++) row.getCell(c).border = { left: THIN_BORDER, right: THIN_BORDER, bottom: { style: "hair", color: { argb: "D9D9D9" } } };
        r++;
      }

      // GC fee note
      r += 2;
      ws3.mergeCells(`A${r}:H${r}`);
      ws3.getCell(`A${r}`).value = `Note: GC fee rate is ${((job?.gc_fee_percentage ?? 0.20) * 100).toFixed(0)}% unless otherwise noted on individual change orders.`;
      ws3.getCell(`A${r}`).font = { ...FONT_VALUE, italic: true };
    }

    // ── Generate buffer and return ──
    const buffer = await wb.xlsx.writeBuffer();
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const filename = `${jobName}_Pay_App_${drawNum}_${dateStr}.xlsx`;

    return new NextResponse(buffer as ArrayBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function writeSubtotalRow(
  ws: ExcelJS.Worksheet,
  r: number,
  label: string,
  sums: { original: number; previous: number; thisPeriod: number; toDate: number; balance: number }
) {
  ws.mergeCells(`A${r}:B${r}`);
  ws.getCell(`A${r}`).value = label;
  ws.getCell(`A${r}`).font = FONT_TOTAL;
  ws.getCell(`A${r}`).alignment = { horizontal: "right" };
  ws.getCell(`C${r}`).value = centsToExcel(sums.original);
  ws.getCell(`C${r}`).numFmt = CURRENCY_FMT;
  ws.getCell(`C${r}`).font = FONT_TOTAL;
  ws.getCell(`D${r}`).value = sums.previous > 0 ? centsToExcel(sums.previous) : null;
  ws.getCell(`D${r}`).numFmt = CURRENCY_FMT;
  ws.getCell(`D${r}`).font = FONT_TOTAL;
  ws.getCell(`E${r}`).value = sums.thisPeriod > 0 ? centsToExcel(sums.thisPeriod) : null;
  ws.getCell(`E${r}`).numFmt = CURRENCY_FMT;
  ws.getCell(`E${r}`).font = FONT_TOTAL;
  ws.getCell(`F${r}`).value = sums.toDate > 0 ? centsToExcel(sums.toDate) : null;
  ws.getCell(`F${r}`).numFmt = CURRENCY_FMT;
  ws.getCell(`F${r}`).font = FONT_TOTAL;
  ws.getCell(`H${r}`).value = centsToExcel(sums.balance);
  ws.getCell(`H${r}`).numFmt = CURRENCY_FMT;
  ws.getCell(`H${r}`).font = FONT_TOTAL;

  for (let c = 1; c <= 8; c++) {
    ws.getRow(r).getCell(c).border = {
      top: { style: "thin", color: { argb: NAVY } },
      bottom: { style: "thin", color: { argb: NAVY } },
    };
    ws.getRow(r).getCell(c).fill = { type: "pattern", pattern: "solid", fgColor: { argb: LIGHT_BLUE_BG } };
  }
}
