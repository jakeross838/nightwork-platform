---
name: nightwork-preflight
description: Use this skill BEFORE running /gsd-execute-phase via the /nx wrapper. Validates that EXPANDED-SCOPE.md is approved, SETUP-COMPLETE.md exists, prerequisite phases shipped, all required Vercel env vars present (Production + Preview), all required Supabase tables exist with RLS, all required third-party accounts active, Drummond fixtures sufficient, last QA verdict not BLOCKING, working tree clean, and branch matches phase. Writes PREFLIGHT-PASS.md (allows execute) or PREFLIGHT-FAIL.md (blocks execute, with exact remediation). Runs as part of /nx wrapper; can also be invoked standalone before any execute.
---

# Nightwork preflight skill

The last gate before code starts moving. By the time you fire this skill you have:
- An approved EXPANDED-SCOPE.md
- A successful SETUP-COMPLETE.md from `/nightwork-auto-setup`
- A planned PLAN.md from `/gsd-plan-phase`
- A passing `/nightwork-plan-review` verdict

What this skill verifies is that *nothing has drifted* between when those artifacts were produced and now: env vars haven't been deleted, the Supabase schema didn't get rolled back, the prerequisite phase didn't get unmerged, fixtures are still where the plan expects, and the branch is on a clean state Jake intended.

If any of those drifted, executing the plan will hit a wall mid-flight and force a rework. The skill blocks before that happens.

## When this skill fires

- Automatically via the `/nx <phase-name>` wrapper before `/gsd-execute-phase`.
- Manually before `/gsd-execute-phase` if Jake invokes execute directly.
- After any pause longer than ~24 hours since the last preflight ran for this phase (drift accumulates).

It does not fire for trivial work — pure docs phases, single-line bug fixes that don't touch DB or env vars, or replays of a passed preflight within the same hour.

## The 10 checks

Each check is independently pass/fail. The skill writes individual results then aggregates to a single verdict.

### Check 1 — EXPANDED-SCOPE.md exists and is approved

`.planning/expansions/<phase-name>-EXPANDED-SCOPE.md` must exist. The file must contain a line `**Status:** APPROVED` (set when Jake approves at the end of `/nightwork-init-phase`). DRAFT status fails this check.

### Check 2 — SETUP-COMPLETE.md exists

`.planning/expansions/<phase-name>-SETUP-COMPLETE.md` must exist. If it doesn't, `/nightwork-auto-setup <phase-name>` hasn't completed. If MANUAL items still pending, `MANUAL-CHECKLIST.md` exists instead — preflight fails with a "complete the manual checklist" message.

### Check 3 — Prerequisite phases shipped

Read EXPANDED-SCOPE §2 (Prerequisite gaps). For each prereq that names another phase (e.g., "Foundation F2 must ship first"), check that phase's manifest indicates a completed status (`MANIFEST.md` with all tasks done, or branch merged to main, or `STATE.md` shows phase=complete). Any phase listed as a hard prereq that's not shipped fails this check.

### Check 4 — Required env vars present in Vercel

Read EXPANDED-SCOPE for required env vars. For each, verify presence in Vercel Production AND Preview environments via `vercel env ls --environment production` and `vercel env ls --environment preview`. Missing env vars in either environment fail this check.

If `vercel` CLI isn't installed or Jake isn't logged in, surface a remediation step instead of a generic fail.

### Check 5 — Required Supabase tables exist with RLS

Read EXPANDED-SCOPE for required tables (mapped from §1 Mapped entities). Query Supabase via `mcp__supabase__list_tables` to verify each exists and `rls_enabled: true`. For each, also verify expected RLS policy shape via `pg_policies` query — at minimum, a SELECT policy filtering on `org_id`. Tables that don't exist OR exist with RLS disabled OR exist without expected policy shape fail this check.

### Check 6 — Third-party accounts active

For each third-party service named in EXPANDED-SCOPE (Resend, Stripe, Anthropic, Inngest, Sentry):
- Verify connectivity via a lightweight test call:
  - Resend: `GET /domains` (must return 200)
  - Stripe: `GET /v1/account` (200)
  - Anthropic: `POST /v1/messages` with a 1-token prompt (200) — only run on demand, not every preflight, since it costs $
  - Inngest: connection check via SDK (200)
  - Sentry: DSN reachable

Failed connectivity = check fails with the specific error.

To avoid spurious cost on every preflight, skip the Anthropic call if the last successful call was within 1 hour (cached in `.planning/expansions/<phase-name>-PREFLIGHT-CACHE.json`).

### Check 7 — Drummond fixtures sufficient

Read EXPANDED-SCOPE for any fixture requirements (e.g., "needs at least 5 historical pay apps for the back-import dogfood"). Verify each named fixture file exists in `.planning/fixtures/drummond/`. If any are missing, fail the check with the missing list.

### Check 8 — Last QA verdict not BLOCKING

Find the most recent file in `.planning/qa-runs/` (sorted by filename, which is timestamp-prefixed). Read it. Verdict line must NOT be `BLOCKING` or contain `BLOCK`. Verdict of `WARNING` or `PASS` is acceptable.

If no QA run exists yet (Stage 1+ early phases), this check is N/A and passes by default.

### Check 9 — Working tree clean

`git status --short` must return empty. Any modified, untracked, or staged files (excluding the EXPANDED-SCOPE/SETUP-COMPLETE/PREFLIGHT artifacts that may have been written by setup) fails this check.

Exception: a clean stash with a labeled name (`git stash list | grep "preflight-prep-<phase-name>"`) is acceptable — Jake intentionally parked work.

### Check 10 — Branch matches phase

Current branch (per `git branch --show-current`) should match the phase. Branches encode phase via convention: `phase-<N>-<slug>`, `wave-<N>-<slug>`, `f<N>-<slug>` (foundation), `stage-<N>-<slug>`. The branch name must contain the phase identifier from `<phase-name>`.

Exception: branches like `main`, `nightwork-build-system-setup`, or anything explicitly named in MASTER-PLAN.md §9 CURRENT POSITION can run preflight for any phase (transition branches).

## Output

### On PASS (all 10 checks passed or N/A)

Write `.planning/expansions/<phase-name>-PREFLIGHT-PASS.md`:

```markdown
# Preflight pass — <phase-name>

**Verdict:** PASS
**Generated:** <YYYY-MM-DD-HHMM>
**Branch:** <branch-name>
**HEAD:** <git-sha-short>

## Check results

| # | Check | Result | Evidence |
|---|---|---|---|
| 1 | EXPANDED-SCOPE.md approved | PASS | <path>:Status line |
| 2 | SETUP-COMPLETE.md exists | PASS | <path> exists, <N> AUTO + <M> MANUAL items validated |
| 3 | Prerequisite phases shipped | PASS / N/A | <list of prereqs and their status> |
| 4 | Vercel env vars | PASS | <list of N env vars verified in Prod + Preview> |
| 5 | Supabase tables + RLS | PASS | <list of K tables verified> |
| 6 | Third-party accounts | PASS | <list of services + 200 OK> |
| 7 | Drummond fixtures | PASS / N/A | <fixture files verified> |
| 8 | Last QA verdict | PASS / N/A | <path>:verdict line |
| 9 | Working tree | PASS | clean |
| 10 | Branch ↔ phase | PASS | <branch> matches <phase-id> |

## Verdict

PASS — execute is cleared.

Run `/gsd-execute-phase <phase-name>` (or continue via `/nx <phase-name>` which calls execute next).
```

Return a one-line message to caller: "Preflight PASS — execute cleared." Then control returns to `/nx` wrapper which calls `/gsd-execute-phase`.

### On FAIL (any check failed)

Write `.planning/expansions/<phase-name>-PREFLIGHT-FAIL.md`:

```markdown
# Preflight FAIL — <phase-name>

**Verdict:** FAIL — execute BLOCKED
**Generated:** <YYYY-MM-DD-HHMM>
**Branch:** <branch-name>
**HEAD:** <git-sha-short>

## Check results

(same table as PASS, but with at least one FAIL row)

## Failed checks

### Check N — <check name>

**Reason:** <specific failure>
**Remediation:**
1. <exact step>
2. <exact step>

## How to proceed

After remediation, re-run preflight:
- Via `/nx <phase-name>` (preferred — re-runs preflight then executes if pass)
- Standalone: invoke this skill again

If a check truly cannot be satisfied (e.g., a third-party service is genuinely down for hours and you need to proceed), Jake can override by running `/gsd-execute-phase <phase-name> --skip-preflight`. The override is logged and surfaced at the next `/nightwork-qa`.
```

Return a one-line message: "Preflight FAIL — N checks failed. See <path> for remediation. Execute BLOCKED."

## Behavior rules

- **Read-only on code and migrations.** Preflight is a verifier, not an editor. The only writes it produces are the PREFLIGHT-PASS.md / PREFLIGHT-FAIL.md / PREFLIGHT-CACHE.json under `.planning/expansions/`.
- **Idempotent.** Re-running on the same state should produce the same verdict.
- **Fast.** Target ≤30 seconds for the full check pass under normal conditions. The Anthropic call cache exists to keep this true.
- **Specific.** Every FAIL message names exactly what's missing and exactly how to fix it. No "something's wrong" generic messaging.
- **No cascading checks.** Each check runs independently; one failure doesn't skip later checks. Jake gets the full picture in one report.
- **Override-aware.** If Jake passes `--skip-preflight` to `/gsd-execute-phase`, log the override but don't run the skill. Audit trail preserved.

## Failure modes to avoid

- **Preflight passing when it shouldn't** because a check was too lenient (e.g., not actually verifying Vercel env vars exist, just checking local `.env.local`).
- **Preflight failing on legitimate transition branches** because branch-to-phase matching was too strict.
- **Preflight blocking on optional third-party services** that the phase doesn't actually use (e.g., requiring Stripe to be active for a phase that doesn't touch billing).
- **Preflight slow because of repeated Anthropic calls.** Use the 1-hour cache.
- **Preflight masking real issues by listing too many trivial ones.** Triage: BLOCKING failures (missing prereq, broken Supabase) come first; MEDIUM (env var stale value) second; informational notes (cache miss) last.

## Recovery from FAIL

When preflight blocks, Jake's options are:

1. **Remediate.** Fix the named issue, re-run preflight. Most common path.
2. **Override.** `/gsd-execute-phase <phase-name> --skip-preflight`. Override is logged; surfaces at next QA. Use sparingly — typically only for ops or for unblocking a non-Wave-1 phase whose third-party service is temporarily down.
3. **Cancel.** Decide the phase isn't ready; close `/np` plan, return to EXPANDED-SCOPE revision.

## Worked examples

### Example A — PASS

> Phase: `wave-1.1-invoice-approval`
> Branch: `wave-1.1-invoice-approval`
> All 10 checks pass. Preflight writes PASS artifact, returns "PASS — execute cleared." `/nx` wrapper calls `/gsd-execute-phase`.

### Example B — FAIL on Check 4 (env var)

> Phase: `f3-platform-primitives`
> Check 4 fails: `INNGEST_SIGNING_KEY` missing from Vercel Preview environment (Production has it).
> Remediation: `vercel env add INNGEST_SIGNING_KEY preview` and paste the key from `https://app.inngest.com/env/production/manage`.
> Preflight writes FAIL artifact, returns "FAIL — 1 check failed. See <path>." Jake adds env var, re-runs preflight, passes, executes.

### Example C — FAIL on Check 9 (working tree dirty)

> Phase: `f1-unified-entity-model`
> Check 9 fails: 3 modified files (`src/lib/api/handler.ts`, `package.json`, `package-lock.json`) — npm install side effects from setup.
> Remediation: review the diff; if intentional, commit with `chore: install <pkg> for f1` and re-run; if unintentional, `git checkout` to discard.
> Preflight FAILs until tree is clean.

### Example D — Override

> Phase: `wave-1.1-invoice-approval`
> Check 6 fails: Anthropic API returning 503 (provider outage).
> Jake decides to proceed with execute that doesn't touch Claude API calls (UI-only polish).
> `/gsd-execute-phase wave-1.1-invoice-approval --skip-preflight`
> Override logged in `.planning/expansions/wave-1.1-invoice-approval-PREFLIGHT-OVERRIDE.md` with timestamp + Jake's reason.
> `/nightwork-qa` at end of execute surfaces the override and confirms whether the failed check would have prevented the work.
