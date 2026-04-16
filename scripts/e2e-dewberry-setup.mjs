// Set up the Dewberry job + budget in one pass.
// 1. Parse the pay app G703 to get scheduled values + prior billing.
// 2. Insert the Dewberry job (original_contract = PCCO beginning amount).
// 3. Insert budget_lines with original_estimate and previous_applications_baseline.
import ExcelJS from 'exceljs';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'node:path';
import { writeFileSync } from 'node:fs';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const FILE = 'C:/Users/Jake/Ross-Built-Command/test-invoices/Dewberry-681_KRD-Pay_App_9_Jan-Feb_26.xlsx';
const ORG_ID = '00000000-0000-0000-0000-000000000001';
const BOB_ID = 'a0000000-0000-0000-0000-000000000004';
const JAKE_ID = 'a0000000-0000-0000-0000-000000000001';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

// ─── Parse ───────────────────────────────────────────────
const wb = new ExcelJS.Workbook();
await wb.xlsx.readFile(FILE);
const g703 = wb.worksheets.find((s) => /G703|Line Item/i.test(s.name));
const pcco = wb.worksheets.find((s) => /PCCO|Change Order Log/i.test(s.name));
if (!g703 || !pcco) throw new Error('expected G703 and PCCO sheets');

function text(v) { if (v == null) return ''; if (typeof v === 'string') return v.trim(); if (typeof v === 'number') return String(v); if (typeof v === 'object') { if (typeof v.text === 'string') return v.text.trim(); if (v.result != null) return text(v.result); if (Array.isArray(v.richText)) return v.richText.map(r=>r.text).join('').trim(); } return String(v).trim(); }
function num(v) { if (v == null || v === '') return null; if (typeof v === 'number') return isFinite(v) ? v : null; if (typeof v === 'object' && v.result != null) return num(v.result); const s = String(v).replace(/[$,\s]/g, ''); const n = Number(s); return isFinite(n) ? n : null; }
function code5(raw) { const d = raw.replace(/[^\d]/g, ''); if (d.length === 5) return d; if (d.length === 4) return '0' + d; if (d.length === 3) return '00' + d; return null; }

// PCCO row 9 "BEGINNING CONTRACT AMOUNT" = original contract.
const originalContract = num(pcco.getRow(9).getCell(4).value);
console.log('Original contract (from PCCO row 9 col 4):', originalContract);

// Parse G703 rows.
const rows = [];
g703.eachRow({ includeEmpty: false }, (row, rn) => {
  const codeRaw = text(row.getCell(1).value);
  const desc = text(row.getCell(2).value);
  const est = num(row.getCell(3).value);
  const prev = num(row.getCell(4).value);
  const code = code5(codeRaw);
  if (!code) return;
  if (est == null) return;
  rows.push({
    rowNumber: rn,
    code,
    description: desc,
    original_estimate: Math.round(est * 100),
    previous_applications_baseline: Math.round((prev ?? 0) * 100),
  });
});

console.log(`G703 budget lines parsed: ${rows.length}`);
console.log(`Sum of original estimates: $${(rows.reduce((s, r) => s + r.original_estimate, 0) / 100).toFixed(2)}`);
console.log(`Sum of prior billing:      $${(rows.reduce((s, r) => s + r.previous_applications_baseline, 0) / 100).toFixed(2)}`);

// ─── Create Job ──────────────────────────────────────────
const { data: job, error: jobErr } = await supabase
  .from('jobs')
  .insert({
    org_id: ORG_ID,
    name: 'Dewberry Residence',
    address: '681 Key Royale Dr, Holmes Beach, FL 34217',
    client_name: 'Kevin and Robin Dewberry',
    contract_type: 'cost_plus',
    original_contract_amount: Math.round(originalContract * 100),
    current_contract_amount: Math.round(originalContract * 100),
    approved_cos_total: 0,
    pm_id: BOB_ID,
    status: 'active',
    deposit_percentage: 0.10,
    gc_fee_percentage: 0.20,
    retainage_percent: 0,
    created_by: JAKE_ID,
  })
  .select('id, name')
  .single();
if (jobErr) throw jobErr;
console.log(`Created job: ${job.id}`);

// ─── Cost-code lookup ────────────────────────────────────
const uniqueCodes = Array.from(new Set(rows.map((r) => r.code)));
const { data: ccRows } = await supabase
  .from('cost_codes')
  .select('id, code')
  .in('code', uniqueCodes)
  .is('deleted_at', null);
const byCode = new Map(ccRows.map((c) => [c.code, c.id]));
const unmatched = uniqueCodes.filter((c) => !byCode.has(c));
console.log(`Cost codes matched: ${byCode.size} / ${uniqueCodes.length}`);
if (unmatched.length) console.log(`Unmatched: ${unmatched.join(', ')}`);

// ─── Insert budget_lines ─────────────────────────────────
const toInsert = [];
for (const r of rows) {
  const ccId = byCode.get(r.code);
  if (!ccId) continue;
  toInsert.push({
    job_id: job.id,
    cost_code_id: ccId,
    original_estimate: r.original_estimate,
    revised_estimate: r.original_estimate,
    previous_applications_baseline: r.previous_applications_baseline,
    org_id: ORG_ID,
  });
}
const { error: blErr } = await supabase.from('budget_lines').insert(toInsert);
if (blErr) throw blErr;
console.log(`Inserted ${toInsert.length} budget lines with prior-billing baselines.`);

writeFileSync('e2e-state.json', JSON.stringify({
  dewberry_job_id: job.id,
  original_contract_dollars: originalContract,
  budget_lines_count: toInsert.length,
  prior_billing_total_dollars: rows.reduce((s, r) => s + r.previous_applications_baseline, 0) / 100,
}, null, 2));
console.log('\nState written to e2e-state.json');
