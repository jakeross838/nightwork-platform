# Migration Preview

**Status: No schema changes were required for the 5 fixes.**

## What changed

All five fixes landed as code + data-only changes:

| Fix | Change type | Details |
|-----|------------|---------|
| 1. Job detail perf | Code only | Added `GET /api/jobs/[id]/overview` batched endpoint; `jobs/[id]/page.tsx` + `job-financial-bar.tsx` + `job-overview-cards.tsx` now consume a single preloaded payload |
| 2. Invoice detail 404 | Code only | `GET /api/invoices/[id]` refactored to the fast-path membership + service-role pattern; explicit `org_id` filter; 405-safe join behavior |
| 3. `/purchase-orders` 404 | Code only | New top-level page at `src/app/purchase-orders/page.tsx`; reads from existing `purchase_orders` table with a left join through `budget_lines → cost_codes` |
| 4. Bulk lien upload | Code only | New top-level page at `src/app/invoices/liens/page.tsx`; reuses existing `GET /api/lien-releases` + `POST /api/lien-releases/[id]/upload` endpoints |
| 5. Vendor matching | Code + data | Tightened matcher in `src/lib/invoices/save.ts` (dropped the first-word fallback that caused false positives); ran `scripts/backfill-vendor-ids.ts` which issued `UPDATE invoices SET vendor_id = ...` on 8 rows and inserted 1 new `vendors` row |

No columns added. No columns dropped. No indexes created. No RLS policies modified. No triggers touched. No type definitions altered.

## Data writes executed during the fixes

These were NOT migrations — they were one-time backfills through normal
write paths. Listed for transparency:

1. `UPDATE invoices SET vendor_id = NULL WHERE id = '5ca787eb-bd1c-4590-adfb-f34b3b5eebfe'` — unbind the incorrect "Florida Sunshine Carpentry → M & J Florida Enterprises, LLC" match caught during backfill.
2. `backfill-vendor-ids.ts` first pass — 7 `UPDATE invoices SET vendor_id = ...` statements.
3. `backfill-vendor-ids.ts` second pass — 1 `INSERT INTO vendors (name, org_id) VALUES ('Florida Sunshine Carpentry', ...)` and 1 `UPDATE invoices SET vendor_id = ...`.

Final DB state on `invoices` (deleted_at IS NULL):
```
total_invoices:         42
with vendor_id:         40
null vendor_id:          2   ← both have null vendor_name_raw (import_error / truly unknown)
null vendor_id w/name:   0
```

## Schema changes that MIGHT be worth adding later (not in this pass)

These were tempting but out of scope for a pre-dogfood blocker sprint. Noted
so Jake can decide.

### Optional: partial unique index on vendors to prevent duplicate creation
```sql
-- NOT APPLIED — awaiting confirmation.
-- Prevents two vendors with the same normalized name+org from being created
-- by two concurrent invoice saves.
CREATE UNIQUE INDEX IF NOT EXISTS vendors_org_lower_name_uniq
  ON vendors (org_id, lower(regexp_replace(name, '\b(llc|inc|co|corp|ltd|company|enterprises|services)\b\.?', '', 'gi')))
  WHERE deleted_at IS NULL;
```
Trade-off: would have caught the "two concurrent creates" race if that was the
silent-fail cause. But it also rejects legitimate near-duplicates like
"Smith Plumbing Inc" and "Smith Plumbing Co" which may be different vendors.
Defer until we see the race in production.

### Optional: GIN index for trigram vendor lookup
```sql
-- NOT APPLIED — awaiting confirmation.
-- Speeds up the ilike-based vendor matcher as the vendors table grows past ~1k rows.
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS vendors_name_trgm
  ON vendors USING gin (name gin_trgm_ops)
  WHERE deleted_at IS NULL;
```
Trade-off: currently 24 vendor rows in the org, so an index is premature.
Revisit when vendors crosses ~500.

Both would be applied with `mcp__supabase__apply_migration` if/when Jake
confirms.
