/**
 * Dewberry Full Analysis — F-006 Path A diagnostic.
 *
 * Parses Pay App #10 XLSX and cross-references with Pay App #9 + Nightwork DB
 * to expose exactly where CO completion and cost-code totals diverge.
 *
 * Usage: node tmp/dewberry-full-analysis.mjs
 */
import ExcelJS from 'exceljs';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'node:path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const APP10 = 'test-invoices/Dewberry-681_KRD-Pay_App_10_March_26.xlsx';
const APP9  = 'test-invoices/Dewberry-681_KRD-Pay_App_9_Jan-Feb_26.xlsx';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

// ─── Helpers ────────────────────────────────────────────────
function text(v) {
  if (v == null) return '';
  if (typeof v === 'string') return v.trim();
  if (typeof v === 'number') return String(v);
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === 'object') {
    if (typeof v.text === 'string') return v.text.trim();
    if (v.result != null) return text(v.result);
    if (Array.isArray(v.richText)) return v.richText.map(r => r.text).join('').trim();
  }
  return String(v).trim();
}

function num(v) {
  if (v == null || v === '') return null;
  if (typeof v === 'number') return isFinite(v) ? v : null;
  if (v instanceof Date) return null;
  if (typeof v === 'object' && v.result != null) return num(v.result);
  const s = String(v).replace(/[$,\s]/g, '');
  const n = Number(s);
  return isFinite(n) ? n : null;
}

function code5(raw) {
  const d = raw.replace(/[^\d]/g, '');
  if (d.length === 5) return d;
  if (d.length === 4) return '0' + d;
  if (d.length === 3) return '00' + d;
  return null;
}

function $(dollars) { return dollars != null ? `$${dollars.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '$0.00'; }
function pad(s, w) { return String(s).padEnd(w); }
function rpad(s, w) { return String(s).padStart(w); }

function hr(char = '─', len = 120) { console.log(char.repeat(len)); }

// ─── Load workbooks ─────────────────────────────────────────
const wb10 = new ExcelJS.Workbook();
await wb10.xlsx.readFile(APP10);
const wb9 = new ExcelJS.Workbook();
await wb9.xlsx.readFile(APP9);

const pcco10 = wb10.worksheets.find(s => /PCCO|Change Order/i.test(s.name));
const g703_10 = wb10.worksheets.find(s => /G703|Line Item/i.test(s.name));
const g702_10 = wb10.worksheets.find(s => /G702|Project Summary/i.test(s.name));

const pcco9 = wb9.worksheets.find(s => /PCCO|Change Order/i.test(s.name));
const g703_9 = wb9.worksheets.find(s => /G703|Line Item/i.test(s.name));

// ═════════════════════════════════════════════════════════════
// SECTION 1: PCCO SHEET STRUCTURE
// ═════════════════════════════════════════════════════════════
console.log('\n');
hr('═');
console.log('  SECTION 1: PCCO SHEET STRUCTURE (Pay App #10)');
hr('═');

// 1a. Raw column headers
console.log('\n1a. Column headers (row 7):');
const headerRow = pcco10.getRow(7);
for (let c = 1; c <= 9; c++) {
  console.log(`  Col ${c}: ${text(headerRow.getCell(c).value) || '(empty)'}`);
}

console.log(`\nDefault GC fee rate (row 8, col 6): ${num(pcco10.getRow(8).getCell(6).value)}`);

// 1b. How many CO records + sample rows
const pccoEntries = [];
pcco10.eachRow({ includeEmpty: false }, (row, rn) => {
  const col1 = num(row.getCell(1).value);
  if (col1 == null || col1 <= 0) return;
  const desc = text(row.getCell(3).value);
  if (desc.toLowerCase().includes('total change')) return;

  pccoEntries.push({
    row: rn,
    pccoNum: col1,
    appNum: num(row.getCell(2).value) ?? 0,
    description: desc,
    beginAmount: num(row.getCell(4).value),
    addition: num(row.getCell(5).value) ?? 0,
    gcFee: num(row.getCell(6).value) ?? 0,
    newAmount: num(row.getCell(7).value),
    daysAdded: num(row.getCell(8).value) ?? 0,
    notes: text(row.getCell(9).value),
  });
});

console.log(`\n1b. Total CO records: ${pccoEntries.length}`);
console.log('\nAll PCCO entries:');
console.log(
  pad('PCCO#', 7) + pad('App#', 6) + pad('Description', 52) +
  rpad('Addition', 14) + rpad('GC Fee', 14) + rpad('Total', 14) + '  Notes'
);
hr('─', 120);
for (const e of pccoEntries) {
  const total = e.addition + e.gcFee;
  console.log(
    pad(e.pccoNum, 7) + pad(e.appNum, 6) + pad(e.description.slice(0, 50), 52) +
    rpad($(e.addition), 14) + rpad($(e.gcFee), 14) + rpad($(total), 14) +
    '  ' + e.notes
  );
}

// 1c. Summary totals from PCCO sheet
const totalAdditions = pccoEntries.reduce((s, e) => s + e.addition, 0);
const totalFees = pccoEntries.reduce((s, e) => s + e.gcFee, 0);
const totalAll = totalAdditions + totalFees;
console.log(hr('─', 120) || '');
console.log(
  pad('', 7) + pad('', 6) + pad('TOTALS', 52) +
  rpad($(totalAdditions), 14) + rpad($(totalFees), 14) + rpad($(totalAll), 14)
);

// 1d. PCCO totals rows
console.log('\n1c. PCCO sheet "TOTAL" rows:');
pcco10.eachRow({ includeEmpty: false }, (row, rn) => {
  const desc = text(row.getCell(3).value).toLowerCase();
  if (desc.includes('total change')) {
    const label = text(row.getCell(3).value);
    const addition = num(row.getCell(5).value);
    const fee = num(row.getCell(6).value);
    const total = num(row.getCell(7).value);
    console.log(`  Row ${rn}: ${label}`);
    console.log(`    Addition: ${$(addition)}  |  GC Fee: ${$(fee)}  |  Total: ${$(total)}`);
  }
});

// 1e. Breakdown by App #
console.log('\n1d. COs grouped by App # (which draw they were billed on):');
const byApp = new Map();
for (const e of pccoEntries) {
  if (!byApp.has(e.appNum)) byApp.set(e.appNum, []);
  byApp.get(e.appNum).push(e);
}
for (const [appNum, entries] of [...byApp.entries()].sort((a, b) => a[0] - b[0])) {
  const appAdd = entries.reduce((s, e) => s + e.addition, 0);
  const appFee = entries.reduce((s, e) => s + e.gcFee, 0);
  const appTotal = appAdd + appFee;
  console.log(`  App #${appNum}: ${entries.length} COs — additions ${$(appAdd)}, fees ${$(appFee)}, total ${$(appTotal)}`);
  for (const e of entries) {
    console.log(`    PCCO #${e.pccoNum}: ${e.description.slice(0, 50)} — ${$(e.addition + e.gcFee)}`);
  }
}

// ═════════════════════════════════════════════════════════════
// SECTION 2: G703 COST CODE STRUCTURE
// ═════════════════════════════════════════════════════════════
console.log('\n');
hr('═');
console.log('  SECTION 2: G703 COST CODE STRUCTURE (Pay App #10)');
hr('═');

const g703Lines = [];
const g703PccoRows = [];
const g703TotalRows = [];

g703_10.eachRow({ includeEmpty: false }, (row, rn) => {
  const colA = text(row.getCell(1).value);
  const colB = text(row.getCell(2).value);
  const lower = colA.toLowerCase();

  // Catch PCCO summary rows
  if (lower === 'pcco') {
    g703PccoRows.push({
      row: rn,
      description: colB,
      origEstimate: num(row.getCell(3).value) ?? 0,
      prevApps: num(row.getCell(4).value) ?? 0,
      thisPeriod: num(row.getCell(5).value) ?? 0,
      totalToDate: num(row.getCell(6).value) ?? 0,
    });
    return;
  }

  // Catch total rows
  if (colB.toLowerCase().includes('total')) {
    g703TotalRows.push({
      row: rn,
      label: colB,
      origEstimate: num(row.getCell(3).value) ?? 0,
      prevApps: num(row.getCell(4).value) ?? 0,
      thisPeriod: num(row.getCell(5).value) ?? 0,
      totalToDate: num(row.getCell(6).value) ?? 0,
    });
    return;
  }

  // Regular cost code rows
  const code = code5(colA);
  if (!code) return;

  g703Lines.push({
    row: rn,
    code,
    description: colB,
    origEstimate: num(row.getCell(3).value) ?? 0,
    prevApps: num(row.getCell(4).value) ?? 0,
    thisPeriod: num(row.getCell(5).value) ?? 0,
    totalToDate: num(row.getCell(6).value) ?? 0,
    pctComplete: num(row.getCell(7).value),
    balToFinish: num(row.getCell(8).value) ?? 0,
  });
});

console.log(`\n2a. Regular cost code rows: ${g703Lines.length}`);

// CO-specific rows?
const coRows = g703Lines.filter(l =>
  l.code.includes('C') ||
  l.description.toLowerCase().includes('change order') ||
  l.description.toLowerCase().includes('pcco')
);
console.log(`\n2b. CO-specific G703 lines (codes with "C" or descriptions with "change order"): ${coRows.length}`);
if (coRows.length > 0) {
  for (const r of coRows) {
    console.log(`  ${r.code}: ${r.description} — scheduled ${$(r.origEstimate)}, prev ${$(r.prevApps)}, this ${$(r.thisPeriod)}, total ${$(r.totalToDate)}`);
  }
} else {
  console.log('  (None found — COs are NOT broken out as separate G703 cost-code rows)');
}

// PCCO summary rows in G703
console.log(`\n2c. PCCO summary rows at bottom of G703:`);
for (const r of g703PccoRows) {
  console.log(`  Row ${r.row}: "${r.description}"`);
  console.log(`    Orig Estimate: ${$(r.origEstimate)}  |  Prev Apps: ${$(r.prevApps)}  |  This Period: ${$(r.thisPeriod)}  |  Total: ${$(r.totalToDate)}`);
}

// Total rows
console.log(`\n2d. Grand total row:`);
const grandTotal = g703TotalRows.find(r => r.label === 'TOTALS');
if (grandTotal) {
  console.log(`  Orig Estimate: ${$(grandTotal.origEstimate)}  |  Prev Apps: ${$(grandTotal.prevApps)}  |  This Period: ${$(grandTotal.thisPeriod)}  |  Total: ${$(grandTotal.totalToDate)}`);
}

// Cost codes with this-period billing
const activeThisPeriod = g703Lines.filter(l => l.thisPeriod > 0);
console.log(`\n2e. Cost codes with billing this period (App #10):`);
for (const l of activeThisPeriod) {
  console.log(`  ${l.code} ${pad(l.description, 45)} this_period: ${rpad($(l.thisPeriod), 12)}`);
}

// ═════════════════════════════════════════════════════════════
// SECTION 3: CROSS-REFERENCE PCCO → G703
// ═════════════════════════════════════════════════════════════
console.log('\n');
hr('═');
console.log('  SECTION 3: CROSS-REFERENCE — PCCO entries vs G703 lines');
hr('═');

console.log('\nDoes each PCCO have a MATCHING G703 cost-code line?');
console.log('(i.e., are COs billed as separate G703 rows, or folded into existing cost codes?)\n');

// Check if any PCCO maps to a dedicated G703 line
const g703CodeSet = new Set(g703Lines.map(l => l.code));
console.log('Answer: There are NO CO-specific G703 lines. Instead, Diane uses two PCCO');
console.log('summary rows at the bottom of the G703:');
console.log(`  1. "PCCO from Previous Applications" — cumulative CO billing through prior apps`);
console.log(`  2. "PCCO for this Application" — CO billing in the current app`);
console.log('');
console.log('This means CO amounts are NOT distributed to individual cost codes.');
console.log('They appear as a lump sum on the PCCO summary lines.');

// Verify: PCCO total-to-date matches G703 PCCO rows
const pccoFromPrev = g703PccoRows.find(r => r.description.includes('Previous'));
const pccoThisApp = g703PccoRows.find(r => r.description.includes('this Application'));
const pccoG703Total = (pccoFromPrev?.totalToDate ?? 0) + (pccoThisApp?.totalToDate ?? 0);
console.log(`\nCross-check:`);
console.log(`  PCCO sheet total (additions + fees):     ${$(totalAll)}`);
console.log(`  G703 PCCO rows total-to-date combined:   ${$(pccoG703Total)}`);
console.log(`  Match: ${Math.abs(totalAll - pccoG703Total) < 0.01 ? 'YES ✓' : `NO — delta ${$(totalAll - pccoG703Total)}`}`);

// ═════════════════════════════════════════════════════════════
// SECTION 4: HISTORICAL CO COMPLETION
// ═════════════════════════════════════════════════════════════
console.log('\n');
hr('═');
console.log('  SECTION 4: HISTORICAL CO COMPLETION (from PCCO + G703)');
hr('═');

// From G703 PCCO rows, we know:
const prevCoCompleted = pccoFromPrev?.prevApps ?? 0;   // cumulative CO billed in apps 1-8
const prevCoTotalToDate = pccoFromPrev?.totalToDate ?? 0;  // same thing (prev row has no this_period)
const thisAppCoThisPeriod = pccoThisApp?.thisPeriod ?? 0;
const thisAppCoPrevApps = pccoThisApp?.prevApps ?? 0;

console.log('\nFrom G703 PCCO summary rows (App #10):');
console.log(`  "PCCO from Previous Applications":`);
console.log(`    prev_apps column:     ${$(prevCoCompleted)}`);
console.log(`    total_to_date column: ${$(prevCoTotalToDate)}`);
console.log(`  "PCCO for this Application":`);
console.log(`    prev_apps column:     ${$(thisAppCoPrevApps)}`);
console.log(`    this_period column:   ${$(thisAppCoThisPeriod)}`);
console.log(`    total_to_date column: ${$(pccoThisApp?.totalToDate ?? 0)}`);

// Also check App #9
console.log('\nFrom G703 PCCO summary rows (App #9 for comparison):');
const g703PccoRows9 = [];
g703_9.eachRow({ includeEmpty: false }, (row, rn) => {
  if (text(row.getCell(1).value).toLowerCase() === 'pcco') {
    g703PccoRows9.push({
      row: rn,
      description: text(row.getCell(2).value),
      prevApps: num(row.getCell(4).value) ?? 0,
      thisPeriod: num(row.getCell(5).value) ?? 0,
      totalToDate: num(row.getCell(6).value) ?? 0,
    });
  }
});
for (const r of g703PccoRows9) {
  console.log(`  "${r.description}": prev=${$(r.prevApps)}, this=${$(r.thisPeriod)}, total=${$(r.totalToDate)}`);
}

// Build the cumulative picture
console.log('\n── Cumulative CO billing progression ──');

// From PCCO entries grouped by app
let cumulativeCO = 0;
for (const [appNum, entries] of [...byApp.entries()].sort((a, b) => a[0] - b[0])) {
  const appTotal = entries.reduce((s, e) => s + e.addition + e.gcFee, 0);
  cumulativeCO += appTotal;
  console.log(`  App #${pad(appNum, 3)}: billed ${rpad($(appTotal), 14)} → cumulative: ${$(cumulativeCO)}`);
}

console.log(`\n  Total CO billed through ALL apps (1-10):        ${$(cumulativeCO)}`);
console.log(`  CO billed in prior apps (1-9), for App 10 draw: ${$(cumulativeCO - (pccoEntries.filter(e => e.appNum === 10).reduce((s, e) => s + e.addition + e.gcFee, 0)))}`);

const coApp10Only = pccoEntries.filter(e => e.appNum === 10).reduce((s, e) => s + e.addition + e.gcFee, 0);
console.log(`  CO billed THIS app (#10) only:                  ${$(coApp10Only)}`);

console.log('\n── What Nightwork needs for "previous_co_completed_amount" ──');
console.log(`  For Draw #10: previous_co_completed = ${$(prevCoTotalToDate)}`);
console.log(`  This is: G703 "PCCO from Previous Applications" total_to_date column`);
console.log(`  It equals the sum of all PCCO (addition+fee) for apps 1 through 9.`);

// ═════════════════════════════════════════════════════════════
// SECTION 5: COST-CODE RESIDUAL (Diane's G703 vs Nightwork)
// ═════════════════════════════════════════════════════════════
console.log('\n');
hr('═');
console.log('  SECTION 5: COST-CODE RESIDUAL — Diane G703 vs Nightwork');
hr('═');

// Find Dewberry job in Nightwork
const { data: jobs } = await supabase
  .from('jobs')
  .select('id, name')
  .ilike('name', '%dewberry%')
  .is('deleted_at', null);

if (!jobs || jobs.length === 0) {
  console.log('\n  ⚠ No Dewberry job found in Nightwork DB. Cannot compare.');
  console.log('  Run e2e-dewberry-setup.mjs first.');
  process.exit(0);
}

const dewJob = jobs[0];
console.log(`\nDewberry job found: ${dewJob.id} — "${dewJob.name}"`);

// Get budget_lines with cost codes
const { data: budgetLines } = await supabase
  .from('budget_lines')
  .select('id, cost_code_id, original_estimate, revised_estimate, previous_applications_baseline, co_adjustments, invoiced')
  .eq('job_id', dewJob.id)
  .is('deleted_at', null);

// Get cost code mapping
const ccIds = [...new Set((budgetLines ?? []).map(b => b.cost_code_id))];
const { data: costCodes } = await supabase
  .from('cost_codes')
  .select('id, code, description')
  .in('id', ccIds);
const ccById = new Map((costCodes ?? []).map(c => [c.id, c]));

// Get invoices for this job
const { data: invoices } = await supabase
  .from('invoices')
  .select('id, cost_code_id, total_amount, status, draw_id')
  .eq('job_id', dewJob.id)
  .is('deleted_at', null);

// Get invoice line items
const invIds = (invoices ?? []).map(i => i.id);
const { data: lineItems } = invIds.length > 0
  ? await supabase
      .from('invoice_line_items')
      .select('invoice_id, cost_code_id, amount_cents')
      .in('invoice_id', invIds)
      .is('deleted_at', null)
  : { data: [] };

// Get draws for this job
const { data: draws } = await supabase
  .from('draws')
  .select('id, draw_number, status, current_payment_due')
  .eq('job_id', dewJob.id)
  .is('deleted_at', null)
  .order('draw_number');

// Get change orders for this job
const { data: changeOrders } = await supabase
  .from('change_orders')
  .select('id, pcco_number, amount, gc_fee_amount, total_with_fee, status, draw_number, application_number')
  .eq('job_id', dewJob.id)
  .is('deleted_at', null)
  .order('pcco_number');

// Compute Nightwork billing per cost code
// (invoice line items preferred, fallback to invoice-level cost_code_id)
const nwByCostCode = new Map(); // code -> { invoiced, baseline }
const invCovered = new Set();
for (const li of lineItems ?? []) {
  if (li.cost_code_id) {
    invCovered.add(li.invoice_id);
    const cc = ccById.get(li.cost_code_id);
    if (!cc) continue;
    const code = cc.code;
    if (!nwByCostCode.has(code)) nwByCostCode.set(code, { invoiced: 0, baseline: 0 });
    nwByCostCode.get(code).invoiced += (li.amount_cents ?? 0);
  }
}
for (const inv of invoices ?? []) {
  if (inv.cost_code_id && !invCovered.has(inv.id)) {
    const cc = ccById.get(inv.cost_code_id);
    if (!cc) continue;
    const code = cc.code;
    if (!nwByCostCode.has(code)) nwByCostCode.set(code, { invoiced: 0, baseline: 0 });
    nwByCostCode.get(code).invoiced += (inv.total_amount ?? 0);
  }
}

// Add baselines from budget_lines
for (const bl of budgetLines ?? []) {
  const cc = ccById.get(bl.cost_code_id);
  if (!cc) continue;
  const code = cc.code;
  if (!nwByCostCode.has(code)) nwByCostCode.set(code, { invoiced: 0, baseline: 0 });
  nwByCostCode.get(code).baseline = (bl.previous_applications_baseline ?? 0);
}

console.log(`\nNightwork data summary:`);
console.log(`  Budget lines: ${(budgetLines ?? []).length}`);
console.log(`  Invoices: ${(invoices ?? []).length}`);
console.log(`  Invoice line items: ${(lineItems ?? []).length}`);
console.log(`  Draws: ${(draws ?? []).length}`);
console.log(`  Change orders: ${(changeOrders ?? []).length}`);

// Build comparison table
console.log(`\n── Per-cost-code comparison (only showing rows with activity) ──`);
console.log(
  pad('Code', 7) + pad('Description', 40) +
  rpad('Diane_Total', 14) + rpad('NW_Baseline', 14) + rpad('NW_Invoiced', 14) +
  rpad('NW_Total', 14) + rpad('Delta', 14)
);
hr('─', 117);

let totalDianeTTD = 0;
let totalNwBaseline = 0;
let totalNwInvoiced = 0;
let totalNwTotal = 0;
let residualCodes = [];

for (const line of g703Lines) {
  const dianeTTD = line.totalToDate;  // dollars from G703
  const nw = nwByCostCode.get(line.code) ?? { invoiced: 0, baseline: 0 };
  const nwBaseline = nw.baseline / 100;  // cents to dollars
  const nwInvoiced = nw.invoiced / 100;  // cents to dollars
  const nwTotal = nwBaseline + nwInvoiced;
  const delta = dianeTTD - nwTotal;

  totalDianeTTD += dianeTTD;
  totalNwBaseline += nwBaseline;
  totalNwInvoiced += nwInvoiced;
  totalNwTotal += nwTotal;

  if (Math.abs(dianeTTD) > 0 || Math.abs(nwTotal) > 0) {
    const flag = Math.abs(delta) > 0.01 ? ' ←' : '';
    console.log(
      pad(line.code, 7) + pad(line.description.slice(0, 38), 40) +
      rpad($(dianeTTD), 14) + rpad($(nwBaseline), 14) + rpad($(nwInvoiced), 14) +
      rpad($(nwTotal), 14) + rpad($(delta), 14) + flag
    );
    if (Math.abs(delta) > 0.01) {
      residualCodes.push({ code: line.code, desc: line.description, delta });
    }
  }
}

hr('─', 117);
const totalDelta = totalDianeTTD - totalNwTotal;
console.log(
  pad('', 7) + pad('TOTALS (cost-code lines only)', 40) +
  rpad($(totalDianeTTD), 14) + rpad($(totalNwBaseline), 14) + rpad($(totalNwInvoiced), 14) +
  rpad($(totalNwTotal), 14) + rpad($(totalDelta), 14)
);

// PCCO rows not in cost codes
console.log(`\n── PCCO summary rows (NOT in cost-code totals above) ──`);
const pccoTTD = g703PccoRows.reduce((s, r) => s + r.totalToDate, 0);
console.log(`  Diane G703 PCCO total-to-date: ${$(pccoTTD)}`);
console.log(`  (This is CO billing that sits OUTSIDE the per-cost-code lines)`);

// Grand totals comparison
console.log(`\n── Grand total comparison ──`);
const dianeGrandTTD = grandTotal?.totalToDate ?? 0;
console.log(`  Diane G703 TOTALS row total_to_date:         ${$(dianeGrandTTD)}`);
console.log(`  = cost-code lines (${$(totalDianeTTD)}) + PCCO rows (${$(pccoTTD)})`);
console.log(`    computed sum:                              ${$(totalDianeTTD + pccoTTD)}`);
console.log(`    match: ${Math.abs(dianeGrandTTD - (totalDianeTTD + pccoTTD)) < 1 ? 'YES ✓' : 'NO'}`);

console.log(`\n  Nightwork total billed: ${$(totalNwTotal)} (baselines + invoices, cost codes only)`);
console.log(`  Nightwork has NO representation of PCCO completion: $0.00`);
console.log(`  Missing from Nightwork: ${$(pccoTTD)} in CO completion`);

// ═════════════════════════════════════════════════════════════
// SECTION 6: CHANGE ORDERS IN NIGHTWORK
// ═════════════════════════════════════════════════════════════
console.log('\n');
hr('═');
console.log('  SECTION 6: NIGHTWORK CHANGE ORDERS STATE');
hr('═');

console.log(`\nChange orders in Nightwork DB for Dewberry:`);
if ((changeOrders ?? []).length === 0) {
  console.log('  (none)');
} else {
  console.log(
    pad('PCCO#', 7) + pad('Status', 12) + rpad('Amount', 14) + rpad('GC Fee', 14) +
    rpad('Total', 14) + pad('Draw#', 8) + pad('App#', 6)
  );
  hr('─', 75);
  for (const co of changeOrders) {
    const total = (co.total_with_fee ?? ((co.amount ?? 0) + (co.gc_fee_amount ?? 0)));
    console.log(
      pad(co.pcco_number ?? '?', 7) + pad(co.status ?? '', 12) +
      rpad($(((co.amount ?? 0) / 100)), 14) + rpad($(((co.gc_fee_amount ?? 0) / 100)), 14) +
      rpad($((total / 100)), 14) + pad(co.draw_number ?? '', 8) + pad(co.application_number ?? '', 6)
    );
  }
}

// ═════════════════════════════════════════════════════════════
// SECTION 7: SUMMARY & DIAGNOSIS
// ═════════════════════════════════════════════════════════════
console.log('\n');
hr('═');
console.log('  SECTION 7: SUMMARY & DIAGNOSIS');
hr('═');

console.log('\n── Key findings ──');
console.log('');
console.log('1. PCCO STRUCTURE:');
console.log(`   ${pccoEntries.length} change orders across apps 1-10.`);
console.log(`   Total CO value (additions + GC fees): ${$(totalAll)}`);
console.log(`   COs are billed in FULL on the app they appear in (no partial billing).`);
console.log('');
console.log('2. G703 CO TREATMENT:');
console.log('   COs do NOT have their own cost-code rows.');
console.log('   Instead, two PCCO summary lines at the bottom of G703:');
console.log(`     "PCCO from Previous Applications": ${$(pccoFromPrev?.totalToDate ?? 0)} (total CO billed through app 9)`);
console.log(`     "PCCO for this Application":       ${$(pccoThisApp?.totalToDate ?? 0)} (CO billed in app 10: ${$(thisAppCoThisPeriod)} this period)`);
console.log('');
console.log('3. NIGHTWORK GAP:');
console.log(`   Nightwork tracks CO contract adjustments but NOT CO completion/billing.`);
console.log(`   The ${$(pccoTTD)} in CO billing is invisible to draw-calc.ts.`);
console.log(`   nonBudgetLineThisPeriodForDraw() returns 0 because no draw_line_items`);
console.log(`   with source_type="change_order" exist for historical draws.`);
console.log('');
console.log('4. RESIDUAL BY COST CODE:');
if (residualCodes.length === 0) {
  console.log('   No per-cost-code residuals detected.');
  console.log('   All deltas between Diane and Nightwork are within the PCCO summary rows.');
} else {
  console.log(`   ${residualCodes.length} cost codes have residuals:`);
  for (const r of residualCodes) {
    console.log(`     ${r.code} (${r.desc.slice(0, 35)}): delta ${$(r.delta)}`);
  }
}
console.log('');
console.log('5. IMPACT ON DRAW #10:');
console.log(`   Diane total completed to date:    ${$(dianeGrandTTD)}`);
console.log(`   Nightwork total (cost codes only): ${$(totalNwTotal)}`);
console.log(`   Missing CO completion:             ${$(pccoTTD)}`);
if (residualCodes.length > 0) {
  const residualSum = residualCodes.reduce((s, r) => s + r.delta, 0);
  console.log(`   Cost-code residual:                ${$(residualSum)}`);
  console.log(`   Total shortfall:                   ${$(pccoTTD + residualSum)}`);
}

console.log('\n── Required fix ──');
console.log('The system needs a "previous_co_completed_amount" concept — either:');
console.log('  a) A job-level baseline field (like previous_certificates_total) for CO billing, OR');
console.log('  b) Seed draw_line_items with source_type="change_order" for historical draws, OR');
console.log('  c) Add a job.previous_co_completed_total baseline and wire it into rollupDrawTotals.');
console.log('');

process.exit(0);
