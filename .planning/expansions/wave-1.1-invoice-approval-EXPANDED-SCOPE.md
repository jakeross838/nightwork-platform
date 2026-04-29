# Expanded scope — wave-1.1-invoice-approval

**Status:** DRAFT — pending Jake approval
**Generated:** 2026-04-29 (Stage 1.6 validation demo)
**Stated scope (Jake's words):** "Polish invoice approval and ship to Ross Built for real Drummond use. Make it bulletproof and mobile-friendly."

This expansion is the validation deliverable for Stage 1.6 — the demo that Jake reviews to confirm the `nightwork-requirements-expander` agent produces high-quality, opinionated requirements analysis. Per nwrp8.txt Job 3.

---

## 1. Mapped entities and workflows

| Entity / workflow | VISION wave | Current state | Notes |
|---|---|---|---|
| `invoices` | Wave 1 | **COMPLETE** (CURRENT-STATE A.1) — RLS solid, audit + status_history present, soft-delete via void status. Most-mature entity. | This phase is hardening, not building. |
| `invoice_line_items` + `invoice_allocations` | Wave 1 | COMPLETE / coexisting per A.3.3 (4-table line shape). Documented contract per D-034; UCM consolidates later. | Polish should NOT change this; living-with for now. |
| `document_extractions` (invoice path) | Wave 1 | LIVE per canonical §7 — invoice extractor mature. AI parse + commit pipeline functional. | Watch for `extracted_data` cache invalidation if schema changes (memory `project_phase3_4_pr26_merge_blockers`). |
| Invoice approval workflow | Wave 1 | 21-value status enum (largest in system). Today hard-coded role-based PM→QA flow. | **F2 wires `approval_chains` for invoice flow first per D-024.** Wave 1.1 polish must use the framework, not the hard-coded flow. |
| `transitionEntity` helper | Foundation F2 | NOT YET — every workflow route hand-rolls status_history JSONB writes (CURRENT-STATE B.1 #4). | **F2 prerequisite.** Polish work that bypasses transitionEntity will be redone post-F2. |
| `withAuditWrap` middleware | Foundation F2 | NOT YET — audit-log coverage 31/119 routes (CURRENT-STATE D.9 #5). | F2 dependency. |
| Optimistic locking (R.10) | Existing helper | `updateWithLock()` exists in `src/lib/api/optimistic-lock.ts`. Adoption inconsistent. | This phase adopts on invoice write routes. |
| Mobile invoice review UI | Wave 1 / Stage 1.5b prototype gallery | Invoice review surface is gold-standard desktop (D.3). **Mobile audit not yet performed.** Touch targets, responsive file preview, mobile-first approval flow all unverified. | First-class scope item. |
| Drummond fixtures | Wave 1 ref job | Source 2 Supabase: 1 synthetic invoice ($22,620.90 SmartShield). Source 3 Downloads: 5 historical pay apps + 17+ vendors + lien releases. **Real history not in Supabase.** | F4 back-import (D-025). Wave 1.1 needs real data — see §2. |
| `approval_chains` config | F2 | DEAD CONFIG today — schema exists (migration 00070), zero `src/` consumers. | F2 wires it. |
| Invoice notifications | Wave 1 | LIVE — but full org fan-out per status event (13 notifications per invoice — CURRENT-STATE F.2.A.7). Signal/noise concern. | Polish-relevant: tighten fan-out scope. |
| Resend (notification delivery) | Wave 3 | API key placeholder — failures silently swallowed (CURRENT-STATE C.1 #10). | Functional dependency for owner notification. |
| Inngest (background jobs) | Foundation F3 | NOT YET — AI parse runs sync inside request (CURRENT-STATE C.1 #8). | F3 dependency. AI parse should be queued. |
| Idempotency middleware | Foundation F3 | ABSENT (CURRENT-STATE C.1 #6). | F3 dependency. |
| Rate limiting | Foundation F3 | EFFECTIVELY ABSENT (CURRENT-STATE C.1 #7). | F3 dependency. |

---

## 2. Prerequisite gaps

What MUST exist before Wave 1.1 can ship safely. Hard prerequisites are blocking — no acceptable workaround.

| # | Gap | Source | Blocking? | Resolution |
|---|---|---|---|---|
| 1 | Foundation F2 (transitionEntity helper + approval framework wiring) shipped | GAP §B; D-024 names invoice as first wired flow | **HARD BLOCKING** | F2 must complete before Wave 1.1 starts. Wave 1.1 polish IS the F2 invoice-flow validation by design. |
| 2 | Foundation F1 (entity model — payments promotion, address split, gl_codes) shipped | D-019, D-032, D-033 | **HARD BLOCKING** | F1 must complete before F2 starts; thus before Wave 1.1. |
| 3 | Foundation F3 (Inngest, idempotency, rate limit, structured logger, RLS collapse, V.2 framework) shipped | GAP §B F3 | **HARD BLOCKING** | F3 must ship before Wave 1.1 — Wave 1.1's "bulletproof" claim depends on rate limit, idempotency, and queued AI parse. |
| 4 | Foundation F4 (refactor + Drummond back-import) shipped | D-025 | **HARD BLOCKING for "real Drummond use" criterion** | F4 back-import provides the real Drummond data. Wave 1.1 IS the dogfood that Jake's stated scope names. |
| 5 | Mobile-friendly file preview component | New work | BLOCKING for "mobile-friendly" criterion | PDF.js + responsive layout; verify on iPhone Safari + Android Chrome. Likely needs zoom-and-pan touch gestures, pinch-zoom on mobile. |
| 6 | Invoice review touch-target audit | New work | BLOCKING for "mobile-friendly" | Approve/reject/kickback buttons ≥44×44px per WCAG 2.5.5 + iOS HIG; secondary actions in overflow menu on mobile. |
| 7 | `approval_chains` row for Ross Built `invoice_pm` and `invoice_qa` workflow_types seeded with default chain | F2 wiring | BLOCKING | Default seeded by trigger per migration 00070; verify Ross Built defaults match real workflow (PM on own jobs → accounting QA → admin override). |
| 8 | Drummond fixture sufficiency | F4 back-import | BLOCKING | F4 imports ≥3 historical pay apps, ≥10 vendors, ≥1 lien release set into the cleaned schema. |

**All 8 prerequisites tie back to the Foundation F1-F4 sequence (GAP §B).** Wave 1.1 is correctly placed at Strategic Checkpoint #4 (per D-012) — Wave 1 mini, after foundation closes.

**Critical path:** F1 → F2 → F3 → F4 → CP3 → Wave 1.1. ~30-43 calendar days from F1 start to Wave 1.1 start.

---

## 3. Dependent-soon gaps

What's likely needed shortly after — design for it now, even if not in scope.

| # | Gap | Likely next phase | Design implication for Wave 1.1 |
|---|---|---|---|
| 1 | Bulk approve (multi-select PM inbox) | Wave 1.2 | Today's approve/reject/kickback action signature in `transitionEntity` should be array-shaped from day one (`bulkTransition`). Don't ship per-row click-handlers that can't generalize. |
| 2 | Owner-portal invoice visibility (cost-plus open-book) | Wave 3 client portal | When PM approves, fire an event (Inngest) the client portal can consume. Keep the event payload semantic (`invoice.pm_approved` with org_id + job_id + invoice_id), not coupled to client UI. |
| 3 | Email-intake invoice ingestion | Wave 3 | Don't bake "PM uploaded" assumption into the schema or events. The intake source (PM, email-attachment, bulk-import, future API) should be a tagged field. |
| 4 | Approval delegation (role-holder on PTO) | Wave 3 | `approval_chains` should support delegation (member_id can have a `delegate_to_member_id` attribute or fallback chain). Don't hardcode "PM-only" assumptions in the matcher. |
| 5 | Multi-attachment invoice splitting | Wave 1.2 | Invoice has 1 source PDF today; the schema already supports `original_file_url` as nullable, but the parsing pipeline is single-file. Don't lock the AI extractor to "1 file = 1 invoice"; the document_extractions table can already host multi-extraction parents. |
| 6 | Owner-visible PM approval status (limited preview, no portal yet) | Wave 1.2 or Wave 3 | Add a `client_visible` flag on invoices' status_history entries; designs for "client portal sees this transition" before the portal exists. |
| 7 | Mobile-first AI logic correction | Wave 1.2 | Today's PM correction loop assumes desktop (parser_corrections table). Mobile should support tap-and-fix with a touch-friendly correction UI. |

---

## 4. Cross-cutting checklist

| Concern | Status | Rationale |
|---|---|---|
| **Audit logging** | APPLIES — verify | Invoice routes already write status_history; verify withAuditWrap middleware (F2) is wrapped on every write route Wave 1.1 touches. Acceptance: 100% of invoice mutation routes write to `activity_log` AND status_history. |
| **Permissions** | APPLIES — adopt requireRole | PM (own job), accounting (any), admin (override). Today hand-rolled per route; adopt `requireRole(['pm', 'accounting', 'admin'])` per TARGET C.5. |
| **Optimistic locking** | APPLIES — adopt on every invoice write | Use `updateWithLock()` from `src/lib/api/optimistic-lock.ts`. Returns 409 with current row on stale write. Client must reconcile. R.10 mandate. |
| **Soft-delete + status_history** | APPLIES — verify | Invoice already has these. Verify void status and pm_overrides/qa_overrides JSONB are populated correctly. |
| **Recalculate, don't increment** | APPLIES — verify | Invoice totals computed from line_items + allocations on read; verify no incremental cache writes were introduced. |
| **Multi-tenant RLS** | APPLIES — Wave 1.1 inherits F3 RLS collapse | Post-F3, invoices RLS is single permissive `org_isolation` SELECT + restrictive write narrowing. Wave 1.1 must verify queries still work under collapsed policies. |
| **Idempotency** | APPLIES — invoice upload + parse | F3 idempotency middleware wraps invoice POST routes. Idempotency key on (vendor_id, invoice_number, total_amount, invoice_date) per CLAUDE.md. |
| **Background jobs** | APPLIES — Inngest invoice/extracted event | Per F3 setup, AI parse runs as Inngest function. Wave 1.1 invoice upload triggers `invoice/uploaded` event; classify+extract+commit run as durable steps. |
| **Rate limiting** | APPLIES — invoice intake routes | F3 caps. Per-org AI-parse cap per tier (Starter 100/hr, Pro 500/hr, Enterprise unlimited). Per-IP cap on upload endpoint. |
| **Observability** | APPLIES — Sentry spans for AI parse | Wave 1.1 verifies Claude API calls are spanned (already supported per CURRENT-STATE C.1 #5). Per-route p95 dashboard updated. |
| **Data import/export** | APPLIES — F4 back-import dogfood | Wave 1.1 IS the validation that V.2 framework imports real Drummond invoices correctly. Round-trip property tested: `Import(Export(invoice)) === invoice`. |
| **Document provenance (V.3)** | APPLIES — verify FK populated | `invoices.document_extraction_id` FK populated on every commit. Polish: backfill on F4 back-imported invoices. |
| **Mobile-friendly** | **APPLIES — primary scope item** | Touch targets ≥44px; file preview responsive (pinch-zoom on mobile); approve/reject buttons primary CTA on mobile; secondary actions in overflow; horizontal scroll-reveal for line-item table. **Test on iPhone 13+ Safari and Pixel 6+ Chrome.** |
| **Drummond fixtures sufficient** | APPLIES — F4 back-import provides | Per D-025; F4 imports ≥3 pay apps, ≥10 vendors, ≥1 lien release set. Wave 1.1 validates these flow correctly. |
| **CI test gate** | APPLIES — invoice route tests | F3 sets up GitHub Actions; Wave 1.1 adds HTTP integration tests for the 5 most-used invoice routes (upload, parse, approve, kickback, void). |
| **Error handling for partial failures** | APPLIES — invoice commit atomicity | Invoice commit should be a `SECURITY DEFINER` RPC (per canonical Q10 for proposals/00065 precedent applied to invoices). All-or-nothing. |
| **Graceful degradation** | APPLIES — Anthropic rate-limited fallback | If Claude API returns 429 or 5xx, invoice parse retries via Inngest with exponential backoff; PM sees "AI parse pending" rather than error. |
| Internal labor + equipment billing | N/A | Different entity (`internal_billings`); not touched by invoice approval. |
| Recurring patterns | N/A | Invoices aren't recurring. |
| Approval delegation (PTO routing) | DEFER to Wave 1.2 | `approval_chains` supports delegation in schema; Wave 1.1 doesn't expose UI. |
| Multi-currency | N/A | FL-only single-currency. |
| Retainage | N/A directly | Invoices don't carry retainage; draws do. |
| Lien waivers | N/A directly | Different entity workflow; touches when invoice is included in draw. |
| Sub-tier suppliers | N/A | Not modeled today. |
| Tax handling | N/A | Sales tax pass-through to client in cost-plus; handled at invoice line level if vendor charged it. Verify line-item rate captures tax-inclusive vs tax-exclusive. |
| Owner notification cadence | DEFER to Wave 3 | Today PM approve fires immediate notifications to org. Owner_view role wants weekly digest, not per-event. Wave 3 wires preferences. |
| Compliance retention | APPLIES — 7-year financial | Invoices fall under FL contractor + IRS retention. Soft-delete with 7-year purge cron (F3 schedules). |

---

## 5. Construction-domain checklist

| Domain consideration | Applies? | Rationale |
|---|---|---|
| Drummond as reference job | **YES** | Wave 1.1 e2e tests run on Drummond. F4 back-imported invoices are the test data. |
| Field mistakes → permanent QC entries | NO | Invoice flow doesn't create QC entries. (Daily logs / punchlist do — Wave 2.) |
| Draw requests link to punchlist | NO | Invoice → draw is a Wave 1 link; punchlist link is Wave 2. |
| Invoice review is gold standard UI | **YES — this phase IS the gold standard** | Wave 1.1 IS the polish of the gold-standard review surface. Other surfaces (proposals, COs, draws) are measured against this. |
| Stone blue palette + Calibri + logo top-right | YES — verify on mobile | Mobile responsive may hide logo or shrink it; verify Slate tokens load on mobile. |
| Stored aggregates require rationale comments | N/A | Wave 1.1 doesn't add new caches. |
| Cost-plus open-book (visible to client) | YES — design for client portal precursor | Per dependent-soon #2 + #6. Status_history entries should be tagged `client_visible`. |
| Florida-specific (lien releases, payment-schedule, retainage) | INDIRECTLY | Invoices feed into draws which feed lien-release timing. Wave 1.1 doesn't touch lien-release logic but its data flows there. |
| GC fee semantics | INDIRECTLY | Invoices don't carry GC fee — but invoices that bill against COs participate in GC-fee math at draw time. No direct change in Wave 1.1. |
| Payment schedule (received-by-5th → 15th, etc.) | YES — verify | `invoices.payment_date` is computed from received_date per Ross Built policy (CLAUDE.md). Verify computation handles weekend/holiday rollover. |
| Confidence routing (≥85 / 70-84 / <70) | YES | Polish: verify Yellow/Green/Red routing still works post-F2 transitionEntity refactor. |

---

## 6. Targeted questions for Jake

Each question has a recommended answer with rationale. Strong opinion, weak hold.

1. **Mobile feature parity.** Should mobile invoice review have full-edit-and-override parity with desktop, or be approve/reject-with-light-edit only?
   - **A: Full parity** (full edit, override AI suggestions, attach corrections) — most flexible but harder to keep clean on small screens
   - **B: Approve/reject + minimal edit** (cost code, vendor match) — simplest mobile UX, defers heavy edits to desktop
   - **C: Hybrid** — mobile gets approve/reject + cost-code reassignment + amount edit only; everything else "open in desktop" link
   - **Recommended: C (Hybrid).** Rationale: PMs review on mobile out of office; 80% of approvals need only cost-code or amount tweak. Heavy edits (line-item override, AI metadata correction) are rare enough to push to desktop without friction. Avoids cramming desktop UI into a phone.

2. **Bulk approve.** Include in Wave 1.1 or defer to Wave 1.2?
   - **YES**: PMs can multi-select invoices and bulk-approve. Adds list-view UI complexity.
   - **NO**: One-at-a-time only. Defer multi-select.
   - **Recommended: NO (defer).** Rationale: Wave 1.1 is "polish" not "expand." Bulk approve is a new flow with its own confirmation/preview/bulk-error-handling UX. Better as Wave 1.2 dedicated phase. Today's per-invoice approval is already fast on mobile if the touch targets are right.

3. **Owner notification on PM approve.** Fire immediately, batch to weekly digest, or per-org config?
   - **A: Immediate** to org-wide (current behavior — 13 notifications per invoice)
   - **B: Batch** to weekly digest only (quietest)
   - **C: Per-org config** with per-user preferences UI
   - **Recommended: C (per-org config) with sensible defaults: PMs get per-event, accounting gets per-event, owner_view defaults to weekly digest.** Rationale: Different roles have different attention budgets. Defaulting weekly-digest-for-owner_view immediately reduces the 13-per-invoice noise. Config UI lands in Wave 3 properly; Wave 1.1 ships sensible defaults today.

4. **Real Drummond back-import sequencing.** Does F4's full back-import need to land before Wave 1.1, or can a partial back-import (latest 3 pay apps + 5 vendors) land at Wave 1.1 mini?
   - **A: Wait for full F4 back-import** — Wave 1.1 starts after F4 completes.
   - **B: Partial back-import in Wave 1.1** — back-import latest 3 pay apps as part of Wave 1.1 scope; full back-import (all 5 pay apps + 17 vendors + lien-release set + budget) ships as separate post-Wave-1.1 work.
   - **Recommended: A (wait for full F4).** Rationale: F4 is the dogfood pass for the V.2 portability framework. Partial back-import in Wave 1.1 splits the dogfood across two phases and risks Wave 1.1 inheriting framework bugs that F4 should have caught. F4's named acceptance criterion is "Drummond historical invoices imported from Downloads → Supabase via V.2 framework" — let it ship complete.

5. **Production rollout.** When Wave 1.1 ships, does it go to all Ross Built users immediately, or staged (Jake + Andrew first, then PMs, then accounting)?
   - **A: All-at-once** — flip the switch, everyone's in.
   - **B: Staged 24-hour rollout** — Jake/Andrew (admin) for 24h, PMs for 48h after, accounting last.
   - **C: Staged with feature flag** — gate the new flow behind a feature flag; flip per-user via admin UI.
   - **Recommended: B (staged 24h).** Rationale: Ross Built is small enough (12 users) that full-fleet rollout is recoverable, but Diane (accounting) is the bottleneck and her workflow change should land last when surface is most stable. Feature flag is overkill at 12 users.

---

## 7. Recommended scope expansion

**Stated:** "Polish invoice approval and ship to Ross Built for real Drummond use. Make it bulletproof and mobile-friendly."

**Recommended phase scope:**

1. **Migrate invoice approval flow to F2's `transitionEntity` + `approval_chains` framework.** Verify Ross Built default chain (PM-on-own-jobs → accounting QA → admin override) executes end-to-end on real Drummond invoices imported in F4. Adopt `requireRole` and `withAuditWrap` middleware on every invoice mutation route.

2. **Mobile-first invoice review.** Touch targets ≥44px; file preview responsive with pinch-zoom; approve/kickback/reject as primary mobile CTAs; secondary edits in overflow menu (per Hybrid recommendation in Q1). Verified on iPhone 13+ Safari + Pixel 6+ Chrome via Chrome DevTools MCP. Logo + Slate tokens render correctly across mobile breakpoints.

3. **Bulletproof intake.** Idempotency middleware (F3) wraps invoice POST. Duplicate detection on (vendor, invoice_number, date, amount) blocks-and-notifies. AI parse failures retry via Inngest exponential backoff; PM sees "Parse pending" rather than error. Optimistic-lock 409 handling on all write routes; client reconciles.

4. **Real Drummond data flowing.** Wave 1.1 starts AFTER F4 back-import completes (per Q4 recommendation). Drummond's 5+ historical pay apps + 10+ vendors + lien-release set are the test data. End-to-end test harness validates Wave 1.1 invoice flow against real fixture.

5. **Owner-visible PM approval status.** Status_history entries gain `client_visible` flag; PM-approved invoices are tagged for future client portal exposure. No portal UI in this phase, but data is shaped for it.

6. **Notification fan-out tightening.** Default per-role: PMs immediate, accounting immediate, owner_view weekly digest. Per-org-config UI deferred to Wave 3, but the default is set in Wave 1.1.

7. **HTTP integration tests for top-5 invoice routes.** Upload, parse, approve, kickback, void. Tests run in CI test gate (F3).

8. **Production rollout staged 24h** (per Q5). Day 1: Jake/Andrew. Day 2: PMs. Day 3: Diane.

**Out of scope (deferred):**

- Bulk approve → Wave 1.2 (per Q2)
- Approval delegation UI → Wave 3
- Email-intake invoice ingestion → Wave 3
- Multi-attachment invoice splitting → Wave 1.2
- Mobile-first AI correction loop → Wave 1.2
- Per-org notification preferences UI → Wave 3
- Owner-portal invoice viewer → Wave 3
- Cross-tenant invoice export → Wave 5 / V.2 framework adopters

**Acceptance criteria target (preview — final criteria locked in `/np`):**

- [ ] Invoice approval flow uses `transitionEntity` + `approval_chains` (zero hand-rolled status_history JSONB writes)
- [ ] Ross Built default approval chain executes end-to-end on real Drummond invoice (test against F4 back-imported invoice, e.g. `Drummond - Pay App 5` line items)
- [ ] All invoice mutation routes use `requireRole`, `withAuditWrap`, `updateWithLock` (100% adoption)
- [ ] Idempotency middleware wraps every invoice POST/PATCH route
- [ ] AI parse runs as Inngest function with retry + 30-min stale-process cleanup
- [ ] Touch targets on invoice review ≥44×44px on mobile (audited via Chrome DevTools MCP iPhone 13 emulation)
- [ ] File preview supports pinch-zoom and pan on mobile (verified manually + automated visual regression)
- [ ] Slate tokens (Stone Blue, Dark Slate, Warm Gray) render correctly on iPhone Safari + Pixel Chrome
- [ ] Logo present top-right on mobile (collapses to icon-only at <360px width)
- [ ] HTTP integration tests for upload/parse/approve/kickback/void routes pass in CI
- [ ] End-to-end Drummond test (`/nightwork-end-to-end-test` walks "upload Drummond invoice → AI parse → PM approve on mobile → QA approve → in_draw → paid") returns green on real F4 back-imported data
- [ ] Notification fan-out: PMs immediate, accounting immediate, owner_view weekly-digest by default; ≤4 notifications per invoice approval (down from 13)
- [ ] Status_history entries carry `client_visible` flag (default true for approve/reject; false for internal-only events)
- [ ] Production rollout: Jake/Andrew Day 1; PMs Day 2; Diane Day 3 (per staged-24h)
- [ ] Sentry tags invoice trace spans (request_id, org_id, invoice_id, span Claude API call)
- [ ] Strategic Checkpoint #4 with Jake before final production rollout

---

## 8. Risks and assumptions

| # | Risk | Mitigation |
|---|---|---|
| R1 | F2's invoice-flow `approval_chains` wiring reveals seeded defaults don't match Ross Built's actual workflow (e.g., PM expects to QA their own invoices in some cases) | F2 mid-phase checkpoint with Jake to confirm chain shape; Wave 1.1 inherits the validated chain. |
| R2 | F4 back-import exposes Drummond invoice formats not handled by the AI extractor (e.g., handwritten 1990s invoices in archive) | F4 acceptance criterion includes "schema gaps surfaced and triaged"; Wave 1.1 only commits to flowing the post-F4-validated subset. |
| R3 | Mobile pinch-zoom on PDF.js incompatible with current invoice-files bucket signed-URL flow | Spike (Stage 1.5b prototype) before Wave 1.1 to validate; fallback to image-rasterized preview with native zoom. |
| R4 | Inngest cold-start latency makes "instant approval" PM UX feel sluggish | Use Inngest's "real-time" steps for sub-second user-facing actions; reserve queued work for AI parse + notifications + back-import. |
| R5 | Diane's training time is non-trivial; staged rollout assumes she can absorb on Day 3 | Pre-rollout: 30-min walkthrough with Diane on staging Vercel preview URL. Documentation in `docs/operator-runbook.md`. |
| R6 | Real Drummond data has homeowner/vendor PII that needs scrubbing before any debug screenshots/Sentry events leak | Sentry's `sendDefaultPii: false` already in place (per CURRENT-STATE C.1 #5); add an additional PII-scrub middleware for invoice payloads in audit_log entries. |
| R7 | Cost-plus open-book mandate means everything PM does is potentially client-visible; no "private notes" today | Add `is_internal` flag on status_history entries for accounting-side operational notes that shouldn't surface to client portal. |

**Key assumption:** Foundation F1-F4 ship cleanly and on estimate. If F2 or F3 slip, Wave 1.1 slips. Wave 1.1 mini cannot start before all 4 foundation phases close + CP3 sign-off.

---

## 9. Hand-off

After Jake approves this expansion (or amends it):

1. **`/nightwork-auto-setup wave-1.1-invoice-approval`** — verify F1-F4 prerequisites (will FAIL until foundation completes — that's expected; informational at this stage). Verify env vars (Resend, Sentry, Inngest, Anthropic, Stripe-not-needed). Verify Drummond fixture sufficiency (waiting on F4). Verify mobile testing harness (Chrome DevTools MCP).
2. **Wait for F1–F4 to ship.** Use `/nightwork-init-phase f1-unified-entity-model` to start the foundation chain.
3. **Strategic Checkpoint #3 with Jake** (foundations close).
4. **`/np wave-1.1-invoice-approval`** — chain `/gsd-discuss-phase` (with this EXPANDED-SCOPE as input) → `/gsd-plan-phase` → `/nightwork-plan-review`. Acceptance criteria locked.
5. **`/nx wave-1.1-invoice-approval`** — preflight (10 checks) + execute + QA. Critical findings block ship.
6. **Strategic Checkpoint #4 with Jake** before production rollout.
7. **`/gsd-ship wave-1.1-invoice-approval`** — PR + final review + `/nightwork-end-to-end-test` on real Drummond data.
8. **Staged 24h production rollout** per Q5 recommendation.

---

**Cross-references:**

- VISION.md §2.4 — invoices entity target
- CURRENT-STATE.md §A, §B, §C, §D — diagnostic ground-truth
- TARGET.md §B.1 — `transitionEntity` helper
- TARGET.md §B.2 — approval framework wiring
- GAP.md §B — F1-F4 sequence (F0 absorbed per D-035)
- CP1-RESOLUTIONS.md — A1, A6, A7, NQ1, NQ2 most relevant to Wave 1.1
- MASTER-PLAN.md DECISIONS LOG — D-018 (Stage 1.6), D-024 (invoice as approval guinea pig), D-025 (Drummond F4 back-import), D-032 (address split)
- CLAUDE.md — operational rules, invoice schema, payment-schedule policy
- Canonical §7 — classify-extract-commit pipeline (invoice extractor mature)
