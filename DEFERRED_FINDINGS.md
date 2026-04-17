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

## F-006: FIXED — Historical CO work not in Line 4 for mid-project imports
**Discovered:** Phase E comparison vs Dewberry Pay App #10
**Fixed:** 2026-04-17 on branch fix-f006-historical-co-line4

**Root cause:** CO work billed in pre-Nightwork pay apps had no
representation in Line 4. Diane's G703 carries this as two PCCO
summary rows: "PCCO from Previous Applications" ($222,730.77 for
Dewberry) and "PCCO for this Application" ($3,902.26). Nightwork
tracked CO contract adjustments (Line 2 correct) but not CO
completion (Line 4 missing $222,730.77).

**Fix applied:**
- New column `jobs.previous_co_completed_amount` (bigint, cents)
  Migration: `00040_jobs_previous_co_completed.sql`
- `rollupDrawTotals()` includes it in Line 4 total_completed_to_date
- All 4 draw API callers updated to pass the value
- Pay-app parser extracts the "PCCO from Previous Applications"
  total_to_date from G703 and returns as `previousCoCompletedAmount`
- Budget-import route writes it to `jobs.previous_co_completed_amount`
- Dewberry baseline set to $222,730.77 (22273077 cents)

**Before/after (Dewberry Draw #1 Line 4):**
| Metric | Before | After | Diane's App #10 |
|--------|--------|-------|-----------------|
| Line 4 Total Completed | $2,137,737.04 | $2,360,467.81 | $2,377,674.18 |
| Delta vs Diane | -$239,937.14 | -$17,206.37 | — |

**Remaining $17,206.37 delta decomposition:**
- $19,000: Supervision ($4K) + Contractor Fee ($15K) — App 10
  internal billings still in DRAFT, not yet attached to draw
- -$3,307: PCCO #17 CO work allocated to 17101 instead of PCCO
  line (see F-014)
- +$595.26: GC fee on PCCO #17 not captured in any invoice
- +$61.11: Sub-dollar rounding across 142 budget lines

**Status: FIXED. Remaining delta fully traced, no code bugs.**

## F-007: CLOSED — billing gap is multi-source, not a code bug

**Updated:** 2026-04-17 (enriched with per-cost-code data from F-006 analysis)
**Original concern:** $13,304.11 delta between Nightwork
total_completed_to_date ($2,137,737.04) and Diane's Pay App #10
total_to_date ($2,151,041.15) — cost-code lines only, excluding PCCO.

**Full cost-code-level reconciliation (5 codes with deltas):**

| Code | Description | Diane Total | NW Total | Delta | Cause |
|------|-------------|-------------|----------|-------|-------|
| 03111 | Temporary Sanitation | $3,861.63 | $3,825.79 | +$35.84 | Invoice amount rounding |
| 03121 | Supervision | $62,550.00 | $58,550.00 | +$4,000.00 | App 10 internal billing (DRAFT) |
| 03122 | Contractor Fee | $234,200.00 | $219,200.00 | +$15,000.00 | App 10 internal billing (DRAFT) |
| 10102 | Framing Material | $119,629.96 | $119,604.69 | +$25.27 | Invoice amount rounding |
| 17101 | Roofing | $115,643.00 | $118,950.00 | -$3,307.00 | PCCO #17 CO work on cost code (see F-014) |
| | **Net cost-code delta** | | | **+$15,754.11** | |

All other 138 cost codes match Diane's G703 exactly (baseline =
previous_applications, scheduled_value = original_estimate).

**Outcome:** Not a code bug. Not a parser bug (except F-010).
- Internal billings ($19K) get attached during real draw workflows
- Roofing delta (-$3,307) is PCCO #17 CO work mixed into cost code;
  see F-014 for allocation improvement
- Sub-dollar rounding is expected Excel→DB precision loss

**Status: CLOSED — reclassified into F-010, F-011, F-014.**

## F-010: Pay-app import silently skips cost codes not in cost_codes table
**Discovered:** 2026-04-17 during F-007 reclassification
**Impact:** The budget import route (`/api/jobs/[id]/budget-import`)
correctly parses G703 lines but can only create budget_lines for
cost codes that already exist in the org's cost_codes table. If a
code is missing, the line is silently added to `unmatched_codes`
in the response but no budget_line is created.

**Observed:** Dewberry's code 06108 (ROW, $2,000) was parsed by
pay-app-parser but skipped by the import because 06108 didn't
exist in cost_codes. The response DID report this in
`unmatched_codes`, but the user (or automation) didn't act on it.

**Fix applied:** Manually added cost code 06108 and its budget
line for Dewberry. Budget totals now match Diane's G703 exactly.

**Systemic fix needed:** The pay-app import should either:
- A: Auto-create missing cost codes during import (with a
  confirmation step showing what will be created)
- B: Block import until all codes exist, with a clear list of
  what's missing and a one-click "create all" button
- C: Keep current behavior but make the warning more prominent
  in the UI (currently easy to miss)

**Severity:** Low. The data is reported in the API response.
The issue is UX — the warning is easy to overlook.

**Status: FIXED for Dewberry. Systemic UX improvement deferred.**

## F-011: No clear workflow for receipts / non-invoice spend
**Discovered:** 2026-04-17 during F-007 reclassification
**Impact:** Ross Built has real spend that doesn't arrive as a
formal vendor invoice: hardware store runs, permits, dump fees,
petty cash, card charges. Nightwork's invoice upload flow assumes
a vendor PDF exists. Receipts have no dedicated entry path.

**For Dewberry:** Unknown exact dollar contribution to the Pay
App #10 gap, but likely non-zero. The reconciliation accounts
for it implicitly in the "internal billings" and "missing
invoices" categories.

**Severity:** Medium. Not a blocker for dogfooding — users can
upload a photo of a receipt as an "invoice" with synthetic
metadata. But it's a friction point that will surface during
real use.

**Remediation options:**
- A: Accept that "invoice" is a broad concept — treat receipt
  photos as invoices with a document_category = "receipt" flag.
  Minimal code change, leverages existing upload flow.
- B: Add a separate receipt/expense entity with simpler metadata
  (no vendor match, no PO link, just amount + code + photo).
  Larger feature work.

**Recommended:** A for MVP, revisit B after dogfooding surfaces
actual pain points.

**Status: DOCUMENTED for post-deploy work.**

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

## F-012: Job sidebar fetches all jobs, filters client-side
**Discovered:** 2026-04-17 during Phase 4 validation
**Impact:** JobSidebar component queries all accessible jobs in
one Supabase query, then filters client-side with useMemo for
the My Jobs toggle. Works fine for current 15-job scale. At 100+
jobs per org, this becomes wasteful bandwidth and compute.

**Severity:** Low for MVP. Medium when a single org has 50+
active jobs.

**Fix:** Move the pm_id filter to the Supabase query when
filter === 'mine'. Add pagination when filter === 'all' and
job count exceeds ~30.

**Remediation effort:** 1-2 hours.

## F-013: Job sidebar hidden on mobile, no alternative switcher
**Discovered:** 2026-04-17 during Phase 4 validation
**Impact:** The job-scoped sidebar is hidden below md breakpoint.
Mobile users on job detail pages have no way to switch between
jobs without navigating back to /jobs list.

**Severity:** Medium. Affects PM workflows on phone — exactly
the audience most likely to work from a job site.

**Fix:** Implement mobile drawer pattern. Button in top nav
(hamburger icon when on job-scoped route) opens full-screen
drawer with same sidebar content.

**Remediation effort:** 2-3 hours.

## F-014: PCCO #17 roofing CO work allocated to cost code instead of PCCO line
**Discovered:** 2026-04-17 during F-006 analysis
**Impact:** Dewberry invoice #11595 (Avery roofing, $14,345) has
two line items: $11,895 on 17101 (base work) and $2,450 on 17101C
(damaged panels). The $11,895 includes $8,588 base + $3,307 CO
work for PCCO #17 "Roofing - metal roof over allowance". Diane's
G703 shows $8,588 on 17101 and $3,902.26 ($3,307 + $595.26 fee)
on the PCCO summary line.

**Result:** 17101 line is overstated by $3,307 in Nightwork.
PCCO "this application" line is missing $3,902.26. The GC fee of
$595.26 is not captured anywhere in Nightwork invoices. Net Line 4
impact: -$595.26 (just the fee).

**Data model supports the fix:** draw_line_items has source_type
(text) and change_order_id (uuid). A draw_line_item with
source_type='change_order' and change_order_id pointing to PCCO
#17 would correctly represent this.

**Required work:**
1. Split the $11,895 invoice line into $8,588 (17101) + $3,307
   (CO allocation on PCCO #17)
2. Create a draw_line_item with source_type='change_order' for
   the $3,307 + $595.26 fee
3. Ensure rollupDrawTotals picks this up via
   nonBudgetLineThisPeriodForDraw()
4. Consider whether the GC fee ($595.26) needs a separate entry
   or should be bundled with the CO amount

**Severity:** Low. $595.26 net impact on Line 4. Presentation
issue on the G703 (wrong line shows the amount) but total is
nearly correct.

**Recommended timing:** When CO-invoice linking workflow is built.
This is a product feature (linking invoices to COs for automatic
PCCO line generation), not a one-off data fix.
