# Nightwork Navigation Reorganization Plan

**Created:** 2026-04-17
**Status:** Approved, not yet executed
**Source inventory:** docs/NAV_INVENTORY.md

## Philosophy

Nightwork's navigation is designed for two truths:

1. **Nightwork is a platform, not a single-purpose app.** Top-level
   nav reflects functional domains that scale as features are added.
2. **Construction GCs think in jobs.** When doing job-scoped work,
   the job context should be visually present and switchable
   without losing state.

The architecture combines **domain-level top nav** for cross-job
views with **job-scoped sidebar** when working inside a job.

## Top-Level Navigation

**5 entries:**
Dashboard | Jobs | Financial | Operations | Admin

- **Dashboard** — cross-domain snapshot. Role-aware: owner sees
  all jobs; PMs see their jobs only.
- **Jobs** — job list (role-filtered); selecting a job opens
  job detail with sidebar active.
- **Financial** — cross-job financial views (invoices, draws,
  payments, aging, liens).
- **Operations** — placeholder for future (scheduling, site
  activity, PM workload). Ships disabled / "Coming Soon" in nav.
- **Admin** — settings, vendors, system tools.

## Job-Scoped Sidebar

### When it appears
- On `/jobs` list page -> sidebar with full job list
- On any `/jobs/[id]/*` route -> sidebar with selected job expanded
- On `/operations/*` (future) -> sidebar active (operations are
  job-scoped)

### When it DOES NOT appear
- On Dashboard, Financial, Admin — these are cross-job by nature
- On auth pages, onboarding, pricing

### Role-based content
- **Owner / Admin:** sees all active jobs in the org
- **PM:** sees only jobs where `jobs.pm_id = user.id`
- **Accounting (if role exists):** sees all active jobs

### Sidebar structure

**Top section:**
- "+ New Job" button (admin/owner only)
- Filter pill: "My Jobs" / "All Jobs" toggle (PMs default to My;
  owner defaults to All)
- Search box (filters the list below by name or address)
- Sort dropdown: alphabetical / status / recent activity

**Selected job section (when on `/jobs/[id]/*`):**
- Job name + status pill (Open / Closing / Closed)
- Client/owner name
- Address
- Quick action icons (email client, view on maps)

**List section:**
- "All N Open Jobs" link at top of list
- Alphabetical list of remaining jobs
- Hover -> preview card with address and status

### Data queries

No schema changes needed. Existing `jobs.pm_id` and `org_members.role`
are sufficient.

```sql
-- Owner / admin
SELECT id, name, status, address
FROM jobs
WHERE org_id = :org_id AND deleted_at IS NULL
ORDER BY :sort

-- PM
SELECT id, name, status, address
FROM jobs
WHERE org_id = :org_id
  AND pm_id = :user_id
  AND deleted_at IS NULL
ORDER BY :sort
```

### Cross-job context preservation

When switching jobs via the sidebar:
- Stay on the same tab if possible (Dewberry Budget -> Markgraf ->
  land on Markgraf Budget)
- If the current tab doesn't exist on the target job, fall back
  to Overview

## Job Detail Tabs

**6 tabs** (reduced from 8):
Overview | Budget & Costs | Invoices | Draws | Change Orders | Activity

- **Budget & Costs** absorbs: Budget + Purchase Orders + Internal
  Billings
- **Draws** absorbs Lien Releases
- **Activity** is new (audit logs, status history, change
  notifications) — placeholder for future
- **Overview, Invoices, Change Orders** stay as-is

## Financial Section

Single route `/financial` with view filters:
/financial                       -> default: invoices, active
/financial?view=queue            -> awaiting approval (role-filtered)
/financial?view=qa               -> QA review (role-filtered)
/financial?view=payments         -> payments/batching
/financial?view=draws            -> cross-job draws
/financial?view=aging            -> aging report
/financial?view=liens            -> cross-job lien releases

**Role filtering:**
- Owner / admin sees all invoices/draws across all jobs
- PM sees only invoices/draws on jobs where pm_id = user.id

### Routes that die (moved to view filters)
- `/invoices` -> `/financial`
- `/invoices/queue` -> `/financial?view=queue`
- `/invoices/qa` -> `/financial?view=qa`
- `/invoices/payments` -> `/financial?view=payments`
- `/invoices/liens` -> `/financial?view=liens`
- `/financials` -> `/financial`
- `/financials/aging-report` -> `/financial?view=aging`
- `/draws` -> `/financial?view=draws`

### Routes that become modals/buttons
- `/invoices/upload` -> "Upload Invoice" button on /financial
- `/invoices/import` -> "Import CSV" button on /financial
- `/draws/new` -> "New Draw" button on /financial?view=draws

### Routes that stay (deep-link destinations)
- `/invoices/[id]` — individual invoice detail (deep-linked from
  email, notifications)
- `/draws/[id]` — individual draw detail (same reason)

## Admin Section

3-group sidebar layout at `/admin`:
SETTINGS
├── Company
├── Team
├── Financial Defaults
├── Cost Codes
├── Internal Billings
├── Workflow
├── Usage
└── Billing
REFERENCE DATA
└── Vendors
SYSTEM
└── Admin Tools

### Changes from current
- Settings becomes a grouped sidebar, not a flat tab bar
- Vendors promoted from buried route to Admin section
- Admin tools separated from Settings group

### Action pages that die
- `/settings/cost-codes/import` -> button on Cost Codes page
- `/vendors/import` -> button on Vendors page

### Routes that move
- `/settings/company` -> `/admin/settings/company`
- `/settings/team` -> `/admin/settings/team`
- (and so on for all settings subsections)
- `/vendors` -> `/admin/vendors`
- `/vendors/[id]` -> `/admin/vendors/[id]`

## Dead/Orphan Routes — DELETE

- `/purchase-orders` (global cross-job PO list) — unused, no nav
  entry. POs managed in job context only.
- `/change-orders/[id]` — investigate whether it's ever linked
  from outside job context. If not, delete. If yes, keep as
  deep-link destination only.

## Action Pages — DIE

| Current route | Becomes | Notes |
|---|---|---|
| /invoices/upload | Button on /financial | Upload modal |
| /invoices/import | Button on /financial | CSV import modal |
| /vendors/import | Button on /admin/vendors | CSV import modal |
| /settings/cost-codes/import | Button on Cost Codes page | CSV import modal |
| /jobs/[id]/purchase-orders/new | Button on Budget & Costs tab | New PO modal |
| /jobs/[id]/purchase-orders/import | Button on Budget & Costs tab | PO import modal |
| /jobs/[id]/change-orders/new | Button on Change Orders tab | New CO modal |
| /draws/new | Button on /financial?view=draws | New draw modal |

## Modal Audit (no changes in Phase 1 of reorg)

All 12 existing modals reviewed. Keep as-is for Phase 1. Flag for
future review:
- Draw Comparison View -> candidate for real route (deep-linkable)
- Budget Drill-Down Slide-Out -> evaluate usage patterns before
  converting to sub-route

## Future Placement Guide

When adding new features:

### Does it belong at top level?
Yes only if ALL of:
- Accessed daily by the primary operator
- Not a sub-concept of an existing domain
- Has >=3 sub-views that warrant grouping

### Does it belong under an existing domain?
- **Financial:** money movement, AR/AP, budgets, draws, invoices,
  reports, QuickBooks, bookkeeping
- **Operations:** job execution, scheduling, site activity, QC,
  closeout, PM workload (activates when features exist)
- **Admin:** configured once and rarely touched — settings,
  integrations, team, reference data

### Does it belong as a job-detail tab?
- Specific to a single job
- Current 6 tabs don't absorb it naturally
- Accessed on most jobs, not edge cases

### Otherwise
It's a button/modal/inline action, not a new page.

## Migration Strategy

### Phase 1 — Top nav restructure
- Change from current 5-entry nav (Dashboard, Jobs, Invoices
  dropdown, Financials dropdown, Settings) to new 5-entry nav
  (Dashboard, Jobs, Financial, Operations-disabled, Admin)
- Add Operations as disabled/"Coming Soon" placeholder

### Phase 2 — Financial consolidation
- Build `/financial` route with view filter param
- Migrate current /invoices/* and /financials/* routes under it
- Add 301 redirects from old URLs
- Convert action pages (upload, import) to modals

### Phase 3 — Admin consolidation
- Build `/admin` route with grouped sidebar
- Move /settings/* to /admin/settings/*
- Promote /vendors to /admin/vendors
- Convert action pages to modals

### Phase 4 — Job-scoped sidebar
- Build sidebar component
- Role-aware population (owner/admin/PM)
- Job switcher preserves current tab when possible
- Only renders on job-scoped routes

### Phase 5 — Job detail tabs
- Merge 3 tabs into Budget & Costs
- Merge Lien Releases into Draws
- Add Activity tab (placeholder)

### Phase 6 — Cleanup
- Delete orphan routes
- Remove dead action-page routes
- Audit for any missed redirects
- Verify all deep-links still resolve

## Deep-link Preservation

301 redirects for 6 months minimum:

- `/invoices/*` -> `/financial?view=*`
- `/financials/*` -> `/financial?view=*`
- `/settings/*` -> `/admin/settings/*`
- `/vendors/*` -> `/admin/vendors/*`
- `/draws` -> `/financial?view=draws`

## Out of Scope for This Reorg

- Dashboard widget redesign
- Mobile-specific navigation (defer to responsive design phase)
- Search functionality beyond sidebar-job search (defer to
  post-reorg enhancement)
- Keyboard shortcut updates beyond existing list
- Multi-PM-per-job data model (current `jobs.pm_id` is sufficient
  for MVP)
- Command palette (Cmd+K) — deferred to future enhancement
  once sidebar pattern is validated
- Any data model / schema changes

## Route Count Summary

- **Before:** 49 routes (47 + 2 orphans)
- **After:** ~28 routes
- **Net:** ~21 routes eliminated or consolidated

## Resolved Decisions

1. **`/change-orders/[id]`** — KEEP as deep-link destination.
   Required for email notifications, external shares, and future
   Slack/SMS integrations. Add breadcrumb showing job context
   (e.g. "Dewberry > Change Orders > PCCO #17") so users aren't
   disoriented when deep-linked.

2. **Sidebar collapse** — YES, support collapse. Big tables (G703,
   budget) benefit from extra width. Collapse state persists per
   user (localStorage or user preference).

3. **Sidebar width** — 220px (match Buildertrend default).

4. **"Operations" label** — KEEP as "Operations" for the placeholder.
   Rename at time of first real feature being built into this
   domain.

## Testing Requirements

Before declaring the reorg complete:
- Test sidebar with multiple jobs (seed test data if needed —
  currently only 1 job exists in dev)
- Test PM role sidebar filtering (requires a non-owner PM user
  assigned to some jobs and not others)
- Test all 301 redirects manually
- Test deep-link destinations still resolve (e.g. email links
  to specific invoices)
- Test mobile responsiveness of sidebar (collapse behavior)

## Post-Execution Notes (2026-04-17)

All 6 phases shipped in a single session. Implementation decisions
that diverged from or refined the original plan:

### Phase 1 — Top Nav
- Shipped as planned. Operations disabled with "SOON" badge.

### Phase 2 — Financial Consolidation
- /financial?view=X uses server-side redirect to canonical URLs
  (e.g. /financial?view=draws -> /draws) rather than rendering
  content inline. Each existing page shows the FinancialViewTabs
  strip for consistent navigation. Single source of truth per view.

### Phase 3 — Admin Consolidation
- Settings layout.tsx was the natural place to inject the sidebar
  (wraps all /settings/* pages). /vendors page wrapped separately
  since it's outside the /settings tree.
- AdminMobileNav (horizontal scrollable strip) replaces the
  sidebar below md breakpoint.

### Phase 4 — Job-Scoped Sidebar
- All 14 job page files had NavBar removed (moved to jobs/layout.tsx).
- 14 test jobs seeded to dev DB for representative data.
- My/All toggle hidden for non-PM roles (owner/admin always see all).
- Sidebar fetches all jobs client-side, filters in useMemo (see F-012).
- Mobile: sidebar hidden below md breakpoint (see F-013 for
  planned drawer).

### Phase 5 — Job Detail Tabs
- Budget & Costs sub-tabs use separate URLs (/budget, /purchase-orders,
  /internal-billings) with a BudgetCostsSubTabs component, not
  ?section= query params. Each page still lives at its original URL
  but shows the parent "Budget & Costs" main tab as active.
- Same pattern for Draws + Lien Releases via DrawsSubTabs.
- Activity tab is a placeholder at /jobs/[id]/activity.

### Phase 6 — Cleanup
- Deleted: settings-tabs.tsx, /purchase-orders (global orphan route).
- /change-orders/[id] kept as deep-link destination per resolved decision.
- All redirect chains verified working end-to-end.
- F-012 and F-013 filed as deferred findings.

### Route Count (Actual)
- Before: 49 routes
- After: ~46 routes (3 deleted: /purchase-orders, /purchase-orders/[id],
  settings-tabs component). 3 new routes added (/financial, /operations,
  /admin, /jobs/[id]/activity). Net: slight reduction with much
  better organization.
