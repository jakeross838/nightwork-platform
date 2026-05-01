---
name: nightwork-enterprise-docs
description: Use this skill whenever architectural changes ship — new entities, new APIs, schema migrations, RLS changes, new auth/permission flows, new audit log writers, new external integrations. Maintains the enterprise documentation suite under docs/ — security, compliance, architecture, onboarding — so it stays in sync with code. Triggers on schema changes, new API routes, migration files, auth/membership changes, audit log changes, integration additions, and Vercel/infra changes.
---

# Nightwork enterprise documentation

Nightwork ships to a 100k-tenant horizon. That means the docs that buyers, auditors, and new engineers read have to be load-bearing, not ornamental. This skill keeps them in sync with the code on every change.

## When this skill activates

- A new entity is added (new table, new API resource).
- A migration file lands in `supabase/migrations/`.
- An RLS policy changes.
- An audit log writer is added or changed.
- A new API route exposes data outside an org boundary.
- A new external integration is wired up (Stripe, Anthropic, future Procore/QuickBooks/Bluebeam/Buildertrend).
- A new auth/permission flow ships (platform admin, org role, impersonation, signed cookies).
- Vercel / infra changes ship (env vars, regions, edge functions).

## Documentation sets to maintain

### `docs/security/`

- `threat-model.md` — STRIDE-style threat model. Update when new entry points appear (new APIs, new integrations, new auth flows).
- `data-flow-diagrams.md` — Mermaid diagrams showing data flow per major workflow (invoice intake, draw generation, payment push, etc.). Update when a new entity/integration enters or exits the system.
- `rls-architecture.md` — table-by-table RLS posture: who can SELECT/INSERT/UPDATE/DELETE under what predicates. Update on every migration that adds or changes RLS.
- `audit-log-coverage.md` — every table that should be audited, paired with the writer. Catches gaps where a table changed without audit-log coverage.
- `secrets-and-env.md` — every env var, what it does, where it's stored (Vercel, Supabase), rotation cadence. No values, just inventory.

### `docs/compliance/`

- `soc2-readiness.md` — SOC2 Type II checklist. Categories: Security, Availability, Confidentiality, Processing Integrity, Privacy. Update with progress markers (covered / partial / open) as features ship.
- `data-retention.md` — retention windows per entity. Cost data forever, audit logs forever, ephemeral logs 30 days, etc. Update on schema changes that introduce new entities.
- `encryption-at-rest-and-in-transit.md` — Supabase Postgres encryption posture, Vercel transport, Anthropic data handling, S3-equivalent file storage. Update when storage backend or transport changes.
- `pii-inventory.md` — list every column that contains PII (client emails, vendor phone, addresses, etc.) and the access controls that protect it. Update when adding or renaming columns.

### `docs/architecture/`

- `entity-catalog.md` — every table with description, parent (`org_id`, `job_id`, etc.), and canonical workflows. Update when migrations land.
- `api-catalog.md` — every API route with method, auth posture, request/response shape, idempotency posture. Update when API routes are added or changed.
- `state-machines.md` — workflow status diagrams for invoice, draw, change order, proposal, etc. Update when status values are added or transitions change.
- `integration-map.md` — external services, what they do, retry posture, fallback posture. Update when integrations are wired up or removed.

### `docs/onboarding/`

- `getting-started.md` — clone, install, set env, seed Drummond fixtures, run dev server. Update when env vars, fixtures, or setup steps change.
- `architecture-tour.md` — 30-minute walkthrough of where the major files live and why. Update on major refactors.
- `glossary.md` — domain terms (PCCO, G702, G703, T&M, AIA, lien release, draw, COR, RFI, punchlist) defined for new engineers. Update when new domain concepts enter the codebase.
- `first-pr-guide.md` — how to do a small change end-to-end (find issue, run plan-phase, execute, ship). Update when GSD/Nightwork tooling changes.

## What "in sync" means

This skill does NOT regenerate every doc on every change. It checks the diff against the doc inventory and updates only what's affected:

| Code change                                | Docs to touch                                                |
|--------------------------------------------|--------------------------------------------------------------|
| New table                                  | entity-catalog, rls-architecture, audit-log-coverage, data-retention, pii-inventory (if PII), threat-model |
| New API route                              | api-catalog, threat-model, data-flow-diagrams                |
| Status value added                         | state-machines, audit-log-coverage                           |
| Migration changes RLS                      | rls-architecture, threat-model                               |
| New external integration                   | integration-map, threat-model, data-flow-diagrams, secrets-and-env, soc2-readiness |
| New env var                                | secrets-and-env, getting-started                             |
| New permission/role                        | rls-architecture, threat-model, soc2-readiness               |

## Update protocol

When invoked:

1. Read the diff (or the user-described change).
2. Map the change to the affected doc rows in the table above.
3. Update each affected doc in place — preserve existing structure, append/edit specific sections.
4. If a doc doesn't exist yet, scaffold it with the section headings from this skill.
5. Update `docs/CHANGELOG.md` (create if missing) with a one-line entry: `YYYY-MM-DD — <doc> updated (<change description>)`.
6. Do NOT touch unrelated docs — surgical edits only.

## Cross-references

- `nightwork-compliance-reviewer` agent — uses these docs as the source of truth for plan-level compliance checks.
- `nightwork-multi-tenant-architect` agent — references rls-architecture.md when reviewing plans for tenant safety.
- `security-review` skill (ECC) — pairs with this skill on security work.
- `gsd-docs-update` command — Nightwork's enterprise docs are part of what `/gsd-docs-update` regenerates.
