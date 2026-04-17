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
