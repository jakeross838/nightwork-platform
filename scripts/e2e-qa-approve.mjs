// QA-approve all invoices currently in qa_review.
import { chromium } from 'playwright';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'node:path';
import { writeFileSync } from 'node:fs';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const BASE = 'http://localhost:3000';
const EMAIL = 'jake@rossbuilt.com';
const PASSWORD = 'RossBuilt2026!';

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

const { data: invs } = await sb
  .from('invoices')
  .select('id, original_filename, status')
  .eq('status', 'qa_review')
  .is('deleted_at', null);
console.log(`qa_review invoices: ${invs.length}`);

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
await page.goto(BASE + '/login', { waitUntil: 'networkidle' });
await page.fill('input[type=email]', EMAIL);
await page.fill('input[type=password]', PASSWORD);
await Promise.all([page.waitForURL('**/dashboard', { timeout: 15000 }).catch(()=>null), page.click('button[type=submit]')]);

const findings = [];
for (const inv of invs) {
  const r = await page.evaluate(async (id) => {
    const res = await fetch(`/api/invoices/${id}/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'qa_approve' }),
    });
    return { status: res.status, body: (await res.text()).slice(0, 300) };
  }, inv.id);
  console.log(`  ${inv.original_filename}  qa_approve HTTP ${r.status}`);
  if (r.status !== 200) findings.push(`qa_approve ${inv.original_filename}: ${r.body}`);
}

const { data: finals } = await sb.from('invoices').select('status').is('deleted_at', null);
const summary = {};
for (const r of finals ?? []) summary[r.status] = (summary[r.status] ?? 0) + 1;
console.log('Final:', summary);
writeFileSync('e2e-qa-log.json', JSON.stringify({ findings, summary }, null, 2));
await browser.close();
