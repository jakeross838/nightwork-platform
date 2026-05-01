---
name: nightwork-plan-review
description: Plan-level architectural review. Auto-runs at the end of /gsd-plan-phase. Spawns architect + planner + enterprise-readiness + multi-tenant-architect + scalability + compliance + security-reviewer + design-pushback (when applicable) in fresh contexts via Task tool. Critical findings block execute.
argument-hint: "[<phase-number>] [--skip=architect,security,...] [--skip-block]"
allowed-tools:
  - Read
  - Bash
  - Grep
  - Glob
  - Write
  - Task
---

<objective>
Run plan-level architectural review on the active (or specified) phase. This is the gate between `/gsd-plan-phase` and `/gsd-execute-phase`.

Logic:
1. Read PLAN.md, SPEC.md (if present), and phase metadata.
2. Skip review entirely if phase metadata says `complexity: trivial` (and surface that).
3. Spawn the following in parallel via Task tool, each in a fresh context:
   - architect (ECC agent)
   - planner (ECC agent)
   - nightwork-enterprise-readiness-reviewer
   - nightwork-multi-tenant-architect
   - nightwork-scalability-reviewer (if plan touches queries / hot paths)
   - nightwork-compliance-reviewer (if plan touches PII / financial / audit)
   - security-reviewer (ECC agent)
   - nightwork-design-pushback-agent (if plan touches UI)
4. Synthesize results: critical from any = REVISE-PLAN; single non-critical = warning.
5. Write `.planning/plan-reviews/<phase>-plan-review.md`.
6. Return blocking-or-clean verdict.
</objective>

<arguments>
- Phase number (optional) — defaults to the latest phase with PLAN.md but no MANIFEST.md.
- `--skip=name1,name2` — skip specific reviewers (e.g., `--skip=design-pushback` if you've manually justified).
- `--skip-block` — produce the report but do not halt on critical findings.
</arguments>

<execution>

### Step 1 — Read inputs

- `.planning/phases/<N>/PLAN.md` — required. Abort if missing.
- `.planning/phases/<N>/SPEC.md` — optional but strongly preferred.
- `.planning/phases/<N>/RESEARCH.md` — if present.
- Phase metadata in PLAN.md frontmatter — check for `complexity: trivial` and exit if so.

### Step 2 — Decide reviewer plan

Always:
- architect, planner, nightwork-enterprise-readiness-reviewer, nightwork-multi-tenant-architect, security-reviewer.

Add if PLAN.md mentions queries / aggregations / dashboards / list views / hot paths:
- nightwork-scalability-reviewer.

Add if PLAN.md mentions PII / financial / audit trails / external integrations / encryption / auth flows:
- nightwork-compliance-reviewer.

Add if PLAN.md mentions UI / components / screens / routes / pages:
- nightwork-design-pushback-agent.

Honor `--skip=` overrides.

### Step 3 — Spawn reviewers in parallel

Use a single message with multiple Task calls. Each prompt:
- Provides the phase number, the path to PLAN.md / SPEC.md, and the reviewer's specific brief.
- Tells the reviewer to write its report file (`.planning/phases/<N>/PLAN-REVIEW-<reviewer>.md`) and return a structured summary.

### Step 4 — Wait, collect, synthesize

```
Synthesis rules:
- ANY reviewer reports CRITICAL  → overall = REVISE-PLAN.
- 2+ reviewers report WARNING on same concern  → escalate to REVISE-PLAN.
- Single WARNING from one reviewer  → overall = WARNING.
- All APPROVE  → overall = APPROVE.
```

### Step 5 — Write the consolidated report

Write to `.planning/plan-reviews/<phase>-plan-review.md`:

```markdown
# Plan review — Phase <N>

## PLAN.md summary
<2-3 lines>

## Reviewers run
- <list with verdicts>

## Cross-reviewer concerns (2+ flagged the same)
- <issue> — from <list of reviewers>

## Critical concerns (revise plan)
1. <issue> — from <reviewer>

## Warnings
- <issue>

## Approved with notes
- <reviewer>: <note>

## Overall verdict
<APPROVE | WARNING | REVISE-PLAN>

## Recommended next step
- APPROVE: `/gsd-execute-phase <N>`
- WARNING: address warnings or proceed at user's discretion
- REVISE-PLAN: revise PLAN.md, re-run `/nightwork-plan-review`
```

### Step 6 — Return verdict

Exit code:
- `0` = APPROVE or WARNING.
- `1` = REVISE-PLAN (unless `--skip-block`).

This lets GSD's `plan_gate: true` config halt advancement to execute.
</execution>

<failure_modes>
- Trivial-complexity phases skip review entirely. Output: `Skipped — complexity: trivial.`
- If PLAN.md is missing, abort with a clear error pointing at `/gsd-plan-phase`.
- A reviewer that fails to complete is treated as UNKNOWN = REVISE-PLAN.
</failure_modes>
