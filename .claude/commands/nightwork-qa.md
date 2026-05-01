---
name: nightwork-qa
description: Orchestrate code-level QA across the changes in the active phase — spec-check, custodian, security review, AI-logic test, plus UI/DB/API/financial-specific reviewers depending on what changed. Auto-runs at end of /gsd-execute-phase. Each reviewer in a fresh Task context. Critical findings from any reviewer block the phase.
argument-hint: "[<phase-number>] [--scope=quick|full] [--skip-block]"
allowed-tools:
  - Read
  - Bash
  - Grep
  - Glob
  - Write
  - Task
---

<objective>
Run code-level QA on the active (or specified) phase. This is the gate between `/gsd-execute-phase` and ship.

Logic:
1. Detect what changed via `git diff` (against the phase's base) and the phase manifest.
2. ALWAYS run: nightwork-spec-checker, nightwork-custodian, security-reviewer, nightwork-ai-logic-tester.
3. IF UI changed: + nightwork-ui-reviewer + nightwork-design-system-reviewer.
4. IF DB changed: + nightwork-rls-auditor + database-reviewer (parallel with postgres-patterns skill) + nightwork-data-migration-safety.
5. IF API routes changed: + api-design and backend-patterns skills (read by reviewers above).
6. IF financial logic changed: nightwork-ai-logic-tester does a deeper Drummond fixture pass.
7. Each reviewer in a fresh context window via Task tool — independent thinking, no cross-contamination.
8. Synthesize results: critical from any = BLOCKING; flagged by 2+ = BLOCKING; single non-critical = WARNING.
9. Write `.planning/qa-runs/<YYYY-MM-DD-HHMM>-qa-report.md`.
10. Return blocking-or-clean verdict to the orchestrator (so GSD can loop back if blocking).
</objective>

<arguments>
- Phase number (optional) — defaults to the active phase from `.planning/STATE.md` or the highest-numbered active phase in `.planning/phases/`.
- `--scope=quick` — skip optional reviewers, run only ALWAYS list.
- `--scope=full` (default) — full reviewer set.
- `--skip-block` — produce the report but do NOT halt on blocking findings (manual-review mode).
</arguments>

<execution>

### Step 1 — Detect change set

```bash
# Get the base SHA for this phase from the manifest (or use HEAD~N where N = phase commit count).
git diff --name-only <phase-base>..HEAD
```

Categorize the changed paths:
- UI: `*.tsx`, `*.css`, `src/components/**`, `src/app/**/page.tsx`.
- DB: `supabase/migrations/**`, `src/lib/supabase/**`.
- API: `src/app/api/**/route.ts`.
- Logic: `src/lib/**` (especially math, status transitions, aggregations).
- Tests: `__tests__/**`, `*.test.ts`.

### Step 2 — Build reviewer plan

Always:
- nightwork-spec-checker (read-only, compares spec to code).
- nightwork-custodian (cleans planning tree, surfaces drift).
- security-reviewer (ECC agent, security review of changed files).
- nightwork-ai-logic-tester (logic correctness against Drummond).

Add if UI changed:
- nightwork-ui-reviewer.
- nightwork-design-system-reviewer.

Add if DB changed:
- nightwork-rls-auditor.
- database-reviewer (ECC agent, runs with postgres-patterns skill).
- nightwork-data-migration-safety.

Add if API changed:
- (api-design and backend-patterns skills are read by the agents above; no separate reviewer.)

### Step 3 — Spawn reviewers in parallel via Task tool

For each reviewer in the plan, send a Task call. Run them in PARALLEL (single message, multiple Task calls) to minimize wall-clock time.

Each prompt:
- Include the phase number, change-set summary, and pointer to phase artifacts (`.planning/phases/<N>/`).
- Tell the agent to write its specific report file (`.planning/phases/<N>/<reviewer-suffix>.md`) and return a structured summary.
- Tell the agent to run in fresh context — no assumptions about what the orchestrator knows.

### Step 4 — Wait for all reviewers, collect results

Each agent returns a summary block. Aggregate:
- Total findings by severity (BLOCKING / CRITICAL / WARNING / NOTE).
- Cross-reviewer agreement (what 2+ agents flagged).
- Per-reviewer verdict (PASS / NEEDS WORK / BLOCKING).

### Step 5 — Synthesize

```
Synthesis rules:
- ANY reviewer reports BLOCKING / CRITICAL  → overall = BLOCKING.
- 2+ reviewers report WARNING on same surface  → escalate to BLOCKING.
- Single WARNING from one reviewer  → overall = WARNING.
- All PASS  → overall = PASS.
```

### Step 6 — Write the report

Write to `.planning/qa-runs/<YYYY-MM-DD-HHMM>-qa-report.md`:

```markdown
# QA report — Phase <N> — <date>

## Change set
- UI files changed: <count>
- DB files changed: <count>
- API files changed: <count>
- Logic files changed: <count>

## Reviewers run
- <list>

## Synthesis
| Severity | Count | Files |
|----------|-------|-------|

## Cross-reviewer agreements
- <issue flagged by 2+>

## Per-reviewer verdicts
| Reviewer | Verdict | Report |
|----------|---------|--------|

## Overall verdict
<PASS | WARNING | BLOCKING>

## Blocking findings (must fix before ship)
1. <finding> — from <reviewer>
2. ...

## Recommended next step
- If PASS: `/gsd-ship`
- If WARNING: review and proceed at user's discretion
- If BLOCKING: address blocking findings, re-run `/nightwork-qa`
```

### Step 7 — Return verdict

Return the overall verdict to the caller (GSD orchestrator or user). Exit code:
- `0` = PASS or WARNING.
- `1` = BLOCKING (unless `--skip-block` was passed, in which case `0`).

This lets GSD's `qa_gate: true` config halt the phase when blocking issues found.
</execution>

<failure_modes>
- If a reviewer fails to complete, mark its verdict UNKNOWN — not PASS. UNKNOWN counts as BLOCKING for the synthesis.
- If `git diff` fails (no base SHA, detached HEAD), abort and ask the user for the phase boundary.
- Never auto-fix — only report. Use `/gsd-code-review-fix` or `/gsd-audit-fix` for the fix loop.
</failure_modes>
