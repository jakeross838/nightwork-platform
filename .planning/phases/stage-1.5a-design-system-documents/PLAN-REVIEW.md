# Plan review — stage-1.5a-design-system-documents

**Status:** REVIEWED 2026-04-29
**Verdict:** **NEEDS WORK** — 0 BLOCKING / 7 CRITICAL / 14 HIGH / 29 MEDIUM
**Reviewer set:** 6 agents (architect, planner, multi-tenant-architect, design-pushback, enterprise-readiness, security-reviewer)
**Skipped:** scalability (no queries / no aggregations / docs-only), compliance (no PII / no schema / no audit-log changes)

---

## Verdict matrix

| Reviewer | Verdict | Critical | High | Medium |
|---|---|---:|---:|---:|
| architect | NEEDS WORK | 0 | 4 | 6 |
| planner | NEEDS WORK | 4 | 0 | 5 |
| multi-tenant-architect | NEEDS WORK | 3 | 2 | 4 |
| design-pushback | NEEDS WORK | 0 | 3 | 4 |
| enterprise-readiness | NEEDS WORK | 0 | 2 | 6 |
| security-reviewer | NEEDS WORK | 0 | 3 | 4 |
| **TOTAL** | **NEEDS WORK** | **7** | **14** | **29** |

**Net assessment:** Plan is directionally sound — 6/6 reviewers say "NEEDS WORK" not "BLOCKING." Findings are correctable via targeted SPEC + PLAN amendments. None require re-architecting the phase.

---

## Critical findings (7)

These would force mid-execute rework if not addressed first.

### CR1 — Middleware-level gating, not layout-only (multi-tenant + security)

**From:** multi-tenant-architect (CRITICAL), security-reviewer (HIGH)
**Issue:** PLAN T18 implements `/design-system` gating at the layout-level only. `src/middleware.ts` is not edited. Any future contributor adding a child route, layout group, parallel route, or intercepting route bypasses the gate silently.

**Mitigation required:** Add a new task **T18.5 — middleware edit**: Edit `src/middleware.ts` to match `pathname.startsWith('/design-system')` and unconditionally enforce `isPlatformAdmin` in production (mirror of `/admin/platform` lines 65–79). Layout-level check stays as defense-in-depth, not the wall. Update SPEC B7 to require middleware enforcement explicitly. Use `NextResponse.rewrite(url_to_404)` not `NextResponse.redirect('/dashboard')` per D3's "404 not 403" principle.

### CR2 — Sample-data isolation needs teeth (multi-tenant)

**From:** multi-tenant-architect (CRITICAL)
**Issue:** SPEC D7 says "Drummond data does NOT appear in /design-system" but enforcement is documentation-only. A future contributor reaching for "real-looking" sample data could pull from `getCurrentMembership()` or hardcode a Drummond org_id.

**Mitigation required:** New acceptance criterion **D9 — sample-data isolation**: No file under `src/app/design-system/` imports from `@/lib/supabase/*`, `@/lib/org/session`, `@/lib/org/branding`, or any module returning tenant-scoped data. All sample data is constants in `src/app/design-system/_fixtures/`. Add a hook check (extension to T10) that rejects such imports at edit time.

### CR3 — A11 brand-customization delivery contract undefined (multi-tenant + architect + enterprise + security)

**From:** multi-tenant-architect (CRITICAL), architect (HIGH), enterprise-readiness (HIGH), security-reviewer (Medium)
**Issue:** SPEC A11 reserves `--brand-accent` + `--brand-logo` as tenant-overrideable but the delivery vector is undefined. Risks: CSS injection if interpolated into `<style>` tag; cross-org cache pollution if response cached without `Cache-Control: private`; XSS from SVG logo with inline `<script>`.

**Mitigation required:** Lock A11 delivery contract:
- Override read site: `getOrgBranding()` server-only, never client-derivable
- Injection method: `document.documentElement.style.setProperty('--brand-accent', value)` only — NEVER `<style>` tag concatenation
- Validation: hex regex `/^#[0-9A-Fa-f]{6}$/` before injection
- Cache: any tenant-branded response sets `Cache-Control: private, no-store`
- `--brand-logo` storage: Supabase Storage at `branding/{org_id}/logo.{ext}`, allow-list `image/png` + `image/jpeg` + `image/webp` only (NO SVG), max 512KB, write requires owner/admin role, audit-logged via `branding.logo_updated`
- Logo rendered as `<img loading="lazy">` with no SVG-script execution risk

### CR4 — Acceptance criteria orphans (planner)

**From:** planner (CRITICAL)
**Issue:** Several SPEC.md criteria have no producing PLAN.md task:
- **A2** Forbidden quantification with thresholds — T17 produces the list but no task lifts thresholds into SYSTEM.md
- **C1** Specific package list (`class-variance-authority`, `tailwind-merge` absent from T08/T09 description; usually shadcn init installs them but verify)
- **E4** "Strategic Checkpoint #2 — pick a direction" affordance — no task produces this UI element
- **E5** PHILOSOPHY.md "Locked direction" section (initially blank, populated post-CP2) — not in T17's description

**Mitigation required:** Either expand existing tasks with explicit sub-bullets, or add 4 new sub-tasks to cover. Likely T12 absorbs A2; T07 confirms C1; T24 adds E4 affordance; T17 adds E5 placeholder section.

### CR5 — T17 PHILOSOPHY draft underestimated 4h → 6-8h (planner)

**From:** planner (CRITICAL)
**Issue:** Per Jake's hard requirement, each direction needs distinct name + thesis + would/wouldn't lists + Forbidden-anchored + reference benchmarks + **9 concrete invoice-review/dashboard/mobile-approval comparisons across 3 directions** = serious content-load. 4h is light.

**Mitigation required:** Bump T17 to 6h, OR split into T17a (3 directions thesis + would/wouldn't) and T17b (9 concrete screen comparisons). Also update PLAN §4 calendar estimate.

### CR6 — T20 dynamic component sub-pages underestimated 4h → 8-10h (planner)

**From:** planner (CRITICAL)
**Issue:** SPEC B2 requires per-component: variants + 6 states + token bindings + sample data + ARIA notes + anti-pattern examples. With ~24 components from A12, that's 4h ÷ 24 = 10 minutes per sub-page. RP8 acknowledges via scope-cut fallback but the fallback undercuts SPEC B2.

**Mitigation required:** Either bump T20 to 8-10h (realistic), OR explicitly amend B2 to "5 critical sub-pages + index lists remainder with shorthand cards." Pick one path; don't both budget unrealistically AND defer in risk register.

### CR7 — Hidden serial dependencies in PLAN.md §3 graph (architect + planner)

**From:** architect (HIGH), planner (HIGH)
**Issue:** PLAN.md §3 claims Wave 3 (T12-T17) is parallel after Wave 1-2. False:
- T13 depends on T08 (shadcn primitives installed) — serial after Wave 2
- T14 (PATTERNS.md) implicitly depends on T01-T03 audits (token bindings)
- T15 explicitly serial after T12
- T16 serial after T12+T13+T14

**Real critical path:** T07 → T08 → T13 → T20 → T29-T36 (not T01-T03 → T12 → T20). The 4-hour T20 estimate plus 2-hour T32 is the realistic gate.

**Mitigation required:** Update PLAN.md §3 + §4 with corrected graph + critical-path identification.

---

## High findings (14)

### H1 — Brand-tenancy token shape under-specified for Wave 3+ (architect)
PROPAGATION-RULES.md (T15) must specify the override mechanism explicitly. Recommended: SSR-injected `<style>` block scoped to `[data-org="{slug}"]` re-declaring `--brand-accent` only, on the same selector specificity tier as the dark-mode block in `colors_and_type.css:128`.

### H2 — Reconciliation strawman missing rejection criterion (architect)
3 candidates without a "what gets ruled out" axis. Add a 4th implicit option ("hybrid: header-level timeline + line-level inline diff") and an explicit rejection criterion ("won't ship a model requiring horizontal scroll on `nw-tablet`"). Otherwise 1.5b can't falsify a candidate.

### H3 — Missing "Audit Timeline" pattern (architect)
Per V.1 universal envelope + status_history JSONB on every workflow entity, the audit timeline appears on EVERY Wave 1+ surface. PATTERNS.md "Document Review" embeds it but never extracts it. Add Pattern #11: "Audit Timeline" with data-shape contract.

### H4 — Missing patterns for construction-OS (architect)
File Uploader (Wave 1.1 + Wave 2 daily logs); Side-by-Side Compare (proposal-vs-contract — distinct from Reconciliation drift-detection); Timeline/Gantt (Wave 2 schedules). At minimum File Uploader is needed by 1.5b.

### H5 — `--brand-logo` storage path unspecified (multi-tenant + enterprise + security)
SPEC A11 must specify: Supabase Storage at `branding/{org_id}/logo.{ext}`, signed URL scoped to requesting org's membership, file-type allow-list, max 512KB, owner/admin write only, audit-logged. (Also covered in CR3.)

### H6 — Shadcn primitive contagion / "tenant-blind" rule (multi-tenant)
Primitives in `src/components/ui/` MUST NOT accept tenant-identifying props (no `org_id`, no `membership`, no `vendor_id`). Tenant-aware composition lives in `src/components/<domain>/` only. Add to COMPONENTS.md (A12) + PROPAGATION-RULES.md (A19) as a hard rule. Update T10 hook to assert.

### H7 — Forbidden-list enforcement is documentation-only (design-pushback)
A2 quantifies thresholds (`border-radius > 4px`, `cubic-bezier(.x, y > 1.0)`) but no task updates `nightwork-post-edit.sh` to catch them. Add **T10b**: extend hook to grep for `cubic-bezier\([^)]*,[^)]*,\s*[12]\.[0-9]` and `rounded-(lg|xl|2xl|3xl|full)` outside avatar/dot patterns.

### H8 — Dark-mode contrast verification gap (design-pushback)
T03 computes contrast but T33's axe-core runs on rendered pages only — won't catch token combinations not visible in playground. T03 must produce a contrast matrix file (light + dark, every text-token × every bg-token) committed alongside SYSTEM.md as verifiable artifact.

### H9 — Mobile density tradeoff under-specified (design-pushback)
A18 covers touch targets + gesture vocabulary but Jake's "real construction software on mobile, not watered-down" implies density mapping (which right-rail panels collapse, which stay above-the-fold, how status_history is summarized). PATTERNS.md "Mobile Approval" must define this. Otherwise 1.5b mobile prototypes guess.

### H10 — Skill cross-reference is one-way only (design-pushback)
T27 updates 3 existing skills to point at SYSTEM/COMPONENTS/PATTERNS but no task makes new docs cross-reference back. SYSTEM.md must include "Skill anchors" section listing every skill that depends on it; PROPAGATION-RULES.md (T15) must require updating those skills when SYSTEM tokens change.

### H11 — Distinctness validation has no falsifiable test (design-pushback)
Jake's hard rule "if two directions feel similar, the names are wrong" — but neither WHO judges nor WHEN. Add: T17 ends with self-review checklist (3 reference benchmarks differ; density posture differs; motion posture differs; typography weight defaults differ — at least 2 of 4 must vary per pair).

### H12 — axe-core report not archived as artifact (enterprise)
Enterprise customers ask for accessibility audit. T33 runs axe-core but no acceptance criterion that report becomes a phase artifact. Add: axe-core JSON output saved to `.planning/phases/.../artifacts/axe-report.json` with per-component pass/fail.

### H13 — `NEXT_PUBLIC_NW_DESIGN_SYSTEM_ENABLED` env-var inconsistently documented (security)
DISCUSSION D3 concludes "no new env vars" but body still describes env-var path. T18 description repeats "all auth in dev" path. Resolve to: role gate only; in dev developers (Jake/Andrew) already have platform_admin per migration 00048. No env-var bypass — `NEXT_PUBLIC_*` would bake string into client bundle and leak route existence.

### H14 — RP2 (shadcn init breaks Tailwind config) lacks recovery plan (planner)
Mitigation says "T11 catches; revert commit" — but reverting T07 means Jake re-runs interactive shadcn init. No plan for "what if shadcn writes `tailwind.config.cjs` alongside `.ts`" or "what if it overwrites darkMode config." Add explicit pre-T07 backup of `tailwind.config.ts` + `globals.css` + `package.json` and recovery checklist.

---

## Medium / observations (29 condensed)

- **Dark-mode persistence is cookie-only** (T26). `nw_theme` cookie = per-device, not per-user. SYSTEM.md should document the limitation and reserve `user_settings.theme_mode` as future store. (enterprise)
- **No `npm audit` gate** in Wave 2 or Wave 6. Add T11.5 running `npm audit --audit-level=high`. (security)
- **T10 hook update scope** — bouncy-easing not caught (CR7 + H7 overlap).
- **T28 CLAUDE.md update authorization** — narrow to "UI rules section only; do not touch Architecture/Development Rules." (security)
- **T08.5 not in task list** — `nw-phone / nw-tablet / nw-desktop` breakpoint aliases need Tailwind config addition; promote to first-class. (planner)
- **T39 Jake walkthrough** is a Jake-blocking calendar event, not Claude work. Calendar estimate should separate. (planner)
- **T32 visual regression budget** — 2h for 360 screenshots is tight; spot-check approach in RP6. Make it explicit in T32 description. (planner)
- **No task produces evidence for D7** ("No prototypes — Drummond data NOT in /design-system"). Verifier needs a way to confirm. Add to T37 QA checklist or as T35.5. (planner — addressed by CR2)
- **`src/app/design-system/` over Storybook is correct** — flag as forward consideration: re-evaluate Storybook at 40+ components. (architect + enterprise)
- **A2 quantification incomplete** — "border-radius > 4px = oversized" leaves avatars/status-dots unaddressed. SYSTEM.md should say "border-radius > 4px on rectangular elements; `--radius-dot` (999px) on circular only." (architect)
- **Density tokens lack print mapping** — A8 + A17 intersect. SYSTEM.md should declare "print always uses `--density-compact`." (architect)
- **B7 platform_admin gate has no role-revocation refresh path** — acceptable for design docs (no PII, no mutations), but flag as known posture in SYSTEM.md. (enterprise)
- **No `/design-system` access audit-logging** — explicit N/A is fine; note in PROPAGATION-RULES.md so future questions have documented answer. (enterprise)
- **Component sub-page error boundary** not specified. T20 must include `error.tsx` with Sentry tag. (enterprise)
- **Storybook deferral marker** — note in PROPAGATION-RULES.md "if component count exceeds 40, re-evaluate Storybook." (enterprise)
- **D5 strawman cost** — note explicitly that 1.5b picking model 2 or 3 forces non-trivial PATTERNS.md rewrite. Surface as A16 sub-criterion. (design-pushback)
- **`@heroicons/react` install decoupled from usage spec** — T09 + D4 install Heroicons but no task defines icon→use mapping. COMPONENTS.md must include "Iconography" subsection. (design-pushback)
- **shadcn hybrid boundary rule** — PROPAGATION-RULES.md must codify "if shadcn ships an upstream version of an existing custom Nw* component, we do NOT auto-migrate." (architect)

---

## Recommended path forward

**Verdict: NEEDS WORK.** Plan is fundamentally sound; SPEC + PLAN need targeted amendments before execute. None of the 7 CRITICAL findings require re-architecting the phase — all are additions or clarifications.

### Two paths Jake can take

**Path A — Address findings, re-run /np (recommended).**

Update:
1. **SPEC.md** — add D9 (sample-data isolation), CR3 brand-delivery contract, CR4 missing acceptance criteria (A2 quantification, C1 packages, E4 pick-affordance, E5 locked-direction section), H3 audit-timeline pattern, H4 file-uploader pattern, H6 tenant-blind primitives rule, H7 Forbidden-enforcement hook, H8 dark-mode contrast matrix, H9 mobile density mapping, H10 skill anchor section, H11 distinctness checklist, H12 axe-core artifact archival.
2. **PLAN.md** — add T18.5 (middleware edit), T10b (Forbidden hook), T11.5 (npm audit), correct T17 estimate (6-8h), T20 estimate (8-10h or scope-cut), correct §3 graph + §4 critical path, T28 narrow scope.
3. **DISCUSSION.md** — resolve H13 env-var ambiguity (final answer: role gate only).

Estimate: 1-2 hours of doc revisions. Then re-run `/np stage-1.5a-design-system-documents` to re-trigger plan-review on the corrected docs.

**Path B — Override findings and proceed.**

Use `/nx stage-1.5a-design-system-documents --skip-preflight` (NOT recommended — loses the plan-review gate per D-007). The override is logged + surfaced at next QA. Acceptable only if Jake judges the findings are non-blocking in practice (e.g., the brand-customization delivery contract can be re-litigated at Wave 3 when the upload UI ships, not 1.5a).

### Strong recommendation

**Path A.** The CRITICAL findings split into two buckets:
- **Bucket 1 (must address now):** CR1 middleware, CR2 sample-data isolation hook, CR4 orphan acceptance criteria, CR7 graph correction. These are gaps in the plan that create real risk during execute.
- **Bucket 2 (defer is plausible):** CR3 brand-delivery contract (the upload UI is Wave 3+; lock the *contract* in 1.5a but defer the *implementation*). CR5/CR6 estimate corrections (just budget more time, not a quality issue).

Path A handles Bucket 1 cleanly and lets Bucket 2 land as documentation-only commitments in SYSTEM.md to be implemented later.

### What's done well (lifted from reviews)

- Strong falsifiability — A1-E5 are testable; spec-checker can verify mechanically.
- Goal-backward derivation in PLAN.md §5 traces every prerequisite.
- D1=C (shadcn hybrid) avoids both wholesale migration and divergence.
- Reconciliation deferral (D5) avoids premature commitment while seeding the 1.5b decision.
- Token architecture extends existing `colors_and_type.css` Slate semantics without breaking the dark-mode auto-flip.
- T17 (PHILOSOPHY.md) correctly budgeted longest because distinctness is content-load-bearing (though estimate needs CR5 bump).
- Wave 2 sequencing handles Jake-interactive shadcn init correctly.
- RP3 flags Jake-hard-rule risk explicitly with regen path + design-pushback gate.
- Out-of-scope discipline — no drift into NwButton refactor, inline-SVG migration, or prototypes.
- T35 verifies hook enforcement via positive test (attempt violation), not just "we updated the hook."
- A11 token narrowed to `--brand-accent` + `--brand-logo` only — exactly the right multi-tenant posture (Q14 modified-A).
- D7 forbids Drummond data on `/design-system` — scope discipline (though needs CR2 enforcement to be meaningful).
- CLAUDE.md "Calibri" correction (Q2=B + C3) is the single highest-leverage action — resolves a live contradiction.
- Dependency selection (Radix, cmdk, vaul, react-day-picker, TanStack v8, Heroicons) is the de-facto audited shadcn-ecosystem set.

---

## Next

Per `/np` contract: surface to Jake. Jake decides Path A or Path B. The PLAN-REVIEW.md verdict is **NEEDS WORK** — execute is BLOCKED until corrections land or override is explicitly invoked.
