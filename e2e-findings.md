> SUPERSEDED 2026-04-29 by docs/nightwork-plan-canonical-v1.md. Kept for history.

# E2E Findings — Dewberry Draw 9 Dogfood

**Date:** 2026-04-16
**Target:** https://egxkffodxcefwpqmwrur.supabase.co (DEV)
**Job:** Dewberry Residence, 681 Key Royale Dr · PM Bob Mozine · contract $5,351,168.95
**Invoices:** 11 (March 2026 · $71,180.22 total)
**Draw:** Draw #1 (representing pay app #9), draft, not submitted

## Blockers / data-integrity bugs

- Budget importer cannot read Ross Built's actual Pay Apps — only reads `worksheets[0]` (G702 Project Summary); G703 lives on sheet 2 with a different column layout.
- Budget importer expects `col A = code | col B = amount`; G703 layout is `col A = code | col B = description | col C = estimate`.
- Budget importer had to be worked around with a one-off script (`scripts/e2e-dewberry-setup.mjs`) that reads G703 + PCCO directly and inserts `budget_lines` with `previous_applications_baseline` populated.
- Cost code `06108` referenced by Dewberry's G703 does NOT exist in `cost_codes` table — 1 budget line silently dropped; if that row had dollars they'd be missing from the budget entirely.
- Cost codes table has duplicate entries for the same code with different descriptions: `15101` (Drywall — Hang + Gas Rough In), `16101` (Interior Paint + Fireplace), `17101` (Roofing + Flooring — Tile). PostgREST embeds and app mappers can resolve to the wrong row.
- Invoices arrived as one combined 11-page PDF and had to be manually split before import. Nightwork cannot handle multi-invoice PDFs; every combined PDF from an AP inbox is a manual operation.
- AI parser misidentified Dewberry invoice page 02 vendor as "ROSS BUILT LLC" (confidence 0.60) — it read the "TO:" / BILL-TO party instead of the "FROM" party on the FPL electric bill. Low confidence correctly routed it to QA queue, but without a human catching the vendor, the record stays wrong.
- The vendor "ROSS BUILT LLC" was auto-CREATED in the `vendors` table by the FPL misparse — Nightwork now has Ross Built listed as a vendor of itself.
- Cost code auto-assignment not populated on any invoice — AI parser schema supports `cost_code_suggestion` but every one of the 11 invoices had to be manually mapped.
- `require_po_linkage` workflow gate (org setting) blocked ALL 11 approvals because no POs exist on the job. For FPL utility bills, there are no POs — this gate is unrealistic as an always-on rule.
- `require_budget_allocation` workflow gate blocked approvals because `invoice_line_items.budget_line_id` was null after import — save.ts populates this but only when the cost_code matches an existing budget_line at parse time; when PM assigns the code later, the line doesn't get back-filled.
- Both of the above workflow gates had to be toggled OFF on `org_workflow_settings` to let the E2E proceed; logged as workaround, not solution.
- `/api/draws/[id]` returned `cost_codes: null` on 19 of 142 budget_lines when called with the user-session client — PostgREST embed dropped the join silently. Draw detail page crashed client-side reading `.code` on null.
- `/api/draws/[id]/export` returned HTTP 500 with "Cannot read properties of null (reading 'code')" for the same reason — XLSX pay-app export completely broken until patched.
- Same `/api/` class of bug also bit `/api/dashboard` during the final verification — dashboard showed 7 active jobs + 28 pending invoices from BEFORE the reset, because Next.js cached the fetch responses despite `dynamic = "force-dynamic"`.
- Next.js 14 fetch-cache bug required `export const fetchCache = "force-no-store"` on `/api/dashboard`, `/api/jobs/health`, `/api/jobs/[id]/overview`, `/api/draws/[id]`, and `/api/draws/[id]/export`. Every route in the repo that uses `createServerClient()` with Supabase is potentially affected — this is systemic, not localized.
- RLS / user-session Supabase client on the draw detail endpoint returns null embeds that service-role resolves fine. Any endpoint using `createServerClient()` without a `tryCreateServiceRoleClient() ?? ...` fallback is exposed to the same failure mode.

## Usability / workflow gaps

- `/jobs/new` UI form submit failed under Playwright — Supabase auth-js threw `TypeError: Failed to fetch` mid-fill, page redirected to `/login`, no `POST /api/jobs` ever fired, form data lost. Had to insert via SQL. A real admin under flaky network will lose their typed data the same way.
- Cumulative draw history not modeled — `budget_lines.previous_applications_baseline` stores an aggregate for "prior billing" but there are no Nightwork records for individual pay apps 1-8. Draw #9 in Nightwork is labeled Draw #1. Owner seeing "Application No. 1" on a job that already had 8 pay apps outside Nightwork will be confused.
- G702 "LESS PREVIOUS PAYMENTS" pulls from the baseline aggregate, not from actual draw records — no way to reconstruct/audit pay apps 1-8 inside the app.
- Job detail "Recent Activity" card is empty — it only reads `activity_log` rows for `entity_type='job'`, ignoring invoice + draw + CO activity on the same job. The dashboard Activity Feed (which joins across entities) has 20+ Dewberry entries while the Job Overview's Recent Activity says "No recent activity."
- Approving an invoice auto-advances through `pm_approved → qa_review`; draws require `qa_approved`. The auto-advance stops at `qa_review`, so a separate QA-approve pass is required. Diane would need to click through 11 more invoices in the QA queue.
- Lien releases do NOT auto-generate for a draft draw — only on submit. PMs viewing `/invoices/liens` or `/jobs/<id>/lien-releases` while preparing a draft see an empty state with no indication that submit will fill it.
- The 4th Clean Cans invoice was (correctly) flagged as a potential duplicate because vendor + amount matched the previous three. There is no bulk "these are all legitimately distinct" button — each has to be dismissed individually.
- Auto-paid date on payments list shows Apr 30, 2026 for invoices received today — the payment-schedule logic (Ross Built's 5th/20th rule) appears to have rounded all 11 to the same day; batch-level pickup plan is not surfaced.
- No UI field for "PM reassignment reason" or "vendor correction note" — the status_history JSONB supports it but the detail page doesn't show a place to type one.

## Data quality / accounting observations

- Sum of G703 `original_estimate` column on Dewberry pay app = $5,293,168.95 but PCCO row 9 "Beginning Contract Amount" = $5,351,168.95 — a $58,000 gap. The Pay App doesn't round-trip to itself.
- Total prior billing (sum of G703 col D) for Dewberry = $1,892,900.36, ~35% of contract. Nightwork's overview shows "% Complete 1.3%" because it only counts approved invoices in Nightwork, not the baseline — the financial bar understates actual progress.
- Dewberry pay app #9 was signed by Jason Szykulski; user assigned Bob Mozine as PM for this E2E. Intentional, noted.
- Budget Health card on Dewberry overview shows "107 Under Committed" — because no POs exist for 107 of 142 budget lines. A fresh job with a fresh budget will always show a ~75% "Under Committed" number until POs get issued.
- Cover letter endpoint returns 200 with 592 bytes — not visually verified; no preview UI surfaced to confirm content.
- Storage bucket `invoice-files` retains orphan files from the previous pre-reset run — TRUNCATE doesn't touch Supabase storage. No user-visible impact but accumulates.
- Vendor created-from-parse uses the vendor name AS IS — `ISLAND LUMBER AND HARDWARE, INC.` and `ROSS BUILT LLC` are stored in uppercase with punctuation because that's how the AI read the letterhead. No case normalization on create.

## Performance / latency

- Invoice parse: ~17s per invoice via Claude API — 11 invoices = 197s total. A batch of 50 invoices would be ~14 minutes.
- Draw detail page: loads fine after the service-role + fetchCache fixes (~3s to first paint in dev mode).
- `/api/jobs/[id]/overview`: 447-980ms (cold → warm) — within target.
- No page in the E2E measured > 2s after the cache/RLS fixes.
- Full Playwright E2E sequence (reset → job → budget → intake → approve → QA → draw → export → screenshots) ran in about 7 minutes of scripted time, ignoring the 197s invoice-parse window.

## Skipped / not tested

- Lien release upload — user provided none. `/invoices/liens` empty-state screenshot captured in place.
- Draw submission — user said "save as draft, do NOT submit."
- Draw revision / comparison UI — no revisions exist.
- Team invite email, Stripe portal click, forgot-password submit — outside scope per prior smoke.
- Drummond — previous run, reset between phases.
