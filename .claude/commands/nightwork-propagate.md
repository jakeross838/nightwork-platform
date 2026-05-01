---
name: nightwork-propagate
description: Five-phase orchestrator for cross-cutting changes — when a change is "everywhere," "all," "make X match Y," "every," or pattern-wide. Phase 1 BLAST RADIUS, Phase 2 PROPAGATION PLAN, Phase 3 EXECUTE (with /nightwork-qa between chunks), Phase 4 SMOKE TEST, Phase 5 REPORT. Pauses for user approval after Phase 1 and Phase 2.
argument-hint: "<change description in quotes>"
allowed-tools:
  - Read
  - Bash
  - Grep
  - Glob
  - Write
  - Edit
  - Task
  - AskUserQuestion
---

<objective>
Cross-cutting changes are dangerous because the blast radius is non-obvious. This command runs them through five phases with explicit user approval gates.

Phase 1 — BLAST RADIUS: blast-radius-analyzer + pattern-mirror, output `BLAST-RADIUS.md`, pause for approval.
Phase 2 — PROPAGATION PLAN: ordered atomic chunks, output `PROPAGATION-PLAN.md`, pause for approval.
Phase 3 — EXECUTE: chunks in order, /nightwork-qa between each, halt on QA failure.
Phase 4 — SMOKE TEST: nightwork-smoke-tester runs full repo typecheck, tests, visual diffs against approved prototypes, schema safety, API contract checks.
Phase 5 — REPORT: what changed, what verified, what needs manual UAT, rollback steps if needed.
</objective>

<arguments>
- Change description (required) — free text, e.g., "make all status badges use the new outlined style" or "rename `vendor` to `subcontractor` in all customer-facing copy."
</arguments>

<execution>

### Phase 1 — BLAST RADIUS

Spawn in parallel via Task tool:

1. **nightwork-blast-radius-analyzer** — Brief: "Given the change description '<text>', produce a structured blast radius — direct deps, indirect deps, pattern deps, data deps. Sort by risk. Suggest atomic chunks. Write to `.planning/propagate/<YYYY-MM-DD-HHMM>-BLAST-RADIUS.md`."

2. **nightwork-pattern-mirror** — Only if the change description mentions two specific things (e.g., "make X match Y"). Brief: "Compare X to Y and produce structured diff. Write to `.planning/propagate/<timestamp>-PATTERN-MIRROR.md`."

Wait for both to complete. Read the BLAST-RADIUS.md.

**PAUSE — ask user to approve.** Use AskUserQuestion:

```
Question: "Blast radius identified — <count> direct, <count> indirect, <count> pattern, <count> data deps. Estimated <count> atomic chunks. Proceed to propagation plan?"
Options:
  - Yes, build the propagation plan
  - Show me specific files first  (then list top-N riskiest, ask again)
  - Cancel — too big to propagate
  - Cancel — wrong scope, let me re-state
```

If approved, continue to Phase 2.

### Phase 2 — PROPAGATION PLAN

Spawn `architect` (ECC agent) and `planner` (ECC agent) in parallel:

1. Brief: "Read `.planning/propagate/<timestamp>-BLAST-RADIUS.md`. Produce an ordered list of atomic chunks. Each chunk: <≤5 file edits, single concern, can be committed and tested independently>. Write to `.planning/propagate/<timestamp>-PROPAGATION-PLAN.md`."

The plan should include:
- Chunks in execution order (lowest risk first OR foundational first — judgment call).
- For each chunk: files involved, verification steps, rollback if it goes wrong.
- For the whole run: pre-flight backup steps if data-destroying, communication template.

**PAUSE — ask user to approve.** AskUserQuestion:

```
Question: "Propagation plan: <count> chunks, estimated <duration>. <Risk level if data-destroying>. Proceed to execute?"
Options:
  - Yes, execute chunks in order with /nightwork-qa between each
  - Yes, but execute one chunk at a time and pause for approval after each
  - Re-plan — adjust ordering
  - Cancel
```

### Phase 3 — EXECUTE

For each chunk in order:

1. Apply the chunk's edits.
2. Atomic commit with descriptive message.
3. Run `/nightwork-qa --scope=quick`. If BLOCKING, halt the propagate run.
4. If user chose "pause after each," AskUserQuestion before next chunk.

Halt rules:
- ANY chunk's QA returns BLOCKING → halt, surface the blocker, do not proceed.
- User can resume after fixing the blocker.

### Phase 4 — SMOKE TEST

After all chunks complete, spawn `nightwork-smoke-tester`:

Brief: "Smoke test the propagate run. Branch <name>, change description <text>, chunks executed <count>. Run typecheck/lint/tests/build, schema migration safety if applicable, API contract checks if applicable, visual diffs against approved prototypes if Chrome MCP available. Write to `.planning/propagate/<timestamp>-SMOKE-RESULTS.md`."

If smoke test BLOCKING → enter Phase 5 with rollback plan invoked. Spawn `nightwork-rollback-planner` to write the rollback steps.

### Phase 5 — REPORT

Synthesize all phases into `.planning/propagate/<timestamp>-PROPAGATE-REPORT.md`:

```markdown
# Propagate report — <change description>

## Phase 1 — Blast radius
- <count> deps identified across 4 axes.
- Report: <path>

## Phase 2 — Plan
- <count> chunks.
- Report: <path>

## Phase 3 — Execute
| Chunk | Files | QA verdict | Commit |
|-------|-------|-----------|--------|
| 1     |       | PASS      | <sha>  |

## Phase 4 — Smoke test
- Verdict: <PASS / BLOCK>
- Report: <path>

## What was verified automatically
- <list>

## What needs manual UAT
- <list>

## Rollback steps (if needed)
- <or> "Not currently needed — system green."
```

Surface the report path + a 5-line summary to the user.
</execution>

<failure_modes>
- If user cancels at any approval gate, stop and write a `<timestamp>-CANCELLED.md` with the reason. Do NOT discard already-completed chunks (they're committed).
- If a chunk fails QA, halt execution but DO NOT auto-rollback. The user decides.
- If the blast radius analyzer or pattern mirror returns ambiguous output, ask the user a clarifying question before proceeding.
- Never run all chunks without /nightwork-qa between them — that's the whole point.
</failure_modes>
