> SUPERSEDED 2026-04-29 by docs/nightwork-plan-canonical-v1.md. Kept for history.

# Critical Gaps — Pre-Dogfood Smoke Test

Gaps surfaced during smoke testing. These are *not* test failures — the feature
either works or isn't testable in smoke — but they would hurt dogfood
experience if not addressed. Ordered roughly by severity.

## HIGH — affects dogfood-day experience

### 1. Job detail is slow (5.4 s to first meaningful paint)
- `/jobs/[id]` measured at 5.4 s with a 28 KB response; the first smoke pass
  timed out on a click because of a race between navigation and the network-idle
  wait.
- Users will notice this; they'll click into a job and see blank space.
- Likely cause: a tab (budget / invoices / draws / POs / COs / liens) is doing a
  synchronous fetch before paint. Worth a Server Component audit + `fetch`
  caching review before dogfood.

### 2. `/invoices/liens` page exposes zero buttons in the rendered DOM
- Probe found `lien_buttons: []` and `lien_has_upload_button: false`.
- Either:
  (a) the page has no upload UI (regression — item #43 in the spec assumes
      bulk lien upload exists), or
  (b) the upload control is conditionally rendered behind a selected-draw /
      selected-invoice state the smoke didn't set.
- **Action:** eyeball the page with Jake/Diane; if there's genuinely no bulk
  upload control, build one before dogfood or Diane will feel it first.

### 3. No seed data for POs or Change Orders
- `/purchase-orders` and `/change-orders` list pages render but show 0 rows.
- This means partial-approval, CO creation, CO-to-budget adjustments, and the
  PCCO Log are entirely unvalidated on real-looking data.
- **Action:** seed 2-3 POs and 1-2 COs on an existing job before dogfood so
  the admin team can exercise those flows.

### 4. Only 2 draws exist; no revisions
- Draw comparison / revision diff (item #35) cannot be tested without a draw
  that has at least 2 revisions of itself.
- **Action:** either (a) seed a draw + revision, or (b) acknowledge revision
  diff is a "future" feature and defer the test.

## MEDIUM — UX rough edges

### 5. List rows navigate via `onClick`, not `<a href>`
- `/invoices`, `/draws`, `/purchase-orders`, `/change-orders` all use row
  `onClick` handlers to navigate to detail pages instead of semantic `<a>`
  links.
- Impact: breaks middle-click "open in new tab", breaks cmd-click, breaks
  keyboard navigation, breaks screen readers, and breaks automated testing (as
  seen here — initial smoke counted 0 detail links on list pages).
- **Action:** wrap row contents in `<Link>` / `<a>` once. Cheap fix, large
  accessibility + testability win.

### 6. Jobs list includes "New Job" button as a sibling of jobs
- Searching for "New" in the jobs list returned the "New Job" create button as
  a "result". Suggests the button is a child of the same container as job
  rows; the search filter is not excluding controls.
- **Action:** separate the create-CTA from the list container, or
  `data-role="action"` and skip during filter.

### 7. Dashboard: API is fast, hydration is not
- `/api/dashboard` consistently returns in 312 ms, but the full dashboard takes
  ~3.3 s to become interactive (avg of 3 navigations). That's hydration +
  client-side data fetches from the KPI cards.
- **Action:** move KPI data into the RSC (Server Component) payload instead of
  a separate client fetch per card. This was partially done in the Phase 10
  perf close-out, but dashboard hydration is still the user-facing bottleneck.

### 8. Console errors on normal navigation
- 15 errors during a read-only smoke walk:
  - 406 errors are almost certainly `.single()` on empty rows — standard
    Supabase footgun, fix by using `.maybeSingle()` or `.limit(1)`.
  - 403 errors suggest RLS is blocking a query that the UI didn't gate.
  - 404s on background resource fetches need to be tracked down — something
    is requesting resources that don't exist.
  - 1× RSC payload fetch fail on vendor detail (Next fell back to browser nav;
    transparent but indicates a server action / route handler that sometimes
    fails).
- **Action:** wire up Sentry (or equivalent) before dogfood. A clean console
  matters when the admins report "it's broken".

## LOW — flags for later, not blockers

### 9. Many write-path tests can only be exercised with real fixtures
- The spec hit a wall around items 20-22, 25-26, 34-35, 40, 52-54 because
  exercising them mutates data (invoice batches, duplicate re-upload, new
  drafts, partial PO approval, team invites, Stripe portal).
- **Action:** build a "smoke fixture" script that creates a throwaway job +
  3 invoices + 1 draft draw + 1 PO inside a test org, runs the write flows,
  then soft-deletes. This gives true end-to-end coverage next pass.

### 10. No obvious keyboard-shortcut documentation
- `?` opened a help overlay (item #56 PASS), but the scope of what's bound
  wasn't validated. If the team is going to rely on shortcuts, a
  discoverability pass is worth it.

### 11. Mobile at 375px works, but `/invoices/qa` is cramped
- Screenshots `60-mobile-dashboard.png` and `60-mobile-qa.png` show no
  horizontal overflow, but the QA queue table is tight. PMs reviewing on
  phones will pinch-zoom.
- **Action:** card-style layout at < 640 px for QA queue rows.

## Not Exercised (for next smoke pass)

- Actual forgot-password email send
- Claude API invoice parse (needs API key + fixture)
- Stripe portal redirect (needs subscribed org)
- Team invite email send (needs SMTP)
- Any `.pdf` / `.xlsx` download assertion
