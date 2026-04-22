# Nightwork Rebuild Plan — The Full Build

**Version:** v3 (2026-04-22)
**Status:** Source-of-truth document. All branches execute against this plan.
**Replaces:** v1 (first draft), v2 (full scope baked in)

---

## Reading guide

This document is organized in layers. Skim the Part you care about.

| Part | Purpose | Who reads this | When |
|---|---|---|---|
| **R** | **Standing Rules** — operating principles every phase must follow | Everyone, every session | Before starting any work |
| **G** | **Exit Gates, QA Reports, Subagents, Rebuild Tree** — how we verify done-done | Claude Code, Jake | Starting every phase + ending every phase |
| 0 | Philosophy, scope, launch strategy | Everyone | Once |
| 1 | Target-state architecture — what Nightwork **is** when finished | Jake + Claude Code | Branch planning |
| 2 | Data model & naming conventions | Anyone writing code | Any schema work |
| 3 | Data flow diagrams — how information moves | Anyone debugging | Debugging |
| 4 | Audit — where the current codebase stands | Claude Code for context | First session on a branch |
| 5 | Execution plan — the 9 branches | Claude Code as source of truth | During execution |
| 6 | Appendix — research references, open decisions | Reference | As needed |

**If you read nothing else, read Parts R and G.** They define how work is done and how we know it's done. Everything else is specifics.

---

# PART R — STANDING RULES

These rules apply to every branch, every phase, every commit. Violating them is grounds for rejection at the phase exit gate. Claude Code reads this section at the start of every session.

## R.1 Never kill running processes

Never run `pkill`, `kill`, `taskkill`, `killall`, or equivalent. Never kill the dev server, never kill Node, never kill Supabase. If a port is in use, pick a different port. If a process is stuck, report it — don't kill it. Past sessions have crashed the whole environment by killing server processes.

## R.2 Recalculate, never increment/decrement

For any derived value (budget committed, invoiced totals, approved CO totals, etc.): **always recompute from source truth.** Never `UPDATE ... SET committed = committed + X` or `-= X`. Always `UPDATE ... SET committed = (SELECT SUM(...) FROM purchase_orders WHERE ...)`. Increment/decrement patterns drift silently when a trigger fails, a row is soft-deleted, or an operation is retried.

## R.3 Org-configurable, never hardcoded

Any workflow behavior that could differ between builders must be a per-org or per-job configuration. No hardcoded approval chains, no hardcoded cost code lists, no hardcoded draw modes, no hardcoded retainage percentages. If it feels like a policy choice, it's configurable.

## R.4 Rebuild over patch

**When existing code is wrong, rip it out and rebuild.** Not "wrong as in incomplete" — wrong as in foundationally off-target, pattern-mismatched, or drifting from the schema/architecture defined in Parts 1 and 2. Patching wrong code creates compounding debt. The cost of rebuilding is session time; the cost of patching is permanent tech debt.

See Part G section G.5 for the rebuild decision tree.

## R.5 Trace, don't assume

Before modifying any entity, trace its downstream dependencies. If you change an enum value, grep for every string reference. If you rename a column, check triggers, views, RLS policies, API routes, UI components. If you delete a route, check nav, dashboard links, email templates. Blind assumptions about scope cause partial migrations that appear to work but break later.

## R.6 Block destructive actions when linked records exist

Before allowing a user (or a script) to delete/void/change a status on a record, check for linked children. A job with draws can't be deleted. A draw with approved invoices can't be voided without a `canVoid*` guard. An approved CO with spawned POs can't be reverted to draft. Guards live in `src/lib/guards/*.ts`.

## R.7 Log all state changes to status_history

Every mutation on a statused entity appends to `status_history` JSONB: `{from, to, actor_user_id, at, reason?, comment?}`. This is audit-critical. No exceptions.

## R.8 Amounts in cents

Money is stored as `BIGINT` cents. Never `NUMERIC`, never `REAL`, never `FLOAT`. Display as dollars via format helpers. Math happens in cents.

## R.9 Source document provenance

Any entity that could be drag-created (invoices, POs, COs, proposals, vendors, budgets, historical draws) has `source_document_id UUID` that points to the `document_extractions` row it came from. Even if the entity was manually created, `source_document_id` is NULL — not a broken FK.

## R.10 Optimistic locking on mutations

All PATCH requests on mutable entities include `expected_updated_at`. The API returns 409 Conflict on mismatch. This is not optional — it's the only way multi-user editing stays safe.

## R.11 Screenshots are inline, not disk-saved

Screenshots are captured via Chrome MCP and returned inline in the conversation. They are not persisted to disk. Do not attempt to save to `C:\Users\Jake\Ross-Built-Command\screenshots\` or any other path — this protocol was removed because Chrome MCP doesn't support it.

## R.12 Single QA file per phase

At the end of every phase, Claude Code produces **one** QA report file named `qa-branch{N}-phase{M}.md` in `./qa-reports/` (repo-relative) following the format in Part G section G.3. The `qa-reports/` folder is **git-versioned, not gitignored** — QA reports are the rebuild's audit trail and must travel with the code. No scattered screenshot folders, no multiple files — one comprehensive file that contains everything Jake needs to review the phase.

The path is repo-relative because the original `/mnt/user-data/outputs/` convention was a Claude-harness sandbox invisible to the host filesystem on Windows. Updated 2026-04-22 after Phase 1.1.

## R.13 Read CLAUDE.md first

Every Claude Code session begins by reading `CLAUDE.md` and this plan doc. CLAUDE.md references this plan for all operational details.

## R.14 No placeholder content

Never ship "coming soon" pages, stub components, or Lorem ipsum. If a feature isn't built, it isn't in the nav, isn't linked, and doesn't render. Placeholders are how Nightwork got to the half-built state we're rebuilding out of.

## R.15 Test-first when possible

For any fix that closes a bug (enum drift, constraint mismatch, etc.), write a failing test FIRST that would have caught the bug, then fix the bug and watch the test pass. Save the test to `__tests__/` directory. This is Branch 9's foundation.

## R.16 Migration files are the source of truth

Never apply schema changes directly to the database via MCP or dashboard. Every schema change is a numbered migration file committed to git. Git is the single source of truth for schema.

## R.17 Atomic commits

Every phase commit is self-contained and passes all tests. Never commit a partial phase. Never commit with failing tests. Never commit with `TODO`/`FIXME`/`XXX` without a linked issue. A commit is a permanent record that must stand on its own.

## R.18 Phase spec file lists are advisory, not authoritative

The "Files touched" list in each Part 5 phase spec is the plan author's guess at blast radius written before the codebase was regrepped. It is advisory. At every phase kickoff, Claude Code must grep the actual codebase for the identifiers the phase will change (enum values, column names, function names, route paths, constants) and compare the grep result to the phase spec's file list. Report any delta in the kickoff message before starting work.

Exit gate grep/rename checks (e.g., "zero remaining references to 'X'") are the authoritative scope. If the grep finds references in files not in the phase spec list, those files are in scope and must be updated. Don't narrow scope to match the list; expand the list to match the grep.

Added 2026-04-22 after Phase 1.1 revealed an 18-file blast radius against a 5-file spec list.

## R.19 Live execution of manual tests

Manual tests listed in a phase's exit gate must be executed live against a running dev server with real HTTP requests and real auth sessions. "Static equivalence by contract inspection" is not a substitute — the logic may be airtight but the wiring, middleware order, and runtime auth flow must be exercised end-to-end. If live execution is genuinely impractical for a phase, flag to Jake at kickoff and get explicit permission before treating the test as passed. Phase 1.2 shipped with static validation as precedent-setter; this was accepted but must not become standard.

## R.20 Read project scripts before invoking

Before running any project script (npm scripts, shell scripts, Makefile targets, package.json scripts, etc.), read the script contents. Scripts can contain kill commands, destructive operations, or environment mutations that violate R.1, R.5, or R.6. Blind invocation of `npm run <script>` without first inspecting what it actually executes is a standing rule violation. Phase 1.3 shipped with a taskkill incident caused by this gap (scripts/dev.sh contained taskkill; `npm run dev` invoked it blindly).

## R.21 Synthetic test fixtures, never production-shaped data

Live manual tests (R.19) must use purpose-built synthetic draws/jobs/invoices/POs created at phase kickoff and torn down at phase end. Real Ross Built job data (Fish Residence, Markgraf, Dewberry, etc.) must not be used as test fixtures, even on dev. Using real-data rows as test subjects pollutes dogfooding and corrupts the audit trail for those jobs. Each phase that requires live manual tests creates fixtures under a recognizable naming convention (e.g., job name prefix 'ZZZ_PHASE_1_3_TEST') and deletes them before exit gate. Phase 1.3 violated this rule and required post-hoc cleanup.

## R.22 Teardown script sequencing

R.21's teardown script must reflect every fixture actually created during the phase. If live tests seed additional entities beyond the original fixture plan (e.g., child rows, linked records, ad-hoc SQL seeds), the teardown script must be updated to include them BEFORE the teardown is executed, not after. The authoring order is: finalize fixtures → write and commit teardown → execute tests → execute teardown. Phase 1.4 shipped with post-hoc teardown edits because the script was written before Test 3's CO fixture was finalized; this is the last phase this is acceptable.

---

# PART G — EXIT GATES, QA REPORTS, SUBAGENTS, REBUILD TREE

This is how we verify "done" means "done." Every phase follows this structure.

## G.1 The phase execution loop

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. JAKE PROMPTS CLAUDE CODE with the phase prompt (built by     │
│    Claude in chat from the Branch/Phase spec)                   │
└──────────────────────────────┬──────────────────────────────────┘
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│ 2. CLAUDE CODE EXECUTES                                         │
│    • Reads CLAUDE.md + this plan                                │
│    • Reads phase spec                                           │
│    • Applies standing rules (Part R)                            │
│    • Spawns subagents where specified (G.4)                     │
│    • Makes code changes                                         │
│    • Runs migrations                                            │
│    • Writes/runs tests                                          │
└──────────────────────────────┬──────────────────────────────────┘
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│ 3. CLAUDE CODE GENERATES QA REPORT                              │
│    Single file: /mnt/user-data/outputs/qa-branch{N}-phase{M}.md │
│    Format per G.3                                               │
│    Includes every checklist item from the phase exit gate (G.2) │
│    Marks each: ✅ PASS  ❌ FAIL  ⚠️ SKIP (with reason)           │
└──────────────────────────────┬──────────────────────────────────┘
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│ 4. JAKE UPLOADS QA FILE to Claude (chat)                        │
└──────────────────────────────┬──────────────────────────────────┘
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│ 5. CLAUDE REVIEWS against the phase exit gate checklist         │
│    • Every checklist item must be ✅                            │
│    • Any ❌ → write a fix prompt, return to step 1              │
│    • Any ⚠️ SKIP → require explicit Jake approval OR fix prompt │
│    • If all ✅ → "PHASE COMPLETE, proceed to phase M+1"         │
└─────────────────────────────────────────────────────────────────┘
```

This loop is non-negotiable. We do not move to phase M+1 until phase M is ✅ across every checklist item.

## G.2 Phase exit gate — universal checklist template

Every phase has a phase-specific exit gate that extends this universal checklist. Claude Code runs every item and reports in the QA file.

### Universal checks (every phase)

```
CODE QUALITY
  ☐ All new files follow naming conventions (Part 2, section 2.1)
  ☐ No `console.log` in production code (only in tests or gated by PERF_LOG)
  ☐ No `TODO`/`FIXME`/`XXX` comments added (or linked to tracked issues)
  ☐ No `any` types added without eslint-disable + reason comment
  ☐ No hardcoded strings that should be constants
  ☐ All `async` functions handle errors (try/catch or explicit propagation)

SCHEMA / MIGRATIONS (if phase touches DB)
  ☐ Every schema change is in a numbered migration file committed to git
  ☐ Migrations are idempotent (safe to re-run)
  ☐ Migrations have a written rollback procedure (in the migration file or
    a companion .down.sql)
  ☐ CHECK constraints match the enum inventory in Part 2 section 2.3
  ☐ RLS policies exist for every new tenant table
  ☐ Indexes added for every new query path
  ☐ No direct DB changes via MCP/dashboard — everything through migration

API / ROUTES (if phase touches routes)
  ☐ Every mutation route has explicit role check (requireRole)
  ☐ Every PATCH handles optimistic locking (expected_updated_at → 409)
  ☐ Every route returns proper HTTP status codes (not 200 for errors)
  ☐ Every new route documented in CLAUDE.md or similar
  ☐ No RLS-only enforcement on mutations

UI (if phase touches frontend)
  ☐ Every affected page has a screenshot in the QA file (by role)
  ☐ Mobile (375px) screenshots included for responsive pages
  ☐ Loading / empty / error states all implemented and captured
  ☐ No placeholder content anywhere reachable in the nav
  ☐ Dark/light theme both work (if applicable)
  ☐ Keyboard navigation works (tab order, enter, escape)

TESTS
  ☐ New functionality has test coverage (at minimum: happy path + 1 failure)
  ☐ All existing tests still pass (no regressions)
  ☐ Test output included in QA file

REGRESSION CHECK
  ☐ Prior-branch functionality still works (e.g., Branch 2 tests still pass after Branch 3)
  ☐ No phase deliverable introduced a new blocker to prior work

STANDING RULES (from Part R)
  ☐ No process killing (R.1)
  ☐ All derived values recalculated, not incremented (R.2)
  ☐ Org-configurable where applicable (R.3)
  ☐ Rebuilt wrong code vs patched (R.4) — or explicitly justified patch
  ☐ Grep confirmed no stale references after renames (R.5)
  ☐ Guards added for destructive actions (R.6)
  ☐ status_history appended on all state changes (R.7)
  ☐ Money in cents (R.8)
  ☐ source_document_id on all drag-createable entities (R.9)
  ☐ Optimistic locking on all PATCH routes (R.10)
  ☐ Screenshots inline, not disk-saved (R.11)
  ☐ Single QA file produced (R.12)
  ☐ CLAUDE.md read at start of session (R.13)
  ☐ No placeholder content added (R.14)

GIT HYGIENE
  ☐ Commits are atomic and pass tests individually (R.17)
  ☐ Commit messages follow conventional commits (feat/fix/refactor/chore/test)
  ☐ Branch name matches plan (e.g., `branch-2-schema-expansion`)
  ☐ No merge conflicts

DOCUMENTATION
  ☐ CLAUDE.md updated if operational changes
  ☐ This plan doc updated if architectural decisions changed
  ☐ Inline comments on non-obvious logic
```

### Phase-specific checks

Each phase adds its own. Example for Branch 1 Phase 1.1 (enum alignment):

```
PHASE-SPECIFIC (B1 P1.1 — Enum Alignment)
  ☐ Grep confirms zero remaining references to 'pending_approval' in code
  ☐ Grep confirms zero remaining references to 'executed' for CO status
  ☐ SQL: SELECT DISTINCT status FROM change_orders returns only {draft,pending,approved,denied,void}
  ☐ SQL: SELECT DISTINCT status FROM invoices includes 'info_requested'
  ☐ Manual: Created CO, submitted, approved — succeeds
  ☐ Manual: Created CO, submitted, denied (with reason) — succeeds
  ☐ Manual: Voided approved CO (no dependencies) — succeeds
  ☐ Manual: invoice action=request_info — no DB error, status updates to info_requested
  ☐ Test: Failing test case for old behavior added to __tests__ — now passing
```

Phase specs in Part 5 will include their specific checks.

## G.3 QA report format

Every phase produces **one** file at `/mnt/user-data/outputs/qa-branch{N}-phase{M}.md`. Structure:

```markdown
# QA Report — Branch {N} Phase {M}: {Phase Name}

**Generated:** {timestamp}
**Claude Code session:** {session_id or git commit SHA}
**Overall status:** ✅ COMPLETE / ❌ INCOMPLETE / ⚠️ PARTIAL

---

## Summary

- Phase intent (1 sentence)
- What was built (3–5 bullets)
- What was rebuilt vs patched (with justification)
- Anything flagged for Jake's attention
- Subagents used (if any) and outcomes

---

## Exit Gate Checklist

### Universal checks
- ✅ / ❌ / ⚠️ for each item from G.2, with brief note

### Phase-specific checks
- ✅ / ❌ / ⚠️ for each phase-specific item

**Any ⚠️ SKIP items require explicit justification and Jake approval.**

---

## Commits

| SHA | Message | Files touched |
|---|---|---|
| abc1234 | feat(...) | ... |

Full diff summary: `+234 −87` across N files.

---

## Migrations (if DB touched)

| File | Purpose | Applied? | Rollback tested? |
|---|---|---|---|
| 00063_...sql | ... | ✅ on dev | ✅ |

Current schema state: dump of relevant `\d+` output or equivalent.

---

## Visual QA

**Required in every phase QA report.** Not optional.

**Encoding:** Screenshots MUST be embedded as base64 data URIs directly in the markdown:

```markdown
![caption](data:image/png;base64,<BASE64_DATA>)
```

Do NOT save screenshots to disk and link via relative path. The QA file must be fully self-contained — a single `.md` that renders all images inline when opened in VS Code preview, GitHub, or any markdown viewer.

**File size ceiling: 35MB per QA file — hard cap.**

To stay under the cap:

1. **Capture resolution:** 1280×800 for desktop, 375×667 for mobile. Do NOT capture at 2x/retina or 4K.
2. **PNG optimization:** Run captured PNGs through lossless compression (e.g. `pngquant --quality=80-95` or equivalent) before base64 encoding. Target ~100–200KB per screenshot.
3. **Budget check:** Before writing the QA file, sum the byte size of all encoded screenshots. If projected file size exceeds 30MB, stop and report — do not write an oversized file. Options at that point: (a) reduce breakpoint/role matrix to critical combinations only with justification, (b) split the phase into sub-phases, or (c) use JPEG at 85% quality for non-text-heavy screens. Jake decides.
4. **Git hygiene:** `.gitattributes` at repo root prevents git from attempting to diff base64 blobs and hides them from GitHub language stats:

   ```
   qa-reports/*.md -diff -merge
   qa-reports/*.md linguist-generated=true
   ```

For any phase that touches the frontend, capture inline Chrome MCP screenshots of every affected page × every role × every breakpoint (desktop + 375px mobile), including loading, empty, and error states where applicable. Example:

### Page: `/invoices` as `owner` on desktop
[inline screenshot]
Notes: ...

### Page: `/invoices` as `pm` on mobile (375px)
[inline screenshot]
Notes: ...

(repeat for every page × role × breakpoint that this phase touches)

For **backend-only phases** (migrations, API routes, libraries — no UI surface touched), the section reads literally:

> **N/A — backend only.** _Justification: {phase scope excludes UI changes per §{phase-spec reference}; migration/route/lib changes only, no pages touched}._

The "N/A" must be explicit. Omitting the Visual QA section entirely is a gate failure. If a phase is half UI and half backend, include the screenshots for what was touched and do not write "N/A."

---

## Test Results

```
$ npm test
PASS  __tests__/co-status-transitions.test.ts
PASS  __tests__/invoice-info-requested.test.ts
...
Tests:       N passed, 0 failed, N total
Time:        X.Xs
```

New tests added in this phase:
- `co-status-transitions.test.ts` — validates the enum fix
- ...

---

## Console / Logs

Any errors or warnings observed during:
- Dev server startup
- Running the UI
- Running tests
- Executing migrations

---

## Regression Check

Prior-branch tests run: `npm test -- --testPathPattern=branch-[1-{N-1}]`
Result: ✅ All passing

---

## Subagent Reports (if any)

### Schema validator subagent
Ran: `scripts/validate-schema-against-plan.ts`
Result: ✅ All tables/columns/enums match Part 2 of plan
Discrepancies found: 0

### Visual QA subagent
Captured N screenshots across M pages × K roles
Result: See Screenshots section above

---

## Rebuild Decisions (if any)

If any code was rebuilt rather than patched:

- **File/module rebuilt:** `src/lib/...`
- **Why rebuild over patch:** (reference G.5 decision tree)
- **What the rebuild replaced:** summary
- **Test coverage on new code:** ...

---

## Flagged for Jake

Anything Claude Code needs human judgment on:
- Ambiguous requirements that were resolved with a best-guess
- Decisions that could reasonably go the other way
- Found gaps in the plan spec that need Jake's input

---

## Ready for next phase?

✅ YES / ❌ NO / ⚠️ PARTIAL

If NO/PARTIAL: what's blocking and proposed fix.
```

This format is enforced. Claude Code does not skip sections. If a section doesn't apply (e.g., no migrations this phase), mark it "N/A" — don't omit it.

## G.4 Subagent deployment spec

Subagents are used surgically, not broadly. Over-deployment creates coordination bugs and wastes tokens.

### Subagent types defined

**1. Schema Validator Subagent**
- **When:** Any phase that adds or modifies migrations
- **Task:** Read migration files + compare against Part 2 (data model). Validate:
  - Enum values match Part 2 section 2.3
  - Naming follows conventions (Part 2 section 2.1)
  - Every new tenant table has RLS policy
  - Every FK has the expected target
  - No unexpected columns added outside spec
- **Output:** List of discrepancies or "all match"

**2. Visual QA Subagent**
- **When:** Any phase that touches UI
- **Task:** Drive Chrome MCP to capture screenshots of every affected page at:
  - Each role (owner, admin, pm, accounting)
  - Desktop + mobile (375px) breakpoints
  - Loading + empty + error states where applicable
- **Output:** Inline screenshots returned to parent agent for QA file embedding

**3. Test Runner Subagent**
- **When:** Every phase
- **Task:** Run new tests + all existing tests. Collect output. Run regression tests for prior branches (e.g., in Branch 3, re-run Branch 1 and Branch 2 tests).
- **Output:** Test results summary + any failures

**4. Grep/Rename Validator Subagent**
- **When:** Any phase that renames entities, columns, enums, or routes
- **Task:** Grep the entire codebase (src/, migrations/, docs/) for every old name. Report any lingering references.
- **Output:** Zero references found OR list of missed references

**5. Migration Dry-Run Subagent**
- **When:** Any phase that writes new migrations
- **Task:** Apply migration to a scratch DB, run smoke queries, test rollback, then apply to dev DB.
- **Output:** Migration applied cleanly / rollback works / discrepancies noted

**6. Rebuild Impact Analyzer Subagent**
- **When:** Claude Code is considering rebuild over patch (G.5 tree)
- **Task:** Scan all files that depend on the module being considered for rebuild. Report: blast radius (files touched), test coverage on existing code, estimated effort of rebuild vs patch.
- **Output:** Rebuild recommendation with data-backed justification

### Subagent spawning rules

1. **Spawn at the right time** — not at phase start, not at phase end. Spawn when the work the subagent needs to do is ready. Schema validator runs after migrations are written. Visual QA runs after UI code is complete.
2. **Parent agent waits** — don't spawn and proceed. Wait for subagent output before the parent continues.
3. **Subagent output goes in QA file** — every subagent writes to a section of the phase QA file.
4. **Subagent failures block phase completion** — if the schema validator returns discrepancies, the phase is not done.

### When NOT to use subagents

- Simple code edits — keep single-threaded
- Single-file refactors — no coordination benefit
- Phases with trivial scope — overhead > benefit

## G.5 Rebuild decision tree

When Claude Code encounters existing code that needs to change, use this tree:

```
ENCOUNTER EXISTING CODE IN THE MODIFY ZONE
                    │
                    ▼
  ┌─────────────────────────────────┐
  │ Is the existing code's ARCHITECTURE
  │ aligned with the target state   │
  │ (Parts 1 + 2 of this plan)?     │
  └──────────┬──────────────────────┘
             │
      ┌──────┴──────┐
      │             │
      NO            YES
      │             │
      ▼             ▼
  ┌────────┐   ┌──────────────────────────────┐
  │REBUILD │   │ Is the existing code's       │
  │        │   │ IMPLEMENTATION correct, just │
  └────────┘   │ incomplete?                  │
               └──────┬───────────────────────┘
                      │
               ┌──────┴──────┐
               │             │
               NO            YES
               │             │
               ▼             ▼
           ┌────────┐    ┌───────┐
           │REBUILD │    │EXTEND │
           └────────┘    └───────┘
```

**"Architecture aligned"** means:
- Schema matches Part 2 section 2.2 data model
- Names match Part 2 section 2.1 conventions
- Patterns match Part 2 section 2.4 (cents, RLS, soft delete, etc.)
- API shape matches target-state flows (Part 3)

**"Implementation correct"** means:
- Logic is right (just missing features)
- No silent data corruption
- No security holes
- Error handling present

**Default: REBUILD.** The tree is designed to favor rebuild unless both conditions are met (architecture aligned AND implementation correct). This is per your instruction: "default to starting over if necessary rather than calling something done if it's not right."

### Examples

**Example 1: `invoice_extractions` tables**
- Architecture aligned with v1.0 target? NO — needs generalization to `document_extractions` (Branch 3)
- Decision: **REBUILD** (Branch 3 Phase 3.1 renames tables + adds new columns)

**Example 2: G702 math in `draw-calc.ts`**
- Architecture aligned? YES — G702 math is AIA-standard, correctly implemented
- Implementation correct? YES — the 9 lines work correctly
- Decision: **EXTEND** (Branch 6 adds milestone and T&M mode alongside, doesn't touch AIA)

**Example 3: CO status enum**
- Architecture aligned? NO — values don't match Part 2 inventory
- Decision: **REBUILD** (Branch 1 Phase 1.1 aligns enum, migrates data)

**Example 4: Dashboard 503s**
- Architecture aligned? YES — queries shape is right
- Implementation correct? NO — N+1 queries, missing indexes
- Decision: **REBUILD** (the failing code gets replaced with correct queries; patching with a cache would be wrong call)

### When the tree says REBUILD

1. Don't touch the existing code. Branch from main.
2. Write the new implementation from scratch using the plan as spec.
3. Once new code passes its tests, delete the old code in the same PR.
4. QA file documents the rebuild: what was replaced, why, new test coverage.

### When the tree says EXTEND

1. Read the existing code fully before modifying.
2. Additions must not break existing tests.
3. New tests cover the new behavior.
4. Existing code's patterns are maintained (don't mix styles).

## G.6 Branch completion criteria

Each branch has a final exit criterion beyond the sum of its phases. A branch is complete when:

1. Every phase in the branch has ✅ across its exit gate
2. End-to-end test scenario for the branch passes (defined per-branch)
3. Regression tests for all prior branches still pass
4. Branch QA summary file generated (rollup of phase QA files)
5. Branch-level UI walkthrough recorded (every major flow clicked through by role)
6. Jake signs off on the branch summary

**Only then does the next branch start.**

## G.7 Final pre-deploy sweep (Branch 9)

Before v1.0 production deploy, a final safety net runs across all branches. This is a dedicated branch, not a phase within another branch. Specified in Part 5 as Branch 9.

## G.8 gh CLI tooling

The GitHub CLI (`gh`) is installed and authenticated on the Windows dev machine at `C:\Program Files\GitHub CLI\gh.exe`. Claude Code can create issues, PRs, labels, and comments programmatically via `gh issue create`, `gh pr create`, etc., without browser paste cycles. Use the full path if bash PATH does not resolve `gh` directly.

For tech-debt issues discovered during phase execution:

1. Write issue body to `qa-reports/gh-issue-body-phase{N}.{M}.md` during the phase commit.
2. After Jake reviews and approves, create via `gh issue create --repo jakeross838/Ross-Built-Command --title '...' --body-file <stripped-body-file>`.
3. Strip H1 title + meta notes (typically first 4 lines) from the body file before passing as `--body-file`.
4. Wire the resulting issue number into source comments, tests, and QA reports in a follow-up commit.

Added 2026-04-22 after Phase 1.3 installed + authenticated `gh` to eliminate the browser-paste cycle for tracked tech debt.

---

## 0.1 What Nightwork is

Nightwork is a full business operating system for construction companies. It absorbs the functions that today live scattered across Buildertrend, QuickBooks, Adaptive, UDA, Procore, Google Sheets, paper, and tribal knowledge.

The long-term product vision is singular: **one system, one source of truth, every data point usable everywhere.** A vendor invoice is not just an approval task — it's pricing history that feeds future estimates. A daily log is not just a PDF — it's structured data that validates PO approvals, refines schedule forecasts, and scores subcontractor reliability. An architectural plan is not just a reference document — it's quantity takeoff that auto-generates a budget.

The wedge is invoice approval and draws, because that's where builders waste the most hours and money today. Everything else is built progressively on that foundation.

## 0.2 Who Nightwork is for

Any construction business. Full stop.

The architecture must support:
- A solo bathroom remodeler doing $20K/year
- A custom home builder doing $5M–$50M/year (Ross Built's range)
- A production builder doing $200M+/year
- A remodeler doing $500K–$3M/year
- A specialty sub doing electrical-only at any scale

This is an explicit rejection of the "designed for $1.5M–$10M custom builders" framing in the first draft. **Every feature must scale down to simplicity for the solo operator and scale up to power for the enterprise operator.** Configuration beats specialization.

## 0.3 What Nightwork is not

- **Not an accounting replacement.** QuickBooks/Xero keep GL, tax, banking. Nightwork owns the operational layer and syncs financial events to accounting.
- **Not a CAD/BIM tool.** Plans live where they live; Nightwork reads them.
- **Not a scheduling competitor (in feel).** We'll have schedules, but the edge isn't a better Gantt — it's schedule inference from daily logs and auto-updates from approvals.
- **Not a rigid ERP.** Configuration is core. Every workflow, approval chain, cost code scheme, draw mode, and contract type is per-org and often per-job.

## 0.4 The launch-first strategy

We have a full-vision architecture but we ship invoice-to-draw first. Everything else is built on the same architecture, in order.

**What ships in v1.0 (the immediate rebuild — "the launch gate"):**
1. Jobs with contract types and lifecycle phase
2. Cost codes (custom + starter templates)
3. Vendors
4. Budgets (+ drag-to-create from spreadsheets/takeoffs)
5. Purchase orders (manual + drag + CO-spawned)
6. Change orders (manual + drag + budgetary + allowance-overage split)
7. Proposals (new first-class entity — see §1.9)
8. Invoices (manual + drag + two-way match)
9. Draws with three modes: AIA, milestone, percentage (see §1.8)
10. Lien releases
11. Universal document ingestion for everything above
12. Pricing history (simple — every invoice line + proposal line becomes a row)
13. Client portal v1 (read-only job snapshot)
14. Configurable approval chains per org and per role
15. Basic prebuilt reports (the ones everyone needs)
16. Stripe billing, plan limits, Sentry, prompt caching
17. Security hardening, permission defense-in-depth, observability

**What ships after v1.0 dogfood (v1.5 — "the growth gate"):**
18. Plan extraction AI (takeoff)
19. Takeoff → auto-budget generation
20. Proposal builder (first-class creation, not just ingestion)
21. PO templates with embedded subcontractor agreement language
22. QuickBooks two-way sync
23. Advanced cost intelligence (classification, unit conversion, scope-size enrichment) — the 7-tier system becomes an opt-in advanced mode
24. Selections management

**What ships as paying customers drive it (v2.0 — "the OS gate"):**
25. Schedules (with auto-inference from daily logs)
26. Daily logs (structured, not PDFs)
27. Internal labor & timesheets (with geofenced mobile clock-in)
28. Overhead & P&L tracking with allocation methods (labor%, direct cost%, revenue%, direct hours%, equal split, activity-based)
29. AI-PM-oversight layer (flag contradictions between daily logs and approvals)
30. Flexible report builder (query anything, save anything)
31. Client portal v2 (full digital home manual at closeout)

**What ships after Builder 20 traction (v3.0):**
32. Lead management with property-record enrichment (Firecrawl/Apify)
33. Builder group standardized operations exports
34. Email ingestion (vendor-to-inbox intake)
35. Transcript ingestion (meeting notes auto-become tasks/decisions)
36. Submittals, RFIs (only if customers ask)
37. Warranty claim workflow

This split is load-bearing. **The v1.0 architecture must be designed so that v1.5–v3.0 additions are additive, not refactors.** Schema fields, naming conventions, interfaces, and folder structure are set in v1.0 anticipating v3.0. That's Part 1 and Part 2 of this doc.

## 0.5 The cost transfer principle

The biggest barrier to switching to Nightwork is that data lives somewhere else. Every builder considering Nightwork will have an existing system they hate but are trapped in. **Making data transfer cheap is the moat.**

Concrete implications:
- Every entity must have a drag-to-create path (PDF, image, spreadsheet)
- Every entity must have a structured import path (CSV/Excel)
- Imports learn and remember column mappings
- A fresh-start path exists too (no migration required)
- The universal ingestion pipeline is a **Branch 0** architectural decision that everything else builds on

## 0.6 The one-stop-shop principle

Builders today run 5–15 disconnected tools. Nightwork's endgame is being the system builders can run their whole business on, with optional syncs outward (QuickBooks for GL, maybe UDA for estimates until v1.5). **We design for that endgame from v1.0 — we just ship features incrementally.**

---

# PART 1 — TARGET-STATE ARCHITECTURE

This is what Nightwork **is** when complete. Each subsection answers: "what does this workflow look like, industry-grounded, for any builder?"

## 1.1 The project lifecycle (universal)

Every construction project, regardless of builder size or contract type, moves through six phases. Each produces specific data the next phase consumes.

```
┌────────────┐   ┌──────────────────┐   ┌─────────────┐   ┌──────────────┐   ┌──────────┐   ┌──────────┐
│   DESIGN   │──▶│ PRECONSTRUCTION  │──▶│ PROCUREMENT │──▶│ CONSTRUCTION │──▶│ CLOSEOUT │──▶│ WARRANTY │
└────────────┘   └──────────────────┘   └─────────────┘   └──────────────┘   └──────────┘   └──────────┘
  scope            budget (SOV)          committed $       actuals + COs      final draw     service
  drawings         schedule              POs, subs         daily logs         lien release   warranty
  selections       proposals             subcontracts      invoices           closeout pkg   claims
                   contract              lead times        draws              punchlist
                                                           selections         O&M manuals
```

**Job phase enum (`jobs.phase`):**

```
lead → estimating → contracted → pre_construction → in_progress → 
substantially_complete → closed → warranty → archived
```

`jobs.status` stays as a separate simple active/inactive flag. `phase` is the workflow state.

**What Nightwork owns by phase (v1.0):**

| Phase | Nightwork handles | Out of scope v1.0 |
|---|---|---|
| Design | Plan storage, drag-in extraction (v1.5) | CAD editing |
| Preconstruction | Budgets, proposals, contract setup, cost codes | Full estimating engine (v1.5) |
| Procurement | POs, subcontracts, vendor mgmt | — |
| Construction | Invoices, approvals, draws, COs, lien releases | Daily logs (v2.0), schedule (v2.0) |
| Closeout | Final draw, lien releases | Warranty package (v2.0) |
| Warranty | — | Service calls, claims (v3.0) |

## 1.2 Jobs — the container

A job is the universal container for everything. Every piece of data (invoice, PO, CO, proposal, draw, plan, daily log, time entry) is scoped to a job.

### Job-level financial view (the number everyone watches)

Four contract totals:

- **Original contract amount** — what the client signed
- **Approved CO total** — sum of approved owner-facing COs with fees
- **Revised contract amount** — original + approved COs
- **Pending CO total** — sum of pending COs (not yet approved) — the "maybe" number

Five spend totals:

- **Budget** — sum of budget line original estimates (usually equals original contract amount minus GC markup, but may differ)
- **Revised budget** — budget + approved CO line adjustments
- **Committed** — sum of open PO amounts (issued, partial, full)
- **Invoiced** — sum of approved invoice amounts to date
- **Billed to client** — sum of paid + approved draws to date
- **Paid to subs** — sum of paid invoices to date

Two derived totals:

- **Remaining budget** — revised budget − invoiced
- **Projected final cost** — invoiced + committed − invoiced-against-committed + pending COs expected to be approved

The target job detail header:

```
┌──────────────────────────────────────────────────────────────────┐
│ Fish Residence · 715 N Shore Dr · in_progress · Martin Mannix   │
├──────────────────────────────────────────────────────────────────┤
│ CONTRACT                          │ SPEND                        │
│ Original:           $8,950,000    │ Budget:       $8,550,000     │
│ Approved COs:         +$212,000   │ Committed:    $7,850,000     │
│ Revised:            $9,162,000    │ Invoiced:     $6,240,000     │
│ Pending COs:         ~$85,000     │ Billed:       $5,810,000     │
│                                   │ Paid:         $5,400,000     │
├──────────────────────────────────────────────────────────────────┤
│ Projected final cost:  $9,247,000 (+$85K over revised contract)  │
│ Time remaining: ~8 months  ·  Days since start: 312              │
├──────────────────────────────────────────────────────────────────┤
│ [Overview] Budget · Invoices · Draws · COs · POs · Proposals ·   │
│            Vendors · Selections · Plans · Documents · Activity   │
└──────────────────────────────────────────────────────────────────┘
```

**Projected final cost** is the number that eats PMs alive today. Ross Built spends hours per week computing it manually. Nightwork computes it live.

### Job navigation

**Per Jake's feedback:** Jobs should not be a top-nav category. They live in the **left sidebar as a filter**. Top nav shows rollup views ("All invoices", "All draws"). Left sidebar shows per-job scoped navigation.

Layout:

```
┌──────────────────────────────────────────────────────────────────┐
│  [Nightwork × Ross Built logo]  Dashboard  Invoices  Draws  ...  │ ← top nav = rollup
├─────────────┬────────────────────────────────────────────────────┤
│ ALL JOBS    │                                                    │
│             │                                                    │
│ Fish Res.   │  [scoped content when a job is selected]           │ ← left = per-job
│ Johnson Rem.│                                                    │
│ Markgraf ⚠  │                                                    │
│ Gavin Suite │                                                    │
│ + 10 more   │                                                    │
│             │                                                    │
│ [+ New job] │                                                    │
└─────────────┴────────────────────────────────────────────────────┘
```

Clicking "All Jobs" at the top of the sidebar reverts to rollup mode. Clicking a specific job scopes the entire center panel to that job.

### Contract types (per-job setting)

Every job has a contract type that drives draw mode, CO handling, and client-visible detail. This is the single biggest branching point in the system.

Supported contract types (all v1.0):

| Type | How billing works | CO handling | Client sees |
|---|---|---|---|
| `cost_plus_aia` | Monthly AIA G702/G703 against actual costs | COs added to contract amount, billed with markup | Full invoices, cost codes, vendor detail |
| `cost_plus_open_book` | Monthly cost-plus, invoice attachments shared | Same as above | Full invoices, costs |
| `fixed_price` (lump sum) | Milestone draws tied to deliverables | COs add to contract, billed separately or at next milestone | Milestone progress, not invoices |
| `gmp` (guaranteed max) | Monthly AIA-style, but with ceiling and shared savings | COs can only raise ceiling with formal approval | Full cost transparency |
| `time_and_materials` | Hourly rates + material cost + markup | Not typical (scope is open) | Hours, materials, markup |
| `unit_price` | Per-unit billing against measured quantities | Rare — unit-rate adjustments | Per-unit completion |

**The draw module has three modes** (see §1.8) which map to these contract types:

- **AIA mode** — cost_plus_aia, cost_plus_open_book, gmp
- **Milestone mode** — fixed_price, unit_price
- **Time-and-materials mode** — time_and_materials

## 1.3 Cost codes

Cost codes are the universal allocation key. Every dollar spent on a job gets tagged to a cost code. No exceptions — an invoice without a cost code cannot be approved.

### Structure

Org-level cost code list (shared across jobs). Hierarchical with up to 3 tiers:

```
Division (tier 1) → Section (tier 2) → Subsection (tier 3, optional)
03 — Concrete
  03-200 — Cast-in-place concrete
    03-200-100 — Foundations
    03-200-200 — Slabs
```

### Starter templates

New orgs pick a starter template during onboarding. Nightwork ships with four:

1. **Custom Home Builder (simplified)** — 25 codes, loosely MasterFormat-organized. Ross Built's style.
2. **Remodeler (simplified)** — 20 codes focused on trades relevant to renovation.
3. **CSI MasterFormat (full)** — All 50 divisions, ~200 codes. For larger GCs.
4. **Build your own** — Start from empty.

Templates can be applied, then fully edited. The point is zero friction for new users.

### Per-job override

Rarely needed, but supported: a job can add/hide cost codes from its scoped list. Useful for unusual projects.

## 1.4 Vendors

A vendor is any external party you pay or contract. Subs, suppliers, consultants.

### Vendor profile

```
- name, tax_id (EIN or SSN), address
- primary contact (name, email, phone)
- trades (multi-select: framing, plumbing, masonry, ...)
- payment_terms (net 10, net 15, net 30, 5/20, 15/30, custom)
- discount_terms (e.g., "2% net 10")
- COI (cert of insurance) — file, expiration date
- W-9 — file
- default_cost_codes (for auto-mapping common invoice lines)
- notes (free-text, performance comments)
- performance_score (computed — v2.0)
```

### Vendor ingestion

Drop any of the following → extract → pre-filled vendor form:
- W-9 PDF
- Certificate of insurance PDF
- Email signature / business card image
- Buildertrend vendor CSV export
- QuickBooks vendor list CSV

## 1.5 Budgets

A budget is the **schedule of values (SOV)** for a job. Line items by cost code, with an original estimate. Sum of line originals typically equals the contract amount (or contract minus GC markup, for cost-plus).

### Budget line structure

```
budget_line:
  job_id
  cost_code_id
  description (free-text, e.g., "Concrete slab, master garage")
  original_estimate         (cents)
  co_adjustments            (cents, sum of approved CO line amounts touching this line)
  revised_estimate          (original + co_adjustments)
  committed                 (sum of open POs against this line)
  invoiced                  (sum of approved invoices against this line)
  billed_to_client          (sum of this-line amounts in approved draws)
  paid_to_subs              (sum of paid invoices against this line)
  remaining                 (revised_estimate - invoiced)
  over_under                (invoiced - revised_estimate; negative = under)
```

### Budget ingestion

Drag in any of:
- Excel estimate spreadsheet (any column layout — mapping UI learns)
- Buildertrend budget CSV export
- PDF takeoff (v1.0 extracts what it can; v1.5 AI takeoff makes this powerful)
- Another Nightwork org's budget (for template sharing between related companies)

### The "live where-we-really-are" view

Jake's biggest pain point: halfway through a job, figuring out where you truly stand. This requires a **Projected Final** calculation visible on every budget line, not just the job header.

Per line:

```
03-200-100 Foundations    Original: $42,000  Revised: $45,000
  Committed:  $44,500  (1 PO)
  Invoiced:   $38,200  (5 invoices)
  Remaining:   $6,800
  Projected final: $44,500   (takes committed as the likely actual)
  Projected over/under:  -$500 (under)
  
  Pending proposals affecting this line: +$3,200 (1 proposal)
  If approved, projected over/under: +$2,700 (over)
```

This view eats hours of PM spreadsheet work per week.

## 1.6 Purchase orders

A PO is a commitment to a vendor for a specific scope at a specific amount. It locks in price, authorizes procurement, and feeds committed-cost tracking.

### PO structure

```
purchase_order:
  po_number               (auto per-job: PO-001, PO-002...)
  job_id
  vendor_id
  co_id                   (NULLable — set if PO was spawned from an approved CO)
  description             (scope summary)
  status                  (draft | issued | partially_invoiced | fully_invoiced | closed | void)
  amount                  (cents, total commitment)
  invoiced_total          (sum of approved invoice lines against this PO)
  remaining               (amount - invoiced_total)
  issued_date
  terms                   (JSON: payment terms, deposit %, retainage override, milestones)
  plan_version_ref        (references to plan revisions this PO was based on)
  line_items              [
    { cost_code_id, description, quantity, unit, unit_price, amount }
  ]
  template_id             (NULLable — org-level PO template used, embeds sub agreement language)
  vendor_accepted_at      (NULL until vendor accepts — binding agreement)
  source_document_id      (links to document_extraction if drag-created)
```

### PO lifecycle

```
draft ──send──▶ issued ──vendor_accepts──▶ accepted ──work_begins──▶ partially_invoiced ──▶ fully_invoiced ──▶ closed
                                                                                                  │
                                                                                                  ▼
                                                                                                 void (any status, with canVoidPO guard)
```

**Addition from original plan:** the `accepted` status (between issued and partially_invoiced). A PO is not a binding agreement until the vendor accepts. This matters for legal and operational clarity. Nightwork can offer signature-request flows (Branch 6 or v1.5).

### The two-way match

When an invoice arrives linked to a PO:

```
PO Amount:        $44,500
Invoiced to date: $38,200 (from prior approved invoices)
This invoice:     $6,800
PO Remaining after this invoice: $0 — fully invoiced

Match check:      PASS (within PO amount)

If this invoice were $7,500:
Match check:      FAIL — $500 over PO
Requires:         PM acknowledgment with note + maybe a CO or variance PO
```

For non-subcontractor invoices (lumber, hardware, general supplies) that don't have POs, they're classified as **direct charges** and still require a cost code for approval.

### PO creation paths

Three paths in v1.0:

1. **Manual form** — PM fills it in
2. **From an approved CO line** — "Create PO" button on each CO line with new scope; pre-fills job, cost code, amount, description
3. **Drag vendor's signed PO confirmation PDF** — Claude extracts → PM reviews and issues

### PO templates

Org-level templates embed subcontractor agreement language: clean site requirements, schedule adherence, insurance requirements, payment terms. Custom per trade (pool POs have pool-specific language, framing POs have framing-specific).

Not v1.0 — template builder is v1.5. v1.0 has a single default template.

## 1.7 Change orders

A CO modifies the original contract. Four sub-types all supported:

### CO types

| Type | Origin | Hits contract | Hits budget | Client sees |
|---|---|---|---|---|
| `owner_requested` | Owner changes scope | Yes — raises revised contract | Yes | Yes, billed |
| `designer_architect` | Designer/architect change | Yes | Yes | Yes, billed |
| `allowance_overage` | Selection over allowance | Yes | Partial (allowance eats budget, overage is CO) | Yes — the overage |
| `site_condition` | Unforeseen condition | Yes (if owner approves) | Yes | Yes — with documentation |
| `internal` | Budget reallocation | No | Moves amounts between lines | No |

### CO pricing modes

| Mode | When used |
|---|---|
| `hard_priced` | Proposal received, amount is firm |
| `budgetary` | Placeholder while work proceeds; finalized when proposal received |
| `allowance_split` | Auto-generated from an invoice that overruns an allowance cost code |

### CO structure

```
change_order:
  co_number               (auto per-job: CO-001)
  job_id
  co_type                 (owner_requested | designer_architect | allowance_overage | site_condition | internal)
  pricing_mode            (hard_priced | budgetary | allowance_split)
  title
  description
  reason                  (free-text explanation for the change)
  source                  (free-text — who requested)
  amount                  (cents, base amount)
  gc_fee_rate             (decimal, default from job)
  gc_fee_amount           (amount × rate)
  total_with_fee          (amount + gc_fee_amount)
  estimated_days_added
  status                  (draft | pending | approved | denied | void)
  source_invoice_id       (NULLable — set if allowance_split triggered by this invoice)
  source_proposal_id      (NULLable — set if CO is from a vendor proposal)
  source_document_id      (ingestion provenance)
  approved_at, approved_by, denied_at, denied_by, denied_reason
  line_items              [
    { budget_line_id?, cost_code_id, description, amount }
  ]
```

### CO lifecycle

```
draft ──submit──▶ pending ──approve──▶ approved ──▶ (effects cascade)
                     │                     │
                     ├──deny───────────────┘
                     │                     
                     └──create_po_from_line (for new-scope lines)
                                             
Any status ──void──▶ void (with canVoidCO guard)
```

### CO effects on approval

When status flips to `approved`:

1. `jobs.approved_cos_total` increases
2. `jobs.current_contract_amount` updates
3. For each CO line with a `budget_line_id`: that line's `co_adjustments` recomputes
4. For each CO line with a `cost_code_id` but no `budget_line_id`: a new budget line is auto-created
5. If CO type is `allowance_overage`: the source allowance cost code is marked as "fully consumed"
6. Notifications fire: PM, accounting, owner
7. "Create PO from this line" button becomes available on any line with new-scope work

### CO creation paths

1. Manual form
2. From an invoice overage (auto-filled)
3. Drag client-signed CO PDF
4. Drag vendor proposal PDF (creates CO in `draft` with `source_proposal_id`)

## 1.8 Draws (progress billing)

Three draw modes. The draw module detects which mode to use based on `jobs.contract_type`.

### Mode A: AIA mode (G702/G703)

For `cost_plus_aia`, `cost_plus_open_book`, `gmp` contract types.

**The AIA G702 math (all 9 lines):**

```
Line 1   Original Contract Sum                        (from job)
Line 1a  Deposit Amount                               (Nightwork addition; 0 if no deposit)
Line 2   Net Change Orders                            (sum of approved owner COs, total_with_fee)
Line 3   Contract Sum to Date                         = Line 1 + Line 2
Line 4   Total Completed & Stored                     (from G703 detail)
Line 5a  Retainage on Completed                       (if not final: retainage_pct × Line 4)
Line 5b  Retainage on Stored                          (separate % if stored materials tracked)
Line 5c  Total Retainage                              = 5a + 5b
Line 6   Total Earned less Retainage                  = Line 4 − Line 5c
Line 7   Less Previous Certificates                   (sum of prior draws' current_payment_due)
Line 8   CURRENT PAYMENT DUE                          = Line 6 − Line 7
Line 9   Balance to Finish                            = Line 3 − Line 4 + Line 5c
```

**G703 (per budget line):**

```
Col A   Item No.
Col B   Description
Col C   Scheduled Value      (budget_line.revised_estimate)
Col D   Previous Applications (sum of prior draws' this_period for this line)
Col E   This Period          (sum of invoices in period for this line)
Col F   Materials Stored     (optional)
Col G   Total Completed      = D + E + F
Col H   % Complete           = G ÷ C
Col I   Balance to Finish    = C − G
Col J   Retainage
```

### Mode B: Milestone mode

For `fixed_price`, `unit_price` contract types.

**Pre-defined milestones** set at contract time:

```
milestone_1: "Mobilization + foundation"   10% of contract = $500,000
milestone_2: "Structural + roofing"         20% = $1,000,000
milestone_3: "Rough-in MEP"                 20% = $1,000,000
milestone_4: "Drywall + interior finishes"  30% = $1,500,000
milestone_5: "Completion + punchlist"       20% = $1,000,000
```

Each draw claims completion of one or more milestones. The draw form asks: which milestones are done this period? Auto-computes billing amount.

**Client visibility:** Client sees milestone completion, not invoice detail. They approve based on observable progress, not cost breakdown.

**Cost tracking still happens internally:** Invoices, POs, COs all still track by cost code. The client just doesn't see them. When a milestone draw goes out, the builder privately knows their margin on that milestone.

### Mode C: Time-and-materials mode

For `time_and_materials` contract type.

**Billing basis:** hours worked × labor rates + materials at cost × markup + subcontractor costs × markup.

**Draw period typically weekly or bi-weekly** (faster than AIA's monthly).

**Structure:** Flat line items (not AIA-style) — labor hours per code, material line items with markup, sub costs with markup. Not-to-exceed (NTE) clause support.

### Draw structure (unified across modes)

```
draw:
  job_id
  draw_number, revision_number, parent_draw_id
  draw_mode               (aia | milestone | tm)
  period_start, period_end, application_date
  is_final_draw
  status                  (draft | pm_review | submitted | approved | locked | paid | void)
  wizard_draft            (JSONB, auto-saved progress)
  
  # AIA snapshots (if mode=aia)
  g702_snapshot           (JSONB with all 9 line values locked at submit)
  g703_lines              (via draw_line_items)
  
  # Milestone snapshots (if mode=milestone)
  milestone_completions   [{ milestone_id, percent_complete, amount_claimed }]
  
  # T&M snapshots (if mode=tm)
  tm_summary              (labor_hours, material_cost, sub_cost, markup)
  
  # Shared
  cover_letter_rendered
  lien_releases           (via lien_releases table)
  attachments             (invoices stamped for open-book; other supporting docs)
  
  current_payment_due
  notes
```

### Draw lifecycle (all modes)

```
┌───────┐  ┌───────────┐  ┌──────────┐  ┌─────────┐  ┌───────┐  ┌──────┐
│ DRAFT │──▶│ PM_REVIEW │──▶│ SUBMITTED │──▶│APPROVED │──▶│LOCKED │──▶│ PAID │
└───────┘  └───────────┘  └──────────┘  └─────────┘  └───────┘  └──────┘
                              │
                              ▼ (if revision needed after submission)
                          REVISION CREATED (new draw with revision_number+1)

Any non-locked ──▶ void (with canVoidDraw guard)
```

### Invoice → Draw transactional atomicity

Today: draw submission kicks off lien release generation, invoice status updates, notifications — non-transactional. Any failure partial-commits. **Branch 1 wraps this in a Postgres RPC transaction** (`draw_submit_rpc`) so partial failures roll back everything.

## 1.9 Proposals — new first-class entity

**This is a major addition from the original plan.** Jake correctly pointed out that proposals/quotes are the richest source of pricing data for labor/sub work. Invoices are usually one-line bills against a PO; proposals contain the actual scope + unit pricing + reasoning.

### Proposal structure

```
proposal:
  job_id
  vendor_id
  title                   ("Fish Pool Package")
  received_date
  status                  (received | under_review | accepted | rejected | superseded | converted_to_po)
  amount                  (total proposed)
  valid_through           (expiration date from vendor)
  
  scope_summary           (free-text)
  exclusions              (what's NOT included)
  inclusions              (what IS included)
  terms                   (deposit, payment schedule, warranty)
  plan_version_referenced (which plan revision)
  
  line_items              [
    {
      cost_code_id,
      description,
      quantity,
      unit,
      unit_price,
      amount,
      scope_detail         (long-form)
    }
  ]
  
  source_document_id      (ingestion provenance — PDF it came from)
  converted_po_id         (if status=converted_to_po)
  converted_co_id         (if this proposal drove a CO)
  
  notes                   (internal PM comments)
```

### Proposal lifecycle

```
received ──review──▶ under_review ──accept──▶ accepted ──convert──▶ PO created or CO created
                         │                                       (converted_to_po or converted_co)
                         ├──reject──▶ rejected
                         │
                         └──revise──▶ superseded (new version arrives, old becomes superseded)
```

### Why proposals are first-class

1. **Pricing intelligence source.** Every proposal line becomes a row in `pricing_history` (see §1.10). Future estimates benchmark against it.
2. **CO driver.** A vendor proposal often drives a CO (when scope wasn't in original contract). Proposal → CO pipeline is direct.
3. **PO origin.** When a proposal is accepted, converting it to a PO is one click (line items, scope, amount carry over).
4. **Estimation input.** In v1.5, when plans are extracted and a budget is auto-generated, prior proposal data lets Nightwork suggest "send this to vendor X, they bid it at $Y last time."
5. **Bid comparison.** Same scope from 3 vendors → side-by-side comparison view (v1.0 basic, v1.5 advanced).

### Proposal ingestion

Drag any PDF/email/image → Claude classifies as proposal → extracts structure → PM reviews and accepts/rejects.

Multi-page proposals with schedule of values are handled: each line becomes a proposal line item.

## 1.10 Cost intelligence — the simple version

**This replaces the over-engineered 7-tier classification system with a pragmatic pricing history model.** The advanced classification system stays in the schema as an opt-in advanced mode (v1.5+).

### Core principle

Every invoice line and every proposal line becomes a row in `pricing_history`. No classification required. No verification required. Zero friction.

### Structure

```
pricing_history:
  source_type             (invoice | proposal | po | co)
  source_id               (references the originating record)
  job_id
  vendor_id
  cost_code_id
  description             (raw text from the source doc)
  quantity                (if extractable)
  unit                    (if extractable)
  unit_price              (if extractable — computed if quantity + unit present)
  amount                  (cents, total line amount)
  date                    (invoice date / proposal date)
  
  # Optional classification (populated only in advanced mode)
  canonical_item_id       (NULLable — link to items table if classified)
  confidence              (NULLable)
```

### Query surfaces (v1.0)

**1. On budget page (per line):**
```
03-200 Concrete Slabs
Last 5 jobs avg cost: $18,400 (range: $16,200 – $21,800)
This job budget:      $19,500 — in range ✓
```

**2. On invoice approval (per line):**
```
Kimmel Lumber · 2x4x16 PT
This invoice: $8.40/ea
Your last 3 purchases from Kimmel: $7.90, $8.10, $8.20 (avg $8.07)
This is 4% above recent avg — normal variance
```

**3. On vendor page:**
```
LaPensee Plumbing — Pricing history across 8 jobs
Most common line items:
  Rough-in plumbing (avg $8,200 per 2,500 SF house)
  Finish plumbing (avg $4,800)
  Fixture install (ranged $2,100 – $3,400)
```

**4. Free-text search:**
```
"Show me what I paid for 5V crimp metal roofing on jobs over 3000 SF"
→ Table of matching lines with job, vendor, date, amount, $/SF
```

### Advanced mode (v1.5+)

The existing 7-tier classification system becomes opt-in. Users who want canonical item taxonomy, unit conversion templates, BOM attachments, scope-size enrichment, etc. can turn it on per-org. Most users never need it.

## 1.11 Universal document ingestion

**The moat.** Every document type routes through one pipeline.

### The architecture

```
┌─────────────────────────────────────────────────────────────────┐
│ INGEST ENTRY POINTS                                             │
│                                                                 │
│ • Global "+ Add" button → drop anything                         │
│ • Drag onto any list page → scoped to that entity               │
│ • Email to {org-slug}@inbox.nightwork.build (v1.5)              │
│ • Folder sync with Google Drive / Dropbox (v1.5)                │
└──────────────────────────────┬──────────────────────────────────┘
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│ CLASSIFY                                                        │
│                                                                 │
│ Claude Vision reads the first page.                             │
│ Classifies: invoice | po | co | proposal | vendor | budget |    │
│             historical_draw | plan | contract | other           │
│ Confidence score attached.                                      │
└──────────────────────────────┬──────────────────────────────────┘
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│ ROUTE                                                           │
│                                                                 │
│ High confidence (≥0.90):  auto-route to entity pipeline         │
│ Medium (0.70–0.89):       route with user-confirmation step     │
│ Low (<0.70):              user picks type manually              │
└──────────────────────────────┬──────────────────────────────────┘
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│ PER-ENTITY EXTRACTION                                           │
│                                                                 │
│ Each entity has its own extraction prompt + target schema.      │
│ All share the underlying tables:                                │
│                                                                 │
│   document_extractions                                          │
│     → target_entity_type: invoice | po | co | proposal | ...   │
│     → target_entity_id: set on commit                           │
│   document_extraction_lines                                     │
│     → per-line details                                          │
│                                                                 │
└──────────────────────────────┬──────────────────────────────────┘
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│ VERIFY + COMMIT                                                 │
│                                                                 │
│ User sees entity-appropriate pre-filled form.                   │
│ Reviews, corrects, approves.                                    │
│ Commit creates the target entity; source_document_id retained.  │
└─────────────────────────────────────────────────────────────────┘
```

### Structured imports (CSV/Excel)

Separate from document ingestion — these use column mapping:

```
CSV IMPORT WIZARD:
  1. Drop file → preview first 10 rows
  2. Map columns → Nightwork fields (smart defaults learned)
  3. Validate → duplicate detection, required fields, numeric parsing
  4. Preview → show what will be created
  5. Commit → bulk insert with progress bar
  6. Save mapping → reuse for next import from same source
```

Supported import types (v1.0):
- Cost codes (from Buildertrend export)
- Vendors (from Buildertrend/QuickBooks export)
- Budget lines (from Buildertrend export or Excel)
- Purchase orders (from Buildertrend export)
- Historical invoices (bulk PDF upload)
- Historical draws (bulk PDF upload)

### Migration paths

1. **Buildertrend migration** — full export of budgets, POs, vendors, cost codes, invoices, daily logs. Mapping learned.
2. **QuickBooks migration** — vendors, cost codes, invoices.
3. **Procore migration** — budgets, POs, vendors (CSV export).
4. **Fresh start** — skip migration; onboard progressively.
5. **Spreadsheet-first** — drop Excel files, let extraction do the work.

## 1.12 Approval chains — configurable

Every org configures approval chains per workflow. This is core to Nightwork's fit-everyone goal.

### Approval chain entity

```
approval_chain:
  org_id
  workflow_type           (invoice_pm | invoice_qa | co | draw | po | proposal)
  name                    ("Standard invoice PM approval")
  is_default              (boolean)
  conditions              (JSONB — e.g., "when amount > $10000 require owner")
  stages                  [
    {
      order,
      required_roles,      (array of role names — any of these can approve)
      required_users,      (array of specific user IDs — any of these)
      all_required,        (boolean — all must approve vs. any)
      auto_advance_after,  (minutes — skip if no action)
      on_approve_status,   (next status)
      on_reject_status     (rejection status)
    }
  ]
```

### Example chains

**Simple (Ross Built):**
```
Invoice PM chain: PM approves → accounting approves → auto-advance to ready
Invoice QA chain: Accounting approves → ready to pay
CO chain: PM submits → owner OR admin approves
Draw chain: PM builds → owner approves → owner locks
```

**Larger GC:**
```
Invoice PM chain: PM → Senior PM (if amount > $25K) → Accounting → ready
CO chain: PM → Owner (if amount < $10K) OR Owner + Project Executive (if amount ≥ $10K)
Draw chain: PM → Controller → Owner → locked
```

**Solo remodeler:**
```
Invoice: Owner approves → ready (single-step)
CO: Owner approves
Draw: Owner builds + sends
```

### Implementation principle

**Recalculate, don't increment.** Approval state is derived from the chain definition + the stamped approvals, not stored as a separate "current stage" column that could drift. On any read, recompute current stage.

## 1.13 Permissions — defense in depth

Four enforcement layers. All must pass.

```
1. MIDDLEWARE (route-level)          Can user load this URL at all?
2. PAGE (server component)           Show/hide UI based on role
3. API ROUTE (explicit check)        requireRole() at top of every mutation
4. DATABASE (RLS policies)           Last line of defense
```

### Role matrix

| Action | Owner | Admin | PM | Accounting | Superintendent | Field |
|---|---|---|---|---|---|---|
| Create/edit job | ✓ | ✓ | — | — | — | — |
| Approve CO | ✓ | ✓ | — | — | — | — |
| Submit CO | ✓ | ✓ | ✓ (own job) | — | — | — |
| Invoice PM approval | ✓ | ✓ | ✓ (own job) | — | — | — |
| Invoice QA approval | ✓ | ✓ | — | ✓ | — | — |
| Create PO | ✓ | ✓ | ✓ (own job) | — | — | — |
| Issue/void PO | ✓ | ✓ | — | — | — | — |
| Create draw | ✓ | ✓ | ✓ (own job) | ✓ | — | — |
| Submit draw | ✓ | ✓ | ✓ (own job) | — | — | — |
| Approve draw | ✓ | ✓ | — | — | — | — |
| Mark draw paid | ✓ | ✓ | — | ✓ | — | — |
| Edit budget | ✓ | ✓ | — | — | — | — |
| View financials | ✓ | ✓ | ✓ | ✓ | (configurable) | — |
| Manage vendors | ✓ | ✓ | — | ✓ | — | — |
| Create proposal | ✓ | ✓ | ✓ (own job) | — | — | — |
| Daily log (v2.0) | ✓ | ✓ | ✓ | — | ✓ | ✓ |
| Time entry (v2.0) | ✓ | ✓ | ✓ | — | ✓ | ✓ |
| Billing settings | ✓ | — | — | — | — | — |
| Team management | ✓ | ✓ | — | — | — | — |

**Two new roles for v2.0:** `superintendent` and `field`. Superintendent sees schedules, daily logs, and assigned POs for their jobs. Field sees only their time entries and assigned daily log tasks. Not enforced in v1.0 but schema supports them.

### Configurable view scopes

Superintendents/PMs seeing financials is **configurable per org**. Some builders want full transparency; others want to hide margins from PMs.

## 1.14 Client portal v1

**Read-only job snapshot for clients.** Separate subdomain or URL. Client authenticates with invite link.

### What clients see (configurable by builder)

```
- Job overview: name, address, phase, % complete
- Schedule (high-level; milestones + key dates, not every task)
- Budget: contract amount, revised amount, paid-to-date (configurable)
- Selections (v1.5; v1.0 shows placeholder)
- Daily updates (v2.0; v1.0 shows PM-written weekly updates)
- Photos organized by date / phase
- Change orders: status, amount, description (configurable to hide internal ones)
- Invoices: hidden by default; shown for cost-plus open-book (configurable)
- Documents: plans, selection sheets, warranty info
- Messages: direct communication with PM
- Approvals: e-sign COs, selections
```

### Per-client per-job visibility config

Each org sets defaults; each job can override; each client can be further restricted. This maps to Buildertrend's approach and customers expect it.

## 1.15 Reporting

### v1.0 — Prebuilt reports (the essentials)

Every builder needs these:

1. **Job P&L summary** — per job: revenue, direct cost, gross margin, gross margin %
2. **Budget vs actual by cost code** — per job, all jobs rollup
3. **Aging report** — invoices outstanding by age
4. **Cash flow forecast** — projected payments in/out over next 60 days
5. **Committed vs invoiced** — what's committed but not yet billed
6. **Vendor performance** — vendors ranked by spend, on-time payment
7. **Draw history** — all draws across all jobs with amounts and status
8. **CO log** — per job CO register (for documentation)
9. **Work in progress (WIP)** — industry-standard WIP report (cost + revenue + % complete)

### v2.0 — Flexible report builder

No-code query tool. Pick dimensions (job, vendor, cost code, date range, role). Pick measures (amount, count, hours). Pick chart or table. Save as a named report. Share with team.

## 1.16 Mobile / field

Not v1.0 first priority but considered architecturally.

- Everything must work on mobile browsers (responsive design, already in place)
- Native apps are a v2.0+ decision if usage warrants it
- Field roles primarily enter daily logs and time (v2.0 features)
- PM/owner mobile is for: quick invoice approvals, viewing job status, messaging

---

# PART 2 — DATA MODEL & NAMING CONVENTIONS

This is the schema reference. Every table, every column, every naming choice is documented here so any engineer (human or AI) can understand the architecture in one read.

## 2.1 Naming conventions

| Category | Convention | Examples |
|---|---|---|
| Tables | `snake_case`, plural | `invoices`, `purchase_orders`, `pricing_history` |
| Columns | `snake_case` | `created_at`, `revised_estimate` |
| Booleans | `is_`, `has_`, `can_` | `is_final_draw`, `has_lien_release` |
| Timestamps | `_at` suffix | `created_at`, `approved_at`, `locked_at` |
| Foreign keys | `{entity}_id` | `job_id`, `vendor_id` |
| Enum CHECK values | `lowercase_snake` | `'pending_approval'`, `'in_draw'` |
| Money | `_amount` or `_total` in **cents** | `total_amount` (cents), `paid_amount` (cents) |
| Percentages | `_rate` (decimal 0-1) or `_percent` (0-100) | `gc_fee_rate` (0.15), `retainage_percent` (10) |
| Arrays of IDs | `_ids` plural | `approver_ids` |
| JSONB | `_data` or `_snapshot` suffix | `proposal_data`, `g702_snapshot` |
| History / audit | `status_history` JSONB on every mutable entity | |
| Soft delete | `deleted_at` nullable timestamp on every tenant entity | |
| Created_by | `created_by` uuid on every entity | |

## 2.2 Core entity tables

### Organizations & users

```
organizations
  id, name, slug, plan, stripe_customer_id, plan_limits JSONB,
  cost_intelligence_settings JSONB, default_cost_code_template,
  contract_type_defaults JSONB, logo_url, brand_colors JSONB,
  created_at, deleted_at

org_members
  id, org_id, user_id, role, email_notifications_enabled,
  created_at, deleted_at
  
profiles
  id (= auth.users.id), email, full_name, phone, avatar_url
```

### Jobs

```
jobs
  id, org_id, job_number (auto per-org), name, address,
  contract_type (enum),
  phase (enum: lead | estimating | contracted | pre_construction | in_progress | substantially_complete | closed | warranty | archived),
  status (active | inactive),
  original_contract_amount,
  approved_cos_total (trigger-maintained),
  current_contract_amount (= original + approved_cos_total, generated),
  retainage_percent (job-level override of org default),
  retainage_threshold_percent (when retainage drops — e.g., "at 50% complete, drop to 5%"),
  deposit_amount,
  gc_fee_percentage (for COs),
  previous_change_orders_total (for imported jobs),
  previous_co_completed_amount (for imported jobs),
  client_id, pm_id, superintendent_id,
  start_date, target_completion_date, actual_completion_date,
  heated_sf, total_sf, roof_sf, (enrichment fields; optional),
  created_at, created_by, status_history, deleted_at
  
job_characteristics (optional per-job metadata)
  id, job_id, characteristic_type, value, source, confidence
```

### Cost codes

```
cost_codes
  id, org_id, code (unique per org), name, parent_id (for hierarchy),
  is_allowance (boolean — for allowance overage tracking),
  default_allowance_amount (if is_allowance),
  sort_order, created_at, created_by, deleted_at

# Job-level overrides (rare)
job_cost_codes
  job_id, cost_code_id, is_excluded, override_description
```

### Vendors

```
vendors
  id, org_id, name, legal_name, tax_id, tax_id_type (ein|ssn),
  address JSONB, primary_contact_name, primary_contact_email, primary_contact_phone,
  trades TEXT[],
  payment_terms (text), discount_terms (text),
  default_cost_code_ids UUID[],
  coi_file_url, coi_expires_at,
  w9_file_url,
  performance_score NUMERIC, (computed, v2.0)
  qb_vendor_id (for future QB sync; nullable),
  notes, created_at, created_by, status_history, deleted_at
```

### Budgets

```
budget_lines
  id, job_id, cost_code_id, description,
  original_estimate (cents),
  co_adjustments (cents, trigger-maintained),
  revised_estimate (generated: original + co_adjustments),
  committed (cents, trigger-maintained),
  invoiced (cents, trigger-maintained),
  billed_to_client (cents, trigger-maintained),
  paid_to_subs (cents, trigger-maintained),
  is_allowance (inherited from cost_code, or override per line),
  sort_order,
  created_at, created_by, status_history, deleted_at
```

### Purchase orders

```
purchase_orders
  id, org_id, job_id, vendor_id, co_id (nullable),
  po_number (auto per-job),
  description, status,
  amount (cents, total),
  invoiced_total (cents, trigger-maintained),
  issued_date, accepted_date, closed_date,
  terms JSONB (payment terms, deposit %, retainage override),
  plan_version_ref TEXT,
  template_id (nullable — for future PO templates),
  source_document_id (ingestion provenance),
  created_at, created_by, status_history, deleted_at

purchase_order_line_items
  id, purchase_order_id, cost_code_id, description,
  quantity, unit, unit_price, amount (cents),
  sort_order
```

### Change orders

```
change_orders
  id, org_id, job_id,
  co_number (auto per-job),
  co_type (owner_requested | designer_architect | allowance_overage | site_condition | internal),
  pricing_mode (hard_priced | budgetary | allowance_split),
  title, description, reason, source,
  amount (cents, base),
  gc_fee_rate (decimal), gc_fee_amount (generated), total_with_fee (generated),
  estimated_days_added,
  status (draft | pending | approved | denied | void),
  approved_at, approved_by, denied_at, denied_by, denied_reason,
  source_invoice_id, source_proposal_id, source_document_id,
  draw_number (if applied to a draw), application_number,
  created_at, created_by, status_history, deleted_at

change_order_lines
  id, co_id, budget_line_id (nullable — null if new scope),
  cost_code_id, description,
  amount (cents), sort_order,
  created_po_id (nullable — if a PO was spawned from this line)
```

### Proposals (new first-class)

```
proposals
  id, org_id, job_id, vendor_id,
  proposal_number (auto per-job),
  title, received_date, valid_through, status,
  amount (cents),
  scope_summary, inclusions, exclusions, terms,
  plan_version_referenced,
  converted_po_id (nullable), converted_co_id (nullable),
  superseded_by_proposal_id (nullable),
  source_document_id (ingestion provenance),
  notes,
  created_at, created_by, status_history, deleted_at

proposal_line_items
  id, proposal_id, cost_code_id, description,
  quantity, unit, unit_price, amount (cents),
  scope_detail,
  sort_order
```

### Invoices

```
invoices
  id, org_id, job_id, vendor_id,
  invoice_number (from vendor), po_id (nullable — for two-way match),
  co_id (nullable — if this invoice is a CO-funded cost),
  received_date, invoice_date, due_date,
  status (see §1.7.1 in audit — full enum),
  total_amount (cents, extracted),
  ai_parsed_total_amount (what AI said; for variance flagging),
  confidence_score (from parse),
  payment_status (unpaid | scheduled | partial | paid),
  scheduled_payment_date, payment_date, payment_amount, payment_method, payment_reference,
  draw_id (nullable, set when in_draw),
  is_potential_duplicate, duplicate_reason,
  notes,
  source_document_id, file_url,
  qb_bill_id (for future QB sync; nullable),
  created_at, created_by, status_history, deleted_at

invoice_line_items
  id, invoice_id, cost_code_id, po_id (for matching),
  description,
  quantity, unit, unit_price, amount (cents),
  is_allocated_overhead (for tax/delivery allocation),
  sort_order
```

### Draws

```
draws
  id, org_id, job_id,
  draw_number, revision_number, parent_draw_id (for revisions),
  draw_mode (aia | milestone | tm),
  period_start, period_end, application_date,
  is_final_draw, status,
  wizard_draft JSONB,
  
  # AIA fields (all snapshot at submit)
  original_contract_sum, deposit_amount, net_change_orders,
  contract_sum_to_date, total_completed_to_date,
  retainage_on_completed, retainage_on_stored, total_retainage,
  total_earned_less_retainage, less_previous_certificates,
  current_payment_due, balance_to_finish,
  
  # Milestone fields
  milestone_completions JSONB (array of {milestone_id, percent, amount}),
  
  # T&M fields
  tm_labor_hours, tm_material_cost, tm_sub_cost, tm_markup_amount,
  
  cover_letter_rendered, cover_letter_template_id,
  notes,
  submitted_at, approved_at, approved_by, locked_at, paid_at,
  created_at, created_by, status_history, deleted_at

draw_line_items
  id, draw_id,
  source_type (budget_line | internal | change_order),
  budget_line_id (nullable),
  description, scheduled_value, previous_applications,
  this_period, materials_stored, total_completed,
  balance_to_finish, retainage,
  override_reason,
  sort_order
  
job_milestones (for milestone mode)
  id, job_id, order, name, description, amount_cents,
  target_date, completed_date, status
```

### Lien releases

```
lien_releases
  id, org_id, draw_id, vendor_id,
  release_type (conditional_progress | unconditional_progress | conditional_final | unconditional_final),
  status (pending | received | waived | not_required),
  through_date, amount,
  received_at, received_by, waived_at, waived_by,
  document_url, document_uploaded_at,
  created_at, deleted_at
```

### Universal ingestion

```
document_extractions
  id, org_id, uploaded_by,
  original_file_url, original_filename, file_type, file_size,
  classified_type (invoice | purchase_order | change_order | proposal | vendor | budget | historical_draw | plan | contract | other),
  classification_confidence,
  target_entity_type (same enum as classified_type), target_entity_id (set on commit),
  verification_status (pending | verified | committed | rejected),
  extracted_data JSONB (full AI output),
  skipped_lines JSONB (lines the extraction deliberately skipped, like payment notes),
  error_message,
  created_at, committed_at, rejected_at

document_extraction_lines
  id, document_extraction_id,
  raw_description, raw_quantity, raw_unit, raw_unit_price, raw_amount,
  line_nature (material | labor | scope | equipment | service | bom_spec | unclassified),
  proposed_cost_code_id, proposed_vendor_id,
  target_line_id (set on commit, references entity line row),
  verification_status (pending | verified | corrected | rejected | auto_committed | not_item),
  match_confidence_score,
  classification_confidence,
  sort_order,
  created_at, verified_at, verified_by
```

### Pricing history (the simple cost intelligence)

```
pricing_history
  id, org_id, job_id,
  source_type (invoice | proposal | po | co),
  source_id UUID, source_line_id UUID,
  vendor_id, cost_code_id,
  description,
  quantity, unit, unit_price, amount (cents),
  date,
  
  # Advanced mode fields (populated only if advanced cost intelligence enabled)
  canonical_item_id UUID, match_confidence,
  
  created_at
```

### Approval chains

```
approval_chains
  id, org_id, workflow_type, name, is_default,
  conditions JSONB, stages JSONB (array of stage defs),
  created_at, created_by, deleted_at

approval_actions (audit log)
  id, entity_type, entity_id,
  stage_order, action (approve | reject | skip | delegate),
  actor_user_id, actor_role,
  comment, acted_at
```

### Notifications

```
notifications
  id, org_id, user_id, type, title, body, read, action_url,
  created_at
```

### Usage & API tracking (for pricing analysis)

```
api_usage
  id, org_id, user_id, request_path, model_used,
  input_tokens, output_tokens, estimated_cost_cents,
  duration_ms, status, metadata JSONB,
  created_at

org_usage_daily (aggregated for dashboards)
  org_id, date, api_calls, api_cost_cents,
  documents_ingested, documents_by_type JSONB,
  active_users, jobs_active
```

### V2.0 schema hooks (stubs present in v1.0)

These tables are created empty in v1.0 to lock in naming. Populated in v2.0.

```
daily_logs (v2.0)
schedule_items (v2.0)
time_entries (v2.0)
selections (v1.5)
plans (v1.5)
takeoff_extractions (v1.5)
overhead_pools (v2.0)
overhead_allocations (v2.0)
client_portal_access (v1.0)
client_portal_messages (v1.0)
```

## 2.3 Enum inventory (all in one place)

Every CHECK constraint in the system, documented. Changes to enums require a migration.

```sql
-- jobs.phase
('lead','estimating','contracted','pre_construction','in_progress','substantially_complete','closed','warranty','archived')

-- jobs.contract_type
('cost_plus_aia','cost_plus_open_book','fixed_price','gmp','time_and_materials','unit_price')

-- jobs.status
('active','inactive')

-- invoices.status
(
  'import_queued','import_parsing','import_parsed','import_duplicate','import_error',
  'pm_review','pm_approved','pm_held','pm_denied',
  'qa_review','qa_approved','qa_kicked_back',
  'info_requested','info_received',
  'in_draw','paid','void'
)

-- invoices.payment_status
('unpaid','scheduled','partial','paid')

-- change_orders.status
('draft','pending','approved','denied','void')

-- change_orders.co_type
('owner_requested','designer_architect','allowance_overage','site_condition','internal')

-- change_orders.pricing_mode
('hard_priced','budgetary','allowance_split')

-- purchase_orders.status
('draft','issued','accepted','partially_invoiced','fully_invoiced','closed','void')

-- proposals.status
('received','under_review','accepted','rejected','superseded','converted_to_po','converted_to_co')

-- draws.status
('draft','pm_review','submitted','approved','locked','paid','void')

-- draws.draw_mode
('aia','milestone','tm')

-- lien_releases.status
('pending','received','waived','not_required')

-- lien_releases.release_type
('conditional_progress','unconditional_progress','conditional_final','unconditional_final')

-- document_extractions.classified_type
('invoice','purchase_order','change_order','proposal','vendor','budget','historical_draw','plan','contract','other')

-- document_extractions.verification_status
('pending','verified','committed','rejected')

-- document_extraction_lines.verification_status
('pending','verified','corrected','rejected','auto_committed','not_item')

-- document_extraction_lines.line_nature
('material','labor','scope','equipment','service','bom_spec','unclassified')

-- org_members.role
('owner','admin','pm','accounting','superintendent','field')

-- approval_chains.workflow_type
('invoice_pm','invoice_qa','co','draw','po','proposal')

-- pricing_history.source_type
('invoice','proposal','po','co')
```

## 2.4 Shared architectural patterns

These patterns apply to every entity. Audit any deviation.

1. **Amounts in cents.** Never float. Never dollars. Displayed as dollars via format helpers.
2. **Optimistic locking** via `expected_updated_at` in PATCH requests. 409 Conflict on mismatch.
3. **Soft delete** via `deleted_at` timestamp. RLS filters it out automatically.
4. **Audit trail** via `status_history` JSONB column, appended to on every status change.
5. **`created_by`** on every entity. Never null for rows created after 2026-04-22.
6. **Trigger-maintained caches** for hot paths (never stored for non-hot data — recalculate). Documented per table.
7. **Generated columns** for derivations that must be consistent (`revised_estimate`, `total_with_fee`).
8. **JSONB for flexibility, columns for filtering.** Don't JSONB a field you need to query by.
9. **Org-scoped everything.** Every tenant table has `org_id` + RLS filter.
10. **Source document provenance.** Every entity that could be drag-created has `source_document_id`.

---

# PART 3 — DATA FLOW DIAGRAMS

How information moves through Nightwork. These are the flows every engineer and support person needs to understand.

## 3.1 Invoice end-to-end flow

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. INTAKE                                                       │
│    Source: email attachment, drag-drop, bulk upload, portal     │
│    Creates: document_extraction row with classified_type=invoice│
└──────────────────────────────┬──────────────────────────────────┘
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│ 2. PARSE (Claude Vision)                                        │
│    Extracts: vendor, invoice#, dates, line items, suggested     │
│              cost codes, probable PO match                      │
│    Writes: document_extraction_lines (raw + proposed fields)    │
│    Flags: duplicate (vendor+amount+date match)                  │
└──────────────────────────────┬──────────────────────────────────┘
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│ 3. ROUTING                                                      │
│    High confidence + PO matched + in budget:                    │
│       → auto-advance to qa_review                               │
│    Otherwise:                                                   │
│       → pm_review                                               │
└──────────────────────────────┬──────────────────────────────────┘
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│ 4. PM REVIEW                                                    │
│    UI shows: vendor, amount, job, cost code, PO match status,   │
│              budget vs actual impact, pricing history context   │
│    Actions: approve / deny / hold / request-info / split / edit │
│    Blockers: no cost code, no job, PO overage w/o ack           │
│    Writes: invoice_line_items, invoice status, status_history   │
│    Fires: notification to accounting/admin/owner on approval    │
└──────────────────────────────┬──────────────────────────────────┘
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│ 5. QA / ACCOUNTING REVIEW                                       │
│    UI shows: everything PM saw + lien release status,           │
│              W-9/COI status, payment terms                      │
│    Actions: approve / kick-back-to-pm                           │
│    On approve: status → qa_approved                             │
│    Auto-updates: budget_lines.invoiced, po.invoiced_total,      │
│                  pricing_history (per invoice line)             │
└──────────────────────────────┬──────────────────────────────────┘
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│ 6. PAYMENT SCHEDULING                                           │
│    Per org payment rule (5/20, 15/30, net 15, etc):             │
│    scheduled_payment_date computed, payment_status=scheduled    │
└──────────────────────────────┬──────────────────────────────────┘
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│ 7. DRAW INCLUSION                                               │
│    When PM builds draw for the period:                          │
│       qa_approved invoices for this job, this period, become    │
│       eligible line items                                       │
│    On draw submit: invoice.status → in_draw, draw_id linked     │
└──────────────────────────────┬──────────────────────────────────┘
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│ 8. PAYMENT                                                      │
│    Client pays draw → accounting marks draw paid                │
│    Cascade: paid invoices → payment_date, amount, method        │
│    Status: invoice.status → paid                                │
│    pricing_history retains this as the confirmed price          │
└─────────────────────────────────────────────────────────────────┘
```

## 3.2 Change order → purchase order flow

```
CO created (drag proposal, manual, allowance overage)
  │
  ▼
CO.status = draft → submitted → approved
  │
  ▼
On approve:
  • jobs.approved_cos_total += total_with_fee
  • budget_lines.co_adjustments recompute
  • budget_lines auto-created for any line with no budget_line_id
  • notifications → PM, accounting, owner
  │
  ▼
For each CO line with new material/sub scope:
  "Create PO" button appears
  │
  ▼
Click → new PO pre-filled:
  • co_id = this CO
  • job_id, cost_code_id, amount, description from CO line
  • vendor = blank (user picks)
  │
  ▼
PM completes, issues PO → purchase_orders.status = issued
  │
  ▼
Vendor accepts (future) → status = accepted
  │
  ▼
Vendor invoices against PO → two-way match → budget tracking knows
this spend is CO-funded (not base contract)
  │
  ▼
Job dashboard shows: "Committed: $7.85M base + $212K CO-funded"
```

## 3.3 Proposal → CO / PO flow

```
Drop proposal PDF
  │
  ▼
Classify + extract → document_extraction (type=proposal)
  │
  ▼
User reviews pre-filled proposal form, commits
  │
  ▼
proposal.status = received
  │
  ├──▶ PM reviews → status = under_review
  │
  ├──▶ Scope is IN original contract
  │       → accept → status = accepted
  │       → click "Create PO" → PO pre-filled from proposal
  │       → proposal.converted_po_id set
  │
  └──▶ Scope is NEW scope (not in contract)
          → accept → status = accepted
          → click "Create CO from proposal"
          → CO pre-filled: title, amount, gc_fee, lines
          → proposal.converted_co_id set
          → CO submitted → approved → then PO created from CO line
```

## 3.4 Draw flow (AIA mode)

```
PM clicks "New Draw" on a job
  │
  ▼
Step 1: Period selection
  • Draw number auto = max + 1
  • Period start = previous draw end + 1 day
  • Period end = user picks (default = today)
  • is_final_draw checkbox
  │
  ▼
Step 2: Select invoices
  • System lists qa_approved invoices for this job, in period
  • User checks which to include
  • Can override amounts with reason
  │
  ▼
Step 3: G703 preview
  • Per budget line: previous, this period, total, % complete
  • User can manually adjust "this period" with reason
  • Can add internal billing lines (v2.0)
  │
  ▼
Step 4: G702 preview
  • All 9 lines computed from G703 + contract + prior draws
  • Warning banner if anything is off (retainage mismatch, over-billed, etc.)
  │
  ▼
Step 5: Cover letter
  • Template rendered with merge fields
  • User can edit
  │
  ▼
Step 6: Lien releases
  • Auto-generated per vendor in draw
  • User uploads signed releases as they come in
  │
  ▼
Step 7: Submit
  • RPC: draw_submit(draw_id) — transactional
  •   • draws.status → submitted
  •   • invoices → in_draw, draw_id linked
  •   • lien_releases auto-generated
  •   • notifications → accounting, owner
  • If any step fails → full rollback
  │
  ▼
Step 8: Approval
  • Owner/admin reviews
  • Blocker: pending lien release documents (if org policy requires)
  • Approve → draws.status → approved
  • Auto-schedule payments on draw invoices
  │
  ▼
Step 9: Lock + Export
  • Owner locks (seals for audit)
  • Export G702/G703 PDF
  • Send to client via email
  │
  ▼
Step 10: Mark paid
  • When client pays, mark draw paid
  • Cascade: invoices mark_paid (full or partial)
```

## 3.5 Universal ingestion flow (the moat)

```
USER DROPS FILE (anywhere)
  │
  ▼
POST /api/ingest
  • Create document_extractions row
  • Upload file to storage
  • Enqueue classify job
  │
  ▼
CLASSIFY (Claude Vision)
  • Read first page image
  • Return classified_type + confidence
  │
  ▼
ROUTE by type
  │
  ├──▶ invoice      → invoice extraction prompt
  ├──▶ purchase_order → PO extraction prompt
  ├──▶ change_order → CO extraction prompt
  ├──▶ proposal     → proposal extraction prompt
  ├──▶ vendor       → vendor extraction prompt (W-9, COI, card)
  ├──▶ budget       → budget extraction prompt (Excel, PDF takeoff)
  ├──▶ historical_draw → G702/G703 extraction prompt
  ├──▶ plan         → (v1.5) takeoff extraction
  ├──▶ contract     → (v1.5) contract extraction
  └──▶ other        → user picks type manually
  │
  ▼
EXTRACTION RUNS
  • Entity-specific prompt
  • Writes document_extraction_lines
  • Sets proposed_cost_code_id, proposed_vendor_id
  • verification_status = pending
  │
  ▼
USER REVIEWS AT /ingest/[extraction_id]
  • Entity-appropriate form, pre-filled
  • User corrects anything wrong
  • Click "Commit"
  │
  ▼
COMMIT (atomic)
  • Create target entity row
  • document_extractions.target_entity_id set
  • document_extractions.verification_status = committed
  • For relevant types: write to pricing_history
```

## 3.6 Pricing history flow

```
Source events that write to pricing_history:

1. Invoice qa_approved
   For each invoice_line_item:
   INSERT INTO pricing_history (source_type='invoice', ...)

2. Proposal accepted
   For each proposal_line_item:
   INSERT INTO pricing_history (source_type='proposal', ...)

3. PO issued
   For each purchase_order_line_item:
   INSERT INTO pricing_history (source_type='po', ...)

4. CO approved
   For each change_order_line:
   INSERT INTO pricing_history (source_type='co', ...)

Query surfaces (read):

• Budget page: SELECT AVG(amount) WHERE cost_code_id=X
                 GROUP BY vendor_id (last N jobs)
• Invoice approval: SELECT amount, date FROM pricing_history
                      WHERE vendor_id=X AND description ~ 'similar'
• Vendor detail: SELECT * WHERE vendor_id=X ORDER BY date DESC
• Cost lookup: full-text search over description + cost_code
```

## 3.7 Approval chain flow

```
Entity action (e.g., "submit invoice for PM approval")
  │
  ▼
Look up approval_chain for this org + workflow_type
  │
  ▼
Evaluate conditions (amount > $X → use chain B)
  │
  ▼
For each stage in order:
  • Check if required_role(s) have approved
  • Check if required_user(s) have approved
  • If all_required: wait for all
  • If any: advance on first
  │
  ▼
On stage advancement:
  • Write approval_actions row
  • Notify next stage approvers
  │
  ▼
On final stage: set entity to on_approve_status
```

---

# PART 4 — AUDIT OF CURRENT CODEBASE

This section summarizes the state of Nightwork as-of the audit (April 21, 2026). Full detail lives in `docs/workflow-audit.md`. This section is condensed reference for the branches.

## 4.1 What's production-grade today

- Invoice lifecycle with state machine, transitions, notifications, audit trail
- Draw G702/G703 math with retainage, revisions, CO incorporation
- Optimistic locking (`updateWithLock`)
- Soft delete (`deleted_at`) consistently applied
- Amounts stored in cents
- Status history JSONB on major entities
- Trigger-maintained caches (`jobs.approved_cos_total`, `budget_lines.committed/invoiced`)
- RLS org-isolation (migration 00049) + role-layer policies
- Stripe webhook + plan limit enforcement + Resend email
- Invoice parsing via Claude Vision
- Universal ingestion scaffolding (invoice_extractions infrastructure)

## 4.2 Critical bugs (data integrity)

1. **CO status enum drift** — API accepts `pending` and `denied`; schema CHECK may reject
2. **`invoices.status = 'info_requested'`** set by API but not in CHECK
3. **Non-transactional cascades** — draw submit, lien gen, payment schedule can partial-fail
4. **PO PATCH has no role check** — PM can flip status
5. **Missing `created_by`** on cost_codes, budget_lines, draw_line_items
6. **`lien_releases.waived_at`** not stamped when waived

## 4.3 Visible breakage

7. Six broken nav links
8. Orphan `/purchase-orders/[id]` detail route (API exists, no page)
9. Page deleted but nav still links it
10. Pages don't redirect by role (`/invoices/qa` renders for every role)
11. `/admin` wrong destination for platform admins
12. Operations dropdown all placeholders
13. `/operations`, `/financials/aging-report` orphan stubs

## 4.4 Architectural gaps from v1.0 target

- No `jobs.contract_type` or `jobs.phase` columns
- No `proposals` tables (first-class proposals don't exist)
- No draw modes (only AIA; milestone/TM missing)
- No `approval_chains` (hardcoded workflow)
- `invoice_extractions` not generalized to `document_extractions`
- No PO templates
- No `co_id` workflow (CO → PO spawning)
- No `allowance_overage` CO type or auto-split workflow
- `budgetary` CO pricing mode not implemented
- Client portal doesn't exist
- Pricing history not yet populated (cost intelligence is the advanced version)
- No CSV import wizard with mapping
- No unified `/ingest` page

## 4.5 Hardening gaps

- No Sentry instrumentation
- Prompt caching not implemented
- `console.log` in production routes
- Zero automated tests
- `/nw-test` reachable in prod
- Impersonation half-implemented
- RLS-only role checks on budget_lines, cost_codes, qa-status

---

# PART 5 — THE EXECUTION PLAN (8 BRANCHES)

Restructured from 6 to 8 branches based on the expanded scope. Each branch ends in a shippable state.

## Branch sequence summary

| # | Branch | Duration | Purpose |
|---|---|---|---|
| 1 | Data integrity foundation | 1–2 sessions | Fix silent data bugs |
| 2 | Schema expansion for v1.0 target | 2–3 sessions | Add proposals, contract types, phases, approval chains |
| 3 | Universal ingestion generalization | 5–7 sessions | Generalize pipeline, wire up all entity extractions |
| 4 | Nav + unified inbox | 2–3 sessions | Coherent UI, merged pages, role-aware redirects |
| 5 | Permission hardening | 1–2 sessions | Defense in depth |
| 6 | Draw modes + CO workflow + pricing history | 3–4 sessions | Three draw modes, CO→PO flow, pricing history activation |
| 7 | Client portal + reporting + configurability | 3–4 sessions | Client portal v1, prebuilt reports, approval chains UI |
| 8 | Performance + observability + polish | 2–3 sessions | Dashboard 503s, Sentry, prompt caching, final QA |
| **9** | **Final pre-deploy sweep** | **1–2 sessions** | **Comprehensive safety net before prod deploy** |

**Total: 20–30 Claude Code sessions, roughly 4–6 weeks of focused work.**

Every branch must pass the G.6 branch completion criteria before the next starts.

After Branch 9: production deploy → dogfood 2–4 weeks → v1.5 begins (plan extraction, full proposal builder, QB sync).

---

## BRANCH 1 — Data Integrity Foundation

**Purpose:** Fix the bugs that silently corrupt data or lose writes. Before dogfood, before new features.

**Duration estimate:** 1–2 Claude Code sessions

**Subagents deployed:** Schema validator (Phase 1.1, 1.2, 1.4), Test runner (all phases), Regression check (final phase).

### Phase 1.1 — Enum Alignment

**Goal:** Canonical enum values, no drift between API and schema.

**Scope:**
- CO canonical statuses: `draft | pending | approved | denied | void`
- Remove `pending_approval` synonym, migrate data
- Remove `executed` dead value, migrate data
- Invoices: add `info_requested` to CHECK

**Files touched:**
- `supabase/migrations/00060_align_status_enums.sql` (new)
- `src/app/api/change-orders/[id]/route.ts`
- `src/app/api/invoices/[id]/action/route.ts`
- `src/lib/change-orders.ts`
- `src/components/change-order-status-badge.tsx`

**Rebuild-vs-patch call:** PATCH. Existing files are structurally correct; only enum values change.

**Manual tests:**
1. Grep codebase for `'pending_approval'` → only in migration UPDATE statements
2. `SELECT DISTINCT status FROM change_orders` → only canonical values
3. Create CO, submit, approve, deny another — every transition succeeds
4. Hit `request_info` action on an invoice — no DB error

**Out of scope:**
- UI changes (Branch 4)
- Permission hardening beyond what's strictly needed
- Any feature work

**Phase 1.1 Exit Gate:**

Builds on the G.2 universal checklist. Additional phase-specific items:

```
[ ] Migration 00060 applied on dev without error
[ ] Migration 00060 committed to git
[ ] No rows in change_orders have status='pending_approval' or 'executed'
[ ] No rows in invoices fail the new CHECK (info_requested now allowed)
[ ] API types updated: no 'pending_approval' or 'executed' in accepted values
[ ] Schema validator subagent confirms alignment with Part 2 data model
[ ] Test runner subagent: all 4 manual tests PASS
[ ] QA report generated
```

**Commit:** `fix(schema): align CO and invoice status enums with application code`

---

### Phase 1.2 — PO Role Check

**Goal:** Close the RLS-only gap on PO PATCH endpoint.

**Scope:** Add `requireRole(['owner', 'admin'])` to `PATCH /api/purchase-orders/[id]`.

**Files touched:**
- `src/app/api/purchase-orders/[id]/route.ts`

**Rebuild-vs-patch call:** PATCH (file follows conventions; single change).

**Manual tests:**
1. Auth as PM → PATCH a PO → expect 403
2. Auth as owner → same PATCH → expect 200
3. Auth as accounting → same PATCH → expect 403

**Out of scope:**
- Other endpoint role checks (Branch 5)
- UI changes to hide forbidden buttons (Branch 4)

**Phase 1.2 Exit Gate:**

```
[ ] All manual tests PASS (3/3)
[ ] Test runner subagent confirms 403 for non-authorized roles
[ ] No change to authorized role behavior
[ ] QA report generated
```

**Commit:** `fix(po): add owner/admin role check to PO PATCH endpoint`

---

### Phase 1.3 — Transactional Cascade Wrapping

**Goal:** Atomic draw submit and approve. Partial failures roll back completely.

**Scope:**

Rebuild (not patch) the cascading logic. Reason: existing code has cascades outside transactions — structural issue. Move logic into Postgres RPC functions.

- `RPC: draw_submit(draw_id)` — atomic: status update + invoice status updates + lien release generation + notification queue
- `RPC: draw_approve(draw_id)` — atomic: status update + payment schedule + notification queue
- `RPC: draw_void(draw_id)` — atomic: status update + release cascade + notification queue

Notifications queued within transaction, dispatched after commit.

**Files touched:**
- `supabase/migrations/00061_transactional_draw_rpcs.sql` (new — RPC functions)
- `src/app/api/draws/[id]/action/route.ts` (REBUILD — replace sequential calls with single RPC call)
- `src/lib/lien-releases.ts` (REBUILD — move logic into SQL function)
- `src/lib/payment-schedule.ts` (REBUILD — move logic into SQL function)
- `src/lib/notifications.ts` (PATCH — add queue + dispatch functions)

**R.5 blast-radius check (required pre-work):** grep the entire `src/` tree for every import of `@/lib/lien-releases` and `@/lib/payment-schedule`. If any caller outside the draw submit/approve path exists, STOP and flag to Jake before touching either library. The rebuild scope assumes these libraries are draw-cascade-only; violating that assumption expands the phase.

**Rebuild-vs-patch call:** REBUILD the action route and cascade libraries. Current code has non-transactional cascades — structural fix required. Creates compounding risk if we patch around it.

**Manual tests 1–4 + Invariant check 5:**

Tests 1–4 are scenarios to execute live against a running dev server (R.19). Check 5 is a post-condition SQL query verified at steady state after tests 1–4 complete — not a separate scenario.

1. Normal draw submit → all side effects apply (invoices → in_draw, lien releases created, notifications sent)
2. Set env `FORCE_LIEN_GEN_FAIL=1` → submit draw → expect: draw remains `draft`, invoices remain `qa_approved`, no releases, no notifications
3. Normal approve → all side effects apply
4. Force approve failure → draw remains `submitted`

**Invariant check 5 (post-condition, run after tests 1–4 at steady state):**
```sql
SELECT * FROM draws
 WHERE status = 'submitted'
   AND id NOT IN (SELECT draw_id FROM lien_releases);
```
Expected: zero rows.

**Out of scope:**
- Refactoring invoice approval cascades (deferred to a future hardening pass)
- CO approval cascades (Branch 6 handles this)

**Phase 1.3 Exit Gate:**

Phase 1.3 is the hardest phase in Branch 1. Gate is strict:

```
[ ] R.5 blast-radius check complete (no non-draw callers of cascade libraries,
    OR scope expansion flagged and approved)
[ ] RPC functions created and unit-tested via direct Supabase MCP calls (not
    through the route) — each RPC called with valid + invalid inputs, rollback
    verified on invalid
[ ] Failure-injection hooks explicitly scoped as test-only branches, guarded
    by env var, documented in the RPC source comments and the QA report
[ ] All cascades now run in Postgres transactions (single RPC call per
    cascade, no sequential client-side orchestration)
[ ] Manual tests 1–4 executed LIVE against running dev server with real HTTP
    requests per R.19 — tests 2 and 4 use the scoped failure-injection hooks above
[ ] Invariant check 5: SELECT orphaned-rows query returns zero rows at steady
    state after manual tests 1–4
[ ] No orphaned rows in any forced-failure scenario (verified via direct SQL
    inspection after each failure test)
[ ] Normal-path regression: draw submit → approve → lock → paid works
    end-to-end, executed LIVE
[ ] Rebuild decisions documented in QA report with explicit before/after
    architecture diff
[ ] Old non-transactional code paths fully removed (no dead branches, grep
    confirms zero references to removed functions)
[ ] Failure-injection hooks do NOT ship enabled — env var defaults to off,
    route behavior unchanged in production
[ ] QA report generated
```

**Commit:** `fix(draws): atomic RPC transactions for submit/approve/void`

---

### Phase 1.4 — Missing `created_by` Columns

**Goal:** Add `created_by` to three tables. Write paths populate going forward.

**Files touched:**
- `supabase/migrations/00062_add_created_by.sql` (new)
- `src/app/api/cost-codes/route.ts` (PATCH — populate on POST)
- `src/app/api/budget-lines/route.ts` (PATCH — populate on POST)
- All insert points for `draw_line_items` (PATCH)

**Rebuild-vs-patch call:** PATCH. Schema addition + small handler updates.

**Manual tests:**
1. Create new cost code → `created_by` populated with current user's ID
2. Create new budget line → `created_by` populated
3. Create new draw (triggers draw_line_items inserts) → `created_by` populated
4. Query existing rows (pre-migration) → `created_by` is NULL (acceptable)

**Out of scope:**
- Backfilling historical `created_by` values (impossible without audit data)

**Phase 1.4 Exit Gate:**

```
[ ] Migration 00062 applied on dev
[ ] All 3 manual tests PASS
[ ] Schema validator confirms new columns match Part 2 data model
[ ] Existing rows readable (NULL accepted)
[ ] QA report generated
```

**Commit:** `fix(schema): add created_by to cost_codes, budget_lines, draw_line_items`

---

### Phase 1.5 — `lien_releases.waived_at` Stamp

**Goal:** Stamp `waived_at` when a release is marked `waived`.

**Files touched:**
- `supabase/migrations/00063_lien_release_waived_at.sql` (new — add column if missing)
- `src/app/api/lien-releases/[id]/route.ts` (PATCH — add stamp logic)

**Rebuild-vs-patch call:** PATCH.

**Manual tests:**
1. Mark a release `received` → `received_at` stamped
2. Mark a release `waived` → `waived_at` stamped
3. Mark a release `not_required` → no additional stamp (`status_history` captures the change)

**Phase 1.5 Exit Gate:**

```
[ ] Column `waived_at` exists and is nullable
[ ] All 3 manual tests PASS
[ ] QA report generated
```

**Commit:** `fix(lien-release): stamp waived_at on waive action`

---

### Branch 1 Final Exit Gate

Before advancing to Branch 2, Claude Code runs a **Branch 1 rollup QA**:

```
[ ] All 5 phases have PASS exit gates
[ ] Branch 1 regression suite passes (draw submit → approve → lock → paid, no silent failures)
[ ] Git log is clean (5 commits, one per phase)
[ ] No out-of-scope work leaked into Branch 1
[ ] docs/workflow-audit.md updated: mark findings #1, #2, #3, #4, #5, #6 as CLOSED. Finding #13 remains OPEN (deferred to Branch 4). Prior reference to finding #17 was plan drift — no such finding exists in Part 4 (numbering tops at #13).
[ ] Branch rollup QA report generated: ./qa-reports/qa-branch1-final.md
[ ] Jake has signed off
```

**Branch 1 out of scope:**
- UI changes (Branch 2, 4)
- New features (Branches 2, 3, 6, 7)
- Permission hardening beyond the PO fix (Branch 5)
- Performance (Branch 8)

---

## BRANCH 2 — Schema Expansion for v1.0 Target

Add the schema needed to hit v1.0 target state. Migrations only; UI changes follow in later branches.

### Phase 2.1 — Job phase & contract type

Migration `00063_job_phase_contract_type.sql`:
```sql
ALTER TABLE jobs 
  ADD COLUMN phase TEXT NOT NULL DEFAULT 'in_progress' 
    CHECK (phase IN ('lead','estimating','contracted','pre_construction','in_progress','substantially_complete','closed','warranty','archived')),
  ADD COLUMN contract_type TEXT NOT NULL DEFAULT 'cost_plus_aia' 
    CHECK (contract_type IN ('cost_plus_aia','cost_plus_open_book','fixed_price','gmp','time_and_materials','unit_price'));

CREATE INDEX idx_jobs_phase ON jobs(org_id, phase);
CREATE INDEX idx_jobs_contract_type ON jobs(org_id, contract_type);
```

Existing jobs default to `in_progress` + `cost_plus_aia`. Migration doesn't break anything.

**Commit:** `feat(jobs): add phase and contract_type columns`

### Phase 2.2 — Proposals tables (new first-class)

Migration `00064_proposals.sql`:
```sql
CREATE TABLE proposals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id),
  job_id UUID NOT NULL REFERENCES jobs(id),
  vendor_id UUID NOT NULL REFERENCES vendors(id),
  proposal_number TEXT NOT NULL,
  title TEXT NOT NULL,
  received_date DATE,
  valid_through DATE,
  status TEXT NOT NULL DEFAULT 'received' 
    CHECK (status IN ('received','under_review','accepted','rejected','superseded','converted_to_po','converted_to_co')),
  amount BIGINT,
  scope_summary TEXT,
  inclusions TEXT,
  exclusions TEXT,
  terms TEXT,
  plan_version_referenced TEXT,
  converted_po_id UUID REFERENCES purchase_orders(id),
  converted_co_id UUID REFERENCES change_orders(id),
  superseded_by_proposal_id UUID REFERENCES proposals(id),
  source_document_id UUID,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  status_history JSONB DEFAULT '[]'::jsonb,
  deleted_at TIMESTAMPTZ,
  UNIQUE (job_id, proposal_number)
);

CREATE TABLE proposal_line_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id UUID NOT NULL REFERENCES proposals(id) ON DELETE CASCADE,
  cost_code_id UUID REFERENCES cost_codes(id),
  description TEXT NOT NULL,
  quantity NUMERIC,
  unit TEXT,
  unit_price BIGINT,
  amount BIGINT NOT NULL,
  scope_detail TEXT,
  sort_order INT DEFAULT 0
);

-- RLS policies matching other tenant tables
ALTER TABLE proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE proposal_line_items ENABLE ROW LEVEL SECURITY;
-- ... policies follow same pattern as invoices
```

**Commit:** `feat(proposals): add proposals tables as first-class entity`

### Phase 2.3 — CO type expansion

Migration `00065_co_type_expansion.sql`:
```sql
ALTER TABLE change_orders
  DROP CONSTRAINT change_orders_co_type_check,
  ADD CONSTRAINT change_orders_co_type_check 
    CHECK (co_type IN ('owner_requested','designer_architect','allowance_overage','site_condition','internal'));

ALTER TABLE change_orders
  ADD COLUMN pricing_mode TEXT NOT NULL DEFAULT 'hard_priced'
    CHECK (pricing_mode IN ('hard_priced','budgetary','allowance_split')),
  ADD COLUMN source_proposal_id UUID REFERENCES proposals(id),
  ADD COLUMN reason TEXT;

-- Migrate 'owner' → 'owner_requested', 'internal' stays
UPDATE change_orders SET co_type = 'owner_requested' WHERE co_type = 'owner';
```

Also add `created_po_id` to `change_order_lines`:
```sql
ALTER TABLE change_order_lines
  ADD COLUMN created_po_id UUID REFERENCES purchase_orders(id);
```

**Commit:** `feat(co): expand CO types and add pricing_mode, source_proposal_id`

### Phase 2.4 — Cost codes hierarchy + starter templates

Migration `00066_cost_codes_hierarchy.sql`:
```sql
ALTER TABLE cost_codes
  ADD COLUMN parent_id UUID REFERENCES cost_codes(id),
  ADD COLUMN is_allowance BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN default_allowance_amount BIGINT;

-- Starter template storage
CREATE TABLE cost_code_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  is_system BOOLEAN DEFAULT FALSE,
  codes JSONB NOT NULL, -- nested structure of {code, name, children}
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Seed with 4 system templates
INSERT INTO cost_code_templates (name, description, is_system, codes) VALUES
  ('Custom Home Builder (Simplified)', 'A 25-code list for custom builders', TRUE, '{...}'),
  ('Remodeler (Simplified)', 'A 20-code list for renovation', TRUE, '{...}'),
  ('CSI MasterFormat (Full)', 'All 50 divisions, ~200 codes', TRUE, '{...}'),
  ('Empty — build your own', 'Start fresh', TRUE, '{}');
```

JSONB seed data for starter templates is separate script.

**Commit:** `feat(cost-codes): add hierarchy + starter templates`

### Phase 2.5 — Approval chains

Migration `00067_approval_chains.sql`:
```sql
CREATE TABLE approval_chains (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id),
  workflow_type TEXT NOT NULL CHECK (workflow_type IN ('invoice_pm','invoice_qa','co','draw','po','proposal')),
  name TEXT NOT NULL,
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  conditions JSONB DEFAULT '{}'::jsonb,
  stages JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  deleted_at TIMESTAMPTZ,
  UNIQUE (org_id, workflow_type, is_default) DEFERRABLE -- only one default per workflow
);

CREATE TABLE approval_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  stage_order INT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('approve','reject','skip','delegate')),
  actor_user_id UUID REFERENCES auth.users(id),
  actor_role TEXT,
  comment TEXT,
  acted_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_approval_actions_entity ON approval_actions(entity_type, entity_id);

-- Seed default chains per org (will be populated by a trigger on org creation + backfill)
```

**Commit:** `feat(approvals): add approval_chains and approval_actions tables`

### Phase 2.6 — Job milestones + retainage config

Migration `00068_milestones_retainage.sql`:
```sql
CREATE TABLE job_milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES jobs(id),
  sort_order INT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  amount_cents BIGINT NOT NULL,
  target_date DATE,
  completed_date DATE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','in_progress','complete','billed'))
);

ALTER TABLE jobs
  ADD COLUMN retainage_threshold_percent NUMERIC DEFAULT 50,
  ADD COLUMN retainage_dropoff_percent NUMERIC DEFAULT 5; -- drops from 10% to 5% at 50% complete

ALTER TABLE draws
  ADD COLUMN draw_mode TEXT NOT NULL DEFAULT 'aia' 
    CHECK (draw_mode IN ('aia','milestone','tm')),
  ADD COLUMN milestone_completions JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN tm_labor_hours NUMERIC,
  ADD COLUMN tm_material_cost BIGINT,
  ADD COLUMN tm_sub_cost BIGINT,
  ADD COLUMN tm_markup_amount BIGINT;
```

**Commit:** `feat(draws): add milestone and tm mode fields; job milestones table`

### Phase 2.7 — Pricing history table

Migration `00069_pricing_history.sql`:
```sql
CREATE TABLE pricing_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id),
  job_id UUID NOT NULL REFERENCES jobs(id),
  source_type TEXT NOT NULL CHECK (source_type IN ('invoice','proposal','po','co')),
  source_id UUID NOT NULL,
  source_line_id UUID NOT NULL,
  vendor_id UUID REFERENCES vendors(id),
  cost_code_id UUID REFERENCES cost_codes(id),
  description TEXT NOT NULL,
  quantity NUMERIC,
  unit TEXT,
  unit_price BIGINT,
  amount BIGINT NOT NULL,
  date DATE NOT NULL,
  canonical_item_id UUID, -- for advanced mode later
  match_confidence NUMERIC,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (source_type, source_line_id) -- idempotency
);

CREATE INDEX idx_pricing_history_cost_code ON pricing_history(org_id, cost_code_id, date DESC);
CREATE INDEX idx_pricing_history_vendor ON pricing_history(org_id, vendor_id, date DESC);
CREATE INDEX idx_pricing_history_description_trgm ON pricing_history USING GIN (description gin_trgm_ops);

-- RLS: org-scoped read; writes via service role only (triggered from entity writes)
```

Then add triggers that populate `pricing_history` on:
- `invoice_line_items` insert + invoice status → qa_approved
- `proposal_line_items` insert + proposal status → accepted
- `purchase_order_line_items` insert + PO status → issued
- `change_order_lines` insert + CO status → approved

**Commit:** `feat(pricing): add pricing_history table with triggers`

### Phase 2.8 — Client portal access

Migration `00070_client_portal.sql`:
```sql
CREATE TABLE client_portal_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id),
  job_id UUID NOT NULL REFERENCES jobs(id),
  email TEXT NOT NULL,
  name TEXT,
  access_token TEXT UNIQUE NOT NULL,
  visibility_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  invited_at TIMESTAMPTZ,
  last_accessed_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

CREATE TABLE client_portal_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id),
  job_id UUID NOT NULL REFERENCES jobs(id),
  from_type TEXT NOT NULL CHECK (from_type IN ('builder','client')),
  from_user_id UUID,
  from_client_email TEXT,
  message TEXT NOT NULL,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

**Commit:** `feat(client-portal): add tables for client access and messages`

### Phase 2.9 — V2.0 schema hooks (empty tables)

Migration `00071_v2_hooks.sql`:
```sql
-- Create empty tables for v2.0 features to lock in naming
CREATE TABLE daily_logs ( id UUID PRIMARY KEY DEFAULT gen_random_uuid() /* full schema in v2.0 */ );
CREATE TABLE schedule_items ( id UUID PRIMARY KEY DEFAULT gen_random_uuid() );
CREATE TABLE time_entries ( id UUID PRIMARY KEY DEFAULT gen_random_uuid() );
CREATE TABLE selections ( id UUID PRIMARY KEY DEFAULT gen_random_uuid() );
CREATE TABLE plans ( id UUID PRIMARY KEY DEFAULT gen_random_uuid() );
CREATE TABLE takeoff_extractions ( id UUID PRIMARY KEY DEFAULT gen_random_uuid() );
CREATE TABLE overhead_pools ( id UUID PRIMARY KEY DEFAULT gen_random_uuid() );
CREATE TABLE overhead_allocations ( id UUID PRIMARY KEY DEFAULT gen_random_uuid() );

-- Add all the columns now as nullable, they'll be used in v2.0
```

This isn't strictly necessary but locks in naming so v2.0 doesn't rename things.

**Commit:** `feat(schema): add v2.0 table stubs for naming consistency`

### Branch 2 final verification

- All migrations apply cleanly on dev
- No existing data lost
- All CHECK constraints validate
- Schema matches Part 2 of this doc

**Branch 2 Exit Gate** (see G.2 universal checklist; phase-specific additions):

```
[ ] All 9 migrations (00063–00071) applied on dev, committed to git
[ ] Schema validator subagent confirms full alignment with Part 2 data model
[ ] No migrations apply changes via MCP that aren't in git files
[ ] `jobs.phase` and `jobs.contract_type` defaults don't break existing workflows
[ ] Proposals tables exist and are empty (populated in Branch 3)
[ ] Approval chains table exists; default chains seeded per org
[ ] Pricing history triggers ready to fire (but nothing to fire against until Branch 3 commits flow through)
[ ] Client portal tables exist and are empty
[ ] V2.0 hook tables exist (empty, ready for future use)
[ ] Branch rollup QA report generated
```

**Branch 2 out of scope:**
- UI for any new fields (later branches)
- Populating new tables (Branch 3)
- Approval chain configuration UI (Branch 7)

---

## BRANCH 3 — Universal Ingestion Generalization

This is the big one. Split into focused phases.

### Phase 3.1 — Schema rename

Rename `invoice_extractions` → `document_extractions`, same for lines. Add `classified_type`, `target_entity_type`, `target_entity_id`.

Migration, code rename cascade (routes, types, components), verify existing invoice flow still works post-rename.

**Rebuild-vs-patch call:** REBUILD (the generalization is core to the architecture, and it's a foundational rename that affects every extraction pipeline downstream — patching would create ongoing name/type drift).

**Phase 3.1 Exit Gate:**

```
[ ] Migration 00072 applied, rollback tested
[ ] Grep validator subagent: zero references to `invoice_extractions` remain
[ ] Invoice flow still works end-to-end post-rename (regression test)
[ ] New columns populate correctly on new invoice ingest (classified_type, target_entity_type)
[ ] RLS policies migrated to new table names
[ ] QA report generated
```

**Commit:** `refactor(ingestion): rename invoice_extractions → document_extractions`

### Phase 3.2 — Document classifier

Claude Vision classifier. First-page image → type + confidence.

Files:
- `src/lib/ingestion/classify.ts`
- `src/app/api/ingest/route.ts` (universal entry endpoint)

**Rebuild-vs-patch call:** REBUILD (new capability, built clean from the start).

**Phase 3.2 Exit Gate:**

```
[ ] Classifier achieves ≥90% accuracy on 20-document test set (5 of each major type)
[ ] Universal /api/ingest accepts file → creates document_extraction row with classified_type
[ ] Confidence score recorded; low-confidence (<0.70) flagged for manual type selection
[ ] Test runner subagent: all classifier tests PASS
[ ] Classifier system prompt cached via prompt caching
[ ] QA report generated with sample classifications for each type
```

**Commit:** `feat(ingestion): document classifier`

### Phase 3.3 — PO extraction pipeline

Prompt, extraction path, pre-filled PO form, commit route.

**Rebuild-vs-patch call:** REBUILD (new pipeline, built on generalized ingestion architecture).

**Phase 3.3 Exit Gate:**

```
[ ] PO extraction prompt achieves ≥85% field accuracy on 10-doc test set
[ ] Pre-filled PO form shows all extracted fields with confidence indicators
[ ] User can edit any field before commit
[ ] Commit creates PO with source_document_id linked correctly
[ ] purchase_order_line_items populated from extraction
[ ] QA report generated with test doc samples
```

**Commit:** `feat(ingestion): PO extraction pipeline`

### Phase 3.4 — CO extraction pipeline

Same pattern as 3.3.

**Rebuild-vs-patch call:** REBUILD.

**Phase 3.4 Exit Gate:**

```
[ ] CO extraction prompt correctly classifies co_type (5 types) on test set
[ ] Pricing mode detection works (hard_priced / budgetary / allowance_split)
[ ] CO lines map to budget_lines when description matches
[ ] Commit creates CO with source_document_id linked
[ ] QA report generated
```

**Commit:** `feat(ingestion): CO extraction pipeline`

### Phase 3.5 — Proposal extraction pipeline

New first-class. Prompt, route, form.

**Rebuild-vs-patch call:** REBUILD (new entity, new pipeline, no existing code).

**Phase 3.5 Exit Gate:**

```
[ ] Proposal extraction captures: vendor, amount, scope, inclusions, exclusions, valid_through
[ ] Line items with quantity/unit/unit_price extracted when present
[ ] Pre-filled form lets PM choose: accept / reject / convert to PO / convert to CO
[ ] "Convert to PO" pre-fills PO from proposal line items
[ ] "Convert to CO" pre-fills CO from proposal (sets source_proposal_id)
[ ] QA report generated with test doc samples
```

**Commit:** `feat(ingestion): proposal extraction pipeline`

### Phase 3.6 — Vendor extraction pipeline

W-9, COI, business card extraction.

**Rebuild-vs-patch call:** REBUILD.

**Phase 3.6 Exit Gate:**

```
[ ] W-9 extraction: name, legal name, tax ID, tax ID type, address
[ ] COI extraction: vendor name, coverage dates, policy limits
[ ] Business card / email sig extraction: name, email, phone, company
[ ] Pre-filled vendor form shows all fields, PM reviews
[ ] COI expiration stored; reminder system ready to hook into v2.0 notifications
[ ] QA report generated
```

**Commit:** `feat(ingestion): vendor extraction pipeline`

### Phase 3.7 — Budget extraction pipeline

Excel/CSV mapping UI + PDF takeoff extraction.

**Rebuild-vs-patch call:** REBUILD.

**Phase 3.7 Exit Gate:**

```
[ ] Excel budget: column mapping UI learns (detects "Description", "Amount" etc.)
[ ] Excel budget: mapping saved per org per source format, reused on next import
[ ] PDF budget: basic extraction works (v1.0 — not the full v1.5 AI takeoff)
[ ] Buildertrend CSV budget export: tested, imports cleanly
[ ] Cost code auto-mapping: similar descriptions map to existing codes
[ ] QA report generated
```

**Commit:** `feat(ingestion): budget extraction pipeline`

### Phase 3.8 — Historical draw extraction

G702/G703 PDF extraction for backfilling migrated jobs.

**Rebuild-vs-patch call:** REBUILD.

**Phase 3.8 Exit Gate:**

```
[ ] G702 extraction: all 9 lines parsed correctly
[ ] G703 extraction: line items with scheduled value, completed, retainage
[ ] Historical draws imported don't affect live draw numbering (offset handling)
[ ] Backfill populates budget_lines.billed_to_client correctly
[ ] QA report generated with 2 historical Ross Built draws test-imported
```

**Commit:** `feat(ingestion): historical draw extraction pipeline`

### Phase 3.9 — CSV import wizards

5 importers: cost codes, vendors, budget lines, POs, invoices.
Mapping learned + saved per org per source.

**Rebuild-vs-patch call:** REBUILD (new functionality).

**Phase 3.9 Exit Gate:**

```
[ ] All 5 importers work end-to-end with Buildertrend + QuickBooks CSV samples
[ ] Column mapping UI: smart defaults + manual override
[ ] Mappings persist per org per source format name
[ ] Duplicate detection: warns before importing existing records
[ ] Validation: row-level errors surfaced with clear messages, import resumes
[ ] Progress bar on bulk imports (1000+ rows tested)
[ ] QA report generated with test CSV samples imported
```

**Commit:** `feat(migration): CSV import wizards with learned mappings`

### Phase 3.10 — Unified `/ingest` UI

Global drop zone page. Recent ingestions list. Per-list drop zones.

**Rebuild-vs-patch call:** REBUILD.

**Phase 3.10 Exit Gate:**

```
[ ] /ingest page: drop any file, routed correctly to extraction pipeline
[ ] Recent ingestions list shows status (pending | verified | committed | rejected)
[ ] Drop zones on /invoices, /purchase-orders, /change-orders, /proposals, /vendors, /budgets scope correctly
[ ] Verification step pre-fills entity-appropriate form
[ ] Commit button creates target entity; source_document_id linked
[ ] Failed extractions show clear error with retry option
[ ] Visual QA subagent: screenshots at all breakpoints, all roles
[ ] QA report generated
```

**Commit:** `feat(ingestion): unified /ingest page + contextual drop zones`

### Branch 3 final verification

End-to-end Ross Built data migration test: drop 5 invoices, a W-9, a Buildertrend budget CSV, a CO PDF, a historical G702. All land correctly.

**Branch 3 Exit Gate:**

```
[ ] Extraction prompt tester subagent: all 8 entity types extract correctly on test docs
[ ] Every pipeline has ≥90% accuracy on 10-sample test set
[ ] Universal /ingest page works (drag any file, routed correctly)
[ ] CSV import wizards all 5 work: cost codes, vendors, budgets, POs, invoices
[ ] Mappings are saved + reused per org per source format
[ ] Pricing history populates on invoice + proposal commits
[ ] End-to-end Ross Built migration dry-run succeeds (test data, not prod)
[ ] Branch rollup QA report generated
```

**Subagents deployed heavily in Branch 3:** extraction prompt tester (every phase), schema validator (phase 3.1), visual QA (phases 3.3–3.10), test runner (all phases).

---

## BRANCH 4 — Nav + Unified Inbox

### Phase 4.1 — Unified `/invoices` page with role-aware tabs

Merge `/invoices/queue` and `/invoices/qa`. Tabs: Needs my review / All / Ready to pay / In drafts / Paid. Role-based default.

**Rebuild-vs-patch call:** REBUILD (merging two pages into one with different semantics; patching would leave stale code).

**Phase 4.1 Exit Gate:**

```
[ ] /invoices/queue → redirects to /invoices?tab=needs-review
[ ] /invoices/qa → redirects to /invoices?tab=needs-review (as accounting role)
[ ] Tab defaults: owner/admin = Needs my review; PM = Needs my review (scoped to my jobs); accounting = Needs my review (QA stage)
[ ] URL state syncs with tab (deeplinkable)
[ ] Filter + search persists across tab switches
[ ] Empty / loading / error states all rendered
[ ] Visual QA screenshots per role × per tab × mobile/desktop
[ ] QA report generated
```

### Phase 4.2 — Jobs sidebar nav pattern

Move jobs off top nav. Into left sidebar filter. Top nav stays on rollup views.

**Rebuild-vs-patch call:** REBUILD (nav restructure affects every page; half-measure would be worse).

**Phase 4.2 Exit Gate:**

```
[ ] Sidebar renders on every authenticated page
[ ] "All Jobs" default → top nav shows rollup views
[ ] Click a job → sidebar highlights, top-nav contents remain rollup; center panel scopes to job
[ ] "+ New Job" button in sidebar (owner/admin only)
[ ] Sidebar collapse/expand remembered per user
[ ] Mobile (375px): sidebar becomes drawer
[ ] Visual QA screenshots all roles × desktop/tablet/mobile
[ ] QA report generated
```

### Phase 4.3 — Global list pages

Rebuild `/change-orders`, `/purchase-orders`, `/proposals` as global lists. Fix `/purchase-orders/[id]` detail.

**Rebuild-vs-patch call:** REBUILD (detail page is orphan, list pages don't exist — all new).

**Phase 4.3 Exit Gate:**

```
[ ] /change-orders: global list with filter by job, status, type
[ ] /purchase-orders: global list with filter by job, status, vendor
[ ] /proposals: global list with filter by job, status, vendor
[ ] /purchase-orders/[id]: detail page works (no more orphan 404)
[ ] All list pages support sort, search, pagination
[ ] Click-through to job detail works
[ ] Visual QA screenshots all roles × desktop/mobile
[ ] QA report generated
```

### Phase 4.4 — Delete placeholders

`/operations`, `/financials/aging-report`, placeholder dropdowns, dead links.

**Rebuild-vs-patch call:** DELETE (no rebuild, no patch — remove per Standing Rule R.14).

**Phase 4.4 Exit Gate:**

```
[ ] /operations removed; any nav links removed
[ ] /financials/aging-report removed
[ ] All dropdown menu items with "Coming soon" or "Placeholder" removed
[ ] Grep: zero "Coming soon", "Placeholder", "TODO:" strings in UI
[ ] No broken links remain (crawl validator subagent runs)
[ ] QA report generated
```

### Phase 4.5 — Role-based redirects

`/admin` → `/admin/platform` for platform admins. `/jobs/new` PM gets 403. Etc.

**Rebuild-vs-patch call:** PATCH (existing page-level guards extended, not rebuilt).

**Phase 4.5 Exit Gate:**

```
[ ] /admin redirects to /admin/platform for platform admins, /admin/org for others
[ ] /jobs/new: PM gets 403 page (not blank, not crash)
[ ] /settings/billing: only owner sees; others 403
[ ] /settings/team: owner + admin; others 403
[ ] All role-gated pages return 403 (not 404) for clear UX
[ ] Impersonation mode shows banner; write actions disabled in UI
[ ] QA report generated
```

### Phase 4.6 — Gate `/nw-test` behind env

**Rebuild-vs-patch call:** PATCH (simple env check added).

**Phase 4.6 Exit Gate:**

```
[ ] /nw-test returns 404 when ENABLE_NW_TEST=0
[ ] /nw-test works when ENABLE_NW_TEST=1 (local dev)
[ ] Production deploy defaults to ENABLE_NW_TEST=0
[ ] QA report generated
```

### Phase 4.7 — Nav header polish

Co-brand mobile layout fix.

**Rebuild-vs-patch call:** PATCH (CSS/layout tweak).

**Phase 4.7 Exit Gate:**

```
[ ] Co-brand header (Nightwork × {org_name} logo) renders on 375px without overlap
[ ] Responsive breakpoints tested: 375, 768, 1280, 1920
[ ] Mobile drawer nav works
[ ] Visual QA screenshots all breakpoints
[ ] QA report generated
```

**Branch 4 Exit Gate:**

```
[ ] Visual QA subagent: every nav link clicked as every role → no 404s
[ ] Unified /invoices page works for all 4 roles, correct default tabs
[ ] Old URLs /invoices/queue and /invoices/qa redirect correctly
[ ] Jobs sidebar renders on every page, filter works
[ ] Global list pages: /change-orders, /purchase-orders, /proposals all work
[ ] Placeholder pages deleted (404 on direct URL access acceptable since nav removed)
[ ] /nw-test hidden in prod mode (ENABLE_NW_TEST=0)
[ ] Co-brand header works at 375px, 768px, 1920px
[ ] Branch rollup QA report generated
```

---

## BRANCH 5 — Permission Hardening

Same as original plan. API role checks on budget_lines, cost_codes, qa_status. Page-level server guards. Impersonation read-only. `/api/admin/integrity-check` role fix.

**Subagents deployed:** Security audit (runs the full role × endpoint matrix), test runner.

**Branch 5 Exit Gate:**

```
[ ] Security audit subagent: full role × endpoint matrix, zero unauthorized access
[ ] Every page redirects properly for insufficient role
[ ] Impersonation is fully read-only (writes return 403 with clear error)
[ ] /api/admin/integrity-check accepts owner AND admin
[ ] docs/permission-matrix.md generated (standalone reference)
[ ] Branch rollup QA report generated
```

---

## BRANCH 6 — Draw Modes + CO Workflow + Pricing History Activation

### Phase 6.1 — Milestone draw mode

UI + API for milestone billing. Setup job milestones at job creation. Draw wizard detects `contract_type` and routes to milestone UI.

**Rebuild-vs-patch call:** EXTEND (AIA draw code stays intact; milestone mode added alongside with shared wizard shell).

**Phase 6.1 Exit Gate:**

```
[ ] Job create UI: milestone setup for fixed_price/unit_price contracts
[ ] job_milestones table populated at job creation
[ ] Draw wizard detects draw_mode='milestone' and routes to milestone UI
[ ] PM selects which milestones complete this period
[ ] Auto-computed billing amount based on milestone % complete
[ ] Client portal shows milestone progress (not cost detail)
[ ] Test: create fixed_price job → complete 3 of 5 milestones → draw bills correctly
[ ] QA report generated
```

### Phase 6.2 — T&M draw mode

T&M billing UI + API. Labor + materials + sub + markup.

**Rebuild-vs-patch call:** EXTEND (same wizard shell, new T&M branch).

**Phase 6.2 Exit Gate:**

```
[ ] Job create UI: T&M rates setup for time_and_materials contracts
[ ] Draw wizard: labor hours × rate + materials × markup + subs × markup
[ ] Not-to-exceed (NTE) ceiling check if set on job
[ ] Weekly/biweekly draw period default (not monthly like AIA)
[ ] Test: create T&M job → submit 40 labor hours + $5K materials → draw bills correctly
[ ] QA report generated
```

### Phase 6.3 — CO → PO workflow

"Create PO" button on approved CO lines. Pre-fill logic. `co_id` wire-up. Budget committed-cost attribution (base vs CO-funded).

**Rebuild-vs-patch call:** EXTEND (existing PO create path extended with CO source).

**Phase 6.3 Exit Gate:**

```
[ ] "Create PO" button only appears on approved CO lines with new scope
[ ] New PO form pre-filled: job, cost_code, amount, description from CO line
[ ] PO.co_id FK set correctly
[ ] change_order_lines.created_po_id FK set correctly
[ ] Budget page shows base committed vs CO-funded committed (separate rollups)
[ ] Job header shows "+$X CO-funded committed"
[ ] QA report generated
```

### Phase 6.4 — Allowance overage auto-CO

When invoice approved with line that overruns an allowance cost code: auto-create draft CO (`co_type=allowance_overage`, `pricing_mode=allowance_split`). PM reviews, submits, approves.

**Rebuild-vs-patch call:** REBUILD (new auto-workflow, no existing code).

**Phase 6.4 Exit Gate:**

```
[ ] Allowance cost code marked is_allowance=TRUE
[ ] Invoice line against allowance cost code: if budget exceeded, draft CO auto-created
[ ] CO pre-fills: co_type=allowance_overage, pricing_mode=allowance_split, source_invoice_id
[ ] PM sees CO in "Needs review" with clear explanation
[ ] Approval adjusts revised contract + creates budget line adjustment
[ ] Test: create allowance of $5K, submit invoice for $6K → CO for $1K auto-created
[ ] QA report generated
```

### Phase 6.5 — Budgetary CO mode

Support `pricing_mode=budgetary`. Placeholder amount, finalizes when proposal received.

**Rebuild-vs-patch call:** EXTEND (CO schema already has pricing_mode; implement workflow).

**Phase 6.5 Exit Gate:**

```
[ ] PM can create CO with pricing_mode=budgetary and placeholder amount
[ ] CO flagged "Budgetary — pending firm pricing" visually
[ ] When proposal received and linked, CO converts to hard_priced
[ ] Amount updates to proposal amount; PM notified
[ ] QA report generated
```

### Phase 6.6 — Pricing history activation

Triggers populate `pricing_history`. UI surfaces on budget page, invoice approval card, vendor detail, cost code detail. Free-text search.

**Rebuild-vs-patch call:** EXTEND (schema from Branch 2 Phase 2.7; triggers + UI added now).

**Phase 6.6 Exit Gate:**

```
[ ] Triggers fire on: invoice qa_approved, proposal accepted, PO issued, CO approved
[ ] Backfill: existing approved invoices → pricing_history populated
[ ] Budget line card shows: "Last 5 jobs avg: $X (range: $Y–$Z)"
[ ] Invoice approval card shows: "Your last 3 purchases from {vendor}: $X, $Y, $Z"
[ ] Vendor detail: pricing history table with sort/filter
[ ] Cost code detail: pricing history table
[ ] Free-text search: "/pricing?q=5V metal roofing 3000sf" returns matching lines
[ ] QA report generated
```

### Phase 6.7 — Job header financial summary

Clean visual hierarchy. Contract / spend / projected final. Live updating.

**Rebuild-vs-patch call:** REBUILD (current header is incomplete; full redesign matches §1.2 spec).

**Phase 6.7 Exit Gate:**

```
[ ] Job header renders: contract block (original, approved COs, revised, pending COs) + spend block (budget, committed, invoiced, billed, paid)
[ ] Projected final cost computed correctly
[ ] Over/under contract flagged visually (red if over)
[ ] Live update: approve invoice → spend block updates within 2s
[ ] Visual QA screenshots all roles (owner/admin/PM see full detail; accounting sees financial-focused view)
[ ] Mobile layout works
[ ] QA report generated
```

**Branch 6 Exit Gate:**

```
[ ] Test runner: all 3 draw modes complete end-to-end (AIA, milestone, T&M)
[ ] CO → PO workflow: approved CO line spawns PO with correct pre-fill
[ ] Allowance overage auto-CO: invoice over allowance triggers draft CO
[ ] Budgetary CO: placeholder works, finalizes on proposal receipt
[ ] Pricing history: populated correctly, surfaces on budget/invoice/vendor pages
[ ] Job header financial summary updates live as invoices approved
[ ] Budget page clearly shows base vs CO-funded committed costs
[ ] Visual QA: draw wizard routes to correct UI based on contract_type
[ ] Branch rollup QA report generated
```

---

## BRANCH 7 — Client Portal + Reporting + Configurability

### Phase 7.1 — Client portal v1 (read-only)

Separate subdomain or URL. Email invite flow. Token-based access.

Visible: job snapshot, schedule (high-level), budget (per config), photos, messages, documents.

**Rebuild-vs-patch call:** REBUILD (new feature entirely).

**Phase 7.1 Exit Gate:**

```
[ ] client_portal_access table populated on invite
[ ] Email invite sends successfully (Resend)
[ ] Client clicks link → token-based auth → sees job snapshot
[ ] Visibility config respected (budget visible or hidden per org/job setting)
[ ] Messages: builder posts → client sees; client replies → builder notified
[ ] Photo gallery organized by date
[ ] Documents: plans, selection sheets accessible
[ ] Revoke access works (token invalidated)
[ ] Visual QA: client portal screenshots (client perspective) desktop + mobile
[ ] QA report generated
```

### Phase 7.2 — 9 prebuilt reports

See §1.15 list. Each report is a server-rendered page with filters + export to PDF/Excel.

**Rebuild-vs-patch call:** REBUILD (new reports).

**Phase 7.2 Exit Gate:**

```
[ ] Job P&L summary renders with correct revenue, cost, margin calcs
[ ] Budget vs actual by cost code: per-job + all-jobs rollup
[ ] Aging report: invoices grouped by age bucket
[ ] Cash flow forecast: 60-day projection of in/out
[ ] Committed vs invoiced: per job
[ ] Vendor performance: ranked by spend + payment timeliness
[ ] Draw history: all draws cross-job
[ ] CO log: per-job register
[ ] WIP report: cost + revenue + % complete per job
[ ] All 9 export to PDF correctly
[ ] All 9 export to Excel correctly
[ ] QA report generated
```

### Phase 7.3 — Approval chain configuration UI

Org settings page for configuring approval chains per workflow. Visual chain builder.

**Rebuild-vs-patch call:** REBUILD.

**Phase 7.3 Exit Gate:**

```
[ ] Settings page: /settings/approvals with list of 6 workflow types
[ ] Visual chain builder: add stage, configure roles/users, condition rules
[ ] Condition builder: amount thresholds, role requirements
[ ] Preview: "Invoice for $15K would go through: PM → Senior PM → Accounting"
[ ] Save: chain activated; subsequent submissions follow new chain
[ ] Default chains seed correctly for new orgs
[ ] QA report generated
```

### Phase 7.4 — Contract type per-job UI

Job creation + edit support contract type selection. Drives draw mode, CO handling, client portal defaults.

**Rebuild-vs-patch call:** EXTEND (job form extended with contract_type selector).

**Phase 7.4 Exit Gate:**

```
[ ] Job create form: contract_type dropdown (6 options with descriptions)
[ ] Selection drives: draw_mode default, retainage default, client portal defaults
[ ] Changing contract_type on existing job: warning shown (affects future draws)
[ ] Contract type visible on job header
[ ] QA report generated
```

### Phase 7.5 — Starter cost code template selection

Onboarding wizard: pick template. Already-existing orgs get a "Apply a template" action in settings.

**Rebuild-vs-patch call:** REBUILD.

**Phase 7.5 Exit Gate:**

```
[ ] Onboarding: cost code template selection with 4 options
[ ] Applying template copies codes into org's cost_codes table
[ ] Existing orgs: /settings/cost-codes has "Apply template" button
[ ] Template preview before applying
[ ] Post-apply: codes fully editable (add/rename/delete/rearrange)
[ ] QA report generated
```

### Phase 7.6 — Usage dashboard

Per-org: API calls, costs, documents ingested by type, active users. Owner-only view.

**Rebuild-vs-patch call:** REBUILD.

**Phase 7.6 Exit Gate:**

```
[ ] /settings/usage shows: API call count, API cost estimate, docs ingested by type, active users
[ ] Charts: daily/weekly/monthly trend lines
[ ] Drill-down: click "documents ingested" → list of recent ingestions
[ ] Owner-only access (403 for others)
[ ] Data sourced from api_usage and org_usage_daily tables
[ ] QA report generated
```

**Branch 7 Exit Gate:**

```
[ ] Client portal: invite sent, client logs in, sees job correctly
[ ] Client portal visibility config works (per-job settings respected)
[ ] All 9 prebuilt reports render correctly
[ ] Reports export to PDF and Excel successfully
[ ] Approval chain configuration UI works (visual builder)
[ ] Custom approval chain triggers correctly (e.g., amount > $10K)
[ ] Contract type selection on job create drives correct draw mode + client visibility
[ ] Cost code template selection works (4 options + custom)
[ ] Usage dashboard shows accurate per-org API cost + usage metrics
[ ] Visual QA: all new pages at desktop + tablet + mobile
[ ] Branch rollup QA report generated
```

---

## BRANCH 8 — Performance + Observability + Polish

### Phase 8.1 — Dashboard perf fix

N+1 audit, add indexes, materialized views where needed. Activity feed pagination.

**Rebuild-vs-patch call:** REBUILD (failing queries get replaced, not cached around).

**Phase 8.1 Exit Gate:**

```
[ ] Dashboard P95 < 1s on Ross Built production-volume test data
[ ] Zero N+1 queries verified via query logger
[ ] New indexes documented in migration file
[ ] Activity feed paginated (25 per page, infinite scroll optional)
[ ] Load test: 50 concurrent dashboard loads, no 503s
[ ] QA report generated with before/after query counts
```

### Phase 8.2 — Sentry instrumentation

Stripe webhook, Resend, Claude API, cron. Middleware catch-all.

**Rebuild-vs-patch call:** EXTEND (add Sentry SDK to existing code).

**Phase 8.2 Exit Gate:**

```
[ ] Sentry SDK installed, DSN configured
[ ] Stripe webhook errors captured
[ ] Resend email errors captured
[ ] Claude API errors captured (with request metadata but no PII)
[ ] Cron job errors captured
[ ] Middleware catches unhandled errors
[ ] Test: force an error in each path → Sentry receives it
[ ] QA report generated
```

### Phase 8.3 — Prompt caching

Invoice parse system prompt + cost codes list cached. ~90% cost reduction.

**Rebuild-vs-patch call:** EXTEND (add cache_control to existing Claude API calls).

**Phase 8.3 Exit Gate:**

```
[ ] Claude API calls use cache_control on system prompt
[ ] Cost code list cached per org
[ ] Second identical call shows cache_read_tokens > 0 in response
[ ] Cost reduction ≥ 80% measured over 10-invoice test
[ ] Cache TTL matches Claude's 5-minute window
[ ] QA report generated
```

### Phase 8.4 — Console log cleanup

**Rebuild-vs-patch call:** PATCH.

**Phase 8.4 Exit Gate:**

```
[ ] Grep: zero console.log in src/app/api/**
[ ] Grep: zero console.log in src/lib/**
[ ] Allowed: console.log in __tests__/ only
[ ] PERF_LOG gated logs use logger utility with env check
[ ] QA report generated
```

### Phase 8.5 — Request duration logging

**Rebuild-vs-patch call:** EXTEND.

**Phase 8.5 Exit Gate:**

```
[ ] Middleware logs: route, method, status, duration_ms, org_id
[ ] Logs structured (JSON) for queryability
[ ] Slow request threshold (>1s) flagged
[ ] No PII in logs (verified sample inspection)
[ ] QA report generated
```

### Phase 8.6 — Minimal test harness

Smoke tests for: invoice lifecycle, draw lifecycle (3 modes), CO → PO flow, proposal → CO flow.

**Rebuild-vs-patch call:** REBUILD (building test suite from near-zero).

**Phase 8.6 Exit Gate:**

```
[ ] __tests__/ directory structured per branch
[ ] Invoice lifecycle smoke test: PASS
[ ] Draw AIA lifecycle smoke test: PASS
[ ] Draw milestone lifecycle smoke test: PASS
[ ] Draw T&M lifecycle smoke test: PASS
[ ] CO → PO workflow smoke test: PASS
[ ] Proposal → CO workflow smoke test: PASS
[ ] `npm test` runs all and reports green
[ ] CI config: GitHub Action runs tests on PR
[ ] QA report generated
```

### Phase 8.7 — Error + empty + loading states

Every list page, every async action.

**Rebuild-vs-patch call:** EXTEND.

**Phase 8.7 Exit Gate:**

```
[ ] Every list page has: loading skeleton, empty state with CTA, error state with retry
[ ] Every async action button shows loading spinner while pending
[ ] Failed actions show toast with clear error + retry
[ ] Visual QA screenshots: every page at loading/empty/error
[ ] QA report generated
```

### Phase 8.8 — Email + Stripe QA

Every template, every webhook event.

**Rebuild-vs-patch call:** PATCH.

**Phase 8.8 Exit Gate:**

```
[ ] All email templates render correctly in Gmail + Outlook + Apple Mail
[ ] Dark mode email tested
[ ] All Stripe webhook events handled: checkout.completed, invoice.paid, invoice.payment_failed, subscription.updated, subscription.deleted
[ ] Test events fire from Stripe dashboard → correct behavior in app
[ ] Failed webhooks logged to Sentry
[ ] QA report generated
```

### Phase 8.9 — Final nav + permission QA

Matrix tests from Branches 4 + 5 end-to-end.

**Rebuild-vs-patch call:** N/A (verification phase).

**Phase 8.9 Exit Gate:**

```
[ ] Full nav click-through as each role → no broken links, no 404s, no unexpected 403s
[ ] Full permission matrix verified: every endpoint × every role
[ ] Impersonation fully read-only
[ ] Visual QA subagent: full UI screenshot set
[ ] QA report generated
```

### Phase 8.10 — Refresh audit doc

Update `docs/workflow-audit.md` to reflect v1.0 state.

**Rebuild-vs-patch call:** REBUILD (audit doc is a snapshot; regenerated fresh).

**Phase 8.10 Exit Gate:**

```
[ ] docs/workflow-audit.md regenerated reflecting v1.0 state
[ ] Every original finding marked CLOSED or deferred (with reason)
[ ] New findings from Branch 9 will feed into this doc
[ ] QA report generated
```

**Branch 8 Exit Gate** (see G.2 universal checklist; phase-specific additions):

```
[ ] Dashboard endpoints return < 500ms with Ross Built production volume
[ ] Sentry captures test errors from every instrumented path
[ ] Claude API cost drops ≥ 80% on repeat invoice parses (caching verified)
[ ] All console.log removed from production routes
[ ] Smoke test harness runs green
[ ] Every email template renders correctly in Gmail + Outlook
[ ] Every Stripe test event handles correctly
[ ] Role × endpoint permission matrix test PASSES
[ ] docs/workflow-audit.md refreshed
```

---

## BRANCH 9 — Final Pre-Deploy Sweep

**Purpose:** One last comprehensive check before production deploy. Catches anything that slipped through branches 1–8. No new features; only verification and final polish.

**Duration estimate:** 2–3 Claude Code sessions

**Subagents deployed heavily:**
- **Regression check subagent** — runs every smoke test from every branch in sequence
- **Visual QA subagent** — full UI sweep at every breakpoint, every role, every page state
- **Schema validator subagent** — full data model audit vs Part 2
- **Security audit subagent** — RLS check, endpoint permission check, impersonation check
- **Rebuild scanner subagent** — final scan for any remaining "placeholder", TODO, FIXME comments

**Interim infrastructure to replace before Branch 9 completes:** `__tests__/_runner.ts` was introduced in Phase 1.2 (commit `87218b0`) as a minimal discovery + subprocess runner so multiple per-phase test files could coexist without a framework. It is interim infrastructure — Branch 9 **MUST** replace it with a real test framework. Vitest is preferred (zero-config TypeScript support, native Node APIs, plays well with tsx, and `node:assert` calls in current tests are vitest-compatible as-is); jest is an acceptable alternative but heavier. When replacing: preserve the single-file-per-phase test structure that the regression fences depend on, keep the subprocess-isolation property so one file's failure doesn't halt siblings, and migrate each existing `*.test.ts` to the framework's assertion style. The `DEP0190` warning from the current runner's `spawnSync({ shell: true })` will go away naturally once the framework takes over.

### Phase 9.1 — Full regression sweep

**Goal:** Every workflow from every branch runs green.

**Scope:**
- **Invoice lifecycle:** upload → parse → PM review → QA review → ready-to-pay → draw inclusion → paid
- **PO lifecycle:** manual create → drag-create → CO-spawned create → issued → invoiced → closed
- **CO lifecycle:** all 5 types, all 3 pricing modes, drag-create + manual, approval chain tested
- **Proposal lifecycle:** drag-create → review → accept → convert to PO AND convert to CO
- **Draw lifecycle — AIA mode:** full 10-step flow from create to paid
- **Draw lifecycle — Milestone mode:** full flow with milestone-based billing
- **Draw lifecycle — T&M mode:** full flow with labor + materials + markup
- **Ingestion:** drop every document type, verify classification + extraction
- **Approval chains:** test default chain + custom chain with conditions
- **Client portal:** invite client, client logs in, views job state, sends message
- **Reports:** all 9 prebuilt reports render + export

**Manual tests:** ~50 tests across workflows. Test runner subagent executes in parallel.

**Exit gate:**
```
[ ] All 50+ regression tests PASS
[ ] Any failures reproduced, root cause identified, fixed, and retested
[ ] No "flaky" tests (must PASS on 3 consecutive runs)
```

### Phase 9.2 — Full visual QA sweep

**Goal:** Every page looks right at every breakpoint, every role, every state.

**Scope (per page, per role, per breakpoint):**
- Desktop (1920×1080)
- Tablet (768×1024)
- Mobile (375×667)
- Roles: owner, admin, pm, accounting
- States: empty, loading, populated (typical), populated (heavy data), error

**Pages to capture:**
- Dashboard
- /jobs (all jobs rollup)
- /jobs/[id] (job detail, every tab)
- /invoices (all tabs)
- /invoices/[id] (detail)
- /draws (global + detail)
- /change-orders (global + detail)
- /purchase-orders (global + detail)
- /proposals (global + detail)
- /vendors (list + detail)
- /ingest
- /reports (all 9)
- /settings (all subpages)
- /admin/platform (if platform admin)
- Client portal (client perspective)

**Visual QA subagent** generates ~200+ screenshots compiled into the phase QA report.

**Exit gate:**
```
[ ] Every page captured at every breakpoint × every role × every state
[ ] Zero broken layouts, zero overflow, zero unreadable text
[ ] Co-brand header renders correctly on every breakpoint
[ ] Empty states have CTAs
[ ] Error states are not blank pages
[ ] Loading states don't flash
```

### Phase 9.3 — Security audit

**Goal:** No holes before real customers touch this.

**Security audit subagent runs:**

1. **RLS policy coverage:** Every tenant table has org_id RLS. Every role has appropriate read/write. Drop any one policy → data leak simulated.
2. **API endpoint permission matrix:** Every endpoint × every role. Unauthorized = 403.
3. **Impersonation behavior:** Admin impersonates PM → reads work, writes blocked with clear 403.
4. **Service-role audit:** Any service-role operations logged to `platform_admin_audit`.
5. **Secrets check:** No API keys, tokens, or credentials in source code.
6. **File upload validation:** File type + size limits enforced. Storage paths scoped to org.
7. **Signed URL expiration:** All file access goes through signed URLs with TTL.
8. **CSRF protection:** Every mutation has CSRF token.
9. **Rate limiting:** Claude API calls rate-limited per org.
10. **Input sanitization:** SQL injection, XSS attempts rejected.

**Exit gate:**
```
[ ] Full security matrix audited, documented in docs/security-audit.md
[ ] Every item PASSES
[ ] Penetration test scenarios (at least 10) all fail as expected
```

### Phase 9.4 — Data integrity spot-check

**Goal:** Real Ross Built data migrated via ingestion pipelines is accurate.

**Scope:**
- Migrate sample Ross Built data: 10 invoices, 5 POs, 2 COs, 1 historical draw
- Verify every entity created matches source document
- Verify pricing_history populated correctly
- Verify budget_lines rollups correct
- Verify G702/G703 math on a new draw generated from migrated data

**Exit gate:**
```
[ ] Every migrated entity's key fields match source document
[ ] G702 math balances to the dollar
[ ] No orphan rows in any relationship
[ ] Pricing history rows correspond 1:1 with source lines
```

### Phase 9.5 — Performance benchmarks

**Goal:** Production-ready perf.

**Benchmarks:**
- Dashboard: P95 < 1s (Ross Built scale)
- Invoice list: P95 < 500ms
- Draw detail: P95 < 2s (complex G703 calc)
- Full-org search: P95 < 1s
- Ingest classification: P50 < 5s (Claude Vision call)
- Cost code query on large pricing_history: P95 < 500ms

**Subagent:** Performance test runner hits each endpoint 100 times, reports P50/P95/P99.

**Exit gate:**
```
[ ] Every benchmark PASSES
[ ] No regressions vs Branch 8 baseline
[ ] Indexes confirmed via EXPLAIN on slow queries
```

### Phase 9.6 — Docs refresh

**Goal:** Every doc reflects v1.0 state.

**Docs to refresh:**
- `docs/workflow-audit.md` — post-rebuild state, all fixed items marked CLOSED
- `CLAUDE.md` — current conventions, paths, rules
- `docs/data-model.md` — NEW: export of Part 2 of this plan as standalone reference
- `docs/permission-matrix.md` — from Branch 5
- `docs/security-audit.md` — from Phase 9.3
- `docs/testing.md` — how to run the test harness
- `README.md` — install, local dev, deploy

**Exit gate:**
```
[ ] Every doc updated and committed
[ ] No stale references to deleted features / paths / conventions
```

### Phase 9.7 — Deployment dry run

**Goal:** Validate the actual deploy to production environment.

**Scope:**
- Deploy to a staging environment with production-like config
- Run full smoke test against staging
- Verify Stripe webhook receives events correctly
- Verify Resend email actually sends from staging domain
- Verify Supabase RLS policies active in staging
- Verify Sentry receives test error from staging
- Load-test: simulate 50 concurrent users

**Exit gate:**
```
[ ] Staging deploy succeeds
[ ] All external integrations work in staging
[ ] Load test passes (no errors, no slow queries)
[ ] Rollback procedure documented and tested
```

### Phase 9.8 — Final pre-deploy checklist

**One-page go/no-go checklist:**

```
BRANCH COMPLETION
  [ ] Branch 1 final QA report signed off
  [ ] Branch 2 final QA report signed off
  [ ] Branch 3 final QA report signed off
  [ ] Branch 4 final QA report signed off
  [ ] Branch 5 final QA report signed off
  [ ] Branch 6 final QA report signed off
  [ ] Branch 7 final QA report signed off
  [ ] Branch 8 final QA report signed off
  [ ] Branch 9 all phases PASS

AUDIT FINDINGS
  [ ] Every finding from docs/workflow-audit.md (original) marked CLOSED
  [ ] Any new findings from Branch 9 marked CLOSED or explicitly deferred with reason

PRODUCTION READINESS
  [ ] Stripe production keys configured
  [ ] Resend production domain configured
  [ ] Sentry production project configured
  [ ] Supabase production project healthy
  [ ] DNS pointing to nightwork.build
  [ ] SSL certificates valid
  [ ] Backup strategy documented
  [ ] Disaster recovery plan documented
  [ ] Incident response runbook exists

TEAM READINESS
  [ ] Jake has reviewed every branch QA report
  [ ] Ross Built data ready for dogfood
  [ ] Dogfood plan agreed (2–4 weeks, what to watch for)
  [ ] Known issues log exists (for stuff we're knowingly shipping with)
```

### Branch 9 Final Exit Gate

**The deploy gate.** Cannot go to production until all pass.

```
[ ] All 8 phases of Branch 9 PASS
[ ] Final pre-deploy checklist 100% complete
[ ] Ross Built dogfood plan agreed
[ ] Jake gives explicit GO
```

Once Branch 9 passes: dogfood → production deploy → v1.5 planning begins.

---

# PART 6 — APPENDIX

## 6.1 Research references

Industry standards referenced in this plan:
- **AIA G702 / G703** — American Institute of Architects payment application standard
- **CSI MasterFormat** — Construction Specifications Institute cost code taxonomy
- **Procore patterns** — CO → PO creation, commitments terminology
- **Three-way match** — AP standard for PO-invoice-receipt validation
- **Contract types** — ABC (Associated Builders and Contractors) 5-contract-type framework
- **Burden rate / overhead allocation** — multiple methods (job cost, general ledger, activity-based)
- **Buildertrend client portal** — reference for what clients expect to see

## 6.2 Open decisions deferred to execution time

These aren't blockers but should be decided during branches:

- **Retainage default %** — 10% is industry standard for residential; Jake doesn't use retainage at Ross Built. Default to 10% with option to set 0 on org or job.
- **Payment schedule rules** — which to pre-seed as org defaults (5/20, 15/30, net 15, net 30, custom).
- **Starter cost code template for Ross Built** — build from existing Ross Built list or use a generic custom builder template? Recommend: generic template, Jake customizes.
- **PO templates v1 language** — generic subcontractor agreement clauses, Jake refines for Ross Built specifically later.
- **Milestone template** — what default milestones to seed for fixed-price jobs (the 5-draw example from research is a good start).

## 6.3 Naming conventions glossary

For anyone (human or AI) coming into the codebase:

- **"Draw"** — a progress billing event (G702 = summary, G703 = line detail in AIA mode; milestone completion in milestone mode; period billing in T&M mode)
- **"Direct charge"** — an invoice line with no PO, billed directly against a cost code (replaces "non-PO spend")
- **"Committed cost"** — sum of issued PO amounts, tracked separately from invoiced
- **"Budgetary CO"** — a CO with a placeholder amount pending firm pricing
- **"Allowance overage"** — an automatic CO created when an invoice exceeds an allowance cost code's budget
- **"Pricing history"** — the table that stores every cost-incurring line item for future benchmarking
- **"Document extraction"** — the AI-processed version of an uploaded document awaiting verification
- **"Approval chain"** — the org-configured workflow for a specific mutation type
- **"Contract type"** — per-job classification that drives draw mode, CO handling, client visibility

## 6.4 What's NOT in this plan (deliberately)

Excluded from v1.0 with explicit reason:

| Feature | Why not in v1.0 | When |
|---|---|---|
| Plan takeoff AI | Needs v1.0 data to train against | v1.5 |
| Proposal builder (create) | v1.0 handles ingestion; creation is more involved | v1.5 |
| QuickBooks sync | Needs API partnership + accounting logic | v1.5 |
| Daily logs | Adds field mobile complexity | v2.0 |
| Schedules | Big standalone feature | v2.0 |
| Time tracking | Needs mobile clock-in infrastructure | v2.0 |
| Overhead allocation | Needs GL data, complex math | v2.0 |
| Flexible report builder | Prebuilt reports cover 80% use | v2.0 |
| Lead management | Needs marketing funnel features | v3.0 |
| Email ingestion | Requires IMAP/SMTP infrastructure | v3.0 |
| Warranty claims | Post-closeout feature, no customer demand yet | v3.0 |
| RFIs, submittals | Large Procore-territory features | v3.0+ |

**This list itself is the roadmap.** When a customer asks "does Nightwork do X?" the answer is "not yet, but it's on the roadmap for v1.5" — which is a far better answer than "no."

## 6.5 Rebuild Decision Tree (quick reference)

This is the same flow as SR.3, in compact form for Claude Code to scan mid-session:

```
Encountering existing code that needs modification?
│
├─ Ask: Does it follow Part 2 naming conventions?
│       Does it align with target architecture (Part 1)?
│       Does it have proper permissions (Part 1 §1.13)?
│       Are cascades transactional?
│       Is there dead code or commented-out blocks?
│
├─ ALL YES → PATCH is OK
│            (modify in place, add tests, document change)
│
└─ ANY NO → REBUILD (strict default)
             (delete, rewrite fresh, match Part 2 exactly,
              add tests, log decision in QA Report §6)

When in doubt: REBUILD.
Patching creates compounding tech debt.
```

## 6.6 QA Report File Template (empty file to fill)

The QA report template is defined in SR.6. For reference, Claude Code can copy this starter when generating a QA report:

```markdown
# QA Report — Branch X Phase Y
**Phase name:** 
**Generated:** 
**Session(s):** 
**Rebuild-vs-patch decisions:** 

## 1. Executive summary
## 2. Exit gate checklist
## 3. Git log
## 4. Schema changes
## 5. Code changes
## 6. Rebuild-vs-patch log
## 7. Functional test results
## 8. API endpoint test matrix
## 9. Visual QA (screenshots)
## 10. Regression check
## 11. Performance check
## 12. Subagent output
## 13. Issues surfaced (but not in scope)
## 14. Open questions for Jake
## 15. Ready to advance? YES/NO
```

File location: `/mnt/user-data/outputs/qa-report-branch-X-phase-Y.md`

## 6.7 Subagent deployment quick reference

Per SR.7, subagents are deployed tactically. Quick map:

| Subagent | When deployed | What it does |
|---|---|---|
| Schema validator | Any phase touching schema | Read migrations + Part 2 → report drift |
| Visual QA | Any phase touching UI | Chrome MCP screenshots across roles/breakpoints/states |
| Test runner | Any phase with >5 tests | Execute tests in parallel, compile results |
| Regression check | Every phase | Run prior-branch smoke tests |
| Rebuild scanner | Phases touching existing code | Apply rebuild-vs-patch tree per file |
| Extraction prompt tester | Branch 3 phases | Test Claude extraction accuracy on sample docs |
| Security audit | Branch 5, Phase 9.3 | Full role × endpoint matrix, RLS check, impersonation |
| Performance test runner | Branch 8, Phase 9.5 | Hit endpoints 100x, report P50/P95/P99 |

Each subagent's output lands in **Section 12** of the phase QA report.

---

# END OF PLAN

**Next step:** Jake reviews this doc end to end. When approved, I write Branch 1 Phase 1.1 prompt for Claude Code. Execution begins.
