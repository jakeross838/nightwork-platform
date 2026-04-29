---
name: nightwork-cleanup
description: Sweep the .planning/ tree — archive completed phases, archive stale review artifacts, surface orphans/drift, capture phase lessons. Wraps the nightwork-custodian agent.
argument-hint: "[--scope=full|stale-only|lessons-only]"
allowed-tools:
  - Read
  - Bash
  - Grep
  - Glob
  - Task
---

<objective>
Run the Nightwork custodian on demand. Cleans up the planning tree without touching source code.

Spawns `nightwork-custodian` in a fresh context via the Task tool, lets it produce a sweep report at `.planning/custodian-runs/<YYYY-MM-DD>-sweep.md`, then surfaces a one-page summary to the user.
</objective>

<arguments>
- `--scope=full` (default) — full sweep: archive phases, archive stale artifacts, surface orphans/drift, capture lessons.
- `--scope=stale-only` — archive stale artifacts only.
- `--scope=lessons-only` — append lessons for completed phases only.
</arguments>

<execution>
1. Decide scope from `$ARGUMENTS` (default `full`).

2. Spawn `nightwork-custodian` agent in a fresh context:

   ```
   Task tool with subagent_type=nightwork-custodian.
   prompt: "Run a <scope> sweep of .planning/. Today is <YYYY-MM-DD>. <Scope-specific instructions>. Write the report to .planning/custodian-runs/<YYYY-MM-DD>-sweep.md and return a 200-word summary."
   ```

3. Wait for the agent to complete.

4. Read the sweep report.

5. Surface a tight summary to the user:
   - Phases archived (count + names).
   - Stale artifacts archived (count).
   - Orphaned references (count, with paths).
   - ROADMAP drift (count, with phases).
   - Lessons appended (phases).
   - One-line verdict: clean / drift / needs attention.

6. If the sweep found ROADMAP drift or orphaned references, recommend the next command to run (e.g., `/gsd-extract_learnings <phase>` or manual roadmap edit).
</execution>

<failure_modes>
- If the custodian agent reports a write outside `.planning/`, that is a BUG in the agent — surface it as such, do not paper over.
- If `.planning/` does not exist, abort with a clear error and recommend `/gsd-new-project` (or its equivalent).
</failure_modes>
