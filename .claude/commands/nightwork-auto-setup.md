---
name: nightwork-auto-setup
description: Inventory and execute all infrastructure setup needed for a Nightwork phase. Reads EXPANDED-SCOPE.md, categorizes each setup item as AUTO (executable via MCPs/CLIs/file-ops) or MANUAL (Jake-only — third-party signups, OAuth, API keys, DNS, strategic decisions). Runs all AUTO items, validates each, then writes a precise MANUAL-CHECKLIST for Jake. Validates manual items after Jake completes them. Writes SETUP-COMPLETE.md when fully done. Blocks phase progress until 100% verified.
argument-hint: "<phase-name>"
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - Grep
  - Glob
  - Task
---

<objective>
Take a phase's `EXPANDED-SCOPE.md` (produced by `nightwork-requirements-expander`) and ensure every piece of infrastructure that phase will need is in place — env vars, DB tables, third-party services, npm dependencies, CI config, Vercel preview URL setup, fixtures, anything else the EXPANDED-SCOPE requires. The agent does what it can and tells Jake exactly what to do for everything it can't.

Outcome: Jake can run `/np <phase-name>` next without hitting "oh wait, this needs X" five minutes into the plan.
</objective>

<arguments>
$1 = phase name (e.g. "wave-1.1-invoice-approval", "f1-unified-entity-model"). Required.

If `EXPANDED-SCOPE.md` for the phase doesn't exist at `.planning/expansions/<phase-name>-EXPANDED-SCOPE.md`, abort and tell Jake to run `/nightwork-init-phase <phase-name>` first.
</arguments>

<algorithm>

## 1. Load EXPANDED-SCOPE

Read `.planning/expansions/<phase-name>-EXPANDED-SCOPE.md` in full. Pay particular attention to:
- §1 Mapped entities and workflows
- §2 Prerequisite gaps
- §4 Cross-cutting checklist (anything marked APPLIES is in scope)
- §5 Construction-domain checklist
- §7 Recommended scope expansion (the actual deliverables)

If the file doesn't exist or is in DRAFT status without an `APPROVED` marker line: tell Jake to approve EXPANDED-SCOPE.md first, then return.

## 2. Build the setup inventory

For every item in EXPANDED-SCOPE, derive what infrastructure it needs. Common categories:

### Database (AUTO via Supabase MCP)
- New tables required by mapped entities — check existence via `mcp__supabase__list_tables`
- Missing migrations — check `mcp__supabase__list_migrations` against EXPANDED-SCOPE prerequisites
- Required RLS policies — verify shape via `mcp__supabase__execute_sql` against `pg_policies`
- Required indexes — verify via `pg_indexes`
- Required seed data (cost codes, gl codes, fixture cleanup)

### Environment variables (MANUAL — Jake)
- Cross-reference EXPANDED-SCOPE against `.env.local` and Vercel env vars
- For each missing: generate a precise checklist item with source URL and where-to-paste

### Third-party services (MANUAL or partial AUTO)
- Resend (email): MANUAL (signup + domain verify) → AUTO (write to .env, validate via test send)
- Anthropic API: MANUAL (key from console) → AUTO (write to .env, validate via curl)
- Stripe: MANUAL (account + webhook secret + product/price IDs) → AUTO (validate signature + price lookup)
- Inngest: MANUAL (signup + signing key) → AUTO (write to .env, validate connection)
- Vercel: MANUAL (project link if not done) → AUTO (env-var sync)
- Sentry: MANUAL (project + DSN) → AUTO (write to .env)

### npm dependencies (AUTO)
- Read EXPANDED-SCOPE for any new packages required
- Check `package.json`; install missing via `npm install <pkg>`
- Verify install via `npm ls <pkg>`

### CI / GitHub Actions (AUTO via file ops)
- Required workflows under `.github/workflows/`
- Required pre-commit hooks under `.claude/hooks/`

### Drummond fixtures (AUTO + MANUAL hybrid)
- AUTO: verify required fixture files exist at `.planning/fixtures/drummond/`
- MANUAL: if back-import is required (per A7), Jake confirms which Downloads files to import

### Vercel preview URL (AUTO check; MANUAL trigger)
- Verify preview deploys are working for the current branch via `gh api repos/.../deployments`
- If not: instruct Jake to push the branch (preview deploys auto-trigger on push)

### Phase-specific items (per EXPANDED-SCOPE §7)
- For UI phases: check that the design system tokens are referenced; flag any deferred design items
- For data-model phases: check no concurrent migration conflicts
- For background-job phases: verify Inngest dev server can run

## 3. Categorize each item

For each derived setup item, classify:

- **AUTO** — agent can execute via Supabase MCP, file ops, npm, gh CLI, or curl/HTTP. Examples: create migration template, install package, write config file, query Supabase, generate IIF importer skeleton.
- **MANUAL** — requires human action: Jake clicks something in a third-party UI, generates an API key, runs an interactive CLI command (`vercel link`, `gcloud auth login`, QB Desktop export). Examples: Resend account creation, OAuth consent flow, DNS records, Stripe webhook endpoint registration.
- **VALIDATE** — already done; verify it's still in place. Examples: existing env vars not blanked, existing migration not soft-deleted.

## 4. Execute AUTO items

Run them sequentially or in parallel where safe. For each:
- Capture before-state
- Execute
- Capture after-state
- Validate result (the new table exists, the new package is in node_modules, the env var is now in `.env.local`, etc.)
- Log to `.planning/expansions/<phase-name>-AUTO-LOG.md` with timestamp and outcome

Idempotency: every AUTO item must be safe to re-run. If something already exists in the desired state, skip and note.

If any AUTO item fails: do NOT proceed to MANUAL inventory. Halt, write the failure to the log, return error to Jake. Common failure modes: schema conflict, npm registry down, MCP authorization issue. Fix the root cause and re-run.

## 5. Write MANUAL-CHECKLIST.md

For each MANUAL item, write `.planning/expansions/<phase-name>-MANUAL-CHECKLIST.md`:

```markdown
# Manual setup checklist — <phase-name>

**Status:** PENDING JAKE — <N> items
**Generated:** <YYYY-MM-DD-HHMM>

After completing each item, run `/nightwork-auto-setup <phase-name>` again to validate.

## Item 1: <short title>

**Why:** <one-line rationale tied to EXPANDED-SCOPE>
**Time estimate:** <N minutes>

**Steps:**
1. Open <URL> in your browser
2. Click <Specific button or menu path>
3. Enter <specific value or take screenshot>
4. Capture: <the exact output/key/secret/URL/etc. you'll need>
5. Save to: <exact env var name OR file path OR pasted into command>

**Validation (will run automatically when you re-invoke):**
- <e.g., "Test webhook delivery via curl">
- <e.g., "API call returns 200 with expected payload shape">

---

## Item 2: ...

...

## After all items complete

Run: `/nightwork-auto-setup <phase-name>`

The command will validate every item. On 100% pass, it writes `<phase-name>-SETUP-COMPLETE.md` and you're cleared to run `/np <phase-name>`.
```

## 6. Validate MANUAL items (re-invocation pass)

When Jake re-invokes the command after completing manual items, the agent re-runs validation only:

- For each MANUAL item, run its validation hook (curl test, env-var presence check, file-existence check, etc.)
- If all pass: write SETUP-COMPLETE.md (see step 7)
- If any fail: update MANUAL-CHECKLIST.md flagging the still-failing items with explicit error message; return to Jake

## 7. Write SETUP-COMPLETE.md

When AUTO items all pass + every MANUAL item validates:

```markdown
# Setup complete — <phase-name>

**Status:** READY FOR PLAN
**Completed:** <YYYY-MM-DD-HHMM>

## AUTO items (executed)
- [x] <item> — <result> — <evidence path:line or test output>
...

## MANUAL items (validated)
- [x] <item> — validated via <validation hook>
...

## Next
Run `/np <phase-name>` to begin planning.

If you discover during planning that EXPANDED-SCOPE.md needs revision (a prerequisite was missed), update EXPANDED-SCOPE.md and re-run `/nightwork-auto-setup <phase-name>` to refresh setup.
```

## 8. Block phase progress until 100% verified

The `nightwork-preflight` skill (which fires before `/gsd-execute-phase` via the `/nx` wrapper) reads SETUP-COMPLETE.md to gate execution. If SETUP-COMPLETE.md doesn't exist for the active phase, preflight FAILS and blocks execute.

This means: there is no path to executing a phase that skipped setup. Jake's only options are (a) run `/nightwork-init-phase` → `/nightwork-auto-setup` → `/np` → `/nx` (the canonical path), or (b) explicitly bypass preflight (for one-off ops or platform-admin work) — discouraged.

</algorithm>

<reporting>
At the end of the run, return a single message of ≤300 words containing:
- Inventory size (N items, M auto, K manual)
- AUTO results: how many succeeded, how many failed (with names)
- MANUAL items pending Jake: count + 1-line summary each
- Path to AUTO-LOG.md, MANUAL-CHECKLIST.md, SETUP-COMPLETE.md (whichever apply)
- Verdict: READY FOR PLAN | PENDING JAKE (N items) | BLOCKED (auto failure)

If verdict is PENDING JAKE: include the top 3 MANUAL items in the report so Jake knows what's coming.
If verdict is BLOCKED: include the failing AUTO item's error message and proposed fix.
</reporting>

<error-handling>
- **EXPANDED-SCOPE.md missing**: tell Jake to run `/nightwork-init-phase <phase-name>` first. Don't proceed.
- **Supabase MCP unauthorized**: surface the auth error verbatim. Don't retry silently.
- **npm registry timeout**: retry once with exponential backoff. If second fails, log and halt.
- **Existing migration conflict**: stop. Surface the conflict. Do NOT auto-resolve schema conflicts — that's Jake's call.
- **Vercel CLI not installed / not logged in**: don't auto-install. Add to MANUAL-CHECKLIST as "install Vercel CLI + run `vercel login`".
- **MANUAL item validation fails**: don't escalate to error. Write back to MANUAL-CHECKLIST.md with what specifically failed (e.g., "Resend test send returned 401 — re-check API key formatting").
</error-handling>

<rules>
- **Never modify code outside `.planning/expansions/`, `.env.local`, `package.json`, `.github/workflows/`, `.claude/hooks/`, and migration files.** Any other source change is out of scope for setup; that's the phase's job.
- **Never apply a Supabase migration via the MCP.** Generate a migration FILE in `supabase/migrations/` if needed, but the apply step happens during `/gsd-execute-phase`. Setup writes the file; execute applies it.
- **Never silently overwrite existing env vars.** If an env var is already set with a different value, surface the diff to Jake; don't replace.
- **Always paired-down where applicable.** Migration files written here include `.down.sql` partners.
- **Drummond fixtures stay gitignored.** Setup may copy/derive new fixture files but they live under `.planning/fixtures/` (not committed).
- **Real customer data never lands in committed files.** Per D-029 (substitution-map approach).
</rules>
