# Nightwork Rebuild Plan — Amendment 1

**Date:** 2026-04-27
**Author:** Jake Ross + Claude (planning session)
**Status:** Draft for review
**Amends:** `docs/nightwork-rebuild-plan.md` (HEAD `c885ce3` after PR #24 merge)
**Scope:** Phases 3.3–3.10 (extraction pipelines) + Phase 4 placeholder (schedule intelligence)

---

## Why this amendment exists

The original rebuild plan was written before the cost-intelligence moat thesis was fully articulated. Phases 3.3–3.8 in the original document treat each extraction pipeline (PO, CO, Proposal, Vendor, Budget, Historical Draw) as an independent feature-shaped deliverable. After the planning session captured in this amendment, three things became clear that the original plan missed:

1. **Cost intelligence is the moat, not extraction itself.** Extraction is the input; the moat is the structured, normalized, queryable pricing database that compounds with every document Nightwork sees.

2. **POs are mostly outputs, not inputs.** Custom builders generate POs; they rarely receive them. The original Phase 3.3 (PO extraction) is largely redundant — Ross Built operations don't ingest POs as a primary flow.

3. **The retroactive CO pattern is normal field operations, not a deviation.** The original plan implicitly assumed forward-CO-only workflows. Reality is that field work routinely moves faster than paperwork; the system must support the verbal-approval-to-paper pattern without friction.

This amendment re-scopes Phases 3.3–3.10 around these three corrections. It also formally introduces the **Cost Intelligence Layer** as a first-class architectural concern with its own foundation phase.

---

## The architectural pattern

Every extraction pipeline now follows this loop:

```
Document arrives
    ↓
Classifier routes (Phase 3.2 — DONE)
    ↓
Extractor pulls structured + semantic data
    ↓
Entity created (proposal/CO/invoice/vendor/etc.)
    ↓
Cost Intelligence Layer captures unit costs, normalizes, tags canonical items
    ↓
PM reviews + edits (corrections feed back to canonical mapping)
    ↓
Future extractions get smarter (auto-suggest cost codes, flag anomalies, surface vendor benchmarks)
```

The original plan had steps 1–4. Steps 5 and 7 (the intelligence layer and feedback loop) were missing. This amendment makes them load-bearing.

---

## The moat thesis — explicit

Nightwork's defensibility against Adaptive, Procore, Buildertrend, and inBuild rests on four pillars:

**1. Universal ingestion.** Every construction document — proposal, invoice, CO, contract, plan, COI, W-9, lien release, takeoff, schedule, daily log — gets ingested, classified, extracted, and structured. Nothing else in the market does this end-to-end. Adaptive does invoices well; Procore does scheduling well; Nightwork does everything well.

**2. Cost intelligence that compounds.** Every proposal extraction populates a structured pricing database. Every PM correction teaches the system. Within 90 days, an active org has thousands of canonical line items mapped to vendors, dates, and cost codes. Within 12 months, that database is irreplaceable: switching to a competitor means losing pricing memory across the entire job history.

**3. Schedule intelligence that compounds (Phase 4).** Same pattern as cost intelligence, applied to time. Every PO has estimated start, duration, and completion. Every daily log records what actually happened. Every CO records what shifted. Over time the system knows "Faust quotes 14 days for stucco on a 4,000 SF home but actually takes 19 days on AMI in summer with 35% rain delay risk." This intelligence layer is designed for in this amendment (schedule fields on POs/COs) but the full implementation is deferred to Phase 4 after Phases 3.3–3.10 ship and the cost intelligence pattern is validated.

**4. AI as bookkeeper.** For small remodelers (the $30M-ARR market segment), Nightwork isn't "saves time on financial workflows." It IS the financial department. They literally don't have one today. The AI handles cost-code assignment, vendor matching, draw generation, anomaly detection. A human bookkeeping add-on (later) handles the edge cases.

These four pillars require the cost intelligence layer to be first-class. The original plan deferred it implicitly. This amendment makes it Phase 3.3 and lays the schema groundwork for Phase 4 schedule intelligence.

---

## Cross-org data sharing — explicitly OFF

Per Jake's decision: every org's cost intelligence is private. No cross-org rollups. No anonymized regional benchmarks. No "builders in Sarasota are paying $X."

Architectural consequence: the canonical layer must be designed so that cross-org sharing is technically possible (canonical items and CSI codes are universal across orgs) but explicitly disabled at the query layer. This preserves the option to enable it later as a paid premium tier or opt-in feature without re-architecting.

---

## Cost code architecture — 3 layers

```
┌─────────────────────────────────────────────────────────────┐
│ Layer 1: Canonical CSI MasterFormat 2024                    │
│  - 50 divisions, ~10,000 sections                            │
│  - Licensed from CSI ($300-500/year)                         │
│  - Immutable system-wide                                     │
│  - Single source of truth for cross-org normalization        │
└─────────────────────────────────────────────────────────────┘
                            ↑
                            │ maps to
                            │
┌─────────────────────────────────────────────────────────────┐
│ Layer 2: Org cost code map                                  │
│  - Each org maintains their own codes                        │
│  - Each org code maps to ≥1 canonical CSI code               │
│  - Many-to-one allowed (org has multiple subcategories       │
│    that all roll up to same canonical bucket)                │
│  - One-to-many allowed (org has one code that spans          │
│    multiple canonical buckets — split at extraction time)    │
│  - Onboarding wizard imports org's existing codes from       │
│    Buildertrend/Excel/etc.                                   │
└─────────────────────────────────────────────────────────────┘
                            ↑
                            │ display layer
                            │
┌─────────────────────────────────────────────────────────────┐
│ Layer 3: Display in org's native codes                      │
│  - PMs see Ross Built's codes, not CSI codes                 │
│  - Cost intelligence queries hit canonical layer internally  │
│  - Results translated back to org codes for display          │
└─────────────────────────────────────────────────────────────┘
```

**Why this matters:**

- A new Nightwork customer doesn't have to re-learn CSI to use the platform.
- An existing customer can keep their existing codes (zero re-training).
- The canonical layer enables future cross-job, cross-time pricing intelligence within an org.
- If cross-org sharing is ever enabled, the architecture already supports it.

---

## Day-1 customer experience as a design constraint

Every Phase 3.x design decision must answer: "How does this work for a brand-new customer who signs up today?"

**Day-1 ideal — three onboarding paths:**

**Path A — Buildertrend org migration:** Customer uploads their Buildertrend export bundle (jobs, vendors, COs, daily logs, budgets). Nightwork normalizes everything in 24 hours. Customer's first interaction is browsing their migrated history.

**Path B — Excel/Sheets org migration:** Customer drops folders of pay apps, budget Excels, vendor lists. AI maps columns interactively, asks for confirmation, imports. Slower but works for any org with structured-but-not-standardized data.

**Path C — Greenfield org:** Customer sets up their first job and starts ingesting documents today. No historical data. The cost intelligence layer starts empty and fills as they use the platform.

**Architectural implication:** the data shape that AI extraction outputs MUST match the data shape that historical migration ingests. One unified contract. Phase 3.3 (Cost Intelligence Foundation) defines this contract.

The full onboarding/migration UI is a separate phase (Phase 4 — out of scope for this amendment), but the data contract it depends on lives in Phase 3.3.

---

## Re-scoped phase list

The original Phases 3.3–3.8 are replaced. New structure:

| Phase | Original scope | New scope |
|-------|---------------|-----------|
| 3.3 | PO extraction | **Cost Intelligence Foundation** — schema, canonical CSI, org cost code map, pgvector, query layer |
| 3.4 | CO extraction | **Proposal extraction + cost intelligence wiring** (was 3.5) |
| 3.5 | Proposal extraction | **PO Generation from Proposal** (was the "Convert to PO" feature in old 3.5) |
| 3.6 | Vendor extraction | **Invoice ↔ PO matching + variance detection** (new — closes the AP loop) |
| 3.7 | Budget extraction | **Change Order workflow** (PCO + retroactive, equal weight) |
| 3.8 | Historical draw extraction | **Vendor extraction** (was 3.6) |
| 3.9 | — | **Budget extraction + draw reconciliation** (was 3.7 + 3.8 merged) |
| 3.10 | Manual type-selection UI | **Document review queue UI** (unchanged) |

**What's deprecated:**
- Original Phase 3.3 (PO extraction as input) — deferred indefinitely. The narrow case (importing a sub's PO during job takeover) is handled by the universal classifier + manual review UI in Phase 3.10. Real Ross Built operations don't ingest POs as a primary flow.
- Original Phase 3.4 (CO extraction as input) — folded into Phase 3.7 as a sub-case (signed CO returns from owner).
- Original Phase 3.8 (Historical draw extraction) — folded into Phase 3.9.

---

## Phase 3.3 — Cost Intelligence Foundation (NEW)

**Goal:** Build the schema and query layer that everything else writes into.

**Files:**
- `supabase/migrations/00082_cost_intelligence_foundation.sql` (large migration, multiple tables)
- `src/lib/cost-intelligence/canonical-codes.ts`
- `src/lib/cost-intelligence/org-code-map.ts`
- `src/lib/cost-intelligence/canonical-items.ts`
- `src/lib/cost-intelligence/queries.ts`
- `src/app/api/cost-codes/*` (CRUD for org cost code map)
- `src/app/cost-codes/page.tsx` (org cost code admin UI)

### Schema design

**Table: `csi_canonical_codes`** (system-wide, read-only, populated from licensed CSI MasterFormat)
```sql
CREATE TABLE csi_canonical_codes (
  code TEXT PRIMARY KEY,                  -- e.g. "09 25 13"
  division TEXT NOT NULL,                 -- e.g. "09"
  division_name TEXT NOT NULL,            -- e.g. "Finishes"
  section TEXT NOT NULL,                  -- e.g. "25 13"
  section_name TEXT NOT NULL,             -- e.g. "Cement Plastering"
  full_path TEXT NOT NULL,                -- e.g. "09 - Finishes / 09 25 13 - Cement Plastering"
  parent_code TEXT REFERENCES csi_canonical_codes(code),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```
RLS: read-only to all authenticated users (no org scoping; this is global).

**Table: `org_cost_codes`** (per-org)
```sql
CREATE TABLE org_cost_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES orgs(id),
  code TEXT NOT NULL,                     -- org's own code, e.g. "R-PLAS-001"
  name TEXT NOT NULL,                     -- e.g. "Stucco — exterior"
  parent_code TEXT REFERENCES org_cost_codes(code),
  csi_canonical_code TEXT REFERENCES csi_canonical_codes(code),  -- nullable; mapped over time
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  UNIQUE(org_id, code)
);
```
RLS: org-scoped. Mapping to canonical CSI is **optional** — orgs can use Nightwork without ever mapping. But cross-job intelligence within an org requires the mapping. UI should nudge but not require.

**Table: `canonical_items`** (per-org item registry)
```sql
CREATE TABLE canonical_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES orgs(id),
  canonical_name TEXT NOT NULL,           -- e.g. "2x4 SPF stud-grade kiln-dried 92-5/8"
  category TEXT NOT NULL,                 -- e.g. "lumber", "hardware", "finish", "labor"
  csi_canonical_code TEXT REFERENCES csi_canonical_codes(code),
  attributes JSONB NOT NULL DEFAULT '{}', -- e.g. {species: "SPF", grade: "stud", treatment: "KD", dimension: "2x4", length_in: 92.625}
  embedding VECTOR(1536),                 -- pgvector, for similarity search
  occurrence_count INTEGER NOT NULL DEFAULT 1,  -- how many line items have matched this
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX canonical_items_embedding_idx ON canonical_items
USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
```
RLS: org-scoped. New canonical items get auto-created when AI sees a line item without a high-similarity match. Confidence threshold: cosine similarity ≥ 0.92 to match an existing item; below that, create new.

**Table: `proposal_line_items`** (created in Phase 3.4 but schema designed here for forward-compat)
Designed in Phase 3.4 — listed here as the consumer of `canonical_items`.

### pgvector setup

```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

Embeddings use OpenAI's `text-embedding-3-small` (1536 dimensions, $0.02 per 1M tokens — negligible at proposal volumes). Generated at the time a line item is extracted by the classifier or extractor.

### Query layer (`src/lib/cost-intelligence/queries.ts`)

Initial functions (Phase 3.3 ships these as scaffolding; later phases consume):

- `findSimilarLineItems(orgId, description, limit)` → top-N similar canonical_items by cosine similarity
- `getVendorPriceHistory(orgId, vendorId, canonicalCode, dateRange)` → price points over time
- `getCostCodeRollup(orgId, canonicalCode, dateRange)` → all line items mapped to this code, summed by month/quarter
- `flagAnomaly(orgId, lineItem)` → returns flag with severity if line item is >X% above org's rolling average

### Onboarding-wizard nut

The org cost code admin UI must support two paths:
- **Import existing codes** (CSV, Buildertrend export, copy-paste) — bulk-create rows in `org_cost_codes`, leave `csi_canonical_code` NULL initially
- **Map to canonical** — when org maps a code to canonical CSI, UI auto-suggests via similarity search on the code name

### Phase 3.3 Exit Gate

```
[ ] CSI MasterFormat 2024 licensed and ingested (50 divisions, all sections)
[ ] csi_canonical_codes table populated, read-only, RLS verified
[ ] org_cost_codes table created, RLS org-scoped, CRUD UI working
[ ] canonical_items table created with pgvector index, RLS org-scoped
[ ] Embedding generation pipeline working (text → 1536-dim vector)
[ ] Similarity search returns sane results on a 50-item seed dataset
[ ] Query layer functions all return correct results on test data
[ ] Org cost code import UI supports CSV upload (10-row test passes)
[ ] Migration 00082 has paired .down.sql; idempotent
[ ] QA report generated with sample queries
```

**Commit:** `feat(cost-intelligence): foundation — canonical codes, org map, items, queries`

---

## Phase 3.4 — Proposal Extraction + Cost Intelligence Wiring

**Goal:** AI extracts proposal data AND every accepted proposal contributes to the cost intelligence layer.

**Files:**
- `src/lib/ingestion/extract-proposal.ts`
- `src/app/api/proposals/extract/route.ts`
- `src/app/api/proposals/commit/route.ts`
- `src/app/proposals/review/[extraction_id]/page.tsx`
- `__tests__/proposal-extraction.test.ts`
- `supabase/migrations/00083_proposals_with_intelligence.sql`

### Schema additions

**Table: `proposals`**
```sql
CREATE TABLE proposals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES orgs(id),
  job_id UUID REFERENCES jobs(id),
  vendor_id UUID NOT NULL REFERENCES vendors(id),
  source_document_id UUID NOT NULL REFERENCES document_extractions(id),
  status TEXT NOT NULL,                   -- 'draft', 'accepted', 'rejected', 'converted_to_po'
  proposal_number TEXT,                   -- vendor's proposal number if extractable
  proposal_date DATE,
  valid_through DATE,
  total_cents BIGINT NOT NULL,
  scope_summary TEXT,
  inclusions TEXT,
  exclusions TEXT,
  notes TEXT,
  raw_extraction JSONB NOT NULL,          -- full AI output for audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);
```
RLS: org-scoped, FORCE.

**Table: `proposal_line_items`**
```sql
CREATE TABLE proposal_line_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id UUID NOT NULL REFERENCES proposals(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES orgs(id),
  line_number INTEGER NOT NULL,

  -- Cost code dual-write (org code displayed, canonical for queries)
  org_cost_code_id UUID REFERENCES org_cost_codes(id),
  csi_canonical_code TEXT REFERENCES csi_canonical_codes(code),

  -- Item identity
  canonical_item_id UUID REFERENCES canonical_items(id),
  description_raw TEXT NOT NULL,          -- original text from PDF
  description_normalized TEXT,            -- AI-cleaned

  -- Quantity & pricing
  quantity NUMERIC,
  unit_of_measure TEXT,                   -- EA, LF, SF, CY, hr, etc.
  unit_price_cents BIGINT,
  total_price_cents BIGINT NOT NULL,

  -- Cost breakdown (separated for accuracy per Jake's UoM thinking)
  material_cost_cents BIGINT,
  labor_cost_cents BIGINT,
  subcontract_cost_cents BIGINT,
  tax_cents BIGINT,
  delivery_cents BIGINT,
  notes_cents BIGINT,                     -- catch-all (markup, fees, etc.)

  -- Item attributes (the "2x4 SPF stud KD" decomposition)
  attributes JSONB NOT NULL DEFAULT '{}',

  -- Provenance & feedback
  extraction_confidence NUMERIC,          -- 0.00-1.00
  pm_edited BOOLEAN NOT NULL DEFAULT false,
  pm_edits JSONB,                         -- diff between AI output and PM-confirmed values

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```
RLS: org-scoped via parent proposal.

### Extraction → cost intelligence loop

When a PM commits a proposal:

1. Each line item gets matched against `canonical_items` via similarity search.
2. If match ≥ 0.92 → use existing canonical_item_id; bump `occurrence_count`.
3. If match < 0.92 → create new canonical_item with embedding from description_normalized.
4. PM edits to description, cost code, or attributes are written to `pm_edits` JSONB and used to update the canonical_item if PM corrected an extraction error.
5. Embedding regenerates if PM changes description significantly.

This is the feedback loop. Every PM keystroke teaches the system.

### Review form UX

PM sees:
- Extracted vendor (with confidence indicator if low)
- Total amount (large, bold)
- Line items table (editable: cost code, description, qty, UoM, unit price, breakdown columns)
- Inclusions / exclusions / notes (editable text)
- For each line item: "Similar items in your history" expandable panel showing recent prices for the same canonical_item

Action buttons:
- **Save as Proposal** → commits, status='accepted'
- **Convert to PO** → commits AND triggers Phase 3.5 PO generation (passes proposal_id)
- **Reject** → marks document_extractions row rejected, no entity created

### Phase 3.4 Exit Gate

```
[ ] Proposal extraction prompt achieves ≥85% per-field accuracy on 5-fixture test set
[ ] Per-line-item accuracy ≥80% on description, qty, UoM, unit price, total
[ ] Cost code AI suggestion matches PM-confirmed code ≥70% of the time
[ ] Canonical item matching: top-3 results contain correct match ≥85% of the time
[ ] Pre-filled review form lets PM edit every field before commit
[ ] PM edits write to pm_edits JSONB and update canonical_items where applicable
[ ] "Similar items in your history" panel shows correct prior pricing for matched items
[ ] Save as Proposal commits cleanly; status='accepted'; canonical_items updated
[ ] Convert to PO action calls Phase 3.5 endpoint (stub OK if 3.5 not yet built)
[ ] Reject action marks document_extractions row rejected
[ ] QA report generated with per-fixture per-field accuracy + cost intelligence verification
```

**Commit:** `feat(ingestion): proposal extraction + cost intelligence wiring`

---

## Phase 3.5 — PO Generation from Proposal

**Goal:** PM clicks "Convert to PO" → Nightwork generates a complete subcontract-grade PO bundle ready to send to the sub.

**Why this is its own phase:** A real PO bundle is more than line items. It's the proposal data + Ross Built standard terms + plan/scope attachments + insurance requirements + payment terms + signature workflow. Building all of that on top of Phase 3.4 keeps the proposal extraction phase clean.

**Files:**
- `src/lib/po-generation/generate-po.ts`
- `src/lib/po-generation/po-pdf-builder.ts`
- `src/app/api/proposals/[id]/convert-to-po/route.ts`
- `src/app/api/purchase-orders/[id]/send/route.ts`
- `src/app/purchase-orders/[id]/page.tsx` (review/edit before send)
- `supabase/migrations/00084_purchase_orders_full.sql`

### Schema additions

**Augment existing `purchase_orders`** (or create if not yet first-class):
```sql
ALTER TABLE purchase_orders ADD COLUMN source_proposal_id UUID REFERENCES proposals(id);
ALTER TABLE purchase_orders ADD COLUMN po_terms_version TEXT;       -- which terms template
ALTER TABLE purchase_orders ADD COLUMN attachments JSONB;            -- plan pages, scope docs
ALTER TABLE purchase_orders ADD COLUMN sent_at TIMESTAMPTZ;
ALTER TABLE purchase_orders ADD COLUMN signed_at TIMESTAMPTZ;
ALTER TABLE purchase_orders ADD COLUMN signed_by_email TEXT;
ALTER TABLE purchase_orders ADD COLUMN signature_url TEXT;          -- e-sign provider URL

-- Schedule intelligence fields (foundation for Phase 4)
ALTER TABLE purchase_orders ADD COLUMN estimated_start_date DATE;
ALTER TABLE purchase_orders ADD COLUMN estimated_duration_days INTEGER;
ALTER TABLE purchase_orders ADD COLUMN estimated_completion_date DATE GENERATED ALWAYS AS
  (estimated_start_date + (estimated_duration_days || ' days')::INTERVAL) STORED;
ALTER TABLE purchase_orders ADD COLUMN actual_start_date DATE;
ALTER TABLE purchase_orders ADD COLUMN actual_completion_date DATE;
ALTER TABLE purchase_orders ADD COLUMN schedule_predecessor_po_ids UUID[];
  -- POs that must complete before this one starts (basic dependency tracking)
```

**Why these fields ship with Phase 3.5 even though the schedule intelligence layer is Phase 4:** the cost of adding nullable columns now is zero; the cost of adding them later (after thousands of POs exist without schedule data) is high. By capturing the data from day one, Phase 4 can build the intelligence layer against rich historical data instead of starting from empty tables.

**Table: `org_po_terms_templates`** (org's standard PO terms)
```sql
CREATE TABLE org_po_terms_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES orgs(id),
  name TEXT NOT NULL,                     -- e.g. "Standard Sub Agreement"
  version TEXT NOT NULL,                  -- e.g. "v1.0"
  body_md TEXT NOT NULL,                  -- terms in markdown
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(org_id, name, version)
);
```

### PO generation flow

1. PM clicks "Convert to PO" on accepted proposal.
2. System pre-fills PO with proposal line items, vendor, total.
3. PM is taken to PO review screen with three tabs:
   - **Line Items** — auto-populated from proposal, editable
   - **Attachments** — system suggests plan pages from job's plan set + scope docs; PM can add/remove
   - **Terms** — system applies org's default PO terms template; PM can override
4. PM reviews, edits, clicks "Send to Sub."
5. System generates PDF (cover page + line items + terms + attachments).
6. PDF is sent via email to vendor with e-signature link (DocuSign / HelloSign / built-in).
7. When sub signs, PO status flips to 'signed'.
8. From this point on, invoices billed against this PO get matched in Phase 3.6.

### Insurance + lien waiver requirements

PO terms template should include:
- Required insurance (general liability, workers comp, vehicle) with minimum limits per org config
- Lien waiver requirements (conditional on payment, unconditional on prior payment)
- Payment terms (Net 30, retainage %, etc.)
- Indemnification language
- Termination clauses

Org admin UI for terms templates lets each org maintain their own. Defaults shipped with reasonable Florida residential GC defaults that orgs can override.

### Phase 3.5 Exit Gate

```
[ ] "Convert to PO" creates draft PO with proposal line items pre-filled
[ ] PO review screen shows 3 tabs (Line Items, Attachments, Terms)
[ ] Plan attachment suggestion works (pulls from job's plan set if available)
[ ] Org PO terms template applied by default; PM can switch templates or override inline
[ ] PDF generation produces complete document (cover + line items + terms + attachments)
[ ] Send-to-sub triggers email with e-sign link
[ ] Sub signature captured; status → 'signed'
[ ] PM can resend if vendor requests change; full audit trail in status_history
[ ] source_proposal_id populated correctly on every PO from proposal
[ ] QA report includes example sent PO PDF for review
```

**Commit:** `feat(po): generate-from-proposal pipeline with bundle + e-sign`

---

## Phase 3.6 — Invoice ↔ PO Matching + Variance Detection

**Goal:** Close the AP loop. Invoice arrives → matched to PO → variance flagged → payment blocked until reconciled.

**Files:**
- `src/lib/matching/invoice-po-match.ts`
- `src/app/api/invoices/[id]/match-to-po/route.ts`
- Augments existing `src/app/api/invoices/*` for variance flag

### Schema additions

```sql
ALTER TABLE invoices ADD COLUMN matched_po_id UUID REFERENCES purchase_orders(id);
ALTER TABLE invoices ADD COLUMN variance_cents BIGINT;          -- positive = invoice exceeds PO
ALTER TABLE invoices ADD COLUMN variance_status TEXT;            -- 'none', 'within_tolerance', 'flagged', 'reconciled_co', 'reconciled_dispute'
ALTER TABLE invoices ADD COLUMN reconciliation_co_id UUID REFERENCES change_orders(id);
```

### Matching logic

1. Invoice arrives via Phase 3.2 classifier → invoice extraction (already shipped).
2. System auto-suggests matching PO based on:
   - Same vendor
   - Same job
   - Open status
   - Closest amount
3. PM confirms match (one click) or selects different PO.
4. Variance computed: `invoice.total - (PO.total - already_billed_against_po)`
5. If variance ≤ org-configured tolerance (e.g., 2% or $250) → status='within_tolerance', payment proceeds.
6. If variance > tolerance → status='flagged', payment blocked.
7. PM gets two paths to reconcile:
   - **Create CO** (forward to Phase 3.7) — handles both PCO-first and retroactive CO patterns equally
   - **Dispute invoice** — sends invoice back to vendor with note; status='reconciled_dispute'

### Phase 3.6 Exit Gate

```
[ ] Invoice extraction auto-suggests PO match based on vendor/job/amount
[ ] PM can confirm match in one click or change selection
[ ] Variance computed correctly across all match scenarios
[ ] Tolerance threshold is org-configurable (default 2% / $250)
[ ] Within-tolerance invoices clear for payment automatically
[ ] Flagged invoices block payment until reconciled
[ ] "Create CO" path opens Phase 3.7 workflow with pre-filled values
[ ] "Dispute invoice" path generates dispute notice and updates status
[ ] Audit trail shows full reconciliation history in invoice timeline
[ ] QA report includes test cases for: exact match, under-by-tolerance, over-by-tolerance, multi-invoice-against-PO
```

**Commit:** `feat(matching): invoice-po reconciliation with variance detection`

---

## Phase 3.7 — Change Order Workflow

**Goal:** Support both PCO-first and retroactive CO patterns with equal weight. Track WHO/WHEN/WHY for accountability without friction.

**Reframe from original plan:** The original plan implicitly assumed forward-CO-only. This phase explicitly supports both patterns because field reality is that work often moves faster than paperwork. The system tracks the gap (verbal-approval-date vs CO-signed-date) as a metric, not a blocker.

**Files:**
- `src/lib/ingestion/extract-co.ts` (for signed CO returns from owner)
- `src/lib/co-generation/draft-co.ts` (for forward + retroactive drafts)
- `src/app/api/change-orders/draft/route.ts`
- `src/app/api/change-orders/[id]/send/route.ts`
- `src/app/change-orders/[id]/page.tsx`

### Schema additions

```sql
ALTER TABLE change_orders ADD COLUMN co_origin TEXT NOT NULL DEFAULT 'forward';
  -- 'forward' (PCO-first), 'retroactive' (work done before paper)
ALTER TABLE change_orders ADD COLUMN work_started_date DATE;   -- when work actually began
ALTER TABLE change_orders ADD COLUMN co_signed_date DATE;      -- when paper signed
ALTER TABLE change_orders ADD COLUMN paper_lag_days INTEGER GENERATED ALWAYS AS
  (co_signed_date - work_started_date) STORED;                  -- metric, never blocking
ALTER TABLE change_orders ADD COLUMN verbal_approver TEXT;      -- who verbally OK'd it
ALTER TABLE change_orders ADD COLUMN field_documentation TEXT;  -- PM notes
ALTER TABLE change_orders ADD COLUMN source_invoice_id UUID REFERENCES invoices(id);
  -- if this CO was created from an invoice variance reconciliation

-- Schedule intelligence fields (foundation for Phase 4)
ALTER TABLE change_orders ADD COLUMN schedule_impact_days INTEGER;
  -- net days added to job schedule (can be negative if CO accelerates)
ALTER TABLE change_orders ADD COLUMN affected_po_ids UUID[];
  -- which POs are impacted by this CO (delays, scope shifts)
ALTER TABLE change_orders ADD COLUMN estimated_start_date DATE;
ALTER TABLE change_orders ADD COLUMN estimated_duration_days INTEGER;
ALTER TABLE change_orders ADD COLUMN actual_start_date DATE;
ALTER TABLE change_orders ADD COLUMN actual_completion_date DATE;
```

### Workflow

**Forward CO (PCO-first):**
1. Scope change identified by PM
2. PM drafts PCO in Nightwork (description, estimated cost, schedule impact)
3. Optional: send RFQ to subs for pricing
4. PM finalizes pricing
5. Owner reviews + approves (e-sign or paper)
6. CO executed; status='signed'; budget updated; work proceeds

**Retroactive CO:**
1. Triggered by Phase 3.6 invoice-PO variance OR direct PM action
2. PM drafts CO with `co_origin='retroactive'`, fills in:
   - work_started_date (when did sub actually start the extra work)
   - verbal_approver (who said yes verbally)
   - field_documentation (what happened, why)
3. Same pricing flow as forward CO
4. Owner approval
5. CO executed; status='signed'

System computes `paper_lag_days` automatically. Reports surface to PM:
- "Your team has 12 retroactive COs with avg 18-day paper lag this quarter"
- "Markgraf has 5 retroactive COs; consider running a job audit"

These are coaching metrics, not blockers. The PM owns whether to act.

### Signed CO ingest (replaces old Phase 3.4)

When a signed CO PDF comes back from owner:
1. Phase 3.2 classifier identifies as `change_order` type
2. New extraction matches PDF to existing CO record by CO number
3. Updates `signed_at`, attaches signed PDF, status flips to 'signed'

This is a thin pipeline because the CO record already exists — we're just attaching the signed artifact.

### Phase 3.7 Exit Gate

```
[ ] Forward CO workflow: PCO → pricing → owner approval → execution
[ ] Retroactive CO workflow: same flow, with co_origin='retroactive' + verbal_approver + field_documentation captured
[ ] Both flows produce identical CO records with proper audit trail
[ ] paper_lag_days computed correctly on both
[ ] Phase 3.6 invoice-variance "Create CO" handoff pre-fills retroactive CO with invoice data
[ ] Owner e-sign workflow functional
[ ] Signed CO ingestion matches incoming PDFs to existing records
[ ] Coaching metrics surface in PM dashboard (retro CO count, avg paper lag)
[ ] QA report covers all three workflows
```

**Commit:** `feat(co): change order workflow with forward + retroactive support`

---

## Phase 3.8 — Vendor Extraction (was 3.6)

**Goal:** W-9, COI, business card extraction → vendor registry population.

Largely unchanged from original plan. One addition:

### Schema additions

```sql
ALTER TABLE vendors ADD COLUMN coi_expiration_date DATE;
ALTER TABLE vendors ADD COLUMN coi_carrier TEXT;
ALTER TABLE vendors ADD COLUMN coi_policy_number TEXT;
ALTER TABLE vendors ADD COLUMN w9_on_file BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE vendors ADD COLUMN tax_id_encrypted TEXT;          -- never store plaintext
ALTER TABLE vendors ADD COLUMN tax_id_type TEXT;               -- 'SSN', 'EIN'
ALTER TABLE vendors ADD COLUMN trades JSONB;                   -- array of canonical CSI codes this vendor works in
```

The `trades` array enables Phase 3.5 plan-attachment suggestions ("this PO is for plumbing work — auto-attach plumbing plan pages") and Phase 3.4 vendor-typeahead ("PM is creating a proposal review for a stucco trade — suggest stucco vendors").

### Phase 3.8 Exit Gate

(Same as original Phase 3.6 plus the `trades` array population.)

**Commit:** `feat(ingestion): vendor extraction with COI tracking`

---

## Phase 3.9 — Budget Extraction + Draw Reconciliation (merged 3.7 + 3.8)

**Goal:** Ingest budgets in any format AND reconcile against historical/active draws.

The original plan separated these. They're the same data shape — both are line-items by cost code with billed-to-date amounts. Merging produces a cleaner pipeline.

**Files:**
- `src/lib/ingestion/extract-budget.ts`
- `src/lib/ingestion/extract-historical-draw.ts`
- `src/app/api/budgets/import/route.ts`
- `src/app/budgets/import/page.tsx` (column-mapping UI)

### Three input shapes

1. **Excel/CSV budget** (most common) — column-mapping UI learns headers ("Description", "Amount", "Cost Code"), saves mapping per org per source format.
2. **PDF budget** (less common) — basic line-item extraction.
3. **Buildertrend CSV export** (also common) — pre-mapped, imports cleanly.

### Cost intelligence integration

Every budget line item creates/updates `canonical_items` records. This is the org's first pass at populating their pricing intelligence — the budget gets ingested at job start, and every subsequent proposal/invoice for that job builds price history against the budget baseline.

### Historical draws (G702/G703)

For onboarding migration: org uploads past draws, system extracts:
- Original contract amount per line item
- Billed-to-date per line item
- Retainage per line item
- Period billing per line item

Maps to canonical CSI codes via the org cost code map. Becomes the baseline for "your team's avg billing curve" intelligence (later phase).

### Phase 3.9 Exit Gate

```
[ ] Excel budget import: column-mapping UI auto-detects headers ≥80% of the time
[ ] Mapping saved per org per source format; reused on next import
[ ] PDF budget import: basic extraction works on 3 test fixtures
[ ] Buildertrend CSV import: tested on real Ross Built BT export, imports cleanly
[ ] Cost code auto-mapping: similar descriptions map to existing org_cost_codes ≥70% of the time
[ ] Each imported line item populates canonical_items
[ ] Historical G702/G703 extraction: vendor, contract amount, billed-to-date all captured
[ ] Retainage and period-billing data preserved
[ ] QA report covers Excel + PDF + BT-CSV + G702 fixtures
```

**Commit:** `feat(ingestion): budget + historical draw extraction`

---

## Phase 3.10 — Document Review Queue UI (unchanged)

Goal stays: surface low-confidence classifications for manual type selection. Adds a job-level document timeline.

No schema changes. Pure UI work.

(Detail unchanged from original plan.)

---

## Sequencing decisions

The new phases must execute in this order:

```
3.3 (Cost Intelligence Foundation)   — schema everything depends on
   ↓
3.4 (Proposal Extraction)             — first pipeline, populates intelligence
   ↓
3.5 (PO from Proposal)                — output side of proposal flow
   ↓
3.6 (Invoice ↔ PO Matching)           — closes AP loop, depends on 3.5 POs existing
   ↓
3.7 (CO Workflow)                     — depends on 3.6 variance handoff
   ↓
3.8 (Vendor Extraction)               — can run parallel to 3.6/3.7 if desired
   ↓
3.9 (Budget + Historical Draw)        — can run parallel to 3.6/3.7/3.8
   ↓
3.10 (Document Review Queue UI)       — depends on all extraction phases shipping
```

Phases 3.6, 3.7, 3.8, 3.9 can be parallelized across multiple sessions if Jake has bandwidth, since they don't depend on each other. 3.3, 3.4, 3.5 are strictly serial.

---

## Open questions before Phase 3.3 starts

1. **CSI MasterFormat 2024 license procurement.** Need to actually buy it. URL: https://csiresources.org/standards/masterformat. Has Jake purchased it yet? If not, this is the first non-code action.

2. **OpenAI account / API key for embeddings.** Embeddings use `text-embedding-3-small`. Is there an existing OpenAI key in Nightwork's env config, or does this need to be set up? (Cost: ~$0.02 per 1M tokens — negligible.)

3. **Plan attachment suggestion source.** Phase 3.5 (PO generation) needs to know what plan pages exist for a job. Today, are job plans uploaded to Nightwork? If yes, where? If no, this is a Phase 3.5 sub-task — design the plan upload flow first.

4. **E-signature provider.** Phase 3.5 (PO send) and Phase 3.7 (CO approval) both need e-signature. Options: DocuSign ($45/seat/mo), HelloSign / Dropbox Sign ($25/seat/mo), or built-in Nightwork e-sign (more dev work). Decision needed before Phase 3.5.

5. **Org PO terms template — Ross Built default.** Phase 3.5 needs Ross Built's actual sub agreement terms as the seed default for testing. Jake to provide (or Andrew, since he handles pre-construction).

6. **Buildertrend export format.** Phase 3.9 supports a "Buildertrend CSV import" path. Need a real BT export from Ross Built to validate against.

---

## Phase 4 — Schedule Intelligence Layer (placeholder, full design deferred)

Not in scope for this amendment, but explicitly tracked here so it doesn't get lost.

### What it will be

A second intelligence layer parallel to cost intelligence, applied to time. Same architectural pattern:

```
PO/CO/proposal arrives with estimated_start, estimated_duration
   ↓
Daily logs record actual progress (Phase 5 — daily log ingestion)
   ↓
Schedule intelligence layer captures:
  - actual_duration vs estimated by trade, vendor, job size, season
  - sequence reliability (did stucco actually start after lath, or before?)
  - rain/weather delay correlation
  - vendor reliability (Faust hits ±2 days; XYZ Plaster averages +9 days)
   ↓
Future PO drafts auto-suggest realistic durations based on history
   ↓
Schedule generation: PM uploads spec set, AI proposes realistic schedule with vendor-specific durations
```

### Why it's deferred

1. **Cost intelligence must validate first.** Building two intelligence layers simultaneously doubles risk. If the cost intelligence pattern works (Phase 3.4 ships, PMs adopt it, the data populates), schedule intelligence is a copy of the same pattern with different fields. If it doesn't work, building schedule intelligence on a flawed pattern wastes more time.

2. **Daily log ingestion is the missing input.** Schedule intelligence needs `actual_start_date` and `actual_completion_date` to come from somewhere. Today, that data lives in Buildertrend daily logs and PM heads. A daily log ingestion pipeline (Phase 5) needs to exist before schedule intelligence has data to learn from.

3. **The Phase 3.5/3.7 schema fields are sufficient for now.** PM enters estimated start/duration when issuing a PO. Actual dates get filled in when the PO closes out. That data accumulates passively. By the time Phase 4 arrives, every active org has 6–18 months of real schedule data ready to train against.

### What this amendment ensures for Phase 4

- Every PO row has `estimated_start_date`, `estimated_duration_days`, `actual_start_date`, `actual_completion_date` from Phase 3.5 onward
- Every CO row has `schedule_impact_days`, `affected_po_ids`, and the same date fields from Phase 3.7 onward
- Job-level schedule (master schedule) is referenced via `purchase_orders.schedule_predecessor_po_ids` for basic dependency tracking
- This data accumulates from day one even before Phase 4 ships

When Phase 4 arrives, there's a real dataset to query, not an empty table.

---



- Phases 1–3.2 of the original rebuild plan are unchanged. Phase 3.2 (classifier) shipped. Migration 00081 is in dev.
- Part R (Standing Rules) and Part G (Exit Gates / QA Reports / Subagents) of the original plan apply unchanged.
- Branch architecture (Branch 1 schema, Branch 2 RLS, Branch 3 ingestion) is unchanged.
- Branches 4+ (later phases — onboarding, scheduling, daily logs, etc.) are not addressed in this amendment.

---

## Pushback Jake should consider before approving

Things I'm less certain about that deserve a second look:

1. **Three-layer cost code architecture might be over-engineered for v1.** A simpler "every org has flat cost codes, optionally mapped to CSI" might be enough until real cross-job intelligence demand emerges. Argument for: ships faster. Argument against: retrofitting the canonical layer later is expensive. My lean: build it now, the marginal cost is small.

2. **pgvector might be premature.** A simple SQL `LIKE` or trigram index on description text might give acceptable similarity matching at v1 scale. Argument for: simpler, no embedding pipeline. Argument against: doesn't scale, gets brittle fast. My lean: build pgvector now since it's free at this scale and the embedding cost is negligible.

3. **Phase 3.5 (PO from proposal) is doing too much in one phase.** Could split into 3.5a (line-item commit only) and 3.5b (terms + attachments + send). Argument for: smaller PRs. Argument against: 3.5a alone isn't usable. My lean: keep merged, accept it's a bigger phase.

4. **Phase 3.6 might belong before 3.5.** The invoice-PO matching pattern (variance detection) could ship without PO-generation-from-proposal — it works against any PO, including manually-created ones. Argument for: closes the AP loop sooner. Argument against: Ross Built's POs today come from Buildertrend, not Nightwork — matching invoices to BT-shaped POs is a different problem than matching to Nightwork POs. My lean: ship in current order, but this is debatable.

5. **The retroactive CO reframe might still be too soft.** Even if the system makes them frictionless, surfacing the "paper lag days" metric publicly across the org could create pressure that does its own work. Worth deciding: is this metric private to PM or visible to ownership?

---

## Summary

This amendment re-scopes Phases 3.3–3.10 around four corrections to the original plan:

1. **Cost intelligence becomes Phase 3.3** — the foundation everything else writes into.
2. **POs are output, not input** — original Phase 3.3 (PO extraction) is deferred indefinitely.
3. **Retroactive COs are normal operations** — no friction, just tracking.
4. **Schedule intelligence is the second moat (Phase 4 placeholder)** — schema fields ship in 3.5/3.7 so data accumulates from day one, full intelligence layer deferred until cost intelligence validates.

The new structure produces a clearer architectural pattern (Document → Classify → Extract → Entity + Cost Intelligence → Feedback Loop) and makes both moat theses explicit.

Phase 3.3 is the next session's work after this amendment is approved.
