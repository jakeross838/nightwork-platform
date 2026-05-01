---
name: nightwork-data-portability
description: Use this skill on every schema change or new entity in Nightwork. Enforces that every entity has clean, idempotent import/export contracts. Triggers on supabase/migrations/* edits, new tables, new entity APIs, new ingest/export endpoints, and any work that moves data across the org boundary. Verifies — export schema exists, import validation exists, audit log captures both, idempotency is guaranteed on imports, and downstream workflows can be triggered by import as a first-class event.
---

# Nightwork data portability — non-negotiable contract

Nightwork's product thesis is that data flows in and out of every workflow. Every entity must be importable from a stable JSON contract and exportable to one. Imports are first-class workflow triggers — not migration utilities. This skill is checked on every schema change.

## The contract

For every entity (`X`) in Nightwork, the following four pieces must exist and be in sync:

1. **Export contract** — a typed JSON schema describing the wire format for one row (or many rows) of `X`. Lives at `src/lib/portability/<entity>/export-schema.ts`.
2. **Import validator** — a function that takes a JSON payload, validates against the export schema (Zod or matching), and either creates / updates / no-ops the row. Lives at `src/lib/portability/<entity>/import.ts`.
3. **API endpoints** — `GET /api/<entity>/export` (returns N rows for the org) and `POST /api/<entity>/import` (accepts the payload). Wired into the API catalog.
4. **Audit log writers** — `<entity>_export_audit` and `<entity>_import_audit` rows for every export and every import attempt (success and failure), capturing `{who, when, payload_hash, row_count, result}`.

## Idempotency rules

- **Same payload, same result.** Re-running an import with an identical payload (same `external_id` / natural key + same row content hash) is a no-op. The audit row is still written, marked `idempotent_skip`.
- **Stable IDs across export/import.** Use a natural key on every entity (e.g., `external_id` for invoices, `pcco_number` for change orders, `code` for cost codes) so re-imports don't create duplicates.
- **Atomic by row.** A 1000-row import that has 5 invalid rows imports 995 successfully and reports 5 rejections. It does NOT fail the whole batch.
- **No partial updates.** A single row either updates fully or not at all. Partial column updates inside an import are a bug.

## Validation rules

- **Zod schemas only.** Don't roll your own validators. Mirror the entity's existing TS types.
- **Reject unknown fields.** Use `.strict()` on the schema. Foreign payloads that contain unrelated keys are rejected, not silently passed through.
- **Cents discipline.** Money fields in the wire format are integers (cents). The import validator rejects non-integer money values.
- **Tenant safety on import.** Every import row is forced into the importer's `org_id` server-side, regardless of what the payload says. A payload claiming `org_id: <other-org>` is rejected.
- **Org-config respected.** If the importer has org-specific cost codes, fee rates, or status labels, the import maps the payload's external values to the importer's internal config (or rejects with a clear error if no mapping exists).

## Trigger downstream workflows

Imports are workflow triggers, not silent inserts. Every import dispatches the same events as a manual create. Concrete examples:

- Importing invoices fires the same `invoice.received` event as upload-and-parse — the AI confidence routing, PM inbox, duplicate detection, and audit log all run.
- Importing change orders fires `change_order.created` — budget revision and PCCO log updates happen automatically.
- Importing a finalized draw fires `draw.imported` — the budget cache trigger updates `jobs.approved_cos_total` and the dashboard reflects the new state.

If the workflow event doesn't exist yet, plan it before adding the import endpoint. Do not bypass the workflow on import.

## Required deliverables on a new entity

When adding a new table or entity to Nightwork, this skill expects:

- [ ] `src/lib/portability/<entity>/export-schema.ts`
- [ ] `src/lib/portability/<entity>/import.ts` (with idempotency logic)
- [ ] `src/app/api/<entity>/export/route.ts` (GET, paginated, filters by `org_id`)
- [ ] `src/app/api/<entity>/import/route.ts` (POST, validates, writes audit, fires workflow event)
- [ ] Migration adds `<entity>_export_audit` and `<entity>_import_audit` tables (or the existing global `data_portability_audit` table accepts new entity types)
- [ ] Test: round-trip — export 10 rows, re-import payload, verify 10 idempotent_skip audit entries
- [ ] Test: idempotency — import twice, verify second is no-op
- [ ] Test: tenant safety — import payload with foreign `org_id`, verify rejection
- [ ] Test: workflow trigger — import fires the expected downstream event
- [ ] `docs/architecture/integration-map.md` updated with the new portability surface
- [ ] `docs/security/audit-log-coverage.md` updated with the audit table coverage

## Anti-patterns the reviewer will reject

- **Export endpoint without import endpoint** (or vice versa). Portability is bidirectional.
- **Import that bypasses the workflow.** Direct `INSERT` into the entity table from an import handler.
- **Import without audit log.** Every import attempt writes audit, even failures.
- **Trust client `org_id`.** Server forces the importer's `org_id` regardless of payload.
- **Hand-rolled validation.** Use Zod with `.strict()`.
- **Silent partial updates.** Either full row update or full rejection.
- **Schema drift between TS types and export contract.** They must reference the same source of truth.

## Cross-references

- `nightwork-multi-tenant-architect` agent — checks that imports never leak across tenants.
- `nightwork-data-migration-safety` agent — runs alongside this skill on migration files.
- `nightwork-enterprise-docs` skill — keeps integration-map.md and audit-log-coverage.md current.
- Post-edit hook: `.claude/hooks/post-edit-schema.sh` — fires when `supabase/migrations/*` is touched and reminds about portability artifacts.
