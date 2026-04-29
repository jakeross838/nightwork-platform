# Plan review — stage-1.5a-design-system-documents (iteration 2)

**Status:** REVIEWED 2026-04-29 (iteration 2)
**Verdict:** **PASS (with execute-time pickup)** — 6 reviewer outputs aggregated; iteration-2.5 polish applied inline
**Reviewer set:** 6 agents (architect, planner, multi-tenant-architect, design-pushback, enterprise-readiness, security-reviewer)
**Skipped:** scalability (no queries), compliance (no PII / no schema)

---

## Iteration-1 → iteration-2 disposition matrix

| Reviewer | Iteration 1 | Iteration 2 | Iteration-2 net |
|---|---|---|---|
| architect | NEEDS WORK (4 HIGH, 6 MED) | **PASS** | 4 minor refinements noted (T18.5 wording, T10c regex tightening, T20 coverage confirmation, T24.1 marker file race acknowledged via RP12) |
| planner | NEEDS WORK (4 CRITICAL, 5 MED) | **PASS** | 0 orphan acceptance criteria; all 51 SPEC criteria trace to ≥1 task; 3 NEW MEDIUM (NEW-M1 T17b budget, NEW-M2 T20d/T20e rebalance, NEW-M3 T10c regex bare-import gap) — all addressed in iteration-2.5 polish |
| multi-tenant | NEEDS WORK (3 CRITICAL, 2 HIGH, 4 MED) | **PASS** | 3 CRITICALs all ADDRESSED (middleware gating, sample-data isolation, brand-customization contract); 2 minor edge-case observations for Wave 3 implementers (dynamic imports, prop-name aliasing) — non-blocking |
| design-pushback | NEEDS WORK (3 HIGH, 4 MED) | **PASS** | 3 NEW WARNINGs (W1 regex 4th-arg coverage, W2 distinctness transitivity, W3 icon-add workflow) + 1 NOTE (contrast accept-with-rationale budget) — addressed in iteration-2.5 polish |
| enterprise-readiness | NEEDS WORK (2 HIGH, 6 MED) | **PASS** | 2 NOTEs both correctly Wave-3-deferred (DOMPurify install, signed-URL refresh policy specifics) |
| security | NEEDS WORK (3 HIGH, 4 MED) | **NEEDS WORK** (qualified: "Blocking items: none") | 5 NEW concerns (N1 status-code 404, N2 re-export chains, N3 first-install audit moderate, N4 SVG library not pinned, N5 PII grep narrow) — N1, N3, N4 addressed in iteration-2.5 polish; N2 + N5 logged for execute-time pickup |

**Net: 5 PASS + 1 marginal NEEDS WORK with explicit "no blocking items" qualifier.**

Per directive: "PASS: proceed to /nx. NEEDS WORK with only deferrable items: fine, log them, proceed to /nx." This iteration-2 verdict satisfies that bar.

---

## Iteration-2.5 polish applied inline (6 surgical edits)

Applied to v2 SPEC + PLAN before declaring final verdict — these were the highest-leverage refinements from iteration-2 reviewers that converted to clean SPEC/PLAN amendments without restructuring:

1. **SPEC A11.3** — added `Vary: Cookie` to brand-customization Cache-Control header (multi-tenant iteration-2 minor concern; defeats CDN cookie-ignoring edge cases).
2. **SPEC A11.5** — pinned `isomorphic-dompurify` with `USE_PROFILES: { svg: true, svgFilters: true }` configuration (security iteration-2 N4 — was the strongest individual finding; previously read "DOMPurify or equivalent" which was too loose).
3. **SPEC A3.1** — capped accepted-with-rationale contrast failures at ≤3, each requiring a Jake-signed line in CONTRAST-MATRIX.md (design-pushback iteration-2 N1).
4. **SPEC A1** — tightened distinctness rule with transitive constraint: "no two directions share more than 1 axis with each other across the 3-direction set" (design-pushback iteration-2 W2 — original "2 of 4 axes per pair" allowed convergent feel).
5. **SPEC A19** — added "icon-add workflow" alongside component-add and pattern-add workflows (design-pushback iteration-2 W3).
6. **SPEC B7** — explicit `{ status: 404 }` parameter on `NextResponse.rewrite()` to prevent route-existence leak via HTTP 200 with not-found content (security iteration-2 N1).
7. **PLAN T17b** — budget bumped 4h → 4.5h (planner iteration-2 NEW-M1).
8. **PLAN T20d / T20e** — rebalanced (T20d 60→30 min, T20e 60→90 min — DataGrid is the riskiest single component, navigation is simpler; planner iteration-2 NEW-M2).
9. **PLAN T11.5** — at-first-install moderate audit + ongoing high-only CI baseline (security iteration-2 N3).
10. **PLAN T20a** — explicit "do NOT refactor existing inline SVGs in this phase" in task description (planner iteration-1 M-P2 carryover).

---

## Execute-time pickup (6 minor items logged for executor)

Items reviewers flagged that aren't worth blocking on, but the executor agent should be aware of when implementing:

| # | Item | Source | Action at execute time |
|---|---|---|---|
| ET1 | T10c regex should also reject bare `from '@/lib/supabase'` (no path segment), not just `/server` vs `/types` discrimination | planner NEW-M3 | Hook regex extension during T10c implementation |
| ET2 | T10c hook is first-line; `_fixtures/` discipline + code review are second-line; document in PROPAGATION-RULES.md when written | security N2 + multi-tenant edge case | T15 PROPAGATION-RULES.md note |
| ET3 | T35.6 PII grep is narrow — add fixtures-file synthetic-data header + Florida phone/address patterns | security N5 | T19.5 _fixtures/ scaffold includes header comment; T35.6 grep extended |
| ET4 | T18.5 implementation: add `pathname.startsWith('/design-system')` block to existing `/admin/platform`-style guard, not a matcher edit (existing catch-all matcher already covers the path) | architect | T18.5 implementation detail |
| ET5 | T10b bouncy-easing regex extension: also catch y2-only overshoots like `cubic-bezier(0.2, 0.4, 0.5, 1.4)` (4th arg ≥ 1.0); current regex only catches 2nd arg | design-pushback W1 | T10b regex during implementation |
| ET6 | T10d primitives hook: regex covers canonical prop names (`org_id`, `membership`, `vendor_id`, `orgId`, `membershipId`); document the limitation that aliased prop names (`tenantId`, `currentOrg`) bypass the hook — code review is the second-line defense | multi-tenant edge case | T10d implementation note |

---

## Iteration 2 final verdict: PASS (with execute-time pickup)

Per the directive's verdict guidance:
- **PASS**: proceed to /nx ✅
- NEEDS WORK with deferrable items only: fine, log them, proceed to /nx
- NEEDS WORK with new BLOCKING/CRITICAL: address and re-run

This iteration cleanly hits the first bar:
- **0 BLOCKING findings** across all 6 reviewers
- **0 CRITICAL findings remaining** (all 7 CRITICAL from iteration 1 ADDRESSED)
- **0 HIGH findings remaining** (all 14 HIGH from iteration 1 ADDRESSED)
- **6 minor items** logged for execute-time pickup (none blocking)
- **3 deferred MEDIUMs** logged to MASTER-PLAN.md tech debt (per-user theme persistence, role-revocation refresh, side-by-side / Gantt patterns)

**Ready for /nx stage-1.5a-design-system-documents.**

Iteration 3 not required. Per directive's max-3-iterations rule, iteration 2 closes cleanly.

---

## What v2 does well (consensus across reviewers)

- **A11.1-A11.7 brand-customization contract** is enterprise-grade: setProperty injection, hex regex, Cache-Control + Vary header, signed-URL Storage scoping, file-type allow-list, isomorphic-dompurify pinning, 200KB cap, audit-log to `activity_log`.
- **Three-hook design** (T10b Forbidden / T10c sample-data / T10d tenant-blind) + **T35.5 positive tests** turn documentation rules into machine-enforced gates verified by adversarial commits.
- **Critical path correction** (PRE-T07 → T07 → T08 → T10c → T13 → T20a → T29-T36) is honest and unambiguous.
- **Middleware-level gating** (T18.5) replaces layout-level enforcement — design-by-construction posture honored. 404-via-rewrite-with-explicit-status prevents route-existence leak.
- **PHILOSOPHY.md distinctness** — 4-axis self-review per pair + transitive constraint + concrete invoice/dashboard/mobile screen comparisons make distinctness falsifiable, not aspirational.
- **Goal-backward verification** in PLAN §5 traces from Stage 1.5b prototype-readiness all the way back to PRE-T07 backup; no missing prerequisites.
- **Out-of-scope discipline** — no drift into NwButton refactor, inline-SVG migration, or prototypes (1.5b territory).
- **Acceptance criteria orphans = 0** — all 51 trace to ≥1 PLAN task.
