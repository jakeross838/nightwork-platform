# Nightwork — VISION.md

**Status:** Stage 1 architecture document. Last updated 2026-04-29.
**Scope:** The complete construction OS Nightwork will become — all entities, all workflows, all platform primitives, all five deployment waves, compliance and scale targets.
**Authoritative inputs:** `docs/nightwork-plan-canonical-v1.md` (canonical), `CLAUDE.md` (operational constitution), `.planning/MASTER-PLAN.md` (current state).
**Divergence policy:** Where this doc extends the canonical plan, that is forward planning, not contradiction. Any genuine contradiction is flagged inline with `⚠ DIVERGENCE` and resolved by Strategic Checkpoint #1 with Jake.

---

## Table of contents

1. Purpose and architectural principles
2. Entity model — all 5 waves
3. Workflow patterns
4. Platform primitives
5. Deployment waves 1–5
6. Compliance targets
7. Scale targets
8. Open questions inherited from canonical (and new ones)

---

## 1. Purpose and architectural principles

### 1.1 What Nightwork becomes

Nightwork is the AI-powered operating system for custom home builders — the system of record across the entire job lifecycle, from first proposal through final lien release and warranty close-out. The wedge is *AI-mediated reconciliation across entity transitions* (canonical §2): every commitment-shaped entity (proposal → contract → budget → PO → CO → invoice → draw → payment → lien release) is watched for drift against its predecessor, with the gap surfaced and a correction suggested. The four moat pillars (canonical §1.3) — universal ingestion, compounding cost intelligence, compounding schedule intelligence, AI as bookkeeper — sit on top of this reconciliation substrate.

The first tenant is Ross Built Custom Homes (cost-plus open-book, 14 simultaneous projects, $1.5M–$10M+ range). The broader market is custom and semi-custom builders running 1–15 simultaneous jobs. Pricing tiers $249/$499/$799 per `docs/BRAND.md`. Architecture is multi-tenant from day one (D-004), with Ross Built as Tenant 1 and 99,999 future tenants as the design target.

### 1.2 Architectural principles (verbatim from canonical R.1–R.23 + this doc's extensions)

These are inviolable. Every entity, every workflow, every primitive in this document is governed by them.

| ID | Principle | Source |
|---|---|---|
| R.1 | Never kill running processes | canonical §3 |
| R.2 | Recalculate, never increment | canonical §3 |
| R.3 | Org-configurable, never hardcoded | canonical §3 |
| R.4 | Rebuild over patch when foundationally off-target | canonical §3 |
| R.5 | Trace, don't assume | canonical §3 |
| R.6 | Block destructive actions when linked records exist | canonical §3 |
| R.7 | Log all state changes to `status_history` JSONB | canonical §3 |
| R.8 | Amounts in cents (`BIGINT`) | canonical §3 |
| R.9 | Source document provenance | canonical §3 |
| R.10 | Optimistic locking via `expected_updated_at` | canonical §3 |
| R.11 | Screenshots inline, not disk-saved | canonical §3 |
| R.12 | Single QA file per phase | canonical §3 |
| R.13 | Read CLAUDE.md first | canonical §3 |
| R.14 | No placeholder content | canonical §3 |
| R.15 | Test-first when possible | canonical §3 |
| R.16 | Migration files are source of truth | canonical §3 |
| R.17 | Atomic commits | canonical §3 |
| R.18 | Phase spec file lists are advisory | canonical §3 |
| R.19 | Live execution of manual tests | canonical §3 |
| R.20 | Read project scripts before invoking | canonical §3 |
| R.21 | Synthetic test fixtures, never production-shaped data | canonical §3 |
| R.22 | Teardown script sequencing | canonical §3 |
| R.23 | Codebase-precedent check for RLS and table conventions | canonical §3 |

This doc adds three architectural principles to govern Waves 2–5:

| ID | Principle | Rationale |
|---|---|---|
| **V.1** | **Universal entity envelope.** Every tenant entity has `{id, org_id, created_at, updated_at, created_by, deleted_at, status_history JSONB}` as its first 7 columns, in that order. | Audit log uniformity; soft-delete uniformity; no entity escapes the envelope. |
| **V.2** | **Universal export and import contract.** Every tenant entity has a documented JSON export schema and a documented JSON import schema. Imports are idempotent (same payload re-run is a no-op). Imports trigger downstream workflows as first-class events (per D-008). | Customers must be able to take their data with them; auditors need import provenance; cross-tenant migrations need a clean contract. |
| **V.3** | **Document provenance is universal, not invoice-specific.** Every entity that originates from an uploaded document carries `document_extraction_id` (FK into `document_extractions`). Reconciliation drift queries traverse this column. | The classify-extract-commit pipeline (canonical §7) generalizes from invoices to every entity in Wave 1+ — proposals, contracts, COs, vendor onboarding docs, lien releases, daily logs, photos, etc. |

### 1.3 The reconciliation thesis as architectural primitive

Per canonical §2, Nightwork's wedge is reconciliation across the chain `proposal → contract → budget → PO → CO → invoice → payment → draw → lien release`. The architecture supports this directly:

- Every commitment-shaped entity carries a `chain_position` and a `parent_commitment_id` (the predecessor in the chain) — these get added in the UCM phase (canonical §6, Q3 in canonical §11). Until UCM ships, individual entities carry the relationship via per-entity FKs (`invoices.po_id`, `invoices.co_id`, `purchase_orders.co_id`, etc.) with the same drift query semantics.
- Every entity has a `committed_at` timestamp distinct from `created_at`. Drift between predecessor `committed_at` and successor `committed_at` is the "paper lag days" coaching metric (Phase 3.7).
- Every entity has a `committed_amount_cents` (the value at the moment of commitment). Drift between predecessor `committed_amount_cents` and successor `committed_amount_cents` is the variance — surfaced on the reconciliation UI (Phase 3.X TBD per canonical Q1).

This is forward-looking. Wave 1 builds the per-entity FKs. The reconciliation surface lands as its own phase once the constituent extractors (CO, vendor, budget, historical draw) are live.

---

## 2. Entity model — all 5 waves

For each entity below: required fields, relationships, tenant boundary, audit-log behavior, soft-delete policy, permissions matrix, export schema, import schema. This is the *target* model — current implementation is documented in `CURRENT-STATE.md`.

Notation:
- `[V.1]` shorthand = the universal envelope (id, org_id, created_at, updated_at, created_by, deleted_at, status_history JSONB).
- `cents` = BIGINT cents per R.8.
- `audit: full` = every INSERT/UPDATE/DELETE writes to `activity_log`.
- `audit: status` = only status_history JSONB on the row, no `activity_log` write (used for high-volume read-mostly entities).
- `RLS: tenant` = `org_id = membership.org_id` filter via `getCurrentMembership()`; R.23 3-policy SELECT/INSERT-UPDATE/DELETE shape (proposals/00065 precedent).
- `RLS: read-tenant write-role` = SELECT tenant-wide, INSERT/UPDATE/DELETE narrowed to a role-set (canonical example: `approval_chains` write narrowed to owner/admin).

### 2.1 Tenant boundary

#### `organizations`
- **[V.1]** plus `name`, `address`, `phone`, `email`, `tier` (starter/pro/enterprise), `trial_ends_at`, `stripe_customer_id`, `stripe_subscription_id`, `branding` JSONB (logo URL, color overrides, custom domain), `settings_version` INT (bumped on settings change to invalidate caches)
- **Relationships:** parent of every tenant entity via `org_id`
- **Tenant boundary:** itself — RLS allows SELECT to org members + platform admins
- **Audit:** full (creation, tier change, trial extension, suspension, branding change)
- **Soft-delete:** yes — sets `deleted_at`, cascades to `org_members` deactivation; data retained for 90 days then hard-purged via cron (compliance)
- **Permissions:** owner/admin can rename + change branding; only platform_admin can change tier or extend trial; no role can hard-delete
- **Export:** full org settings + member list + every tenant entity (full database export). Returns a single tarball: `org-{slug}-export-{timestamp}.tar.gz` containing one JSON file per entity table.
- **Import:** matches export schema; idempotency key = `org_id` + entity `id`; re-importing the same payload is a no-op; importing a payload with conflicting `id`s into a new org rewrites IDs deterministically (UUID v5 namespace).

#### `org_members`
- **[V.1]** plus `user_id` (FK auth.users), `role` (owner/admin/pm/accounting/owner_view), `is_active`, `invited_at`, `accepted_at`, `last_active_at`
- **Relationships:** join table between users and orgs; one user can belong to multiple orgs
- **Tenant boundary:** RLS tenant — owner/admin can list, members can see themselves
- **Audit:** full (invite, accept, role change, deactivate)
- **Soft-delete:** soft via `is_active=false` (preserves audit trail for ex-members who acted on rows)
- **Permissions:** owner/admin invites + role-changes; members can update their own profile fields; only owners can promote to owner
- **Export:** included in org export; emails redacted to `redacted-{user_id_short}@redacted.example` if importing into a different org for testing
- **Import:** idempotent on (`user_id`, `org_id`); unknown user_id triggers email-based invite flow

#### `org_invites`
- **[V.1]** plus `email`, `role`, `invited_by`, `token_hash` (SHA-256), `expires_at`, `accepted_at`
- **Relationships:** one-shot pre-membership record; converts to `org_members` on accept
- **Tenant boundary:** RLS tenant — owner/admin can list
- **Audit:** full
- **Soft-delete:** revoke via `revoked_at`; expired invites stay for 30 days then hard-purge
- **Permissions:** owner/admin only
- **Export/import:** typically excluded from cross-tenant export (transient state)

### 2.2 Identity

#### `auth.users` (Supabase managed)
- Supabase auth schema — managed by Supabase, not directly modifiable
- Source of truth for email + password hash + email_confirmed_at
- Linked to `profiles` (and currently also `users` — see CURRENT-STATE for the dual-table issue)

#### `profiles`
- **[V.1] minus `org_id` and `deleted_at`** (profile is identity-scoped, not org-scoped) plus `user_id` (FK auth.users), `display_name`, `avatar_url`, `phone`, `notification_preferences` JSONB, `last_seen_at`
- Identity-level data that's the same across every org membership
- **Tenant boundary:** SELECT public to anyone the user shares an org with; UPDATE only by owner of the row
- **Audit:** PII updates audited
- **Soft-delete:** N/A (auth.users deletion cascades)

#### `roles` (synthetic — not a table, an enum)
- Hardcoded role-set: `owner`, `admin`, `pm`, `accounting`, `owner_view`
- Stored as TEXT column on `org_members.role` with CHECK constraint
- Per R.3, role *capabilities* are configurable per org (via `org_workflow_settings.role_permissions` JSONB), but the role names are global

#### `permissions` (synthetic — derived)
- Not a table — derived from `(role, org_workflow_settings.role_permissions)` via RPC `public.has_permission(action TEXT, target_table TEXT, target_id UUID)`
- Returns BOOLEAN; cached per request

#### `platform_admins`
- Operator role for Nightwork staff (Jake, Andrew, future support/eng) per CLAUDE.md
- Stored in own table (not an org role); seeded via migration 00048
- Allows cross-org SELECT (migration 00049); writes go through service-role API routes that audit-log unconditionally
- Impersonation: signed `nw_impersonate` cookie, 60-min TTL, banner-visible

### 2.3 Project graph

#### `jobs`
- **[V.1]** plus `name`, `address`, `client_name`, `client_email`, `client_phone`, `contract_type` (cost_plus/fixed), `original_contract_amount` cents, `current_contract_amount` cents (recalculated from COs per R.2; the `approved_cos_total` cache is the canonical R.2 exception with trigger rationale per CLAUDE.md), `pm_id` (FK org_members), `status` (active/complete/warranty/cancelled), `deposit_percentage` decimal, `gc_fee_percentage` decimal, `started_at`, `completed_at`, `warranty_expires_at`
- **Relationships:** parent of every job-scoped entity (budget_lines, invoices, draws, COs, POs, schedule_items, daily_logs, punchlists, photos, documents, etc.) via `job_id`
- **Tenant boundary:** RLS tenant + PM-on-own-jobs read narrowing where applicable (per draws/00069 precedent)
- **Audit:** full
- **Soft-delete:** yes; cascades to all child entities (application-layer per Branch 3/4 jobs-soft-delete RPC)
- **Permissions:** owner/admin create/update/delete; PM can update fields on their own jobs; accounting read-only on most fields; client portal users see filtered fields only
- **Export:** full job graph (job + all child entities scoped to `job_id`) — single JSON file or sub-tarball
- **Import:** idempotent on `id`; importing into a new org rewrites IDs; cost code references resolve via canonical_code_id mapping

#### `vendors`
- **[V.1]** plus `name`, `address`, `phone`, `email`, `default_cost_code_id` (FK org_cost_codes, nullable), `qb_vendor_id` (nullable, future QB sync), `ein` (nullable), `license_number` (nullable, FL state contractors), `w9_on_file` boolean, `w9_received_at`, `insurance_on_file` boolean, `insurance_expires_at`, `payment_terms` (net30/net60/net15/cod, default org-configured), `lien_release_required` boolean (per-vendor override; default org-configured), `notes`
- **Relationships:** invoiced via `invoices.vendor_id`; PO'd via `purchase_orders.vendor_id`; pricing history accumulated via `pricing_history.vendor_id`; aliased via `vendor_aliases` (future)
- **Tenant boundary:** RLS tenant
- **Audit:** full (insurance/W9/license updates are compliance-relevant)
- **Soft-delete:** yes; vendors with linked invoices/POs cannot be hard-deleted (R.6 guard)
- **Permissions:** owner/admin/accounting full; PMs can read + suggest edits via a pending_vendor_suggestions table (parallel to pending_cost_code_suggestions, Phase 3.4 precedent)
- **Export/import:** straightforward; idempotency on (`org_id`, `name`) AND (`org_id`, `ein`)

#### `gl_codes`
- **[V.1]** plus `code` (e.g., "5100"), `description`, `category` (income/COGS/expense/asset/liability/equity), `qb_account_id` (nullable), `is_active`
- General ledger account codes — distinct from cost_codes (which are construction-trade codes for G703 mapping). Pre-populated from QuickBooks chart of accounts on org setup or via CSV import.
- **Relationships:** referenced by `invoices.gl_code_id` and `org_cost_codes.default_gl_code_id`
- **Tenant boundary:** RLS tenant
- **Audit:** full
- **Soft-delete:** yes
- **Permissions:** owner/admin/accounting only
- **Export/import:** standard; idempotency on (`org_id`, `code`)

⚠ DIVERGENCE flag: canonical §5 does not currently model `gl_codes` as its own table. Today GL accounts are tracked implicitly via cost code mappings and the future QuickBooks sync. Adding `gl_codes` as a first-class entity is a forward extension to make QB sync clean and to support orgs that map cost-code spend to GL accounts differently (some have one cost_code → many GL accounts).

#### `canonical_cost_codes`
- Existing per canonical §8.2; 354 rows seeded from NAHB. RLS read-only to all authenticated, modifiable only via migrations.
- **Export/import:** read-only system table, not part of tenant export

#### `org_cost_codes`
- **[V.1]** plus `code` (5-digit string), `description`, `category`, `sort_order`, `canonical_code_id` (FK canonical_cost_codes, nullable), `default_vendor_id` (nullable), `default_gl_code_id` (nullable), `is_active`
- Per-org cost code map (canonical §8.2 Layer 2). Sparsely populated today (12 rows live).
- **Tenant boundary:** RLS tenant
- **Audit:** full
- **Soft-delete:** soft via `is_active=false`
- **Permissions:** owner/admin direct write; PMs go through `pending_cost_code_suggestions` (Phase 3.4 precedent)
- **Export/import:** `canonical_code_id` makes cross-org-import safe — re-import maps to the same canonical row

#### `pending_cost_code_suggestions`
- Existing per Phase 3.4. **[V.1]** plus suggestion fields. PM proposals; owner/admin resolves to approved/rejected/duplicate.

⚠ DIVERGENCE flag: canonical §5.3 documents the legacy `cost_codes` table coexists with `org_cost_codes`. Per canonical Q4, consolidation timing is TBD. VISION assumes the consolidated state — only `org_cost_codes` survives long-term. F1 (foundation phase 1) is the natural place to do this.

### 2.4 Financial — Wave 1

#### `budgets` (currently 0 rows; reserved)
- Reserved for the future "Budget envelope" entity that wraps a set of `budget_lines` for a job. Today, budget lines are anchored directly to `job_id`. If we keep `budgets` as a header table, it carries `version_number`, `committed_at`, `committed_by`, `notes`. **TBD** — could be deprecated and dropped.

⚠ DIVERGENCE flag: canonical §5.4 mentions `budgets` is unused. VISION takes no position; F1 may decide to deprecate or activate. Keep current schema as-is for now.

#### `budget_lines`
- **[V.1]** plus `job_id`, `cost_code_id` (FK org_cost_codes), `original_estimate` cents, `revised_estimate` cents (recalc'd from approved COs per R.2), `notes`
- **Computed (never stored, always recomputed per R.2):**
  - `previous_applications` = SUM(invoices in prior draws for this budget_line)
  - `this_period` = SUM(invoices in current draw)
  - `total_to_date` = previous + this_period
  - `percent_complete` = total_to_date / revised_estimate
  - `balance_to_finish` = revised_estimate − total_to_date
  - `balance_in_contract` = original_estimate × (1 + gc_fee_percentage) − total_to_date_with_fee
- **Relationships:** parent of `draw_line_items` and indirect parent of `invoices` via `cost_code_id`
- **Tenant boundary:** RLS tenant + PM-on-own-jobs read narrowing (per draws/00069 precedent)
- **Audit:** status (status_history JSONB only)
- **Soft-delete:** yes
- **Permissions:** owner/admin/accounting full; PM read on own jobs + can flag corrections
- **Export/import:** idempotent on (`job_id`, `cost_code_id`)

#### `purchase_orders`
- **[V.1]** plus `job_id`, `vendor_id`, `cost_code_id`, `po_number` (sequential per job), `description`, `amount` cents, `status` enum (draft/issued/partially_invoiced/fully_invoiced/closed/void), `co_id` (nullable, if PO ties to a CO), `committed_at`, `expected_start_date`, `expected_duration_days`, `actual_start_date`, `actual_completion_date`
- **Relationships:** child of jobs/vendors/cost_codes/COs; parent of invoices via `invoices.po_id`
- **Tenant boundary:** RLS tenant
- **Audit:** full
- **Soft-delete:** yes; void status preserved
- **Permissions:** owner/admin/accounting create + issue; PM read + flag for issue
- **Export/import:** standard; line items via `po_line_items`

#### `po_line_items`
- **[V.1]** plus `po_id`, `cost_code_id`, `description`, `qty`, `unit`, `rate` cents, `amount` cents, `expected_start_date`, `expected_duration_days`
- Per-line PO detail; supports multi-line POs

#### `change_orders`
- **[V.1]** plus `job_id`, `pcco_number` (sequential per job — Potential Change Order), `description`, `amount` cents, `gc_fee_amount` cents, `gc_fee_rate` decimal (org-configured default; per-CO override allowed), `total_with_fee` cents, `estimated_days_added`, `paper_lag_days` (canonical §13.1; computed: signed_at − work_started_at), `status` (draft/pending_approval/approved/executed/void), `approved_at`, `executed_at`, `draw_id` (nullable; which draw it billed on), `committed_at`
- **Relationships:** parent of `change_order_lines` and `change_order_budget_lines` (impacts on budget per line)
- **Tenant boundary:** RLS tenant
- **Audit:** full (every status transition is contract-relevant)
- **Soft-delete:** yes; void preserved
- **Permissions:** owner/admin create/approve/execute; PM draft + submit; accounting bill on draw
- **Export/import:** standard; idempotent on (`job_id`, `pcco_number`)

#### `change_order_lines`
- **[V.1]** plus `co_id`, `description`, `qty`, `unit`, `rate` cents, `amount` cents
- Per-line CO detail (similar to PO lines)

#### `change_order_budget_lines`
- Junction: a CO can adjust multiple budget_lines (e.g., a CO adds $30k of framing AND $5k of lumber). Carries `co_id`, `budget_line_id`, `delta_amount_cents`.

#### `invoices`
- **[V.1]** plus the schema in CLAUDE.md: `job_id`, `vendor_id`, `cost_code_id` (nullable), `po_id` (nullable), `co_id` (nullable), `gl_code_id` (nullable; new per V.1 extension), parsed fields (`invoice_number`, `invoice_date`, `vendor_name_raw`, `job_reference_raw`, `po_reference_raw`, `description`, `line_items` JSONB, `total_amount` cents, `invoice_type`, `co_reference_raw`), AI metadata (`confidence_score`, `confidence_details`, `ai_model_used`, `ai_raw_response`), workflow (`status` 11-value enum, `received_date`, `payment_date` computed, `check_number`, `picked_up`), file storage (`original_file_url`, `original_file_type`), edit tracking (`pm_overrides`, `qa_overrides`), links (`draw_id`, `qb_bill_id`), `document_extraction_id` (FK per V.3), `committed_at` (= qa_approved_at)
- **Relationships:** child of jobs/vendors/cost_codes/POs/COs; parent of `invoice_line_items` and `invoice_allocations`; ancestor of `pricing_history` rows
- **Tenant boundary:** RLS tenant + PM-on-own-jobs narrowing
- **Audit:** full + status_history JSONB on every transition
- **Soft-delete:** void status; never hard-deleted
- **Permissions:** PM approves on own jobs; accounting (Diane) does QA; admin/owner override; QB push role-gated
- **Export:** full envelope including `invoice_line_items`, `invoice_allocations`, AI raw response, source file URL (signed temp URL valid 7 days)
- **Import:** idempotency on (`org_id`, `vendor_id`, `invoice_number`, `invoice_date`, `total_amount`); re-import is no-op; CONFLICT on different total_amount creates a new revision

#### `invoice_line_items`
- **[V.1]** plus `invoice_id`, `description`, `date`, `qty`, `unit`, `rate` cents, `amount` cents
- Per-line detail

#### `invoice_allocations`
- **[V.1]** plus `invoice_id`, `cost_code_id`, `budget_line_id`, `amount_cents`, `is_change_order` (per amendment-1 canonical §2)
- Splits — when an invoice covers multiple cost codes or splits between base contract and CO

#### `approvals`
- **[V.1]** plus `entity_type` (invoice/co/draw/po/proposal/lien_release), `entity_id`, `actor_user_id`, `step_index`, `decision` (approve/reject/kickback), `note`, `decided_at`
- Append-only approval log per `approval_chains.workflow_type`. Every workflow step's outcome lands here. Note canonical §0070 documents approval_chains existed as RLS-write-narrowed config; the actual decision events are written here.
- **Relationships:** parent ref to any approvable entity (polymorphic via entity_type+id like `document_extractions.target_entity_id`)
- **Tenant boundary:** RLS tenant
- **Audit:** append-only — no UPDATE, no DELETE; corrections via service-role only
- **Permissions:** every actor in the chain can write their own row; SELECT tenant-wide
- **Export/import:** included in entity export bundles

#### `approval_chains`
- Existing per migration 00070. Per-org configurable for 6 workflow dimensions. R.23 3-policy with write narrowed to owner/admin (it's tenant config, not workflow data).

#### `draws`
- **[V.1]** plus the schema in CLAUDE.md: `job_id`, `draw_number` (sequential per job), `application_date`, `period_start`, `period_end`, `status` (draft/pm_review/approved/submitted/paid/void), `revision_number` (default 0; increments on revision), G702 summary fields (all cents, all recomputed per R.2), `submitted_at`, `paid_at`, `committed_at`
- **Relationships:** parent of `draw_line_items`, `draw_adjustments`, `draw_adjustment_line_items`; child of jobs
- **Tenant boundary:** RLS tenant + PM-on-own-jobs read narrowing per draws/00069 precedent
- **Audit:** full
- **Soft-delete:** yes; cascade to draw_adjustments via the application-layer RPC (CLAUDE.md mentions this is enforced in the soft-delete path, not at DB layer)
- **Permissions:** owner/admin/accounting full; PM review on own jobs
- **Export:** full G702 + G703 + adjustments + invoice rollups + lien_release links + supporting docs (signed URLs)
- **Import:** idempotent on (`job_id`, `draw_number`, `revision_number`); locked draws can only be imported as new revisions

#### `draw_line_items`
- Per CLAUDE.md schema. RLS tenant. Parent of nothing; child of `draws` and `budget_lines`.

#### `draw_adjustments`
- Existing per 00069. Per CLAUDE.md table comment: corrections, credits (goodwill/defect/error), withholds, customer direct-pays, conditional holds. Renders in dedicated "Adjustments & Credits" section on draw doc — preserves AIA G702/G703 auditability by NOT silently applying to `draw_line_items.this_period`.

#### `draw_adjustment_line_items`
- Per-adjustment line detail.

#### `aia_g702_documents` and `aia_g703_documents` (synthetic)
- Not separate tables — these are *projections* of `draws` + `draw_line_items` + `change_orders` + `draw_adjustments` rendered as PDFs. Stored output goes in Supabase Storage at `{org_id}/draws/{draw_id}/g702-rev{n}.pdf` and `g703-rev{n}.pdf`. Export endpoint regenerates from current row state if older than 24h.

#### `lien_releases`
- **[V.1]** plus `vendor_id`, `job_id`, `draw_id` (nullable), `payment_id` (nullable), `release_type` (conditional/unconditional/conditional_progress/unconditional_progress — Florida statute matches these four), `period_through_date`, `amount_through_date_cents`, `status` (pending/received/missing/disputed), `received_at`, `received_via` (email/mail/in_person), `original_file_url`, `document_extraction_id` (V.3), `notes`
- **Relationships:** child of vendor/job; references draw_id when tied to a specific pay app; references payment_id when post-payment unconditional
- **Tenant boundary:** RLS tenant
- **Audit:** full
- **Soft-delete:** yes
- **Permissions:** accounting (Cindy primarily per CLAUDE.md) full; PM read on own jobs; flagged-as-missing surfaces on dashboard
- **Export/import:** standard; idempotent on (`vendor_id`, `period_through_date`, `release_type`)

#### `payments`
- **[V.1]** plus `vendor_id`, `job_id`, `payment_method` (check/ach/wire/credit_card), `check_number` (nullable), `amount_cents`, `payment_date`, `cleared_at` (nullable), `qb_payment_id` (nullable), `picked_up_at` (nullable per CLAUDE.md vendor pickup workflow)
- **Relationships:** parent of `payment_invoices` junction (one payment can settle multiple invoices); child of vendor/job
- **Tenant boundary:** RLS tenant
- **Audit:** full
- **Soft-delete:** yes; void preserved with reason
- **Permissions:** accounting/admin full; PM read; owner_view sees totals only
- **Export/import:** standard

#### `payment_invoices` (junction)
- **[V.1]** plus `payment_id`, `invoice_id`, `amount_applied_cents`. One payment can settle multiple invoices; one invoice can be settled by multiple payments (partial payment scenario).

#### `retainage`
- Computed, not stored — derived from `org_workflow_settings.retainage_percentage` × `draw_line_items.this_period`. Per canonical §13.1, Ross Built defaults to 0; platform default is 10. Org-configurable per R.3.
- If we ever need stored retainage release events, those become `retainage_releases` rows (parallel to lien_releases).

### 2.5 Operations — Wave 2

#### `schedule_items`
- **[V.1]** plus `job_id`, `parent_id` (nullable, for nested phases), `cost_code_id` (nullable), `name`, `description`, `start_date`, `end_date`, `actual_start_date`, `actual_end_date`, `duration_days`, `dependency_ids` UUID[] (predecessor schedule_items), `is_milestone` boolean, `assigned_to` (FK org_members, nullable), `status` (planned/in_progress/complete/blocked/skipped), `notes`
- Inspired by the canonical §1.3 Pillar 3 "schedule intelligence" thesis. Schedule data accumulates passively from Phase 3.5+ via PO/CO date fields, plus explicit schedule_items entered by the PM.
- **Relationships:** parent of `schedule_baselines` (snapshots), `schedule_dependencies` (junction for many-to-many deps), `daily_logs` link via `daily_log.schedule_item_id`
- **Tenant boundary:** RLS tenant + PM-on-own-jobs narrowing
- **Audit:** status; baseline snapshots on every "approve schedule" event
- **Soft-delete:** yes
- **Permissions:** owner/admin/PM (own jobs) full; accounting read; client portal read (filtered)
- **Export/import:** standard; idempotent on (`job_id`, `name`); supports CSV/Excel import for migrating existing Microsoft Project / Smartsheet schedules

#### `schedule_baselines`
- Append-only snapshots of the schedule at key approval moments. **[V.1]** minus updated_at (immutable) plus `job_id`, `baseline_at`, `baseline_by`, `schedule_snapshot` JSONB (full schedule_items array as of snapshot), `notes`

#### `tasks`
- **[V.1]** plus `job_id` (nullable; org-level tasks allowed), `schedule_item_id` (nullable), `assigned_to`, `title`, `description`, `due_date`, `priority` (low/normal/high/urgent), `status` (open/in_progress/done/blocked/cancelled), `completed_at`, `recurring_pattern` JSONB (nullable; for recurring tasks)
- **Relationships:** child of jobs/schedule_items; parent of `task_comments`, `task_attachments`
- **Tenant boundary:** RLS tenant; owner sees own tasks + tasks on their assigned jobs
- **Audit:** status
- **Soft-delete:** yes
- **Permissions:** assignees can update status; assignors can update everything; admins override
- **Export/import:** standard

#### `punchlist_items`
- **[V.1]** plus `job_id`, `room` (string; e.g., "Master Bath"), `category` (string; e.g., "Tile", "Drywall"), `description`, `priority`, `discovered_by` (FK org_members or client_portal_user), `assigned_to` (FK vendor or org_member), `discovered_at`, `target_resolution_date`, `actual_resolution_date`, `status` (open/in_progress/resolved/disputed/cancelled), `is_qc_entry` boolean (per CLAUDE.md "field mistakes become permanent QC entries"), `resolution_note`, `original_photo_urls` TEXT[], `resolution_photo_urls` TEXT[]
- **Relationships:** child of jobs; parent of `punchlist_comments`; linkable to `daily_logs`, `draws` (per CLAUDE.md "draw requests link to punchlist")
- **Tenant boundary:** RLS tenant + PM-on-own-jobs
- **Audit:** full + status — QC entries are append-only on resolution (no hard-delete; closed with note)
- **Soft-delete:** soft-cancel for non-QC; QC entries cannot be deleted, only resolved (per CLAUDE.md)
- **Permissions:** PM/admin write; client portal users can flag items via portal; vendor portal (future) updates own-assigned status
- **Export/import:** standard

#### `daily_logs`
- **[V.1]** plus `job_id`, `log_date`, `weather_conditions`, `temperature_high_f`, `temperature_low_f`, `precipitation`, `crew_count`, `crew_breakdown` JSONB (e.g., `{"framers": 4, "concrete": 2}`), `narrative` TEXT, `delays_flag` BOOLEAN, `delays_description` TEXT, `safety_incidents_flag` BOOLEAN, `safety_incidents_description` TEXT, `inspections_today` JSONB, `materials_delivered` JSONB, `equipment_on_site` JSONB, `visitors` JSONB, `entered_by` (FK org_members), `entered_at`
- **Relationships:** child of jobs; parent of `daily_log_photos`, `daily_log_punchlist_links`
- **Tenant boundary:** RLS tenant + PM-on-own-jobs
- **Audit:** full
- **Soft-delete:** yes (with reason — daily logs are field record)
- **Permissions:** PM (own jobs) write; admin read all; accounting read; client portal read (filtered to non-confidential fields)
- **Export/import:** standard; CSV/Excel import for migrating existing daily logs

#### `documents`
- **[V.1]** plus `job_id` (nullable; org-level docs allowed), `name`, `description`, `category` (plans/contracts/specs/permits/inspections/correspondence/photos/proposals/other), `tags` TEXT[], `original_file_url`, `original_file_type`, `file_size_bytes`, `document_extraction_id` (FK per V.3, nullable — for AI-classified docs), `parent_document_id` (nullable; revisions form a chain), `version_number` INT, `is_current_version` BOOLEAN, `uploaded_by`, `uploaded_at`
- The universal document store. Backs the entire document-management surface (Wave 2 + Wave 3 client portal exposes a subset).
- **Relationships:** child of jobs (or org); parent of `document_versions` (or self-link via parent_document_id), `document_tags`, `document_annotations` (Bluebeam-style markup, future)
- **Tenant boundary:** RLS tenant + per-document permissions (some docs are PM-only, some accounting-only, some client-shared)
- **Audit:** full
- **Soft-delete:** yes
- **Permissions:** uploader + admins full; per-doc role grants via `document_permissions` join table (future)
- **Export/import:** standard; large export bundles use signed URLs not embedded base64

#### `photos`
- **[V.1]** plus `job_id`, `taken_at`, `taken_by` (FK org_members), `latitude`, `longitude`, `accuracy_m`, `original_file_url`, `thumbnail_url`, `caption`, `tags` TEXT[], `linked_punchlist_item_id` (nullable), `linked_daily_log_id` (nullable), `linked_progress_milestone` (nullable; e.g., "framing complete")
- Site progress photography. EXIF metadata preserved; geo-stamping enables map view.
- **Relationships:** child of jobs; linkable to punchlists, daily logs
- **Tenant boundary:** RLS tenant + PM-on-own-jobs
- **Audit:** status (high volume — full audit would be excessive)
- **Soft-delete:** yes
- **Permissions:** PM/admin/accounting; client portal sees a curated subset (`is_client_visible` flag)
- **Export/import:** standard; bulk import from existing P-drive structures

#### `emails` (Wave 3 entity, schema reserved)
- **[V.1]** plus `job_id` (nullable), `direction` (inbound/outbound), `from_address`, `to_addresses` TEXT[], `cc_addresses` TEXT[], `subject`, `body_text`, `body_html`, `received_at`, `sent_at`, `message_id` (RFC 2822 ID for threading), `in_reply_to`, `thread_id`, `gmail_label_ids` TEXT[] (if Gmail-sync), `attachment_count`, `processed_at`, `entity_links` JSONB (auto-detected job/vendor/invoice references)
- The email_inbox surface — currently 0 rows; future Phase 3 (Wave 3 Communication) wires up `accounting@rossbuilt.com` ingestion.
- **Relationships:** child of jobs (when assignable); parent of `email_attachments` (which auto-flow to `documents`)
- **Tenant boundary:** RLS tenant
- **Audit:** full (compliance-relevant)
- **Soft-delete:** yes (regulatory hold capable)
- **Permissions:** accounting + admin full; PM read on own-job-linked threads
- **Export/import:** Gmail/IMAP bulk import via mbox parsing

#### `notes`
- **[V.1]** plus `entity_type` (job/vendor/invoice/etc), `entity_id`, `body_markdown`, `is_pinned` BOOLEAN, `is_internal` BOOLEAN (don't show client)
- General note-taking surface against any entity. Polymorphic (entity_type + entity_id) like document_extractions.target_entity_id.

### 2.6 Communication — Wave 3

#### `notifications`
- Existing per migration set; 78 rows live. **[V.1]** plus `recipient_user_id`, `category` (invoice_assigned/co_approved/draw_submitted/etc), `payload` JSONB, `link_url`, `read_at`, `delivered_via_email_at`, `delivered_via_push_at`
- Per-user notification ledger. Covers in-app + email + (future) mobile push.
- **Relationships:** child of org_members; references entity via payload
- **Tenant boundary:** RLS — recipient sees their own; admins see org-wide
- **Audit:** status; high volume so no full audit
- **Soft-delete:** N/A — notifications are dismissible
- **Permissions:** recipient updates `read_at`; system writes; admins read for support
- **Export/import:** included in user export

#### `messages` (synthetic for Wave 3)
- Internal team messaging. **[V.1]** plus `thread_id`, `from_user_id`, `to_user_id` or `to_org_id` (broadcast), `body_markdown`, `entity_link_type`, `entity_link_id`, `attachments` JSONB
- Light-weight Slack-alternative for in-app conversation around an entity.

#### `weekly_updates`
- **[V.1]** plus `job_id`, `week_start_date`, `summary_markdown`, `progress_photos` UUID[] (FK photos), `next_week_plan_markdown`, `is_published` BOOLEAN, `published_at`, `published_to` ENUM (internal_only / client_portal / both)
- Auto-generated draft from daily logs for the week + PM polish + publish to client portal.
- Wave 3 entity. RLS tenant + PM-on-own-jobs.

#### `client_portal_access` and `client_portal_messages`
- Existing per migrations 00071+; per CLAUDE.md table comments. Client invite tokens, builder↔client messaging.

### 2.7 Intelligence — Wave 4

#### `vendor_item_pricing`
- Existing per canonical §8.3. The pricing memory backbone — every committed vendor+item+price+date observation.

#### `pricing_history`
- Existing per migration 00067+ per CLAUDE.md table comment. Trigger-populated append-only audit spine. R.23 1-policy RLS shape (single SELECT, no INSERT/UPDATE/DELETE — trigger-only writes via service role).

#### `items` and `item_aliases`
- Existing per canonical §8.3. Items registry with pgvector embeddings.

#### `market_pricing_reference` (Wave 4 entity, schema TBD)
- External pricing reference — RSMeans, NAHB cost data, public bid data. Per canonical §1.4 cross-org sharing is off, but external public pricing is fair game. Not yet built. Schema TBD.

#### `performance_metrics` (Wave 4 entity)
- Per-job and per-org KPIs computed nightly. Schema TBD; likely a materialized view + scheduled refresh.

#### `custom_reports` (Wave 4 entity)
- **[V.1]** plus `name`, `description`, `report_type` (job-level/org-level/cross-org-platform-admin), `query_template` JSONB (parameterized SQL or DSL), `chart_config` JSONB, `created_by`, `is_shared`, `last_run_at`, `last_run_results` JSONB
- User-defined report builder. Schema is reserved; first release likely Phase 4.X.

### 2.8 Audit — every wave

#### `activity_log`
- Existing per canonical. **[V.1] minus deleted_at** (append-only) plus `actor_user_id`, `actor_membership_id`, `entity_type`, `entity_id`, `action` (create/update/delete/status_change/login/etc), `before_payload` JSONB, `after_payload` JSONB, `ip_address`, `user_agent`, `request_id` (correlation ID)
- The org-scoped audit log spine. Every API mutation writes here.
- **Tenant boundary:** RLS tenant; platform_admin sees cross-org
- **Soft-delete:** N/A (append-only — corrections via service role only, similar to `pricing_history`)
- **Permissions:** SELECT tenant-wide (per audit transparency principle); INSERT system-only
- **Export/import:** included in org export; PII fields scrubbed when sharing externally

#### `change_events` (Wave 4+ — synthetic)
- A higher-level "change feed" abstraction over `activity_log`. Wave 4 surface aggregates `activity_log` rows into user-readable change events for the client portal ("Jake approved your CO-12 on Monday at 2:14 PM").

#### `snapshots`
- Append-only point-in-time materialized snapshots of an entity's full state. Used for compliance ("show me what the budget looked like on draw 3 submission"). **[V.1]** plus `entity_type`, `entity_id`, `snapshot_at`, `snapshot_reason`, `payload_jsonb`
- Tenant boundary RLS tenant. Append-only.
- Reserved Wave 4. May be implemented as a generalization of `schedule_baselines`.

### 2.9 Platform — system-level

#### `api_usage`
- Existing per canonical. Cost-instrumentation spine. 1,928 rows live.
- Append-only; RLS tenant + platform_admin cross-org.

#### `subscriptions`
- Stripe-managed; existing schema. Org tier + billing state.

#### `feedback_notes`, `support_conversations`, `support_messages`
- Existing per migrations.

#### `parser_corrections`
- Existing — Phase 3.4 PM-correction loop for AI parser fine-tuning.

#### `unit_conversion_templates`, `unit_conversion_suggestions`
- Existing per migrations 00054+.

#### `internal_billings`, `internal_billing_types`
- Existing — internal labor/equipment billing entities (CLAUDE.md "Future" schema).

#### `selection_categories`, `selections`
- Existing — owner-facing selection items (tile, fixtures, finishes). Wave 2-3 surface.

#### `cost_code_templates`
- Existing per migration 00078+; system-level starter templates for new orgs.

---

## 3. Workflow patterns

### 3.1 Universal state-transition pattern

Per R.7 + R.10 + R.6, every workflow entity uses this canonical pattern:

```typescript
// src/lib/workflow/transition.ts (target — see CURRENT-STATE for current implementation gap)
export async function transitionEntity({
  table, id, expected_updated_at,
  newStatus, reason, comment, actor
}: TransitionArgs): Promise<TransitionResult> {
  // 1. Optimistic-lock check (R.10) via updateWithLock
  // 2. Guard check (R.6) — call canTransitionTo(table, id, newStatus, actor)
  // 3. Apply UPDATE setting status + appending to status_history JSONB (R.7)
  // 4. Recalculate any dependent aggregates from source rows (R.2)
  // 5. Write activity_log row
  // 6. Trigger downstream notifications (queued, not sync)
  // 7. Return new row state
}
```

Every workflow API route delegates to this helper. No more ad-hoc UPDATEs that touch status without status_history (the canonical pattern enforced post-F2).

### 3.2 Approval workflows

Per `approval_chains` (migration 00070), 6 workflow dimensions: invoice_pm, invoice_qa, co, draw, po, proposal. Each chain is an ordered list of steps; each step has a role-set or a named user; each step has a threshold (`required_approvals` / `dollar_threshold`).

Approval flow:
1. Entity enters `pending_approval` status
2. System computes the chain from `approval_chains` for the org+workflow_type
3. For each step, system creates an open `approvals` row (status=pending) for the eligible actors
4. Actors approve/reject/kickback via API; each writes their `approvals` row
5. Once a step's `required_approvals` are met (or any single rejection), the entity transitions to the next step or back to draft
6. Final approval transitions entity to `approved`/`executed`/etc

This generalizes the today-bespoke invoice PM/QA flow to every approvable entity.

### 3.3 Document upload + classify + extract + commit pipeline (canonical §7)

The single ingestion pipeline for every uploaded document:

```
PM uploads PDF
  → /api/ingest creates document_extractions row, uploads file to Supabase Storage
  → classifier (Claude Sonnet) returns {classified_type, confidence}
  → extractor (per-type) reads PDF, writes extracted_data JSONB
  → PM reviews on the canonical review surface (file preview LEFT + right-rail)
  → PM clicks Save
  → /api/{type}/commit re-loads extraction, validates, INSERTs entity + line items,
    updates document_extractions.target_entity_type/id/verification_status
```

This is universal V.3 — every entity that originates from a document goes through it. New extractors (CO, vendor, budget, lien_release, daily_log_ocr) add a new branch in the per-type extractor table; the commit step is per-entity but follows the same shape.

Auto-commit at high confidence (≥0.95) is allowed for invoices today; will extend to vendors and lien_releases in later waves.

### 3.4 Email intake → entity creation (Wave 3)

Inbound to `accounting@{org_domain}` (Resend webhooks):
1. Resend webhook hits `/api/email/inbound`
2. System creates `emails` row, parses attachments
3. Each attachment routes to `/api/ingest` as if uploaded by the PM
4. The classify-extract pipeline runs per attachment
5. PM gets a notification batch ("12 invoices received from accounting@ this morning")

### 3.5 Notification triggers and recalculation chains

Per R.2, every recalc is from source rows. Triggers fire:
- Invoice committed → recalc `budget_lines.total_to_date` (computed at read time, but cache invalidation hint sent)
- CO approved → recalc `jobs.approved_cos_total` (the canonical R.2 exception; trigger-maintained per CLAUDE.md migration 00042)
- Draw submitted → recompute G702/G703 PDFs (regenerate on demand, not stored)
- Vendor pricing observed → INSERT into `pricing_history`, UPDATE `vendor_item_pricing` (trigger from migration 00067+)

Notification triggers fire async via the background job queue (see §4.7) — no notification ever blocks a mutation.

### 3.6 Idempotency requirements

- All write endpoints accept `Idempotency-Key` header (24h window)
- Imports are idempotent on entity-specific natural keys (per V.2 export/import contracts)
- Webhook handlers (Stripe, Resend, future QB) are idempotent on the provider's event ID
- Background jobs are idempotent — re-running a job with the same payload is a no-op

### 3.7 Audit-logging requirements

Every API mutation writes to `activity_log` with full before/after payloads. PII fields are masked in `before_payload`/`after_payload` (e.g., social security replaced with `[REDACTED]`). The middleware tags every request with `user_id`, `org_id`, `request_id` (correlation ID), `impersonation_active` per CLAUDE.md.

Sentry receives every error with the same tags. Error → `activity_log` row + Sentry event correlate via `request_id`.

### 3.8 Permission checks

Every API route follows this shape:

```typescript
export async function POST(req) {
  const membership = await getCurrentMembership();
  if (!membership) return unauthorized();
  if (!await hasPermission(membership, 'create', 'invoice'))
    return forbidden();
  // ... business logic
}
```

`hasPermission` consults `org_workflow_settings.role_permissions` JSONB plus a default capability map. Per R.3, capabilities are configurable per org.

### 3.9 Data import/export workflows (per D-008, V.2)

Export endpoints per entity:
- `GET /api/orgs/[id]/export` — full org tarball
- `GET /api/jobs/[id]/export` — single-job graph
- `GET /api/{entity}/[id]/export` — single entity envelope

Import endpoints:
- `POST /api/orgs/[id]/import` — full org restore (admin only; idempotent)
- `POST /api/jobs/import` — single-job ingest from another org or external source
- `POST /api/invoices/bulk-import` — CSV/Excel bulk import (validation + dry-run + commit)
- `POST /api/cost-codes/bulk-import` — CSV import for onboarding (canonical §8.2)

Imports as triggers per D-008:
- Importing invoices triggers cost-intelligence wiring (pricing_history population)
- Importing budgets triggers job-level budget-line creation
- Importing schedule data triggers schedule_baseline creation

---

## 4. Platform primitives

### 4.1 Multi-tenant RLS strategy

R.23 codebase-precedent rule: every new table follows the `proposals/00065` 3-policy shape (SELECT/INSERT-UPDATE/DELETE) with role-set narrowing where appropriate. Documented divergences: `approval_chains` (write-narrowed to owner/admin), `draws` (PM-on-own-jobs read narrowing), `pricing_history` (1-policy append-only), `client_portal_messages` (XOR check + accounting included).

Every API route calls `getCurrentMembership()` and filters every query by `membership.org_id`. RLS is the backstop, not the primary defense (per CLAUDE.md "RLS alone is a backstop, not a substitute for application-layer auth").

### 4.2 Audit log infrastructure

`activity_log` table is the spine. Helper `src/lib/audit/log.ts` wraps every mutation. Middleware extracts `request_id`, `user_id`, `org_id`, `ip`, `user_agent` and injects into every audit-log call.

Sentry tags every event with the same. Logs from `console.log` are structured JSON (Pino or similar) with the same correlation ID.

### 4.3 Permission/role system

Role enum: `owner`, `admin`, `pm`, `accounting`, `owner_view`. Capability map in `src/lib/auth/capabilities.ts` keyed by `(role, action, entity_type)`. Per-org overrides in `org_workflow_settings.role_permissions` JSONB.

`hasPermission(membership, action, entity_type, entity_id?)` is the single check. Returns BOOLEAN. Cached per request.

### 4.4 Error handling middleware

Single error boundary at the API route level via `src/lib/api/handler.ts` wrapper:

```typescript
export const handler = withErrorBoundary(withAuth(withAudit(actualHandler)));
```

Errors → Sentry + `activity_log` (action=error) + structured 4xx/5xx response. Never a stack trace returned to the client.

### 4.5 Observability

- **Sentry** (already in stack): every API route, every middleware path, every background job tagged with org_id/user_id/request_id
- **Structured logging**: Pino-style JSON to stdout; Vercel ingests; logs queryable via Vercel dashboard or piped to Datadog/Better Stack post-launch
- **Metrics**: Vercel Analytics for HTTP-level; custom Postgres queries for business metrics; Phase 4+ adds dashboards
- **Distributed tracing**: OpenTelemetry-compat via Sentry tracing (already supported); spans cover `api_route → db_query → claude_api_call` chains
- **Audit log surfacing**: `activity_log` is queryable from the platform-admin UI for support investigations

### 4.6 Idempotency

`Idempotency-Key` header on every POST/PUT/PATCH/DELETE. Stored in a Redis-or-Postgres `idempotency_keys` table with 24h TTL.

```typescript
withIdempotency(handler) → wraps the handler with key-check → returns cached response on repeat
```

### 4.7 Rate limiting

- Per-org: 1000 req/min Soft cap, 2000 req/min hard cap (returns 429)
- Per-user: 200 req/min
- Per-IP (unauth): 60 req/min
- AI endpoints (parse, classify, extract): per-org 100 calls/hour soft, configurable per tier (Starter: 100/hr; Pro: 500/hr; Enterprise: unlimited)
- Implementation: Vercel KV (Redis-compat) + sliding-window algorithm

### 4.8 Background jobs

⚠ DECISION REQUIRED: choose between Inngest, Trigger.dev, and Supabase pg-boss for background job infrastructure. Current state: nothing in place. Forward research and recommendation in TARGET.md after subagent fact-finding completes.

Initial assessment criteria:
- **Inngest**: best for event-driven workflows, Next.js-native, durable execution, $20/mo starter; 5min steps fine
- **Trigger.dev**: similar to Inngest, Vercel-friendly, slightly heavier infra, free tier generous
- **pg-boss / pg_cron**: in-database, no new infra, but limited to Postgres throughput, no fan-out/fan-in primitives

Initial lean: **Inngest** for app-event jobs (notifications, AI extraction, exports), **pg_cron** for periodic maintenance (cleanup_stale_import_errors per canonical Q11, pricing_history aggregations, daily metrics rollups).

### 4.9 File storage

Supabase Storage with these buckets:
- `invoice-files` — invoice/proposal/CO/lien_release source PDFs (canonical §7.1 retains this name)
- `documents` — general document store (Wave 2 documents entity)
- `photos` — site photos (with thumbnails generated via Edge Function)
- `exports` — generated tarballs (signed URLs, 7-day TTL)
- `draws` — generated G702/G703 PDFs (per-org per-draw)

Path convention: `{org_id}/{entity_type}/{entity_id}/{filename}`. Cross-org access blocked at Storage RLS layer.

### 4.10 Email/notification delivery

- **Resend** as primary email provider (already in env vars per CLAUDE.md tech debt)
- Verified sending domain per org: `noreply@{org_domain}.nightwork.email` initially, custom domain support later
- Inbound email via Resend webhooks (Wave 3)
- Notification preferences per user (`profiles.notification_preferences` JSONB) — daily digest, immediate, per-category mute

### 4.11 Search infrastructure

- **Phase 1 (Wave 1)**: Postgres full-text search via tsvector on `invoices.description`, `vendors.name`, `jobs.name`, `documents.name + tags`
- **Phase 2 (Wave 4)**: pgvector embeddings for semantic search across documents (already in items registry per canonical §8.3 — extend to documents)
- **Phase 3 (Wave 4+)**: dedicated search service if needed (Algolia / Typesense) — only if pgvector + pg-FTS prove insufficient at 100k-org scale

### 4.12 Caching

- Vercel Edge cache for static assets and SSR-cached pages (org-public marketing surfaces)
- Per-org `settings_version` (in `organizations.settings_version`) bumped on settings change to invalidate client-side caches
- Background job: dashboard metrics materialized view refreshed every 60s
- `expected_updated_at` on every entity row enables client-side optimistic UI without server round-trips

### 4.13 Data import/export framework

Per V.2: every entity has a documented JSON export/import schema. Helper library `src/lib/portability/`:
- `export(entity_type, id) → ExportEnvelope`
- `import(entity_type, ExportEnvelope) → ImportResult`
- Idempotency built in
- Validation built in (Zod schema per entity)
- Audit-logged on both sides
- Triggers downstream workflows on import per D-008

---

## 5. Deployment waves 1–5

Per MASTER-PLAN.md §7 and canonical §9.

### Wave 1 — Financial core (current)

Entities: jobs, vendors, gl_codes, cost_codes (canonical+org), budget_lines, purchase_orders, change_orders, invoices, draws, lien_releases, payments, retainage, approvals.

Surfaces: invoice review (gold standard), proposal review, CO review (Phase 3.7), draw approval, lien_release intake, vendor management, cost code management, budget dashboards, job dashboards.

Acceptance criteria target: a Drummond invoice can be uploaded → classified → extracted → reviewed → committed → allocated to budget → included in a draw → G702/G703 generated → lien release attached → marked paid, all with audit trail and reconciliation drift visible at every transition.

### Wave 2 — Project operations

Entities: schedule_items, schedule_baselines, tasks, punchlist_items, daily_logs, photos, documents.

Surfaces: schedule view (Gantt + list), daily log entry (mobile-first), punchlist management, photo gallery + map view, document library.

Acceptance criteria: a PM on-site can record a daily log, attach photos, create a punchlist item, see today's schedule items, all from mobile, in under 60 seconds.

### Wave 3 — Communication

Entities: emails, messages, weekly_updates, client_portal_access (existing) + client_portal_messages (existing).

Surfaces: email intake (`accounting@{org}`), in-app messaging, weekly update generator, full client portal.

Acceptance criteria: a client receives a weekly update with progress photos and approves a CO from their portal; the builder receives notification within 60 seconds.

### Wave 4 — Intelligence

Entities: market_pricing_reference, performance_metrics, custom_reports + activation of pricing_history queries.

Surfaces: cost intelligence dashboard (per-vendor pricing time-series), schedule intelligence (Phase 4 promised), reconciliation surface (canonical Q1), custom report builder, AI bookkeeper review queue.

Acceptance criteria: an estimator drafting a new proposal sees per-line pricing memory ("you paid Vendor A $42.50/sf last 6 months for this item; market reference is $45-$48") inline.

### Wave 5 — Integrations

Targets: Procore (Wave-1 trade contractor sync), QuickBooks Online (bidirectional sync), Bluebeam (Studio collaboration on plans/markups), Buildertrend (read-only sync via Playwright scraper per CLAUDE.md), Google Drive / OneDrive (document mirror).

Acceptance criteria: a builder running on QBO can flip a switch and have invoices/payments/vendors round-trip nightly, with conflict resolution UI for drifted records.

---

## 6. Compliance targets

### 6.1 SOC2 Type II — year 1

- Audit log coverage: 100% of mutations
- Access reviews: quarterly per-org admin review of member roles
- Data retention: 7-year hot retention for financial records (FL contractor compliance + IRS); 90-day soft-delete window before purge
- Encryption at rest: Supabase default (AES-256); Storage objects encrypted
- Encryption in transit: TLS 1.3 enforced via HSTS preload (currently HSTS in place per QA report)
- Incident response: documented runbook in `docs/incident-response.md` (TBD)
- Vendor management: SOC2 reports requested from Supabase, Vercel, Anthropic, Resend, Stripe — collected to `docs/vendor-soc2/`
- Annual penetration test
- Background checks for platform_admins

### 6.2 GDPR

Architecture supports — even though target market is US-domiciled FL builders today, future expansion to international markets needs:
- Right to access: export endpoint per V.2 already supports this
- Right to deletion: hard-purge cron scheduled 90 days post-soft-delete; user can request immediate purge
- Right to portability: V.2 export format is portable JSON
- Data Processing Agreements: per-tenant DPA template
- Sub-processor list maintained at `/legal/sub-processors`

### 6.3 CCPA

Subset of GDPR posture; same architectural support.

### 6.4 Financial data retention

- Florida contractor licensing: 5-year retention on contracts, draws, lien releases
- IRS: 7-year retention on financial records
- Implementation: soft-delete with 7-year purge cron (vs 90-day default for non-financial)

---

## 7. Scale targets

Per nwrp7.txt:
- 100k orgs eventually
- 10–100 active jobs per org (peak ~50 typical large)
- 1000s invoices per org per year (Ross Built today: ~3000/yr across 14 jobs)
- 10M+ invoices total (100k orgs × 100/yr × 10yr)
- 100s simultaneous users per large org

Performance budgets:
- Dashboard p95: < 2s (mandatory; current dashboard 503s are an architectural smell per CLAUDE.md)
- Aggregation queries p95: < 500ms
- Read endpoints p99: < 1s
- Write endpoints p99: < 2s
- AI parse latency p95: < 12s (Claude Vision call dominates; can't hard-cap below this)

Architectural implications:
- Every aggregation has an index plan in the same migration (CLAUDE.md mandate; F2 codifies this as a phase gate)
- Composite indexes prefix on `org_id` to cooperate with RLS
- Materialized views for dashboard rollups (refreshed every 60s via pg_cron)
- Read replicas at >10k org scale (Supabase Premium feature)
- Partitioning: `activity_log`, `api_usage`, `pricing_history`, `notifications` are the candidates — partition by `created_at` monthly above 100M rows
- Connection pooling: PgBouncer (Supabase Pro default)
- File storage: Supabase Storage scales to org-level; CDN-fronted

Multi-region: single region (iad1) until 100k-org scale. EU-region for GDPR-territory tenants is phase 5+ work (separate Supabase project + cross-region routing in Vercel middleware).

---

## 8. Open questions inherited from canonical (and new ones)

These are flagged for Strategic Checkpoint #1 with Jake.

### Inherited from canonical §11

- **Q1.** Reconciliation surface — own phase or distributed? VISION assumes its own phase, sequenced after Phase 3.6/3.7/3.9 extractors land.
- **Q2.** Embedding-on-create wiring — when? VISION assumes it lands in F1 or first Phase-3.5 deliverable. Named blocker per canonical §12.1.
- **Q3.** UCM design — wide vs JSONB, status model, sequence. VISION takes no position — TARGET.md will sketch options.
- **Q4.** Cost code registry consolidation timing. VISION assumes F1 absorbs this (rip-and-replace cost_codes table; Drummond pre-launch test data only per D-007).
- **Q5.** Trial expiry enforcement. VISION assumes middleware-gate (request-time check) rather than cron-flip — but flagged for Jake's call.
- **Q6.** Plan-limits gating coverage. VISION assumes all token-consuming routes gate per-tier.
- **Q7.** docx-html auth hardening. 5-min fix; VISION includes in F1.
- **Q8.** PO scaffolding fate. VISION assumes leave-in-nav for Phase 3.5 to fill.
- **Q9.** Classifier eval scheduling. VISION assumes nightly cron in dev.
- **Q10.** Proposal commit transactionality. VISION assumes RPC-pattern (matches draws/00069 precedent and generalizes).
- **Q11.** Ingest pipeline orphan-storage cleanup. VISION assumes pg_cron schedules `cleanup_stale_import_errors()`.
- **Q12.** Residual vestigial UI cleanup post-NAV-REORG. Opportunistic.

### New to VISION

- **VQ1. Background job framework choice.** Inngest vs Trigger.dev vs pg-boss. Recommended Inngest + pg_cron split. Lock by F3.
- **VQ2. `gl_codes` table — first-class entity?** VISION proposes adding it. Today GL accounts are implicit. Lock by F1 or QB-sync phase.
- **VQ3. Universal entity envelope V.1 — adopt as a hard rule?** VISION proposes mandatory `{id, org_id, created_at, updated_at, created_by, deleted_at, status_history}` as columns 1-7 of every tenant table, in that order. Most existing tables already conform; some don't. Lock by F1.
- **VQ4. Universal export/import contract V.2 — when?** VISION proposes per-entity export schemas land alongside each entity's primary phase, but a coordinated F-X phase establishes the framework. Lock by F1 or F3.
- **VQ5. Document provenance V.3 — adopt universally?** VISION proposes `document_extraction_id` FK on every entity that originates from a document. Several existing entities (invoices, proposals) have this; extending to vendors, lien_releases, daily_logs, etc. is forward work. Lock by F1.
- **VQ6. Notifications — in-app + email + push?** VISION proposes all three from Wave 3; mobile push waits for native app phase (post-Wave 5).
- **VQ7. Client portal scope — read-only viewer or interactive participant?** VISION leans interactive (CO approval, message reply, photo viewer, draw approval). Lock by Wave 3 phase planning.
- **VQ8. Schedule intelligence (Pillar 3) — when does it become its own phase?** VISION proposes data accumulation passively from Phase 3.5+; intelligence layer lands as Wave 4 after data has 6-12 months to accumulate.

---

**End of VISION.md.**

Cross-references:
- Canonical: `docs/nightwork-plan-canonical-v1.md`
- Operational rules: `CLAUDE.md`
- Master plan: `.planning/MASTER-PLAN.md`
- Current implementation gap: `.planning/architecture/CURRENT-STATE.md` (Stage 1)
- Target architecture: `.planning/architecture/TARGET.md` (Stage 1)
- Foundation phase plan: `.planning/architecture/GAP.md` (Stage 1)
