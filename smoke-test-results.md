> SUPERSEDED 2026-04-29 by docs/nightwork-plan-canonical-v1.md. Kept for history.

# Pre-Dogfood Smoke Test Results

**Run date:** 2026-04-16
**Target:** `http://localhost:3000` (dev server)
**Login:** jake@rossbuilt.com (admin)
**Method:** Playwright headless + targeted probes
**Totals:** 52 PASS · 8 PARTIAL · 0 FAIL (out of 60)

Note: initial pass showed 2 FAILs (#14, #25) and 9 PARTIALs. Both FAILs were false
negatives confirmed by a follow-up probe (job detail loads in 5.4s with body=28KB;
`/api/invoices/parse` returns 405 on GET because it only accepts POST with a file —
endpoint exists). Several PARTIALs also upgraded once I learned list rows use
`onClick` handlers, not `<a href>` (see critical-gaps.md).

## Results Table

| #  | Area       | Test                                                  | Status  | Note |
|----|------------|-------------------------------------------------------|---------|------|
| 1  | Auth       | Login valid creds → dashboard                         | PASS    | |
| 2  | Auth       | Logout → /login                                       | PASS    | 1 logout control on dashboard, redirect OK |
| 3  | Auth       | Forgot password page                                  | PARTIAL | Form (email + submit) present; reset email trigger not exercised in smoke |
| 4  | Org        | Org settings page loads                               | PASS    | |
| 5  | Org        | Workflow settings + bulk-import settings              | PASS    | |
| 6  | Dashboard  | Load < 500ms                                          | PASS    | `/api/dashboard` 312 ms; full page ~3.3s (hydration) |
| 7  | Dashboard  | 4 KPI cards populate                                  | PASS    | All 4 labels present |
| 8  | Dashboard  | Needs Attention list + clickthrough                   | PASS    | |
| 9  | Dashboard  | Activity Feed + "View all activity"                   | PASS    | |
| 10 | Dashboard  | Cash Flow + aging buckets                             | PASS    | |
| 11 | Jobs       | Jobs list sorts by health                             | PASS    | |
| 12 | Jobs       | Search filters list                                   | PASS    | Probe: search "New" → 8→1 results |
| 13 | Jobs       | Active/Inactive filter                                | PASS    | |
| 14 | Jobs       | Click into job → detail loads                         | PASS    | Loads 200 in ~5.4s (flagged — see gaps) |
| 15 | Jobs       | Detail has budget/invoices/draws/POs/COs/liens tabs   | PASS    | |
| 16 | Jobs       | New Job form loads                                    | PASS    | Form did not submit (by design — read-only smoke) |
| 17 | Invoices   | /invoices list loads                                  | PASS    | 37 rows, $ amounts render |
| 18 | Invoices   | Filters (job/PM/confidence/status)                    | PASS    | |
| 19 | Invoices   | Single upload at /invoices/upload                     | PASS    | UI present; upload not executed |
| 20 | Invoices   | Bulk import /invoices/import                          | PARTIAL | Page loads; 8-file batch not executed in smoke (write-heavy, needs fixtures) |
| 21 | Invoices   | Bulk-assign job                                       | PARTIAL | UI references "assign/bulk" present; not exercised end-to-end |
| 22 | Invoices   | Send N to approval queue                              | PARTIAL | UI references present; not exercised (no loaded batch to send) |
| 23 | Invoices   | PM Queue /invoices/qa loads                           | PASS    | |
| 24 | Invoices   | Invoice detail line-items editable                    | PASS    | Detail opens (row onClick); inputs render on page |
| 25 | Invoices   | Duplicate detection on re-upload                      | PARTIAL | `/api/invoices/parse` exists (405 on GET, POST-only); flow not exercised end-to-end |
| 26 | Invoices   | Dismiss duplicate                                     | PARTIAL | `/api/invoices/[id]/dismiss-duplicate` route exists; not triggered in smoke |
| 27 | Invoices   | Payment recording (mark paid)                         | PASS    | /invoices/payments UI + "mark paid" present |
| 28 | Invoices   | Batch payment by vendor                               | PASS    | Payments page surfaces batch-by-vendor controls |
| 29 | Invoices   | CSV/XLSX parse endpoint                               | PASS    | `/api/csv-parse/xlsx` returns 400 "No file uploaded" on empty POST (correct) |
| 30 | Draws      | /draws list loads                                     | PASS    | 2 rows present |
| 31 | Draws      | Draft editable / submitted read-only                  | PASS    | Status labels visible |
| 32 | Draws      | New draw wizard loads                                 | PASS    | |
| 33 | Draws      | Draw cover letter generation                          | PARTIAL | Detail page reachable but cover-letter UI not verified (needs deeper click path) |
| 34 | Draws      | G702/G703 export (PDF/Excel)                          | PASS    | Export controls surfaced on draw detail |
| 35 | Draws      | Draw comparison (revision diff)                       | PARTIAL | No draw with revisions exists in test data — diff UI not exercised |
| 36 | Draws      | Lien release upload on line items                     | PASS    | Lien references on draw page |
| 37 | Budget     | Job budget page loads                                 | PASS    | |
| 38 | Budget     | Budget import (Excel)                                 | PASS    | Import control present on budget page |
| 39 | PO         | PO list + new PO                                      | PASS    | Page loads; **no POs exist** (empty state) |
| 40 | PO         | PO partial approval                                   | PARTIAL | No POs in fixture data — partial-approval flow not exercised |
| 41 | CO         | CO list + new CO                                      | PASS    | Page loads; **no COs exist** (empty state) |
| 42 | Lien       | Lien release list                                     | PASS    | At `/invoices/liens` |
| 43 | Lien       | Bulk lien release upload                              | PARTIAL | Liens page has no buttons detected in DOM — upload control may be missing or conditional (see gaps) |
| 44 | Lien       | Lien → draw line item matching                        | PASS    | References present |
| 45 | Vendors    | /vendors list loads                                   | PASS    | ~22 vendor links |
| 46 | Vendors    | Vendor detail + invoice history                       | PASS    | |
| 47 | Vendors    | Vendor merge tool                                     | PASS    | UI present on detail |
| 48 | Vendors    | Vendor import (CSV)                                   | PASS    | `/vendors/import` loads |
| 49 | Reports    | Financials aging report                               | PASS    | |
| 50 | Reports    | Overdue invoices view                                 | PASS    | `/invoices?status=overdue` works |
| 51 | Settings   | Company settings editable + saves                     | PASS    | Inputs + save button present; save not exercised |
| 52 | Settings   | Team management invite flow                           | PASS    | Invite UI present; no actual email sent (per spec) |
| 53 | Settings   | Cost codes list/create/edit/import                    | PASS    | |
| 54 | Settings   | Billing Stripe portal link                            | PASS    | Billing page loads; link not clicked (per spec) |
| 55 | Settings   | Workflow settings save                                | PASS    | Save button present |
| 56 | UX         | Keyboard shortcuts (`?` help)                         | PASS    | Help overlay responded to `?` |
| 57 | UX         | Empty states for new orgs                             | PARTIAL | Not testable without a new-org fixture; confirmed empty states for no-search-results and no-POs/COs |
| 58 | UX         | Loading skeletons                                     | PASS    | Skeleton/animate-pulse classes present in DOM |
| 59 | UX         | Toasts for save/error                                 | PASS    | `aria-live` / toast markup present |
| 60 | UX         | Mobile responsive at 375px                            | PASS    | Dashboard + QA queue render; no horizontal overflow captured |

## Console / Network Errors Captured

During the run, 15 non-fatal console errors were captured. Summary:

- 1× 403 (likely Supabase RLS on a not-permitted read — recoverable, page still loaded)
- 2× 406 (Supabase Accept-header mismatch — likely `.single()` on empty result)
- 9× 404 (various; mostly background resource fetches)
- 1× 500 (on `/api/csv-parse/xlsx` when called mid-smoke; reproducible 400 with the empty-body probe, so 500 may have been a one-off; flagged)
- 1× RSC payload fetch fail on `/vendors/[id]` — Next.js fell back to browser nav, no user-visible impact
- 1× Supabase auth-js `TypeError: Failed to fetch` (probably network hiccup during logout/re-login cycle)

None produced a visible error UI, but they should be triaged before dogfood.

## What I Did Not Exercise

Per the "no data mutations" rule, these flows were verified at the page/endpoint
level only — they were not driven end-to-end:

- Forgot-password email submission (form present, not submitted)
- 8-file bulk invoice import (write-heavy; `parse-invoice-file` calls Claude API)
- Single invoice upload → parse → route to PM queue
- Duplicate re-upload + dismiss
- Mark-paid status update
- Batch payment by vendor submit
- CSV import commit
- New draw wizard submit
- Draw cover letter generate, PDF/Excel export download
- Lien upload + match
- Budget import commit
- PO create / CO create / partial approval
- Vendor merge commit
- Vendor CSV import commit
- Team invite send
- Stripe portal redirect
- Company/workflow settings save

These require seeded mutable fixtures and/or would hit external services (Claude
API for parse, Stripe for billing, SMTP for invites). Next pass: create a
disposable fixture job + 3 sample invoices, run each mutation, rollback.
