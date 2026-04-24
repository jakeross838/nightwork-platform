# Phase 3.2 Pre-Flight — Document Classifier

**Branch:** 3 (Universal Ingestion)
**Phase:** 3.2 — Document classifier
**HEAD at preflight:** `22c701f`
**Date:** 2026-04-23
**Plan doc reference:** `docs/nightwork-rebuild-plan.md:5911-5932`

---

## 1. Header

This pre-flight validates the Phase 3.2 plan-spec against live database / codebase reality, captures resolved design decisions, and identifies amendments before execution. **No code changes, no migrations, no commits in this pass.**

---

## 2. Scope recap (verbatim from plan doc)

> "Claude Vision classifier. First-page image → type + confidence."

**Files (per plan):**
- `src/lib/ingestion/classify.ts`
- `src/app/api/ingest/route.ts` (universal entry endpoint)

**Rebuild-vs-patch call:** REBUILD (new capability, built clean from the start).

**Commit message:** `feat(ingestion): document classifier`

---

## 3. Exit criteria (verbatim from plan doc)

```
[ ] Classifier achieves ≥90% accuracy on 20-document test set (5 of each major type)
[ ] Universal /api/ingest accepts file → creates document_extraction row with classified_type
[ ] Confidence score recorded; low-confidence (<0.70) flagged for manual type selection
[ ] Test runner subagent: all classifier tests PASS
[ ] Classifier system prompt cached via prompt caching
[ ] QA report generated with sample classifications for each type
```

---

## 4. Resolved design decisions

| # | Decision area | Resolution |
|---|---|---|
| Q1 | Test set composition | invoice, purchase_order, change_order, proposal — 5 docs each = 20 total. Source from existing Ross Built dogfood where possible; synthesize fixtures otherwise (see §9). |
| Q2 | Confidence storage | NEW column `document_extractions.classification_confidence NUMERIC(5,4)`, NOT NULL DEFAULT `0.0000`. App-layer fill at classify time (no trigger). Migration **00078**. |
| Q3 | Scope boundary | Classification-only. Phase 3.2 routes to "pending extraction" state. Phases 3.3–3.8 handle type-specific extraction. |
| Q3b | Routing mechanics | Sync in POST request. Response payload: `{extraction_id, classified_type, classification_confidence}`. |
| Q5 | Low-confidence UX | Row sits in DB with `classification_confidence` flag visible via query. Phase 3.10 renders the manual-type-selection UI. NO stopgap admin view in Phase 3.2. |
| Q6 | Prompt caching | System prompt cached via `cache_control: { type: "ephemeral" }`. Document content (PDF/image) uncached (dynamic per request). Standard Anthropic pattern. |
| Q7 | File handling | **Amendment Q7-A proposed (see §10)** — instead of server-side pdfjs+canvas first-page rendering, send full PDF directly to Claude as `type: "document"` block per existing `parseInvoiceWithVision` precedent. Zero new dependencies. |
| Q8 | Dependencies | Phase 3.2 blocks 3.3–3.8 (each needs `classified_type` to route). No manual override path in production; dev testing may inject `classified_type` directly. |
| Q9 | Blast radius | Net-new endpoint + lib file + 1 migration (column addition only). Zero code cascade — nothing references the classifier yet. Formalized in §6. |

---

## 5. Schema Validator probes (live results)

### Probe (a) — `document_extractions` current columns

**Result:** 30 columns present (27 from Phase 3.1 base + 3 routing columns). Column inventory in ordinal order:

```
id, org_id, invoice_id, raw_ocr_text, raw_pdf_url,
extracted_at, extraction_model, extraction_prompt_version,
total_tokens_input, total_tokens_output,
field_confidences, verification_status,
verified_lines_count, total_lines_count, verified_at, verified_by,
auto_committed, auto_commit_reason,
created_at, updated_at, deleted_at,
invoice_subtotal_cents, invoice_tax_cents, invoice_tax_rate,
invoice_overhead, invoice_total_cents, skipped_lines,
classified_type, target_entity_type, target_entity_id
```

**`classification_confidence` NOT present.** ✅ Confirms migration 00078 needed.

### Probe (b) — CHECK constraints on `document_extractions`

3 CHECK constraints found:

```
document_extractions_classified_type_check:
  CHECK (classified_type IS NULL OR classified_type IN
    ('invoice','purchase_order','change_order','proposal',
     'vendor','budget','historical_draw','plan','contract','other'))
  → 10 values, matches plan §2.2 enum inventory ✅

document_extractions_target_entity_type_check:
  CHECK (target_entity_type IS NULL OR target_entity_type IN
    ('invoice','purchase_order','change_order','proposal',
     'vendor','budget','historical_draw'))
  → 7-value committable subset ✅

document_extractions_verification_status_check:
  CHECK (verification_status IN
    ('pending','partial','verified','rejected'))
  → 4-value enum (current Phase 3.1 form, NOT the target 4-value
    'pending|verified|committed|rejected'). Pre-existing divergence
    documented in plan §1979–2025 Amendment M. NOT a Phase 3.2 blocker.
```

### Probe (c) — Ross Built dogfood: `document_extractions` by type

| classified_type | total | active |
|---|---|---|
| `null` | 74 | 0 |
| `invoice` | 56 | 56 |

Confirms: Phase 3.1 backfill set all 56 active rows to `'invoice'`; the 74 NULL rows are all soft-deleted (Amendment F deliberately skipped them to preserve state-at-time).

### Probe (c continued) — Other entity tables (potential test-set sources)

| Table | Active rows |
|---|---|
| `invoices` | 56 |
| `purchase_orders` | **0** |
| `change_orders` | 73 |
| `proposals` | **0** |

### Probe (c add'l) — Source-document availability for non-invoice types

- `change_orders`: **NO** source-document column exists (no `source_document_id`, no `file_url`). The 73 CO records are data-only, no PDFs in storage.
- `proposals`: has `source_document_id` (per Phase 2.2 migration 00065) — but 0 records.
- Storage buckets: only `invoice-files`, `lien-release-files`, `logos` — no PO/CO/proposal buckets.

**⚠ Test-set sourcing impact:** of the 20 required docs, only **5 invoices** can be sourced from existing dogfood. The remaining **15 (PO + CO + proposal × 5 each)** must be synthesized fixtures or supplied externally. See §9 for sourcing plan.

### Probe (d) — Existing `/api/ingest` route

- `ls src/app/api/ingest/` → **not present** ✅
- `grep ingest src/app/api` → no matches ✅

Confirms net-new route. No collision risk.

### Probe (e) — Existing Claude Vision SDK usage

Anthropic SDK imports found in:
- `src/lib/claude/parse-invoice.ts:1`
- `src/lib/claude.ts:18` (the `callClaude` wrapper)
- `src/lib/support/tools.ts:6` (type-only import)

**Pattern to align with:** `src/lib/claude/parse-invoice.ts` already uses `type: "document"` content blocks for PDFs (`media_type: "application/pdf"`, base64-encoded full file). Phase 3.2 classifier should reuse this pattern.

**Prompt caching usage:** `grep cache_control src` → **0 matches**. Phase 3.2 will be the **first** prompt-caching adopter in the codebase. SDK version `^0.88.0` supports `cache_control: { type: "ephemeral" }` natively.

**Wrapper alignment:** all Anthropic calls go through `callClaude()` for plan-limit metering + `api_usage` logging. Classifier MUST use this wrapper, with `function_type: "document_classify"` (or similar new category).

### Probe (f) — PDF handling library availability

`package.json` dependencies:
- `react-pdf ^7.7.3` (client-side React component, transitively pulls `pdfjs-dist`)
- `pdfjs-dist` present in `node_modules` (transitive)
- **NO** `canvas`, `pdf2pic`, `pdf-parse`, `ghostscript`, or `poppler` packages

All current `pdfjs` usage is **client-side** (5 component files: `pdf-renderer.tsx`, `invoice-pdf-preview.tsx`, etc.). No server-side PDF rendering in the codebase today.

**Implication for Q7:** server-side first-page-to-image rendering would require adding `canvas` (~100MB native binary, Vercel-fragile) plus pdfjs server bootstrap. The existing `parseInvoiceWithVision` precedent avoids this entirely by sending the full PDF as a `type: "document"` block — **Amendment Q7-A formally proposes adopting this pattern.**

---

## 6. Blast-radius estimate (R.18)

**Final blast-radius classification: SMALL.**

| Surface | Change |
|---|---|
| Database | 1 net-new column on `document_extractions` (`classification_confidence NUMERIC(5,4) NOT NULL DEFAULT 0.0000`). No backfill required (default covers existing 56 active rows). No CHECK constraint changes. No RLS changes. |
| Migrations | 1 new file: `00078_classification_confidence.sql` + `.down.sql` |
| New code | 2 new files: `src/lib/ingestion/classify.ts`, `src/app/api/ingest/route.ts` |
| Modified code | **0 files** — nothing today references the classifier, the `/api/ingest` route, or `classification_confidence` |
| Tests | 1 net-new test file: `__tests__/document-classifier.test.ts` (migration shape + integration smoke + accuracy harness reference) |
| RLS | Unchanged. Inserts into `document_extractions` go through service-role (existing pattern in `parseInvoiceWithVision` upload paths). |
| Existing flows | Unaffected. Phase 3.1's `parseInvoiceWithVision` continues to write `classified_type='invoice'` directly via existing routes. The new `/api/ingest` is parallel, not a replacement (yet — replacement comes in Phase 3.10). |

**Code-cascade count: 0.** Confirmed via probe (d) + (e). This is a true greenfield phase — only additive surface.

---

## 7. Dependencies check

### GH issue status (per session resume context)

- **GH #18** (multi-org session `.maybeSingle()`): **CLOSED** in commit `13713ad`.
- **GH #19** (`pricing_history` AFTER UPDATE trigger): **CLOSED** in commit `22c701f`.
- **GH #21** (HEAD-method 503s on pending-queue counter): open, **not a Phase 3.2 blocker** (dashboard perf, pre-existing).
- **GH #22** (onboarding budget_lines completeness): open, **not a Phase 3.2 blocker** (data hygiene, benign).

### Phase 3.1 carryover

None. Phase 3.1 closed clean (commits `7335c1b`, `25b03d3`, `4b20ac1`, `60682b9`, `2e15c22`, `478b564`). Migration 00076 + 00077 applied. Schema rename + 3 routing columns shipped.

### Claude Vision SDK availability

- `@anthropic-ai/sdk@^0.88.0` ✅
- Supports `cache_control: { type: "ephemeral" }` ✅
- Supports `type: "document"` PDF content blocks ✅ (already used in `parseInvoiceWithVision`)
- `callClaude` wrapper ready (`src/lib/claude.ts`) — provides org-scoped metering + `api_usage` logging ✅

### Migration slot

Latest applied: `00077_pricing_history_status_trigger`. Next: **00078**. (Note: per session context, slot 00075 is reserved-unused.)

**No blocking dependencies.**

---

## 8. Proposed migration 00078 header

```sql
-- Migration 00078 — classification_confidence column on document_extractions
--
-- Phase 3.2 (document classifier) needs a typed confidence column to record
-- the classifier's certainty in classified_type. Spec calls for 4-decimal
-- precision (NUMERIC(5,4) — values 0.0000 to 1.0000) so we can store and
-- query confidence directly without JSONB extraction.
--
-- Why a column and not field_confidences JSONB:
--   - Phase 3.2 exit gate requires querying low-confidence rows
--     (classification_confidence < 0.70) for manual triage in Phase 3.10.
--     A column lets us add a partial index later without JSONB ops.
--   - Distinct from field_confidences (per-extracted-field map) — this is
--     the classifier's overall type-decision certainty, not a field-level
--     extraction confidence.
--
-- NOT NULL DEFAULT 0.0000:
--   - All 56 active rows backfill to 0.0000 (they were Phase 3.1 backfilled
--     to classified_type='invoice' WITHOUT a classifier run, so 0.0 is the
--     honest "we did not classify this" value). Phase 3.10 may treat
--     0.0000 as a special "needs reclassification" marker if needed.
--   - Future inserts via /api/ingest fill the real value at classify time.
--
-- CHECK constraint enforces 0.0 ≤ x ≤ 1.0 (NUMERIC(5,4) caps at 9.9999, so
-- without the CHECK we could record nonsense like 5.4321).
--
-- No trigger required — app-layer fills at classify time. R.23 precedent:
-- when value is set by a single well-defined code path, prefer app fill
-- over trigger (avoids action-at-a-distance).
--
-- Blast radius: additive only. No existing code reads or writes this
-- column. R.18 estimate: SMALL.

ALTER TABLE public.document_extractions
  ADD COLUMN classification_confidence NUMERIC(5,4)
    NOT NULL DEFAULT 0.0000
    CHECK (classification_confidence >= 0.0000 AND classification_confidence <= 1.0000);

COMMENT ON COLUMN public.document_extractions.classification_confidence IS
  'Phase 3.2 classifier overall confidence in classified_type. Range 0.0000–1.0000. App-layer fill at classify time. 0.0000 default covers Phase 3.1 backfilled rows that were never classifier-routed. Distinct from field_confidences (per-field extraction confidence) by design — this is the type-decision confidence only.';
```

**Down migration:** drop column. No data preservation needed (additive-only column with default).

---

## 9. Test set sourcing

### Required: 20 documents (5 of each: invoice, PO, CO, proposal)

| Type | Real Ross Built source available? | Plan |
|---|---|---|
| invoice | ✅ 56 active in `invoice-files` bucket | Pull 5 representative samples covering format diversity (clean PDF, T&M, lump-sum Word doc, photo-of-handwritten, multi-page) |
| purchase_order | ❌ 0 records, no bucket | **Synthesize 5 fixtures** OR Jake supplies real Ross Built PO PDFs (vendor quotes, signed POs from current jobs) |
| change_order | ❌ 73 records but no source-doc column / bucket | **Synthesize 5 fixtures** OR Jake supplies real CO PDFs (PCCO forms, change-order proposals) |
| proposal | ❌ 0 records | **Synthesize 5 fixtures** OR Jake supplies real proposal PDFs (vendor quotes formatted as proposals, takeoff letters) |

### Recommended approach (decision needed in §10 amendments)

**Option A — All synthetic fixtures** for non-invoice types. Faster, lower realism. Risk: classifier may over-fit to fixture style and underperform on real docs.

**Option B — Jake supplies 15 real PDFs** (5 PO + 5 CO + 5 proposal) from Ross Built archive. Best realism. Requires Jake's time to pull files.

**Option C — Hybrid:** 5 invoices from dogfood + 5 synthetic POs + 5 real COs (Jake supplies) + 5 synthetic proposals. Bias toward real docs for the highest-stakes types.

**Storage location for fixtures:** propose `__tests__/fixtures/classifier/` directory, gitignored if PDFs contain real vendor data, otherwise checked in. Decide per-document.

---

## 10. Amendments (drafts — NOT committed)

### Amendment Q7-A — PDF handling: full-document content block, no server-side rendering

**Drift:** Q7 resolution specified "Server-side first-page extraction" using pdfjs + a render library. Probes (e) + (f) revealed:
1. Existing `parseInvoiceWithVision` already sends full PDFs to Claude via `type: "document"` block — proven precedent in production.
2. Server-side pdfjs rendering would require adding `canvas` (large native binary, Vercel-fragile) — net-new dependency for no functional benefit.
3. Claude Vision handles multi-page PDFs natively in document blocks — no client-side page extraction needed.

**Proposed amendment text (insert into plan §5911 Phase 3.2 block):**

> **PDF handling:** Send full document directly to Claude Vision via `type: "document"` content block (matches `src/lib/claude/parse-invoice.ts` precedent). Do not render first-page images server-side. Claude's vision capability handles multi-page PDFs natively and the classifier prompt should instruct the model to base its decision primarily on first-page signals (header, vendor block, document title) for token efficiency.

**Trade-off acknowledged:** marginally more input tokens vs single-image classifier on multi-page PDFs. Cost increase per classify call estimated <$0.01 for typical 1–5 page documents. Acceptable given (a) zero new dependencies, (b) proven pattern, (c) better classification accuracy on docs where type signals appear past page 1 (e.g., signature pages).

### Amendment Q1-A — Test set sourcing realism documentation

**Drift:** Q1 resolution assumed "Source from existing Ross Built dogfood data where possible." Probe (c) confirmed only invoices have real dogfood (5/56 sufficient). PO/CO/proposal types have 0 ingestible source documents.

**Proposed amendment text (insert into plan §5911 Phase 3.2 block, exit-gate addendum):**

> **Test set sourcing:** 5 invoices sourced from existing `invoice-files` bucket (Ross Built dogfood). 15 remaining docs (5 PO + 5 CO + 5 proposal) sourced per Jake's selection from §9 of preflight (Option A/B/C). QA report MUST disclose for each of the 20 docs: source (real / synthetic), filename, expected classified_type, actual classified_type, confidence, pass/fail.

### Amendment Q9-A — Blast-radius formalization

**Drift:** plan doc Phase 3.2 section does not include an explicit R.18 blast-radius classification.

**Proposed amendment text (insert into plan §5911 Phase 3.2 block):**

> **R.18 blast radius:** SMALL. Surface = 1 new migration (additive column), 2 new files (lib + route), 0 modified files. No code cascade — nothing today references the classifier. Risk profile: greenfield.

---

## 11. Risk register

| # | Risk | Severity | Mitigation |
|---|---|---|---|
| R1 | Classification accuracy <90% on 20-doc set | High | Iterate on system prompt with concrete examples for each type. If still <90% after 3 iterations, escalate to Jake for taxonomy-refinement discussion. |
| R2 | Synthetic fixtures over-fit classifier; real docs misclassify post-launch | High | Mitigate by requesting real PDFs for at least 1 type via Amendment Q1-A Option B/C. Production safety net: <0.70 confidence routes to manual selection (Phase 3.10 surface). |
| R3 | Prompt caching first adoption — cache miss rate higher than expected | Medium | Verify cache hit on second-call in integration test. Cache TTL is 5 min (Anthropic ephemeral); confirm system-prompt block is large enough to be cacheable (>1024 tokens for Sonnet). If too small, add a stable few-shot example block to the cached portion. |
| R4 | Multi-page PDF input tokens spike vs first-page-only baseline | Medium | Per Amendment Q7-A trade-off: cost increase estimated <$0.01/call. Monitor `api_usage.input_tokens` post-launch; if classify calls exceed 10k input tokens routinely, revisit first-page-truncation strategy (server-side `pdfjs-dist.getDocument().getPage(1)` text extraction, not image rendering). |
| R5 | `callClaude` wrapper plan-limit error surfaces during classify | Medium | Wrap classifier call site in same `PlanLimitError` handler as existing routes (e.g. `src/app/api/invoices/parse/route.ts`). Return HTTP 429 with `{error, current, limit, plan}` JSON. |
| R6 | `verification_status` enum still 4-value (pending/partial/verified/rejected) — Phase 3.2 inserts default 'pending' which is fine, but Amendment M target is 4-value (pending/verified/committed/rejected) | Low | Phase 3.2 does not need to advance the enum. Default 'pending' satisfies both current and target shapes. Tracked as Amendment M deferred work. |
| R7 | `target_entity_type` / `target_entity_id` left NULL by classifier (Phase 3.2 is classification-only per Q3) — downstream pipelines must populate on commit | Low | Phase 3.2 explicitly documents this. Phases 3.3–3.8 own commit-time population. Phase 3.2 tests assert classifier writes ONLY `classified_type` + `classification_confidence`, leaves `target_entity_type` / `target_entity_id` NULL. |
| R8 | Test fixtures may contain sensitive vendor pricing data — committing to public repo leaks Ross Built financials | Medium | Decision per-fixture in §9. Real Ross Built docs → gitignored, stored in `__tests__/fixtures/classifier/.local/`. Synthetic docs → committable. Document choice in QA report. |

---

## 12. Exit-criteria mapping to execution steps

| Plan exit criterion | Execution step (Phase 3.2 work plan) |
|---|---|
| ≥90% accuracy on 20-doc test set (5 of each major type) | Step 5 — accuracy harness in `__tests__/document-classifier.test.ts` runs each fixture through `classifyDocument()`, asserts `classified_type === expected`, computes aggregate accuracy, fails if <0.90 |
| `/api/ingest` accepts file → creates `document_extractions` row with `classified_type` | Step 4 — POST handler in `src/app/api/ingest/route.ts`: org-scope via `getCurrentMembership()`, file upload to `invoice-files` bucket (or new `ingest-files` bucket — see §9 storage decision), `classifyDocument()` call, INSERT row, return JSON `{extraction_id, classified_type, classification_confidence}` |
| Confidence score recorded; <0.70 flagged | Step 1 — migration 00078 adds `classification_confidence` column. Step 4 — route writes the value. No "flagged" column needed; "flagged" = queryable predicate (`WHERE classification_confidence < 0.70`). Phase 3.10 owns the surface. |
| Test runner subagent: all classifier tests PASS | Step 5 — `npm test` includes new `document-classifier.test.ts`. Suite must remain green (target: 423+ passing across 19 files, up from 420/18). |
| Classifier system prompt cached via prompt caching | Step 2 — `src/lib/ingestion/classify.ts` system message uses `[{ type: "text", text: PROMPT, cache_control: { type: "ephemeral" } }]`. Verify cache hit via `api_usage.metadata.cache_read_input_tokens > 0` on second call (integration test). |
| QA report generated with sample classifications for each type | Step 6 — `qa-reports/qa-branch3-phase3.2.md` documenting all 20 fixture results, accuracy %, cache hit rate, sample API responses, GH issues opened (if any). |

---

## 13. Ready-for-execution statement

**Status: READY pending Jake's review of:**

1. **Amendment Q7-A** (PDF handling — full doc vs first-page render). Strong recommendation: ACCEPT (zero new deps, proven precedent).
2. **Amendment Q1-A** (test set sourcing realism). Decision needed: Option A (all synthetic) / B (all Jake-supplied) / C (hybrid).
3. **Amendment Q9-A** (R.18 formalization). Recommendation: ACCEPT (formality only).
4. **Risk R3 acknowledgment** (first prompt-caching adopter). No mitigation needed pre-execution; integration test will verify.
5. **Risk R8 decision** (fixture commit policy — `.local/` gitignore vs check-in). Per-fixture decision; default to `.local/` for any real Ross Built doc.

**Blockers: none.** All probes passed. Migration slot 00078 confirmed. SDK + wrapper ready. Code surface clean.

**Pre-execution checklist (Jake authorizes):**
- [ ] Review and accept/reject Amendments Q7-A, Q1-A, Q9-A
- [ ] Decide test-set Option A/B/C (and supply real PDFs if B/C)
- [ ] Authorize commit of this preflight doc
- [ ] Authorize amendment commit to plan doc (separate commit per R.4 amend-before-execute discipline)
- [ ] Authorize Phase 3.2 execution start (migration 00078 → classify lib → ingest route → tests → QA report)

---

**End of preflight.** No code changes made. No commits. No migrations applied.
