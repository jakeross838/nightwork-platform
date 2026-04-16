import ExcelJS from "exceljs";

/**
 * Budget Excel export — Phase 8d.
 *
 * Client-safe: uses exceljs which ships a browser build. Produces a 4-sheet
 * workbook (Summary, Budget Detail, PO Detail, Invoice Detail) and triggers
 * a download via a Blob URL.
 *
 * All monetary values come in as cents and are converted to dollars in the
 * sheet. Percent complete comes in as a 0..100 number.
 */

export interface BudgetExportJob {
  name: string;
  address: string | null;
  original_contract_amount: number;
  current_contract_amount: number;
  approved_cos_total: number;
  retainage_percent: number;
}

export interface BudgetExportLine {
  code: string;
  description: string;
  category: string;
  original: number;
  approved_cos: number;
  revised: number;
  committed: number;
  invoiced: number;
  remaining_po: number;
  uncommitted: number;
  projected: number;
  variance: number;
}

export interface BudgetExportPO {
  po_number: string | null;
  vendor: string | null;
  cost_code: string | null;
  budget_line_description: string | null;
  amount: number;
  invoiced_total: number;
  remaining: number;
  status: string;
  issued_date: string | null;
}

export interface BudgetExportInvoice {
  vendor: string | null;
  invoice_number: string | null;
  received_date: string | null;
  amount: number;
  cost_code: string | null;
  budget_line_description: string | null;
  po_number: string | null;
  status: string;
  description: string | null;
}

export interface BudgetExportInput {
  job: BudgetExportJob;
  lines: BudgetExportLine[];
  pos: BudgetExportPO[];
  invoices: BudgetExportInvoice[];
  summary: {
    original: number;
    approved_cos: number;
    revised: number;
    committed: number;
    invoiced: number;
    remaining: number;
  };
}

const MONEY_FORMAT = '$#,##0.00';
const VARIANCE_CONDITIONAL_FORMULA = (cellRef: string) => ({
  positive: {
    type: "cellIs" as const,
    operator: "greaterThan" as const,
    formulae: ["0"],
    style: { font: { color: { argb: "FF1B6E2A" } } }, // green
    priority: 1,
  },
  negative: {
    type: "cellIs" as const,
    operator: "lessThan" as const,
    formulae: ["0"],
    style: { font: { color: { argb: "FFB42424" } } }, // red
    priority: 2,
  },
  _ref: cellRef,
});

export async function buildBudgetWorkbook(input: BudgetExportInput): Promise<Blob> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Ross Command Center";
  wb.created = new Date();

  // ---------- Sheet 1: Budget Summary ----------
  const s1 = wb.addWorksheet("Budget Summary");
  s1.columns = [{ width: 28 }, { width: 22 }];
  s1.addRow(["Job", input.job.name]);
  s1.addRow(["Address", input.job.address ?? ""]);
  s1.addRow(["Original Contract", input.job.original_contract_amount / 100]);
  s1.addRow(["Approved COs", input.job.approved_cos_total / 100]);
  s1.addRow(["Revised Contract", input.job.current_contract_amount / 100]);
  s1.addRow(["Retainage %", input.job.retainage_percent / 100]);
  s1.addRow([]);
  s1.addRow(["Budget Totals"]);
  s1.addRow(["Original Total", input.summary.original / 100]);
  s1.addRow(["CO +/-", input.summary.approved_cos / 100]);
  s1.addRow(["Revised Total", input.summary.revised / 100]);
  s1.addRow(["Committed (POs)", input.summary.committed / 100]);
  s1.addRow(["Invoiced", input.summary.invoiced / 100]);
  s1.addRow(["Remaining", input.summary.remaining / 100]);
  s1.addRow([]);
  s1.addRow(["Exported", new Date().toISOString().slice(0, 10)]);

  // Format headers and money cells.
  s1.getRow(1).font = { bold: true };
  s1.getRow(8).font = { bold: true };
  s1.getCell("B6").numFmt = "0.00%";
  for (const r of [3, 4, 5, 9, 10, 11, 12, 13, 14]) {
    s1.getCell(`B${r}`).numFmt = MONEY_FORMAT;
  }

  // ---------- Sheet 2: Budget Detail ----------
  const s2 = wb.addWorksheet("Budget Detail");
  s2.columns = [
    { header: "Code", key: "code", width: 10 },
    { header: "Description", key: "description", width: 36 },
    { header: "Category", key: "category", width: 22 },
    { header: "Original", key: "original", width: 14 },
    { header: "CO +/-", key: "approved_cos", width: 12 },
    { header: "Revised", key: "revised", width: 14 },
    { header: "Committed", key: "committed", width: 14 },
    { header: "Invoiced", key: "invoiced", width: 14 },
    { header: "Remaining PO", key: "remaining_po", width: 14 },
    { header: "Uncommitted", key: "uncommitted", width: 14 },
    { header: "Projected", key: "projected", width: 14 },
    { header: "Variance", key: "variance", width: 14 },
  ];
  s2.getRow(1).font = { bold: true };
  s2.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF3F5862" }, // brand teal
  };
  s2.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };

  // Group lines by category and emit a subtotal row after each.
  const byCat = new Map<string, BudgetExportLine[]>();
  for (const l of input.lines) {
    const arr = byCat.get(l.category) ?? [];
    arr.push(l);
    byCat.set(l.category, arr);
  }
  const categories = Array.from(byCat.keys()).sort((a, b) => a.localeCompare(b));
  const _moneyCols = [
    "original",
    "approved_cos",
    "revised",
    "committed",
    "invoiced",
    "remaining_po",
    "uncommitted",
    "projected",
    "variance",
  ] as const;
  const moneyColLetters = ["D", "E", "F", "G", "H", "I", "J", "K", "L"];
  const varianceCol = "L";

  for (const cat of categories) {
    const rows = byCat.get(cat) ?? [];
    // Category header
    const headerRow = s2.addRow([cat]);
    headerRow.font = { bold: true };
    headerRow.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFEAE3D3" }, // light sand / brand-row-border-ish
    };
    s2.mergeCells(headerRow.number, 1, headerRow.number, 3);

    for (const r of rows) {
      const dataRow = s2.addRow({
        code: r.code,
        description: r.description,
        category: r.category,
        original: r.original / 100,
        approved_cos: r.approved_cos / 100,
        revised: r.revised / 100,
        committed: r.committed / 100,
        invoiced: r.invoiced / 100,
        remaining_po: r.remaining_po / 100,
        uncommitted: r.uncommitted / 100,
        projected: r.projected / 100,
        variance: r.variance / 100,
      });
      for (const c of moneyColLetters) {
        dataRow.getCell(c).numFmt = MONEY_FORMAT;
      }
    }

    // Category subtotal
    const subtotal: Record<(typeof _moneyCols)[number], number> = {
      original: 0,
      approved_cos: 0,
      revised: 0,
      committed: 0,
      invoiced: 0,
      remaining_po: 0,
      uncommitted: 0,
      projected: 0,
      variance: 0,
    };
    for (const r of rows) {
      subtotal.original += r.original;
      subtotal.approved_cos += r.approved_cos;
      subtotal.revised += r.revised;
      subtotal.committed += r.committed;
      subtotal.invoiced += r.invoiced;
      subtotal.remaining_po += r.remaining_po;
      subtotal.uncommitted += r.uncommitted;
      subtotal.projected += r.projected;
      subtotal.variance += r.variance;
    }
    const subRow = s2.addRow({
      code: "",
      description: `${cat} subtotal`,
      category: "",
      original: subtotal.original / 100,
      approved_cos: subtotal.approved_cos / 100,
      revised: subtotal.revised / 100,
      committed: subtotal.committed / 100,
      invoiced: subtotal.invoiced / 100,
      remaining_po: subtotal.remaining_po / 100,
      uncommitted: subtotal.uncommitted / 100,
      projected: subtotal.projected / 100,
      variance: subtotal.variance / 100,
    });
    subRow.font = { bold: true };
    subRow.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFF5F0E4" },
    };
    for (const c of moneyColLetters) {
      subRow.getCell(c).numFmt = MONEY_FORMAT;
    }
  }

  // Grand totals
  const grand: Record<(typeof _moneyCols)[number], number> = {
    original: 0,
    approved_cos: 0,
    revised: 0,
    committed: 0,
    invoiced: 0,
    remaining_po: 0,
    uncommitted: 0,
    projected: 0,
    variance: 0,
  };
  for (const l of input.lines) {
    grand.original += l.original;
    grand.approved_cos += l.approved_cos;
    grand.revised += l.revised;
    grand.committed += l.committed;
    grand.invoiced += l.invoiced;
    grand.remaining_po += l.remaining_po;
    grand.uncommitted += l.uncommitted;
    grand.projected += l.projected;
    grand.variance += l.variance;
  }
  const totalRow = s2.addRow({
    code: "",
    description: "Grand Total",
    category: "",
    original: grand.original / 100,
    approved_cos: grand.approved_cos / 100,
    revised: grand.revised / 100,
    committed: grand.committed / 100,
    invoiced: grand.invoiced / 100,
    remaining_po: grand.remaining_po / 100,
    uncommitted: grand.uncommitted / 100,
    projected: grand.projected / 100,
    variance: grand.variance / 100,
  });
  totalRow.font = { bold: true };
  totalRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFD9CFB5" },
  };
  for (const c of moneyColLetters) {
    totalRow.getCell(c).numFmt = MONEY_FORMAT;
  }

  // Conditional formatting on the Variance column.
  const lastRow = s2.rowCount;
  s2.addConditionalFormatting({
    ref: `${varianceCol}2:${varianceCol}${lastRow}`,
    rules: [
      VARIANCE_CONDITIONAL_FORMULA(`${varianceCol}2:${varianceCol}${lastRow}`).positive,
      VARIANCE_CONDITIONAL_FORMULA(`${varianceCol}2:${varianceCol}${lastRow}`).negative,
    ],
  });

  // ---------- Sheet 3: PO Detail ----------
  const s3 = wb.addWorksheet("PO Detail");
  s3.columns = [
    { header: "PO #", key: "po_number", width: 14 },
    { header: "Vendor", key: "vendor", width: 28 },
    { header: "Cost Code", key: "cost_code", width: 12 },
    { header: "Budget Line", key: "budget_line_description", width: 30 },
    { header: "Amount", key: "amount", width: 14 },
    { header: "Invoiced", key: "invoiced_total", width: 14 },
    { header: "Remaining", key: "remaining", width: 14 },
    { header: "Status", key: "status", width: 16 },
    { header: "Issued Date", key: "issued_date", width: 14 },
  ];
  s3.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  s3.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF3F5862" },
  };
  for (const p of input.pos) {
    const r = s3.addRow({
      po_number: p.po_number,
      vendor: p.vendor,
      cost_code: p.cost_code,
      budget_line_description: p.budget_line_description,
      amount: p.amount / 100,
      invoiced_total: p.invoiced_total / 100,
      remaining: p.remaining / 100,
      status: p.status,
      issued_date: p.issued_date,
    });
    for (const c of ["E", "F", "G"]) r.getCell(c).numFmt = MONEY_FORMAT;
  }

  // ---------- Sheet 4: Invoice Detail ----------
  const s4 = wb.addWorksheet("Invoice Detail");
  s4.columns = [
    { header: "Vendor", key: "vendor", width: 28 },
    { header: "Invoice #", key: "invoice_number", width: 14 },
    { header: "Date", key: "received_date", width: 14 },
    { header: "Amount", key: "amount", width: 14 },
    { header: "Cost Code", key: "cost_code", width: 12 },
    { header: "Budget Line", key: "budget_line_description", width: 30 },
    { header: "PO #", key: "po_number", width: 14 },
    { header: "Status", key: "status", width: 16 },
    { header: "Description", key: "description", width: 60 },
  ];
  s4.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  s4.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF3F5862" },
  };
  for (const i of input.invoices) {
    const r = s4.addRow({
      vendor: i.vendor,
      invoice_number: i.invoice_number,
      received_date: i.received_date,
      amount: i.amount / 100,
      cost_code: i.cost_code,
      budget_line_description: i.budget_line_description,
      po_number: i.po_number,
      status: i.status,
      description: (i.description ?? "").slice(0, 200),
    });
    r.getCell("D").numFmt = MONEY_FORMAT;
  }

  const buf = await wb.xlsx.writeBuffer();
  return new Blob([buf as ArrayBuffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 500);
}
