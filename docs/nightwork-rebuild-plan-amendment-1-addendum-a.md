# Amendment 1 — Addendum A

**Date:** 2026-04-27
**Amends:** `docs/nightwork-rebuild-plan-amendment-1.md`
**Scope:** Cost code spine selection for Phase 3.3

---

## Context

The original amendment-1 specified CSI MasterFormat 2024 as the canonical cost code spine for Phase 3.3 (Cost Intelligence Foundation). After review, Jake elected to defer the CSI license purchase. This addendum documents the revised approach.

## Decision

**Phase 3.3 ships with NAHB Standard Homebuilder Cost Codes as the primary canonical spine.**

CSI MasterFormat support is preserved as a **future expansion**, not removed entirely. The schema is renamed and structured to support multiple canonical spines so CSI can be added later without migration pain.

## Why NAHB

1. **Free and unencumbered.** NAHB Standard Cost Codes are published publicly by the National Association of Home Builders and are free to use without license. Marion County Building Industry Association, Planyard, Builder Academy, and inBuild all distribute the standard list.

2. **Purpose-built for residential.** NAHB codes are organized around residential construction phases (Pre-Acquisition → Land Development → Direct Construction → Financing → Sales). This matches Ross Built's actual workflow and the broader homebuilder market Nightwork targets.

3. **~200 codes is the right granularity for v1.** CSI MasterFormat has ~10,000 sections. NAHB has ~200-400 codes depending on edition. For the cost intelligence layer at MVP scale, NAHB's density is more workable.

4. **The architecture supports adding CSI later.** When Jake licenses CSI (or adds commercial GC customers who need it), the schema accommodates a second canonical spine without breaking existing data.

## Schema changes from amendment-1

**Renames** to make the schema spine-agnostic:

| Original (amendment-1) | Revised (addendum A) |
|------------------------|----------------------|
| `csi_canonical_codes` table | `canonical_cost_codes` table |
| `csi_canonical_code` column (in `org_cost_codes`, `canonical_items`, `proposal_line_items`) | `canonical_code_id` (UUID FK to canonical_cost_codes) |

**New column** on `canonical_cost_codes`:

```sql
CREATE TABLE canonical_cost_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  spine TEXT NOT NULL,               -- 'NAHB' for v1; 'CSI' added later
  code TEXT NOT NULL,                -- e.g. "01-01-0110" (NAHB) or "09 25 13" (CSI)
  parent_code TEXT,                  -- nullable, references self via (spine, code) lookup
  level INTEGER NOT NULL,            -- 1 = top level, 2 = sub, 3 = sub-sub
  category TEXT NOT NULL,            -- e.g. "Pre-Acquisition", "Land Development", "Direct Construction"
  name TEXT NOT NULL,                -- e.g. "Feasibility Study"
  full_path TEXT NOT NULL,           -- e.g. "Pre-Acquisition / Feasibility Study"
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(spine, code)
);
```

**RLS:** read-only to all authenticated users (no org scoping; this is global reference data).

**Indexes:**
- `(spine, code)` — primary lookup
- `(spine, parent_code)` — tree traversal
- `(spine, category)` — category filtering

## Data sourcing for Phase 3.3 Step 1

Replace the original "CSI MasterFormat ingestion" step with:

**Step 1 — NAHB cost codes ingestion**
- Source: NAHB Standard Homebuilder Cost Codes (public domain list)
- Reference URLs (for Claude Code to research and consolidate):
  - https://mcbia.org/nahb-standard-homebuilder-cost-codes/ — full list with codes
  - https://planyard.com/nahb-cost-codes — alternative source with template
  - https://www.scribd.com/document/457611963/NAHB-Standard-Cost-Codes-and-Variance-Codes — consolidated reference
- Build a parsed CSV/JSON of all codes with their hierarchy
- Save the source file to `docs/canonical-codes/nahb-2024.csv` (committed; this is public data, no license issue)
- Build `supabase/migrations/00082_canonical_cost_codes.sql` — table + seed data
- Insert rows with `spine='NAHB'`
- Verify row count matches expected (200-400 rows depending on edition)
- Commit: `feat(cost-intelligence): canonical cost codes table + NAHB seed`

## Phase 3.3 commit sequence — revised

The updated 7-step commit sequence for Phase 3.3:

1. `feat(cost-intelligence): canonical cost codes table + NAHB seed` (was: CSI MasterFormat ingestion)
2. `feat(cost-intelligence): org cost code map with CSV import`
3. `feat(cost-intelligence): canonical items registry with pgvector`
4. `feat(cost-intelligence): embedding pipeline with openai`
5. `feat(cost-intelligence): query layer with 4 core functions`
6. `test(cost-intelligence): seed dataset + similarity sanity verification`
7. `qa(branch3): phase 3.3 cost intelligence foundation report`

## Future: adding CSI later

When CSI is licensed and added:

1. Save licensed CSI source file to `docs/canonical-codes/csi-2024.csv` (gitignored — license terms)
2. New migration: `INSERT INTO canonical_cost_codes ... WHERE spine='CSI'`
3. Org cost code admin UI gains a "spine selector" — orgs choose which spine they're mapping to
4. Cost intelligence queries become spine-aware (org's mapping determines which canonical codes get matched)

No schema migration. No data backfill. Clean addition.

## Updated open questions

The amendment-1 "Open questions" section had:
- ❌ ~~CSI MasterFormat 2024 license procurement~~ — DEFERRED, NAHB used instead
- ✅ OpenAI API key — still needed for embeddings, no change
- (Other questions unchanged)

## Updated pre-flight checklist

Phase 3.3 pre-flight gets a small adjustment:

```
1. git status — clean working tree
2. git pull origin main — confirm latest
3. Verify docs/nightwork-rebuild-plan-amendment-1.md exists
4. Verify docs/nightwork-rebuild-plan-amendment-1-addendum-a.md exists
5. Verify docs/canonical-codes/ directory exists (will be created in Step 1 if missing)
6. Check .env.local for OPENAI_API_KEY
7. npm run dev — boots clean
8. Verify Supabase dev DB reachable
```

The CSI file check is removed.

---

## Summary

Cost code spine for v1 = NAHB (free, residential-focused, ~200-400 codes). CSI deferred until license purchase or commercial GC market need. Schema designed to accommodate both spines simultaneously, so the eventual CSI addition is additive, not migrational.
