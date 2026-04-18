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

// Get cost codes for prompt context
const { data: codes } = await supabase
  .from('cost_codes')
  .select('code, description, category, is_change_order')
  .is('deleted_at', null)
  .order('sort_order');
const codeList = (codes || [])
  .map(c => `${c.code} - ${c.description} [${c.category}]${c.is_change_order ? ' (CO)' : ''}`)
  .join('\n');

const FILES = [
  { path: 'test-invoices/fish-invoices/01_Metro_Electric_60431_FPL_Dig.pdf', name: '01_Metro_Electric_60431_FPL_Dig.pdf',
    gt: { vendor: 'Metro Electric', invNum: '60431', amount: 5550.36, costCode: '03106' } },
  { path: 'test-invoices/fish-invoices/10_Home_Depot_Receipts.pdf', name: '10_Home_Depot_Receipts.pdf',
    gt: { vendor: 'Home Depot', invNum: null, amount: 371.23, costCode: '03117' } },
  { path: 'test-invoices/fish-invoices/45_Sight_To_See_1195.pdf', name: '45_Sight_To_See_1195.pdf',
    gt: { vendor: 'Sight To See', invNum: '1195', amount: 5200, costCode: '25102C' } },
  { path: 'test-invoices/fish-invoices/33_Triple_H_Painting_Inv2.pdf', name: '33_Triple_H_Painting_Inv2.pdf',
    gt: { vendor: 'Triple H Painting', invNum: 'Inv2', amount: 38000, costCode: '27101' } },
  { path: 'test-invoices/fish-invoices/19_Climatic_Conditioning_11746-5J.pdf', name: '19_Climatic_Conditioning_11746-5J.pdf',
    gt: { vendor: 'Climatic Conditioning', invNum: '11746-5J', amount: 14000, costCode: '19101' } },
];

const prompt = `You are parsing a construction document for a luxury custom home builder. Extract invoice data. Return ONLY valid JSON (no markdown, no code fences).

Schema: { "vendor_name": "string", "vendor_address": "string|null", "invoice_number": "string|null", "invoice_date": "YYYY-MM-DD|null", "po_reference": "string|null", "job_reference": "string|null", "description": "string", "invoice_type": "progress|time_and_materials|lump_sum", "is_change_order": false, "co_reference": "string|null", "line_items": [{ "description": "string", "qty": null, "unit": null, "rate": null, "amount": 0, "is_change_order": false, "co_reference": null, "cost_code_suggestion": { "code": "string|null", "description": "string|null", "confidence": 0.5 } }], "subtotal": 0, "tax": null, "total_amount": 0, "confidence_score": 0.9, "confidence_details": { "vendor_name": 0.9, "invoice_number": 0.9, "total_amount": 0.9, "job_reference": 0.5, "cost_code_suggestion": 0.5 }, "cost_code_suggestion": { "code": "string", "description": "string", "confidence": 0.5, "is_change_order": false }, "flags": [], "document_type": "invoice" }

For PROGRESS BILLING invoices (showing prior balance, this draw, remaining balance), extract the CURRENT DRAW amount as total_amount, NOT the full contract amount.

Suggest the most likely cost code from this list:
${codeList.slice(0, 4000)}

All dollar amounts in dollars (not cents).`;

const results = [];

for (const f of FILES) {
  console.log('\n========================================');
  console.log('PARSING:', f.name);

  const fileBuffer = readFileSync(f.path);
  const base64 = fileBuffer.toString('base64');

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      messages: [{
        role: 'user',
        content: [
          { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } },
          { type: 'text', text: `Parse this invoice file (${f.name}). ${prompt}` },
        ],
      }],
    });

    const textBlock = response.content.find(b => b.type === 'text');
    const jsonText = textBlock.text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    const parsed = JSON.parse(jsonText);

    console.log('Vendor:', parsed.vendor_name, '| GT:', f.gt.vendor);
    console.log('Invoice#:', parsed.invoice_number, '| GT:', f.gt.invNum);
    console.log('Amount:', parsed.total_amount, '| GT:', f.gt.amount);
    console.log('Cost Code:', parsed.cost_code_suggestion?.code || 'none', '| GT:', f.gt.costCode);
    console.log('Confidence:', parsed.confidence_score);
    console.log('Type:', parsed.invoice_type);
    console.log('Doc Type:', parsed.document_type || 'invoice');
    console.log('Flags:', (parsed.flags || []).join(', ') || 'none');
    console.log('CO:', parsed.is_change_order, '| CO Ref:', parsed.co_reference || 'none');
    console.log('Lines:', (parsed.line_items || []).length);
    for (const li of (parsed.line_items || []).slice(0, 5)) {
      console.log('  -', (li.description || '').slice(0, 55), '| $' + li.amount);
    }

    // Save to DB
    const totalCents = Math.round((parsed.total_amount || 0) * 100);

    // Vendor lookup/create
    let vendorId = null;
    if (parsed.vendor_name) {
      const firstWord = parsed.vendor_name.trim().split(/\s+/)[0];
      const { data: v } = await supabase.from('vendors').select('id, name').ilike('name', `%${firstWord}%`).limit(5);
      const match = (v || []).find(x => x.name.toLowerCase().includes(parsed.vendor_name.toLowerCase().split(' ')[0]));
      if (match) { vendorId = match.id; }
      else {
        const { data: nv } = await supabase.from('vendors').insert({ name: parsed.vendor_name, org_id: ORG_ID }).select('id').single();
        if (nv) vendorId = nv.id;
      }
    }

    // Cost code lookup
    let costCodeId = null;
    if (parsed.cost_code_suggestion?.code) {
      const { data: cc } = await supabase.from('cost_codes').select('id').eq('code', parsed.cost_code_suggestion.code).is('deleted_at', null).limit(1);
      if (cc?.[0]) costCodeId = cc[0].id;
    }

    // Upload file to storage
    const storagePath = `${ORG_ID}/uploads/${Date.now()}_${f.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    await supabase.storage.from('invoice-files').upload(storagePath, fileBuffer, { contentType: 'application/pdf' });

    const today = new Date().toISOString().split('T')[0];
    const docType = f.name.includes('Home_Depot') ? 'receipt' : 'invoice';

    const { data: inv, error: invErr } = await supabase.from('invoices').insert({
      vendor_id: vendorId,
      job_id: FISH_JOB_ID,
      cost_code_id: costCodeId,
      invoice_number: parsed.invoice_number,
      invoice_date: parsed.invoice_date,
      vendor_name_raw: parsed.vendor_name,
      description: parsed.description,
      line_items: parsed.line_items || [],
      total_amount: totalCents,
      ai_parsed_total_amount: totalCents,
      invoice_type: parsed.invoice_type,
      is_change_order: !!parsed.is_change_order,
      co_reference_raw: parsed.co_reference,
      confidence_score: parsed.confidence_score,
      confidence_details: parsed.confidence_details,
      ai_model_used: 'claude-sonnet-4-20250514',
      ai_raw_response: parsed,
      status: 'pm_review',
      status_history: [{ who: 'system', when: new Date().toISOString(), old_status: 'received', new_status: 'pm_review', note: 'Fish invoice test' }],
      received_date: today,
      original_file_url: storagePath,
      original_filename: f.name,
      original_file_type: 'pdf',
      document_type: docType,
      document_category: 'job_cost',
      org_id: ORG_ID,
    }).select('id').single();

    if (invErr) console.log('SAVE ERROR:', invErr.message);
    else console.log('SAVED:', inv.id);

    results.push({ file: f.name, parsed, saved: inv?.id, gt: f.gt });
  } catch (err) {
    console.log('ERROR:', err.message?.slice(0, 200));
    results.push({ file: f.name, error: err.message });
  }
}

// Comparison table
console.log('\n========================================');
console.log('STEP 3: PARSER vs GROUND TRUTH');
console.log('========================================');
const pad = (s, w) => String(s).slice(0, w).padEnd(w);
console.log(pad('File', 42), pad('Field', 12), pad('Ground Truth', 22), pad('Parser Output', 25), 'Match');
console.log('-'.repeat(110));
for (const r of results) {
  if (r.error) { console.log(pad(r.file, 42), 'ERROR:', r.error.slice(0, 60)); continue; }
  const p = r.parsed;
  const g = r.gt;
  const checks = [
    ['Vendor', g.vendor, p.vendor_name || '(none)', (p.vendor_name || '').toLowerCase().includes(g.vendor.split(' ')[0].toLowerCase())],
    ['Invoice#', g.invNum || '(none)', p.invoice_number || '(none)', g.invNum ? (p.invoice_number || '').includes(g.invNum.toString()) : p.invoice_number == null],
    ['Amount', '$' + g.amount, '$' + p.total_amount, Math.abs((p.total_amount || 0) - g.amount) < 1],
    ['CostCode', g.costCode, p.cost_code_suggestion?.code || 'none', (p.cost_code_suggestion?.code || '') === g.costCode],
  ];
  for (const [field, gt, parsed, match] of checks) {
    console.log(pad(r.file, 42), pad(field, 12), pad(gt, 22), pad(parsed, 25), match ? 'YES' : '** NO **');
  }
  console.log('');
}

// Final count
const { data: finalCount } = await supabase.from('invoices').select('id', { count: 'exact', head: true }).eq('job_id', FISH_JOB_ID).is('deleted_at', null);
console.log('Fish invoices in DB:', finalCount);
