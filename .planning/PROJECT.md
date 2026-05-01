# Nightwork — Project

**Source of truth:** `docs/nightwork-plan-canonical-v1.md`. This file is a thin index over that canonical doc, structured to fit GSD's expected `.planning/` shape. When the canonical plan changes, the canonical plan wins; update this file to follow.

**Last canonical-plan refresh:** 2026-04-29 (commit `d5222a5`).

## What it is

Nightwork is the AI-powered operating system for custom home builders. Replaces the paper-and-spreadsheet workflow of $1.5M–$10M+ residential GCs with one system where data enters once and flows everywhere — invoices to draws, proposals to POs, COs to budgets, lien releases to payment schedules. Multi-tenant from day one. Pre-launch — Ross Built is Tenant 1.

Full prose: `docs/nightwork-plan-canonical-v1.md` §1 (Identity, mission, four-pillar moat thesis).

## Who it's for

- **Now:** Ross Built Custom Homes — Bradenton/Anna Maria, FL. ~14 simultaneous projects, cost-plus open-book, two admins (Jake, Andrew), six PMs, three accounting roles.
- **Next:** Custom and semi-custom builders running 1–15 simultaneous jobs who today live in QuickBooks + Excel + Buildertrend + email + paper.
- **Pricing:** Starter $249/mo, Pro $499/mo, Enterprise $799/mo. No contracts.

## Standing rules (R.1–R.23)

23 standing rules govern day-to-day decisions. Full text: `docs/nightwork-plan-canonical-v1.md` §3. Key examples:

- R.1: Never kill running processes.
- R.2: Recalculate, never increment/decrement.
- R.3: Org-configurable, never hardcoded.
- R.7: Log all state changes to status_history.
- R.8: Amounts in cents.
- R.9: Source document provenance.
- R.10: Optimistic locking on mutations.
- R.16: Migration files are the source of truth.
- R.21: Synthetic test fixtures, never production-shaped data (Drummond is the canonical reference job).
- R.23: Codebase-precedent check for RLS and table conventions.

## Tech stack

Next.js 14 (App Router) + TypeScript + Tailwind + shadcn/ui + Supabase (Postgres + RLS) + Stripe + Vercel. Anthropic SDK for AI parsing. See `.planning/codebase/STACK.md` for the full inventory.

## Build system

This project uses GSD v1.38.5 + an enforcement-driven Nightwork extension layer (custom skills, agents, commands, hooks). See `.planning/config.json` for orchestration config and `.claude/` for skill/agent/command/hook implementations. Build-system setup script: `nwrp1.txt` (delivered 2026-04-29).

## Cross-references

- `CLAUDE.md` — session-start context, architecture rules, Nightwork standing rules, deployment runbook.
- `docs/nightwork-plan-canonical-v1.md` — full plan text (sections 1–13).
- `docs/CHANGELOG-plan-consolidation.md` — what was consolidated and why.
- `.planning/ROADMAP.md` — phase plan summary (links into §9 of the canonical).
- `.planning/REQUIREMENTS.md` — requirement summary (links into §3 + §4 of the canonical).
- `.planning/STATE.md` — current implementation state.
- `.planning/codebase/` — STACK / ARCHITECTURE / CONVENTIONS / CONCERNS / INTEGRATIONS / STRUCTURE / TESTING (mapper output).
- `.planning/audits/` — security / compliance baseline scans.
- `.planning/deployment.md` — Vercel deployment runbook.
