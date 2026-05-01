---
name: nightwork-anti-drift
description: Use this skill BEFORE any non-trivial Nightwork action — starting a new GSD phase (`/gsd-discuss-phase`, `/gsd-plan-phase`, `/gsd-execute-phase`, `/gsd-spec-phase`), schema migrations, refactors of existing source code, wave deployments, or design system changes. Validates that the proposed work traces back to `.planning/MASTER-PLAN.md` (DECISIONS LOG, NEXT PLANNED WORK, or CURRENT POSITION → outstanding) and that the working tree is in an acceptable state. Halts and asks if any check fails. Writes a drift-check entry to `.planning/drift-checks/` every fire. Pairs with the strengthened `nightwork-session-start.sh` hook that loads MASTER-PLAN.md into every session.
---

# Nightwork anti-drift skill

The session-start hook puts the full plan into context at every session. This skill is the *enforcement* counterpart — it fires when significant work is about to begin and verifies that the work traces back to the plan. If it doesn't, the skill halts and asks before proceeding.

The bar is **plan traceability**, not blanket caution. Trivial work (typos, tightening a comment, replying to a question) does not need to fire this. Non-trivial work does.

## When this skill fires

Invoke this skill BEFORE you take any of these actions:

- Starting a GSD phase: `/gsd-discuss-phase`, `/gsd-plan-phase`, `/gsd-execute-phase`, `/gsd-spec-phase`, `/gsd-add-phase`.
- A schema migration (any new file under `supabase/migrations/`).
- A refactor of existing source code (any change spanning ≥2 files where the goal is structural rather than behavioral).
- A wave deployment (anything labeled "Wave N", "F1–F4", "Stage N").
- A design system change (anything under `.planning/design/`, `src/app/globals.css`, `tailwind.config.ts`, or that introduces / modifies UI tokens, palette, typography).
- A "make X match Y" or cross-cutting change (route through `/nightwork-propagate`, but verify against the plan first).

Trivial actions — answering a question, fixing a typo, single-line bug fixes that are obviously in-scope — do not need to fire this.

## The four checks

Run all four. The skill HALTS on any failure and asks the user before proceeding.

### Check 1 — Is this work referenced in `.planning/MASTER-PLAN.md`?

Look in three sections:
- **DECISIONS LOG** (§10). If the proposed work is the consequence of a recorded decision, cite the decision ID (e.g., "Per D-009, design system before features…").
- **NEXT PLANNED WORK** (§12). If the proposed work matches an immediate / Stage-1 / Stage-1.5a / etc. line item, cite the section.
- **CURRENT POSITION → outstanding** (§9). If the proposed work is on the outstanding list, cite the line.

**On failure:** the work is not in the plan. Ask the user:
> "This work isn't referenced in MASTER-PLAN.md. Is it new? Should I add it as a decision (D-NNN) before proceeding, or did I miss the reference?"

### Check 2 — Does the branch name match the planned phase?

If the current branch encodes a phase (e.g., `phase-3.5-something`, `wave-2-schedules`, `stage-1.5a-design-system`), confirm the phase appears in `.planning/MASTER-PLAN.md` §12 NEXT PLANNED WORK or in the GSD `.planning/phases/<N>/` tree.

A branch named `nightwork-build-system-setup` matches Stage 0; `phase-3.5-co-classifier` should match a Phase 3.5+ entry; `wave-2-schedules` should match a Wave 2 line.

**On failure:** branch name implies a phase that the plan doesn't list. Ask the user:
> "Branch suggests phase X but X isn't in MASTER-PLAN.md §12. Is the plan stale, the branch misnamed, or is this off-plan work? Continue anyway?"

### Check 3 — Are uncommitted changes related to the current task?

`git status --short`. If files are modified or untracked, confirm they are the previous-phase-in-progress changes (acceptable) and not unrelated drift (not acceptable).

Heuristic for "related": the modified paths overlap with the proposed work's scope, or they are explicitly the previous phase's tail.

**On failure:** unrelated uncommitted changes are present. Ask the user:
> "There are uncommitted changes in [files] that look unrelated to the current task. Should I stash them, commit them on a separate branch, or include them?"

### Check 4 — Is the most recent QA verdict acceptable?

Read the latest file under `.planning/qa-runs/` (or `.planning/plan-reviews/` or `.planning/e2e-runs/` if more recent). Acceptable verdicts: `PASS`, `WARNING`. Unacceptable: `BLOCKING`, `CRITICAL`, anything containing `BLOCK`.

Skip this check if no QA run exists yet (Stage 0 / Stage 1 startup). Note in the drift-check log that QA history was empty.

**On failure:** last QA was BLOCKING. Ask the user:
> "The most recent QA verdict ([file]) is BLOCKING — [findings]. Should we resolve before continuing with this work?"

## Drift-check log

Every fire of this skill — pass, warned, or blocked — writes a markdown entry to `.planning/drift-checks/` with this template. The custodian agent reads these on weekly cleanups to spot drift trends.

```markdown
# Drift check — <YYYY-MM-DD-HHMM>

**Action:** <what was about to happen, in one sentence>
**Verdict:** <PASS | WARNED | BLOCKED>

## Check results

| # | Check | Result | Notes |
|---|-------|--------|-------|
| 1 | Plan traceability | PASS / FAIL | <citation or reason> |
| 2 | Branch ↔ phase match | PASS / FAIL / N/A | <branch name, matched section> |
| 3 | Uncommitted changes related | PASS / FAIL / CLEAN | <files, relation> |
| 4 | Last QA verdict acceptable | PASS / FAIL / NO-HISTORY | <file, verdict> |

## Reasoning

<2–4 sentences explaining the verdict and any user follow-up>

## User decision (if WARNED or BLOCKED)

<what the user decided, verbatim if possible>
```

File name: `.planning/drift-checks/<YYYY-MM-DD-HHMM>-<short-action-slug>.md`.

## What this skill does NOT do

- It does not block trivial work. Use judgement — "fix a typo in a comment" should not fire this.
- It does not replace `/nightwork-plan-review` or `/nightwork-qa`. Those are deeper, in-context reviews. This is a lightweight pre-flight.
- It does not modify code or migrations. It reads, decides, and writes only the drift-check log.
- It does not auto-add entries to MASTER-PLAN.md. If the user agrees the proposed work is new, they (or you, with their approval) update MASTER-PLAN.md DECISIONS LOG or NEXT PLANNED WORK first, then re-run the check, then proceed.

## Worked examples

### Example A — PASS

> User: "Let's address the HIGH CSP finding before Stage 1."
>
> Check 1: PASS — referenced in MASTER-PLAN.md §9 CURRENT POSITION → outstanding "Address HIGH CSP finding".
> Check 2: N/A — no phase branch.
> Check 3: PASS — `vercel.json` is the in-scope file.
> Check 4: PASS — last QA WARNING (acceptable).
>
> Verdict: PASS. Proceed without questions.

### Example B — BLOCKED on Check 1

> User: "Let's start phase Z — refactor the entire invoice schema."
>
> Check 1: FAIL — no Phase Z in MASTER-PLAN.md §12; no decision references a wholesale invoice schema refactor.
>
> Verdict: BLOCKED. Ask: "This work isn't referenced in MASTER-PLAN.md. Is it new? Should I add it as a decision before proceeding, or did I miss the reference?"

### Example C — WARNED on Check 3

> User: "Let's start `/gsd-plan-phase` for Stage 1 vision/audit."
>
> Check 1: PASS — §12 names Stage 1 as the next stage.
> Check 2: PASS — branch `nightwork-build-system-setup` is current Stage 0; user is about to branch.
> Check 3: WARN — `CLAUDE.md` is modified (uncommitted) from a prior session, unrelated to vision/audit.
> Check 4: PASS — last QA WARNING.
>
> Verdict: WARNED. Ask: "There are uncommitted changes in CLAUDE.md from a prior session. Should I stash them, commit them, or include them in the new branch?"

## Recovery from BLOCK

When a check blocks, the user's three options are usually:

1. **Update the plan first.** Add a new decision (D-NNN) or new line item to NEXT PLANNED WORK, commit MASTER-PLAN.md, then re-run the action. The skill will pass.
2. **Override and proceed.** The user explicitly tells you to proceed despite the failure. Log the override in the drift-check entry verbatim.
3. **Abort the action.** The user agrees the proposed work was off-plan and decides not to do it.

Whatever the resolution, the drift-check log captures it. Future custodian sweeps surface drift-check trends — high override rates indicate the plan needs to be updated to match reality, not the reverse.
