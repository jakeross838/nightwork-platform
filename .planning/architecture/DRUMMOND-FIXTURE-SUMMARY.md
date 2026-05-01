# Drummond fixture summary

**Status:** Stage 1 architecture artifact. Sanitized counts only. Last updated 2026-04-29.
**Companion to:** `CURRENT-STATE.md` §F.

This file documents *what is in* the Drummond reference-fixture set across three sources, without naming specific vendors, owners, addresses, or dollar amounts. The actual fixtures live in `.planning/fixtures/drummond/` (gitignored). The substitution map mapping real → fake names lives in the same gitignored directory and is created on demand the first time fixtures are shared cross-org.

Drummond is the single reference job per D-005, MASTER-PLAN.md, and canonical §10. Every Nightwork fixture, seed, end-to-end test, screenshot, and prototype is built against Drummond data. This summary is what future planning, future testing, and future onboarding can rely on.

---

## Source 1 — P-drive scan

**Path category:** Job-folder file system on the office drive.
**Scope:** Plans, contracts, schedules, photos, daily logs, proposals, permits, surveys, budgets, change orders, correspondence, inspections.
**Note:** Per Jake's brief, P-drive does not contain real invoices. Confirmed.

| Category | File count | Size (MB) |
|---|---:|---:|
| Plans | 48 | 537.9 |
| Building Department | 85 | 195.3 |
| Subcontractor Proposals | 144 | 138.8 |
| Selections | 38 | 72.5 |
| Surveys + Elevations | 13 | 39.7 |
| Notice of Acceptance docs | 9 | 33.3 |
| Engineering | 7 | 22.1 |
| Energy Calcs | 4 | 18.7 |
| Inspections | 16 | 7.8 |
| Budget | 25 | 7.4 |
| Contract | 4 | 3.4 |
| Drainage | 3 | 2.0 |
| Photos | 3 | 1.8 |
| Warranty | 2 | 0.8 |
| Locates | 4 | 0.4 |
| Purchase Orders | 2 | 0.2 |
| Permits | 1 | 0.07 |
| **TOTAL** | **408** | **~1,082** |

Empty categories (workflows live elsewhere or not yet captured): Agenda, Correspondence-Owners, Meeting-Notes, Schedule.

Filetype mix at top level: ~85% PDF, ~5% XLSX/XLS, ~3% DOCX, ~5% JPG/PNG/JPEG, plus a small amount of MSG/EML (saved emails) and DWG (CAD).

---

## Source 2 — Supabase invoice graph

**Path category:** Production-shaped synthetic test data already ingested into the database.

| Entity | Drummond rows | Notes |
|---|---:|---|
| jobs | 1 | The Drummond Residence record |
| invoices | 1 | One progress invoice; status = qa_review |
| invoice_line_items | 6 | |
| invoice_allocations | 3 | 2 active + 1 soft-deleted superseded |
| vendors used | 1 | One trade vendor |
| cost_codes referenced | 2 | Electrical labor + electrical labor CO |
| document_extractions | 1 | classification_confidence = 0 (anomaly) |
| document_extraction_lines | 0 | (See anomaly: 6 lines stored as JSONB on extraction row, not as table rows) |
| line_cost_components | 0 | |
| change_orders | 0 | |
| draws | 0 | |
| draw_line_items | 0 | |
| budget_lines | 0 | |
| purchase_orders | 0 | |
| po_line_items | 0 | |
| lien_releases | 0 | |
| proposals | 0 | |
| activity_log (Drummond-scoped) | 6 | All on the one invoice |
| notifications (Drummond-scoped) | 13 | Single upload event fanned out |
| parser_corrections (Drummond-scoped) | 3 | All vendor-name edits |

**Org-wide config (not Drummond-scoped, but Ross Built tenant):**
- org_workflow_settings: 1 row
- approval_chains: 6 rows (the 6 workflow dimensions, all with default chains)
- org_cost_codes: 12 rows (entirely synthetic test data, e.g. R-T-001 through R-T-007)
- pending_cost_code_suggestions: 1 row

**Headline:** Drummond's Supabase fixture is intentionally thin. The ~57 invoices in the database are mostly distributed across two other test jobs created during phase development. Drummond exists to exercise the upload-classify-extract-PM-review-QA-kickback-QA-approve loop end-to-end on a single, well-understood invoice. Wave 1 testing depth requires more Drummond data — see Source 3.

---

## Source 3 — Downloads filename hunt

**Path category:** Unorganized local Downloads folder containing real historical Drummond artifacts that have NOT been ingested into Supabase.

**Tier counts:**

| Tier | Files | Size (MB) | Definition |
|---|---:|---:|---|
| Tier 1 (definitely Drummond) | 94 | 93.2 | Filename hits on `*drummond*` or `*501*74*` |
| Tier 2 (probably Drummond) | 69 | 67.6 | Filename hits on invoice/draw/lien/PO/payapp + likely-Drummond-vendor cues; review needed |
| Tier 3 (excluded) | ~1024 | — | Off-topic (installers, archives, screenshots, Claude state, etc.) |
| **Tier 1 + 2** | **163** | **~160.8** | |

**Content categories observed in Tier 1 + 2 filenames:**

- Combined invoice PDFs (e.g. monthly-batch invoice rollup matching the Pay App application)
- Companion lien release sets (one per monthly batch)
- Historical pay applications — at least 5 distinct draws, in both PDF (G702/G703) and XLSX form
- Recent budget XLSX (most-recent-budget reference)
- T&M format reference invoice (matches CLAUDE.md "Known Invoice Formats" #2 — daily labor entries)
- Lump-sum format reference invoice (matches CLAUDE.md "Known Invoice Formats" #3 — Word doc, no line items)
- Curated split-invoice batch (vendor-amount-tagged; presumably pre-split for one Pay App)

**Vendors referenced in Drummond filenames:** ~17+ distinct trade vendors (electrical, plumbing, drywall, framing/carpentry, foundation, lumber, drainage, paint, tile, roofing, utilities, big-box hardware, framing-specialty, drywall-specialty). Most of these are not in Supabase.

**Address pattern coherence:** Filenames use the construction-site address (501 74th, Holmes Beach FL) consistently. Per Jake's clarification 2026-04-29, the Source 2 (Supabase) `jobs.address` and `client_name` for the Drummond record are synthetic placeholder values — not real homeowner data. The real Drummond data has not been ingested into Supabase.

---

## Cross-source coherence

| Fact | Source coherence |
|---|---|
| Construction site address | Source 1 + Source 3 corroborate (501 74th, Holmes Beach FL — real per Jake 2026-04-29) |
| Source 2 (Supabase) Drummond `jobs.address` and `client_name` | **Synthetic placeholder data, not real**. Real Drummond data has not been ingested. |
| Vendor count on Drummond invoices | Source 2: 1 / Source 3: 17+ — **massive divergence** (Source 3 reflects real history; Source 2 has only one synthetic test invoice) |
| Pay app count | Source 2: 0 draws / Source 3: ~5 historical pay apps (Drs 1–5) — divergence reflects un-ingested historical data |
| Budget | Source 2: 0 budget_lines / Source 3: at least 1 recent budget XLSX |
| Lien releases | Source 2: 0 / Source 3: at least 1 lien-release set (Nov 2025 batch) |

**Interpretation:** The Drummond reference-fixture set is **rich in raw artifacts (Sources 1+3) but thin in ingested-and-structured records (Source 2)**. This is itself a finding — the data ingestion gap (canonical §12, MASTER-PLAN.md §11 tech debt) is concretely instantiated by Drummond's own paperwork sitting in Downloads. CURRENT-STATE.md §F.4 and GAP.md propose a Drummond-backfill Wave 1 phase as the first practical exercise of the import/export framework that VISION.md targets.

---

## Anonymization posture

The fixtures themselves are gitignored. This summary is sanitized:
- No vendor names
- No homeowner names
- No specific addresses
- No specific dollar amounts (only category-level size totals)
- No invoice numbers, PCCO numbers, or other unique identifiers

A `SUBSTITUTION-MAP.md` mapping real → realistic-fake names will be created in `.planning/fixtures/drummond/` (gitignored) the first time fixtures need to be shared cross-org or used in synthetic tests where realism matters. Until then, fixture access is local-only and unmasked.

Phone numbers, EINs, SSNs, license numbers, check numbers, and bank/routing details: none observed in the fixture set.

---

**Cross-references:**
- `CURRENT-STATE.md` §F (full inventory with named vendors and amounts — committed but in audit-trail context)
- `.planning/fixtures/drummond/source1-pdrive/INVENTORY.md` (gitignored, full P-drive listing)
- `.planning/fixtures/drummond/source2-supabase/*.json` (gitignored, 25 JSON exports)
- `.planning/fixtures/drummond/source3-downloads/INVENTORY.md` (gitignored, Downloads inventory)
