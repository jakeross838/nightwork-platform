# Audit Roundup — Nightwork Codebase Review
**Date:** 2026-04-24
**HEAD at audit:** `68115a0`
**Branches/phases covered:** Whole codebase (78 migrations, ~200 source files, all API routes)
**Method:** `/gsd-map-codebase` baseline + 5 parallel specialist review agents

---

## Contents

- [Executive summary](#executive-summary)
- [Top 8 critical items (must-fix before production)](#critical-must-fix)
- [High-priority themes](#high-priority-themes)
- [Action plan](#action-plan)
- [Positive observations](#positive-observations)
- [Per-audit breakdown](#per-audit-breakdown)
- [Source documents](#source-documents)

---

## Executive summary

| Severity | Total | Where concentrated |
|---|---|---|
| **CRITICAL** | **8** | 4 backend auth (C-1..C-4), 1 frontend XSS (C-1), 2 UX nav/keyboard (U-1/U-2), 1 data-model RLS bootstrap (D-1) |
| **HIGH** | ~24 | Auth/locking gaps in mutations, schema drift vs Part 2 §2.3, client-layer Supabase queries bypassing API, accessibility |
| **MEDIUM** | ~40 | Audit trail gaps, stale closures, large files, token drift, inconsistent error shapes |
| **LOW** | ~17 | Hygiene, docs, minor polish |

**Overall grade: B−.** The rebuild plan's discipline is visible — optimistic locking, `getCurrentMembership()`, status_history, and cents-math are implemented consistently in the well-trodden paths (invoice single-action, draws, change-orders PATCH). The weaknesses are at the **boundaries** — routes that were added quickly (batch actions, partial-approve, bulk payments, vendor merge), pages that pre-date the architecture rules (large client-side Supabase queries), and infra that was done manually in Supabase dashboard instead of migrations (RLS enablement).

**Readiness verdict:** *Not production-ready yet.* The 8 CRITICALs are individually fixable in hours, but D-1 (RLS not enabled in migrations) is a deployment-blocker: a fresh deploy from migration files produces a system with world-readable tenant data.

---

<a id="critical-must-fix"></a>
## Top 8 critical items (must-fix before production)

Ordered by blast radius.

### 1. RLS never enabled in migrations for 8 core tables — fresh deploy leaks everything
- **Source:** `qa-reports/audit-data.md` D-1
- **Tables:** `jobs`, `invoices`, `draws`, `draw_line_items`, `vendors`, `budget_lines`, `purchase_orders`, `cost_codes`
- **Finding:** Policies exist, but no migration runs `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` on them. Enablement was done by hand in the Supabase dashboard and never codified.
- **Fix:** Single idempotent migration `00079_enable_rls_core_tables.sql` that enables + FORCEs RLS on all 8. ~30 min of work.
- **Blast radius:** Every future fresh deploy (CI, disaster recovery, new dev env).

### 2. `POST /api/vendors/merge` — no auth check before destructive mutations
- **Source:** `qa-reports/audit-backend.md` H-1 (this is labeled HIGH in the file but functionally CRITICAL — listing here because it has zero role gate)
- **Location:** `src/app/api/vendors/merge/route.ts:13–118`
- **Finding:** Executes three destructive ops (update invoices, update POs, soft-delete vendors) before `getCurrentMembership()` is called. Any authenticated user in any org can mass-reassign another org's invoices and soft-delete vendors.
- **Fix:** Move auth to top, gate on admin/owner, add `.eq("org_id", membership.org_id)` to all three updates.

### 3. `POST /api/invoices/[id]/partial-approve` — auth bypass
- **Source:** `qa-reports/audit-backend.md` C-3
- **Location:** `src/app/api/invoices/[id]/partial-approve/route.ts:13–17`
- **Finding:** Uses `supabase.auth.getUser()` only. No `getCurrentMembership()`, no `org_id` filter. Cross-org approval possible by anyone who knows an invoice UUID.
- **Fix:** Standard pattern — `getCurrentMembership()` + `.eq("org_id", membership.org_id)` + `parent.org_id === membership.org_id` sanity check.

### 4. `PATCH`/`DELETE /api/budget-lines/[id]` — writes without `org_id`
- **Source:** `qa-reports/audit-backend.md` C-4
- **Location:** `src/app/api/budget-lines/[id]/route.ts:22–131`
- **Finding:** Membership check passes but `org_id` is never applied to the write queries. Cross-org budget mutation if RLS drops.
- **Fix:** Add `.eq("org_id", membership.org_id)` to fetch, UPDATE, and soft-delete queries.

### 5. XSS via unsanitized Mammoth HTML → `dangerouslySetInnerHTML`
- **Source:** `qa-reports/audit-frontend.md` C-1
- **Location:** `src/components/invoice-file-preview.tsx:258`, `src/components/invoice-upload-content.tsx:147`, `src/app/api/invoices/[id]/docx-html/route.ts`
- **Finding:** No HTML sanitizer anywhere in the project. A malicious DOCX uploaded as an invoice can execute arbitrary script in the browser of any authenticated viewer.
- **Fix:** Install `isomorphic-dompurify`, sanitize at render site and at the API route that serves `docx_html`.

### 6. Six broken nav links in Financial dropdown — every click 404s
- **Source:** `qa-reports/audit-ux.md` U-1
- **Location:** `src/components/nav-bar.tsx:93–104`
- **Finding:** `buildFinancialItems()` hardcodes `/payments`, `/aging`, `/lien-releases`, `/change-orders`, `/purchase-orders` — none exist. Accounting cannot reach their three most-used routes from the nav.
- **Fix:** Update to `/invoices/payments`, `/financials/aging-report`, `/invoices/liens`; remove CO/PO entries.

### 7. Invoice list rows use `window.location.href` on `<tr onClick>` — broken keyboard/a11y
- **Source:** `qa-reports/audit-ux.md` U-2
- **Location:** `src/app/invoices/page.tsx:586–591`, `src/app/invoices/payments/page.tsx:472`
- **Finding:** No `<a>` element. Breaks Cmd/Ctrl+click (new tab), screen readers, keyboard activation, browser history. Also contains dead code (both branches of a `reviewable` ternary go to the same URL).
- **Fix:** Wrap the vendor-name cell in `<Link>`. Consider full-row anchor via `display: contents`.

### 8. `GET /api/change-orders/[id]` + `GET /api/purchase-orders/[id]` — no `org_id` filter
- **Source:** `qa-reports/audit-backend.md` C-1, C-2
- **Finding:** Same file's PATCH/DELETE handlers correctly use `getCurrentMembership()` + `org_id`, but the GET just calls `auth.getUser()`. Relies on RLS alone.
- **Fix:** Apply the established pattern. ~15 min per route.

---

<a id="high-priority-themes"></a>
## High-priority themes

The specialist audits clustered around six recurring patterns. Fixing the theme (not each finding individually) will knock out multiple items.

### Theme 1 — Defense-in-depth on org scoping is inconsistent
- `getCurrentMembership()` is used in ~85% of API routes but the remaining 15% rely on `auth.getUser()` or RLS alone. Pattern fragments: GET handlers correctly scope on mutations but not reads; deep joins use service-role fallback (DEFERRED_FINDINGS F-002); 31 client-side page files query Supabase browser-client directly.
- **Remediation:** One audit-style sweep — add a CI check that fails any new route that doesn't import `getCurrentMembership`. Migrate the 31 client-side pages to `fetch("/api/...")` starting with the 4 over 1,000 lines.

### Theme 2 — Optimistic locking is partially deployed
- `updateWithLock()` used on 7 PATCH routes but missing on: invoice PATCH (recent commit `7202368`), partial-approve parent update, batch-action approvals, bulk payment mark-paid.
- **Remediation:** Thread `expected_updated_at` through the 4 remaining mutation paths. The library is already in place; this is mechanical.

### Theme 3 — Audit trail is split and not surfaced
- Field-edit mutations now write to `activity_log` (good for auditors) but the UI timeline only renders `status_history` (users don't see them). Privileged PATCH edits are invisible in the UI.
- **Remediation:** Either (a) merge both into the timeline view, or (b) append a minimal status_history entry for privileged edits. Decision needed.

### Theme 4 — Schema drift vs Part 2 §2.3 enum inventory
- `purchase_orders.status` missing `'accepted'`; `invoices.status` still has `'received'`/`'ai_processed'` not in target; `lien_releases.release_type` has 4 legacy values; `document_extractions.verification_status` deferred divergence.
- **Remediation:** Migration `00080_align_status_enums_phase2.sql` — model after 00060. Coordinate with API routes that still write deprecated values.

### Theme 5 — Frontend pages are too large and bypass the API layer
- 5 page files >1,000 lines; worst: `src/app/invoices/[id]/page.tsx` at 2,592 lines with 11 useEffect hooks. 15 suppressed `exhaustive-deps` warnings with real stale-closure risk (`draws/new/page.tsx:251,305` — editing date range doesn't reset invoice selection).
- **Remediation:** Decomposition pass on the 5 offenders. Introduce a `useApiQuery` hook to replace inline `supabase.from()` calls.

### Theme 6 — Accessibility baseline is weak
- UX pillar scores: Accessibility 2/4, Mobile 2/4. Filter forms app-wide lack `<label>`/`aria-label`; modals lack focus trapping + `aria-modal`; status badges use color-only signaling; 12-value status grid unreadable at 375px; touch targets below 44px.
- **Remediation:** Two passes: (a) mechanical — add `aria-label` to all filter controls, wrap modals with focus-trap util; (b) design — rework badge to include a glyph/text prefix, expand touch targets on filter bars.

---

<a id="action-plan"></a>
## Recommended action plan

### Phase A — Lockdown (2 days)
Purpose: Close every CRITICAL.
1. Migration `00079_enable_rls_core_tables.sql` + `.down.sql`.
2. Fix `vendors/merge`, `partial-approve`, `budget-lines/[id]` auth (backend C-3, C-4, H-1).
3. Fix `change-orders/[id]` and `purchase-orders/[id]` GET handlers (backend C-1, C-2).
4. Install `isomorphic-dompurify`, sanitize DOCX render sites + API route (frontend C-1).
5. Fix nav-bar financial dropdown links (UX U-1).
6. Wrap invoice list rows with `<Link>` + remove `window.location.href` (UX U-2).
7. Commit migration 00078 with `.down.sql` (data D-14).

### Phase B — Reinforcement (3–5 days)
Purpose: Close HIGH themes.
1. Add optimistic locking to the 4 remaining mutation paths (Theme 2).
2. Add `.eq("org_id", ...)` to all GET handlers that miss it (Theme 1) — sweep via grep.
3. Migrate 4 pages >1,000 lines off client-side Supabase queries (Theme 5, highest-ROI).
4. Schema alignment migration for enum drift (Theme 4).
5. Add `aria-label` to every filter control, implement focus trap for modals (Theme 6).

### Phase C — Consistency cleanup (1 week, parallelizable)
Purpose: Address MEDIUMs.
- Merge `activity_log` into timeline (Theme 3).
- Component decomposition: extract `InvoiceStatusPanel`, `InvoiceEditForm`, `InvoiceHistoryTimeline` from the 2,592-line invoice detail.
- Console.log cleanup (21 routes + 2 pages) — move to structured logger.
- Inline `style={{}}` → utility classes (845 instances, pick highest-touched files).
- Stable keys on allocation/line-item list renders.

### Phase D — Polish
Address LOWs during normal feature work. Nothing here blocks anything.

---

<a id="positive-observations"></a>
## Positive observations

- **Slate token migration is fully clean.** Zero legacy `cream-*`/`teal-*`/`brass-*`/`brand-*`/`nightwork-*` class violations across 232 files (one `--status-danger` CSS-var holdout remains).
- **Migration discipline from 00060 onward is strong.** Every migration has paired `.down.sql`, inline rationale, `public.` schema qualification, and transaction boundaries.
- **Platform admin pattern is well-designed.** Audit-log-first pattern, signed cookie for impersonation, Sentry tagging. This is the model for future cross-cutting features.
- **Core workflow routes (invoice single-action, draws PATCH, change-orders PATCH) are well-hardened.** The architecture rules were followed cleanly — optimistic locking, status_history, audit logs, org scoping.
- **Design system primitives (`NwButton`, `NwBadge`, `Money`, `DataRow`, `StatCard`) are well-specified** and consistent in new code.
- **Invoice detail 50/50 hero (post-3b merge) is the strongest UX surface in the app** — document left, parsed fields right, allocations below, one scroll.
- **Migration 00078 itself is well-written** — idempotent, transactional, soft-delete strategy for rollback. Only issue is it's uncommitted.
- **Mobile nav has a working hamburger + drawer** with proper dismissal logic.

---

<a id="per-audit-breakdown"></a>
## Per-audit breakdown

| Audit | Focus | Critical | High | Medium | Low | File |
|---|---|---|---|---|---|---|
| Backend | API routes, auth, contracts | 4 | 6 | 10 | 6 | `qa-reports/audit-backend.md` (238 lines) |
| Frontend | Components, hooks, tokens | 1 | 4 | 5 | 4 | `qa-reports/audit-frontend.md` (211 lines) |
| UI/UX | Nav, forms, accessibility, states | 2 | 5 | ~10 | ~5 | `qa-reports/audit-ux.md` (336 lines) |
| Data model | Migrations, enums, RLS, guards | 1 | 6 | 9 | 4 | `qa-reports/audit-data.md` (264 lines) |
| Recent work | Commits `bb6eb78..HEAD` | 0 | 2 | 7 | 3 | `qa-reports/audit-recent.md` (179 lines) |
| CONCERNS (mapper baseline) | Broad scan | 0 | 3 | 10 | 2 | `.planning/codebase/CONCERNS.md` (445 lines) |

Scores by UX pillar (from `qa-reports/audit-ux.md`, 1–4):

| Pillar | Score |
|---|---|
| Consistency | 3/4 |
| Accessibility | 2/4 |
| State completeness | 3/4 |
| Information density | 3/4 |
| Mobile fitness | 2/4 |
| Micro-interactions | 3/4 |

---

<a id="source-documents"></a>
## Source documents

### Codebase baseline (from `/gsd-map-codebase`, 2,218 lines total)
- `.planning/codebase/STACK.md` (94) — languages, runtime, dependencies
- `.planning/codebase/INTEGRATIONS.md` (180) — Supabase, Anthropic, Sentry, Vercel, planned QB/Buildertrend
- `.planning/codebase/ARCHITECTURE.md` (412) — layers, data flow, entity graph, RLS pattern
- `.planning/codebase/STRUCTURE.md` (404) — directory layout, naming
- `.planning/codebase/CONVENTIONS.md` (402) — style, patterns, error handling
- `.planning/codebase/TESTING.md` (281) — framework, coverage gaps
- `.planning/codebase/CONCERNS.md` (445) — tech debt baseline

### Specialist audits (this session)
- `qa-reports/audit-backend.md` — API + auth + lib
- `qa-reports/audit-frontend.md` — components + hooks + tokens
- `qa-reports/audit-ux.md` — nav + forms + accessibility + states
- `qa-reports/audit-data.md` — migrations + RLS + enums + guards
- `qa-reports/audit-recent.md` — commits since `bb6eb78`

### Authoritative source-of-truth (unchanged)
- `CLAUDE.md` — architecture + dev rules
- `docs/nightwork-rebuild-plan.md` — 7,176-line rebuild plan, 9 branches
- `qa-reports/qa-branch1-final.md`, `qa-branch2-final.md`, `qa-branch3-phase3.1.md` — completed phase QA

---

## Next actions

Ordered by urgency:

1. **Review this roundup** and the five audit files. Decide which CRITICALs you want fixed before the Phase 3.2 classifier work, vs which you want to slot into Branch 5 (Permission Hardening) or Branch 8 (Polish).
2. **Commit migration 00078** — it's blocking prod-parity on any fresh environment.
3. **Fix the 8 CRITICALs** — probably 1–2 focused sessions. None require schema changes beyond the RLS enablement migration.
4. **Decide on Theme 3 (audit trail UI)** — the unified timeline is a design decision, not a mechanical fix.
5. **Revisit `/gsd` adoption after Branch 3 ships** — this audit demonstrates the specialist-agent swarm pattern works without committing to full `/gsd` workflow. Fine to stay on the current rebuild-plan cadence.
