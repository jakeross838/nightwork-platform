import { chromium } from 'playwright';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'node:path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const BASE = 'http://localhost:3000';
const EMAIL = 'jake@rossbuilt.com';
const PASSWORD = 'RossBuilt2026!';

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

// Find remaining unapproved invoices.
const { data: unapproved } = await sb
  .from('invoices')
  .select('id, original_filename, status, is_potential_duplicate, duplicate_dismissed_at, cost_code_id')
  .in('status', ['pm_review', 'ai_processed'])
  .is('deleted_at', null);

console.log('Unapproved invoices:', unapproved.length);

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
await page.goto(BASE + '/login', { waitUntil: 'networkidle' });
await page.fill('input[type=email]', EMAIL);
await page.fill('input[type=password]', PASSWORD);
await Promise.all([
  page.waitForURL('**/dashboard', { timeout: 15000 }).catch(() => null),
  page.click('button[type=submit]'),
]);

for (const inv of unapproved) {
  console.log(`${inv.original_filename}  dup_flag=${inv.is_potential_duplicate}`);
  if (inv.is_potential_duplicate && !inv.duplicate_dismissed_at) {
    const dismissResp = await page.evaluate(async (id) => {
      const r = await fetch(`/api/invoices/${id}/dismiss-duplicate`, { method: 'POST' });
      return { status: r.status, body: (await r.text()).slice(0, 200) };
    }, inv.id);
    console.log(`  dismiss-duplicate HTTP ${dismissResp.status}`);
  }
  // Find its cost code from the DB (we already set it in the first approval attempt).
  const { data: fresh } = await sb.from('invoices').select('cost_code_id').eq('id', inv.id).single();
  const ccId = fresh?.cost_code_id;
  const approveResp = await page.evaluate(async ({ id, ccId }) => {
    const r = await fetch(`/api/invoices/${id}/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'approve',
        updates: ccId ? {} : undefined,
      }),
    });
    return { status: r.status, body: (await r.text()).slice(0, 300) };
  }, { id: inv.id, ccId });
  console.log(`  approve HTTP ${approveResp.status}: ${approveResp.body}`);
}

// Final status.
const { data: after } = await sb
  .from('invoices')
  .select('status')
  .eq('job_id', '0000 0000-0000-0000-0000-000000000001'.replace(/0000\s?/g, '')) // irrelevant filter
  .is('deleted_at', null);

const { data: final } = await sb.from('invoices').select('status').is('deleted_at', null);
const summary = {};
for (const r of final ?? []) summary[r.status] = (summary[r.status] ?? 0) + 1;
console.log('Final:', summary);
await browser.close();
