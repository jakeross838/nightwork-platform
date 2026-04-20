# CLAUDE.md — Ross Command Center

## Dev Environment Rules

**ALWAYS run these before starting any work session:**
```bash
git pull origin main
npm install
```

**ALWAYS run these after finishing any work session or completing a feature:**
```bash
git add -A && git commit -m "descriptive message"
git push origin main
```

Jake works across multiple PCs. If you don't pull first, you'll be working on stale code. If you don't push after, the other PC won't have your changes. Never start coding without pulling. Never end a session without pushing.

**Screenshot protocol:**
Screenshots are captured via Chrome MCP and returned inline in the conversation. They are not persisted to disk. Jake reviews inline screenshots directly in chat.

## Project Identity Guard
**This project is Ross-Built-Command (Ross Command Center / Nightwork).**
- GitHub repo: github.com/jakeross838/Ross-Built-Command
- Repo directory name must end in `Ross-Built-Command` (local checkout path varies per PC and contributor).
- If CLAUDE.md mentions "RossOS", "cms_rebuild", "136 tables", "10,000+ companies", or "Phase 4 modules 20-28" — STOP. You are in the wrong project.
- If pwd does not show Ross-Built-Command — STOP. Navigate to the correct directory.
- Never modify files outside of this project directory.
- When referencing project files or folders, use repo-relative paths (e.g. `./screenshots/`, `./docs/`, `./test-invoices/`) — never absolute `C:\Users\...` paths.

## What This Is

Ross Command Center is the internal operations platform for **Ross Built Custom Homes**, a luxury coastal custom home builder based in Bradenton and Anna Maria Island, Florida. Founded 2006. ~14 simultaneous projects in the $1.5M–$10M+ range. Cost-plus (open book) builder — clients see every invoice and exactly where their money went.

This platform replaces a paper-and-spreadsheet workflow with a unified system where data enters once and flows everywhere. The financial module (invoices, budgets, draws) is Phase 1. The platform will eventually expand to scheduling, daily logs, client portal, and more — so every architectural decision must support that.

## Team & Roles

| Role | People | System Access |
|------|--------|---------------|
| Admin | Jake Ross (Director of Construction), Andrew Ross (Director of Pre-Construction/Finance) | Full access. Can do anything. |
| Owner | Lee Ross | View-only dashboards, draw approval |
| Accounting | Diane (primary), Mara (scanning/docs), Cindy (lien releases) | Invoice intake, QA review, QB push, draw compilation |
| PM | 6 project managers (Lee Worthy, Nelson Belanger, Bob Mozine, Jeff Bryde, Martin Mannix, Jason Szykulski) | Invoice approval for their jobs, budget views, draw review |

## Current Pain Points (Why This Exists)

1. **Paper everywhere.** Invoices arrive as email PDFs, get printed, rubber-stamped by hand, filed in physical folders, then scanned back to digital for draws. Digital → paper → digital.
2. **PMs must be in the office** to review invoice folders. If on-site, nothing moves.
3. **Same data entered 3–4 times.** Diane stamps it, PM reviews it, Diane enters into QuickBooks, Diane re-enters into AIA Excel draw.
4. **Budget data is stale.** PMs approve invoices against last month's draw numbers. No real-time view.
5. **No tracking.** No visibility into what's been reviewed, what's sitting, what's lost.
6. **Diane is a bottleneck.** Everything funnels through one person.

## Architecture Rules (Non-Negotiable)

These exist so the system scales into scheduling, daily logs, client portal, etc. without refactors.

- **Every record:** `id` (UUID), `created_at`, `updated_at`, `created_by`, `org_id`. Enables audit trails, permissions, multi-company.
- **Soft delete:** `deleted_at` timestamp, never actual deletion. Voided records keep a status + reason.
- **Status history:** JSONB column on every workflow entity logging every status change: `{who, when, old_status, new_status, note}`.
- **Amounts in cents:** $1,234.56 stored as `123456`. No floating point. Format in the frontend only.
- **`job_id` is universal parent:** Every financial record ties to `job_id`. Future modules (schedule, logs, photos) will too.
- **TypeScript strict mode.** No `any` types.
- **All business logic in server-side API routes or Supabase functions.** Frontend is display + forms only.

## Tech Stack

- **Next.js 14** (App Router, TypeScript, Tailwind CSS)
- **Supabase** (PostgreSQL database, Auth, Storage for invoice files, Row Level Security)
- **Claude API** (Anthropic SDK — `@anthropic-ai/sdk`) for invoice parsing via Vision
- **Vercel** for deployment
- **QuickBooks Online** (future integration — do not build yet, but never make schema decisions that block it)
- **Buildertrend** (existing CRM — no API, future Playwright scraper integration)

## Data Model — Full Entity Map

Build the invoices table now. Define the others as migrations so the schema exists even if the UI doesn't.

### jobs
The universal parent. Every financial record connects here.
```
id, name, address, client_name, client_email, client_phone,
contract_type (cost_plus | fixed),
original_contract_amount (cents), current_contract_amount (cents),
pm_id (references users), status (active | complete | warranty | cancelled),
deposit_percentage (decimal, default 0.10),
gc_fee_percentage (decimal, default 0.20),
org_id, created_at, updated_at, created_by, deleted_at
```

### vendors
```
id, name, address, phone, email,
default_cost_code_id (nullable — most vendors map to one trade),
qb_vendor_id (nullable — for future QuickBooks sync),
org_id, created_at, updated_at, created_by, deleted_at
```

### cost_codes
Ross Built uses 5-digit cost codes mapped to AIA G703 line items. Examples from Drummond draw:
- 01101 Architectural Services
- 01104 Pre-Permitting Planning Services
- 03110 Temporary Electric & Water
- 03112 Debris Removal
- 04101 Site Work (expected)
- 05101 Concrete/Foundation (expected)
- 06101 Framing (expected)
- 09101 Electrical (expected)
- 10101 Plumbing (expected)
- 15101 Drywall (expected)

```
id, code (string, e.g. "09101"), description, category,
sort_order (for G703 display), org_id, created_at, updated_at, deleted_at
```

### budget_lines
One per cost code per job. This is what shows on the G703.
```
id, job_id, cost_code_id,
original_estimate (cents), revised_estimate (cents — original + approved COs),
org_id, created_at, updated_at, deleted_at
```

**Computed fields (never stored, always calculated):**
- `previous_applications` = sum of invoices in prior draws
- `this_period` = sum of invoices in current draw
- `total_to_date` = previous + this_period
- `percent_complete` = total_to_date / revised_estimate
- `balance_to_finish` = revised_estimate - total_to_date

### purchase_orders
```
id, job_id, vendor_id, cost_code_id,
po_number, description, amount (cents),
status (draft | issued | partially_invoiced | fully_invoiced | closed | void),
co_id (nullable — if PO is tied to a change order),
status_history (JSONB),
org_id, created_at, updated_at, created_by, deleted_at
```

### change_orders
Maps to the PCCO Log sheet. Each CO adjusts budget lines and contract amount.
```
id, job_id, pcco_number (sequential per job),
description, amount (cents), gc_fee_amount (cents),
gc_fee_rate (decimal — usually 0.18 or 0.20, can be 0 for "no fee"),
total_with_fee (cents), estimated_days_added,
status (draft | pending_approval | approved | executed | void),
approved_date, draw_number (which draw it was billed on),
status_history (JSONB),
org_id, created_at, updated_at, created_by, deleted_at
```

### invoices ← Phase 1 Focus
```
id, job_id, vendor_id, cost_code_id (nullable until assigned),
po_id (nullable), co_id (nullable),

-- Parsed fields
invoice_number (nullable — some vendors don't include one),
invoice_date (nullable),
vendor_name_raw (exactly as parsed, before vendor matching),
job_reference_raw (exactly as parsed, before job matching),
po_reference_raw (exactly as parsed),
description,
line_items (JSONB array),
total_amount (cents),
invoice_type (progress | time_and_materials | lump_sum),
co_reference_raw (nullable),

-- AI metadata
confidence_score (decimal 0-1),
confidence_details (JSONB — per-field confidence breakdown),
ai_model_used (string),
ai_raw_response (JSONB — full API response for debugging),

-- Workflow
status (received | ai_processed | pm_review | pm_approved | pm_held | pm_denied |
        qa_review | qa_approved | qa_kicked_back |
        pushed_to_qb | qb_failed |
        in_draw | paid | void),
status_history (JSONB),

-- Payment
received_date (date — drives payment schedule),
payment_date (computed: received by 5th → 15th, by 20th → 30th, weekend/holiday → next biz day),
check_number (nullable),
picked_up (boolean, default false),

-- File storage
original_file_url (Supabase Storage path),
original_file_type (pdf | docx | xlsx | image),

-- Edit tracking
pm_overrides (JSONB — fields the PM changed from AI suggestion, with old/new values),
qa_overrides (JSONB),

-- Links
draw_id (nullable — set when pulled into a draw),
qb_bill_id (nullable — for future QuickBooks sync),

org_id, created_at, updated_at, created_by, deleted_at
```

### draws
Represents one monthly AIA G702/G703 pay application.
```
id, job_id, draw_number (sequential per job, e.g. 8),
application_date, period_start, period_end,
status (draft | pm_review | approved | submitted | paid | void),
revision_number (default 0 — increments if revised after submission),

-- G702 summary fields (all cents, all computed from line items)
original_contract_sum, net_change_orders, contract_sum_to_date,
total_completed_to_date, less_previous_payments, current_payment_due,
balance_to_finish, deposit_amount,

status_history (JSONB),
submitted_at, paid_at,
org_id, created_at, updated_at, created_by, deleted_at
```

### draw_line_items
One per budget line per draw. Maps to G703 rows.
```
id, draw_id, budget_line_id,
previous_applications (cents), this_period (cents),
total_to_date (cents), percent_complete (decimal),
balance_to_finish (cents),
org_id, created_at, updated_at, deleted_at
```

## Invoice Workflow — Detailed

### Status Flow
```
received → ai_processed → pm_review → pm_approved → qa_review → qa_approved → pushed_to_qb → in_draw → paid
                              ↓              ↓              ↓
                          pm_held        pm_denied      qa_kicked_back (→ back to pm_review)
```

### Confidence Routing
- **≥ 85%** → PM inbox (green, one-click approve candidate)
- **70–84%** → PM inbox (yellow flag, needs review)
- **< 70%** → Diane triages first before PM sees it

### Edit Rules
- **PM Review:** Can edit any AI-suggested field. Edits override AI. Old/new values logged in `pm_overrides`.
- **QA Review (Diane):** Can fix vendor/QB mapping. CANNOT change PM-approved cost codes or amounts — must kick back to PM with a note.
- **After QB push:** Void + re-enter only. Original preserved.
- **After draw submitted:** LOCKED. Changes require a formal revision (Rev 1, Rev 2). No retroactive edits.

### What-If Handling
- **Duplicate invoice:** vendor + invoice_number + total_amount + invoice_date match → block, notify
- **No PO match:** flag, don't block. PM decides.
- **PO fully consumed:** show $0 remaining + overage amount. PM decides.
- **Over budget:** red warning. PM can approve but must acknowledge.
- **Split across jobs:** PM splits. Each portion tracked separately, same original file.
- **Base vs CO split:** PM designates. Each flows to correct draw section.
- **Multi-attachment email:** (future) parser splits into separate invoice records
- **Credit memo:** negative amount. Same approval flow.

## Payment Schedule (Ross Built Policy)

This is NOT parsed from invoices. Vendors do not set due dates. Ross Built's schedule:

- Invoice received **by the 5th** → payment date is the **15th**
- Invoice received **by the 20th** → payment date is the **30th**
- If payment date falls on **weekend or holiday** → next business day
- Checks available for pickup **3:00–4:30 PM** at 305 67th St West
- Not picked up → mailed next business day

## Invoice Parse Schema (Claude Vision Output)

When an invoice file is sent to Claude Vision API, return this JSON:
```json
{
  "vendor_name": "string",
  "vendor_address": "string | null",
  "invoice_number": "string | null",
  "invoice_date": "YYYY-MM-DD | null",
  "po_reference": "string | null",
  "job_reference": "string | null",
  "description": "string",
  "invoice_type": "progress | time_and_materials | lump_sum",
  "co_reference": "string | null",
  "line_items": [
    {
      "description": "string",
      "date": "YYYY-MM-DD | null",
      "qty": "number | null",
      "unit": "string | null (each, hours, sqft, lf, etc.)",
      "rate": "number | null (dollars, not cents — convert after)",
      "amount": "number (dollars)"
    }
  ],
  "subtotal": "number (dollars)",
  "tax": "number | null",
  "total_amount": "number (dollars)",
  "confidence_score": "0.0-1.0",
  "confidence_details": {
    "vendor_name": 0.95,
    "invoice_number": 0.90,
    "total_amount": 0.99,
    "job_reference": 0.70,
    "cost_code_suggestion": 0.60
  },
  "flags": ["string — e.g. 'no_invoice_number', 'handwritten_detected', 'math_mismatch'"]
}
```

### Known Invoice Formats at Ross Built
1. **Clean vendor PDFs** (e.g. SmartShield Homes) — structured table, invoice #, PO ref. High confidence.
2. **T&M invoices** (e.g. Florida Sunshine Carpentry) — daily labor entries with crew size × hours. Need to parse each line and verify total = sum of (crew × hours × rate).
3. **Simple Word/PDF invoices** (e.g. Doug Naeher Drywall) — scope description + lump sum total. No line items, sometimes no invoice number. Low confidence.
4. **Photos of handwritten invoices** — lowest confidence. Route to Diane.

## AIA G702/G703 Draw Format

The draw output must match AIA standard format. Reference: Drummond Pay App 8.

### G702 (Project Summary — Page 1)
- Header: Owner info, project info, contractor info, application number, period, dates
- Lines 1–7: Original contract sum → net change orders → contract sum to date → total completed → less previous → current due → balance to finish
- Change order summary table: additions/deductions with running totals
- Signature block: Contractor (Jake Ross), date

### G703 (Continuation Sheet — Line Item Detail)
- Columns A–J: Item No | Description | Original Estimate | Previous Applications | This Period | Total to Date | % Complete | Balance to Finish | Proposal Amount | Balance in Contract
- One row per cost code (budget line)
- Page subtotals, grand total on final page
- 5-digit cost codes in column A

### PCCO Log (Change Order Log)
- Columns: PCCO # | App # | Description | Beginning Contract Amount | Addition/Deduction | GC Fee | New Contract Amount | Estimated Days Added
- Running contract total
- GC fee rate noted per line (default 20%, some at 18%, some "no fee")

## Phase Roadmap

### Phase 0: Foundation (current)
- Project scaffold, database schema, auth, file storage
- Seed cost codes from Drummond draw template

### Phase 1: Invoice Processing
- Drag-and-drop upload → Claude Vision parse → standardized view
- PM mobile-friendly review inbox (side-by-side: original + parsed data + live budget)
- Accounting QA queue with kickback mechanism
- Confidence routing (green/yellow/red)

### Phase 2: Budget + POs
- Per-job budget dashboard with live math
- PO creation, approval, balance tracking
- Invoice ↔ PO matching and remaining balance display
- Drill-down: budget line → POs → invoices

### Phase 3: Change Orders + Draws
- CO workflow (create → approve → execute → adjusts budget)
- Auto-generate G702/G703 from approved invoices
- PCCO log generation
- Draw lock + revision system
- Supporting doc compilation (invoices + lien releases)

### Phase 4: Intelligence + Integrations
- Email intake parser (accounting@rossbuilt.com)
- AI self-learning from PM corrections
- Duplicate detection
- Escalation timers + PM delegation
- QuickBooks Online push
- Lien release tracking

### Future (Schema Supports, Not in Scope)
- Scheduling from daily log data
- Daily logs and site documentation
- Client portal
- Vendor portal (invoice submission)
- Internal labor/equipment billing
- Inspection tracking and punch lists
- Full QuickBooks two-way sync

## File Structure Convention
```
/app — Next.js app router pages
/app/api — API routes (all business logic here)
/components — Reusable UI components
/lib — Utilities, Supabase client, Claude API client, types
/lib/types — TypeScript type definitions matching DB schema
/lib/supabase — Client and server Supabase utilities
/lib/claude — Invoice parsing prompt and response handling
/supabase/migrations — SQL migration files (numbered)
```

## Development Rules
- Run `npm run build` before committing — no build errors allowed
- Every database change is a numbered migration file
- Never store computed values — compute budget math on read.
  **Exception:** trigger-maintained caches are permitted when read-time
  recompute would be prohibitively expensive. Every such column must have an
  explicit trigger and a rationale comment. Canonical example:
  `jobs.approved_cos_total` maintained by `co_cache_trigger` (migration
  00042) so dashboard + budget pages don't re-aggregate every change order
  on every render.
- Never delete records — soft delete only
- All amounts in cents in the database, dollars in the UI
- Status changes always append to status_history JSONB
- Test with the three reference invoice formats: clean PDF, T&M, lump sum Word doc

## Testing Rule (MANDATORY)
**After EVERY UI change, you MUST verify with Chrome DevTools before reporting the task as complete.**
1. Restart the dev server if needed
2. Navigate to the affected page(s) using Chrome DevTools
3. Take a screenshot and visually confirm the change looks correct
4. Check for console errors
5. Test interactive elements (clicks, form inputs, dropdowns) if applicable
6. Only then report success to the user

Do NOT skip this step. A build passing does not mean the feature works. "It compiles" is not the same as "it works." If Chrome DevTools MCP is connected, use it. Every time.
