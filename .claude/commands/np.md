---
name: np
description: Nightwork plan wrapper. Confirms EXPANDED-SCOPE.md exists for the phase, then chains /gsd-discuss-phase → /gsd-plan-phase → /nightwork-plan-review with the EXPANDED-SCOPE.md fed as input context. Per D-011 + D-018 — wrappers chain GSD orchestrators with Nightwork-specific gates. If EXPANDED-SCOPE.md is missing, blocks and tells Jake to run /nightwork-init-phase first.
argument-hint: "<phase-name>"
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - Grep
  - Glob
  - Task
  - SlashCommand
---

<objective>
Plan a Nightwork phase, with the requirements-expansion artifact (EXPANDED-SCOPE.md) feeding into discussion and planning so the plan reflects the full surfaced scope, not just Jake's initial stated scope.

`/np <phase-name>` replaces the bare `/gsd-plan-phase <phase-name>` for any Nightwork phase.
</objective>

<arguments>
$1 = phase name. Required.
</arguments>

<algorithm>

## Pre-step — Verify EXPANDED-SCOPE.md exists

Read `.planning/expansions/<phase-name>-EXPANDED-SCOPE.md`.

- **If file missing:** abort with message:
  > "EXPANDED-SCOPE.md missing for phase `<phase-name>`. Run `/nightwork-init-phase <phase-name>` first to capture stated scope, run requirements expansion, and complete auto-setup."
- **If file exists with status DRAFT:** abort with message:
  > "EXPANDED-SCOPE.md is DRAFT — not approved yet. Re-run `/nightwork-init-phase <phase-name>` to walk through approval, or edit the Status line manually if you've already reviewed."
- **If file exists with status APPROVED:** proceed.

## Step 1 — Discuss

Run `/gsd-discuss-phase <phase-name>` with EXPANDED-SCOPE.md as additional context.

How: pass `--context-file .planning/expansions/<phase-name>-EXPANDED-SCOPE.md` if `/gsd-discuss-phase` supports it; otherwise pre-pend the EXPANDED-SCOPE content to the discuss-phase input.

The discussion converts EXPANDED-SCOPE.md's open questions and recommended scope into a SPEC.md / DISCUSSION.md (per GSD convention) with falsifiable acceptance criteria.

If `/gsd-discuss-phase --auto` is more appropriate (Jake wants to skip interactive Q&A because EXPANDED-SCOPE already addressed everything), allow that flag through.

## Step 2 — Plan

Run `/gsd-plan-phase <phase-name>`.

The planner produces PLAN.md with task breakdown, dependency graph, acceptance criteria, and goal-backward verification. The acceptance criteria target from EXPANDED-SCOPE.md §7 carries forward.

## Step 3 — Plan-review

Run `/nightwork-plan-review <phase-name>`.

Spawns architect + planner + enterprise-readiness + multi-tenant-architect + scalability + compliance + security-reviewer + design-pushback (where applicable) in fresh contexts via Task tool. Critical findings block execute (per D-007 enterprise readiness gate).

## Step 4 — Report

Return a single message ≤250 words:

```
✓ Phase <phase-name> planned

EXPANDED-SCOPE.md      Status: APPROVED (loaded as input context)
DISCUSSION.md          Sections: <N>; ambiguities resolved: <N>
SPEC.md                Acceptance criteria: <N falsifiable items>
PLAN.md                Tasks: <N>; estimated waves: <N>; parallelizable: <N>
PLAN-REVIEW.md         Verdict: <PASS | NEEDS WORK | BLOCKING>
                       Reviews:
                         architect:           <PASS | findings>
                         planner:             <PASS | findings>
                         enterprise-readiness: <PASS | findings>
                         multi-tenant:        <PASS | findings>
                         scalability:         <PASS | findings>
                         compliance:          <PASS | findings>
                         security:            <PASS | findings>
                         design-pushback:     <PASS | findings | N-A>

Next:
  /nx <phase-name>      — preflight + execute + qa
                          (preflight will validate setup is fresh; execute runs the plan; qa gates ship)

If plan-review verdict is BLOCKING:
  Address the BLOCKING findings, then re-run /np <phase-name> (it'll re-plan with the corrections).
```
</algorithm>

<error-handling>
- **EXPANDED-SCOPE.md missing**: abort, tell Jake to run `/nightwork-init-phase`.
- **EXPANDED-SCOPE.md is DRAFT**: abort, tell Jake to approve or re-run init.
- **/gsd-discuss-phase fails**: surface the failure; don't auto-retry.
- **/gsd-plan-phase fails**: same.
- **Plan-review BLOCKING**: don't auto-fix. Surface findings to Jake. He decides whether to revise plan, revise EXPANDED-SCOPE, or override.
</error-handling>

<rules>
- **Never run /gsd-execute-phase from this wrapper.** That's `/nx`'s job.
- **Never skip plan-review.** D-007 mandates plan-level review before execute.
- **Don't modify EXPANDED-SCOPE.md.** If the plan-review surfaces a scope gap, surface it to Jake; he updates EXPANDED-SCOPE explicitly and re-runs init.
- **Pass through GSD args.** `--auto`, `--all`, `--chain`, etc. are valid; preserve them.
</rules>
