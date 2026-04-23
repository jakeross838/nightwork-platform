/**
 * GH #19 Path A regression fence — R.15.
 *
 * Background
 * ----------
 * Phase 2.8 migration 00073 added `trg_pricing_history_from_invoice_line`
 * — an AFTER INSERT OR UPDATE trigger on `public.invoice_line_items`
 * that reads the parent invoice's status and only inserts a
 * `pricing_history` row when that status = 'qa_approved'. Phase 3.1
 * Stage 3B-1 diagnostic (qa-reports/qa-branch3-phase3.1.md §7)
 * discovered the trigger has NEVER fired in the real QA-approval
 * flow: the app's approval transaction updates invoice_line_items
 * BEFORE updating invoices.status = 'qa_approved', so the AFTER
 * UPDATE on invoice_line_items reads stale status and no-ops. All 55
 * qa_approved invoices on Ross Built were historically orphaned
 * (54 covered by the Amendment M backfill; 1 = Metro Electric #60433
 * the active canary). Filed as GH #19.
 *
 * Fix (Path A, migration 00077)
 * ------------------------------
 * New AFTER UPDATE OF status trigger on `public.invoices` that fires
 * exactly on the transition OLD.status != 'qa_approved' AND
 * NEW.status = 'qa_approved', then inserts pricing_history rows for
 * every invoice_line_items row on that invoice (idempotent via
 * ON CONFLICT (source_type, source_line_id) DO NOTHING).
 *
 * Backfill for historical orphans is deferred to migration 00078
 * (Path C) so rollback granularity is preserved.
 *
 * Column mapping + guards match 00073's `trg_pricing_history_from_
 * invoice_line` exactly: qty→quantity, rate (dollars)→unit_price
 * (cents) via ROUND(rate*100), amount_cents→amount, invoice_date→
 * date with created_at::date fallback. Skips invoices whose job_id
 * IS NULL (same reason as 00073 — pricing_history.job_id is NOT
 * NULL, legacy orphans are intentionally not backfilled).
 *
 * This test is static: regex assertions against the 00077 migration
 * SQL + .down.sql. Dynamic DB probes (trigger fires on correct
 * transitions + doesn't fire on others + idempotency + row-count
 * growth) fire during the Migration Dry-Run per R.19 and are
 * recorded in the Task 3A Jake-review summary.
 *
 * Pattern matches __tests__/pricing-history.test.ts (Phase 2.8) and
 * __tests__/document-extractions-rename.test.ts (Phase 3.1).
 */
import { readFileSync, existsSync } from "node:fs";
import { strict as assert } from "node:assert";

type Case = { name: string; fn: () => void };
const cases: Case[] = [];
const test = (name: string, fn: () => void) => cases.push({ name, fn });

const MIGRATION =
  "supabase/migrations/00077_pricing_history_status_trigger.sql";
const MIGRATION_DOWN =
  "supabase/migrations/00077_pricing_history_status_trigger.down.sql";

// ── migration file existence ─────────────────────────────────────────

test("migration 00077 exists", () => {
  assert.ok(existsSync(MIGRATION), `${MIGRATION} missing`);
});

test("migration 00077 has a paired .down.sql", () => {
  assert.ok(existsSync(MIGRATION_DOWN), `${MIGRATION_DOWN} missing`);
});

// ── header documentation ─────────────────────────────────────────────

test("migration 00077 header cites GH #19", () => {
  const src = readFileSync(MIGRATION, "utf8");
  assert.ok(
    /GH\s*#19|issue\s*#19/i.test(src),
    "header must reference GH #19 (pricing_history trigger orphan diagnostic)",
  );
});

test("migration 00077 header cites Phase 3.1 Stage 3B-1 diagnostic", () => {
  const src = readFileSync(MIGRATION, "utf8");
  assert.ok(
    /qa-branch3-phase3\.1\.md/i.test(src),
    "header must cite qa-reports/qa-branch3-phase3.1.md as diagnostic source",
  );
  assert.ok(
    /Stage\s*3B|§7/i.test(src),
    "header must reference the Stage 3B-1 / §7 section that documented the diagnostic",
  );
});

test("migration 00077 header documents the update-ordering root cause", () => {
  const src = readFileSync(MIGRATION, "utf8");
  assert.ok(
    /stale\s+status|update\s+ordering|ordering/i.test(src),
    "header must document the update-ordering / stale-status root cause",
  );
});

test("migration 00077 header documents Path A vs Path C split", () => {
  const src = readFileSync(MIGRATION, "utf8");
  assert.ok(
    /Path\s*A/i.test(src),
    "header must name the Path A approach (new trigger on invoices.status)",
  );
  assert.ok(
    /00078|Path\s*C|backfill/i.test(src),
    "header must reference the deferred backfill (00078 / Path C)",
  );
});

// ── function definition ──────────────────────────────────────────────

test("migration 00077 defines function trg_pricing_history_from_invoice_status", () => {
  const src = readFileSync(MIGRATION, "utf8");
  assert.ok(
    /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.trg_pricing_history_from_invoice_status\s*\(/i.test(
      src,
    ),
    "migration must CREATE OR REPLACE FUNCTION public.trg_pricing_history_from_invoice_status()",
  );
});

test("migration 00077 function is SECURITY DEFINER with pinned search_path", () => {
  const src = readFileSync(MIGRATION, "utf8");
  assert.ok(
    /SECURITY\s+DEFINER/i.test(src),
    "function must be SECURITY DEFINER (same lineage as 00073 Amendment J)",
  );
  assert.ok(
    /SET\s+search_path\s*=\s*public\s*,\s*pg_temp/i.test(src),
    "search_path must be pinned to `public, pg_temp` (matches 00073 invoice_line trigger)",
  );
});

test("migration 00077 function GRANTs EXECUTE to authenticated", () => {
  const src = readFileSync(MIGRATION, "utf8");
  assert.ok(
    /GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+public\.trg_pricing_history_from_invoice_status\s*\(\s*\)\s+TO\s+authenticated/i.test(
      src,
    ),
    "function must GRANT EXECUTE TO authenticated (Amendment J / F.2 lineage: 00032 → 00067 → 00070 → 00073)",
  );
});

// ── transition guards ────────────────────────────────────────────────

test("migration 00077 function guards on transition TO qa_approved only", () => {
  const src = readFileSync(MIGRATION, "utf8");
  // Accept either "IF NEW.status IS DISTINCT FROM 'qa_approved'" OR
  // "IF NEW.status = 'qa_approved' AND (OLD.status IS NULL OR ...)".
  // The key assertion: both NEW.status check AND OLD.status check
  // must be present so the trigger skips re-UPDATEs that keep status.
  assert.ok(
    /NEW\.status[\s\S]{0,120}qa_approved/i.test(src),
    "function must check NEW.status = 'qa_approved'",
  );
  assert.ok(
    /OLD\.status[\s\S]{0,120}qa_approved/i.test(src),
    "function must check OLD.status to skip re-UPDATEs that keep status = qa_approved",
  );
});

test("migration 00077 function guards on job_id IS NULL (matches 00073 precedent)", () => {
  const src = readFileSync(MIGRATION, "utf8");
  assert.ok(
    /job_id\s+IS\s+NULL[\s\S]{0,60}RETURN\s+NEW/i.test(src),
    "function must early-return when NEW.job_id IS NULL (pricing_history.job_id is NOT NULL; matches 00073 invoice_line trigger handling of legacy orphans)",
  );
});

// ── INSERT shape ─────────────────────────────────────────────────────

test("migration 00077 INSERT targets public.pricing_history with correct column list", () => {
  const src = readFileSync(MIGRATION, "utf8");
  const match = src.match(
    /INSERT\s+INTO\s+public\.pricing_history\s*\(([\s\S]*?)\)\s*SELECT/i,
  );
  assert.ok(match, "could not locate INSERT INTO public.pricing_history (...) SELECT");
  const cols = match![1];
  const required = [
    "org_id",
    "job_id",
    "source_type",
    "source_id",
    "source_line_id",
    "vendor_id",
    "cost_code_id",
    "description",
    "quantity",
    "unit",
    "unit_price",
    "amount",
    "date",
    "created_by",
  ];
  for (const c of required) {
    assert.ok(
      new RegExp(`\\b${c}\\b`).test(cols),
      `INSERT column list must include ${c}`,
    );
  }
});

test("migration 00077 SELECT list has source_type='invoice' + NEW.id as source_id + ili.id as source_line_id", () => {
  const src = readFileSync(MIGRATION, "utf8");
  assert.ok(
    /'invoice'/i.test(src),
    "SELECT must include source_type literal 'invoice'",
  );
  // NEW.id for source_id (from invoices); ili.id for source_line_id
  assert.ok(
    /\bNEW\.id\b/i.test(src),
    "SELECT must include NEW.id (the invoice id) as source_id",
  );
  assert.ok(
    /\bili\.id\b/i.test(src),
    "SELECT must include ili.id (the line id) as source_line_id",
  );
});

test("migration 00077 SELECT rate→unit_price conversion uses ROUND(rate * 100)::BIGINT (matches 00073)", () => {
  const src = readFileSync(MIGRATION, "utf8");
  assert.ok(
    /ROUND\s*\(\s*ili\.rate\s*\*\s*100\s*\)\s*::\s*BIGINT/i.test(src),
    "unit_price must be ROUND(ili.rate * 100)::BIGINT (matches 00073 invoice_line trigger; rate stored in dollars)",
  );
});

test("migration 00077 SELECT maps ili.amount_cents → amount column (matches 00073)", () => {
  const src = readFileSync(MIGRATION, "utf8");
  assert.ok(
    /ili\.amount_cents/i.test(src),
    "SELECT must pull ili.amount_cents for the pricing_history.amount column",
  );
});

test("migration 00077 SELECT date falls back to created_at when invoice_date NULL (matches 00073)", () => {
  const src = readFileSync(MIGRATION, "utf8");
  assert.ok(
    /COALESCE\s*\(\s*NEW\.invoice_date\s*,\s*NEW\.created_at::date\s*\)/i.test(
      src,
    ),
    "date must be COALESCE(NEW.invoice_date, NEW.created_at::date) (matches 00073)",
  );
});

test("migration 00077 SELECT created_by uses auth.uid()", () => {
  const src = readFileSync(MIGRATION, "utf8");
  assert.ok(
    /auth\.uid\s*\(\s*\)/i.test(src),
    "created_by must be auth.uid() (matches 00073 invoice_line trigger; transition happens under an authenticated user)",
  );
});

test("migration 00077 INSERT joins invoice_line_items scoped to this invoice + non-deleted", () => {
  const src = readFileSync(MIGRATION, "utf8");
  assert.ok(
    /FROM\s+public\.invoice_line_items\s+ili/i.test(src),
    "INSERT must FROM public.invoice_line_items ili",
  );
  assert.ok(
    /WHERE[\s\S]{0,300}ili\.invoice_id\s*=\s*NEW\.id/i.test(src),
    "INSERT WHERE must scope to ili.invoice_id = NEW.id",
  );
  assert.ok(
    /ili\.deleted_at\s+IS\s+NULL/i.test(src),
    "INSERT WHERE must exclude soft-deleted line items (ili.deleted_at IS NULL)",
  );
});

test("migration 00077 INSERT is idempotent via ON CONFLICT (source_type, source_line_id) DO NOTHING", () => {
  const src = readFileSync(MIGRATION, "utf8");
  assert.ok(
    /ON\s+CONFLICT\s*\(\s*source_type\s*,\s*source_line_id\s*\)\s+DO\s+NOTHING/i.test(
      src,
    ),
    "INSERT must ON CONFLICT (source_type, source_line_id) DO NOTHING (idempotency; matches 00073 UNIQUE constraint)",
  );
});

// ── trigger binding ──────────────────────────────────────────────────

test("migration 00077 creates trigger trg_invoices_pricing_history_on_status", () => {
  const src = readFileSync(MIGRATION, "utf8");
  assert.ok(
    /CREATE\s+TRIGGER\s+trg_invoices_pricing_history_on_status/i.test(src),
    "migration must CREATE TRIGGER trg_invoices_pricing_history_on_status",
  );
});

test("migration 00077 trigger is AFTER UPDATE OF status on public.invoices FOR EACH ROW", () => {
  const src = readFileSync(MIGRATION, "utf8");
  assert.ok(
    /AFTER\s+UPDATE\s+OF\s+status\s+ON\s+public\.invoices/i.test(src),
    "trigger must be AFTER UPDATE OF status ON public.invoices (column-scoped fires only when status column is in the UPDATE SET list)",
  );
  assert.ok(
    /FOR\s+EACH\s+ROW/i.test(src),
    "trigger must be FOR EACH ROW",
  );
});

test("migration 00077 trigger EXECUTEs trg_pricing_history_from_invoice_status", () => {
  const src = readFileSync(MIGRATION, "utf8");
  assert.ok(
    /EXECUTE\s+FUNCTION\s+public\.trg_pricing_history_from_invoice_status\s*\(\s*\)/i.test(
      src,
    ),
    "trigger must EXECUTE FUNCTION public.trg_pricing_history_from_invoice_status()",
  );
});

// ── scope discipline ─────────────────────────────────────────────────

test("migration 00077 contains NO backfill INSERT (Path C deferred to 00078)", () => {
  const src = readFileSync(MIGRATION, "utf8");
  // An INSERT that reads FROM public.invoices joined to invoice_line_items
  // WITHOUT a trigger context (i.e. outside the function body) would be a
  // backfill. Easiest check: the ONLY INSERT INTO public.pricing_history
  // should be inside the function body (surrounded by BEGIN...RETURN NEW).
  const allInserts = (src.match(/INSERT\s+INTO\s+public\.pricing_history/gi) ??
    []).length;
  assert.equal(
    allInserts,
    1,
    `expected exactly 1 INSERT INTO public.pricing_history (inside trigger function body) — found ${allInserts}. Backfill must be in 00078, not 00077.`,
  );
});

// ── down migration ───────────────────────────────────────────────────

test("migration 00077 down.sql drops the trigger and function in dependency order", () => {
  const src = readFileSync(MIGRATION_DOWN, "utf8");
  assert.ok(
    /DROP\s+TRIGGER\s+(?:IF\s+EXISTS\s+)?trg_invoices_pricing_history_on_status\s+ON\s+public\.invoices/i.test(
      src,
    ),
    "down.sql must DROP TRIGGER trg_invoices_pricing_history_on_status ON public.invoices",
  );
  assert.ok(
    /DROP\s+FUNCTION\s+(?:IF\s+EXISTS\s+)?public\.trg_pricing_history_from_invoice_status\s*\(\s*\)/i.test(
      src,
    ),
    "down.sql must DROP FUNCTION public.trg_pricing_history_from_invoice_status()",
  );
  // Trigger must come before function (PostgreSQL requires trigger drop
  // before function drop because the trigger depends on the function).
  const triggerIdx = src.search(
    /DROP\s+TRIGGER[\s\S]*?trg_invoices_pricing_history_on_status/i,
  );
  const functionIdx = src.search(
    /DROP\s+FUNCTION[\s\S]*?trg_pricing_history_from_invoice_status/i,
  );
  assert.ok(
    triggerIdx < functionIdx,
    "down.sql must DROP TRIGGER before DROP FUNCTION (dependency order)",
  );
});

// ---------------------------------------------------------------
// Runner — matches the convention in every other __tests__/*.ts
// ---------------------------------------------------------------
let failed = 0;
for (const c of cases) {
  try {
    c.fn();
    console.log(`PASS  ${c.name}`);
  } catch (e) {
    failed++;
    console.log(`FAIL  ${c.name}`);
    console.log(`      ${e instanceof Error ? e.message : String(e)}`);
  }
}
console.log("");
if (failed > 0) {
  console.error(`${failed} of ${cases.length} test(s) failed`);
  process.exit(1);
} else {
  console.log(`${cases.length} test(s) passed`);
}
