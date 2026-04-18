/**
 * Ground truth extraction for 45 Fish invoices.
 * Separate from production parser — slow, careful, human-equivalent extraction.
 */
import Anthropic from '@anthropic-ai/sdk';
import { readFileSync, writeFileSync } from 'fs';
import * as dotenv from 'dotenv';
import path from 'node:path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const anthropic = new Anthropic();
const DIR = 'test-invoices/fish-invoices';

const ALL_FILES = [
  '01_Metro_Electric_60431_FPL_Dig.pdf',
  '02_Spectrum_Business_Feb2026.pdf',
  '03_FPL_Electric_Utility.pdf',
  '04_Clean_Cans_INV-2026-2563.pdf',
  '05_Clean_Cans_INV-2025-9836.pdf',
  '06_Clean_Cans_INV-2025-8233.pdf',
  '07_Ecosouth_Roll_Off.pdf',
  '08_Mobile_Modular_Storage.pdf',
  '09_Island_Lumber_531929_FloorProt.pdf',
  '10_Home_Depot_Receipts.pdf',
  '11_Suncoast_Precision_SlabCut.pdf',
  '12_Island_Lumber_532452_ImpactBits.pdf',
  '13_Island_Lumber_532369_Screws.pdf',
  '14_Island_Lumber_532330_SawBlades.pdf',
  '15_Island_Lumber_532129_Lumber.pdf',
  '16_Island_Lumber_532160_Plywood.pdf',
  '17_Island_Lumber_532266_Timberstrand.pdf',
  '18_Metro_Electric_60352_Molinari.pdf',
  '19_Climatic_Conditioning_11746-5J.pdf',
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
  '33_Triple_H_Painting_Inv2.pdf',
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
  '45_Sight_To_See_1195.pdf',
];

const PROMPT = `You are extracting ground-truth invoice data for Ross Built Custom Homes. This is NOT a quick parse — take your time and reason carefully.

CRITICAL RULES for dates:
- The year MUST be 2024 or later (Ross Built started this project in 2024)
- If you see '3/5/26', interpret as March 5, 2026 (never 2020)
- If you see '3-6-2024' that's March 6, 2024
- Verify the date makes sense relative to OTHER dates on the invoice (service dates, due dates, etc.)
- Return confidence 0.3 or lower if date is ambiguous or handwritten

CRITICAL RULES for cost codes:
- Cost codes at Ross Built are 5 digits (e.g. 03110, 25102)
- A 'C' suffix (e.g. 25102C) indicates a change-order-linked cost code — set is_change_order = true
- Handwritten cost codes on invoices (often circled or next to 'Item/AIA Code:') are the authoritative source when present
- If the invoice has BOTH a printed code AND a handwritten one, the handwritten one wins
- Return confidence 0.3 or lower if handwriting is unclear

CRITICAL RULES for amounts:
- For progress billings, the amount is the 'Amount to Bill' or 'Net Invoice Due' or balance-this-period, NOT the total contract value
- For invoices with multi-line allocations (e.g. split across COs), amount = sum of all lines
- For receipts, amount = grand total including tax

CRITICAL RULES for is_change_order:
- Look for 'PCCO#' or 'PCCO #' handwritten annotations
- Look for 'C' suffix on cost code
- Look for 'Change Order:' field marked 'Y' on stamps
- If any of these are present, is_change_order = true

CRITICAL RULES for document_type:
- 'invoice' = formal vendor invoice with invoice number, vendor letterhead, due date
- 'receipt' = cash-register style, hardware store slip, online order confirmation (Home Depot, Lowe's, Island Lumber walk-up)
- If in doubt, mark as invoice

Return ONLY valid JSON matching this exact schema (no markdown, no code fences):

{
  "vendor_name": "string — official vendor name, properly capitalized",
  "invoice_number": "string or empty string if none found",
  "invoice_date": "YYYY-MM-DD or empty string if not determinable",
  "total_amount": "number in dollars (e.g. 1234.56)",
  "document_type": "invoice or receipt",
  "cost_code": "string — primary cost code if visible on document, else empty string",
  "cost_code_description": "string — description of what the cost code covers, else empty string",
  "is_change_order": "boolean",
  "co_reference": "string — e.g. 'PCCO#17' if visible, else empty string",
  "multi_line": "boolean — true if invoice has line items spanning multiple cost codes",
  "notes": "string — any ambiguity, handwriting issues, uncertain readings",
  "confidence_vendor": "number 0-1",
  "confidence_date": "number 0-1",
  "confidence_amount": "number 0-1",
  "confidence_cost_code": "number 0-1"
}

Look very carefully at ALL parts of the document including stamps, handwriting, annotations, and margin notes. These often contain the cost code and change order references that are critical for accurate classification.`;

function escapeCSV(val) {
  if (val === null || val === undefined) return '';
  const s = String(val);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

const results = [];
const startTime = Date.now();

console.log(`Extracting ground truth for ${ALL_FILES.length} Fish invoices...\n`);

for (let i = 0; i < ALL_FILES.length; i++) {
  const filename = ALL_FILES[i];
  const filePath = `${DIR}/${filename}`;
  const fileStart = Date.now();

  console.log(`[${i+1}/${ALL_FILES.length}] ${filename}`);

  try {
    const fileBuffer = readFileSync(filePath);
    const base64 = fileBuffer.toString('base64');

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      messages: [{
        role: 'user',
        content: [
          { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } },
          { type: 'text', text: `Extract ground truth from this construction document (${filename}). ${PROMPT}` },
        ],
      }],
    });

    const textBlock = response.content.find(b => b.type === 'text');
    const rawText = textBlock.text;
    // Extract JSON from response — model may prepend reasoning text
    const firstBrace = rawText.indexOf('{');
    const lastBrace = rawText.lastIndexOf('}');
    if (firstBrace === -1 || lastBrace === -1) {
      throw new Error('No JSON object found in response');
    }
    const jsonText = rawText.slice(firstBrace, lastBrace + 1);
    const parsed = JSON.parse(jsonText);

    const dur = ((Date.now() - fileStart) / 1000).toFixed(1);
    console.log(`  ${dur}s | ${parsed.vendor_name} | $${parsed.total_amount} | ${parsed.cost_code || '—'} | ${parsed.document_type}`);

    results.push({
      filename,
      ...parsed,
      _error: null,
    });
  } catch (err) {
    const dur = ((Date.now() - fileStart) / 1000).toFixed(1);
    console.log(`  ${dur}s | ERROR: ${err.message?.slice(0, 100)}`);
    results.push({
      filename,
      vendor_name: '',
      invoice_number: '',
      invoice_date: '',
      total_amount: 0,
      document_type: '',
      cost_code: '',
      cost_code_description: '',
      is_change_order: false,
      co_reference: '',
      multi_line: false,
      notes: `EXTRACTION ERROR: ${err.message?.slice(0, 200)}`,
      confidence_vendor: 0,
      confidence_date: 0,
      confidence_amount: 0,
      confidence_cost_code: 0,
      _error: err.message,
    });
  }
}

// Write CSV
const headers = [
  'filename', 'vendor_name', 'invoice_number', 'invoice_date', 'total_amount',
  'document_type', 'cost_code', 'cost_code_description', 'is_change_order',
  'co_reference', 'multi_line', 'notes', 'confidence_vendor', 'confidence_date',
  'confidence_amount', 'confidence_cost_code',
];

const csvLines = [headers.join(',')];
for (const r of results) {
  csvLines.push([
    escapeCSV(r.filename),
    escapeCSV(r.vendor_name),
    escapeCSV(r.invoice_number),
    escapeCSV(r.invoice_date),
    escapeCSV(r.total_amount),
    escapeCSV(r.document_type),
    escapeCSV(r.cost_code),
    escapeCSV(r.cost_code_description),
    escapeCSV(r.is_change_order),
    escapeCSV(r.co_reference),
    escapeCSV(r.multi_line),
    escapeCSV(r.notes),
    escapeCSV(r.confidence_vendor),
    escapeCSV(r.confidence_date),
    escapeCSV(r.confidence_amount),
    escapeCSV(r.confidence_cost_code),
  ].join(','));
}

writeFileSync('test-invoices/fish-ground-truth.csv', csvLines.join('\n') + '\n', 'utf-8');

// Summary
const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
const successResults = results.filter(r => !r._error);
const errorResults = results.filter(r => r._error);

console.log(`\n${'='.repeat(60)}`);
console.log('GROUND TRUTH EXTRACTION SUMMARY');
console.log(`${'='.repeat(60)}`);
console.log(`Total processed: ${results.length}`);
console.log(`Successful: ${successResults.length}`);
console.log(`Errors: ${errorResults.length}`);
console.log(`Elapsed: ${elapsed}s (${(elapsed / 60).toFixed(1)} min)`);

// Confidence analysis
const fields = ['confidence_vendor', 'confidence_date', 'confidence_amount', 'confidence_cost_code'];
console.log('\nHigh-confidence fields (>= 0.8):');
for (const f of fields) {
  const high = successResults.filter(r => r[f] >= 0.8).length;
  const pct = ((high / successResults.length) * 100).toFixed(0);
  console.log(`  ${f.replace('confidence_', '')}: ${high}/${successResults.length} (${pct}%)`);
}

// Flagged for PM review
const flagged = successResults.filter(r =>
  r.confidence_vendor < 0.5 ||
  r.confidence_date < 0.5 ||
  r.confidence_amount < 0.5 ||
  r.confidence_cost_code < 0.5
);
console.log(`\nFlagged for PM review (any field < 0.5): ${flagged.length}`);
for (const r of flagged) {
  const low = fields.filter(f => r[f] < 0.5).map(f => `${f.replace('confidence_', '')}=${r[f]}`);
  console.log(`  ${r.filename}: ${low.join(', ')}`);
}

// Amount sanity
const totalAmount = successResults.reduce((sum, r) => sum + (r.total_amount || 0), 0);
console.log(`\nTotal amount sum: $${totalAmount.toFixed(2)}`);

// Date sanity
const badDates = successResults.filter(r => {
  if (!r.invoice_date) return false;
  const year = parseInt(r.invoice_date.split('-')[0]);
  return year < 2024 || year > 2026;
});
if (badDates.length > 0) {
  console.log(`\nDATE WARNINGS (outside 2024-2026):`);
  for (const r of badDates) {
    console.log(`  ${r.filename}: ${r.invoice_date}`);
  }
} else {
  console.log('\nDate sanity: all dates within 2024-2026 range');
}

// Error details
if (errorResults.length > 0) {
  console.log('\nERRORS:');
  for (const r of errorResults) {
    console.log(`  ${r.filename}: ${r._error?.slice(0, 100)}`);
  }
}

console.log(`\nCSV written to: test-invoices/fish-ground-truth.csv`);
