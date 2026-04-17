# Nightwork Navigation Inventory

Generated: 2026-04-17

---

## 1. Top-Level Nav Entries

Source: `src/components/nav-bar.tsx`

The global nav bar renders five top-level items (two of which are dropdown menus). Visibility is role-gated.

### Dashboard
- **Path:** `/`
- **Purpose:** Home screen with metrics, attention queue, activity feed, and cash flow summary
- **Accessed from:** Always visible in nav bar; logo also links here
- **Visibility:** owner, admin, pm, accounting

### Jobs
- **Path:** `/jobs`
- **Purpose:** List of all jobs with health indicators, budget status, and PM assignments
- **Accessed from:** Nav bar (direct link)
- **Visibility:** owner, admin

### Invoices (dropdown)
- **Purpose:** Dropdown menu grouping all invoice-related screens
- **Visibility:** owner, admin, pm, accounting (individual sub-items have their own gates)

Sub-items:

| Label | Path | Visibility |
|-------|------|------------|
| All Invoices | `/invoices` | owner, admin, pm, accounting |
| PM Queue | `/invoices/queue` | owner, admin, pm |
| Accounting QA | `/invoices/qa` | owner, admin, accounting |
| Upload Invoice | `/invoices/upload` | owner, admin, accounting |
| Bulk Import | `/invoices/import` | owner, admin, accounting |
| Payment Tracking | `/invoices/payments` | owner, admin, accounting |

### Financials (dropdown)
- **Purpose:** Dropdown menu grouping financial overview, draws, aging, and vendors
- **Visibility:** owner, admin, pm, accounting (individual sub-items have their own gates)

Sub-items:

| Label | Path | Visibility |
|-------|------|------------|
| Overview | `/financials` | owner, admin, pm, accounting |
| Draws | `/draws` | owner, admin, pm |
| Aging Report | `/financials/aging-report` | owner, admin, accounting |
| Vendors | `/vendors` | owner, admin, accounting |

### Settings
- **Path:** `/settings/company` (redirects from `/settings`)
- **Purpose:** Organization configuration
- **Accessed from:** Nav bar (direct link)
- **Visibility:** owner, admin

**Top-level nav entry count: 5** (Dashboard, Jobs, Invoices dropdown, Financials dropdown, Settings)

---

## 2. All Routes / Pages

### Public / Auth Pages

#### Landing Page
- **Path:** `/`
- **Purpose:** Marketing page for unauthenticated users; redirects signed-in users to `/dashboard`
- **Accessed from:** Direct URL, public header logo
- **Visibility:** Unauthenticated users only

#### Login
- **Path:** `/login`
- **Purpose:** Email/password sign-in form
- **Accessed from:** Public header "Sign In", signup page, forgot-password page
- **Visibility:** Unauthenticated users only

#### Sign Up
- **Path:** `/signup`
- **Purpose:** Account registration with optional plan selection via `?plan=` query param
- **Accessed from:** Public header "Start Free Trial", landing page CTA, login page
- **Visibility:** Unauthenticated users only

#### Forgot Password
- **Path:** `/forgot-password`
- **Purpose:** Password reset email request form
- **Accessed from:** Login page "Forgot password?" link
- **Visibility:** Unauthenticated users only

#### Pricing
- **Path:** `/pricing`
- **Purpose:** Plan comparison page (Free Trial, Starter, Pro, Enterprise) with Stripe checkout
- **Accessed from:** Public header, landing page, settings billing page
- **Visibility:** All (renders public header for guests, nav bar for authenticated users)

#### Onboarding
- **Path:** `/onboard`
- **Purpose:** Post-signup wizard for new org setup (company info, branding, cost codes)
- **Accessed from:** Automatic redirect after signup if onboarding incomplete
- **Visibility:** Authenticated users with incomplete onboarding

### Dashboard

#### Dashboard
- **Path:** `/dashboard`
- **Purpose:** Main operational dashboard with metric cards (active jobs, pending invoices, open draws, payments due), needs-attention queue, activity feed, and cash flow panel
- **Accessed from:** Nav bar "Dashboard", root redirect for authenticated users
- **Visibility:** owner, admin, pm, accounting

### Jobs

#### Jobs List
- **Path:** `/jobs`
- **Purpose:** Filterable list of all jobs with health indicators, budget utilization bars, and PM assignments
- **Accessed from:** Nav bar "Jobs", dashboard metric card
- **Visibility:** owner, admin

#### New Job
- **Path:** `/jobs/new`
- **Purpose:** Job creation form (name, address, client info, contract type, PM assignment, GC fee, deposit %)
- **Accessed from:** Jobs list page "New Job" button
- **Visibility:** owner, admin

#### Job Overview
- **Path:** `/jobs/[id]`
- **Purpose:** Job detail with editable fields (name, address, client info, PM, contract details), financial summary bar, and overview cards
- **Accessed from:** Jobs list row click, breadcrumbs
- **Visibility:** owner, admin

#### Job Budget
- **Path:** `/jobs/[id]/budget`
- **Purpose:** Line-item budget grid with inline editing, drill-down slide-out panel for POs/invoices per cost code, and budget export
- **Accessed from:** Job tabs "Budget"
- **Visibility:** owner, admin

#### Job Invoices
- **Path:** `/jobs/[id]/invoices`
- **Purpose:** All invoices for a specific job, filterable by status
- **Accessed from:** Job tabs "Invoices"
- **Visibility:** owner, admin

#### Job Purchase Orders
- **Path:** `/jobs/[id]/purchase-orders`
- **Purpose:** PO list for a specific job with status, amounts, and invoiced totals
- **Accessed from:** Job tabs "Purchase Orders"
- **Visibility:** owner, admin

#### New Purchase Order
- **Path:** `/jobs/[id]/purchase-orders/new`
- **Purpose:** Multi-line PO creation form with vendor selection, cost code mapping, and budget line allocation
- **Accessed from:** Job PO list "New PO" button
- **Visibility:** owner, admin

#### Import Purchase Orders
- **Path:** `/jobs/[id]/purchase-orders/import`
- **Purpose:** CSV bulk import for purchase orders using the generic CSV importer
- **Accessed from:** Job PO list "Import" button
- **Visibility:** owner, admin

#### Job Change Orders
- **Path:** `/jobs/[id]/change-orders`
- **Purpose:** PCCO log for a specific job showing all change orders with amounts, GC fees, and running contract total
- **Accessed from:** Job tabs "Change Orders"
- **Visibility:** owner, admin

#### New Change Order
- **Path:** `/jobs/[id]/change-orders/new`
- **Purpose:** Change order creation form with multi-line budget allocation, GC fee calculation, and source invoice linking
- **Accessed from:** Job CO list "New Change Order" button, also via `?fromInvoice=` query param
- **Visibility:** owner, admin

#### Job Draws
- **Path:** `/jobs/[id]/draws`
- **Purpose:** Draw history for a specific job showing all draws with status, payment due, and period dates
- **Accessed from:** Job tabs "Draws"
- **Visibility:** owner, admin

#### Job Lien Releases
- **Path:** `/jobs/[id]/lien-releases`
- **Purpose:** Lien release tracking per job with vendor breakdown, draw association, and document upload
- **Accessed from:** Job tabs "Lien Releases"
- **Visibility:** owner, admin

#### Job Internal Billings
- **Path:** `/jobs/[id]/internal-billings`
- **Purpose:** Internal billing line items (overhead, insurance, etc.) per job with configurable billing types and draw attachment
- **Accessed from:** Job tabs "Internal Billings"
- **Visibility:** owner, admin

### Invoices

#### All Invoices
- **Path:** `/invoices`
- **Purpose:** Master invoice list across all jobs with search, status filters, and summary stat cards
- **Accessed from:** Nav bar Invoices > "All Invoices"
- **Visibility:** owner, admin, pm, accounting

#### Upload Invoice
- **Path:** `/invoices/upload`
- **Purpose:** Drag-and-drop single invoice upload with real-time AI parsing progress, side-by-side preview of original file and parsed data
- **Accessed from:** Nav bar Invoices > "Upload Invoice"
- **Visibility:** owner, admin, accounting

#### Bulk Import
- **Path:** `/invoices/import`
- **Purpose:** Multi-file invoice upload with sequential AI parsing, batch status tracking, and duplicate detection
- **Accessed from:** Nav bar Invoices > "Bulk Import"
- **Visibility:** owner, admin, accounting

#### PM Queue
- **Path:** `/invoices/queue`
- **Purpose:** PM review inbox with keyboard navigation (j/k/a/d), confidence indicators, aging badges, and job/vendor filters
- **Accessed from:** Nav bar Invoices > "PM Queue", dashboard metric card
- **Visibility:** owner, admin, pm

#### Invoice Detail (PM Review)
- **Path:** `/invoices/[id]`
- **Purpose:** Full invoice review screen with side-by-side file preview, editable parsed fields, cost code/PO mapping, budget context, split/approve/deny/hold actions, and status timeline
- **Accessed from:** PM Queue row click, All Invoices row click, Job Invoices row click
- **Visibility:** owner, admin, pm, accounting

#### Accounting QA Queue
- **Path:** `/invoices/qa`
- **Purpose:** QA review inbox for accounting team showing PM-approved invoices awaiting final review
- **Accessed from:** Nav bar Invoices > "Accounting QA"
- **Visibility:** owner, admin, accounting

#### Invoice QA Detail
- **Path:** `/invoices/[id]/qa`
- **Purpose:** QA-specific invoice review with vendor/QB mapping fields, kickback-to-PM mechanism, and approval actions
- **Accessed from:** QA Queue row click
- **Visibility:** owner, admin, accounting

#### Payment Tracking
- **Path:** `/invoices/payments`
- **Purpose:** Payment management with aging buckets, batch-pay-by-vendor panel, payment method recording, and scheduled payment dates
- **Accessed from:** Nav bar Invoices > "Payment Tracking", dashboard metric card
- **Visibility:** owner, admin, accounting

#### Lien Releases (Global)
- **Path:** `/invoices/liens`
- **Purpose:** Cross-job lien release management with bulk document upload, vendor matching, and status tracking
- **Accessed from:** Linked from within invoice/draw workflows
- **Visibility:** owner, admin, accounting

### Financials

#### Financials Overview
- **Path:** `/financials`
- **Purpose:** Placeholder landing page for the Financials section with tile links to Draws, Aging Report, and Vendors
- **Accessed from:** Nav bar Financials > "Overview"
- **Visibility:** owner, admin, pm, accounting

#### Aging Report
- **Path:** `/financials/aging-report`
- **Purpose:** Placeholder for cross-job invoice aging report (current, 30, 60, 90+ days)
- **Accessed from:** Nav bar Financials > "Aging Report", financials overview tile
- **Visibility:** owner, admin, accounting

### Draws

#### Draws List
- **Path:** `/draws`
- **Purpose:** Cross-job draws list with status badges, payment amounts, and "New Draw" action
- **Accessed from:** Nav bar Financials > "Draws", dashboard metric card, financials overview tile
- **Visibility:** owner, admin, pm

#### New Draw
- **Path:** `/draws/new`
- **Purpose:** Draw creation wizard with job selection, period dates, invoice selection, G702/G703 preview, and deposit/retainage handling
- **Accessed from:** Draws list "New Draw" button
- **Visibility:** owner, admin

#### Draw Detail
- **Path:** `/draws/[id]`
- **Purpose:** Full draw view with G702 summary, G703 line items, cover letter editor, lien release upload list, internal billings section, change order log, comparison view, PDF export, and status actions (submit/approve/pay/void)
- **Accessed from:** Draws list row click, job draws list row click
- **Visibility:** owner, admin, pm

### Vendors

#### Vendors List
- **Path:** `/vendors`
- **Purpose:** Vendor directory with search, default cost code display, and invoice aggregates (count + total)
- **Accessed from:** Nav bar Financials > "Vendors"
- **Visibility:** owner, admin, accounting

#### Vendor Detail
- **Path:** `/vendors/[id]`
- **Purpose:** Vendor profile with editable contact info, default cost code assignment, notes, and invoice history table
- **Accessed from:** Vendors list row click, vendor name links throughout the app
- **Visibility:** owner, admin, accounting

#### Vendor Import
- **Path:** `/vendors/import`
- **Purpose:** CSV bulk import for vendors using the generic CSV importer
- **Accessed from:** Vendors list "Import" button
- **Visibility:** owner, admin, accounting

### Purchase Orders (Global)

#### Purchase Orders List
- **Path:** `/purchase-orders`
- **Purpose:** Cross-job PO list with search, status filters, and job/vendor columns
- **Accessed from:** Breadcrumb links, job PO lists
- **Visibility:** owner, admin

#### Purchase Order Detail
- **Path:** `/purchase-orders/[id]`
- **Purpose:** PO detail with editable fields, status history timeline, linked invoices list, and status actions (issue/close/void)
- **Accessed from:** PO list row click, budget drill-down PO links
- **Visibility:** owner, admin

### Change Orders (Global)

#### Change Order Detail
- **Path:** `/change-orders/[id]`
- **Purpose:** CO detail with line-item breakdown, GC fee display, status actions (approve/deny/execute/void), and linked invoice/PO references
- **Accessed from:** Job CO list row click, draw CO section links
- **Visibility:** owner, admin

### Settings

#### Settings Index
- **Path:** `/settings`
- **Purpose:** Redirect to `/settings/company`
- **Accessed from:** N/A (immediate redirect)
- **Visibility:** owner, admin

#### Company Settings
- **Path:** `/settings/company`
- **Purpose:** Organization name, tagline, logo upload, brand colors, company address, phone, email, website
- **Accessed from:** Settings tab "Company"
- **Visibility:** owner, admin, pm, accounting (all roles via settings tabs)

#### Team Settings
- **Path:** `/settings/team`
- **Purpose:** Team member management with role assignment (owner/admin/pm/accounting), invite system with email tokens, and activation/deactivation
- **Accessed from:** Settings tab "Team"
- **Visibility:** owner, admin

#### Financial Settings
- **Path:** `/settings/financial`
- **Purpose:** Default GC fee percentage, default deposit percentage, payment schedule configuration
- **Accessed from:** Settings tab "Financial"
- **Visibility:** owner, admin, pm, accounting

#### Workflow Settings
- **Path:** `/settings/workflow`
- **Purpose:** Invoice workflow configuration, default PM assignment for bulk imports, draw cover letter template, lien release settings
- **Accessed from:** Settings tab "Workflow"
- **Visibility:** owner, admin, accounting

#### Cost Codes
- **Path:** `/settings/cost-codes`
- **Purpose:** Cost code management (add/edit/reorder/delete), category assignment, change-order flag, sort order
- **Accessed from:** Settings tab "Cost Codes"
- **Visibility:** owner, admin, pm, accounting

#### Cost Code Import
- **Path:** `/settings/cost-codes/import`
- **Purpose:** CSV bulk import for cost codes using the generic CSV importer
- **Accessed from:** Cost codes page "Import" button
- **Visibility:** owner, admin

#### Internal Billings Settings
- **Path:** `/settings/internal-billings`
- **Purpose:** Internal billing type definitions (overhead, insurance, permit fees, etc.) with calculation methods (fixed, rate x qty, percentage, manual)
- **Accessed from:** Settings tab "Internal Billings"
- **Visibility:** owner, admin

#### Usage
- **Path:** `/settings/usage`
- **Purpose:** AI usage tracking showing Claude API call counts, token usage, estimated costs, and plan limits
- **Accessed from:** Settings tab "Usage"
- **Visibility:** owner, admin

#### Admin
- **Path:** `/settings/admin`
- **Purpose:** Admin dashboard with full activity log and system-level diagnostics
- **Accessed from:** Settings tab "Admin", dashboard activity feed "View all activity" link
- **Visibility:** owner, admin

#### Billing
- **Path:** `/settings/billing`
- **Purpose:** Stripe subscription management showing current plan, card on file, upgrade/downgrade actions, and cancel
- **Accessed from:** Settings tab "Billing", trial banner CTA, usage page upgrade link
- **Visibility:** owner, admin

**Total routes: 49** (including the redirect at `/settings`)

---

## 3. Tab Components

### Job Tabs
- **Source:** `src/components/job-tabs.tsx`
- **Parent context:** Job detail pages (`/jobs/[id]/*`)
- **Tabs:**

| Label | Slug | Full Path |
|-------|------|-----------|
| Overview | _(none)_ | `/jobs/[id]` |
| Budget | `/budget` | `/jobs/[id]/budget` |
| Invoices | `/invoices` | `/jobs/[id]/invoices` |
| Purchase Orders | `/purchase-orders` | `/jobs/[id]/purchase-orders` |
| Change Orders | `/change-orders` | `/jobs/[id]/change-orders` |
| Draws | `/draws` | `/jobs/[id]/draws` |
| Lien Releases | `/lien-releases` | `/jobs/[id]/lien-releases` |
| Internal Billings | `/internal-billings` | `/jobs/[id]/internal-billings` |

### Settings Tabs
- **Source:** `src/components/settings-tabs.tsx`
- **Parent context:** Settings pages (`/settings/*`)
- **Tabs:**

| Label | Path | Visibility |
|-------|------|------------|
| Company | `/settings/company` | owner, admin, pm, accounting |
| Team | `/settings/team` | owner, admin |
| Financial | `/settings/financial` | owner, admin, pm, accounting |
| Workflow | `/settings/workflow` | owner, admin, accounting |
| Cost Codes | `/settings/cost-codes` | owner, admin, pm, accounting |
| Internal Billings | `/settings/internal-billings` | owner, admin |
| Usage | `/settings/usage` | owner, admin |
| Admin | `/settings/admin` | owner, admin |
| Billing | `/settings/billing` | owner, admin |

**Total tab groups: 2 (8 job tabs + 9 settings tabs = 17 total tabs)**

---

## 4. Settings Sections

| Section | Path | Controls | Visibility |
|---------|------|----------|------------|
| Company | `/settings/company` | Org name, tagline, logo, brand colors, address, phone, email, website | all roles |
| Team | `/settings/team` | Member list, role assignment, email invites, activate/deactivate | owner, admin |
| Financial | `/settings/financial` | Default GC fee %, deposit %, payment schedule type/config | all roles |
| Workflow | `/settings/workflow` | Invoice routing rules, default PM for bulk import, draw cover letter template, lien release config | owner, admin, accounting |
| Cost Codes | `/settings/cost-codes` | CRUD for cost codes, category, sort order, is_change_order flag, CSV import | all roles |
| Internal Billings | `/settings/internal-billings` | Billing type definitions (fixed/rate/percentage/manual), default amounts | owner, admin |
| Usage | `/settings/usage` | AI call history, token counts, estimated costs, plan limit status | owner, admin |
| Admin | `/settings/admin` | Full activity log, system diagnostics | owner, admin |
| Billing | `/settings/billing` | Stripe plan, card on file, upgrade/downgrade/cancel | owner, admin |

**Total settings sections: 9**

---

## 5. Modal / Drawer / Overlay Flows

### Keyboard Shortcuts Modal
- **Source:** `src/components/keyboard-shortcuts.tsx`
- **Trigger:** Press `?` key globally (when not in an input field)
- **Purpose:** Shows keyboard shortcut reference (global, queue, and detail shortcuts)

### Budget Drill-Down Slide-Out Panel
- **Source:** `src/components/budget-drill-down.tsx` + `src/components/slide-out-panel.tsx`
- **Trigger:** Click a budget line row on the Job Budget page
- **Purpose:** Shows POs and invoices allocated to a specific cost code/budget line, with committed vs invoiced breakdown

### Notification Bell Dropdown
- **Source:** `src/components/notification-bell.tsx`
- **Trigger:** Click the bell icon in the nav bar
- **Purpose:** Shows last 10 notifications with read/unread state, links to action URLs, and "mark all read"

### PDF Expanded Modal
- **Source:** `src/components/pdf-renderer.tsx`
- **Trigger:** Click "expand" button on inline PDF preview
- **Purpose:** Full-viewport PDF viewer with zoom controls, fit-to-width/page, and download

### Invoice File Preview (Image Zoom)
- **Source:** `src/components/invoice-file-preview.tsx`
- **Trigger:** Click on image-type invoice preview
- **Purpose:** Full-screen image overlay with click-to-dismiss

### Payment Batch-by-Vendor Panel
- **Source:** `src/components/payment-batch-by-vendor-panel.tsx`
- **Trigger:** Click "Batch Pay" on the Payments page
- **Purpose:** Modal/panel for recording batch payments grouped by vendor with method selection and reference number

### Vendor Contact Popover
- **Source:** `src/components/vendor-contact-popover.tsx`
- **Trigger:** Hover/click vendor name on invoice detail
- **Purpose:** Quick-view popover showing vendor phone, email, address with link to full vendor profile

### Getting Started Checklist
- **Source:** `src/components/getting-started-checklist.tsx`
- **Trigger:** Automatically shown on dashboard for admin/owner users until dismissed
- **Purpose:** Onboarding checklist (company setup, cost codes, team, first job, first invoice, first draw) with sample data loader

### Invoice Split/Approve/Deny/Hold Confirm Dialogs
- **Source:** Inline in `src/app/invoices/[id]/page.tsx` and `src/app/invoices/queue/page.tsx`
- **Trigger:** Click approve/deny/hold action buttons
- **Purpose:** Confirmation dialogs before status-changing actions

### Lien Release Upload Modal
- **Source:** Inline in `src/app/jobs/[id]/lien-releases/page.tsx`
- **Trigger:** Click "Upload" button on lien releases page
- **Purpose:** File upload dialog for lien release documents

### Draw Cover Letter Editor
- **Source:** `src/components/draw-cover-letter-editor.tsx`
- **Trigger:** Inline section on draw detail page (expandable)
- **Purpose:** Rich text editor for draw cover letter with template generation

### Draw Comparison View
- **Source:** `src/components/draw-compare-view.tsx`
- **Trigger:** Inline section on draw detail page
- **Purpose:** Side-by-side comparison of current draw vs prior draw with delta highlighting

**Total modal/drawer/overlay flows: 12**

---

## 6. Dead / Unused Routes

Routes that exist as `page.tsx` files but are not linked from any navigation component, sidebar, tab, or breadcrumb trail:

### `/invoices/liens`
- **Path:** `/invoices/liens`
- **Purpose:** Global lien release management page
- **Status:** POTENTIALLY ORPHANED. No nav bar entry, no settings tab, no breadcrumb link found in any navigation component. Accessible only via direct URL or programmatic navigation from within draw/invoice workflows.
- **Note:** The per-job lien releases page (`/jobs/[id]/lien-releases`) IS linked from job tabs. This global cross-job view appears to lack a direct nav entry.

### `/purchase-orders`
- **Path:** `/purchase-orders`
- **Purpose:** Cross-job purchase order list
- **Status:** POTENTIALLY ORPHANED. No top-level nav entry. Accessible via breadcrumb trails and direct URL, but not in the main nav bar or any dropdown.

### `/purchase-orders/[id]`
- **Path:** `/purchase-orders/[id]`
- **Purpose:** Purchase order detail
- **Status:** Accessible via PO list links and budget drill-down, but the parent list (`/purchase-orders`) has no nav entry.

### `/change-orders/[id]`
- **Path:** `/change-orders/[id]`
- **Purpose:** Change order detail
- **Status:** Accessible via job CO list links, but no top-level nav entry for change orders exists.

**Dead/unused route count: 2 confirmed orphans** (`/invoices/liens`, `/purchase-orders`), **2 detail pages** that depend on orphaned list routes.

---

## Summary

| Category | Count |
|----------|-------|
| Top-level nav entries | 5 |
| Total routes (page.tsx files) | 49 |
| Job tabs | 8 |
| Settings tabs | 9 |
| Settings sections | 9 |
| Modal/drawer/overlay flows | 12 |
| Dead/unused routes flagged | 2 (+ 2 dependent detail pages) |
