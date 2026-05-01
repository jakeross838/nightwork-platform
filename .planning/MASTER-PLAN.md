# Nightwork — Master Plan

**Status:** canonical entry point. Last updated 2026-04-29.

This document is the single source of truth for what Nightwork is, where it is going, and where it currently stands. Everything else (`PROJECT.md`, `ROADMAP.md`, `REQUIREMENTS.md`, `STATE.md`, `deployment.md`, `docs/nightwork-plan-canonical-v1.md`) remains as a detailed view of one slice — but this file is the canonical entry point. When the two disagree, fix this file or fix the slice; never let them silently drift.

The session-start hook (`.claude/hooks/nightwork-session-start.sh`) loads this file into every Claude Code session. The anti-drift skill (`.claude/skills/nightwork-anti-drift/SKILL.md`) requires that any non-trivial action trace back to a section in this document — DECISIONS LOG, NEXT PLANNED WORK, or CURRENT POSITION → outstanding.

---

## 1. PURPOSE

Nightwork is the AI-powered operating system for custom home builders. It replaces the paper-and-spreadsheet workflow of $1.5M–$10M+ residential general contractors with a single system where data enters once and flows everywhere — invoices to draws, proposals to POs, COs to budgets, lien releases to payment schedules.

The first tenant is **Ross Built Custom Homes** (Bradenton / Anna Maria Island, FL — luxury coastal builder, ~14 simultaneous projects, founded 2006, cost-plus open-book). Today their workflow is: invoices arrive as email PDFs, get printed, rubber-stamped by hand, filed in physical folders, scanned back into AIA Excel templates for monthly draw applications. Diane (accounting) re-keys every line into QuickBooks and the AIA spreadsheet. PMs must be in the office to review folders. Owners (the homebuyers) see PDFs, not live data.

Nightwork eliminates that loop. PMs review invoices on phones. Budgets recompute live. Draws auto-assemble from approved invoices. AIA G702 / G703 generate from the database, with full audit trail.

The longer mission: any custom or semi-custom builder running 1–15 simultaneous jobs who today lives in QuickBooks + Excel + Buildertrend + email + paper. Pricing is Starter $249 / Pro $499 / Enterprise $799 per month, no contracts.

## 2. VISION

Nightwork's full vision is a construction operating system that scales to 100,000+ tenants. The path is five sequential deployment waves; the underlying architecture is built so each wave layers on the previous without refactoring the core.

- **Wave 1 — Financial core.** Invoices, draws, budgets, POs, change orders, lien releases, vendors, price intelligence. The "data enters once" loop. Replaces the paper / Excel / QuickBooks dance.
- **Wave 2 — Project operations.** Schedules, daily logs, punchlists, todos, document management. The day-to-day field surface for PMs and superintendents.
- **Wave 3 — Communication.** Email intake (`accounting@…`), weekly homeowner updates, in-app notifications, owner / client portal. Closes the loop with the customer.
- **Wave 4 — Intelligence.** Reports, analytics, AI insights, schedule intelligence (estimated start dates, durations, drift alerts) — possible because the data was structured from day one.
- **Wave 5 — Integrations.** Procore (handoff for larger builders), QuickBooks (two-way sync), Bluebeam (plans), Buildertrend (existing CRM bridge).

Each wave is internally split into stages with strategic checkpoints (see §8).

## 3. TECH STACK

- **Framework:** Next.js 14 (App Router) + TypeScript (strict) + Tailwind + shadcn/ui.
- **Data:** Supabase (Postgres + Row-Level Security + Auth + Storage + Realtime via WSS).
- **AI:** Anthropic Claude API (`@anthropic-ai/sdk`) — vision parsing of invoices, classification of proposals, structured extraction. OpenAI key present as a fallback parser, scoped to remove if unused.
- **Payments:** Stripe (subscription billing for the SaaS itself; Stripe Elements for collection, webhooks for state changes).
- **Email:** Resend (transactional notifications).
- **Hosting:** Vercel, single region `iad1` (N. Virginia). Production at `https://nightwork-platform.vercel.app`. Preview URL pattern `https://nightwork-platform-git-{branch}-jakeross838s-projects.vercel.app`. Full runbook in `.planning/deployment.md`.
- **Observability:** Sentry (browser + server), telemetry to `*.ingest.sentry.io`.

CSP and security headers are configured in `vercel.json`. The current CSP allows `'unsafe-inline'` in `script-src` and `style-src` because Next.js 14 injects inline hydration scripts and styles by default; migration to nonce-based CSP via middleware is tracked as deferred tech debt (§11).

## 4. TENANT MODEL

Nightwork is multi-tenant from day one — every record carries `org_id`, every tenant table has RLS enabled, every API route filters via `getCurrentMembership().org_id` (RLS is a backstop, not the primary gate). Tenant safety is built BY CONSTRUCTION: schemas and APIs are designed so a tenant cannot leak via this design even with a dropped RLS policy.

- **Tenant 1: Ross Built Custom Homes** — pre-launch, test data only. This means foundation refactors are safe today; once Tenant 2 lands the migration bar gets dramatically higher.
- **Reference job: Drummond.** Every fixture, seed, end-to-end test, screenshot, and prototype uses Drummond data. `nightwork-end-to-end-test` walks "create vendor → PO → invoice → approve → draw → G702/G703 → lien release → paid" through Drummond. Drummond Pay App 8 is the AIA G702/G703 layout reference.
- **Cross-org data sharing is explicitly OFF** today (canonical §1.4). The architecture preserves the option for a future "shared library" tier (cost codes, vendor reputations, price intelligence aggregates) but no current code exposes data across the `org_id` boundary except for the platform-admin role (Jake, Andrew — see CLAUDE.md "Platform admin" section).

## 5. STANDING RULES

These rules are non-negotiable. Custom Nightwork agents, hooks, and orchestrator commands reject work that violates them. Copied verbatim from `CLAUDE.md`.

### Architecture posture

- **Multi-tenant RLS is non-negotiable.** Every tenant table has RLS enabled, every query filters on `org_id` from `getCurrentMembership()`. Tenant safety is built BY CONSTRUCTION, not by enforcement — design schemas and APIs so that a tenant cannot leak via this design even with a dropped RLS policy.
- **Every aggregation needs proper indexes.** Dashboard 503s on aggregations (the current pain) are an architectural smell. Any new aggregation query has an index plan in the same migration. `EXPLAIN ANALYZE` runs on representative data before merging.
- **Org-configurable, not hardcoded.** Cost code lists, fee rates, payment-schedule cutoffs, deposit %, draw revision rules, lien-release templates — anything a customer might want to change — lives in `org_settings` (or a per-org config table), not in code. Ross Built defaults seed the table; future tenants override.
- **Data portability is first-class.** Every entity must be exportable to a stable JSON contract and importable from one. Imports are idempotent (re-running with the same payload is a no-op), validated against an explicit schema, and audit-logged on both sides. Data import is a triggering event for downstream workflows — not a one-shot migration.

### Code behavior

- **Recalculate, don't increment.** All running totals — `total_to_date`, `previous_applications`, `current_payment_due`, `co_running_total`, vendor balance, etc. — are computed from source-of-truth rows on read. The only stored aggregates are the explicit trigger-maintained caches called out in Development Rules (`jobs.approved_cos_total` is the canonical example), each with a rationale comment.
- **Never kill running processes.** Dev servers, watchers, queue workers, MCP browser sessions, and Vercel preview builds — never `kill -9`, never `taskkill /F`, never close a tab mid-flight to "reset state." Wait, signal politely, or open a new instance.
- **Financial calculations are auditable.** Every cents-level math step is reproducible from source rows. Status transitions append to `status_history` JSONB. PM/QA overrides log old/new values. Draws are locked on submit; revisions create Rev N rows, never overwrite. If an auditor asked "how did this number get here?", the system has to answer with row-level evidence.

### UI rules

- **Invoice review is the gold standard.** Any document review / approval / right-rail surface (proposals, draw approvals, lien releases, change orders, daily logs once they ship) extends the invoice-review template — file preview LEFT, structured fields right-rail, audit timeline at the bottom. The `nightwork-ui-template` skill codifies this contract.
- **Stone blue palette + Calibri + logo top-right.** The Slate design tokens (Stone Blue accent `#6B8EA3`, Dark Slate `#2D3E4A`, Warm Gray `#8A8A8A`) are the Nightwork product palette. Calibri is the product typeface. Ross Built logo sits in the top-right of every authenticated surface.
- **Design tokens, always.** No hardcoded colors, spacing, or typography in components. Use bracket-value utilities with CSS vars (`bg-[var(--bg-card)]`, `text-[color:var(--text-primary)]`) or the raw `nw-*` utilities. The legacy `cream/teal/brass/brand/status/nightwork` namespaces were removed in Phase E and must not return.

### Domain rules

- **Drummond is the reference job.** Every fixture, seed, end-to-end test, screenshot, and prototype uses Drummond data. Reference Drummond Pay App 8 for AIA G702/G703 layout truth.
- **Field mistakes become permanent QC entries.** When a PM or supt records a mistake during a daily log, walk-through, or punchlist, the system creates a permanent QC entry tied to the job. Mistakes are not deleted on resolution — they are closed with a resolution note. Historical QC density is a metric the system surfaces.
- **Draw requests link to punchlist.** Once schedules and punchlists ship (Wave 2), a draw request that includes a line item with an open punchlist item against it is flagged for the PM. Owner-facing draw approval shows the punchlist linkage.

### Workflow posture

- **Acceptance criteria are required.** Every phase produces explicit, falsifiable acceptance criteria during `/gsd-discuss-phase`. `nightwork-spec-checker` compares implementation to these criteria at the end of `/gsd-execute-phase`. No phase ships without them.
- **Plan-level review precedes execute.** `/nightwork-plan-review` runs at the end of `/gsd-plan-phase`. Critical findings block execute.
- **QA review precedes ship.** `/nightwork-qa` runs at the end of `/gsd-execute-phase`. Critical findings block ship.
- **End-to-end test precedes ship.** `/nightwork-end-to-end-test` runs a full Drummond scenario through the system before `/gsd-ship`. Failures block ship.
- **Cross-cutting changes go through `/nightwork-propagate`.** When a change is "everywhere," "all," "make X match Y," "every," — the propagate orchestrator builds a blast radius report, plans atomic chunks, executes with QA between each, smoke tests, and reports rollback steps. Do not perform cross-cutting changes ad-hoc.

The full canonical rule set is R.1–R.23 in `docs/nightwork-plan-canonical-v1.md` §3. The above is the operating subset that fires in day-to-day work.

## 6. DESIGN SYSTEM

The **invoice review UI** is the gold standard surface — file preview LEFT, structured-fields right-rail, audit timeline at bottom. Every document review / approval / right-rail surface (proposals, draw approvals, lien releases, change orders, daily logs once they ship) extends this template.

- **Palette:** Stone Blue (`#6B8EA3`) accent, Dark Slate (`#2D3E4A`) primary, Warm Gray (`#8A8A8A`) secondary. Implemented as CSS vars + Tailwind `nw-*` utilities. Hardcoded hex codes are blocked by the `nightwork-design-tokens` skill + `post-edit` hook.
- **Typeface:** Calibri.
- **Logo:** Ross Built logo top-right on every authenticated surface.

Stage 1.5a will produce the formal design-system documents:
- `.planning/design/PHILOSOPHY.md` — design intent and constraints.
- `.planning/design/SYSTEM.md` — tokens, layout grid, motion, spacing scale.
- `.planning/design/COMPONENTS.md` — canonical component patterns (right-rail panels, audit timeline, file preview, status pills).
- `.planning/design/PATTERNS.md` — composed patterns (review surfaces, list+detail, dashboards).

Stage 1.5b produces the prototype gallery built on Drummond data, gated by Strategic Checkpoint #2.

## 7. DEPLOYMENT WAVES

Five waves. Each ships independently; downstream waves depend on the data shape produced by upstream waves.

### Wave 1 — Financial core
Invoice ingest, AI parsing, PM mobile review, accounting QA queue, budgets, purchase orders, change orders, draws (G702 / G703), lien releases, vendors, price intelligence, payment schedules. Replaces the paper / Excel / QuickBooks loop. **Status:** partially shipped (Phases 0–8j); Phase 3.5+ completes Wave 1.

### Wave 2 — Project operations
Schedules, daily logs, punchlists, todos, document management. Schema fields for schedule intelligence (`estimated_start_date`, `estimated_duration_days`, etc.) ship in Phase 3.5+ so data accumulates passively before the surfaces exist (canonical §1.3 Pillar 3). **Status:** future.

### Wave 3 — Communication
Email intake (`accounting@rossbuilt.com` parser), weekly owner updates, in-app + email notifications, client / owner portal. **Status:** notifications partially shipped; rest future.

### Wave 4 — Intelligence
Reports, analytics, AI insights, schedule intelligence powered by the field data Wave 2 captures. Pillar 3 of the four-pillar moat. **Status:** future.

### Wave 5 — Integrations
Procore (larger-builder handoff), QuickBooks Online (two-way sync of bills, vendors, payments), Bluebeam (plans + markup), Buildertrend (existing CRM bridge — no API today, future Playwright scraper). **Status:** future.

## 8. STAGE STRUCTURE

The build path is divided into stages. Stages are coarser than phases — a stage is a chunk of work bounded by a strategic checkpoint with Jake.

- **Stage 0 — Build-system setup.** ✅ DONE 2026-04-29. GSD installed, Superpowers tooling pulled, custom Nightwork skills/agents/commands/hooks built, Vercel posture established, baseline security headers shipped, anti-drift mechanisms (this document, the strengthened session-start hook, the anti-drift skill) installed.
- **Stage 1 — Vision + Audit.** Drummond P-drive scan, end-to-end review of the existing surfaces, vision-pass on the canonical mission. Output: a written vision doc + a list of audit findings.
- **Stage 1.5 — Design + test infrastructure** (sub-stages):
  - **1.5a Design system documents** — `PHILOSOPHY.md`, `SYSTEM.md`, `COMPONENTS.md`, `PATTERNS.md` under `.planning/design/`.
  - **1.5b Prototype gallery** built on Drummond data. **Strategic Checkpoint #2** — Jake reviews and approves before any production code follows.
  - **1.5c Real data + test infrastructure** — fixture loaders, end-to-end harness, Drummond seed data flow into automated runs.
- **Stage 2 — Foundations F1–F4.** The four foundation phases that the canonical §4 architecture rules require but Wave 1 partially elided. Specific F1–F4 scope is defined at Stage 1 close. **Strategic Checkpoint #3** at end of Stage 2.
- **Stage 3 — Wave 1 deployment:**
  - **3a — Wave 1 mini.** Invoice approval + basic draws end-to-end on Drummond. **Strategic Checkpoint #4.**
  - **3b — Wave 1 full.** Full Wave 1 surface (budgets, POs, COs, lien releases, price intelligence) on Drummond.
- **Stage 4+ — Remaining waves.** Wave 2 → Wave 3 → Wave 4 → Wave 5 in order, each with its own checkpoints.

**Strategic Checkpoint #1** is the close of Stage 1 (vision + audit). Three more checkpoints land at Stage 1.5b, end of Stage 2, and Stage 3a.

## 9. CURRENT POSITION

- **Current stage:** Stage 1 + Stage 1.6 complete. CP1 closed (16/17 questions autonomously resolved + Jake's strategic answers; 1 non-blocking follow-up).
- **Current phase:** Stage 1.5a (design system documents) is next.
- **Current branch:** `nightwork-build-system-setup`.
- **Last commit on branch:** Stage 1 commits added 2026-04-29 (VISION → CURRENT-STATE → DRUMMOND-FIXTURE-SUMMARY → TARGET → Drummond clarifications → GAP).
- **Production deploy:** `https://nightwork-platform.vercel.app` (alias) backed by `dpl_pkesin29g` 2026-04-29 — healthy, CSP live with `worker-src 'self' blob:` for PDF.js, `frame-ancestors 'none'`, all required upstreams allowed.
- **Last QA verdict:** WARNING (post-fix) — 0 BLOCKING / 0 CRITICAL / 0 HIGH / 3 MEDIUM (deferred) / 2 LOW (deferred) / 4 NOTE (deferred). Report: `.planning/qa-runs/2026-04-29-1020-qa-report.md`. Stage 1 is documentation-only; no QA run required.
- **Stage 1 deliverables (committed):**
  - ✅ `.planning/architecture/VISION.md` — full construction OS target across all 5 waves
  - ✅ `.planning/architecture/CURRENT-STATE.md` — comprehensive diagnostic with 8 headline findings
  - ✅ `.planning/architecture/DRUMMOND-FIXTURE-SUMMARY.md` — sanitized count-only summary committed; raw fixtures gitignored
  - ✅ `.planning/architecture/TARGET.md` — ideal architecture with selective wipe-and-reseed migration strategy
  - ✅ `.planning/architecture/GAP.md` — F1-F4 foundation phase sequence (F0 absorbed per D-035) with falsifiable acceptance criteria
  - ✅ `.planning/architecture/CP1-RESOLUTIONS.md` — 17 questions resolved (16 fully + 1 non-blocking Jake follow-up)
- **Stage 1.6 deliverables (committed):**
  - ✅ `.claude/agents/nightwork-requirements-expander.md` — opinionated stated-scope-to-full-requirements agent
  - ✅ `.claude/commands/nightwork-auto-setup.md` — AUTO/MANUAL infra orchestrator
  - ✅ `.claude/skills/nightwork-preflight/SKILL.md` — 10-check execute gate
  - ✅ `.claude/commands/nightwork-init-phase.md` — phase entry point: stated → expanded → setup
  - ✅ `.claude/commands/np.md` — plan wrapper with EXPANDED-SCOPE awareness
  - ✅ `.claude/commands/nx.md` — execute wrapper with preflight + QA gates
- **One non-blocking follow-up for Jake (CP1-RESOLUTIONS A1 sub-question):** Has Diane customized QB Desktop's chart of accounts heavily, or is it mostly stock? A=stock (NAHB only), B=customized (export IIF + use as `org_gl_codes` overlay). Default to A; can be answered when convenient.
- **Open MEDIUM/LOW/NOTE findings:** all deferred and tracked in §11. None blocking foundation F1-F4.

## 10. DECISIONS LOG

Major decisions made during planning. Each entry is point-in-time; do not retroactively rewrite. New decisions get a new ID.

| ID | Date | Decision | Rationale |
|----|------|----------|-----------|
| **D-001** | 2026-04 | Build vs rebuild — keep existing code, layer foundations and waves on top | Existing Wave 1 work is real and shipped; rebuild cost > refactor cost; foundation refactors stay tractable while pre-launch (D-007) |
| **D-002** | 2026-04 | Tooling — Claude Code + GSD + Superpowers + ECC surgical pulls + custom Nightwork skills/agents/commands/hooks | GSD provides the phase orchestrator, Superpowers provides discipline skills, ECC provides specialist agents, custom Nightwork enforces domain rules |
| **D-003** | 2026-04 | No Cursor IDE — Claude Code in cmd terminal sufficient | Single-source-of-truth tool; reduces context fragmentation across editors |
| **D-004** | 2026-04 | Multi-tenant from day one with Ross Built as Tenant 1 | Architecture cost is paid once; retrofitting RLS later is the catastrophic version |
| **D-005** | 2026-04 | Drummond as reference job for fixtures and tests | One reference job means one truth; matches canonical R.21 |
| **D-006** | 2026-04 | Phased deployment via Waves (1 financial → 2 ops → 3 comms → 4 intelligence → 5 integrations) | Each wave produces structured data the next consumes; intelligence is impossible without ops data |
| **D-007** | 2026-04 | Pre-launch + test-data-only allows aggressive foundation refactors | No tenant data exists in production yet; no migration risk during foundation work |
| **D-008** | 2026-04 | Data portability is first-class (every entity exportable / importable, idempotent imports, audit-logged both sides, imports as workflow triggers) | Customers need their data back; auditors need import provenance; cross-tenant migrations need a clean contract |
| **D-009** | 2026-04 | Design system before features — Stage 1.5a documents → 1.5b prototype gallery → 1.5c test infrastructure | Surface-design drift is the #1 source of UI rework; locking the system early pays compound interest |
| **D-010** | 2026-04 | Vercel preview URLs are the QA target (not localhost) | "Works on my machine" is not the production runtime; preview URL exercises actual env var resolution + edge config |
| **D-011** | 2026-04 | Wrappers `/np` `/nx` `/ns` chain GSD + Nightwork orchestrators | GSD doesn't natively read `post_plan_hooks` etc.; wrappers chain `/gsd-plan-phase` + `/nightwork-plan-review`, `/gsd-execute-phase` + `/nightwork-qa`, `/gsd-ship` + `/nightwork-end-to-end-test` |
| **D-012** | 2026-04 | Strategic checkpoints with Jake at 4 specific points (CP1 vision close, CP2 prototype gallery, CP3 foundations close, CP4 Wave 1 mini) | Coarse-grained human review at high-leverage moments; avoids checkpoint fatigue |
| **D-013** | 2026-04 | GitHub auto-deploy preview on every PR (`vercel.json` `github.autoAlias: true`) | Every branch push surfaces a live URL for review |
| **D-014** | 2026-04 | AgentShield baseline scan — 3 critical findings are false positives, deferred | The flagged patterns are guarded elsewhere; full re-audit on Stage 1 close |
| **D-015** | 2026-04-29 | Anti-drift mechanisms via MASTER-PLAN.md + strengthened session-start hook + `nightwork-anti-drift` skill | Files were scattered across `.planning/`; no single doc captured the full picture; no hook guaranteed Claude Code read it; this triple closes that gap |
| **D-016** | 2026-04-29 | Gitignore carve-outs added so build system + canonical planning docs sync via git. Transient outputs (`qa-runs`, `plan-reviews`, `drift-checks`, `e2e-runs`, `design-checks`, `custodian-runs`, `propagate`) and sensitive fixtures (`fixtures/`, `audits/`) remain local-only. | Resolves the meta-drift identified in nwrp4 final report — the anti-drift system itself was PC-local. Also fixed a false-positive in `nightwork-pre-commit.sh` that matched "BLOCKING" anywhere on the verdict line; now extracts only the leading bolded verdict token. |
| **D-017** | 2026-04-29 | Stage 1 (Vision + Audit + Drummond fixture pull) complete. 4 architecture documents committed at `.planning/architecture/{VISION,CURRENT-STATE,DRUMMOND-FIXTURE-SUMMARY,TARGET,GAP}.md`. Drummond fixture pull from 3 sources (P-drive 408 files / Supabase 25 JSON exports of synthetic-stub data / Downloads 163 Tier-1+2 files) confirmed the data-ingestion gap as concrete: Supabase Drummond record uses synthetic placeholder data; real Drummond financial history (5 historical pay apps, 1 lien-release batch, recent budget XLSX, T&M and lump-sum reference invoices) exists only in P-drive folders + Downloads files. VISION introduced V.1 universal entity envelope, V.2 universal export/import contract, V.3 universal document provenance. TARGET recommends selective wipe-and-reseed (cost codes + dead `change_order_budget_lines`) with incremental migration elsewhere. GAP proposes F0 prep + F1 entity model + F2 workflow framework + F3 platform primitives + F4 refactor sequence (~31-44 days total). 8 architectural decisions and 13 assumptions flagged for Strategic Checkpoint #1 disposition. | The Stage 1 audit surfaced 4 CRITICAL gaps (no background jobs, no D-008 import/export framework, rate limiting absent, dashboard 503 from RLS policy-stack overhead — not missing indexes), 9 HIGH gaps, and 17 MEDIUM/LOW. Foundation sequence is locked-in pending CP1 confirmation; sequence-rationale documented in GAP §B. Drummond Supabase address+client_name confirmed synthetic per Jake mid-Stage-1; real homeowner data intentionally not committed. |
| **D-018** | 2026-04-29 | Stage 1.6 — Requirements Expansion + Auto-Setup + Pre-Flight system. Every phase from F1 onward begins with `/nightwork-init-phase` (captures Jake's stated scope verbatim → invokes `nightwork-requirements-expander` agent → produces approved EXPANDED-SCOPE.md → invokes `/nightwork-auto-setup` → AUTO infra items execute, MANUAL items get a precise checklist for Jake → SETUP-COMPLETE.md). Then `/np` plans (with EXPANDED-SCOPE as input context). Then `/nx` runs `nightwork-preflight` skill (10 checks) before execute, then `/nightwork-qa` after. | Reduces zero-day rework from un-thought-of requirements. Each component lives at `.claude/{agents,commands,skills}/nightwork-*`. The contract: every phase has an APPROVED EXPANDED-SCOPE before plan, a passing SETUP-COMPLETE before execute, and a PASSING preflight before any gsd-execute-phase. Override is logged and surfaced at QA. |
| **D-019** | 2026-04-29 | F1 seeds `canonical_gl_codes` table with NAHB Chart of Accounts (~400 line items, mirrors migration 00082 `canonical_cost_codes` pattern). Adds `org_gl_codes` per-tenant override table. `gl_code_id` FK columns added (NULLABLE day-1) to `cost_codes`, `org_cost_codes`, `invoices`. (Resolves CP1 A1.) | Industry standard for residential builders; NAHB outperforms QB Desktop default Contractor chart for builders Ross Built's size. Nullable until QBO sync wave (Phase 4) avoids onboarding friction with no Wave 1 business value. One follow-up question for Jake about CoA customization extent in QB Desktop — does NOT block F1 start. |
| **D-020** | 2026-04-29 | F1 wipes legacy `cost_codes` table, re-seeds `org_cost_codes` for Ross Built from Drummond fixtures (`Drummond - Line Items Cost Coded.pdf` + `BUDGET_TEMPLATE.md`). Maps `canonical_code_id` to NAHB level-3 spine where obvious. (Resolves CP1 A2.) | No production data to preserve — current `org_cost_codes` (12 rows) is synthetic test data; real Ross Built codes are only in legacy `cost_codes`. Drummond fixture re-derivation is clean. |
| **D-021** | 2026-04-29 | F1 (absorbing prior F0 prep — see D-035) drops `change_order_budget_lines` table. (Resolves CP1 A3.) | Verified: 0 rows, 0 src/ consumers (grep). Superseded by `change_order_lines`. `.down.sql` paired for emergency rollback. |
| **D-022** | 2026-04-29 | F3 background-job framework: Inngest Cloud (managed offering) as primary; pg_cron complementary for periodic maintenance. Free tier sufficient for first 10 orgs; pay tier flips at first paid GA. Self-host fallback documented for compliance edge cases. (Resolves CP1 A4.) | Single managed-cloud-service-among-others (already using Vercel + Supabase + Anthropic + Stripe + Resend cloud-managed) — no compliance restriction. |
| **D-023** | 2026-04-29 | F2 before F3 sequence confirmed. (Resolves CP1 A5.) | `transitionEntity` (F2) is the canonical activity_log writer; F3's `withAuditWrap` middleware piggybacks. Approval framework (F2) is referenced by background jobs (F3 — notify-step-approvers fan-out is the natural first Inngest function). Reverse order doubles audit-log middleware work and rebuilds approval-fan-out twice. |
| **D-024** | 2026-04-29 | F2 wires `approval_chains` for invoice flow first (highest volume = fastest learning). CO follows as second consumer. Then propagates to draw, PO, proposal. (Resolves CP1 A6 — Jake's strategic answer.) | Invoice volume + existing PM/QA flow shape the framework's contract; CO/draw/PO/proposal inherit. |
| **D-025** | 2026-04-29 | F4 includes Drummond historical back-import via V.2 portability framework as the dogfood pass — 5 pay apps (XLSX + PDF), Nov-2025 lien-release set, recent budget XLSX get parsed and ingested into Stage-1.6-cleaned schema. (Resolves CP1 A7 — Jake's strategic answer.) | Validates V.2 framework on real-shape data; closes data-ingestion gap concretely (CURRENT-STATE §F.4); gives Wave 1.1 polish work real Drummond data to exercise. |
| **D-026** | 2026-04-29 | Strategic Checkpoint #3 falls between F4 and Wave 1, per D-012's "foundations close" milestone. (Resolves CP1 A8.) | D-012 enumerates 4 strategic checkpoints; CP3 = foundations close = post-F4. |
| **D-027** | 2026-04-29 | UCM (Unified Commitment Model) — concept retained, brand name softened to working label. Going forward, references read "Commitment Schema Consolidation (working title: UCM)" until canonical Q3 locks the design. F1-F4 impact: zero. (Resolves CP1 A9.) | UCM origin traced to canonical-plan v1 commit `d5222a5` 2026-04-28 (Claude-coined during consolidation). Underlying architectural problem (cost-code dual registry, status_history JSONB no enforcement, target_entity_id bare UUID, status enum drift) is real and audit-supported. Brand name is ad-hoc but concept is sound. Keep §6 as architectural target; soften branding pending Q3 lock. |
| **D-028** | 2026-04-29 | Reconciliation surface (canonical Q1) lands as its own phase post-Phase-3.9 (after constituent extractors land). VISION.md A10 position confirmed. (Resolves CP1 A10.) | Per-transition reconciliation is implicit in Phases 3.6/3.7/3.9; cross-entity drift detection surface is post-foundation. |
| **D-029** | 2026-04-29 | Substitution-map approach for fixture sharing is sufficient. Workflow: when fixtures first need to be shared cross-org (likely first paid customer pilot), explicit migration step creates `.planning/fixtures/drummond/SUBSTITUTION-MAP.md` (gitignored), runs sed-style replacement on all fixture text, commits sanitized variant to a separate fixture share repo. Until then, all fixtures stay local. Real customer data NEVER committed to git. (Resolves CP1 A11.) | Per Jake mid-Stage-1 clarification + D-007 + D-008. |
| **D-030** | 2026-04-29 | F3 estimate stands at 10-14 calendar days. Mid-phase checkpoint with Jake at 7-day mark to scope-cut if needed. RLS policy-stack collapse routes through `/nightwork-propagate` per its multi-table blast-radius nature. (Resolves CP1 A12.) | Twelve sub-tasks, four cross-cutting ~2-3 days each when done well; estimate has slack absorbed for review/checkpoint loops. |
| **D-031** | 2026-04-29 | F4 final acceptance includes Drummond back-import (resolves CP1 A13 — derives from D-025). | Already in GAP §B F4 acceptance criteria. |
| **D-032** | 2026-04-29 | F1 splits `jobs.address` into `construction_address` (NOT NULL — the build site) + `billing_address` (nullable — defaults to construction_address; populated when distinct, e.g., owner's primary residence or property manager). Onboarding wizard captures both. (Resolves CP1 NQ1 — Jake's strategic answer.) | Drummond example: construction_address="501 74th, Holmes Beach FL"; billing_address typically distinct. Both fields support cost-plus open-book communication and lien-release mailing. |
| **D-033** | 2026-04-29 | F1 promotes `payments` to first-class table with `payment_invoices` junction (supports partial payments + one-payment-multiple-invoices). Existing `invoices.payment_date`/`check_number`/`picked_up` columns kept as legacy compat through F4, dropped in F4. (Resolves CP1 NQ2.) | Required precondition for QBO sync (Wave 5); supports partial-payment scenarios from day-1. |
| **D-034** | 2026-04-29 | Four-table invoice-line-shape (`invoice_line_items`, `invoice_allocations`, `document_extraction_lines`, `line_cost_components`) is documented and lived-with for now. F1 adds explicit canonical documentation in `docs/nightwork-plan-canonical-v1.md` §5.6 + a `v_invoice_lines_full` view for unified queries. UCM (canonical Q3) consolidates later. (Resolves CP1 NQ3.) | F1 consolidating would be wasted work re-done by UCM. Document-and-live-with is lower-risk. |
| **D-035** | 2026-04-29 | F0 prep absorbed into F1. F1 first-day tasks: drop `change_order_budget_lines`, add `lien_releases.status_history`, fix docx-html auth, decide `budgets` table fate. F1 estimate becomes 6-8 days (was 5-7 + 1). (Resolves CP1 NQ4 — Jake's strategic answer.) | F0 was 1 day of cleanup tightly coupled to F1; separate phase added orchestration overhead with no benefit. |
| **D-036** | 2026-04-29 | Stage 1.5b prototype gallery scope grows by one prototype: a reconciliation-surface mock-up (alongside invoice review, draw assembly, budget dashboard, CO log, lien-release flow, settings, owner portal stub). Throwaway HTML on Drummond data; goal is design vocabulary, not commitment. Strategic Checkpoint #2 reviews the gallery including this addition. (Resolves CP1 NQ5.) | Reconciliation surface is the most architecturally novel UI Nightwork ships; design vocabulary should develop in parallel with extractor work. |

## 11. TECH DEBT REGISTRY

Known issues, deferred deliberately. Each entry: severity, source (where it was first identified), remediation cost, trigger condition.

| Item | Severity | Source | Remediation |
|------|----------|--------|-------------|
| `vercel.json` X-Frame-Options should be `DENY` (currently `SAMEORIGIN`) | MEDIUM | QA 2026-04-29-1012 M1 | Set to `DENY`. Largely redundant with CSP `frame-ancestors 'none'` already in place; tighten anyway for legacy-browser coverage. |
| Permissions-Policy is incomplete (camera/mic/geolocation locked, but not payment / usb / fullscreen / clipboard-read) | MEDIUM | QA 2026-04-29-1012 M2 | Add `payment=(), usb=(), fullscreen=(self), clipboard-read=()`. `payment=()` is the relevant Stripe-adjacent surface. |
| Missing `Cross-Origin-Opener-Policy` | MEDIUM | QA 2026-04-29-1012 M3 | Add `Cross-Origin-Opener-Policy: same-origin-allow-popups` (Stripe-redirect compatible). Track COEP `require-corp` separately — every third-party resource must set CORP first. |
| CSP allows `'unsafe-inline'` in `script-src` and `style-src` | LOW (functional, not severity-bumped) | Inherent to Next.js 14 without nonces | Migrate to nonce-based CSP via Next.js middleware before launch. Removes the largest XSS-mitigation gap remaining. |
| `script-src` includes `https://*.stripe.com` wildcard where `https://js.stripe.com` would suffice | LOW | QA 2026-04-29-1020 N7 | Tighten in the same hardening pass that addresses the MEDIUMs. |
| HSTS `preload` directive is a no-op until domain is submitted to hstspreload.org | LOW | QA 2026-04-29-1012 L1 | Submit `nightwork-platform.vercel.app` (or future custom domain) to hstspreload.org, or drop `preload` directive. |
| `STRIPE_WEBHOOK_SECRET=whsec_placeholder` in both Vercel envs | FUNCTIONAL — blocks payment activation | nwrp2 QA setup-flag | Replace with real value from Stripe Dashboard webhook endpoint when subscription / billing flow is activated (Wave 1 billing). |
| `RESEND_API_KEY=re_placeholder` in both Vercel envs | FUNCTIONAL — blocks email send | nwrp2 QA setup-flag | Real Resend account + verified sending domain when notifications flow is activated (Wave 1 notifications). |
| `STRIPE_PRICE_STARTER` / `_PROFESSIONAL` / `_ENTERPRISE` empty in `.env.local` | FUNCTIONAL — blocks pricing-tier UI | nwrp2 QA setup-flag | Populate after Stripe products exist; `vercel env add` for both envs. |
| Phase 3.4 polish items (dropdown optgroup labels, `extracted_data` cache, UI alignment to invoice review) | LOW (work-in-progress stash) | Memory `project_phase3_4_polish_dropdown_labels` + `project_phase3_4_pr26_merge_blockers` | Recover when relevant; not blocking Stage 1. |
| GSD doesn't natively read `post_plan_hooks` etc. — wrappers `/np` `/nx` `/ns` are the workaround | LOW (architectural) | D-011 | Track upstream GSD; if/when first-class support lands, retire the wrappers. |
| Embedding-on-create wiring gap (Pillar 2 cost intelligence) | MEDIUM (named blocker for Pillar 2) | Canonical §12 | Address before any Pillar 2 work ships. |
| Dashboard 503s on aggregations | MEDIUM (architectural smell) | Canonical §4 | Every new aggregation query needs an index plan in the same migration; older aggregations need retroactive index audits. |
| ~~`.planning/` is gitignored — planning artifacts are PC-local only~~ | RESOLVED 2026-04-29 (D-016) | nwrp2 final report → nwrp5 carve-outs | Resolved by precise gitignore carve-outs: canonical docs (`MASTER-PLAN.md`, `PROJECT.md`, `ROADMAP.md`, `REQUIREMENTS.md`, `STATE.md`, `deployment.md`, `config.json`, `lessons.md`, `architecture/`, `milestones/`) and Nightwork build system (`nightwork-*` skills/agents/commands/hooks + `settings.json`) now sync via git. Transient and sensitive content stays local. |
| `nwrp1.txt` referenced in ROADMAP / STATE / PROJECT but not committed | NOTE | Custodian baseline 2026-04-29 | Commit when `nightwork-build-system-setup` branch merges. |
| Agent registry doesn't pick up newly-created `.claude/agents/*.md` files until session restart — `/nightwork-init-phase` (D-018) requires `nightwork-requirements-expander` agent which was created in the same session and was therefore not Task-tool-invocable on first use | LOW (one-time per session) | Discovered 2026-04-29 during Stage 1.5a init-phase invocation. Workaround: inline execution of the expander algorithm in main context (artifact quality unchanged). | Long-term: either (a) document the session-restart requirement in `/nightwork-init-phase`'s preamble, or (b) detect missing agent + fall back to inline execution automatically. Once the agent IS registered (post-restart), this never bites again. |
| Per-user dark-mode preference persistence (vs current per-device cookie) | LOW (Wave 3+ store) | Stage 1.5a plan-review iteration 1 enterprise-readiness M-E1 deferred. Current `nw_theme` cookie is per-device. | Add `user_settings.theme_mode` enum column when Wave 3 user-settings entity ships. SYSTEM.md notes this limitation explicitly. |
| platform_admin role-revocation refresh on open `/design-system` page | LOW (acceptable posture) | Stage 1.5a plan-review iteration 1 enterprise-readiness M-E2 deferred. If admin revoked while page open, middleware blocks next nav but open page renders. Acceptable for design docs (no PII, no mutations). | No change planned. Documented in SYSTEM.md as known posture. |
| Side-by-Side Compare pattern (proposal-vs-contract, budget-vs-draw) + Timeline/Gantt pattern (Wave 2 schedules) — NOT in Stage 1.5a PATTERNS.md | LOW (scoped elsewhere) | Stage 1.5a plan-review iteration 1 architect M-A5 deferred. | Side-by-Side Compare lands in Wave 1.1 polish work; Timeline/Gantt lands in Wave 2 schedules phase. PATTERNS.md picks them up there. |
| 49 pre-existing typecheck errors in `__tests__/*.test.ts` files using regex `/d` flag (ES2018+ feature) — error TS1501 "regular expression flag is only available when targeting 'es2018' or later" | LOW (test-only, blocks `nightwork-stop.sh`) | Surfaced 2026-04-29 during Stage 1.5a Wave 1+T07 by stop hook; not caused by 1.5a. Files: `pricing-history.test.ts`, `proposals-schema.test.ts`, `approval-chains.test.ts`, `co-type-expansion.test.ts`, `cost-codes-hierarchy.test.ts`, `draw-adjustments.test.ts`, `job-milestones-pm-write-narrowing.test.ts`, `milestones-retainage.test.ts`. | Bump tsconfig.json `compilerOptions.target` from current ES2017/older to ES2018+. Should be done in its own cleanup phase (separate from 1.5a) so the diff is reviewable. Log NIGHTWORK_STOP_HOOK_DISABLE=1 workaround if needed mid-1.5a but real fix is the tsconfig bump. |
| **1.5a-followup-1**: `rgba()` opacity tints across 7 design-system pages map to canonical Slate tokens by numeric coincidence (post-edit hook only catches `#hex` literals, not raw `rgba()` values) — ~30 sites across `forbidden`, `patterns`, `philosophy`, `palette`, `components/{data-display, inputs, feedback}` pages | MEDIUM (cosmetic drift, not a runtime defect) | Stage 1.5a Wave D QA verdict 2026-04-30 MEDIUM-1 finding (`.planning/phases/stage-1.5a-design-system-documents/artifacts/QA-verdict.md`) | Standardize via `color-mix(in srgb, var(--nw-token), transparent N%)` OR introduce new `--nw-tint-*` tokens for the common opacity bands (e.g. `--nw-tint-danger-06`, `--nw-tint-stone-06`). Defer to a polish phase before 1.5b ships. Hook extension to catch raw `rgba()` is a separate consideration. |

## 12. NEXT PLANNED WORK

Updated continuously by `nightwork-custodian` after each `/gsd-ship`. Order is a soft default — Jake adjusts at strategic checkpoints.

**Immediate (this session, before Stage 1):**
- ✅ Address HIGH CSP finding (resolved 2026-04-29).
- ✅ Fix `NEXT_PUBLIC_APP_URL` (resolved 2026-04-29).
- ✅ Establish anti-drift (MASTER-PLAN.md + session-start hook + anti-drift skill — this session).

**Stage 1 — Vision + Audit (COMPLETE 2026-04-29):**
- ✅ Drummond P-drive scan — 408 files / 1.06 GB across 17 categories inventoried.
- ✅ Drummond Supabase pull — 25 table JSONs exported; revealed Supabase Drummond record is synthetic placeholder data, not real.
- ✅ Drummond Downloads filename hunt — 163 Tier-1+2 files (~160 MB) including 5 historical pay apps, 1 lien-release batch, recent budget, T&M + lump-sum reference invoices.
- ✅ VISION.md — full construction OS target across all 5 waves, 40 entities, V.1/V.2/V.3 architectural principles added on top of canonical R.1-R.23.
- ✅ CURRENT-STATE.md — entity coherence (16 COMPLETE / 9 PARTIAL / 5 COEXISTING / 12 MISSING / 4 AMBIGUOUS), workflow consistency, platform primitives (4 CRITICAL gaps), code health, dashboard 503 root cause (RLS policy-stack overhead), ingestion gap.
- ✅ DRUMMOND-FIXTURE-SUMMARY.md — sanitized count-only summary committed.
- ✅ TARGET.md — ideal architecture with selective wipe-and-reseed migration strategy.
- ✅ GAP.md — F1-F4 foundation phase sequence (F0 absorbed per D-035) with falsifiable acceptance criteria; ~30-43 calendar days.

**Strategic Checkpoint #1 (CLOSED 2026-04-29):**
- ✅ 17 questions resolved (16 fully, 1 non-blocking follow-up). Resolutions logged at `.planning/architecture/CP1-RESOLUTIONS.md` and DECISIONS LOG D-019 through D-036.

**Stage 1.6 — Requirements Expansion + Auto-Setup + Pre-Flight (COMPLETE 2026-04-29):**
- ✅ `nightwork-requirements-expander` agent — translates Jake's stated scope to comprehensive requirements
- ✅ `/nightwork-auto-setup` command — AUTO infra items + MANUAL checklist for Jake
- ✅ `nightwork-preflight` skill — 10-check execute gate
- ✅ `/nightwork-init-phase` command — phase entry point
- ✅ `/np` and `/nx` wrappers — chain GSD orchestrators with Nightwork gates
- ✅ Demo on Wave 1.1 (`.planning/expansions/wave-1.1-invoice-approval-EXPANDED-SCOPE.md`).

**Stage 1.5a — Design system documents (next):**
- `.planning/design/PHILOSOPHY.md`, `SYSTEM.md`, `COMPONENTS.md`, `PATTERNS.md`.

**Stage 1.5b — Prototype gallery (Strategic Checkpoint #2):**
- Throwaway HTML prototypes built on Drummond data covering: invoice review, draw assembly, budget dashboard, CO log, lien-release flow, settings, owner portal stub.

**Stage 1.5c — Real data + test infrastructure:**
- Drummond fixture loader, end-to-end Playwright harness, automated `/nightwork-end-to-end-test` runs in CI.

**Stage 2 — Foundations F1–F4** (Strategic Checkpoint #3 at close):
- Specific scope locked at Stage 1 close.

**Stage 3a — Wave 1 mini (Strategic Checkpoint #4):**
- Invoice approval + basic draws end-to-end on Drummond.

**Stage 3b — Wave 1 full:**
- Full Wave 1 surface (budgets, POs, COs, lien releases, price intelligence).

**Stage 4+ — Wave 2 → 5 in order.**
