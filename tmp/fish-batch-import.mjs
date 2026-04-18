/**
 * Batch import 39 Fish invoices.
 * Uses the same Claude API parser + Supabase save pipeline as the app.
 * Calls saveParsedInvoice indirectly by replicating its logic via service role.
 */
import Anthropic from '@anthropic-ai/sdk';
import { readFileSync } from 'fs';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'node:path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const anthropic = new Anthropic();
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

const ORG_ID = '00000000-0000-0000-0000-000000000001';
const FISH_JOB_ID = '92a38296-9ad0-4fce-9a84-ca19e2bcf3fb';
const DIR = 'test-invoices/fish-invoices';

// ---- Files to skip (already uploaded) ----
const SKIP = new Set([
  '01_Metro_Electric_60431_FPL_Dig.pdf',
  '02_Spectrum_Business_Feb2026.pdf',
  '10_Home_Depot_Receipts.pdf',
  '19_Climatic_Conditioning_11746-5J.pdf',
  '33_Triple_H_Painting_Inv2.pdf',
  '45_Sight_To_See_1195.pdf',
]);

// ---- Files that are receipts (document_type = 'receipt') ----
const RECEIPT_NUMBERS = new Set([9,15,16,17,23,24,25,26,28,29,31,32,39,40,41,42,43]);
function isReceipt(filename) {
  const num = parseInt(filename.split('_')[0], 10);
  return RECEIPT_NUMBERS.has(num);
}

// ---- All files in order ----
const ALL_FILES = [
  '03_FPL_Electric_Utility.pdf',
  '04_Clean_Cans_INV-2026-2563.pdf',
  '05_Clean_Cans_INV-2025-9836.pdf',
  '06_Clean_Cans_INV-2025-8233.pdf',
  '07_Ecosouth_Roll_Off.pdf',
  '08_Mobile_Modular_Storage.pdf',
  '09_Island_Lumber_531929_FloorProt.pdf',
  '11_Suncoast_Precision_SlabCut.pdf',
  '12_Island_Lumber_532452_ImpactBits.pdf',
  '13_Island_Lumber_532369_Screws.pdf',
  '14_Island_Lumber_532330_SawBlades.pdf',
  '15_Island_Lumber_532129_Lumber.pdf',
  '16_Island_Lumber_532160_Plywood.pdf',
  '17_Island_Lumber_532266_Timberstrand.pdf',
  '18_Metro_Electric_60352_Molinari.pdf',
  '20_Climatic_Conditioning_11746-4J.pdf',
  '21_Rangel_Custom_Tile_320263.pdf',
  '22_Sight_To_See_1194.pdf',
  '23_Island_Lumber_532975_Lattice.pdf',
  '24_Island_Lumber_532886_BladesHeat.pdf',
  '25_Island_Lumber_532826_Lattice8ft.pdf',
  '26_Island_Lumber_532519_Sanding.pdf',
  '27_MJ_Florida_SubApp6.pdf',
  '28_Island_Lumber_533340_Sealant.pdf',
  '29_Island_Lumber_532229_Brads.pdf',
  '30_Triple_H_Architectural_17967.pdf',
  '31_Home_Depot_Posts.pdf',
  '32_Island_Lumber_532398_Concrete.pdf',
  '34_Universal_Windows_Solutions.pdf',
  '35_Screens_Plus.pdf',
  '36_Metro_Electric_60433_WellPump.pdf',
  '37_Metro_Electric_60432_Conduit.pdf',
  '38_Volcano_Stone_08192044AH.pdf',
  '39_Island_Lumber_532993_Lattice16.pdf',
  '40_Island_Lumber_533109_Multi.pdf',
  '41_Island_Lumber_533153_Lumber.pdf',
  '42_Island_Lumber_533254_Lumber.pdf',
  '43_Island_Lumber_533217_Drill.pdf',
  '44_Triple_H_Architectural_18019.pdf',
];
// 39 files total

// ---- Get cost codes for prompt ----
const { data: codes } = await supabase
  .from('cost_codes')
  .select('code, description, category, is_change_order')
  .is('deleted_at', null)
  .order('sort_order');
const codeList = (codes || [])
  .map(c => `${c.code} - ${c.description} [${c.category}]${c.is_change_order ? ' (CO)' : ''}`)
  .join('\n');

// ---- Build the exact same prompt as production ----
const costCodeSection = codeList
  ? `\n\nAlso suggest the most likely cost code from the list below. If the invoice references a change order (CO, PCCO, change order, extra work, additional), prefer the C-variant code. Return your suggestion in the cost_code_suggestion field.\n\nFor each line item, ALSO suggest the most appropriate cost code based on the line item description. A single invoice often spans multiple cost codes. Return a per-line suggestion in line_items[].cost_code_suggestion when you can identify a likely code.\n\nCOST CODES:\n${codeList}`
  : '';

const PROMPT = `You are parsing a construction document for a luxury custom home builder running cost-plus (open book) projects.

FIRST: Determine the document type. Is this an invoice, a proposal/agreement, a quote/estimate, a credit memo, a statement, or unknown? Set "document_type" accordingly.

Extract every field you can find. For fields you cannot find, return null. Be thorough — look for vendor info, invoice numbers, dates, PO references, job/project references, line item details, and totals.

For T&M (time and materials) invoices with daily labor entries, parse each line with crew size, hours, and rate. Verify that the total equals the sum of line amounts.

CHANGE ORDER DETECTION (MANDATORY — BIAS TOWARD TRUE): Determine if this invoice is likely a change order. Set is_change_order: true at the invoice level if ANY of the following phrases appear anywhere on the document (case-insensitive, partial match):
 - "change order", "CO #", "PCCO"
 - "additional", "extra", "added" (any form of the word)
 - "beyond scope", "beyond original scope", "not in original"
 - "revision", "revised", "modification", "modified"
 - "extension required", "extensions required", "added extensions"
 - "relocated", "relocation"
 - General references to work not typically in an original contract
When in doubt, prefer is_change_order: true.
If is_change_order is true at the invoice level, suggest which PCCO number it might relate to in co_reference. Also prefer the C-variant cost code in cost_code_suggestion.
ALSO determine is_change_order at the line-item level.

MATH CHECK (MANDATORY): You MUST verify that the sum of all line item amounts equals the stated subtotal and total. If any checks fail (difference > $0.01), you MUST include "math_mismatch" in the flags array.

Set confidence_score from 0.0 to 1.0. Set per-field confidence in confidence_details.

Flag issues in the flags array: no_invoice_number, handwritten_detected, math_mismatch, blurry_or_low_quality, multi_page, credit_memo, not_an_invoice, change_order, mixed_cost_codes${costCodeSection}

Return ONLY valid JSON matching this exact schema (no markdown, no code fences):

{
 "document_type": "invoice | proposal | quote | credit_memo | statement | unknown",
 "vendor_name": "string",
 "vendor_address": "string | null",
 "invoice_number": "string | null",
 "invoice_date": "YYYY-MM-DD | null",
 "po_reference": "string | null",
 "job_reference": "string | null",
 "description": "string",
 "invoice_type": "progress | time_and_materials | lump_sum",
 "is_change_order": "boolean",
 "co_reference": "string | null",
 "line_items": [
 {
 "description": "string",
 "date": "YYYY-MM-DD | null",
 "qty": "number | null",
 "unit": "string | null",
 "rate": "number | null",
 "amount": "number",
 "is_change_order": "boolean",
 "co_reference": "string | null",
 "cost_code_suggestion": {
 "code": "string | null",
 "description": "string | null",
 "confidence": "number 0.0-1.0"
 }
 }
 ],
 "subtotal": "number",
 "tax": "number | null",
 "total_amount": "number",
 "confidence_score": "number 0.0-1.0",
 "confidence_details": {
 "vendor_name": "number 0.0-1.0",
 "invoice_number": "number 0.0-1.0",
 "total_amount": "number 0.0-1.0",
 "job_reference": "number 0.0-1.0",
 "cost_code_suggestion": "number 0.0-1.0"
 },
 "cost_code_suggestion": {
 "code": "string",
 "description": "string",
 "confidence": "number 0.0-1.0",
 "is_change_order": "boolean"
 },
 "flags": ["string"]
}

All dollar amounts should be in dollars (not cents). We convert to cents on our end.`;

// ---- Vendor matching (same logic as production save.ts) ----
const VENDOR_SUFFIXES = /\b(llc|inc|co|corp|ltd|company|enterprises|services)\b\.?/gi;
function normalizeVendorName(name) {
  return name.replace(VENDOR_SUFFIXES, '').replace(/[.,]+/g, '').trim().toLowerCase();
}

async function matchVendor(vendorName) {
  const normalizedNew = normalizeVendorName(vendorName);
  if (!normalizedNew) return null;
  const newTokens = new Set(normalizedNew.split(/\s+/).filter(w => w.length >= 3));
  if (newTokens.size === 0) return null;
  const firstToken = Array.from(newTokens)[0];
  const { data } = await supabase.from('vendors').select('id, name')
    .ilike('name', `%${firstToken}%`).is('deleted_at', null).limit(25);
  const candidates = data ?? [];
  for (const c of candidates) {
    const ne = normalizeVendorName(c.name);
    if (!ne) continue;
    if (ne.includes(normalizedNew) || normalizedNew.includes(ne)) return c;
    const existingTokens = new Set(ne.split(/\s+/).filter(w => w.length >= 3));
    let overlap = 0;
    newTokens.forEach(t => { if (existingTokens.has(t)) overlap++; });
    if (overlap >= 2) return c;
  }
  return null;
}

async function findOrCreateVendor(vendorName) {
  const matched = await matchVendor(vendorName);
  if (matched) return matched;
  const { data, error } = await supabase.from('vendors')
    .insert({ name: vendorName.trim(), org_id: ORG_ID }).select('id, name').single();
  if (error || !data) throw new Error(`Failed to create vendor: ${error?.message}`);
  return data;
}

// ---- Cost code matching ----
async function matchCostCode(code) {
  const { data } = await supabase.from('cost_codes').select('id, code, description, is_change_order')
    .eq('code', code).is('deleted_at', null).limit(1);
  return data?.[0] ?? null;
}

// ---- Budget line lookup ----
async function findBudgetLine(jobId, costCodeId) {
  if (!jobId || !costCodeId) return null;
  const { data } = await supabase.from('budget_lines').select('id')
    .eq('job_id', jobId).eq('cost_code_id', costCodeId).is('deleted_at', null).limit(1);
  return data?.[0]?.id ?? null;
}

// ---- Payment date calculation ----
function computePaymentDate(receivedDate) {
  const d = new Date(receivedDate);
  const day = d.getDate();
  let payDate;
  if (day <= 5) {
    payDate = new Date(d.getFullYear(), d.getMonth(), 15);
  } else if (day <= 20) {
    payDate = new Date(d.getFullYear(), d.getMonth() + 1, 0); // last day of month
  } else {
    payDate = new Date(d.getFullYear(), d.getMonth() + 1, 15);
  }
  // Skip weekends
  const dow = payDate.getDay();
  if (dow === 0) payDate.setDate(payDate.getDate() + 1);
  if (dow === 6) payDate.setDate(payDate.getDate() + 2);
  return payDate.toISOString().split('T')[0];
}

// ---- Determine status based on confidence ----
function determineStatus(confidence) {
  return confidence < 0.7 ? 'qa_review' : 'pm_review';
}

// ---- CO detection keywords ----
const CO_KEYWORDS = [
  'change order', 'co #', 'pcco',
  'additional', 'extra', 'added',
  'beyond scope', 'not in original',
  'revision', 'revised', 'modification', 'modified',
  'extension required', 'extensions required',
  'relocated', 'relocation',
];

// ======== MAIN LOOP ========
const startTime = Date.now();
const results = [];
let successCount = 0;
let failCount = 0;

console.log(`\n${'='.repeat(60)}`);
console.log(`BATCH IMPORT: ${ALL_FILES.length} Fish invoices`);
console.log(`${'='.repeat(60)}\n`);

for (let i = 0; i < ALL_FILES.length; i++) {
  const filename = ALL_FILES[i];
  const filePath = `${DIR}/${filename}`;
  const fileStart = Date.now();
  const docType = isReceipt(filename) ? 'receipt' : 'invoice';

  console.log(`\n[${i+1}/${ALL_FILES.length}] ${filename} (${docType})`);

  try {
    // 1. Read file
    const fileBuffer = readFileSync(filePath);
    const base64 = fileBuffer.toString('base64');

    // 2. Parse with Claude API
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      messages: [{
        role: 'user',
        content: [
          { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } },
          { type: 'text', text: `Parse this invoice file (${filename}). ${PROMPT}` },
        ],
      }],
    });

    const textBlock = response.content.find(b => b.type === 'text');
    const jsonText = textBlock.text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    const parsed = JSON.parse(jsonText);

    const parseDuration = ((Date.now() - fileStart) / 1000).toFixed(1);
    console.log(`  Parsed in ${parseDuration}s | vendor=${parsed.vendor_name} | $${parsed.total_amount} | conf=${parsed.confidence_score}`);

    // 3. Upload to Supabase storage
    const storagePath = `${ORG_ID}/uploads/${Date.now()}_${filename.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const { error: uploadErr } = await supabase.storage.from('invoice-files')
      .upload(storagePath, fileBuffer, { contentType: 'application/pdf' });
    if (uploadErr) console.log(`  Storage upload warning: ${uploadErr.message}`);

    // 4. Vendor match/create
    let vendorId = null;
    if (parsed.vendor_name) {
      try {
        const v = await findOrCreateVendor(parsed.vendor_name);
        vendorId = v.id;
      } catch (e) {
        console.log(`  Vendor match warning: ${e.message}`);
      }
    }

    // 5. Cost code match
    let costCodeId = null;
    let costCodeObj = null;
    if (parsed.cost_code_suggestion?.code && (parsed.cost_code_suggestion.confidence ?? 0) >= 0.8) {
      costCodeObj = await matchCostCode(parsed.cost_code_suggestion.code);
      if (costCodeObj) costCodeId = costCodeObj.id;
    }

    // 6. CO detection
    const aiFlaggedCO = !!(parsed.is_change_order || parsed.cost_code_suggestion?.is_change_order || (parsed.flags || []).includes('change_order'));
    const haystack = [parsed.description, ...(parsed.line_items || []).map(l => l.description ?? '')].join(' ').toLowerCase();
    const keywordHit = CO_KEYWORDS.some(kw => haystack.includes(kw));
    const invoiceIsChangeOrder = aiFlaggedCO || (costCodeObj?.is_change_order ?? false) || !!parsed.co_reference || keywordHit;

    // 7. Status routing
    const today = new Date().toISOString().split('T')[0];
    const paymentDate = computePaymentDate(today);
    const status = determineStatus(parsed.confidence_score);
    const totalCents = Math.round((parsed.total_amount || 0) * 100);

    // 8. Save invoice
    const statusEntry = {
      who: 'system',
      when: new Date().toISOString(),
      old_status: 'received',
      new_status: status,
      note: `AI parsed with ${Math.round(parsed.confidence_score * 100)}% confidence. Auto-routed. Job auto-matched to Fish Residence (filename match).${costCodeId ? ` Cost code auto-assigned: ${costCodeObj.code}.` : ''}`,
    };

    const { data: inv, error: invErr } = await supabase.from('invoices').insert({
      vendor_id: vendorId,
      job_id: FISH_JOB_ID,
      cost_code_id: costCodeId,
      invoice_number: parsed.invoice_number,
      invoice_date: parsed.invoice_date,
      vendor_name_raw: parsed.vendor_name,
      job_reference_raw: parsed.job_reference,
      po_reference_raw: parsed.po_reference,
      description: parsed.description,
      line_items: parsed.line_items || [],
      total_amount: totalCents,
      ai_parsed_total_amount: totalCents,
      is_change_order: invoiceIsChangeOrder,
      invoice_type: parsed.invoice_type,
      co_reference_raw: parsed.co_reference,
      confidence_score: parsed.confidence_score,
      confidence_details: {
        ...parsed.confidence_details,
        cost_code_suggestion: parsed.cost_code_suggestion?.confidence ?? 0,
        auto_fills: { job_id: true, ...(costCodeId ? { cost_code_id: true } : {}) },
      },
      ai_model_used: 'claude-sonnet-4-20250514',
      ai_raw_response: parsed,
      status,
      status_history: [statusEntry],
      received_date: today,
      payment_date: paymentDate,
      original_file_url: storagePath,
      original_filename: filename,
      original_file_type: 'pdf',
      document_category: 'job_cost',
      document_type: docType,
      org_id: ORG_ID,
    }).select('id').single();

    if (invErr) {
      throw new Error(`DB save failed: ${invErr.message}`);
    }

    const invoiceId = inv.id;

    // 9. Save line items to invoice_line_items table
    if (Array.isArray(parsed.line_items) && parsed.line_items.length > 0) {
      const defaultBudgetLineId = await findBudgetLine(FISH_JOB_ID, costCodeId);

      // Pre-resolve per-line cost codes
      const perLineCodes = new Map();
      for (const li of parsed.line_items) {
        const sug = li.cost_code_suggestion;
        if (sug?.code && !perLineCodes.has(sug.code)) {
          const cc = await matchCostCode(sug.code);
          perLineCodes.set(sug.code, cc ? { id: cc.id, is_change_order: !!cc.is_change_order } : null);
        }
      }

      const lineRows = [];
      for (let idx = 0; idx < parsed.line_items.length; idx++) {
        const li = parsed.line_items[idx];
        const sugCode = li.cost_code_suggestion?.code ?? null;
        const sugMatch = sugCode ? perLineCodes.get(sugCode) : null;
        const sugConfidence = li.cost_code_suggestion?.confidence ?? null;
        const autoAssignLineCode = sugMatch && (sugConfidence ?? 0) >= 0.8 ? sugMatch.id : costCodeId;
        const lineBudgetLineId = autoAssignLineCode === costCodeId
          ? defaultBudgetLineId
          : autoAssignLineCode ? await findBudgetLine(FISH_JOB_ID, autoAssignLineCode) : null;

        lineRows.push({
          invoice_id: invoiceId,
          line_index: idx,
          description: li.description ?? null,
          qty: li.qty,
          unit: li.unit,
          rate: li.rate,
          amount_cents: Math.round((li.amount ?? 0) * 100),
          cost_code_id: autoAssignLineCode,
          budget_line_id: lineBudgetLineId,
          is_change_order: !!li.is_change_order || (li.is_change_order === undefined && invoiceIsChangeOrder),
          co_reference: li.co_reference ?? (invoiceIsChangeOrder ? parsed.co_reference : null),
          ai_suggested_cost_code_id: sugMatch?.id ?? null,
          ai_suggestion_confidence: sugConfidence,
          org_id: ORG_ID,
        });
      }
      const { error: lineErr } = await supabase.from('invoice_line_items').insert(lineRows);
      if (lineErr) console.log(`  Line items warning: ${lineErr.message}`);
    }

    // 10. Auto-allocate if cost code assigned
    if (costCodeId && totalCents > 0) {
      const { error: allocErr } = await supabase.from('invoice_allocations').insert({
        invoice_id: invoiceId,
        cost_code_id: costCodeId,
        amount_cents: totalCents,
        description: parsed.description ?? null,
      });
      if (allocErr) console.log(`  Allocation warning: ${allocErr.message}`);
    }

    const totalDuration = ((Date.now() - fileStart) / 1000).toFixed(1);
    console.log(`  SAVED: ${invoiceId} (${totalDuration}s total)`);

    successCount++;
    results.push({
      file: filename,
      success: true,
      invoiceId,
      vendor: parsed.vendor_name,
      amount: parsed.total_amount,
      confidence: parsed.confidence_score,
      costCode: parsed.cost_code_suggestion?.code ?? null,
      docType,
      parseDuration: parseFloat(parseDuration),
      totalDuration: parseFloat(totalDuration),
      isChangeOrder: invoiceIsChangeOrder,
      flags: parsed.flags || [],
    });

  } catch (err) {
    failCount++;
    const totalDuration = ((Date.now() - fileStart) / 1000).toFixed(1);
    console.log(`  FAILED: ${err.message?.slice(0, 200)}`);
    results.push({
      file: filename,
      success: false,
      error: err.message?.slice(0, 200),
      docType,
      totalDuration: parseFloat(totalDuration),
    });
  }
}

// ======== SUMMARY ========
const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
const elapsedMin = (elapsed / 60).toFixed(1);

console.log(`\n${'='.repeat(60)}`);
console.log(`BATCH IMPORT SUMMARY`);
console.log(`${'='.repeat(60)}`);
console.log(`Total files attempted: ${ALL_FILES.length}`);
console.log(`Successful: ${successCount}`);
console.log(`Failed: ${failCount}`);
console.log(`Total elapsed: ${elapsed}s (${elapsedMin} min)`);

// Parse time analysis
const successResults = results.filter(r => r.success);
if (successResults.length > 0) {
  const parseTimes = successResults.map(r => r.parseDuration);
  const avgParse = (parseTimes.reduce((a,b) => a+b, 0) / parseTimes.length).toFixed(1);
  const minParse = Math.min(...parseTimes).toFixed(1);
  const maxParse = Math.max(...parseTimes).toFixed(1);
  console.log(`\nParse times: avg=${avgParse}s min=${minParse}s max=${maxParse}s`);

  // Check for creep: compare first 10 vs last 10
  if (successResults.length >= 20) {
    const first10 = successResults.slice(0, 10).map(r => r.parseDuration);
    const last10 = successResults.slice(-10).map(r => r.parseDuration);
    const avgFirst = (first10.reduce((a,b) => a+b, 0) / 10).toFixed(1);
    const avgLast = (last10.reduce((a,b) => a+b, 0) / 10).toFixed(1);
    console.log(`Parse time creep: first 10 avg=${avgFirst}s, last 10 avg=${avgLast}s`);
    if (parseFloat(avgLast) > parseFloat(avgFirst) * 1.5) {
      console.log('  *** WARNING: Parse times appear to be creeping upward! ***');
    }
  }
}

// Failures table
if (failCount > 0) {
  console.log(`\nFAILURES:`);
  console.log('-'.repeat(80));
  const pad = (s, w) => String(s).slice(0, w).padEnd(w);
  console.log(pad('Filename', 45), pad('Error', 35));
  console.log('-'.repeat(80));
  for (const r of results.filter(r => !r.success)) {
    console.log(pad(r.file, 45), pad(r.error || 'unknown', 35));
  }
}

// Full results table
console.log(`\n${'='.repeat(60)}`);
console.log(`PER-FILE RESULTS`);
console.log(`${'='.repeat(60)}`);
const pad = (s, w) => String(s).slice(0, w).padEnd(w);
console.log(pad('File', 45), pad('Vendor', 20), pad('Amount', 10), pad('Code', 8), pad('Conf', 5), pad('Type', 8), pad('Time', 6), 'Status');
console.log('-'.repeat(110));
for (const r of results) {
  if (r.success) {
    console.log(
      pad(r.file, 45),
      pad(r.vendor || '', 20),
      pad('$' + (r.amount || 0).toFixed(2), 10),
      pad(r.costCode || '-', 8),
      pad(r.confidence?.toFixed(2) || '-', 5),
      pad(r.docType, 8),
      pad(r.totalDuration + 's', 6),
      r.isChangeOrder ? 'CO' : 'OK'
    );
  } else {
    console.log(
      pad(r.file, 45),
      pad('FAILED', 20),
      pad('-', 10),
      pad('-', 8),
      pad('-', 5),
      pad(r.docType, 8),
      pad(r.totalDuration + 's', 6),
      r.error?.slice(0, 30) || 'unknown'
    );
  }
}

console.log(`\nDone.`);
