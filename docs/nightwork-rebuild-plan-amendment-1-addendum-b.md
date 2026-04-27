# Amendment 1 — Addendum B

**Date:** 2026-04-27
**Amends:** `docs/nightwork-rebuild-plan-amendment-1.md`
**Scope:** Canonical item registry — supersede the planned new `canonical_items`
table by adding embedding + occurrence_count columns to the existing `items`
table.

---

## Context

Amendment-1 §Phase 3.3 specifies a new `canonical_items` table and §Phase 3.4
specifies `proposal_line_items.canonical_item_id REFERENCES canonical_items(id)`.
This was authored without auditing `src/lib/cost-intelligence/`. The codebase
already has a canonical item registry — the `items` table (migration 00052,
matured through 00073) — that is **richer** than what amendment-1 planned:
existing `items` carries `item_type`, `unit`, `canonical_unit`,
`conversion_rules`, `pricing_model`, `scope_size_metric`, `default_cost_code_id`
in addition to all the fields amendment-1 wanted on `canonical_items`. It is
already wired to `vendor_item_pricing` (the spine), `item_aliases`, and the
4-tier matcher.

Building a parallel `canonical_items` would create two registries for the same
physical thing — invoice extraction writes "2x4 SPF stud KD 92-5/8" into one
table, proposal extraction writes the same item into the other, queries fan
across both, PMs see two layers. This is the schema-drift pattern Phase A had
to clean up.

## Decision

Phase 3.3 ships migration 00085 as an additive alter on the existing table:

```sql
ALTER TABLE items ADD COLUMN embedding VECTOR(1536);
ALTER TABLE items ADD COLUMN occurrence_count INTEGER NOT NULL DEFAULT 1;
CREATE INDEX items_embedding_idx ON items
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
```

Paired down migration drops the index + columns. **No new `canonical_items`
table is created.** The existing `items` table is the canonical item registry.

## Renames in amendment-1

Wherever amendment-1 says `canonical_items` / `canonical_item_id`, read it as
`items` / `item_id` going forward. Specifically the Phase 3.4 schema at
amendment-1 lines 314–351 (`proposal_line_items` table) updates:

```sql
-- amendment-1 line 324 — ORIGINAL
canonical_item_id UUID REFERENCES canonical_items(id),

-- THIS ADDENDUM — REVISED
item_id UUID REFERENCES items(id),
```

The Phase 3.4 plan must reflect this. No retroactive edit of amendment-1 — this
addendum is the durable record.

## Phase 3.3 hot-path boundary

Phase 3.3 is foundation only. It ships **zero changes** to the existing
matcher: `match-item.ts`, `commit-line-to-spine.ts`, `extract-invoice.ts`,
`correct-line.ts`, and the 4-tier flow (alias → trigram → AI semantic → AI new)
are byte-identical to their Phase 3.2 v2 form.

Phase 3.3 ships only the additive surface:

- `src/lib/cost-intelligence/embeddings.ts` — OpenAI wrapper +
  `generateEmbedding(text)` + `backfillItemEmbeddings(orgId)` for manual dev
  population
- `src/lib/cost-intelligence/queries.ts` — 4 functions (similarity search,
  vendor price history, cost code rollup, anomaly flag)
- `scripts/seed-canonical-items.ts` — proves the embedding pipeline end-to-end
  on 50 sample items

Embedding-on-create wiring into `commit-line-to-spine.ts` is **deferred to a
later phase**. The natural integration point is when a future phase (likely 3.4
proposal extraction, but not committed to that phase here) needs the unified
create path. The scoping decision belongs to that phase's planning, not to
Phase 3.3's addendum.

The Phase 3.2 classifier eval (36/36 = 100%) must stay green —
regression-checked at exit gate via `RUN_CLASSIFIER_EVAL=1 npm test`.

## Updated commit sequence

Phase 3.3 ships 8 atomic commits (was 7 in addendum-A):

1. `docs(amendment): addendum B — supersede planned canonical_items with items.embedding`
2. `feat(cost-intelligence): canonical cost codes table + NAHB seed` (migration 00082)
3. `feat(cost-intelligence): org cost code map with CSV import` (migration 00083; `/api/cost-intelligence/codes`; UI `/cost-intelligence/codes`)
4. `feat(cost-intelligence): enable pgvector + items.embedding column` (migrations 00084 + 00085)
5. `feat(cost-intelligence): embedding pipeline with openai`
6. `feat(cost-intelligence): query layer with 4 core functions`
7. `test(cost-intelligence): seed dataset + similarity sanity verification`
8. `qa(branch3): phase 3.3 cost intelligence foundation report`

---

## Summary

The existing `items` table is the canonical item registry. Phase 3.3 augments
it with embedding + occurrence_count instead of creating a parallel
`canonical_items` table. Phase 3.3's blast radius on the existing matcher is
zero — embedding generation is exercised only via the seed script and a manual
backfill function. Embedding-on-create integration is deferred to a later
phase, to be scoped when the natural touch point arrives.
