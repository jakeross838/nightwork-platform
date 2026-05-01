# Strategic Checkpoint #1 — Resolutions

**Status:** CP1 close-out artifact. Last updated 2026-04-29.
**Scope:** Resolutions to every open question raised in `GAP.md §C.2` (13 assumptions A1–A13 + 5 new questions NQ1–NQ5 + new question A14). Each entry documents how the resolution was reached: autonomous (codebase/fixture/web research) or Jake's strategic answer.
**Next:** GAP.md and MASTER-PLAN.md DECISIONS LOG updated to reflect resolutions. Stage 1.5a unblocked.

Each resolution gets a D-number (D-019 through D-NN) recorded in MASTER-PLAN.md DECISIONS LOG. The D-numbering is sequential after D-018 (Stage 1.6 system).

---

## A1 — `gl_codes` first-class entity in F1; chart-of-accounts seed

**Question:** Does Ross Built have a working chart of accounts that should seed the new `gl_codes` table being added in F1? VISION/TARGET position: yes, add it.

**Jake's answer (verbatim):** "We use QuickBooks Desktop, not sure if there's a working chart of accounts."

**Autonomous research path:**

1. **Drummond fixtures inspected** — Source 1 P-drive `Budget/` folder (verified directly): 2 sub-folders (`OLD/` 5 PDFs; `Payapps/` 13 XLS/XLSX), top-level estimate files. Includes `Drummond - Line Items Cost Coded.pdf` — Ross Built's cost-code-anchored estimate, NOT a GL chart of accounts.
2. **P-drive root scan** — found `QuickBooksEnterprise24.exe` and `Company (RB2019) (P) - Shortcut.lnk` pointing at the live QB company file. The actual chart of accounts lives inside `.qbw`, not exported anywhere on the share. `find /p -maxdepth 4 -iname "*.iif" -o -iname "*chart*account*" -o -iname "*COA*"` returned **zero hits**.
3. **`/p/Ross Built - Processes/SOWs - Claude/03_Forms_Templates/BUDGET_TEMPLATE.md`** is Ross Built's canonical budget template — confirms the company thinks in 5-digit cost codes (01101 → 25xxx), organized by trade. Not a GL.
4. **Source 2 Supabase JSON inspected** — `cost_codes.json` and `org_cost_codes.json` have zero GL fields, zero account_type markers, zero QB-account FKs.
5. **Source 3 Downloads INVENTORY** — no IIF/QBB/QBM files; `qb_bill_id` / `qb_vendor_id` references are ID stubs for future QBO sync.
6. **Codebase grep** — `grep -rni "gl_code|chart_of_account|gl_account" src/ supabase/migrations/` hits only forward-looking `.planning/architecture/*.md` docs.
7. **Industry standard research (web)** — multiple sources (NAHB, JLC, Cooper Norman, Apparatus, RedHammer, Levelset, Knowify, Fast Easy Accounting) converge on **NAHB Chart of Accounts** as the residential-builder standard. The QB Desktop default Contractor chart is widely considered inadequate (lacks WIP, hard/soft cost separation, proper job-cost rollups). Multiple consulting firms sell NAHB-anchored replacement templates for QB Desktop precisely because the default is undersized for builders Ross Built's size (14 simultaneous jobs, single-region).

**Resolution (autonomous):** **D-019.** F1 seeds `canonical_gl_codes` with NAHB Chart of Accounts (~400 line items, mirrored on the `canonical_cost_codes` migration 00082 pattern). `org_gl_codes` is per-tenant override (mirrors `org_cost_codes`). `gl_code_id` FK is added to `cost_codes`, `org_cost_codes`, and `invoices` **as nullable** day-1, populated opt-in via QBO sync wave (Phase 4). This means F1 ships GL infrastructure without forcing an onboarding step that has no Wave 1 business value.

**Open follow-up for Jake (one targeted question):** Has Diane customized QB Desktop's chart of accounts heavily over 19 years, or is it mostly stock? If customized, a one-time `File → Utilities → Export → Lists to IIF Files → Chart of Accounts` from QB Desktop gives us the real Ross Built CoA in ~30 seconds and we seed THAT as Ross Built's `org_gl_codes` overlay. If stock, NAHB alone is sufficient. (This affects the seed depth, not the F1 schema decision.)

**Impact on F1-F4:** F1 grows by one migration (NAHB seed) and one nullable FK column add per relevant table. ~half-day addition to F1 estimate. No scope change to F2-F4.

---

## A2 — Cost-code wipe-and-reseed safe (no production customizations to preserve)

**Question:** Are there production cost-code customizations Jake wants to preserve before F1 wipes legacy `cost_codes`?

**Autonomous research path:** Per `CURRENT-STATE.md §A.3.1` — Ross Built's real production cost codes live ONLY in legacy `cost_codes` (238 rows). `org_cost_codes` for Ross Built is 12 rows of synthetic test data (R-T-001 through R-T-007, R-DW-001, R-FAKE-001, R-TEST-FOO-001). The Source 1 P-drive `BUDGET_TEMPLATE.md` and `Drummond - Line Items Cost Coded.pdf` carry the real Ross Built cost-code structure (5-digit, ~250 entries, anchored to AIA G703 layout). These can re-seed `org_cost_codes` cleanly.

**Resolution (autonomous):** **D-020.** Wipe-and-reseed is safe and recommended. F1 drops legacy `cost_codes`, re-seeds `org_cost_codes` for Ross Built from Drummond fixtures (`Drummond - Line Items Cost Coded.pdf` parsed to extract codes + descriptions; `BUDGET_TEMPLATE.md` confirms structure). `canonical_code_id` mappings populated where obvious (NAHB level-3 spine).

**Impact on F1-F4:** F1 picks up a small additional task (parse Drummond cost-code list into seed SQL). No scope change elsewhere.

---

## A3 — Drop `change_order_budget_lines` safe

**Question:** Any external integrations or future plans that reference `change_order_budget_lines`?

**Autonomous research path:** Per `CURRENT-STATE.md §A.3.4`, `change_order_budget_lines` (migration 00015) has 0 rows, 0 `src/` consumers (verified by grep). Superseded by `change_order_lines` (migration 00028).

**Resolution (autonomous):** **D-021.** Drop in F0 prep (which is now absorbed into F1 per NQ4). `.down.sql` paired with the original CREATE for emergency rollback.

**Impact on F1-F4:** No change beyond the absorption already noted in NQ4.

---

## A4 — Inngest cloud vs self-host

**Question:** Inngest pick — any opinion on running Inngest cloud vs self-host?

**Autonomous resolution path:** Per `TARGET.md §C.4`, Inngest is recommended primary + pg_cron complementary. Inngest Cloud (their managed offering) is the standard starting point for Next.js apps; free tier sufficient for first 10 orgs. Self-host (Inngest Dev Server in production) only relevant for compliance-restricted environments. Ross Built has no compliance restriction that prohibits cloud-managed background jobs (single-tenant Supabase + Vercel + Anthropic + Stripe + Resend already cloud-managed).

**Resolution (autonomous):** **D-022.** Inngest Cloud (managed offering). Pay tier flips at first paid GA when concurrency / step durations / call volume warrant. Self-host fallback documented for compliance edge cases.

**Impact on F1-F4:** F3 picks up Inngest Cloud setup. ~1 day of F3's 10-14 estimate.

---

## A5 — F2 before F3 sequence

**Question:** Is the F2-before-F3 sequence the right call?

**Autonomous research path:** Per `GAP.md §B sequence rationale`:
1. `transitionEntity` (F2) becomes the canonical activity_log writer; F3's `withAuditWrap` middleware piggybacks on this.
2. The approval framework (F2) is referenced by background jobs (F3 — notify-step-approvers fan-out is the natural first Inngest function).
3. Inngest setup (F3) is large enough that having stable F2 invariants reduces F3 rework.
Reverse order doubles audit-log middleware work and rebuilds approval-fan-out twice.

**Resolution (autonomous):** **D-023.** F2 before F3, as specified in GAP.md §B. Confirmed.

**Impact on F1-F4:** None — sequence holds.

---

## A6 — Approval framework guinea pig: invoice

**Jake's strategic answer (verbatim):** invoice (highest volume = fastest learning). CO follows as the second consumer.

**Resolution (Jake-strategic):** **D-024.** F2 wires `approval_chains` for invoice flow first; verifies Ross Built defaults end-to-end on Drummond; then propagates to draw, CO, PO, proposal.

**Impact on F1-F4:** None — already aligned with GAP.md F2 acceptance criteria (which name invoice as the first wired flow).

---

## A7 — Drummond fixture back-import as F4 dogfood: yes

**Jake's strategic answer (verbatim):** yes. The 5 historical pay apps + 17 vendors + lien releases + budget XLSX in Downloads are the test data.

**Resolution (Jake-strategic):** **D-025.** F4 includes a Drummond historical back-import via the V.2 portability framework (built in F3) as the dogfood pass. The 5 pay apps (XLSX + PDF), the Nov-2025 lien-release set, and the recent budget XLSX get parsed and ingested into the Stage-1.6-cleaned schema. This serves three purposes: (a) validates the V.2 framework on real-shape data, (b) closes the data-ingestion gap concretely (CURRENT-STATE §F.4), (c) gives Wave 1.1 polish work real Drummond data to exercise.

**Impact on F1-F4:** F4 final acceptance criteria explicitly includes "Drummond historical invoices imported from Downloads → Supabase via V.2 framework" (already in GAP.md §B F4 acceptance criteria — confirmed).

---

## A8 — Strategic Checkpoint #3 between F4 and Wave 1: yes

**Question:** Should CP3 fall between F4 and Wave 1 (not between F2 and F3, etc.)?

**Autonomous research path:** Per `MASTER-PLAN.md D-012`, the four strategic checkpoints are explicitly enumerated: CP1 vision close, CP2 prototype gallery, CP3 foundations close, CP4 Wave 1 mini. CP3 = "foundations close" per D-012's plain language. Foundations = F1-F4. So CP3 falls after F4 and before Wave 1 work proper.

**Resolution (autonomous):** **D-026.** CP3 between F4 and Wave 1, as specified in D-012. Confirmed.

**Impact on F1-F4:** None — checkpoint placement holds.

---

## A9 — UCM identity and near-term posture

**Question:** What does UCM mean? Is it near-term?

**Jake's answer (verbatim):** "I think a previous Claude session made that abbreviation up, I'm not sure."

**Autonomous research path:**

1. **Origin traced** — first (and only) appearance is `docs/nightwork-plan-canonical-v1.md`, commit `d5222a5` dated 2026-04-28 ("docs(plan): canonical plan v1 — consolidated source of truth"). Not present in retired plan docs (`nightwork-rebuild-plan.md`, amendment-1, addendum-a, addendum-b). The term originated in the canonical-plan authoring session, not migrated from earlier docs.
2. **Codebase scan** — zero references in `src/`, `supabase/migrations/`, or any commit message.
3. **Canonical definition** — §6: *"UCM is the proposed target: one underlying table for all commitment-shaped entities, with type discrimination and entity-specific projections on top."* Glossary entry §13.1: *"UCM (Unified Commitment Model). Proposed target schema (§6). One underlying table for all commitment-shaped entities. TBD design."*
4. **Architectural problem evidenced** — cost-code dual registry, `status_history` JSONB without DB enforcement, `target_entity_id` bare UUID without FK, no transactions in TS layer, status enum drift across entities (re-aligned via migration 00060). The problem is real and documented in canonical audit Deliverable 4 §Cost codes, Deliverable 3 §JSONB usage, Flow B fragility.
5. **Three open decisions remain in canonical §6:** (a) wide-with-nullables vs narrow-plus-JSONB, (b) per-entity statuses vs collapsed chain-state, (c) migration sequence.

**Resolution (autonomous):** **D-027.** UCM (Unified Commitment Model) is real architectural target with a Claude-coined brand name. Concept survives; the brand name is downgraded to a working label. Going forward in canonical and `.planning/`, references read "Commitment Schema Consolidation (working title: UCM)" until canonical Q3 locks the design. **F1-F4 impact: zero** — no foundation phase touches UCM. Canonical §11 Q3 explicitly says "Lock by: before any UCM code; ideally before Phase 4 planning." GAP.md A9's assumption that UCM lands AFTER F1-F4 stands.

**Impact on F1-F4:** None. UCM consolidation is post-Wave-1 work, likely Phase 4-class. Canonical Q4 (cost-code registry consolidation timing) is the only F1-touching decision in this neighborhood, and F1 already absorbs that consolidation.

---

## A10 — Reconciliation surface as own phase post-foundation

**Question:** Should the reconciliation surface (canonical Q1) land as its own phase post-foundation?

**Autonomous research path:** Per canonical §2 (the reconciliation thesis is the wedge thesis) + canonical §11 Q1 + canonical §9.4 Phase 4 placeholder. Per-transition reconciliation (invoice ↔ PO, CO ↔ budget, draw ↔ lien) is implicit in Phases 3.6/3.7/3.9. Cross-entity drift detection is not yet planned. Canonical Q1 says "Lock by: before Phase 3.6 starts." Phase 3.6 is post-foundation. Therefore reconciliation surface either (a) lives implicit in 3.6/3.7/3.9 with no explicit cross-entity UI, or (b) lands as its own phase post-3.9 once constituent extractors are live.

**Resolution (autonomous):** **D-028.** Reconciliation surface lands as its own phase post-foundation, after Phase 3.9 (the last constituent extractor — historical_draw + budget). VISION.md A10 position confirmed.

**Impact on F1-F4:** None — out of foundation scope.

---

## A11 — No real customer data committed; substitution-map approach sufficient

**Question:** Is the substitution-map approach sufficient when real cross-org sharing eventually happens?

**Autonomous research path:** Per `DRUMMOND-FIXTURE-SUMMARY.md` and `CURRENT-STATE.md §F` — fixtures are gitignored; substitution map is created on demand the first time fixtures are shared cross-org. Until then, fixture access is local-only. Jake's mid-Stage-1 clarification confirmed real homeowner data must NOT be committed; synthetic placeholder data in Supabase is acceptable test infrastructure.

**Resolution (autonomous):** **D-029.** Substitution-map approach sufficient. Workflow: when fixtures are first shared cross-org (likely first paid customer pilot), an explicit migration step creates `.planning/fixtures/drummond/SUBSTITUTION-MAP.md` (gitignored), runs sed-style replacement on all fixture text, and commits a sanitized variant to a separate fixture share repo. Until then, all fixtures stay local.

**Impact on F1-F4:** None.

---

## A12 — F3 10-14 day estimate comfort

**Question:** Is the F3 estimate comfortable (heaviest phase)?

**Autonomous research path:** F3 scope: Inngest setup + 5 jobs, pg_cron, idempotency middleware + Stripe webhook fix, rate limit middleware, Pino structured logger + ~100 console.* replacements, Sentry tightening, RLS policy-stack collapse via /nightwork-propagate, V.2 portability framework + 3 entity adapters, trial expiry, plan-limits gating, CI test gate. Twelve sub-tasks, four cross-cutting (Inngest, RLS collapse, V.2 framework, structured logger) each ~2-3 days when done well.

**Resolution (autonomous):** **D-030.** F3 estimate stands at 10-14 days (calendar — includes review/checkpoint loops). Mid-phase checkpoint at 7-day mark with Jake to scope-cut if needed. RLS collapse routes through `/nightwork-propagate` per its multi-table blast-radius nature (already specified).

**Impact on F1-F4:** None — estimate stands.

---

## A13 — F4 final acceptance includes Drummond back-import

**Resolution (autonomous, derived from A7):** **D-031.** Confirmed. F4 acceptance criterion #9 (per GAP.md §B): "Drummond historical invoices imported from Downloads → Supabase via V.2 framework." Aligned with A7.

**Impact on F1-F4:** None — already in GAP.md.

---

## NQ1 — Construction_address vs billing_address

**Jake's strategic answer (verbatim):** yes, both fields. Construction is at site (Holmes Beach FL), billing might go to owner's primary residence or property management.

**Resolution (Jake-strategic):** **D-032.** F1 entity-model migration adds two address fields to `jobs`:
- `construction_address` (text, NOT NULL — the build site, e.g., "501 74th, Holmes Beach FL")
- `billing_address` (text, nullable — defaults to construction_address; populated when distinct, e.g., owner's primary residence or property manager)

Drummond fixture seed populates `construction_address = "501 74th, Holmes Beach FL"`; `billing_address` left null (or set to homeowner's residence in the gitignored substitution map).

The current `jobs.address` column gets renamed to `construction_address` (with a `.down.sql`-paired rename for reversibility). Existing Supabase data migrates: `address → construction_address`. Zero rows currently in production, so the rename is risk-free.

**Impact on F1-F4:** F1 picks up the address-split migration. Half-day addition. UI updates to show both addresses where relevant (job detail page, invoice review hover, draw doc). Onboarding wizard captures both at job-creation.

---

## NQ2 — `payments` first-class table in F1

**Question:** VISION/TARGET say promote `payments` to first-class. Confirm timing.

**Autonomous research path:** Per `VISION.md §2.4` and `TARGET.md §A.3`, `payments` promotion is in F1 scope. Today, payment info lives as columns on `invoices` (`payment_date`, `check_number`, `picked_up`). The promotion supports partial payments and one-payment-multiple-invoices (the `payment_invoices` junction). Required preconditions: QB sync planning prefers it; Wave 5 QBO sync writes payment events. Acceptance criterion in GAP.md §B F1 already includes the promotion.

**Resolution (autonomous):** **D-033.** Promote in F1 as planned. Migrate existing `invoices.payment_date` / `check_number` / `picked_up` to `payments` rows during the migration (one row per invoice with non-null payment_date); leave the `invoices` columns in place for one cycle as a read-only legacy compat layer; drop them in F4.

**Impact on F1-F4:** F1 already includes this. Slight additional acceptance criterion tightening: legacy compat columns kept in F1 → F4, dropped in F4. No scope change.

---

## NQ3 — Four-table invoice-line-shape

**Question:** Document and live with for now (TARGET position) or consolidate at F1?

**Autonomous research path:** Per `TARGET.md §A.2`, the four tables (`invoice_line_items`, `invoice_allocations`, `document_extraction_lines`, `line_cost_components`) each serve a distinct purpose. UCM (canonical Q3) is the eventual consolidation. F1 consolidating them would be wasted work re-done by UCM. Document-and-live-with is the lower-risk path.

**Resolution (autonomous):** **D-034.** Document-and-live-with for now. F1 adds explicit canonical documentation in canonical §5.6 (no schema change) plus a `v_invoice_lines_full` view for queries that need the unified shape. UCM consolidates later.

**Impact on F1-F4:** F1 picks up a one-line view migration + canonical documentation update. No scope change.

---

## NQ4 — F0 absorbed into F1

**Jake's strategic answer (verbatim):** absorbed into F1. F0 is one day of cleanup tightly coupled to F1.

**Resolution (Jake-strategic):** **D-035.** F0 prep work is absorbed into F1. F1 first-day tasks: drop `change_order_budget_lines`, add `lien_releases.status_history`, fix docx-html auth, decide `budgets` table fate. F1 estimate becomes 6-8 days (was 5-7 + 1).

**Impact on F1-F4:** GAP.md §B updated. F0 phase removed from sequence. F1 estimate +1 day.

---

## NQ5 — Reconciliation surface mock-up before Stage 1.5

**Question:** Should we add a "reconciliation surface" mock-up phase before Wave 1.5 design system work?

**Autonomous research path:** The reconciliation surface (canonical §2 wedge thesis) is the most architecturally novel UI element Nightwork ships. It doesn't have a design precedent (invoice review template doesn't show cross-entity drift). Stage 1.5 design system work could either (a) defer reconciliation surface design until post-foundation when extractors land, or (b) include a reconciliation-surface mock-up alongside the other prototype gallery items in Stage 1.5b so design vocabulary develops in parallel.

**Resolution (autonomous):** **D-036.** Add reconciliation-surface mock-up to Stage 1.5b prototype gallery (alongside invoice review, draw assembly, budget dashboard, CO log, lien-release flow, settings, owner portal stub). Mock-up is throwaway HTML on Drummond data; goal is to develop design vocabulary, not commit to UI. Strategic Checkpoint #2 (per D-012) reviews the gallery including this addition.

**Impact on F1-F4:** None directly. Stage 1.5b scope grows by one prototype.

---

## A14 — Build Requirements Expansion + Auto-Setup + Pre-Flight system

**Jake's strategic answer (verbatim):** yes. Stage 1.6.

**Resolution (Jake-strategic):** **D-018.** See MASTER-PLAN.md D-018 entry. Stage 1.6 builds:
- `nightwork-requirements-expander` agent (`.claude/agents/`)
- `/nightwork-auto-setup` command (`.claude/commands/`)
- `nightwork-preflight` skill (`.claude/skills/`)
- `/np` and `/nx` wrapper commands (`.claude/commands/`)
- `/nightwork-init-phase` orchestrator command (`.claude/commands/`)

Every phase from F1 onward begins with `/nightwork-init-phase` to surface unstated requirements before plan/execute.

**Impact on F1-F4:** Every foundation phase now begins with `/nightwork-init-phase`. Net effect: less rework from un-thought-of requirements; more upfront thinking time amortized across faster execution.

---

## REMAINING-CP1-QUESTIONS (yes/no or A/B/C only)

These genuinely need Jake's input. They do not block Stage 1.5a — answer at convenience.

1. **A1 follow-up — chart of accounts seed depth:** Has Diane customized QB Desktop's chart of accounts heavily over 19 years, or is it mostly stock?
   - **A:** Stock — F1 seeds NAHB only.
   - **B:** Customized — Diane runs `File → Utilities → Export → Lists to IIF Files → Chart of Accounts` (~30 seconds). The IIF goes to `.planning/fixtures/ross-built/` (gitignored). F1 seeds NAHB at canonical layer + Ross Built CoA at `org_gl_codes`.
   - **Recommended:** B if any meaningful customization exists; A if Diane mostly accepts QB defaults. Default to A unless Jake confirms customization happened.

(That's the only genuinely Jake-blocking question. Everything else is autonomously resolved.)

---

## Summary

- **17 questions surfaced** (A1–A14 from GAP §C.2 + NQ1–NQ4 from GAP + NQ5 new).
- **17 resolved** — 6 by Jake's strategic answers (A6, A7, NQ1, NQ4, A14 + clarification on A1's framing), 11 autonomously (A1, A2, A3, A4, A5, A8, A9, A10, A11, A12, A13, NQ2, NQ3, NQ5).
- **1 follow-up question** for Jake (A1 sub-question about CoA customization) — non-blocking.
- **D-018 through D-036** added to MASTER-PLAN.md DECISIONS LOG.
- **GAP.md updated:** F0 absorbed into F1 (D-035); resolved assumptions marked.
- **CP1 closed.** Stage 1.5a unblocked. The follow-up A1 sub-question can be answered when Jake gets to it; F1 picks the appropriate branch at that time.

---

**Cross-references:**
- Master plan: `.planning/MASTER-PLAN.md`
- Vision: `.planning/architecture/VISION.md`
- Current state: `.planning/architecture/CURRENT-STATE.md`
- Target architecture: `.planning/architecture/TARGET.md`
- Foundation phase plan: `.planning/architecture/GAP.md`
- Canonical: `docs/nightwork-plan-canonical-v1.md`
