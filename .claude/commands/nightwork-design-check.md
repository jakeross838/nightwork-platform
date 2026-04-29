---
name: nightwork-design-check
description: Design audit for changed UI surfaces. Runs Impeccable /audit + /critique + nightwork-design-system-reviewer + nightwork-ui-reviewer + nightwork-design-pushback-agent (where applicable). Auto-invoked as part of /nightwork-qa when UI changed. Manually runnable for any UI surface.
argument-hint: "[<file-or-route>] [--scope=changed|all]"
allowed-tools:
  - Read
  - Bash
  - Grep
  - Glob
  - Write
  - Task
  - Skill
---

<objective>
Comprehensive design audit. Five parallel review streams:
1. **Impeccable /audit** — structured visual / UX audit using the impeccable skill.
2. **Impeccable /critique** — taste-level critique using the impeccable skill.
3. **nightwork-ui-reviewer** — invoice-review template fidelity, six-pillar audit.
4. **nightwork-design-system-reviewer** — token, primitive, pattern fidelity vs design system docs.
5. **nightwork-design-pushback-agent** — design-system pushback (if a plan / spec is in scope).

Each in fresh context via Task tool. Synthesizes into a single DESIGN-CHECK.md report.
</objective>

<arguments>
- File or route (optional) — specific surface to audit. If omitted, defaults to all UI surfaces changed since last commit on the active branch.
- `--scope=changed` (default) — only changed UI files.
- `--scope=all` — all UI surfaces in src/app/ and src/components/ (slow, use sparingly).
</arguments>

<execution>

### Step 1 — Determine scope

If a file or route is passed, use it. Otherwise, derive scope:

```bash
git diff --name-only HEAD~1..HEAD | grep -E '\.(tsx|css)$|src/components/|src/app/.+/page\.tsx'
```

If `--scope=all`, scan `src/app/**/page.tsx` and `src/components/**`.

If no UI files in scope, output `N/A — no UI changes.` and exit.

### Step 2 — Spawn reviewers in parallel

Single message with multiple Task calls:

1. **Impeccable /audit** — Use the Skill tool to invoke the `impeccable` skill with the audit reference (read `.claude/skills/impeccable/reference/audit.md`). Pass the in-scope files. Capture output.

2. **Impeccable /critique** — Same, with `.claude/skills/impeccable/reference/critique.md`.

3. **nightwork-ui-reviewer** — Task call. Brief: "Audit these UI files for invoice-review-template fidelity and six-pillar concerns. Files: <list>. Phase: <N or 'manual run'>. Write to `.planning/design-checks/<YYYY-MM-DD-HHMM>-ui-reviewer.md`."

4. **nightwork-design-system-reviewer** — Task call. Brief: "Audit these UI files for design-system fidelity (tokens, primitives, patterns, prototypes). Files: <list>. Write to `.planning/design-checks/<YYYY-MM-DD-HHMM>-design-system.md`."

5. **nightwork-design-pushback-agent** — Only if a SPEC.md or PLAN.md is in the active phase. Otherwise skip.

### Step 3 — Collect outputs

For Impeccable streams, capture the output text (no file write).
For agent streams, read the .md report each one wrote.

### Step 4 — Synthesize

Write to `.planning/design-checks/<YYYY-MM-DD-HHMM>-design-check.md`:

```markdown
# Design check — <date>

## Surfaces audited
- <list>

## Streams
1. Impeccable /audit — <PASS / FLAG / BLOCK + summary>
2. Impeccable /critique — <PASS / FLAG / BLOCK + summary>
3. nightwork-ui-reviewer — <verdict + report path>
4. nightwork-design-system-reviewer — <verdict + report path>
5. nightwork-design-pushback-agent — <verdict + report path or N/A>

## Cross-stream concerns (2+ flagged the same)
- <issue>

## BLOCKING findings
1. <finding> — from <stream>

## FLAGS
- <finding>

## NOTES
- <observation>

## Verdict
<PASS | FLAG | BLOCK>
```

### Step 5 — Return verdict

Exit code:
- `0` = PASS or FLAG.
- `1` = BLOCK.

Surface a one-screen summary to the user with the verdict, the BLOCKING list, and the path to the full report.
</execution>

<failure_modes>
- If Impeccable skill isn't accessible (not loaded), substitute a structured visual review prompt to a generic agent and note the substitution.
- If no UI files in scope, output `N/A — no UI changes.` and exit code 0.
- Don't BLOCK on Impeccable taste-level concerns alone — those are FLAGs. BLOCK reserved for system-fidelity violations.
</failure_modes>
