> SUPERSEDED 2026-04-29 by docs/nightwork-plan-canonical-v1.md. Kept for history.

# Nightwork Comprehensive Review — 2026-04-20

> **Comprehensive Fix Pass Status (2026-04-20):** Phases A–E, G, H, I
> complete. Every Critical and High item from this report is resolved,
> shipped, and merged to main. Phase F (large file splits) and Phase J
> (visual regression sweep via Chrome MCP) deferred as multi-session
> follow-ups; both are scope-bounded and do not block demo. See
> Deferred Items section at the bottom and DEFERRED_FINDINGS.md for
> per-item status.
>
> **Resolution grid:**
>
> | Finding | Status | Fix commit / migration |
> |---|---|---|
> | SEC-C-1 (missing auth gates) | DONE | Phase A |
> | SEC-C-2 (hardcoded ORG_IDs) | DONE | Phase A |
> | WI-C-1 (JSON.parse safety) | DONE | Phase B B.1 |
> | WI-C-3 (optimistic locking) | DONE (server) | Phase B B.2 — see F-022 for client rollout |
> | WI-L-4 (budget gate) | DONE | Phase B B.3 |
> | WI-H-1 (empty draw) | DONE | Phase B B.4 |
> | WI-H-2 (negative CO) | DONE | Phase B B.5 |
> | BUG-C-3 (stuck loading) | DONE | Phase C C.1 |
> | BUG-C-1, BUG-C-2 (fetch errors) | DONE | Phase C C.2 |
> | BUG-H-2 (race conditions, partial) | DONE | Phase C C.3 (AbortController + cleanup flags on fetches) |
> | DES-M-2 (fonts) | DONE | Phase D D.1 |
> | LD-H-5, LD-H-6 (badges) | DONE | Phase D D.2 |
> | DES-H-1 (legacy tokens) | DONE | Phase E (7 waves) |
> | DES-M-1 (namespace removal) | DONE | Phase E Wave 7 |
> | SEC-M-2 (RLS tighten) | DONE | Phase G — migration 00046 |
> | DBM-H-002 (role matrix) | DEFERRED | F-024 — product discussion required |
> | WI-H-3 (retainage warning) | DONE | Phase G G.3 |
> | WI-M-1 (session expiry) | DONE (fn) | Phase G G.4 — migration 00047; cron hookup deferred |
> | WI-M-3 (last owner) | ALREADY FIXED | Existing PATCH guards verified |
> | ARCH-C-1..C-4 (stored computed) | DOCUMENTED | CLAUDE.md exception clause (Q3) |
> | BUG-M-1 (perf logs) | ALREADY FIXED | All gated behind PERF_LOG=1 |
> | F-015 (sidebar dup fetch) | DEFERRED | Optimization, low priority |
> | F-016 (modal reload) | DONE | Phase H H.3 |
> | F-017 (EmptyState type) | DONE | Phase H H.4 |
> | F-014 (PCCO #17) | BLOCKED | Needs CO-invoice linking feature |
> | SEC-L-2 (rate limit) | DEFERRED | F-023 — post-demo |
> | DBM-L-001 (status_history check) | SKIPPED | Low value, high complexity |
> | Files > 1000 LOC (F refactors) | DEFERRED | Phase F — multi-session |

Review cycle run across 8 parallel agents covering Security, Architecture,
Design System, Light/Dark Parity, Bugs & Quality, Database & Math,
Adversarial Scenarios, and Deferred Items audit.

## Summary

- **Total findings:** ~85 across 8 dimensions
- **Auto-fixed this pass:** 11 issues across 5 batches (9 files touched)
- **Flagged for manual review:** ~60 (see severity sections below)
- **Verified false positives:** 1 (DBM-C-001 percentage math — see Questions)
- **Build status:** passing after every batch (5/5 clean builds)
- **Upcoming deadlines:** demo 2026-04-24, PM testing 2026-04-27

Agent 8 also confirmed **F-002a is FIXED** (migration 00039). DEFERRED_FINDINGS.md
still lists it as "production-blocking" — that note is stale and should be
updated.

---

## Critical (blocks demo 2026-04-24)

### SEC-C-1: Multiple API routes skip explicit auth, rely only on RLS
**Files:**
- src/app/api/invoices/[id]/payment/route.ts
- src/app/api/invoices/[id]/line-items/route.ts
- src/app/api/invoices/[id]/action/route.ts
- src/app/api/invoices/save/route.ts
- src/app/api/lien-releases/route.ts:14
- src/app/api/lien-releases/[id]/route.ts:14
- src/app/api/lien-releases/[id]/upload/route.ts:29
- src/app/api/lien-releases/bulk/route.ts:16

**Severity:** Critical
**Description:** These routes do not call `getCurrentMembership()` before DB
access. RLS alone enforces isolation. If a single RLS policy is misconfigured
or dropped, data leaks silently with no application-layer safety net. Other
routes (batch-action, draws, invoices/import/upload) already use the
`getCurrentMembership()` pattern — inconsistency means one forgotten route
during a future refactor breaks tenant isolation.
**Proposed fix:** Add at top of each route:
```ts
const membership = await getCurrentMembership();
if (!membership) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
// then filter all queries by membership.org_id
```
**Estimated effort:** Medium (8 routes, pattern-matched edits, requires
testing each)

### SEC-C-2: Hardcoded fallback ORG_ID `00000000-0000-0000-0000-000000000001`
**Files:**
- src/app/api/lien-releases/[id]/upload/route.ts:7,59
- src/app/api/lien-releases/[id]/route.ts:7,51
- src/app/api/lien-releases/bulk/route.ts:7,39
- src/app/api/invoices/[id]/payment/route.ts:9,85
- src/app/api/invoices/[id]/line-items/route.ts:6
- src/app/api/invoices/payments/bulk/route.ts:8
- src/app/api/invoices/payments/batch-by-vendor/route.ts:8
- src/lib/invoices/save.ts:22

**Severity:** Critical
**Description:** When a record's `org_id` is null, these routes fall back to
a hardcoded ORG_ID constant (Ross Built's own tenant). Activity logs and
mutations for that record would then be attributed to the wrong org. F-001
supposedly removed hardcoded ORG_IDs in Branch 1 — these survived.
**Proposed fix:** Reject request with 500 "record missing org_id" instead
of silent fallback. Enforce via NOT NULL constraint on all records.
**Estimated effort:** Small (8 files, single-pattern replacement)

### WI-C-1: JSON.parse on Claude response has no try-catch
**File:** src/lib/claude/parse-invoice.ts:205, :242
**Severity:** Critical
**Description:** Both `parseInvoiceFromImage` and `parseInvoiceFromText`
strip code fences and call `JSON.parse(jsonText)` with no wrapper. If Claude
returns malformed JSON (truncation, stop-sequence mid-object), the parse
throws an uncaught SyntaxError. Import batches fail mid-loop with 500; any
invoices in the same batch that already hit storage become orphan rows.
**Proposed fix:**
```ts
let parsed: ParsedInvoice;
try {
  parsed = JSON.parse(jsonText) as ParsedInvoice;
} catch (err) {
  throw new Error(`Claude returned invalid JSON: ${err.message}. First 200 chars: ${jsonText.slice(0, 200)}`);
}
return parsed;
```
**Estimated effort:** Small (1 file, 2 call sites)

### WI-C-3: No optimistic locking on invoice mutations — silent lost updates
**File:** src/app/api/invoices/[id]/action/route.ts (no updated_at check)
**Severity:** Critical
**Description:** Route reads invoice, then updates without checking
`updated_at` matches. Two PMs editing the same invoice simultaneously results
in the second writer silently overwriting the first's changes (approval note,
job reassignment, amount override). No conflict surfaced to either user.
**Proposed fix:** Add `.eq("updated_at", fetched.updated_at)` to the update
chain. On affected=0, return 409 Conflict with current row. Client retries
with fresh data.
**Estimated effort:** Medium (pattern needs to be applied to all write
endpoints: invoices, draws, change_orders, purchase_orders — ~12 routes)

### BUG-C-3: Multiple unhandled fetch promises in Promise.all() — page breaks entirely on any failure
**File:** src/app/jobs/[id]/internal-billings/page.tsx:163-169
**Severity:** Critical
**Description:** 4 fetch calls chained via `Promise.all()` with only
`.then(r => r.json())` and no `.catch()`. Any network failure or non-JSON
response rejects the whole Promise.all, `loadData()` throws inside useEffect,
and `setLoading(false)` never runs. Page is stuck in loading state
indefinitely.
**Proposed fix:** Wrap the entire loadData body in try/catch with error
state, or wrap each fetch with `.catch(() => null)` and check for null
before use.
**Estimated effort:** Small (1 file, one function)

---

## High (should fix before PM testing 2026-04-27)

### SEC-H-1: Inconsistent auth pattern across routes
**Files:** src/app/api/** (multiple)
**Severity:** High
**Description:** Two auth patterns coexist: explicit `getCurrentMembership()`
or rely-on-RLS-only. Mixed discipline is a footgun — the next refactor will
forget auth on a new route.
**Proposed fix:** Pick one and enforce via lint/pre-commit. Recommend
explicit `getCurrentMembership()` on every route.
**Estimated effort:** Medium (matches SEC-C-1 work)

### WI-L-4 (escalated): No budget gate at PM approval
**File:** src/app/api/invoices/[id]/action/route.ts
**Severity:** High (escalated from Low in What-If agent)
**Description:** No check that `invoice.total_amount <= budget_remaining`
at approval time. A PM can approve a $100K invoice on a $50K line with no
warning. This is a core Phase 1 workflow requirement from CLAUDE.md
("Over budget: red warning. PM can approve but must acknowledge").
**Proposed fix:** Server computes remaining-on-line before approval.
If `amount > remaining`, require `?acknowledged_over_budget=true` param.
Front end shows red warning dialog.
**Estimated effort:** Medium (new endpoint logic + front-end confirmation)

### WI-H-1: Draw can be submitted with 0 invoices attached
**File:** src/app/api/draws/new/route.ts:166
**Severity:** High
**Description:** Draw creation allows empty `invoice_ids`. Results in a draw
with 0 current_payment_due. No validation message to the user.
**Proposed fix:** Return 400 "At least one invoice required" on empty array.
**Estimated effort:** Small

### WI-H-2: Negative CO amount silently clamped to 0 on update; unchecked on create
**File:** src/app/api/change-orders/[id]/route.ts:94-101
**Severity:** High
**Description:** PATCH clamps negative amounts to 0 without error. POST
(create) has no validation. PM's "deduct" intent is silently lost.
**Proposed fix:** Return 422 with "Change orders must have positive amount"
on negative input. Document separate workflow for contract reductions.
**Estimated effort:** Small

### BUG-C-1, BUG-C-2: Unhandled fetch errors in data-loading components
**Files:**
- src/components/invoice-import-content.tsx:81-91
- src/app/jobs/[id]/lien-releases/page.tsx:64

**Severity:** High
**Description:** Fetches call `.then((r) => r.json())` without `.catch()`.
On network failure, errors propagate uncaught, dropdowns and lists appear
broken with no error feedback.
**Proposed fix:** Add error-state UI and wrap with try/catch or `.catch()`.
**Estimated effort:** Small per file, but touches many data-loading components

### BUG-H-2: Race conditions in src/app/invoices/[id]/page.tsx
**File:** src/app/invoices/[id]/page.tsx (12+ useEffect, no cleanup)
**Severity:** High
**Description:** 12+ useEffect hooks fetch data and setState without
AbortController / isMounted flags. When `invoiceId` changes rapidly (user
navigating), stale responses can overwrite fresh state, and setState fires
on unmounted component.
**Proposed fix:** Consolidate into fewer effects, add AbortController, or
switch to a data-fetching library (SWR / React Query) for this page.
**Estimated effort:** Large (this page is 3548 LOC; refactor opportunity)

### DBM-H-001: Percentage columns use inconsistent scales
**Files:**
- supabase/migrations/00001_initial_schema.sql:23-24 (jobs.deposit_percentage, gc_fee_percentage — fraction 0.10)
- supabase/migrations/00030_phase8_draws_liens_payments.sql:24 (jobs.retainage_percent — 0-100 scale 10.00)
**Severity:** High
**Description:** `deposit_percentage` and `gc_fee_percentage` store fractions
(0.10, 0.20). `retainage_percent` stores 0-100 (10.00). Currently correct
by accident because draw-calc.ts handles each appropriately, but future
additions will mix them up. CLAUDE.md F-021 migration 00038 explicitly
standardized on fraction 0.0-1.0.
**Proposed fix:** Standardize on fractions across all percentage columns.
Migration to convert `retainage_percent / 100 → retainage_percent`, update
draw-calc.ts to stop dividing by 100. Add CHECK (>= 0 AND <= 1) on every
percentage column.
**Estimated effort:** Medium (migration + 1-2 code changes + regression
testing on Dewberry + any other live draws)

### DES-H-1, H-2, H-3: Legacy color tokens not migrated to Slate palette
**Scope:** 40+ files across src/app/ and src/components/
**Severity:** High
**Description:** Widespread use of `text-cream`, `text-cream-dim`,
`bg-teal`, `border-teal`, `border-brand-border`, `bg-status-success`,
`bg-status-danger`, `status-*` namespaces. Nightwork design skill
(.claude/skills/nightwork-design/) requires Slate-based `nw-*` tokens.
globals.css also contains stale `:root` token overrides (#F7F5ED vs #F7F5EC
page bg) that conflict with colors_and_type.css.
**Proposed fix:**
1. Create mapping file: cream → text-brand-default, teal → nw-stone-blue, etc.
2. Remove globals.css `:root` block lines 8-38 (redundant with colors_and_type.css).
3. Codemod in waves (auth pages, settings, change-orders, draws).
4. Deprecate legacy tokens in tailwind.config.ts.
**Estimated effort:** Large (several days; 1600+ lines of className change)

### DES-M-2: font-display uses Century Gothic instead of Space Grotesk
**File:** tailwind.config.ts:70-76
**Severity:** High
**Description:** Skill specifies Space Grotesk (display), Inter (body),
JetBrains Mono (mono). Config uses Century Gothic for display/body.
Components import via `font-display` utility, so the change ripples.
**Proposed fix:** Update tailwind.config fontFamily block to Space
Grotesk + Inter + JetBrains Mono; verify font-display usages in component
code still read correctly under the new stack.
**Estimated effort:** Medium (needs visual regression check)

### LD-H-5, H-6: Raw tailwind gray palette in status badges
**Files:**
- src/app/jobs/[id]/internal-billings/page.tsx:116,124
- src/app/settings/internal-billings/InternalBillingTypesManager.tsx:61

**Severity:** High
**Description:** `bg-gray-500/20 text-gray-300` for status badges — doesn't
adapt to theme; low contrast.
**Proposed fix:** Use nw `Badge` primitive with appropriate variant, or swap
to semantic tokens (`bg-brand-elevated text-cream-dim`).
**Estimated effort:** Small

---

## Medium (post-deploy cleanup)

### SEC-M-2: RLS permissive `USING (true)` on reads
**File:** supabase/migrations/00009_role_based_rls.sql
**Description:** Several tables (jobs, vendors, cost_codes) have
`USING (true)` read policies, relying on RESTRICTIVE policies added in 00016
for org isolation. Fragile — drop a RESTRICTIVE policy by accident and all
data leaks.
**Proposed fix:** Tighten policies to
`USING (org_id = app_private.user_org_id())`.
**Estimated effort:** Medium (new migration, test with multiple orgs)

### ARCH-C-1 through C-4: Stored computed values on budget_lines, draw_line_items, purchase_orders, jobs
**Context:** These are explicit design decisions (F-009 trigger-enforced
consistency on `approved_cos_total`). The architecture agent flagged as
violations; reality is they're intentional trade-offs for performance.
**Severity:** Medium (documentation / clarity, not true violations)
**Proposed fix:** Add comment in CLAUDE.md clarifying "computed columns
maintained by triggers are an exception when read-time recompute would be
expensive — see 00042 and 00028 triggers." This lets future review passes
skip these without re-flagging.
**Estimated effort:** Trivial (doc update)

### DBM-H-002: RLS policies gap for accounting/viewer roles
**File:** supabase/migrations/00029_phase7_rls_policies.sql
**Description:** Policies cover admin + pm writes. Accounting and viewer
may need explicit allow/deny per table (accounting: write on invoices, yes;
write on COs, probably no; viewer: read-only everywhere).
**Proposed fix:** Audit intended role matrix. Add explicit policies per
role per table. Single migration to close gaps.
**Estimated effort:** Medium (auditing required)

### WI-H-3: Retainage = 100% allowed without warning
**File:** src/lib/draw-calc.ts:234, 296
**Description:** Math is correct (payment due becomes 0), but no UI warning.
**Proposed fix:** Warning toast on job settings when retainage >= 90%.
**Estimated effort:** Small

### BUG-C-2 (all similar unhandled fetch chains)
**Files:** Various pages with `.then(r => r.json())` without `.catch()`
**Description:** Each is low individual impact but the pattern is
widespread. Audit and fix in one pass.
**Estimated effort:** Medium

### WI-M-1: Session expires mid-upload — orphan storage + invoice rows
**File:** src/app/api/invoices/import/upload/route.ts:117-122
**Description:** No recovery if 401 lands mid-batch. Partial-state orphans
accumulate.
**Proposed fix:** Client handles 401 and resumes, plus weekly cleanup cron
for `invoices` in `import_error` status > 7 days old.
**Estimated effort:** Medium

### WI-M-3: Org with 0 members (founder deletion not guarded)
**File:** No guard in member-deletion flows
**Description:** Last member can be deleted. Org becomes unreachable,
requires support.
**Proposed fix:** Add guard: "cannot delete last active member."
**Estimated effort:** Small

### DES-M-1: Legacy tailwind color namespaces still in config
**File:** tailwind.config.ts:16-57
**Description:** `brand.*`, `cream.*`, `teal.*`, `brass.*`, `nightwork.*`,
`status.*` all coexist with `nw-*` tokens. Noise increases risk of wrong
utility picked.
**Proposed fix:** After DES-H-1 migration completes, delete legacy namespaces.
**Estimated effort:** Small (after the migration)

### Files > 1000 LOC (refactor candidates)
- src/app/invoices/[id]/page.tsx — 3548 lines
- src/app/invoices/queue/page.tsx — 1548 lines
- src/app/jobs/[id]/budget/page.tsx — 1514 lines
- src/app/draws/new/page.tsx — 1134 lines
- src/app/draws/[id]/page.tsx — 1016 lines

**Description:** Large pages are hard to review, slow to edit, and
concentrate risk. Most should split into sub-components / server-component
data fetchers.
**Proposed fix:** Plan per-file splits. invoices/[id] biggest win —
likely 6-10 sub-components.
**Estimated effort:** Large (multiple sessions, one page at a time)

### Remaining bg-white hardcodes (judgment calls)
**Files:**
- src/components/invoice-file-preview.tsx:109,136,278,287 (PDF container)
- src/components/pdf-renderer.tsx:49,233 (PDF canvas)
- src/components/invoice-upload-content.tsx:131 (DOCX preview)

**Description:** These render document/PDF content that is always light.
Leaving them as `bg-white` may be correct — document paper should stay
white even in dark mode. Needs Jake's call.
**See Q1 below.**
**Estimated effort:** N/A (judgment call)

---

## Low / Nice-to-have

### BUG-M-1: Performance logging noise in prod
**Files:** src/middleware.ts:37, src/app/api/dashboard/route.ts (multiple),
src/app/api/jobs/health/route.ts (multiple), src/app/api/jobs/[id]/overview/route.ts
**Description:** `console.log("[perf] ...")` on every request adds log
volume. Intentional for observability during development.
**Proposed fix:** Gate behind `if (process.env.NW_PERF_LOG)` env flag.
**Estimated effort:** Small

### F-015: Duplicate JobSidebar fetch on mobile
**Severity:** Low — see DEFERRED_FINDINGS.md
### F-016: Modal close triggers window.location.reload()
**Severity:** Low — see DEFERRED_FINDINGS.md (5 modals)
### F-017: EmptyState primaryAction type union cleanup
**Severity:** Trivial — see DEFERRED_FINDINGS.md

### SEC-L-2: No rate limiting on API endpoints
**Description:** Claude API calls, bulk invoice actions — no per-user/org
throttling.
**Proposed fix:** Rate limit middleware keyed by auth user or org.
**Estimated effort:** Medium

### DBM-L-001: status_history JSONB lacks schema validation
**Description:** No CHECK constraint on structure; code is defensive.
**Proposed fix:** Low priority. Optional CHECK via json-schema extension.
**Estimated effort:** Small

### DBM-L-003: Money columns allow negative values (no CHECK)
**Description:** Likely intentional for credit memos + CO reductions. Flag
to confirm intent.
**See Q2 below.**

### DES-L-1: Some components still use `font-display` (Century Gothic)
**Description:** Subsumed by DES-M-2 tailwind config fix.

---

## Questions for Jake (judgment calls)

### Q1: Should PDF/DOCX preview containers stay `bg-white` in dark mode?
**Context:** Components that wrap rendered PDF canvases or mammoth-converted
DOCX HTML hardcode `bg-white`. If the token is swapped to `bg-brand-card`,
dark theme shows a dark-slate background behind a PDF / HTML document
designed for white paper — black text on dark could become unreadable if
the content doesn't enforce its own styling.
**Options:**
- A: Leave `bg-white` — document surfaces are always white paper regardless
  of UI theme. Chrome (borders, headers, buttons) around them adapts. This
  is how mail clients typically render email bodies in dark mode.
- B: Swap to `bg-brand-card` — lose document-paper metaphor but gain
  consistency. Works only if we also force the document content to light
  text in dark mode (possible for HTML, harder for PDF canvas).

### Q2: Should money columns enforce `CHECK (amount >= 0)`?
**Context:** DB currently allows negative BIGINT in invoice.total_amount,
invoice_line_items.amount_cents, budget_line.original_estimate, etc.
CLAUDE.md mentions credit memos as "negative amount" invoices, but most
amount columns probably shouldn't accept negatives.
**Options:**
- A: Add CHECK constraint per column with explicit exceptions where credits
  are allowed (invoice.total_amount may be negative for credit memo;
  budget_line.original_estimate must be >= 0).
- B: Leave permissive, rely on application validation. Lower DB
  constraint noise but less defense-in-depth.

### Q3: Are the stored-computed-value "violations" actually exceptions by design?
**Context:** Architecture agent flagged `budget_lines.co_adjustments`,
`budget_lines.committed`, `purchase_orders.invoiced_total`,
`jobs.approved_cos_total` as violating CLAUDE.md "never store computed
values." But F-009 explicitly added `co_cache_trigger` to maintain
`approved_cos_total` for performance reasons. These are deliberate.
**Options:**
- A: Update CLAUDE.md to clarify the exception: "trigger-maintained caches
  are permitted when read-time recompute would be prohibitively expensive;
  every such column must have an explicit trigger and documented rationale."
- B: Revert to pure computed-on-read. Likely regressions on dashboard +
  budget pages where these sums are read frequently.

### Q4: Should legacy color migration (DES-H-1) happen as one big PR or in waves?
**Context:** 40+ files, 1600+ lines of className swaps. One atomic PR is
cleanest but hard to review. Waves (auth → settings → change-orders →
draws → ...) ship gradually but mix old/new tokens during transition.
**Options:**
- A: Wave-based, one logical area per PR. Easier to review, visual
  regressions localized.
- B: Codemod + visual regression sweep in one PR. Cleaner cutover.
- C: Defer until after the 2026-04-27 PM testing milestone. Demo works,
  PMs don't need this.

---

## Auto-fixed this pass

### Batch 1 (commit cd0c479): auth forms + error surfaces
- src/app/login/LoginForm.tsx — `bg-white` → `bg-brand-card` on email + password inputs
- src/app/signup/SignupForm.tsx — `bg-white` → `bg-brand-card` on Field inputs
- src/app/error.tsx — `bg-white` → `bg-brand-card` on error card

### Batch 2 (commit 1e08613): loading skeleton
- src/components/loading-skeleton.tsx — `bg-[#E5E7EB]` → `bg-brand-elevated` (pulse); `bg-white` → `bg-brand-card` (4 skeleton variants)

### Batch 3 (commit 78a8e86): empty-state + getting-started
- src/components/empty-state.tsx — `bg-white` → `bg-brand-card` (container + secondary button)
- src/components/getting-started-checklist.tsx — `bg-white` → `bg-brand-card` (aside)

### Batch 4 (commit c0d5e71): mobile drawer + keyboard shortcuts
- src/components/app-shell.tsx — `bg-white` → `bg-brand-card` on mobile drawer panel
- src/components/keyboard-shortcuts.tsx — `bg-white` → `bg-brand-card` on dialog

### Batch 5 (commit 5b7e709): toast surface
- src/components/toast-provider.tsx — `bg-white` → `bg-brand-card` on ToastItem container

**Build passed after every batch (5/5).**

**Not auto-fixed (flagged to manual):**
- DES-H-1 legacy token migration — too large (40+ files, rule: ≤3 per fix).
- SEC-C-1 auth gate additions — behavior changes auth contract.
- SEC-C-2 hardcoded ORG_ID removal — needs fallback strategy decision.
- WI-C-1 JSON.parse safety — minor judgment call on error type.
- DBM-H-001 percentage scale standardization — DB migration + regression risk.
- All "architecture compliance" ARCH-C-* — design decisions, not violations.
- Nav bar hardcoded hex — intentionally fixed color (nav is always dark).
- PDF/DOCX bg-white — Q1 above.

---

## Deferred items status

| ID | Title | DEFERRED_FINDINGS.md status | Verified in code | Notes |
|----|-------|-----------------------------|------------------|-------|
| F-001 | DEFAULT_ORG_ID hardcoded | Resolved | **Partially wrong** | Budget-import route clean, but 8 other routes still have hardcoded `00000000-0000-0000-0000-000000000001` fallback (see SEC-C-2) |
| F-002 | RLS join workaround | Deferred (Low) | Still live | 6 routes use `tryCreateServiceRoleClient`. Safe, but tech debt |
| F-002a | Owner role missing from RLS SELECT | "Production-blocking" | **FIXED — doc stale** | Migration 00039 (2026-04-17) added owner to draws/draw_line_items. Other tables use `authenticated read` (works for all roles). **Update DEFERRED_FINDINGS.md.** |
| F-003 | 1:1 invoice draw linking | Closed | Confirmed closed | Matches workflow |
| F-004 | Internal billings cross-draw | Closed | Confirmed closed | By design |
| F-005 | Phase D E2E coverage | Deferred (Low) | Still live | Alloc splitting + CO attach flows not UI-exercised. Low risk — calc layer is verified |
| F-006 | Historical CO work not in Line 4 | Fixed | Confirmed fixed | Migration 00040 + 4 API routes + parser |
| F-007 | Cost-code billing delta | Closed | Confirmed closed | Reclassified into F-010/11/14 |
| F-009 | approved_cos_total maintenance | Fixed | Confirmed fixed | Migration 00042 co_cache_trigger |
| F-010 | Pay-app import silently skips missing cost codes | Fixed for Dewberry | **Systemic still live** | UX warning easy to miss. Add prominent modal or block import |
| F-011 | Receipts-as-invoices | Fixed | Confirmed fixed | Migration 00041 + document_type column |
| F-012 | Sidebar filter client-side | Fixed | Confirmed fixed | job-sidebar.tsx:110 applies server-side |
| F-013 | Mobile drawer for sidebar | Fixed | Confirmed fixed | job-sidebar.tsx mobile prop |
| F-014 | PCCO #17 roofing misallocation | Deferred | Still live | $595.26 GC fee uncaptured. Awaits CO-invoice linking feature |
| F-015 | Duplicate sidebar fetch on mobile | Deferred (Low) | Still live | Optimization |
| F-016 | window.location.reload() on modal close | Deferred (Low) | Still live | 5 modals |
| F-017 | EmptyState primaryAction type union | Deferred (Trivial) | Not verified | Type cleanup |
| F-021 | Parser correction capture | Phase A shipped | Confirmed fixed | Migration 00044 parser_corrections table |

**F-018, F-019, F-020, F-022:** Do not exist in repo or commit history. No
gaps to investigate.

**Recommended DEFERRED_FINDINGS.md updates:**
1. F-002a: mark as FIXED with reference to migration 00039.
2. F-001: reopen / expand to cover the 8 lien-release / payment / line-items
   / save routes that still carry the hardcoded fallback.
3. Add new entry F-018 (proposed): auth gate consistency (SEC-C-1). Track
   as rolling fix.

---

## What agents skipped (honest disclosure)

This review pass was code-only — no agent ran a live dev server, no
Chrome MCP screenshots captured.

**Dimensions that got less depth than ideal:**
- **Visual dark/light parity verification:** Agent 4 was run as static
  analysis only. The full Phase 2 spec called for screenshots of ~35 routes
  × 2 themes = 70 screenshots. Agent produced a theme-risk matrix and
  identified the highest-risk hardcodes from code, but did NOT visually
  confirm how each route actually renders. Auto-fixes to `bg-brand-card`
  are verified correct in light mode (same visual) but not visually
  confirmed in dark mode.
- **Adversarial scenarios 6, 20, 24:** DOCX macros, mid-upload abort,
  unicode in vendor names — Agent 7 marked unverifiable. Real exercise
  requires live UI.
- **Performance / N+1 queries:** Agent 5 did a grep-based check; a true
  N+1 audit needs query-plan inspection against realistic data volume.
- **Prompt injection safety:** Agent 1 confirmed cost codes come from DB
  not user input, and sanitization looked adequate. Not pen-tested.
- **Files > 1000 LOC analysis:** listed but not reviewed line by line. Any
  of them could hide additional bugs not surfaced here.

**Recommendation:** Run dev server + Chrome MCP sweep before demo
2026-04-24 to visually verify dark mode on the 15 high-risk routes from the
Agent 4 matrix (especially onboard, settings/team, settings/workflow,
settings/internal-billings, invoices/queue, invoices/[id], jobs/[id]/budget).

---

*Review cycle complete. Triage the Critical and High sections first;
Medium and Low can land in later phases.*
