---
name: nightwork-end-to-end-test
description: Run a full Drummond-based scenario through the system. Picks a flow (e.g. "create vendor → PO → receive invoice → approve → include in draw → generate G702/G703 → record lien release → mark paid"), walks it through against Drummond fixtures, verifies every step succeeds AND the result makes construction-domain sense via nightwork-ai-logic-tester. Auto-runs at end of /gsd-ship.
argument-hint: "[<flow-name>] [--mode=fixture|preview-url]"
allowed-tools:
  - Read
  - Bash
  - Grep
  - Glob
  - Write
  - Task
---

<objective>
End-to-end test using the Drummond reference job. Confirms a real workflow from start to finish: data flows correctly through all entities, calculations match expected output, audit logs accumulate, status transitions are honored.

Default flow:
1. Create or load Drummond job with budget lines.
2. Create vendor (Drummond reference vendor).
3. Create PO against a budget line.
4. Receive invoice (parsed via AI, reference Drummond invoice fixture).
5. PM approves invoice.
6. QA approves invoice.
7. Push to QuickBooks (mocked or skipped if not yet wired).
8. Include invoice in draft draw.
9. Generate G702/G703 from draft.
10. Lock draw on submit.
11. Record lien release for vendor.
12. Mark invoice paid.

Each step verifies state changes, audit log writes, status_history appends, computed cache freshness. Final step: nightwork-ai-logic-tester reviews the whole run for construction-domain sense.
</objective>

<arguments>
- Flow name (optional) — defaults to `full-draw-cycle`. Other flows can be defined in `.planning/e2e-flows/<name>.md`.
- `--mode=fixture` (default) — runs against Drummond fixtures, no Vercel needed. Uses test database.
- `--mode=preview-url` — hits the actual Vercel preview URL via Chrome MCP. Slower, broader coverage.
</arguments>

<execution>

### Step 1 — Pick the flow

If flow name passed, read `.planning/e2e-flows/<name>.md` for the step list. Otherwise use the default `full-draw-cycle`.

If the flow file doesn't exist for a non-default flow, abort with a clear error.

### Step 2 — Set up the run

`fixture` mode:
- Ensure Drummond fixtures are loaded (run `npm run seed:drummond` or equivalent).
- Reset the test database to a known state.
- Capture starting state (count of invoices, draws, audit log size).

`preview-url` mode:
- Identify the Vercel preview URL for this branch (via `vercel ls`).
- Connect Chrome MCP to that URL.
- Log in as a test user with admin role.
- Navigate to the Drummond org context.

### Step 3 — Walk the flow

For each step in the flow:

1. Execute the step's action (API call in fixture mode, UI interaction in preview-url mode).
2. Capture the result (response body, DB row state, screenshot if UI).
3. Run the step's assertions:
   - Expected status transition occurred?
   - Expected audit log row written?
   - Expected status_history entry appended?
   - Expected computed cache updated?
   - Expected workflow event emitted?
4. If the assertions fail, halt the run and capture the failure context.

### Step 4 — Final pass: AI logic tester

After all steps complete, spawn `nightwork-ai-logic-tester` in a fresh Task context:

Brief: "Review the end-to-end run summarized in `.planning/e2e-runs/<timestamp>-flow.md`. Walk through the same Drummond scenario step by step. Compare expected to actual at each step. Identify any place the math, state, or domain meaning is off. Write your analysis to `.planning/e2e-runs/<timestamp>-logic-review.md`."

### Step 5 — Synthesize report

Write `.planning/e2e-runs/<YYYY-MM-DD-HHMM>-e2e-report.md`:

```markdown
# End-to-end test — <flow name> — <date>

## Mode
<fixture | preview-url>

## Flow
<name>: <description>

## Steps executed
| # | Step | Result | Assertions | Verdict |
|---|------|--------|------------|---------|
| 1 | Create Drummond job | <result> | 5/5 | PASS |
| 2 | ...                 |          |     |      |

## Domain sense check (from nightwork-ai-logic-tester)
- <key findings>

## Failures
1. <step>: <what failed>, <evidence>

## Audit log diff
- Starting size: <N>
- Ending size: <M>
- Net rows added: <delta>
- Tables touched: <list>

## Status history diff
- Records with new transitions: <count>
- Statuses observed: <list>

## Computed cache freshness
- jobs.approved_cos_total: <expected vs actual>
- (other caches)

## Verdict
<PASS | NEEDS WORK | BLOCKING>

## Manual UAT recommended for
- <surfaces not covered by this flow>
```

### Step 6 — Return verdict

Exit code:
- `0` = PASS.
- `1` = NEEDS WORK or BLOCKING.

Auto-invoked at the end of `/gsd-ship` (per `pre_ship_hooks` config). Failure halts ship.
</execution>

<failure_modes>
- If Drummond fixtures aren't loaded, abort and recommend the seed command.
- If Vercel preview URL isn't available in `preview-url` mode, fall back to `fixture` mode with a warning.
- If a step fails, do NOT continue — stop and surface the failure clearly. Domain damage compounds when ignored.
- Never modify production data. Always run against test database / preview URL.
</failure_modes>
