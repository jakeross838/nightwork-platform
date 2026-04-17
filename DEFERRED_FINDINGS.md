# Deferred Findings

Tracking non-blocking issues found during phase work that need
attention later. Each entry links to the phase where it was
discovered.

## F-001: DEFAULT_ORG_ID hardcoded in budget-import route — RESOLVED
**Discovered:** Phase A (commit pending)
**Resolved:** Phase D Step 5 adopt
**Fix:** Removed hardcoded DEFAULT_ORG_ID constant. Both import
paths (simple budget sheet + pay-app) now resolve org_id from the
job's own org_id column (NOT NULL in schema, 0 rows violate).
Cost code lookups scoped by org_id to prevent cross-org resolution.
If job somehow has no org_id, throws 400 instead of silent fallback.

## F-002: PostgREST RLS join embedding failures
**Discovered:** Pre-Phase-A (from commit 79ab01d)
**Files:** 6 routes using tryCreateServiceRoleClient() fallback:
- /api/dashboard
- /api/draws/[id]
- /api/draws/[id]/export
- /api/jobs/health
- /api/jobs/[id]/overview
- /api/invoices/[id]
**Issue:** Deep joins under user-session RLS return null for some
rows (e.g. cost_codes embed on budget_lines). Workaround: auth
the user, verify org membership, then use service-role client for
the data query.
**Impact:** Current pattern is safe (auth still enforced), but
masks underlying RLS policy bugs. Any future route with deep joins
needs the same workaround.
**Severity:** Low (workaround is safe). Medium (technical debt).
**Recommended fix:** Audit RLS policies on jobs, invoices,
budget_lines, cost_codes, draws. Likely missing policies for
embedded-read scenarios. Fix policies, then remove service-role
fallback across the 6 routes.

## F-002a: "Owner" role missing from RLS SELECT policies
**Discovered:** Phase C screenshot blocker
**Tables affected:** draws (confirmed). Likely also: jobs, invoices,
budget_lines, change_orders — needs full audit.
**Issue:** RLS SELECT policies grant access to "admin" and "pm on
own jobs" but not "owner" role. In dev this is masked by service-role
fallback. In production, owner-role users would hit 500s on any
route that doesn't use service-role.
**Impact:** Production-blocking for any deploy where owner-role
users need to view draws/jobs/invoices.
**Severity:** HIGH for production.
**Recommended fix:** Audit all RLS policies on multi-tenant tables.
Add "owner" role to SELECT policies wherever "admin" appears.
Should be a single migration: 00039_owner_rls_audit.sql.
**Recommended timing:** Before deploy to nightwork.build. Not
blocking dev work.

## F-003: invoices.draw_id is 1:1 (no history)
**Discovered:** Phase D D1 (invoice allocations salvage)
**File:** src/app/api/invoices/[id]/allocations/route.ts (lock check)
**Issue:** invoice.draw_id is a single FK. It tracks only the
invoice's current draw attachment, not historical linkage. If an
invoice is removed from Draw #1 (paid) and added to Draw #2
(draft), the lock check only sees Draw #2's status and wouldn't
block edits that could corrupt Draw #1's historical G702.
**Impact:** Low for MVP (invoices rarely move between draws).
Could surface as data integrity issue in production once dogfooding
reveals the workflow.
**Severity:** Low now, medium if/when invoice-reassignment workflow
becomes common.
**Recommended fix:** Either (a) change invoice.draw_id to a
many-to-many via invoice_draw_history table, or (b) make invoices
immutable once attached to a submitted draw (cleaner — no edit
UI at all for attached invoices).

## F-004: Internal billings assumed single-draw
**Discovered:** Phase D recompute helper review
**File:** src/lib/recompute-percentage-billings.ts (line ~96)
**Assumption:** total_to_date = this_period for internal billing
lines. This holds because internal billings are modeled as one-shot
charges on a specific draw (previous_applications = 0 by construction).
**Risk:** If the product ever supports multi-draw recurring billings
(e.g. Supervision that spans 3 draws), this logic will silently write
wrong cumulative values. The billing would show this_period correctly
on each draw but total_to_date would be reset to this_period each
time instead of accumulating.
**Severity:** Low today. Medium if recurring billing workflow ships.
**Recommended fix:** When multi-draw billings are supported, compute
total_to_date as: SUM(this_period) across all non-deleted draws this
internal_billing has touched, up to and including current draw.

## F-005: Phase D workflows verified at unit level, some not E2E tested
**Discovered:** Phase D completion
**Context:** Phase D screenshots captured the critical G702 correctness
(Line 7 baseline, Line 8 positive, Application # display, no phantom
Deposit). Some workflows have code reviewed and build-verified but not
exercised end-to-end with real UI flow:

- **Invoice allocation splitting** (D1): API + editor component built
  and committed. Not tested via real UI because no Dewberry invoices
  have been split yet. Phase E will exercise if/when a split invoice
  is needed for comparison.
- **Change order draw attach** (D2): Available-to-attach filter
  verified (correctly shows 0 for Dewberry because all COs were
  imported with draw_number already set). The attach/detach mutation
  path itself is code-reviewed but not clicked through by a user.

**Risk:** Low. The calculation layer (draw-calc.ts) is the high-risk
code and is verified via Line 8 correctness. The UI layers are thin
CRUD operations against verified schemas.

**Mitigation:** Dogfooding on next real Ross Built CO will exercise
the attach flow. First split invoice will exercise allocation UI.

**Severity:** Low.

## F-006: Historical CO work not in Line 4 for mid-project imports
**Discovered:** Phase E comparison vs Dewberry Pay App #10
**Impact:** Line 4 Total Completed differs from source pay app by
the cumulative CO amount ($226,633.03 on Dewberry) when a job is
imported mid-lifecycle. Line 2 Net Change Orders is correct. Line
4 under-reports by the CO sum because CO rows live in change_orders
table without corresponding draw_line_items rows.

**Scope:** Only affects mid-project imports. New jobs and new
draws on existing jobs are unaffected — Phase D2's attach flow
creates draw_line_items with source_type='change_order' which
rollupDrawTotals picks up correctly via nonBudgetLineThisPeriodForDraw.

**Recommended fix:** Pay-app importer should create "historical"
draw_line_items for each CO represented in the imported pay app
log, linked to a synthetic "import baseline" draw or directly
attributed to the CO's representation in prior draws. Alternative:
compute Line 4 = sum(budget lines) + baseline_completed_cos
(new jobs column) when importing pay app data.

**Severity:** Medium. Makes Line 4 wrong for imported jobs until
fix lands. Line 2, 3, 7, 8 semantics still correct for new-work
calculations once baseline is set.

**Blocks:** Producing a penny-exact G702 matching source pay apps
for mid-project imported jobs.

## F-007: Budget line import rounding/completeness gap
**Discovered:** Phase E comparison vs Dewberry Pay App #10
**Impact:** Dewberry's G703 budget lines sum to $2,137,737.04 in
Nightwork vs $2,151,041.15 in Diane's G703. Delta = $13,304.11
across ~142 cost codes. Average ~$94/line, so this is not sub-cent
rounding — something systematic.

**Root cause:** Unknown. Candidates:
- Specific cost code category excluded or misparsed
- Missing line items (Diane's G703 has rows the importer skipped)
- Decimal parsing losing precision on specific line values
- Duplicate or collapsed cost codes

**Recommended next step:** Export Dewberry budget_lines from
Nightwork and compare row-by-row against Diane's G703 sheet.
Identify which specific lines are off.

**Severity:** Medium. $13K is real money — not cosmetic.

**Mitigation:** For Dewberry, can manually adjust budget_lines to
match Diane before submitting real draws. Systemic fix needed
before onboarding more mid-project jobs.

## F-009: Two separate caches for "approved COs total" on a job
**Discovered:** Visual audit 2026-04-17 (post-Phase-E)
**Impact:** `jobs.approved_cos_total` cache column is read by the
job-level UI (financial bar, overview cards, change orders tab
stat card, budget export, overview API). It is maintained by
`recalcJobContract()` which fires on PATCH /api/change-orders/[id].
Any path that modifies change_orders rows OUTSIDE that endpoint
(seeds, imports, direct SQL, bulk ops) leaves the cache stale.

Separately, draw-calc uses `netChangeOrdersForJob()` (live query)
which is immune to this staleness.

**Observed:** Phase E's pay-app import populated PCCO #17 without
firing recalcJobContract. Result: draws showed Net COs correctly
at $3,902.26 (PCCO #17 total_with_fee) but the job header showed
$0.00 for approved_cos_total. Manual recalcJobContract call fixed
the cache.

**Severity:** Low for normal UI flows. Medium for any feature
that creates/modifies COs outside the PATCH endpoint (imports,
bulk ops, migrations, future integrations).

**Remediation options:**
- A: Fire recalcJobContract() at the end of every bulk operation
  that touches change_orders (cheap, adds discipline).
- B: Add a DB trigger on change_orders INSERT/UPDATE/DELETE that
  recomputes the cache automatically (most robust).
- C: Remove the cache, compute live everywhere via
  netChangeOrdersForJob() — single source of truth (biggest
  refactor; affects 6 UI read sites).

**Recommendation:** B for medium-term (safe and automatic). A as
short-term discipline for imports. C eventually, when consolidating
the calc layer.
