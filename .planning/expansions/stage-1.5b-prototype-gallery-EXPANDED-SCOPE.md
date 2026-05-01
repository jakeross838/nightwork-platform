# Expanded scope — stage-1.5b-prototype-gallery

**Status:** APPROVED 2026-05-01 (with overrides — see "Approved overrides" section below)
**Generated:** 2026-05-01
**Stated scope (Jake's words, verbatim):**

> Build the prototype gallery using real anonymized Drummond data rendered in the locked Site Office direction with Set B palette. This is the validation surface — does the design system actually work for real construction workflows or is it pretty but impractical?
>
> Render every Wave 1 surface end-to-end:
> - Invoice approval flow (PM upload → AI parse → review → kickback or approve → QA → in-draw → paid)
> - Draw approval flow with real G702/G703 generation from Drummond pay app data
> - Budget view with real line items, COs, vendor tracking
> - Document review for plans (anonymized), contracts, invoices, lien releases
> - Vendor management with real Drummond vendor records (anonymized via substitution map)
> - Mobile approval flow on phone — PM in field with gloves on
> - Owner portal homeowner-facing view
> - Reconciliation surface strawman per NQ5/D-028 with the 4 candidate models from PATTERNS.md
> - Schedule/Gantt view (basic, Wave 2 preview)
> - Daily log view (basic, Wave 2 preview)
>
> Use Drummond fixtures from .planning/fixtures/drummond/ — 5 historical pay apps, 17+ vendors, lien releases, budget XLSX. Substitution-map approach per D-029. Real customer data NEVER committed.
>
> Test the design system with real complexity:
> - Long vendor names that might break layouts
> - Multi-line invoice notes (textarea auto-grow already fixed)
> - Pay apps with 30+ line items (DataGrid stress test)
> - Complex CO chains affecting multiple budget lines
> - Long cost code descriptions
> - Mobile with one hand while holding phone in truck
>
> If anything breaks visually or feels wrong rendered with REAL data (vs the placeholder data in 1.5a), surface it as a polish requirement. We need to validate the design system works before F1-F4 foundations begin.
>
> Don't redesign anything in 1.5b — that's polish phase work. 1.5b just renders prototypes and documents what works/breaks. If something CRITICAL surfaces (the design system fundamentally fails at a real workflow), halt and tell me.
>
> Use Drummond fixtures, render in Site Office, test on phone and laptop. Validate the foundation.

---

## 0. Approved overrides (2026-05-01)

Jake approved this expansion with the following overrides on the §6 recommendations:

- **Q2 = C, NOT B.** Include schedule (Gantt grid) prototype as Wave 2 preview surface. Defer daily log only. Reasoning: schedule uses DataGrid pattern we already have, but Gantt-specific density/timeline rendering is the highest-risk Wave 2 surface to discover doesn't fit Site Office. Daily log is lower risk (document review + list patterns we already validated). One Gantt prototype, basic but real, using Drummond pay app dates + lien release dates to reconstruct rough schedule.
- **Q7 = tiered fidelity, NOT pure B.** G702 cover sheet attempts pixel-perfect (single page, strict layout, manageable scope). G703 detail page accepts 80% (complex repeating line items). Escape clause: if pixel-perfect G702 turns out to be weeks of work after first attempt, drop to 80% on both and log proper AIA fidelity as a separate phase.

All other recommendations approved as written: **Q1=A, Q3=C, Q4=A, Q5=B, Q6=A+B, Q8=B, Q9=B, Q10=C**.

**Two PLAN.md acceptance notes per Jake:**

1. **Schedule prototype acceptance:** Site Office direction renders Gantt with timeline density that doesn't break readability. Specifically test — 6+ month timeline, 20+ tasks, dependencies visible, today-marker clear. If readability fails, log as design-system polish requirement (does not halt phase).
2. **Real-phone testing acceptance (Q5=B):** Jake walks every prototype on his actual phone before ship verdict. PM-in-field flow specifically tested with one-hand operation, gloves-on simulation, outdoor lighting. If any flow fails real-phone test, halt before ship.
   - **Test device:** PENDING — directive nwrp27 left literal `[PHONE]` placeholder unsubstituted. Jake to specify make/model + browser (e.g., "iPhone 15 Pro, Safari 17" or "Pixel 8, Chrome 121") before ship-time gate. Update this line and `MANUAL-CHECKLIST.md` M3 once provided.

**Operational follow-ups:**

- **CLAUDE.md correction:** fix "Drummond Pay App 8" → "Drummond Pay App 5" with footnote documenting why (Source 3 inventory has 5 historical pay apps, not 8). Surface in 1.5b polish backlog or fix in flight.
- **R1 escalation rule:** Drummond fixture extraction (R1) is time-boxed at 2 days. If it passes 4 days (2x overrun), halt and tell Jake — fallback options are Q4=B compressed fixture OR scope-cut another deliverable.

---

## 1. Mapped entities, workflows, and surfaces

### 1.1 Wave 1 entities touched

| Entity | VISION wave | Current state | Drummond fixture status | Notes for 1.5b prototype |
|---|---|---|---|---|
| `jobs` | Wave 1 | COMPLETE | Source 2: 1 synthetic stub. Source 1: 408 P-drive files. Source 3: site address `501 74th, Holmes Beach FL` consistent. | Substitute homeowner name + address per D-029. Construction address vs billing address (per D-032) is a F1 schema change — for 1.5b, render `address` as construction site only. |
| `vendors` | Wave 1 | COMPLETE | Source 2: 1 (SmartShield). Source 3 filenames: 17+ vendors observed (Florida Sunshine Carpentry, Doug Naeher Drywall, Paradise Foam, Banko, WG Drywall, Loftin Plumbing, Island Lumber, Ferguson, CoatRite, Ecosouth, MJ Florida, Rangel Tile, TNT Painting, FPL, Home Depot, Avery Roofing, ML Concrete LLC). | This is the **real test** — the existing playground fixture has 5 vendors; Drummond has ~17. Long names, mixed business-entity types, multiple cost-code defaults. |
| `cost_codes` / `org_cost_codes` | Wave 1 | **COEXISTING** (drift risk per A.3.1) | Source 1: `Drummond - Line Items Cost Coded.pdf`. Source 2: `org_cost_codes` is 12 rows of synthetic test data; real Ross Built codes only in legacy `cost_codes`. | Prototype uses sanitized cost-code list derived from `BUDGET_TEMPLATE.md`. Tests "long cost code descriptions" stress case. |
| `budget_lines` | Wave 1 | COMPLETE | Source 2: 0 rows for Drummond. Source 3: `Drummond_Budget_2026-04-15.xlsx` + 25 PDF/XLS budget files. | Real Drummond budget has ~25-50 line items. Tests "DataGrid stress test." |
| `purchase_orders` | Wave 1 | COMPLETE | Source 2: 0 rows. Source 3: 2 PO files in P-drive `Purchase Orders/`. | Sparse — Ross Built workflow is invoice-driven, not PO-issuance-heavy. Prototype renders 2-3 POs against high-volume invoices for the **invoice ↔ PO drift** reconciliation example. |
| `change_orders` | Wave 1 | COMPLETE | Source 2: 0 rows. Source 3: PCCO logs implicit in Pay App PDFs (G702 cover sheets reference change orders). | Drummond has approved COs reflected in current_contract_amount. Prototype derives a 4-6 CO chain. Tests "complex CO chains affecting multiple budget lines." |
| `invoices` | Wave 1 | COMPLETE (PARTIAL — see CURRENT-STATE A.2) | Source 2: 1 invoice (SmartShield $22,620.90). Source 3: ~94 Tier-1 invoice files including `Drummond November 2025 Corresponding Invoices.pdf` (2.2 MB combined batch). | The richest fixture surface. Prototype includes ≥4 invoices spanning the workflow (ai_processed yellow, pm_review yellow, qa_review green, paid). Three format types per CLAUDE.md (clean PDF, T&M, lump-sum). |
| `invoice_line_items` | Wave 1 | COMPLETE | Source 2: 6 rows for Drummond's 1 invoice. | Stress test: "30+ line items" per pay app. Source 3 pay apps have ~20-50 G703 line items. |
| `invoice_allocations` | Wave 1 | COMPLETE (4-table line shape per A.3.3) | Source 2: 3 rows (2 active + 1 soft-deleted). | Drummond fixture must include base-vs-CO split allocations for stress test. |
| `draws` | Wave 1 | COMPLETE | Source 2: 0 rows. Source 3: **5 historical pay apps** (Drs 1-5) in PDF G702/G703 + XLSX. | The gold-mine fixture. Pay App 5 is the canonical (latest); Drummond Pay App 8 reference per CLAUDE.md does not match Source 3 inventory (5 pay apps, not 8). Render Pay App 5 as the primary draw approval prototype. |
| `draw_line_items` | Wave 1 | COMPLETE | Source 2: 0 rows. Source 3: derived from G703 PDFs. | One per cost code per draw — 20-50 rows per pay app. |
| `draw_adjustments` | Wave 1 | COMPLETE (00069) | Source 2: 0 rows. | Per CLAUDE.md: corrections, credits, withholds, customer direct-pays, conditional holds. Optional in 1.5b prototype unless Drummond Pay App 5 has them. |
| `lien_releases` | Wave 1 | **PARTIAL — R.7 violation, no `status_history`** | Source 2: 0 rows. Source 3: `Drummond-Nov 2025 Lien Releases.pdf` (companion to combined invoice batch). | Florida 4-statute types. Real lien release fixture available. Status history workaround in prototype: render the 4-status enum without JSONB drilldown (since column is missing — F1 fixes). |
| `payments` | Wave 1 | **PARTIAL — projected from invoices columns** | Source 2: 0 rows. Inferred from `invoices.payment_date` / `check_number`. | F1 promotes to first-class. For 1.5b prototype, show inferred payment record from invoice fields. |
| `document_extractions` | Wave 1 | PARTIAL (only invoices + proposals extractor live) | Source 2: 1 row for Drummond (classification_confidence=0 anomaly). | Renders the AI confidence panel; per-field confidence per CLAUDE.md routing thresholds (≥85% green, 70-84% yellow, <70% red). |
| `activity_log` | Audit | COMPLETE | Source 2: 6 rows for Drummond. | Audit timeline below every Document Review surface (per PATTERNS.md §2). |
| `approval_chains` | Wave 1 (config) | **DEAD config** (00070, zero src consumers) | Source 2: 6 rows seeded with default chains. | Prototype shows `approval_chains` UI as if wired (F2 wires it). Surface "this is what approve flow will look like once F2 ships." |

### 1.2 Wave 2 entities touched (Jake's stated "preview" surfaces)

| Entity | VISION wave | Current state | Notes |
|---|---|---|---|
| `schedule_items` | Wave 2 | **MISSING** | Not in 1.5a PATTERNS.md catalogue; Wave 2 schedules phase owns. |
| `daily_logs` | Wave 2 | **MISSING** | Not in 1.5a PATTERNS.md catalogue; Wave 2 daily logs phase owns. |
| `documents` (general docs) | Wave 2 | **MISSING / AMBIGUOUS** | VISION proposes first-class table; today docs live ad-hoc per entity. Plans + contracts in P-drive, not in Supabase. |

### 1.3 Wave 3 entities touched (owner portal)

| Entity | VISION wave | Current state | Notes |
|---|---|---|---|
| `client_portal_access` | Wave 3 | COMPLETE (existing) | Token-based invite. |
| `client_portal_messages` | Wave 3 | COMPLETE (existing) | Builder ↔ client messaging. |
| `weekly_updates` | Wave 3 | **MISSING** | Auto-generated from daily logs + PM polish. |
| `photos` | Wave 2 | **MISSING** | Site progress photography w/ EXIF. Drummond Source 1 has 3 photo files (1.8 MB). |

### 1.4 PATTERNS.md surfaces touched

| Pattern (PATTERNS.md §) | Used in 1.5b prototype | Render fidelity |
|---|---|---|
| §2 Document Review (gold standard) | Invoice review, draw approval, lien release review, document review for plans/contracts | Site Office variant per D-037 |
| §3 Multi-step Approval | Invoice flow PM → QA, draw flow PM → owner | Standard layout, role variations |
| §4 Data-dense Overview | Job dashboard, budget view, vendor list | Compact density per Site Office |
| §5 Mobile Touch Approval | Mobile invoice review (real iPhone viewport) | 56px high-stakes targets, pinch zoom |
| §6 Config Form | DEFER (settings already in 1.5a playground) | N/A |
| §7 List + Detail | Invoice queue, vendor list | Site Office UPPERCASE column headers |
| §8 Wizard | DEFER (no real-data wizard surface in scope) | N/A |
| §9 Empty Workspace | DEFER (1.5b is not zero-state validation) | N/A |
| §10 Print View (AIA fidelity) | Draw G702/G703 print preview | 80% fidelity per Q7 recommendation |
| §11 Reconciliation (STRAWMAN) | All 4 candidates × Drummond invoice ↔ PO drift (per D-036) | Static side-by-side render |
| §12 Confirm/Destructive Action | Embedded inline (not standalone) | Standard |
| §12.5 Loading/Error/Skeleton | Each prototype shows one in-flight state | Layer |

---

## 2. Prerequisite gaps

What MUST exist before this phase can ship.

| # | Gap | Source | Blocking? | Resolution path |
|---|---|---|---|---|
| 1 | **Drummond substitution map** does not exist yet | D-029 | **HARD BLOCKING** | Create `.planning/fixtures/drummond/SUBSTITUTION-MAP.md` (gitignored). Map real → fictional-but-plausible: homeowner names (e.g., "Drummond" → "Halcyon"), site address (`501 74th, Holmes Beach FL` → `501 Pelican Bay Way, Anna Maria FL`), vendor business names (17 entries), invoice numbers (preserve format pattern, not values). Per D-029 workflow, the map is on-demand on first cross-org share — 1.5b's commit-to-git is that share. |
| 2 | **Sanitized fixture extraction pipeline** not yet built | D-029 + this expansion | **HARD BLOCKING** | One-shot script extracts structured data from raw Source 3 files (5 pay apps XLSX + lien release PDF + budget XLSX + invoice PDFs). Applies SUBSTITUTION-MAP.md. Outputs to either (a) gitignored sanitized fixtures + a runtime loader, or (b) committed sanitized JSON in `src/app/design-system/_fixtures/drummond/` (depends on Q1). |
| 3 | **`/design-system/prototypes/*` route scaffold** does not exist | This phase | BLOCKING | Add Next.js routes under `src/app/design-system/prototypes/` mirroring Wave 1 surface URLs (e.g., `/design-system/prototypes/invoices/[id]`, `/design-system/prototypes/draws/[id]`, `/design-system/prototypes/draws/[id]/print`, `/design-system/prototypes/owner-portal/draws/[id]`). Inherit existing middleware gating to platform_admin. |
| 4 | **Hook `T10c` sample-data isolation** rejects imports from `@/lib/supabase|org|auth` in `/design-system/*` | 1.5a SPEC C6 / D9; nightwork-post-edit.sh:202-230 | NOT BLOCKING (hook is correct posture) | Prototypes import from sanitized fixtures only. No live tenant data ever reaches `/design-system/*`. Hook continues to enforce. |
| 5 | **CHOSEN-DIRECTION marker** exists | D-037 + `.planning/design/CHOSEN-DIRECTION.md` | **MET** | Marker file exists. Site Office + Set B locked 2026-05-01. Prototypes inherit Site Office variant defaults (UPPERCASE eyebrows + 0.18em tracking + JetBrains Mono dominance + compact density + 1px slate-tile left-stamp + 150ms ease-out). |
| 6 | **PATTERNS.md §11 reconciliation strawman** complete with 4 candidates | 1.5a A16, A16.1, D-036 | **MET** | PATTERNS.md §11 has Candidates A/B/C/D documented with tradeoffs. 1.5b renders all 4 against Drummond drift. |
| 7 | **`lien_releases.status_history` JSONB column** missing | CURRENT-STATE A.2 + GAP.md F1 day-1 task | NOT BLOCKING (1.5b is throwaway HTML) | Prototype renders 4-status enum without history drilldown (or fakes a history JSONB locally). F1 fixes the column. |
| 8 | **PM-on-own-jobs read narrowing** for budget/draw tables | TARGET / draws/00069 precedent | NOT BLOCKING (prototype runs in platform_admin) | Prototype acknowledges the role gating in copy ("PM Bob Mozine sees only Drummond"); does not implement live row narrowing. |
| 9 | **Mobile-device test access** (Jake's actual phone on Vercel preview) | This phase | BLOCKING for ship gate | Vercel preview URL on Jake's phone w/ optional gloves test. Per Q5 recommendation. |
| 10 | **AIA G702/G703 print stylesheet** not yet built | PATTERNS.md §10 | NOT BLOCKING (Q7 recommends 80% fidelity) | Prototype's print route uses `@media print` rules + the existing `print:` Tailwind utilities. Pixel-perfect lands when AIA generation ships (Wave 3+). |

---

## 3. Dependent-soon gaps

What's likely needed shortly after this phase — design for it now.

| # | Gap | Likely next phase | Design implication for 1.5b |
|---|---|---|---|
| 1 | Stage 1.5c real-data + test infrastructure | Stage 1.5c | The sanitized Drummond fixtures from 1.5b should be **reusable** by 1.5c's Playwright harness. Build the fixture loader so it's importable from both `/design-system/prototypes/*` and `__tests__/e2e/*`. |
| 2 | F1 entity model migrations (D-019 through D-035) | F1 (post-CP3) | Prototypes preview the post-F1 schema where possible: split `address` field rendering, `payments` first-class entity, `gl_codes`, etc. Where the prototype renders against the eventual F1 shape, label clearly. |
| 3 | Reconciliation phase post-Phase-3.9 | Post-foundation | The candidate selected at 1.5b review (or "leading candidate" per Q3 recommendation) becomes the reconciliation phase's locked starting point. PATTERNS.md §11 rewrites then. |
| 4 | Wave 1.1 polish phase (CP4) | Post-foundation | Polish requirements surfaced in 1.5b feed directly into Wave 1.1 plan. The 1.5b finding format should be machine-readable for the Wave 1.1 expansion to import. |
| 5 | Owner portal as Wave 3 phase | Wave 3 | Owner portal stub in 1.5b establishes Site Office trust posture for non-builder audience. If 1.5b reveals Site Office feels too archival/utility for homeowners, surface as a "lighter variant" finding. |
| 6 | F4 Drummond historical back-import via V.2 framework (D-025) | F4 (post-CP3) | The sanitized fixtures from 1.5b are NOT the production data; F4 imports the real raw Source 3 files via V.2 framework. 1.5b sanitized fixtures inform the V.2 schema by exercising the shape. |
| 7 | 1.5a-followup-1 rgba opacity drift fix (D-038) | Polish phase | 1.5b is NOT the polish phase. But: if 1.5b renders the prototypes and notes additional rgba sites alongside the existing 30 (per `.planning/MASTER-PLAN.md` §11), the polish phase scope grows. Surface as part of the polish backlog. |

---

## 4. Cross-cutting checklist

| Concern | Status | Rationale |
|---|---|---|
| **Audit logging** | N/A — prototype renders mock activity_log entries from sanitized fixtures; no live mutations in `/design-system/prototypes/*` | Hook T10c forbids live data imports; prototypes are read-only HTML rendering. |
| **Permissions** | APPLIES (read-only) | Middleware gates `/design-system/*` (incl. `prototypes/*`) to platform_admin in production. Prototype copy mentions PM-on-own-jobs read narrowing where relevant (e.g., "PM Bob Mozine sees only Drummond") but does not implement. |
| **Optimistic locking** | N/A — no writes | Prototype mutations go nowhere. |
| **Soft-delete + status_history** | APPLIES (display only) | Prototype renders status_history JSONB as the audit timeline (PATTERNS.md §2). Where the schema lacks the column (`lien_releases.status_history`), prototype fakes the history client-side and labels it explicitly. |
| **Recalculate, don't increment** | APPLIES (display only) | Budget view recalculates `previous_applications`, `total_to_date`, etc. from sanitized invoice fixture rows. The prototype follows R.2 in spirit even though no DB exists. |
| **Multi-tenant RLS** | APPLIES — by construction | Prototypes never query tenant tables. Hook T10c rejects imports from `@/lib/supabase|org|auth`. RLS is irrelevant to read-only HTML. |
| **Idempotency** | N/A | No write endpoints. |
| **Background jobs** | N/A | No async work. |
| **Rate limiting** | N/A | No token-consuming endpoints. |
| **Observability** | DEFER — Sentry already tags `/design-system/*` per existing middleware | No new observability work. |
| **Data import/export V.2** | N/A — but V.2 schema exercise: this phase EXERCISES the eventual export/import contract by extracting structured Drummond data from raw files. The shapes that the loader produces inform F1's V.2 Zod schemas. | Document the loader's output shape; F3 picks it up. |
| **Document provenance V.3** | APPLIES (display only) | Prototype shows `document_extraction_id` on invoice and lien-release renderings — V.3 is universal per VISION. |
| **Mobile-friendly** | APPLIES — primary scope item | 56px touch targets per Q10=A in 1.5a SYSTEM.md §11; pinch zoom on file preview; Site Office compact density on mobile. **Real-device test on Jake's phone is a ship gate** (per Q5 recommendation below). |
| **Drummond fixtures sufficient** | APPLIES — primary scope item | Source 3 has the real data (5 pay apps, 17 vendors, lien-release set, budget). Source 1 has plans/contracts/photos. Source 2 is the synthetic stub. Q1 below resolves the sanitized fixture commit pattern. |
| **CI test gate** | N/A — Stage 1.5c builds it | 1.5b ships before 1.5c CI. |
| **Error handling for partial failures** | N/A | Read-only HTML. |
| **Graceful degradation** | DEFER | No external services hit. |
| **Substitution-map automation per D-029** | APPLIES — primary scope item | SUBSTITUTION-MAP.md (gitignored) + extraction script. Build-time grep check rejects real Drummond names from sanitized output. |
| **Design-system token discipline** | APPLIES | Post-edit hook continues to enforce. Site Office variant prefs applied per CHOSEN-DIRECTION.md. |
| **1.5a-followup-1 rgba drift** | DEFER per D-038 | Polish phase work; not in 1.5b. |
| **CP marker file persistence (D-039)** | DEFER per Q10 below | 1.5b is validation, not picking surface. |

---

## 5. Construction-domain checklist

| Domain consideration | Applies? | Rationale |
|---|---|---|
| Drummond as reference job | **YES — primary** | The whole point. Per CLAUDE.md "Drummond is the reference job." 1.5b validates this for the design system. |
| Field mistakes become permanent QC entries | NO | QC entries are punchlist (Wave 2 / MISSING). Out of scope per Q2 recommendation. |
| Draw requests link to punchlist | NO | Wave 2 entity. Out of scope. |
| Invoice review is the gold standard UI | **YES — primary** | Every Document Review surface in 1.5b (invoice, draw, lien release, plans, contracts) extends PATTERNS.md §2. Validates the gold-standard claim under real-data stress. |
| Stone Blue palette + Slate type system + logo top-right | **YES — locked per D-037** | Site Office direction + Set B palette. Logo collapses to icon at <360px (per Q13 from 1.5a). |
| Stored aggregates require rationale comments | N/A | No DB writes. |
| Cost-plus open-book transparency | **YES** | Owner portal prototype renders draw approval as a homeowner — no jargon, larger type, total transparency on every line item. Tests Site Office trust posture. |
| Florida-specific (lien releases, retainage) | **YES** | 4 lien-release statute types (conditional / unconditional / conditional progress / unconditional progress) — Drummond Nov 2025 lien-release set is the fixture. Retainage = 0% for Ross Built (org-configurable per R.3). |
| GC fee semantics (compounding on COs) | **YES** | Drummond cost-plus contract with default 20% GC fee. CO chain prototype shows fee compounding. |
| Payment schedule math (Ross Built rule) | **YES** | Invoice received by 5th → pay 15th, by 20th → pay 30th. Computed in prototype from sanitized `received_date`. |
| AIA G702/G703 print fidelity | **YES** | 80% fidelity per Q7 recommendation. Pay App 5 PDF reference. Page breaks may differ. |
| Drummond Pay App 8 reference per CLAUDE.md | **PARTIAL DIVERGENCE** | CLAUDE.md says "Drummond Pay App 8" but Source 3 inventory has 5 pay apps (Drs 1-5). 1.5b uses Pay App 5 as the latest reference; flag the CLAUDE.md note for correction (it likely refers to a future state or paraphrased older session). |
| 30+ line items per pay app | **YES — stress test** | Drummond pay apps have ~20-50 G703 line items. Tests DataGrid + Site Office compact density at scale. |
| Long vendor names | **YES — stress test** | 17 Drummond vendors include long names (e.g., "ML Concrete LLC", "Florida Sunshine Carpentry"). Tests List+Detail layout, Card padding, mobile ellipsis. |
| Multi-line invoice notes | **YES — stress test** | Real invoices have free-form scope descriptions. Tests textarea auto-grow (already fixed per Jake's stated scope). |
| Complex CO chains affecting multiple budget lines | **YES — stress test** | Drummond has 4-6 COs in real history; some affect 2-3 budget lines each. Tests CO log render + budget impact display. |
| Long cost code descriptions | **YES — stress test** | Real cost codes (e.g., "01101 Architectural Services", "13101 Electrical Labor & Materials") fit; AIA G703 column constraints tested. |
| Mobile with one hand while holding phone in truck | **YES — Q5 recommendation gates ship** | Jake actual-phone test, gloves optional. Tests 56px high-stakes targets, pinch zoom, site-office compact density at 360px. |
| Internal labor and equipment billing | NO | Wave 1 entity but out of scope for Drummond fixture. |
| Owner notification cadence (weekly vs per-event) | DEFER | Wave 3 surface; out of scope for 1.5b owner portal stub. |
| Approval delegation (PTO routing) | DEFER | F2 wires `approval_chains`; 1.5b shows static role assignments. |
| Sub-tier suppliers | NO | Not modeled today; not in scope. |
| Tax handling | NO | Not modeled today; not in scope. |

---

## 6. Targeted questions for Jake

Each question has a recommended answer with rationale. Strong opinion, weak hold.

### Q1. Drummond fixture commit posture (per D-029)

- **A:** Commit sanitized Drummond fixtures to `src/app/design-system/_fixtures/drummond/` with substitution map applied (real names → fictional but plausible). Sanitized JSON is committed; raw fixtures + SUBSTITUTION-MAP.md gitignored.
- **B:** Keep raw Drummond fixtures gitignored AND keep the sanitized output gitignored; build-time loader applies SUBSTITUTION-MAP.md at deploy time. Only the loader code commits.
- **C:** Use existing `/design-system/_fixtures/` (Pelican Bay, Mangrove Cove, etc.) but extend with 25-30 more line items to mirror Drummond shape — no new Drummond data introduced.

**Recommended: A.** Preserves D-029 substitution-map approach AND gives 1.5b real Drummond shape to stress-test (long vendor names, 30+ pay-app line items, complex CO chains). Sanitized output is committed under `src/app/design-system/_fixtures/drummond/` so prototypes are reproducible without runtime fixture loading. Hook T10c continues to permit `_fixtures/` imports. SUBSTITUTION-MAP.md (gitignored) is the audit trail mapping fictional names back to real ones for future re-sanitization. C undermines the validation goal ("does the design system actually work for real construction workflows"). B adds runtime complexity for no benefit.

**Rationale:** Jake's stated scope explicitly says "Real customer data NEVER committed." Option A satisfies this — committed data is sanitized, not real. The map (committed nowhere) preserves traceability.

### Q2. Schedule + Daily log preview scope (Wave 2 surfaces)

- **A:** Include both — render crude static mockups labeled "Wave 2 preview" alongside Wave 1 prototypes.
- **B:** Exclude both — defer to Wave 2 phase. 1.5b stays Wave 1-only.
- **C:** Include schedule (Gantt) only — defer daily log.

**Recommended: B.** These surfaces are NOT in 1.5a PATTERNS.md catalogue, are MISSING entities per CURRENT-STATE A.4, and would force inventing patterns mid-1.5b. The "design system validation" goal of 1.5b is best served by stress-testing existing patterns, not inventing new ones. Per `.planning/MASTER-PLAN.md` §11 tech debt, "Side-by-Side Compare pattern + Timeline/Gantt pattern (Wave 2 schedules) — NOT in Stage 1.5a PATTERNS.md (LOW; scoped elsewhere)" — that explicit deferral means 1.5b shouldn't invent them. If Jake wants schedule/daily-log validation early, it should be its own mini-phase post-foundation.

**Rationale:** Jake's stated scope frames them as "(basic, Wave 2 preview)" — that's an opt-in. The recommendation respects 1.5a's architectural choice and avoids forcing PATTERNS.md rewrite in a validation phase.

**Jake's override (2026-05-01): C, NOT B.** Include schedule (Gantt grid) prototype as Wave 2 preview surface. Defer daily log to Wave 2 proper. Schedule is the highest-risk Wave 2 surface to discover doesn't fit Site Office (Gantt-specific density + timeline rendering vs. patterns we already validated). One Gantt prototype, basic but real, using Drummond pay app dates + lien release dates to reconstruct a ~6-month rough schedule. Daily log uses document review + list patterns already validated, so deferral risk is acceptable. NEW pattern emerges — if 1.5b proves Gantt fit, PATTERNS.md gains a Timeline/Gantt entry as 1.5a-followup.

### Q3. Reconciliation candidate winner selection at end of 1.5b

- **A:** Pick winner at end of 1.5b review (same session); locks PATTERNS.md §11.
- **B:** Don't pick at 1.5b — render all 4 for visual feedback; defer pick to first reconciliation phase post-Phase-3.9 (per D-028 stricter reading).
- **C:** Pick a "leading candidate" with rationale at end of 1.5b; final lock at first reconciliation phase.

**Recommended: C.** Gives concrete direction without locking until extractors land. Per D-036 the 1.5b prototype is for "design vocabulary, not commitment" — picking a leading candidate is vocabulary-development without commitment. PATTERNS.md §11 strawman acceptance posture (A16.1) explicitly says "1.5b picking model 2/3/4 forces non-trivial PATTERNS.md rewrite" — committing to a non-A model now would force a rewrite mid-foundation. Strong opinion: rendering all 4 against real Drummond drift will make Jake's preference visually obvious; document the leaning candidate and revisit at the reconciliation phase.

**Rationale:** Half-locks (C) maximize information without forcing rewrite cost. PATTERNS.md §11n anti-patterns even include "Reconciliation that auto-resolves" — a half-lock is the human equivalent of considered acceptance.

### Q4. Drummond fixture realism vs raw historical data

- **A:** Use exact Drummond shapes (5 pay apps, 17 vendors, real cost codes, anonymized dollar amounts) anonymized via sub map.
- **B:** Use Drummond shapes but compress (1-2 pay apps, 8-10 vendors) for prototype tractability.
- **C:** Use Drummond shapes for invoice/draw/lien/CO; use existing fictional fixtures (Pelican Bay etc.) for vendor management + budget.

**Recommended: A.** The whole point of 1.5b is "does the design system actually work for real construction workflows or is it pretty but impractical?" Compressing the data invalidates the test. The cost of A is the fixture extraction work — time-boxed at 2 days. If extraction takes >2 days, fall back to B (this is the Risk 1 mitigation).

**Rationale:** Jake's stated scope explicitly lists the stress-test cases ("Pay apps with 30+ line items," "Complex CO chains affecting multiple budget lines"). B compresses out the stress; C creates inconsistency between surfaces.

### Q5. Mobile viewport testing

- **A:** Test on Chrome DevTools emulation only (Pixel + iPhone modes via Chrome DevTools MCP).
- **B:** Test on Jake's actual phone (Vercel preview URL) AND Chrome DevTools.
- **C:** DevTools only for 1.5b; defer real-device to 1.5c.

**Recommended: B.** Jake's actual phone catches things DevTools misses (real touch latency, glove-on test, screen reflectivity in sun, iOS Safari quirks vs Chrome desktop emulation). Per CLAUDE.md "Testing Rule (MANDATORY)" — Chrome DevTools is the existing automated check; Jake-on-phone is the human-in-the-loop validation specifically required by Jake's stated scope ("Mobile with one hand while holding phone in truck"). 1.5b ship gates on Jake-on-phone test. C defers the actual validation; the whole point of 1.5b is to validate.

**Rationale:** Jake's stated scope pushes hard on this ("PM in field with gloves on"). Defer to 1.5c is too late.

### Q6. Reconciliation drift example data

- **A:** Invoice ↔ PO drift (canonical example per D-028; Drummond Source 3 has 2 PO files vs many invoices — invoice-PO drift is built-in to fixture).
- **B:** Draw ↔ Budget drift (Drummond has 5 pay apps + budget XLSX — bigger fixture surface).
- **C:** All 3 (invoice ↔ PO, CO ↔ Contract, draw ↔ Budget) — render 4 candidates × 3 drift types = 12 prototypes.

**Recommended: A primary + B secondary** (4 candidates × 2 drift types = 8 prototypes). Invoice ↔ PO is the canonical reconciliation example (per canonical §2 + D-028). Draw ↔ Budget is the most concrete drift visible in the Drummond historical fixture (real pay apps vs real budget). CO ↔ Contract is more abstract and less Source 3 fixture support — defer to actual reconciliation phase. 12 prototypes (option C) balloons scope and tests the same patterns redundantly.

**Rationale:** Two drift types give Jake enough comparative perspective without diluting attention across redundant variations.

### Q7. AIA G702/G703 print view fidelity

- **A:** Pixel-perfect match to Drummond Pay App 5 PDF (signature blocks, bank-acceptable formatting, page breaks identical).
- **B:** AIA-shape correct but 80% fidelity (page breaks may differ; signature block stub; bank-acceptable layout but margins not pixel-matched).
- **C:** Skip print view in 1.5b; PATTERNS.md §10 Print View pattern documented but not rendered against Drummond.

**Recommended: B.** 100% fidelity is months of CSS print work and bank-format certification (AIA G702/G703 has formal AIA Document Service formatting expectations). 80% validates the pattern — the bank-acceptable rendering lands when real AIA generation ships (Wave 3+). C defers a Wave 1 surface entirely; that conflicts with 1.5b's validation posture.

**Rationale:** 80% says "the pattern is correct, the polish is later." 100% says "we built draw generation in 1.5b" — out of scope.

**Jake's override (2026-05-01): tiered fidelity.** G702 cover sheet attempts pixel-perfect (single page, strict layout, manageable scope). G703 detail page accepts 80% fidelity (complex repeating line items, page breaks may differ). **Escape clause:** if pixel-perfect G702 turns out to be weeks of work after first attempt, halt and tell Jake — drop to 80% on both and log proper AIA fidelity as a separate phase. First-attempt judgment call by Claude during execute.

### Q8. Owner portal scope

- **A:** Full prototype: dashboard, draw approval, photos viewer, lien-release viewer, message thread.
- **B:** Dashboard + draw approval only (Wave 3 features defer to Wave 3 phase).
- **C:** Stub only — single landing page that shows "Owner Portal" with a few fake summary numbers.

**Recommended: B.** Owner-facing draw approval is a real test of Site Office direction's "trust posture for non-builders." Photos / messages / lien viewer are Wave 3 entities (MISSING per CURRENT-STATE A.4 — `weekly_updates`, `photos`, `client_portal_messages` in production state). Out of scope to render them in 1.5b. C is too thin to validate trust posture; A pulls Wave 3 work forward.

**Rationale:** Validate the trust posture test (homeowner reading a draw) without inventing Wave 3 surfaces.

### Q9. Halt criteria — what triggers stop-and-tell-Jake?

- **A:** Any visual breakage on real data → halt.
- **B:** Critical workflow breakage (PM literally can't approve on phone, draw can't render G702/G703 readably, owner can't read draw without zoom) → halt. Visual breakage logged as polish requirement, not halt.
- **C:** Both A and B (any visual issue OR workflow issue → halt).

**Recommended: B.** Matches Jake's stated scope language exactly: "If something CRITICAL surfaces (the design system fundamentally fails at a real workflow), halt and tell me." Visual breakage at the polish level (text overflow, slight misalignment, unintended hover state) is a polish requirement, not a halt. Critical workflow breakage means the design system itself fails, which is what Jake explicitly named.

**Rationale:** Halt criteria matches Jake's exact words. A is too eager to halt (1.5b would never finish); C is the same problem.

### Q10. CP marker file persistence (per D-039 / 1.5a-followup-2)

- **A:** Defer for 1.5b; manual transcription if pick happens at /design-system/prototypes.
- **B:** Address it in 1.5b — implement GitHub-API-from-server-action commit pattern.
- **C:** Skip — 1.5b doesn't need a "pick this prototype" affordance (review is conversational, not affordance-based).

**Recommended: C.** 1.5b is throwaway HTML for validation, not a CP picking surface. Reconciliation candidate pick (Q3) happens via review conversation, not button. Re-architecting the marker-file persistence (per D-039 — "GitHub API commit OR Supabase org_settings row OR commit-from-PR-comment") is its own task and pre-CP3 work. 1.5b doesn't need to solve it.

**Rationale:** Scope discipline — D-039 is a CP3+ infra problem. 1.5b stays focused on validation.

---

## 7. Recommended scope expansion

**Stated:** "Build the prototype gallery using real anonymized Drummond data rendered in the locked Site Office direction with Set B palette. ... Render every Wave 1 surface end-to-end ... Validate the foundation."

**Recommended phase scope (10 deliverables):**

1. **Drummond fixture sanitization** — SUBSTITUTION-MAP.md (gitignored) + extraction script + sanitized output committed at `src/app/design-system/_fixtures/drummond/` (per Q1=A). Real → fictional substitution covers homeowner names, site address, vendor business names, invoice numbers (preserving format pattern). 17 vendors × 5 pay apps × 25-50 line items per pay app × 4-6 COs × 3 lien-release sets × 25 budget lines.
2. **Invoice approval flow prototype** at `/design-system/prototypes/invoices/[id]` — 4 invoices spanning the 11-status workflow (ai_processed yellow, pm_review yellow, qa_review green, paid). Three format types per CLAUDE.md (clean PDF, T&M, lump-sum). Site Office variant.
3. **Draw approval prototype** at `/design-system/prototypes/draws/[id]` — Drummond Pay App 5 (the latest in Source 3 inventory) with all G703 line items. Site Office Telex-ticker audit timeline.
4. **AIA G702/G703 print preview** at `/design-system/prototypes/draws/[id]/print` — **tiered fidelity per Q7 override:** G702 cover sheet attempts pixel-perfect (single page, strict layout); G703 detail page accepts 80%. Print stylesheet + page breaks. Tests PATTERNS.md §10. Escape clause: if pixel-perfect G702 explodes past first-attempt judgment, drop to 80% on both and log AIA fidelity as separate phase.
5. **Budget view prototype** at `/design-system/prototypes/jobs/[id]/budget` — Drummond budget with 25+ line items, real CO impacts, vendor breakdown per cost code.
6. **Vendor management prototype** at `/design-system/prototypes/vendors` — 17 Drummond vendors with long names, mixed entity types. Tests List+Detail at scale.
7. **Document review for plans + contracts + lien releases** at `/design-system/prototypes/documents/[id]` — 3 sub-prototypes. Lien release renders Florida 4-statute types. Plans render anonymized Drummond plan PDF. Contract renders sanitized contract.
8. **Mobile approval flow** — invoice approve/hold/deny on iPhone-sized viewport. Site Office compact density at 360px. 56px high-stakes targets. Pinch zoom on file preview. **Real-device test on Jake's actual phone gates ship per Q5=B.**
9. **Owner portal stub** at `/design-system/prototypes/owner-portal/` — dashboard + draw approval (per Q8=B). Tests Site Office trust posture for non-builder homeowner audience.
10. **Reconciliation strawman** at `/design-system/prototypes/reconciliation/` — All 4 candidates × invoice ↔ PO drift + draw ↔ budget drift = 8 prototypes (per Q3=C, Q6=A+B). Drummond drift fixtures derived from real Source 3 invoice-vs-PO mismatches.
11. **Schedule (Gantt) prototype** at `/design-system/prototypes/jobs/[id]/schedule` — Wave 2 preview surface per Q2 override (C). Drummond pay app dates + lien release dates reconstruct a rough ~6-month schedule (≥20 tasks, dependencies visible, today-marker clear). Tests Site Office direction's fit for Gantt-specific density + timeline rendering. **Acceptance:** if readability fails on real-data Gantt, log as design-system polish requirement (does not halt phase). NEW pattern — not yet in PATTERNS.md catalogue; if 1.5b proves Gantt fit, PATTERNS.md gains Timeline/Gantt entry as 1.5a-followup.

**Out of scope (deferred):**

- Daily log view (per Q2 override C) — defer to Wave 2 phase. Lower risk than schedule (uses document review + list patterns already validated). Schedule (Gantt) IS in scope as deliverable #11.
- Owner portal photos/messages/lien viewer (per Q8=B) — Wave 3 entities.
- Pixel-perfect AIA G703 detail page (per Q7 override) — Wave 3+. Note: G702 cover sheet IS in scope for pixel-perfect attempt with escape clause.
- Full reconciliation candidate lock (per Q3=C) — leading candidate documented; lock at reconciliation phase.
- 12-prototype reconciliation matrix (per Q6) — 8 prototypes is sufficient.
- Polish work on prototypes — 1.5b surfaces findings; polish phase fixes them.
- Production database integration — D-009: 1.5b is throwaway HTML.
- 1.5c test infrastructure — separate sub-stage.
- F1-F4 schema work — post-CP3.
- 1.5a-followup-1 rgba drift fix (per D-038) — polish phase.
- CP marker-file persistence re-architecture (per D-039 / Q10=C) — pre-CP3 infra task.

**Acceptance criteria target (preview — final criteria locked in `/gsd-discuss-phase`):**

- [ ] `.planning/fixtures/drummond/SUBSTITUTION-MAP.md` exists (gitignored) covering homeowner names, site address, 17 vendor business names, invoice number patterns
- [ ] `src/app/design-system/_fixtures/drummond/{invoices,vendors,jobs,cost-codes,draws,change-orders,budget,lien-releases}.ts` exist with sanitized data
- [ ] Build-time grep check: no real Drummond names ("Drummond", real vendor names, "501 74th") appear in committed `_fixtures/drummond/` output
- [ ] All 10 prototype routes render at `/design-system/prototypes/*` with real-shape Drummond data
- [ ] Site Office variant defaults applied (UPPERCASE eyebrows + 0.18em tracking + JetBrains Mono dominance + compact density + 1px slate-tile left-stamp + 150ms ease-out)
- [ ] Set B palette honored (no Set A overrides)
- [ ] Hook T10c continues to enforce — no `@/lib/supabase|org|auth` imports in any prototype route
- [ ] Middleware gates all prototype routes to platform_admin in production
- [ ] Mobile approval flow tested on Jake's actual phone (preview URL); gloves test spot-checked
- [ ] AIA G702/G703 print preview renders bank-acceptable layout (80% fidelity acceptable)
- [ ] Reconciliation strawman renders all 4 candidates × 2 drift types (8 prototypes)
- [ ] 1.5b findings document written to `.planning/phases/stage-1.5b-prototype-gallery/findings.md` with: polish requirements (non-blocking, feed Wave 1.1), critical findings (blocking, halt and decide), reconciliation leading-candidate recommendation
- [ ] If any CRITICAL finding emerges, phase halts at that prototype with explicit handback to Jake
- [ ] All 30+ line item DataGrid renders within Site Office compact density without horizontal scroll on `nw-tablet`
- [ ] Long vendor names render without breaking layout on `nw-phone` (test against Florida Sunshine Carpentry, ML Concrete LLC)
- [ ] Lien release prototype renders Florida 4-statute types correctly (with status_history JSONB faked locally — F1 fixes the schema)
- [ ] **Schedule prototype (per Q2 override C):** Site Office Gantt renders ≥6-month timeline + ≥20 tasks + dependencies visible + today-marker clear. If readability fails, finding logged as design-system polish requirement (does not halt phase).
- [ ] **G702 cover sheet print fidelity (per Q7 override):** pixel-perfect attempt against Drummond Pay App 5. If first-attempt explodes past tractable scope, halt and Jake decides escape-clause invocation (drop both to 80%).
- [ ] **Real-phone testing (per Q5=B + Jake's expanded acceptance):** Jake walks every prototype on his actual phone before ship verdict. PM-in-field flow tested with one-hand operation, gloves-on simulation, outdoor lighting. Any failure halts before ship.

---

## 8. Risks and assumptions

| # | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| R1 | Drummond fixture extraction work explodes — extracting structured data from 5 pay app XLSX + lien release PDF + budget XLSX + invoice PDFs is real engineering work (parsing, schema mapping, sub map application) | MEDIUM | HIGH (blocks all downstream prototypes) | Time-box at 2 days. **Halt rule (Jake-confirmed 2026-05-01):** if extraction passes 4 days (2x overrun), halt and tell Jake — fallback options are Q4=B compressed fixture (1-2 pay apps, 8-10 vendors) OR scope-cut another deliverable. Substitution-map application is straightforward (sed-replace style); the structural extraction is the wildcard. |
| R2 | Mobile test on Jake's phone reveals fundamental gap — 56px gloves test fails, pinch zoom on PDF preview broken, Site Office direction reads as "too dense" on real screen | MEDIUM | HIGH (validates the question 1.5b exists to answer) | This is the **Q9=B halt criterion**. If found, halt and decide between (a) tactical patches, (b) Site Office variant adjustment for mobile, (c) reverting CP2 direction pick. |
| R3 | Reconciliation prototype reveals all 4 candidates fail against Drummond drift — design system can't represent real drift volume | LOW | HIGH (PATTERNS.md §11 needs rewrite mid-foundation) | Itself a finding worth halting for. The 4 candidates were strawman-only per A16.1. Rewriting one strawman entry in 1.5b is cheaper than rewriting after F1-F4 work has anchored to it. |
| R4 | Site Office direction reveals visual gap when applied to print view — Telex-ticker doesn't print, JetBrains Mono UPPERCASE in print may not match AIA expectations | MEDIUM | MEDIUM | Print view uses a print-specific override stylesheet (PATTERNS.md §10 anticipates this). Surface as polish requirement; do not block. |
| R5 | Owner portal in Site Office direction feels too archival/utility for non-builder homeowner audience | MEDIUM | MEDIUM | Surface as a finding ("Site Office may need a 'lighter variant' for owner-facing surfaces"); don't redesign in 1.5b. Wave 3 owner portal phase owns the resolution. |
| R6 | Substitution map quality varies — some real names may leak through extraction script | LOW | HIGH (data privacy violation) | Build-time grep check rejects committed fixtures containing known real Drummond names. SUBSTITUTION-MAP.md (gitignored) is comprehensive enough that grep against committed `_fixtures/drummond/` output finds zero real-name matches. |
| R7 | Hook T10c blocks legitimate fixture imports in prototype routes — false positive | LOW | LOW (hook is well-tested per 1.5a) | Hook permits imports from `src/app/design-system/_fixtures/`; the new `_fixtures/drummond/` subdirectory inherits that permission. Verify with positive test on first commit. |
| R8 | CLAUDE.md "Drummond Pay App 8" reference contradicts Source 3 inventory (5 pay apps, not 8) | LOW | LOW (cosmetic) | Update CLAUDE.md to "Drummond Pay App 5" (or "the latest Drummond pay app") in a polish pass. Surface as a finding. |
| R9 | Scope creep — Jake adds surfaces mid-1.5b ("oh and let me also see CO log") | MEDIUM | MEDIUM | Re-frame as polish backlog items, not 1.5b deliverables. The 10 prototype routes in §7 are the lock. |
| R10 | 1.5b reveals design system has gaps that 1.5a missed (e.g., no pattern for "vendor list with insurance/W9 status pills") | MEDIUM | LOW (this is the validation phase's job) | Surface as 1.5a-followup-N findings; feed to polish phase or 1.5a v1.1 amendment. |

**Assumptions:**

- D-037 lock holds — Site Office + Set B is final; 1.5b does not relitigate CP2.
- Drummond Source 3 raw files remain in Jake's `Downloads/` and accessible to the extraction script.
- Vercel preview URL works on Jake's phone (no mobile-only auth issues).
- Hook T10c sample-data isolation continues to work as-built.
- The 1.5a-followup-1 rgba drift (D-038) does not block visual review of prototypes.
- Jake's actual phone (presumably iPhone) is the mobile reference device; iOS Safari is the test browser.

---

## 9. Hand-off

After Jake approves this expansion (or amends it):

1. `/nightwork-auto-setup stage-1.5b-prototype-gallery` runs — provisions fixture extraction infrastructure (gitignored SUBSTITUTION-MAP.md template, fixture loader scaffold), confirms `/design-system/prototypes/*` route conventions, ensures middleware gating extends to sub-routes.
2. `/np stage-1.5b-prototype-gallery` builds PLAN.md — task breakdown for fixture extraction, 10 prototype routes, mobile test, finding-document template.
3. `/nightwork-plan-review` runs at end of plan — design-pushback agent verifies Site Office direction adherence, multi-tenant-architect verifies hook T10c respect, scalability agent reviews fixture loader.
4. `/nx stage-1.5b-prototype-gallery` executes — preflight check + execute + QA gate.
5. **Strategic Checkpoint review at end** — Jake walks through prototypes (desktop + phone), surfaces critical findings (halt) vs polish findings (Wave 1.1 backlog).
6. `/gsd-ship` after CP review — sanitized fixtures + 10 prototype routes + findings document committed to main.

**Subordinate work post-1.5b:**
- Stage 1.5c — fixture loader from 1.5b becomes the test infrastructure base.
- Wave 1.1 polish phase — findings document feeds the polish backlog.
- Reconciliation phase post-3.9 — leading-candidate recommendation locks PATTERNS.md §11.
- F4 Drummond historical back-import — sanitized fixtures inform V.2 schema; raw Source 3 ingest.

**Cross-references:**
- Master plan: `.planning/MASTER-PLAN.md` (D-009, D-029, D-036, D-037, D-038, D-039)
- VISION: `.planning/architecture/VISION.md` (Wave 1 + Wave 3 owner portal)
- CURRENT-STATE: `.planning/architecture/CURRENT-STATE.md` (entity status, F.4 Drummond ingestion gap)
- GAP: `.planning/architecture/GAP.md` (F1-F4 sequencing; F4 includes Drummond back-import)
- CP1-RESOLUTIONS: `.planning/architecture/CP1-RESOLUTIONS.md` (D-029, D-036)
- DRUMMOND-FIXTURE-SUMMARY: `.planning/architecture/DRUMMOND-FIXTURE-SUMMARY.md` (sanitized counts)
- Design docs: `.planning/design/{SYSTEM,COMPONENTS,PATTERNS,PHILOSOPHY,CHOSEN-DIRECTION,PROPAGATION-RULES}.md`
- 1.5a SPEC: `.planning/phases/stage-1.5a-design-system-documents/SPEC.md` (D7 forbids Drummond data; INVERTED in 1.5b)
- 1.5a EXPANDED-SCOPE: `.planning/expansions/stage-1.5a-design-system-documents-EXPANDED-SCOPE.md` (precedent for expansion document shape)
- Operational rules: `CLAUDE.md` (Drummond reference job, Stage 1.5a documents are authoritative)
- Canonical: `docs/nightwork-plan-canonical-v1.md` (R.1-R.23, §11 open questions)
- Hook: `.claude/hooks/nightwork-post-edit.sh` (T10c sample-data isolation lines 194-230)
