# Nightwork Product Surface Audit

Generated: 2026-04-21 · Audit-only inventory, no code changes.

---

## Summary

Nightwork has **68 page routes** across customer-facing app, settings, platform admin, and cost-intelligence areas. There are roughly **30 tabs** spread across 7 tab groups, **6 dedicated modal components** plus several inline overlays/drawers/side panels, and **5 top-level nav entries** (1 direct link + 4 dropdown menus). The app is visibly mid-transition: the nav was restructured around four dropdowns (Financial / Operations / Cost Intelligence / Admin), a new Cost Intelligence area was added, and several old standalone pages were recently consolidated into tabs on a single parent page. That transition left behind **6 broken nav links**, **several duplicate landing/redirect pages**, and **at least 3 orphan pages** (reachable only by direct URL). Complexity is concentrated in three places: the invoice pipeline (upload → queue → QA → payments → draws), the cost intelligence verification flow, and the per-job detail page (which has 6 tabs plus nested sub-tabs). There are **zero automated tests** for any page outside `node_modules`.

---

## Top-Level Navigation

Source of truth: `src/components/nav-bar.tsx`. Desktop renders 5 top-level entries — 1 direct link, 4 dropdowns. Mobile renders the same structure as a collapsible drawer. Role-gating is applied per entry.

### Desktop nav bar

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Nightwork  │ Dashboard │ Financial ▾ │ Operations ▾ │ Cost Intel ▾ │ Admin ▾ │
└─────────────────────────────────────────────────────────────────────────┘
                                                           🔔 🌓 Name [ROLE] Feedback Sign Out
```

| Nav entry | Destination | Access | Notes |
|-----------|-------------|--------|-------|
| Dashboard | `/dashboard` | owner, admin, pm, accounting | Direct link |
| Financial ▾ | dropdown (9 items) | owner, admin, pm, accounting | See below |
| Operations ▾ | dropdown (3 items, all disabled) | owner, admin, pm | Placeholder |
| Cost Intelligence ▾ | dropdown (5 items) | owner, admin, pm, accounting | With count badges on 2 items |
| Admin ▾ | dropdown (4–5 items) | owner, admin | Platform Admin appended for staff |

### Financial dropdown

| Label | href | Page exists? |
|-------|------|---|
| Invoices | `/invoices` | ✅ |
| Queue | `/invoices/queue` | ✅ |
| QA | `/invoices/qa` | ✅ |
| Payments | `/payments` | ❌ **BROKEN** (real page is `/invoices/payments`) |
| Draws | `/draws` | ✅ |
| Aging | `/aging` | ❌ **BROKEN** (real page is `/financials/aging-report`) |
| Liens | `/lien-releases` | ❌ **BROKEN** (real page is `/invoices/liens`) |
| Change Orders | `/change-orders` | ❌ **BROKEN** (only `/change-orders/[id]` exists) |
| Purchase Orders | `/purchase-orders` | ❌ **BROKEN** (page was deleted in last 7 days) |

### Operations dropdown

All three entries are marked `disabled` with a "Soon" pill — pure placeholders.

| Label | Status |
|-------|--------|
| Schedule | Soon (disabled) |
| Daily Logs | Soon (disabled) |
| Selections | Soon (disabled) |

### Cost Intelligence dropdown

| Label | href | Count badge |
|-------|------|---|
| Overview | `/cost-intelligence` | — |
| Items | `/cost-intelligence/items` | — |
| Verification Queue | `/cost-intelligence/verification` | Pending-lines count |
| Cost Lookup | `/cost-intelligence/lookup` | — |
| Unit Conversions | `/cost-intelligence/conversions` | Pending-suggestions count |

### Admin dropdown

| Label | href | Page exists? |
|-------|------|---|
| Settings | `/settings` | ✅ (redirect to `/settings/company`) |
| Team | `/settings/team` | ✅ |
| Integrations | `/settings/integrations` | ❌ **BROKEN** (never created) |
| Billing | `/settings/billing` | ✅ |
| Platform Admin | `/admin/platform` | ✅ (staff only; conditional) |

### User chrome (desktop, right side)

- Notification bell (dropdown with last 10 notifications)
- Theme toggle (light/dark)
- First name + role pill
- Feedback trigger (opens modal)
- Sign Out

### Trial banner (conditional)

`<TrialBanner>` renders below the header for orgs on an active trial.

### Secondary navigations (not in top bar)

- **JobSidebar** (`src/components/job-sidebar.tsx`) — 220 px left rail on every authenticated page except detail-drilldowns, admin, settings, vendors, auth, onboard, and pricing. Shows all jobs with search/sort/filter, selected-job card, and "New Job" button. Replaces what used to be a top-nav "Jobs" link.
- **AdminSidebar** (`src/components/admin-sidebar.tsx`) — 200 px rail inside `/settings/*`. Three groups: Settings (8 items), Reference Data (Vendors), System (Admin Tools). Routes for `/vendors` are only reachable here.
- **PlatformSidebar** (`src/components/admin/platform-sidebar.tsx`) — 220 px rail inside `/admin/platform/*`. 7 entries plus one sub-entry (Impersonation history under Audit log).

---

## Pages by Area

### Auth & marketing (7 pages)

| Route | Purpose | Tabs | Filters | Primary action | Reachability |
|-------|---------|------|---------|----------------|--------------|
| `/` | Landing page; redirects signed-in users to `/dashboard` or `/onboard` | — | — | CTA to `/signup` | Public |
| `/login` | Email/password sign-in | — | — | Submit | Public |
| `/signup` | Trial account creation; reads `?plan=` | — | — | Submit | Public |
| `/forgot-password` | Password-reset request form | — | — | Send reset link | Public |
| `/pricing` | Plan comparison (Trial / Starter / Pro / Enterprise) | — | — | CTA to signup / upgrade | Public + auth |
| `/onboard` | Post-signup org setup wizard | — | — | Save org profile | Auth-only; auto-redirect if incomplete |
| `/nw-test` | **Design-system playground.** Renders every nw/* primitive with light/dark toggle | — | Theme toggle | — | **Orphan** — direct URL only |

### Dashboard & operations (2 pages)

| Route | Purpose | Tabs | Filters | Primary action | Notes |
|-------|---------|------|---------|----------------|-------|
| `/dashboard` | 4 metric cards (active jobs, pending invoices, open draws, payments due) + attention queue + activity feed + cash-flow panel | — | — | Click-through to detail | Top-nav entry |
| `/operations` | **Placeholder.** "Operations features are coming in a future release." | — | — | — | Only page under Operations dropdown that isn't disabled; currently unlinked from nav (Operations dropdown shows 3 Soon items but not `/operations` itself) |

### Jobs area (13 pages)

Job sub-pages share `JobTabs` (6 top tabs) plus two nested sub-tab components:

```
JobTabs: Overview | Budget & Costs | Invoices | Draws | Change Orders | Activity
                    └─ sub-tabs:           └─ sub-tabs:
                       Budget                 Draws
                       Purchase Orders        Lien Releases
                       Internal Billings
```

| Route | Purpose | Tabs / Sub-tabs | Filters | Primary action |
|-------|---------|-----------------|---------|----------------|
| `/jobs` | Admin-only job list; health indicators, budget %, PM, open invoices | — | Search, status, sort | "New Job" |
| `/jobs/new` | Create job form (project / client / contract / PM) | — | — | Create |
| `/jobs/[id]` | Overview tab — editable header, financial bar, cards | JobTabs active = Overview | — | Edit |
| `/jobs/[id]/budget` | Budget line-item grid with drill-down side panel | Tab = Budget & Costs → sub = Budget | Search, status | Drill-down slide-out |
| `/jobs/[id]/purchase-orders` | POs for job | Tab = Budget & Costs → sub = Purchase Orders | Status, vendor | "New PO" / "Import" |
| `/jobs/[id]/purchase-orders/new` | PO create form | — | — | Create |
| `/jobs/[id]/internal-billings` | Internal billing line items | Tab = Budget & Costs → sub = Internal Billings | — | Edit lines |
| `/jobs/[id]/invoices` | Job-scoped invoice list | Tab = Invoices | Status, search | Upload invoice |
| `/jobs/[id]/draws` | Draw history | Tab = Draws → sub = Draws | — | "New Draw" |
| `/jobs/[id]/lien-releases` | Lien releases | Tab = Draws → sub = Lien Releases | Status, vendor | "New Lien Release" |
| `/jobs/[id]/change-orders` | PCCO log | Tab = Change Orders | Search, status | "New CO" |
| `/jobs/[id]/change-orders/new` | CO create form (reads `?fromInvoice=`) | — | — | Create |
| `/jobs/[id]/activity` | Activity timeline for this job | Tab = Activity | User, entity, date | — |

### Invoices area (7 pages)

| Route | Purpose | Tabs | Filters | Primary action |
|-------|---------|------|---------|----------------|
| `/invoices` | Master invoice list across jobs; stat cards + detailed table | — | Confidence, amount, status (14-value multi), vendor, date, sort (6 fields) | "Upload Invoices" (opens modal) |
| `/invoices/queue` | PM approval inbox with keyboard nav, confidence colors, aging | — | Confidence, missing-fields pills, age | Approve / deny / hold (keyboard) |
| `/invoices/qa` | QA review inbox | — | Status, vendor, job, date | — |
| `/invoices/[id]` | Full invoice review: file preview + editable fields + budget context + line items + status timeline | — | — | Edit / approve / deny / hold / split / mark paid / void |
| `/invoices/[id]/qa` | QA variant of invoice review with kick-back to PM | — | — | Approve / kick-back |
| `/invoices/payments` | Payment tracking with aging buckets and batch-pay-by-vendor | 3 tabs: Tracking / Batch / Aging | Status, job, vendor, date | Bulk mark paid / schedule |
| `/invoices/liens` | Cross-job lien release management | — | Job, vendor, status | Upload lien |

### Draws / change orders / vendors / financial (9 pages)

| Route | Purpose | Tabs | Filters | Primary action |
|-------|---------|------|---------|----------------|
| `/draws` | All draws grouped by job | — | Job, status, search | "New Draw" |
| `/draws/new` | Draw-creation wizard (job / period / invoices / preview) | — | — | Create |
| `/draws/[id]` | Draw detail (G702, G703, CO log, lien upload, cover letter, comparison, PDF export) | — | — | Submit / approve / pay / void / revise |
| `/change-orders/[id]` | CO detail | — | — | Approve / deny / execute / void |
| `/vendors` | Vendor directory | — | Search, sort | Import / merge / edit |
| `/vendors/[id]` | Vendor detail with invoice history | — | — | Edit / mark inactive |
| `/financial` | **Redirect router.** Maps `?view=invoices\|queue\|qa\|payments\|draws\|aging\|liens` to canonical pages | — | — | — |
| `/financials` | **Redirect → `/financial`** (duplicate wrapper) | — | — | — |
| `/financials/aging-report` | Aging report placeholder | — | — | — |

### Settings (10 pages)

Shared `AdminSidebar` on all pages. 3 groups: Settings, Reference Data, System.

| Route | Purpose | Visibility | Notes |
|-------|---------|-----------|-------|
| `/settings` | Redirect → `/settings/company` | owner, admin | — |
| `/settings/company` | Org profile (name, logo, brand, address, contact) | all roles | — |
| `/settings/team` | Members + invites; role assignment | owner, admin | — |
| `/settings/financial` | Default GC fee / deposit / payment schedule | all roles | — |
| `/settings/workflow` | Invoice workflow + draw cover-letter template | owner, admin, accounting | — |
| `/settings/cost-codes` | Cost code CRUD + CSV import | all roles | — |
| `/settings/internal-billings` | Internal billing type definitions | owner, admin | — |
| `/settings/usage` | AI usage & token cost tracking | owner, admin | — |
| `/settings/admin` | "Admin Tools" — full activity/audit log | owner, admin | — |
| `/settings/billing` | Stripe plan, card on file, upgrade / downgrade | owner, admin | — |

### Cost Intelligence (7 pages)

| Route | Purpose | Tabs | Filters | Primary action |
|-------|---------|------|---------|----------------|
| `/cost-intelligence` | Hub with KPIs + "Needs attention" + grouped browse | — | Group toggle: By Category / Vendor / Job | Navigate to queues |
| `/cost-intelligence/items` | Searchable canonical-item catalog | — | Search, verification-status (3) | Drill to detail |
| `/cost-intelligence/items/[id]` | Single item: vendors, pricing, aliases, conversions, job usage | — | — | Approve conversions / edit |
| `/cost-intelligence/verification` | Line-verification queue with detail drawer | **6 tabs** partitioned by `line_nature`: Materials · Labor · Scope · Equipment · Services · Review (default Materials) | Optional `?invoice_id=` | Approve / reject / reclassify |
| `/cost-intelligence/lookup` | Per-item vendor price comparison | — | Search | Browse |
| `/cost-intelligence/conversions` | AI-suggested unit-conversion approval queue | — | Status, item | Confirm / reject / edit ratio |
| `/cost-intelligence/scope-data` | Scope-size enrichment form (for $/metric calcs) | — | Status, vendor, job | Save scope size |

### Platform admin (13 pages)

Sidebar: Overview · Organizations · Users · Support · Feedback · Cost Intelligence · Audit · Impersonation history.

| Route | Purpose | Tabs | Filters | Primary action |
|-------|---------|------|---------|----------------|
| `/admin` | Redirect → `/settings/company` (surprising!) | — | — | — |
| `/admin/platform` | Staff overview: KPIs + recent signups | — | — | View |
| `/admin/platform/organizations` | Cross-tenant org list | — | Name, status | Impersonate / view |
| `/admin/platform/organizations/[id]` | Org detail: members, activity, subscription | — | — | Extend trial / mark churned / reset password / impersonate |
| `/admin/platform/users` | Cross-tenant user registry | — | Email/name search | View detail |
| `/admin/platform/users/[id]` | User detail with memberships | — | — | Reset password / impersonate |
| `/admin/platform/support` | Escalated AI support conversation inbox | — | Org, status (4), date (3), Apply/Reset | View thread |
| `/admin/platform/support/[id]` | Single conversation thread | — | — | Respond / resolve |
| `/admin/platform/feedback` | Product feedback inbox | — | Search, org, category (4), severity (3), status (6), date range | View detail |
| `/admin/platform/feedback/[id]` | Single feedback item | — | — | Review / resolve |
| `/admin/platform/cost-intelligence` | Cross-tenant cost-intel ops dashboard | **6 tabs**: Items · Pricing · Extractions · Classifications · Conversions · Bootstrap | None per tab | Bootstrap new items; view detail |
| `/admin/platform/items/[id]` | Single canonical-item inspection (aliases + pricing) | — | — | View only |
| `/admin/platform/audit` | Immutable staff-action audit log | — | Admin, action, since-date | CSV export |

---

## Tabs Within Pages

| Page | Tabs | Default | Filters partition or visual-only? |
|------|------|---------|-----------------------------------|
| `/jobs/[id]` (all sub-routes) | Overview · Budget & Costs · Invoices · Draws · Change Orders · Activity (6) | Overview | Route-based (partitioned content) |
| `/jobs/[id]/budget` · `/purchase-orders` · `/internal-billings` | Budget · Purchase Orders · Internal Billings (3 sub-tabs) | Budget | Route-based |
| `/jobs/[id]/draws` · `/lien-releases` | Draws · Lien Releases (2 sub-tabs) | Draws | Route-based |
| `/invoices/payments` | Tracking · Batch · Aging (3) | Tracking | UI state |
| `/cost-intelligence/verification` | Materials · Labor · Scope · Equipment · Services · Review (6) | Materials | Filter (by `line_nature`) |
| `/admin/platform/cost-intelligence` | Items · Pricing · Extractions · Classifications · Conversions · Bootstrap (6) | Items | Filter (by data entity) |

**Total tab groups:** 6 · **Total individual tabs:** 26.

Note: prior to the last 7 days, the platform-admin cost-intelligence tabs each had their own standalone page (`/admin/platform/classifications`, `/extractions`, `/pricing`, `/items`). Those were consolidated into this single page with 6 tabs — the consolidation is evident in recent git history.

---

## Modals and Dialogs

| Component | File | Trigger | Content | Could be inline? |
|-----------|------|---------|---------|------------------|
| InvoiceUploadModal | `src/components/invoice-upload-modal.tsx` | "Upload Invoices" button | Drop zone + parsed-data preview side-by-side | No — full-viewport side-by-side |
| InvoiceImportModal | `src/components/invoice-import-modal.tsx` | "Import" button | CSV/batch multi-step import | No — multi-step wizard |
| POImportModal | `src/components/po-import-modal.tsx` | Job PO list "Import" | CSV import scoped to a job | No — wizard |
| VendorImportModal | `src/components/vendor-import-modal.tsx` | Vendors list "Import" | Vendor CSV import | No — wizard |
| FeedbackModal | `src/components/feedback-modal.tsx` | Nav "Feedback" trigger (any page) | Feedback form + browser/OS metadata | Maybe — could be a dedicated `/feedback` page, but nav placement keeps it global |
| ReasonModal (admin) | `src/components/admin/reason-modal.tsx` | Every cross-tenant staff action (impersonate, extend trial, etc.) | Required reason text, blocks submit | No — compliance/audit control |
| KeyboardShortcutsModal | `src/components/keyboard-shortcuts.tsx` | `?` key global | Shortcut reference | No — global help |
| NotificationBell dropdown | `src/components/notification-bell.tsx` | Bell icon | Last 10 notifications | No — header menu |
| PDF expanded viewer | `src/components/pdf-renderer.tsx` | "Expand" on inline PDF | Full-viewport PDF + zoom controls | No — viewer |
| Image zoom overlay | `src/components/invoice-file-preview.tsx` | Click on image preview | Full-screen image | Arguably — click-to-zoom in page could work |
| Payment batch-by-vendor panel | `src/components/payment-batch-by-vendor-panel.tsx` | "Batch Pay" on `/invoices/payments` | Grouped vendors + bulk-check entry | Maybe — could be an inline section on the Batch tab |
| Vendor contact popover | `src/components/vendor-contact-popover.tsx` | Vendor name hover/click | Phone, email, address + "View vendor" | Yes — tooltip-ish, could be pure hover card |
| Budget drill-down slide-out | `src/components/budget-drill-down.tsx` + `slide-out-panel.tsx` | Click budget line on `/jobs/[id]/budget` | POs + invoices for that cost code | Possibly — drill-down details could expand inline as a row-accordion |
| Verification detail panel | `src/components/verification-detail-panel.tsx` | Click row on `/cost-intelligence/verification` | Invoice PDF + line classifier + BOM + scope-split | No on desktop — needs reading surface; mobile it's the whole screen |
| Getting-started checklist | `src/components/getting-started-checklist.tsx` | Auto-shown on dashboard for new admins | 6-step onboarding | Inline — it already is |
| Draw cover-letter editor | `src/components/draw-cover-letter-editor.tsx` | Expand on draw detail | Rich text template editor | Already inline |
| Draw comparison view | `src/components/draw-compare-view.tsx` | Expand on draw detail | Prior vs current draw diff | Already inline |
| Impersonate dialog | `src/components/admin/impersonate-button.tsx` | "Impersonate" on org or user detail | Reason + confirm | No — compliance |
| Lien release upload | inline in `/jobs/[id]/lien-releases` | "Upload" button | File upload form | Possibly inline row |
| Invoice approve/deny/hold confirms | inline in `/invoices/[id]` and `/invoices/queue` | Action buttons | Confirmation text | Already lightweight; could drop for fast-path flows |

**Dedicated modal components:** 6. **Inline overlays / drawers / popovers:** ~14. Total modal-ish surfaces: ~20.

---

## Duplication Findings

### Obvious duplicates

1. **`/financial` vs `/financials`.** `/financials` is a 1-line redirect to `/financial`; `/financial` is a 20-line redirect router. Either drop `/financials` or collapse both into one path. The `?view=` router is only useful if something still links via it — the nav itself links directly to canonical pages, so the redirect router may be vestigial.
2. **`/admin` redirects to `/settings/company`** (not `/admin/platform`). Surprising — for a staff user typing `/admin`, the natural expectation is the staff tools, not settings. This is a leftover from when settings were namespaced under `/admin`.
3. **`/settings/admin` "Admin Tools" vs `/admin/platform/audit`.** Both show audit/activity logs with different scope (org vs platform). Naming is needlessly ambiguous.
4. **Per-job vs global listing pairs** — these are *intentional* duplicates but worth naming:
   - `/invoices` (all-org) and `/jobs/[id]/invoices` (job-scoped)
   - `/draws` (all-org) and `/jobs/[id]/draws` (job-scoped)
   - `/change-orders/[id]` (global detail) and `/jobs/[id]/change-orders` (job-scoped list)
   - `/invoices/liens` (cross-job) and `/jobs/[id]/lien-releases` (job-scoped)
5. **Cost intelligence customer-facing vs platform-admin views.**
   - `/cost-intelligence/items` (org-scoped) vs `/admin/platform/cost-intelligence` Items tab (cross-org)
   - `/cost-intelligence/verification` (org) vs `/admin/platform/cost-intelligence` Extractions tab (cross-org)
   - `/cost-intelligence/conversions` (org) vs `/admin/platform/cost-intelligence` Conversions tab (cross-org)
   These serve different audiences (tenant user vs Ross Built operator), but the staff view duplicates significant UI.
6. **`/admin/platform/items/[id]` vs `/cost-intelligence/items/[id]`** — two different item detail pages. The platform variant is read-only with aliases + pricing; the customer variant is a richer canonical item view.

### Consolidations already in flight (last 7 days)

Nine pages were deleted from `src/app/` in the last week as consolidations landed. They are worth knowing about so we don't reintroduce them:

- `src/app/admin/platform/classifications/page.tsx` → tab on `/admin/platform/cost-intelligence`
- `src/app/admin/platform/extractions/page.tsx` → tab
- `src/app/admin/platform/items/page.tsx` → tab
- `src/app/admin/platform/pricing/page.tsx` → tab
- `src/app/items/page.tsx` → `/cost-intelligence/items`
- `src/app/purchase-orders/page.tsx` and `/[id]/page.tsx` → no replacement (only per-job POs remain)
- `src/app/jobs/[id]/purchase-orders/import/page.tsx` → `POImportModal`
- `src/app/settings/cost-codes/import/page.tsx` → removed
- `src/app/invoices/import/page.tsx` and `/invoices/upload/page.tsx` → `InvoiceImportModal` and `InvoiceUploadModal`

This is a strong pattern: standalone pages converted into tabs or modals on an existing page. Worth continuing for the remaining overlaps listed above.

### Tabs that could merge

- **Invoice Queue vs QA Queue.** They are sibling inboxes for the same review pipeline (PM → QA). On mobile these are easy to confuse. Could become one page with a role-gated tab, or with a status filter.
- **Cost Intelligence verification tabs (6) and platform-admin Extractions tab.** The customer tabs partition by `line_nature`; the staff tab shows the same extraction events. The staff view could reuse the customer component in a cross-tenant mode.
- **Settings "Financial" + "Internal Billings"** are both configuration of cost inputs. Could collapse into one "Costs" page with sections.

---

## Dead or Unused Surfaces

### Broken nav links (404 if clicked)

- `/payments` (Financial ▾ → Payments)
- `/aging` (Financial ▾ → Aging)
- `/lien-releases` (Financial ▾ → Liens)
- `/change-orders` (Financial ▾ → Change Orders)
- `/purchase-orders` (Financial ▾ → Purchase Orders; page deleted 2026-04-20)
- `/settings/integrations` (Admin ▾ → Integrations)

All 6 are in the top nav today. These are the fastest wins — either point them to the real page or remove the entry.

### Placeholder pages

- `/operations` — "Operations features are coming in a future release." Linked from nowhere useful (the Operations dropdown shows 3 `Soon` items, not `/operations` itself). Could be deleted entirely until a real Operations surface ships.
- `/financials/aging-report` — flagged by earlier inventory as a placeholder. Re-verify; if empty, drop.
- Operations dropdown (Schedule / Daily Logs / Selections) — all disabled with "Soon" pill. Occupies a top-level nav slot for a feature that doesn't exist. Strong candidate to remove from the nav bar until one of those actually ships.

### Unreachable / direct-URL-only pages

- `/nw-test` — explicitly a dev playground ("NOT linked from any nav — direct URL only"). Fine to keep but ship-blocked from prod nav.
- `/admin/platform/items/[id]` — detail page with no list counterpart in the platform sidebar; reachable only from links inside `/admin/platform/cost-intelligence` Items tab.
- `/jobs/new` — reachable only from the "New Job" button on `/jobs` and inside the JobSidebar. Fine as-is.
- `/draws/new` — reachable from the "New Draw" button on `/draws`. Fine.

### Redirect-only pages

- `/` (when signed in) → `/dashboard` or `/onboard`
- `/settings` → `/settings/company`
- `/admin` → `/settings/company` (questionable destination — see Duplication)
- `/financial` → canonical page based on `?view=`
- `/financials` → `/financial`

### No tests

No `*.test.ts` or `*.spec.ts` outside `node_modules`. Simplification decisions have no safety net from automated regression.

---

## Complexity Hotspots

Ranked by visible/interactive density — these are the pages a simplification effort should weigh carefully.

1. **`/invoices` master list.** 6 filters (confidence, amount range, 14-value status multi-select, vendor, date, sort) + stat cards + search + batch-select actions. Single densest filter bar in the app.
2. **`/invoices/[id]` detail.** Side-by-side file preview + editable fields + cost code/PO mapping + budget context + split-job controls + line items + status timeline + 6+ action buttons.
3. **`/cost-intelligence/verification`.** 6 tabs partitioning by line nature + right-side detail drawer containing invoice PDF + classifier + BOM + scope-split + bulk approve. Heavy state across tabs.
4. **`/draws/[id]`.** G702 form + G703 line items + cover letter editor + lien release uploads + internal billings section + CO log + comparison view + PDF export + 5 status actions.
5. **`/admin/platform/cost-intelligence`.** 6 tabs cross-tenant. Each tab is its own mini-dashboard; recent consolidation already pulled these from 4 separate pages, so density here is the cost of that consolidation.
6. **`/jobs/[id]` sub-routes.** 6 top tabs + two nested sub-tab groups. The 3-level hierarchy (top-nav → job tab → sub-tab) is the deepest nav structure in the app.
7. **`/invoices/queue`.** Keyboard navigation (j/k/a/d), confidence filter, missing-fields pill stack, aging, approve/deny on each row, bulk-approve. High cognitive density per row.
8. **`/admin/platform/feedback`.** 6 filters (search + org + category + severity + status + date range) + Apply/Reset.

---

## Orphan Pages (not reachable from any nav)

| Page | Reachable via | Recommendation |
|------|---------------|----------------|
| `/nw-test` | Direct URL only | Keep (dev-only). Consider moving out of `src/app/` into a docs surface. |
| `/operations` | Not linked (Operations dropdown items are all `Soon` placeholders, none point here) | Delete until a real Operations page exists. |
| `/admin/platform/items/[id]` | Links from `/admin/platform/cost-intelligence` Items tab | Either add a list page, or treat the cost-intel tab as the entry point (status quo). |
| `/jobs` | JobSidebar "All X Jobs" link + dashboard metric card; **not in top nav** | Fine — accessible via sidebar. But worth noting Jobs has no top-nav entry, making discovery hit-or-miss for new users. |
| `/vendors` / `/vendors/[id]` | AdminSidebar "Reference Data" section only | Fine — but vendors are a core concept; this deep placement is surprising. Consider moving into a more visible location or adding to the Financial dropdown. |
| `/pricing` | Public header + `/settings/billing` link | Fine. |
| `/financials/aging-report` | `/financial?view=aging` redirect + nav `/aging` broken link | Unclear who actually reaches it today. |

---

## Usage Signals

### Git activity — last 7 days (2026-04-14 → 2026-04-21)

| Area | `page.tsx` files modified |
|------|---|
| cost-intelligence (customer-facing) | 7 / 7 — **every page touched** |
| admin/platform | 12 / 13 (incl. deletes for tab consolidation) |
| invoices | 6 / 7 |
| jobs | 1 (activity only) |
| draws | 3 / 3 |
| settings | ~2 |
| financial/financials | 3 (redirect housekeeping) |
| dashboard | 1 |

**All recent work is concentrated in Cost Intelligence + Platform Admin.** Invoices saw maintenance; Jobs saw minimal change; Settings and Dashboard were essentially static.

### Recently deleted pages (last 7 days)

9 page deletions (see Duplication Findings → Consolidations in flight). This is the **dominant pattern of active simplification** already happening.

### Test coverage

**Zero.** No `*.test.ts` or `*.spec.ts` outside `node_modules`. Every page is untested by automation — UI correctness depends on manual + Chrome DevTools validation per CLAUDE.md rules.

### Pages likely stale (> 60 days since edit, by inference)

- `/settings/admin` — no behavior changes beyond activity log fetch since Phase 1
- `/jobs/[id]/activity` — minimal recent activity
- `/invoices/[id]/qa` — last meaningful touch was the initial QA flow build

### Placeholder / stub pages (feature status)

- `/operations` — explicit "coming soon" copy
- `/financials/aging-report` — reported as placeholder in prior inventory; worth a re-read before cutting
- `/nw-test` — dev-only, not shipped

---

## Take-aways for Simplification

These are the opinionated observations the audit surfaces. Not prescriptions — decision inputs.

1. **The nav bar has 6 broken links and 3 disabled placeholders.** The Operations dropdown is 100 % placeholders. Fastest possible win: prune them. The nav will feel meaningfully lighter just from removing cruft.
2. **Jobs has no top-nav entry.** It's accessible via the JobSidebar's "All X Jobs" link and the dashboard. This is a deliberate choice (the sidebar is the entry point for per-job work) but means first-time users will not find the job list from the header.
3. **Vendors is buried under Admin → Reference Data.** For a cost-plus builder, vendors are first-class. Consider promoting them into the Financial dropdown.
4. **The `/admin` → `/settings/company` redirect is a trap** for staff typing the URL. Point `/admin` at `/admin/platform` instead, or deprecate it.
5. **Cost Intelligence is already the most-polished area** (every page modified in the last week; the platform-admin view consolidated 4 pages into 6 tabs). Do not treat it as the primary simplification target — it is currently *the* working example of consolidation.
6. **The invoice pipeline has the densest UI in the product** (`/invoices`, `/invoices/queue`, `/invoices/[id]`). It is also the most load-bearing — any simplification here carries the highest risk. Treat filter/column reduction as a separate track from structural consolidation.
7. **Near-duplicate pairs worth considering merging:** `/invoices/qa` + `/invoices/queue` (one inbox with a role-gated tab), `/settings/financial` + `/settings/internal-billings` (one "Costs" page), `/financial` + `/financials` (kill one).
8. **No tests = all simplification is done with the eyes.** The audit's findings should be verified manually when acted on; there is no regression net.
