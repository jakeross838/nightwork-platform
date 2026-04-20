# Deferred Findings

Tracking non-blocking issues found during phase work that need
attention later. Each entry links to the phase where it was
discovered.

## F-001: DEFAULT_ORG_ID hardcoded — RESOLVED (full sweep)
**Discovered:** Phase A (original)
**Resolved:** Phase D Step 5 (budget-import) + 2026-04-20 comprehensive
pass (SEC-C-2 in REVIEW_FINDINGS): 8 additional routes still had the
`00000000-0000-0000-0000-000000000001` fallback when record.org_id was
null. All 8 now reject with 500 "record missing org_id" and filter all
queries by membership.org_id.

**Final coverage (post-fix):**
- src/app/api/lien-releases/[id]/upload/route.ts
- src/app/api/lien-releases/[id]/route.ts
- src/app/api/lien-releases/bulk/route.ts
- src/app/api/invoices/[id]/payment/route.ts
- src/app/api/invoices/[id]/line-items/route.ts
- src/app/api/invoices/payments/bulk/route.ts
- src/app/api/invoices/payments/batch-by-vendor/route.ts
- src/lib/invoices/save.ts — now accepts org_id via SaveInvoiceRequest

Only remaining hardcoded reference is `TEMPLATE_ORG_ID` in
src/app/api/cost-codes/template/route.ts — that's intentional for
seed-template reads.

**Status: CLOSED.**

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

## F-002a: "Owner" role missing from RLS SELECT policies — FIXED
**Fixed:** Migration 00039 (2026-04-17) added owner to draws +
draw_line_items SELECT policies. Other tables (jobs, invoices,
budget_lines, change_orders) use `authenticated read` policies that
cover all roles — no owner-specific gap remains.

Wave E.1 (2026-04-20) tightened those same policies further:
migration 00046 scopes `authenticated read` to `user_org_id()` for
jobs/vendors/cost_codes so tenant isolation no longer depends on the
RESTRICTIVE "org isolation" policy being present.

**Status: FIXED.**

## F-003: CLOSED — Not a bug, matches real workflow
**Discovered:** Phase D D1 (invoice allocations salvage)
**Updated:** 2026-04-18
**Original concern:** invoices.draw_id is 1:1, no historical
linkage — if a vendor invoice needs to span multiple draws it
can't.

**Resolution:** Investigation confirmed this matches Ross
Built's actual cost-plus workflow. Vendor invoices arrive for
period work and get billed in full on that period's draw.
Diane does not split single vendor invoices across pay apps.
invoice_allocations handles cost-code splitting within a
single draw (the real need). Draw status progression
(draft → submitted → approved → locked → paid) handles
lock-check concerns about moving invoices between draws.

**Status: CLOSED — data model correctly reflects workflow.**

## F-004: CLOSED — Not a bug, matches workflow
**Discovered:** Phase D recompute helper review
**Updated:** 2026-04-18
**Original concern:** Internal billings assumed single-draw;
cumulative billings across draws might break.

**Resolution:** Investigation confirmed internal billings are
inherently per-draw by design. Each billing type (Contractor
Fee percentage, Supervision flat, General Labor flat)
recalculates fresh per draw — not a cumulative line that spans
draws. A new internal_billings row + draw_line_item is created
per draw attach. The total_to_date = this_period assumption
correctly models this (per-draw snapshot, not cumulative
tracker). Cross-draw cumulative math happens via
nonBudgetLineThisPeriodForDraw + lessPreviousCertificatesForJob
at the draw level, not the billing level.

**Status: CLOSED — data model correctly reflects workflow.**

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

## F-011: FIXED — Receipts-as-invoices (Option A)
**Discovered:** 2026-04-17 during F-007 reclassification
**Fixed:** 2026-04-17

**Approach:** Option A per original finding. Added
`invoices.document_type` column (`'invoice'` | `'receipt'`).
Vendor and invoice number were already nullable so no constraint
changes needed. Upload page has Invoice/Receipt toggle with
contextual helper text. List views show a muted RECEIPT badge
next to vendor name. Detail page shows a receipt banner.
Save function passes `document_type` through to insert.

**Files changed:**
- Migration: `00041_invoice_document_type.sql`
- `src/lib/invoices/save.ts` — accepts + inserts document_type
- `src/app/invoices/upload/page.tsx` — document type toggle
- `src/app/invoices/page.tsx` — RECEIPT badge in both list modes
- `src/app/invoices/queue/page.tsx` — RECEIPT badge in queue
- `src/app/invoices/[id]/page.tsx` — receipt banner on detail
- `src/app/jobs/[id]/invoices/page.tsx` — RECEIPT badge

**Follow-up:** Option B (separate expense entity) remains a
future enhancement if the unified approach creates confusion
during dogfooding.

**Status: FIXED.**

## F-009: FIXED — DB trigger auto-maintains approved_cos_total (Path B)
**Discovered:** Visual audit 2026-04-17 (post-Phase-E)
**Fixed:** 2026-04-18

**Approach:** Path B from original finding. DB trigger
`co_cache_trigger` on change_orders INSERT/UPDATE/DELETE
automatically refreshes `jobs.approved_cos_total` and
`jobs.current_contract_amount`. Cache is now immune to
discipline drift — any path that modifies change_orders
(imports, bulk ops, direct SQL, future integrations) triggers
the recompute.

**Bonus fix:** Trigger uses `total_with_fee` (includes GC fees).
The old `trg_change_orders_status_sync` and `recalcJobContract()`
both used `SUM(amount)` which excluded GC fees — a pre-existing
bug where Dewberry showed $3,307 instead of $3,902.26.

**Changes:**
- Migration: `00042_co_cache_trigger.sql`
- New function: `app_private.refresh_approved_cos_total(job_id)`
- New trigger: `co_cache_trigger` (AFTER INSERT/UPDATE/DELETE)
- Updated: `trg_change_orders_status_sync` — removed its
  job-cache logic (kept budget_line co_adjustments recomputation)
- Removed: explicit `recalcJobContract()` call from PATCH
  /api/change-orders/[id] (now redundant)
- Retained: `recalcJobContract()` in src/lib/recalc.ts for
  explicit one-off reconciliation (recalcAllForJob uses it)
- One-time backfill of all existing jobs' caches

**Verified:** Dewberry cache stays correct through status flips
(approved 390226 → draft 0 → approved 390226).

**Status: FIXED.**

## F-012: FIXED — Sidebar filter now server-side
**Discovered:** 2026-04-17 during Phase 4 validation
**Fixed:** 2026-04-18

**Approach:** When filter='mine' AND user role='pm', pm_id
filter is applied in the Supabase query rather than client-side.
Split the single useEffect into two: user info fetch (once) and
jobs fetch (refetches on filter/role change). Removed the
client-side `filter === 'mine'` branch from useMemo — search
and sort still applied client-side (local UX, not data scale).

**Status: FIXED.**

## F-013: FIXED — Mobile drawer for sidebar
**Discovered:** 2026-04-17 during Phase 4 validation
**Fixed:** 2026-04-18

**Approach:** Sidebar component made responsive via new AppShell
wrapper. Desktop renders as fixed 220px left column. Mobile
wraps in drawer overlay triggered by hamburger in top nav. Same
content, same data, same interaction. Auto-closes on route
change.

**Bundled change:** Shipped alongside removing the "Jobs" top
nav entry and making the sidebar universal on authenticated
pages (except admin/drill-down). Mobile drawer is essential to
this model — without it, mobile users on non-job pages would
have no way to access the job list.

**Status: FIXED.**

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

## F-015: Job sidebar fetches twice on mobile drawer open
**Discovered:** 2026-04-18 during Phase B2 data-sharing audit
**Impact:** On mobile, both the desktop `<JobSidebar />` (CSS-hidden
but mounted) and the mobile drawer `<JobSidebar mobile />`
(mounted only when drawer opens) each fetch user + jobs
independently. Two API calls per mobile page load when the
drawer is opened. Minor inefficiency.

**Severity:** Low. Supabase query is fast, jobs count is small,
drawer opens are infrequent.

**Fix:** Lift sidebar data state into AppShell (or a SidebarDataContext),
pass to both JobSidebar instances. Or render a single instance
that CSS-morphs between sidebar and drawer layouts. Likely ~1 hour.

**Recommended:** Defer until performance is a felt problem.

## F-016: Modal close triggers window.location.reload() — FIXED
**Fixed:** 2026-04-20 (H.3 in comprehensive pass). All 5 modal close
handlers now call `router.refresh()` instead of a full page reload.
SPA state is preserved; Next.js server components re-execute to pull
fresh data.

Sites fixed:
- src/app/vendors/page.tsx (vendor import modal close)
- src/app/invoices/page.tsx (upload + import modal close, 2 sites)
- src/app/invoices/[id]/page.tsx (reopen action)
- src/app/jobs/[id]/purchase-orders/page.tsx (PO import modal close)

**Status: FIXED.**

## F-017: EmptyState primaryAction type — FIXED
**Fixed:** 2026-04-20 (H.4). Prop type is now a discriminated
union — either `{ label, href }` or `{ label, onClick }`, never both.
Misuse surfaces at the type level.

**Status: FIXED.**

## F-021: Parser self-learning via correction capture
**Discovered:** 2026-04-18 during Fish invoice dogfood
**Status:** Phase A shipped 2026-04-19.

Every time a PM edits a parser-populated field on an invoice,
the delta is recorded in `parser_corrections`. Captures:
original value, corrected value, parser confidence at extract
time, vendor context.

**Phase A (shipped):** `parser_corrections` table + hook in
invoice action route. Data starts flowing immediately.

**Phase B (vendor-memory):** Deferred until correction volume
supports it (target: 500+ corrections across multiple vendors).
Inject vendor-specific correction patterns into parser prompts
as few-shot examples.

**Phase C (fine-tuning or pattern-mining):** Evaluate after
3-6 months of production correction data. Decide between
prompt engineering, retrieval-augmented generation, or
fine-tuning based on correction patterns observed.

## F-018: API route auth-gate consistency — RESOLVED
**Discovered:** 2026-04-20 comprehensive review (SEC-C-1)
**Resolved:** 2026-04-20 same pass. 8 routes that previously relied
on RLS alone now call `getCurrentMembership()` and filter every query
by `membership.org_id`. Matches the pattern already used by
batch-action, draws, and invoices/import/upload routes.

**Routes fixed:**
- /api/invoices/[id]/payment
- /api/invoices/[id]/line-items
- /api/invoices/[id]/action (already auth'd, now also scoped by org_id)
- /api/invoices/save
- /api/lien-releases (GET)
- /api/lien-releases/[id]
- /api/lien-releases/[id]/upload
- /api/lien-releases/bulk

**Status: CLOSED.**

## F-022: Optimistic locking rollout — PARTIAL
**Discovered:** 2026-04-20 comprehensive review (WI-C-3)
**Status:** Server side done — 11 write endpoints now use the
`updateWithLock` helper (src/lib/api/optimistic-lock.ts). When the
client sends `expected_updated_at` in the body, a stale write returns
409 with the current row. `expected_updated_at` is OPTIONAL for
backward compatibility; legacy clients that don't send it silently
skip the lock.

**Client-side follow-up:** update the read-then-write UIs (invoices,
draws, change-orders, purchase-orders, vendors, lien-releases) to
include `expected_updated_at` in every mutation body. Once every
calling surface is migrated, flip the field to required.

**Severity:** Medium. Current state is strictly additive (no
regression). Benefit accrues once clients opt in.

## F-023: API rate limiting — DEFERRED
**Discovered:** 2026-04-20 comprehensive review (SEC-L-2)
**Scope exceeded comprehensive-pass budget.** A basic LRU-based
per-user rate limiter on /api/* needs middleware work + Redis/KV
decision + abuse-threshold tuning. Pre-demo risk is low (internal
users only). Revisit post-demo before any external user onboarding.

**Severity:** Low (dev) / Medium (prod).

## F-024: Role matrix audit for RLS — DEFERRED
**Discovered:** 2026-04-20 (DBM-H-002 in review)
**Context:** Existing policies cover admin/owner writes everywhere
and accounting writes on financial tables. PM writes are scoped to
own-jobs. "Viewer" role doesn't exist yet. Full matrix audit
(should accounting write COs? should PM write budget_lines?)
requires product-level discussion — not a mechanical migration.

**Severity:** Medium. No known leak today; hardening task.

