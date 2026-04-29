---
name: nightwork-init-phase
description: Initiate a new Nightwork phase. Captures Jake's stated scope in his own words, runs the requirements-expander to surface unstated requirements, walks Jake through any auto-setup, and produces an approved EXPANDED-SCOPE.md ready for /np. This is the canonical phase-entry command — run this first for every new phase before /np or /nx.
argument-hint: "<phase-name>"
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - Grep
  - Glob
  - Task
  - AskUserQuestion
---

<objective>
Take Jake from "I want to build X" to "EXPANDED-SCOPE is approved, infrastructure is ready, and I can run `/np` to plan." This command is the front door of every phase. It enforces D-018 — every phase begins with requirements expansion + auto-setup before plan/execute.

The cost of running this command is ~5-15 minutes of Jake's time per phase. The savings: 0-3 phases of "oh wait, we forgot about X" rework downstream.
</objective>

<arguments>
$1 = phase name. Required. Examples:
- `wave-1.1-invoice-approval`
- `f1-unified-entity-model`
- `wave-2.1-daily-logs`
- `phase-3.6-invoice-po-reconciliation`

If the phase name doesn't follow `<stage>-<n>-<slug>` convention, accept it but warn — convention helps preflight Check 10 (branch ↔ phase match).

If `.planning/expansions/<phase-name>-EXPANDED-SCOPE.md` already exists with status APPROVED, abort and tell Jake to either delete-and-restart, or run `/nightwork-auto-setup <phase-name>` directly to refresh setup.
</arguments>

<algorithm>

## Step 1 — Capture Jake's stated scope

Ask Jake directly:

> "Describe what you want to build in this phase, in your own words. Be messy, don't worry about completeness. I'll handle the structure."

Capture his exact response. Don't paraphrase. Quote verbatim into EXPANDED-SCOPE.md §"Stated scope".

Tone: this is a brain-dump, not a spec. If Jake writes "polish invoice approval and ship to Ross Built for real Drummond use, make it bulletproof and mobile-friendly," capture exactly that. The expander will translate.

## Step 2 — Invoke nightwork-requirements-expander

Spawn the agent in a fresh context via Task tool:

```
subagent_type: nightwork-requirements-expander
prompt: |
  Phase: <phase-name>
  Stated scope (Jake's words, verbatim): "<from step 1>"

  Read your inputs (VISION.md, CURRENT-STATE.md, TARGET.md, GAP.md, MASTER-PLAN.md, CLAUDE.md, canonical plan, CP1-RESOLUTIONS.md if exists).
  Produce .planning/expansions/<phase-name>-EXPANDED-SCOPE.md per your contract.
```

The agent runs read-only investigation and produces EXPANDED-SCOPE.md with all 9 sections (Mapped entities/workflows, Prerequisites, Dependent-soon, Cross-cutting checklist, Construction-domain checklist, Targeted questions, Recommended scope, Risks, Hand-off).

Wait for the agent to return.

## Step 3 — Show Jake EXPANDED-SCOPE.md

Tell Jake the path. Display the §6 "Targeted questions" and §7 "Recommended scope expansion" sections inline (the most decision-relevant parts).

Ask:

> "EXPANDED-SCOPE.md drafted at `.planning/expansions/<phase-name>-EXPANDED-SCOPE.md`. Skim it. Use AskUserQuestion to give me a yes/no/A/B for each Targeted Question, or paste raw amendments. Reply 'approved' when ready."

## Step 4 — Process Jake's response

Three branches:

**Approved as-is:** edit EXPANDED-SCOPE.md to flip `**Status:** DRAFT — pending Jake approval` to `**Status:** APPROVED <YYYY-MM-DD>`. Proceed to step 5.

**Amendments to specific questions/sections:** edit EXPANDED-SCOPE.md to incorporate Jake's amendments. Show Jake the diff. Ask "approved with these amendments?" Loop until approved.

**Major rework needed:** Jake disagrees with the recommended scope or thinks the expander missed a major thing. Re-invoke the expander with the rework hint: "Phase scope was rejected because <Jake's reason>. Re-expand with <amendment>." Loop.

## Step 5 — Invoke /nightwork-auto-setup

Once EXPANDED-SCOPE.md is APPROVED, call:

```
/nightwork-auto-setup <phase-name>
```

The auto-setup command (a separate orchestrator) reads the approved EXPANDED-SCOPE.md, executes AUTO infrastructure items (DB tables, env-var-syncing, npm installs, etc.), and writes either:
- `<phase-name>-MANUAL-CHECKLIST.md` if Jake-action items remain
- `<phase-name>-SETUP-COMPLETE.md` if everything's already in place

## Step 6 — Walk Jake through MANUAL-CHECKLIST (if any)

If MANUAL-CHECKLIST.md was written, present it to Jake:

> "Auto-setup completed N AUTO items. M items need you to do them yourself (third-party signups, API keys, OAuth flows). Each has exact instructions including URL, click sequence, and where to paste the result. See `.planning/expansions/<phase-name>-MANUAL-CHECKLIST.md`. Reply when complete or paused."

Wait for Jake's signal that he's done. Don't poll.

When Jake signals done, re-invoke `/nightwork-auto-setup <phase-name>` to validate. The auto-setup command runs validation hooks for each manual item; on full pass, it writes SETUP-COMPLETE.md.

If validation fails, MANUAL-CHECKLIST.md gets updated with the still-failing items. Repeat step 6.

## Step 7 — Confirm phase ready

Once SETUP-COMPLETE.md exists, tell Jake:

> "Phase `<phase-name>` is ready.
>
> EXPANDED-SCOPE: `.planning/expansions/<phase-name>-EXPANDED-SCOPE.md` (APPROVED)
> SETUP: `.planning/expansions/<phase-name>-SETUP-COMPLETE.md`
>
> Next: run `/np <phase-name>` to plan."

</algorithm>

<reporting>
Final return message (≤200 words):

```
✓ Phase <phase-name> initialized

EXPANDED-SCOPE.md
  Status: APPROVED
  Mapped entities: <N>
  Prerequisite gaps: <N>
  Cross-cutting concerns: <N applies / N N-A>
  Targeted questions: <N answered>

SETUP-COMPLETE.md
  AUTO items: <N executed, all validated>
  MANUAL items: <N completed by Jake>

Time elapsed: <approx minutes>

Next:
  /np <phase-name>      — plan + plan-review
  (later) /nx <phase-name>      — preflight + execute + qa
```
</reporting>

<error-handling>
- **Jake's stated scope is too vague** ("build stuff"): probe gently before invoking expander. "Can you say more about what 'stuff' means? E.g., which entities? what users? what's failing today?"
- **Expander returns with internal errors**: surface the agent's error verbatim. Don't auto-retry.
- **Auto-setup fails on AUTO item**: don't proceed; Jake fixes, re-runs init-phase from step 5.
- **Jake walks away mid-MANUAL-CHECKLIST**: remember the state. When he comes back, just re-run `/nightwork-auto-setup <phase-name>` to pick up validation where it left off.
- **EXPANDED-SCOPE.md exists from prior init attempt for same phase name**: show Jake the existing file, ask "resume / discard and restart / cancel". Don't silently overwrite.
</error-handling>

<rules>
- **Never skip step 1.** Even if Jake invokes init-phase with a phase-name that's clearly self-explanatory, capture his words. Future replay needs them.
- **Don't paraphrase Jake.** Quote verbatim into EXPANDED-SCOPE.md §"Stated scope".
- **Don't pre-answer Targeted Questions.** Show them to Jake; let him answer.
- **Don't edit code.** This command produces planning artifacts and triggers infrastructure setup. Code only moves during `/gsd-execute-phase`.
- **Never proceed to step 5 without explicit approval.** EXPANDED-SCOPE.md status must be APPROVED.
- **Run as a single conversation.** Don't spawn parallel agents that need Jake's input simultaneously.
</rules>
