# Drummond sanitized fixtures

This directory holds **sanitized** Drummond data used by the `/design-system/prototypes/*` routes (Stage 1.5b).

## Posture

- **All data here is COMMITTED** to git and shipped via Vercel preview. Hook T10c's sample-data isolation rule covers this directory by inheritance from `_fixtures/`.
- **Real customer data NEVER lives here.** Sanitization is mandatory per D-029.
- The substitution map (real → fictional) lives at `.planning/fixtures/drummond/SUBSTITUTION-MAP.md` (gitignored).
- The raw Drummond source files live at `.planning/fixtures/drummond/source3-downloads/` (gitignored).

## Build-time grep gate

A build-time check rejects any committed `*.ts` here that contains real Drummond names ("Drummond", real vendor names, "501 74th"). The check lives in the extraction script and runs before the sanitized output is written.

## Files (populated during /gsd-execute-phase)

- `index.ts` — barrel export
- `jobs.ts` — sanitized Drummond job record(s)
- `vendors.ts` — 17 Drummond vendors with fictional substitutes
- `cost-codes.ts` — sanitized cost code list
- `budget.ts` — sanitized budget lines (~25-50)
- `change-orders.ts` — sanitized CO chain (4-6 entries)
- `invoices.ts` — 4-6 representative invoices spanning the workflow
- `draws.ts` — 5 historical pay apps with G703 detail
- `lien-releases.ts` — Florida 4-statute lien release set
- `schedule.ts` — reconstructed schedule for Gantt prototype (per Q2 override C)
- `types.ts` — shared types

## Provenance

Each sanitized file has a header comment citing the source raw file(s) it derives from. Example:

```ts
// Sanitized from .planning/fixtures/drummond/source3-downloads/Drummond - Pay App 5 ...xls
// Substitution map applied: see .planning/fixtures/drummond/SUBSTITUTION-MAP.md
// Generated: 2026-MM-DD by scripts/sanitize-drummond.ts
```

This README lives here permanently — it documents the directory's purpose for future readers.
