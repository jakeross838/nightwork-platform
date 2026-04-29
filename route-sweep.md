> SUPERSEDED 2026-04-29 by docs/nightwork-plan-canonical-v1.md. Kept for history.

# Route Sweep — Phase A

**Date:** 2026-04-17
**Commit base:** 82aabab (Phase B rollback applied)

## fetchCache Audit

Next.js 14 can cache Supabase fetch responses despite `export const dynamic = "force-dynamic"`. Any route with a GET handler returning auth-varying (per-user, per-org, per-session) data needs `export const fetchCache = "force-no-store"` to prevent stale cached responses across users/orgs.

**Total routes with fetchCache: 28** (5 pre-existing + 23 added this phase)
**Total routes without fetchCache: 40** (all POST/PATCH/DELETE-only or non-user-session)

### Already had fetchCache (from pre-dogfood fix, commit 79ab01d)

| Route | Reason |
|-------|--------|
| `/api/dashboard` | Org-scoped job/invoice/draw summary |
| `/api/draws/[id]` | Draw detail with budget line embeds |
| `/api/draws/[id]/export` | XLSX export with cost code embeds |
| `/api/jobs/health` | Org-scoped job health dashboard |
| `/api/jobs/[id]/overview` | Job detail preload |

### Added fetchCache this phase — pass 1 (draw/invoice action routes)

| Route | Reason |
|-------|--------|
| `/api/draws/new` | Creates draws from current invoice state |
| `/api/draws/preview` | Computes from live budget data |
| `/api/draws/drafts` | Lists draft draws per org |
| `/api/draws/[id]/action` | Status transitions on draws |
| `/api/draws/[id]/compare` | Compares two draw snapshots |
| `/api/draws/[id]/cover-letter` | Reads draw + job data |
| `/api/draws/[id]/revise` | Creates revision from live data |
| `/api/invoices/[id]` | Invoice detail — per-org status/data |
| `/api/invoices/batch-action` | Batch status changes |
| `/api/invoices/[id]/action` | Individual status transitions |
| `/api/jobs/[id]/budget-import` | Reads cost_codes + budget_lines per org |

### Added fetchCache this phase — pass 2 (auth-varying GET routes)

| Route | Reason |
|-------|--------|
| `/api/draws` | GET returns org-scoped draws list |
| `/api/invoices/[id]/docx-html` | GET returns invoice-specific HTML |
| `/api/cost-codes` | GET returns org-scoped cost codes |
| `/api/cost-codes/template` | POST writes to authenticated org |
| `/api/admin/integrity-check` | GET returns org-specific audit data |
| `/api/change-orders/[id]` | GET returns org-scoped CO data |
| `/api/jobs/[id]/change-orders` | GET returns job-scoped COs |
| `/api/jobs/[id]/purchase-orders` | GET returns job-scoped POs |
| `/api/lien-releases` | GET returns org-scoped lien releases |
| `/api/purchase-orders/[id]` | GET returns org-scoped PO data |
| `/api/invoices/import/[batchId]` | GET returns org-scoped batch data |
| `/api/workflow-settings` | GET returns org-scoped workflow config |

### Not added — POST/PATCH/DELETE-only (no GET handler, 37 routes)

These routes only accept write methods. Next.js fetch caching only affects GET responses — POST/PATCH/DELETE are never cached.

- `invoices/save` (POST)
- `invoices/parse` (POST — Claude API call)
- `invoices/[id]/dismiss-duplicate` (POST)
- `invoices/[id]/line-items` (PUT)
- `invoices/[id]/partial-approve` (POST)
- `invoices/[id]/payment` (POST)
- `invoices/payments/batch-by-vendor` (POST)
- `invoices/payments/bulk` (POST)
- `invoices/import/upload` (POST)
- `invoices/import/[batchId]/bulk-assign` (POST)
- `invoices/import/[batchId]/delete-errors` (POST)
- `invoices/import/[batchId]/parse-next` (POST)
- `invoices/import/[batchId]/send-to-queue` (POST)
- `cost-codes/import` (POST)
- `cost-codes/bulk` (POST)
- `cost-codes/[id]` (PATCH, DELETE)
- `budget-lines` (POST)
- `budget-lines/[id]` (PATCH, DELETE)
- `jobs` (POST, PATCH)
- `jobs/[id]` (DELETE)
- `jobs/[id]/po-import` (POST)
- `organizations/current` (PATCH)
- `organizations/logo` (POST)
- `organizations/members/[id]` (PATCH)
- `organizations/members/invite` (POST)
- `organizations/invites/[id]` (DELETE)
- `lien-releases/[id]` (PATCH)
- `lien-releases/[id]/upload` (POST)
- `lien-releases/bulk` (POST)
- `purchase-orders/[id]` (PATCH, DELETE — GET handled above)
- `vendors/[id]` (PATCH, DELETE)
- `vendors/import` (POST)
- `vendors/merge` (POST)
- `sample-data` (POST, DELETE)
- `stripe/checkout` (POST)
- `stripe/portal` (POST)

### Not added — non-user-session auth (2 routes)

These use service-role or external auth, not user-session cookies.

- `cron/overdue-invoices` — GET uses service-role with secret header auth; not user-session
- `stripe/webhook` — POST uses Stripe signature verification; service-role client

### Not added — no Supabase (1 route)

- `csv-parse/xlsx` — POST; pure file parsing with ExcelJS, no database access

## Service-Role Fallback Audit

Six routes use the `tryCreateServiceRoleClient() ?? userSb` pattern:

| Route | Type | User-facing? |
|-------|------|-------------|
| `/api/dashboard` | Dashboard summary | Yes — auth checked first |
| `/api/draws/[id]` | Draw detail | Yes — auth checked first |
| `/api/draws/[id]/export` | XLSX pay-app export | Yes — auth checked first |
| `/api/jobs/health` | Job health dashboard | Yes — auth checked first |
| `/api/jobs/[id]/overview` | Job detail preload | Yes — auth checked first |
| `/api/invoices/[id]` | Invoice detail | Yes — auth checked first |

All 6 are user-facing read endpoints where PostgREST join embedding
breaks under RLS (cost_codes embed on budget_lines returns null).
Pattern: authenticate user, verify org membership, then use
service-role for data query. Auth is NOT bypassed — service-role
is a workaround for RLS join failures, not an access control bypass.
See DEFERRED_FINDINGS.md F-002.

## Cost Code Dedup Audit

Query: `SELECT org_id, code, COUNT(*) FROM cost_codes WHERE deleted_at IS NULL GROUP BY org_id, code HAVING COUNT(*) > 1`

**Result: 0 within-org duplicates.**

Cross-org duplicates exist (expected — tenant isolation):

| Code | Org count | Descriptions |
|------|-----------|-------------|
| 15101 | 2 | "Drywall — Hang", "Gas Rough In" |
| 16101 | 2 | "Interior Paint", "Fireplace" |
| 17101 | 2 | "Flooring — Tile", "Roofing" |

These are different organizations using the same code numbers for
different trades — intended behavior, not a bug. Each org has its
own cost code table scoped by org_id.
