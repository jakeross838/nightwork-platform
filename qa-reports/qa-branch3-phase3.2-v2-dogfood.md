# Phase 3.2 v2 — dogfood report (classifier-direct mode)

Run window: 2026-04-27T16:33:37.786Z → 2026-04-27T16:33:56.323Z
Mode: **classifier-direct**. Skips /api/ingest plumbing — see §Mode below.
Fixture root: `__tests__/fixtures/classifier/.local/dogfood` (gitignored — real Ross Built docs only)

## Summary

| Metric | Value |
|---|---|
| Total documents | 6 |
| Successful classifications | 6 |
| Failed (classifier error) | 0 |
| Low-confidence rows (<0.7) | 0 |
| Avg latency | 3059 ms |
| Cache-hit rate (api_usage) | 83.3% |

## Mode — why classifier-direct, not /api/ingest

The original dogfood plan POSTed each PDF to `/api/ingest` with Jake's
authenticated session cookie. Supabase splits long auth tokens into
chunked cookies (`name.0`, `name.1`); when copied from Chrome DevTools
and pasted, the chunk boundary loses a few separator characters that
aren't recoverable from the visible text — the SSR base64-URL decoder
then errors with `Invalid UTF-8 sequence`.

Rather than burn another cycle on cookie extraction, this run calls
`classifyDocument()` directly on every PDF in the dogfood folder.

**What this proves:** the classifier classifies real, unseen Ross Built
documents correctly (no overfitting to the eval fixture set).

**What this skips:** the `/api/ingest` plumbing — multipart upload,
`document_extractions` insert/update with `invoice_id=null`, soft-delete
on classifier failure. That surface is covered separately by the 17
static fences in `__tests__/api-ingest.test.ts` and by future manual
curl-with-cookie when a clean session cookie is available.

## What was NOT tested

The /api/ingest HTTP route did not execute end-to-end against real
session auth in this dogfood. Specifically, the following surfaces have
**no live runtime evidence** in v2:

1. **The /api/ingest HTTP route under real session auth.** No real
   browser cookie has been validated against `getCurrentMembership()`
   during this phase. The auth gate's correct *shape* is enforced
   structurally (static fence #4: `getCurrentMembership` import; #5:
   not `requireOrgId`; #7: 401 on null membership), but the runtime
   path was not exercised end-to-end.
2. **DB writes through the live route flow.** The route's
   `INSERT document_extractions` (with `invoice_id=null`,
   `verification_status='pending'`) and the post-classify `UPDATE` of
   `classified_type` + `classification_confidence` are structurally
   verified by static fences #8, #9, #11, but no real row has been
   created via the HTTP path.
3. **Org-scoping enforcement under real auth.** The structural fence
   (#11) confirms the route filters `.update()` by
   `.eq('org_id', membership.org_id)`. The actual cross-tenant
   protection has not been runtime-tested.
4. **Storage upload to `{org_id}/ingest/...`.** The path-templating is
   structurally verified (fence #12), but no file has actually been
   pushed to the `invoice-files` bucket via the route.
5. **Soft-delete-on-failure path.** Fence #15 confirms the code is
   present; not exercised at runtime since classifier failures didn't
   occur in eval or dogfood.

### What WAS tested

- **Classifier on 36 eval fixtures** — `RUN_CLASSIFIER_EVAL=1 npm test`
  passes 36/36 = 100% across 9 of 10 categories (eval report
  `qa-reports/.eval/phase3.2-v2-eval.md`).
- **Classifier on 6 novel real-world docs** — this dogfood, 6/6 = 100%
  via `classifyDocument()` direct.
- **Route structure** — 17 static structural fences in
  `__tests__/api-ingest.test.ts`, all PASS.
- **Schema readiness** — migration 00081 verified on dev (131 rows, 0
  CHECK violations).

### Implication for cutover

The first real-world HTTP test of `/api/ingest` will happen on the
first authenticated upload after merge. Watch the first dogfood-style
upload's behavior carefully:

- Confirm `document_extractions` row appears with `invoice_id=null`,
  `target_entity_*` NULL, `verification_status='pending'`.
- Confirm `raw_pdf_url` points at `{org_id}/ingest/{ts}_{name}.pdf`.
- Confirm `classified_type` + `classification_confidence` populate
  after the classifier returns.
- Confirm a deliberate failure (e.g., upload a 0-byte file) triggers
  the soft-delete path and returns a structured 500.

If any of those misbehave, raise an issue and the rollback is
reverting commit `9a58793`.

## Per-fixture results

**Jake fills `Expected` and `Pass/fail` after the run.** Use one of the
ten enum values for Expected: `invoice`, `purchase_order`, `change_order`,
`proposal`, `vendor`, `budget`, `historical_draw`, `plan`, `contract`, `other`.

| # | Filename | Size (KB) | Pages | Classified | Confidence | Cache hit | Latency (ms) | Expected | Pass/fail |
|---|---|---|---|---|---|---|---|---|---|
| 1 | 52fdse.pdf | 103.7 | 1 | `purchase_order` | 1.00 | no | 2581 | `purchase_order` | **PASS** |
| 2 | 534gf.pdf | 122.7 | 1 | `change_order` | 0.98 | yes | 2877 | `change_order` | **PASS** |
| 3 | 853 N Shore - Executed Construction Agreement.pdf | 247.9 | 10 | `contract` | 0.98 | yes | 3647 | `contract` | **PASS** |
| 4 | Clark Unity of title_Document 1_AGREEMENT_20240124.pdf | 54.7 | 1 | `other` | 0.95 | yes | 2174 | `other` | **PASS** |
| 5 | Crews UDA used for AIA.pdf | 205.6 | 13 | `budget` | 0.95 | yes | 3905 | `budget` | **PASS** (see disposition note) |
| 6 | REVISED ESTIMATE 21-496 ROSS BUILT CONSTRUCTION CLARK RESIDENCE.pdf | 303.0 | 3 | `proposal` | 0.92 | yes | 3168 | `proposal` | **PASS** |

**Overall: 6/6 = 100% on novel real-world Ross Built documents.**

### Disposition note — fixture #5 (`Crews UDA used for AIA.pdf`)

Ambiguous on filename alone (`UDA used for AIA` reads like it could be a draw). UDA refers to UDA Construction Suite, an estimating package; the PDF is the *source budget* exported from UDA that was later reformatted into AIA G702/G703 for billing. It is the budget input, not a draw output. Classifier returned `budget`, which is the correct disposition. The 0.95 confidence is appropriate — high but not 1.0, reflecting the genuine ambiguity in the filename.
