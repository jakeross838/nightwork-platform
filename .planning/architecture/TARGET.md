# Nightwork — TARGET.md

**Status:** Stage 1 architecture document. Last updated 2026-04-29.
**Scope:** The ideal architecture that supports VISION.md, given the realities documented in CURRENT-STATE.md. This is the *destination* — concrete enough to plan migrations against, abstract enough to not lock implementation choices the foundation phases will refine.
**Inputs:** VISION.md (target), CURRENT-STATE.md (reality), canonical plan (precedent), CLAUDE.md (rules).
**Migration posture:** pre-launch + test-data-only per D-007 → aggressive foundation refactors are tractable. The recommendation in §A.2 is **selective wipe-and-reseed for cost codes + a few coexisting tables; incremental migration for everything else.** Justified in §D.

---

## Table of contents

A. Target entity model
B. Target workflow framework
C. Target platform primitives
D. Migration strategy

---

## A. Target entity model

### A.1 The universal envelope (V.1) and what every table looks like

Per VISION.md V.1, every tenant entity gets a canonical shape:

```sql
CREATE TABLE public.{entity} (
  -- Universal envelope (V.1) — columns 1-7, in this order, in every tenant table
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  deleted_at timestamptz,
  status_history jsonb NOT NULL DEFAULT '[]'::jsonb,

  -- Entity-specific columns follow
  ...
);

-- Universal index posture (every table)
CREATE INDEX {entity}_org_active_idx
  ON public.{entity} (org_id)
  WHERE deleted_at IS NULL;

CREATE INDEX {entity}_org_updated_idx
  ON public.{entity} (org_id, updated_at DESC)
  WHERE deleted_at IS NULL;

-- Universal trigger posture
CREATE TRIGGER {entity}_set_updated_at
  BEFORE UPDATE ON public.{entity}
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Universal RLS shape (R.23 3-policy precedent — proposals/00065)
ALTER TABLE public.{entity} ENABLE ROW LEVEL SECURITY;

CREATE POLICY "{entity}_org_select" ON public.{entity}
  FOR SELECT USING (org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid() AND is_active));

CREATE POLICY "{entity}_org_write" ON public.{entity}
  FOR INSERT WITH CHECK (org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid() AND is_active AND role IN (...)))
  -- and UPDATE / DELETE following same shape

-- Platform-admin SELECT bypass
CREATE POLICY "{entity}_platform_admin_select" ON public.{entity}
  FOR SELECT USING (EXISTS (SELECT 1 FROM platform_admins WHERE user_id = auth.uid()));
```

The **2-policy SELECT (org + platform_admin)** is the target — collapses the 7 permissive policies on `invoices` (and 4 on `draws`/`POs`) that drive the dashboard 503 (CURRENT-STATE §E.1). Restrictive write policies handle PM-on-own-jobs / role-set narrowing as separate restrictive layers, which the planner short-circuits cheaply.

### A.2 Coexisting-entity resolution

Per CURRENT-STATE §A.3, five logical concepts have multiple implementations. Resolution targets:

| Coexistence | Target | Migration approach |
|---|---|---|
| Cost codes (`cost_codes` legacy / `canonical_cost_codes` / `org_cost_codes`) | Two tables: `canonical_cost_codes` (read-only spine) + `org_cost_codes` (per-org). Drop `cost_codes`. | **Wipe-and-reseed.** Pre-launch + test-data-only per D-007. Backfill `org_cost_codes` from Drummond's actual cost-code list (extracted from §F fixtures); seed `canonical_code_id` mapping where obvious. |
| User identity (`auth.users` / `profiles` / `users`) | Two tables: `auth.users` (Supabase managed) + `profiles` (identity-scoped extras). Drop `public.users`. Unify role enum (`org_members.role` is canonical). | **Incremental.** Drop `public.users` after grep-confirming zero consumers; reconcile `profiles.role` to delegate to `org_members.role`. |
| Invoice line shape (`invoice_line_items` / `invoice_allocations` / `document_extraction_lines` / `line_cost_components`) | Per-purpose retention with explicit ownership. `invoice_line_items` = display lines (verbatim what the invoice shows). `invoice_allocations` = how it splits across cost codes / base-vs-CO. `document_extraction_lines` = pre-commit AI parse. `line_cost_components` = pricing-intelligence breakdown. Document the relationship in canonical §5.6 and add a join-view `v_invoice_lines_full` for queries that need the unified shape. UCM (canonical §6) generalizes this. | **No-op for now**, document the contract in TARGET. UCM consolidation lands later. |
| `change_order_lines` vs `change_order_budget_lines` | Drop `change_order_budget_lines` (zero rows, zero consumers). | **Wipe-and-drop.** One migration. |
| Role enum divergence | Use `org_members.role` as the single source of truth. `profiles.role` becomes a no-op virtual column or gets dropped. | **Incremental.** |

### A.3 New entities to add (Wave 1+ extensions)

Per VISION.md additions and audit findings:

| Entity | Wave | Justification |
|---|---|---|
| `gl_codes` | Wave 1 | First-class GL accounts; preconditions for QB sync; cleanly maps cost-code spend to GL accounts (per VQ2) |
| `payments` | Wave 1 | Promote from invoice column projection to first-class table; supports partial payments and one-payment-many-invoices |
| `payment_invoices` | Wave 1 | Junction for the partial-payment scenario |
| `approvals` | Wave 1 | Append-only approval-decision log (independent of `approval_chains` which is config) |
| `import_batches` | Wave 1 | Generic import framework; replaces `invoice_import_batches` per CURRENT-STATE §E.2 |
| `idempotency_keys` | Foundation | Idempotency-Key header dedup |
| `schedule_items`, `schedule_baselines` | Wave 2 | Schedule entity foundation |
| `tasks` | Wave 2 | General task entity |
| `punchlist_items` | Wave 2 | Punchlist with QC-permanence rule (CLAUDE.md) |
| `daily_logs`, `daily_log_photos` | Wave 2 | Daily log entity + media |
| `photos` | Wave 2 | First-class photo store with EXIF + geo |
| `documents` | Wave 2 | General document store (lift docs out of per-entity ad-hoc columns) |
| `emails`, `email_attachments` | Wave 3 | Email-intake entity (replaces scaffold-only `email_inbox`) |
| `messages`, `message_threads` | Wave 3 | Internal team messaging |
| `weekly_updates` | Wave 3 | Auto-generated client communications |
| `notifications_preferences` | Wave 3 | Per-user notification preferences |
| `vendor_pricing_observations` | Wave 4 | Materialized rollup of `pricing_history` + `vendor_item_pricing` |
| `market_pricing_reference` | Wave 4 | External pricing data (RSMeans-style) |
| `performance_metrics` | Wave 4 | Org KPIs |
| `custom_reports` | Wave 4 | User-defined reports |
| `snapshots` | Wave 4+ | Point-in-time materialized entity state |

### A.4 Index plan as a first-class artifact

Per CLAUDE.md "every aggregation has an index plan in the same migration": every new entity migration must declare:

```sql
-- Universal envelope indexes (mandatory)
{entity}_org_active_idx       -- (org_id) WHERE deleted_at IS NULL
{entity}_org_updated_idx      -- (org_id, updated_at DESC) WHERE deleted_at IS NULL

-- Entity-specific indexes (per migration, justified by aggregation queries)
{entity}_job_id_idx           -- if job-scoped
{entity}_status_idx           -- if status-routed
{entity}_created_at_brin_idx  -- if append-mostly + range-queried
```

A pre-merge gate (foundation phase F2 work — see GAP.md) runs `EXPLAIN ANALYZE` on representative queries against representative test data and fails the gate if any aggregation query goes sequential.

### A.5 RLS posture targets

Per CURRENT-STATE §E.1, the dashboard 503 is policy-stack planning overhead. Targets:

1. **Single permissive `org_isolation` SELECT policy per table** — replaces the multi-policy stacks
2. **Restrictive write policies for role-set narrowing** — PM-on-own-jobs, accounting-only, owner/admin-only get expressed as restrictive layers, which the planner short-circuits
3. **Platform-admin SELECT bypass as a separate permissive policy** — clean override path
4. **R.23 3-policy precedent (proposals/00065) is the canonical shape** — every new table follows it; existing tables get retroactively flattened

The flattening is cross-cutting (touches every tenant table) and routes through `/nightwork-propagate`.

### A.6 Export and import schemas (V.2)

Every entity gets two Zod schemas in `src/lib/portability/schemas/`:

```typescript
// src/lib/portability/schemas/invoice.ts
export const InvoiceExportSchema = z.object({
  envelope: EnvelopeSchema, // id, org_id, created_at, updated_at, created_by, deleted_at, status_history
  attributes: z.object({
    invoice_number: z.string().nullable(),
    invoice_date: z.string().date().nullable(),
    total_amount_cents: z.bigint(),
    // ... entity-specific fields
  }),
  relationships: z.object({
    job_id: z.string().uuid(),
    vendor_id: z.string().uuid(),
    cost_code_id: z.string().uuid().nullable(),
    // ...
  }),
  children: z.object({
    line_items: z.array(InvoiceLineItemExportSchema),
    allocations: z.array(InvoiceAllocationExportSchema),
  }),
  source_document: z.object({
    storage_url: z.string().url().optional(),  // signed URL, 7-day TTL
    document_extraction_id: z.string().uuid().nullable(),
  }),
});

export const InvoiceImportSchema = InvoiceExportSchema.extend({
  // import-specific overrides — natural-key idempotency tuple
  idempotency: z.object({
    natural_key: z.tuple([
      z.string(), // vendor_id
      z.string().nullable(), // invoice_number
      z.string().date().nullable(), // invoice_date
      z.bigint(), // total_amount_cents
    ]),
  }),
});
```

Round-trip property: `Import(Export(entity)) === entity` modulo audit-log entries. Test enforced.

---

## B. Target workflow framework

### B.1 The single state-transition helper

Per CURRENT-STATE §B.1 #4, today every workflow route hand-rolls status_history JSONB writes and `activity_log` writes separately. Target:

```typescript
// src/lib/workflow/transition.ts
import type { Membership } from '../auth/types';

export interface TransitionArgs<T> {
  table: string;                      // e.g., 'invoices'
  id: string;
  expected_updated_at: string;        // optimistic lock per R.10
  newStatus: string;                  // target status
  reason?: string;                    // user-provided rationale
  comment?: string;                   // additional note
  membership: Membership;             // who's acting
  validate?: (row: T) => Promise<void>; // entity-specific validation hook (R.6 guards)
  cascade?: (tx: Transaction, row: T, newRow: T) => Promise<void>; // entity-specific cascade
  postCommit?: (newRow: T) => Promise<void>; // notification triggers, etc.
}

export interface TransitionResult<T> {
  row: T;
  previous_status: string;
  new_status: string;
  status_history_entry: StatusHistoryEntry;
  activity_log_id: string;
}

export async function transitionEntity<T>(
  args: TransitionArgs<T>
): Promise<TransitionResult<T>> {
  return await withTransaction(async (tx) => {
    // 1. Load row + optimistic-lock check (R.10)
    const row = await tx.from(args.table).select('*').eq('id', args.id).single();
    if (row.updated_at !== args.expected_updated_at) {
      throw new ConflictError(409, row);
    }

    // 2. Guard check (R.6) — ensures destructive actions blocked when linked records exist
    if (args.validate) await args.validate(row);

    // 3. Compute status_history JSONB entry (R.7)
    const entry = buildStatusHistoryEntry({
      from: row.status,
      to: args.newStatus,
      actor_user_id: args.membership.user_id,
      at: new Date().toISOString(),
      reason: args.reason,
      comment: args.comment,
    });

    // 4. Apply UPDATE setting status + appending status_history
    const newRow = await tx.from(args.table).update({
      status: args.newStatus,
      status_history: sql`status_history || ${jsonb([entry])}::jsonb`,
      updated_at: new Date().toISOString(),
    }).eq('id', args.id).returning('*').single();

    // 5. Cascade (e.g., draw send_back cascading to invoice un-approval) — atomic in same tx
    if (args.cascade) await args.cascade(tx, row, newRow);

    // 6. Recalc dependent aggregates from source rows (R.2)
    // (Done by triggers where defined; transition helper just fires the read-recompute hint)

    // 7. Activity-log row
    const log = await tx.from('activity_log').insert({
      org_id: args.membership.org_id,
      actor_user_id: args.membership.user_id,
      entity_type: args.table,
      entity_id: args.id,
      action: 'status_change',
      before_payload: { status: row.status },
      after_payload: { status: args.newStatus, reason: args.reason, comment: args.comment },
    }).returning('id').single();

    return { row: newRow, previous_status: row.status, new_status: args.newStatus, status_history_entry: entry, activity_log_id: log.id };
  }).then(async (result) => {
    // 8. Post-commit hook for non-atomic side effects (notifications, exports, etc.)
    if (args.postCommit) await args.postCommit(result.row);
    return result;
  });
}
```

Every workflow API route delegates to this helper. The send_back cascade (CURRENT-STATE §B.1 #5) becomes `args.cascade` running inside the same transaction. No more partial-failure trap states.

### B.2 The approval framework

Per CURRENT-STATE §B.1 #1, `approval_chains` is dead config. Target:

```typescript
// src/lib/workflow/approvals.ts

export async function startApprovalFlow({
  entity_type, entity_id, workflow_type, membership
}): Promise<ApprovalFlow> {
  // 1. Load org's approval_chains row for this workflow_type (e.g., 'invoice_pm')
  const chain = await loadApprovalChain(membership.org_id, workflow_type);

  // 2. For each step, create an `approvals` row with status=pending
  for (const [stepIndex, step] of chain.steps.entries()) {
    const eligibleActors = await resolveStepActors(step, membership.org_id);
    await tx.from('approvals').insert({
      entity_type, entity_id, workflow_type,
      step_index: stepIndex,
      required_role: step.required_role,
      required_count: step.required_count,
      threshold_amount: step.threshold_amount,
      eligible_actor_ids: eligibleActors.map(a => a.user_id),
      status: 'pending',
    });
  }

  // 3. Return the chain state
  return { chain, current_step: 0, decisions: [] };
}

export async function recordApprovalDecision({
  approval_id, decision /* approve | reject | kickback */, note, membership
}): Promise<ApprovalResult> {
  // 1. Load the open `approvals` row
  // 2. Verify membership.user_id is in eligible_actor_ids and decision not already made
  // 3. Append decision to approvals.decisions JSONB array
  // 4. Check if step's required_count met → if yes, advance entity status; if reject → entity → draft; if kickback → entity → previous-step
  // 5. transitionEntity() to update entity status accordingly
  // 6. Notify next-step actors (postCommit hook)
}
```

This generalizes today's hard-coded PM→QA flow on invoices to every approvable entity. `approval_chains` (00070) becomes load-bearing.

### B.3 The classify-extract-commit pipeline (canonical §7) generalized

Per VISION.md V.3, every entity that originates from a document goes through the pipeline. Target framework:

```typescript
// src/lib/ingestion/extractor-registry.ts
type ExtractorRegistry = {
  invoice: InvoiceExtractor;
  proposal: ProposalExtractor;
  change_order: ChangeOrderExtractor;
  vendor: VendorExtractor;
  budget: BudgetExtractor;
  historical_draw: HistoricalDrawExtractor;
  lien_release: LienReleaseExtractor;
  daily_log: DailyLogExtractor; // OCR-based
};

interface DocumentExtractor<T> {
  type: keyof ExtractorRegistry;
  classify(file: File): Promise<{ classified_type: string; confidence: number }>;
  extract(extraction_id: string, file: File): Promise<T>;
  commit(extraction_id: string, edited_data: T, membership: Membership): Promise<{ entity_id: string }>;
}
```

New extractors (CO, vendor, budget, lien_release, daily_log) plug into the registry without touching the ingest route or the review-surface scaffolding. The `/api/ingest` → classifier → per-type extractor → review-surface → commit chain is single-path for every document type.

### B.4 Idempotency built into the framework

Per V.2 + canonical idempotency requirements:

```typescript
// src/lib/api/idempotency.ts

export function withIdempotency(handler: APIHandler): APIHandler {
  return async (req) => {
    const key = req.headers.get('Idempotency-Key');
    if (!key) return handler(req);

    const existing = await checkIdempotencyKey(req.user.org_id, key);
    if (existing) return Response.json(existing.cached_response, { status: existing.cached_status });

    const response = await handler(req);
    await storeIdempotencyKey(req.user.org_id, key, response, ttl=24*3600);
    return response;
  };
}
```

Universal wrapper. Stripe webhook gets idempotency on `event.id`. Imports get idempotency on entity natural keys per V.2. Rate limit at ingestion routes wraps this further.

### B.5 Error-handling middleware

```typescript
// src/lib/api/handler.ts
export const apiHandler = (h: APIHandler) =>
  withErrorBoundary(
    withSentry(
      withRateLimit(
        withIdempotency(
          withAuth(
            withAuditWrap(h)
          )
        )
      )
    )
  );
```

Each layer is independent; order matters: auth before audit (audit logs the actor); idempotency before audit (don't double-log on retry); rate-limit before idempotency (don't cache 429s).

### B.6 Recalculation chains

Per R.2, every derived value recomputes from source. Implementation:

```typescript
// src/lib/workflow/recalc.ts

export async function recalcBudgetLine(budget_line_id: string): Promise<BudgetLineComputed> {
  // SELECT SUM (...) from invoice_allocations + draw_line_items + change_order_budget_lines
  // — never UPDATE-ADD an existing row's running total
  return computed;
}

export async function recalcJobApprovedCOTotal(job_id: string): Promise<number> {
  // SELECT SUM(amount + gc_fee_amount) WHERE status='approved'
  // (Trigger-maintained per CLAUDE.md migration 00042 — the canonical R.2 exception)
  // Helper exists for the rare case where the trigger needs manual re-fire.
}
```

The trigger-maintained caches enumerated in CURRENT-STATE §B.1 #2 get audited: each gets a rationale comment per CLAUDE.md, and any without a strong rationale gets converted to read-time recompute.

---

## C. Target platform primitives

### C.1 File structure

```
src/
├── app/
│   ├── api/                    # API routes — all business logic
│   │   ├── {entity}/           # entity-specific routes
│   │   ├── ingest/             # document upload pipeline
│   │   ├── orgs/[id]/export/   # data portability per V.2
│   │   ├── webhooks/           # external (Stripe, Resend inbound, future QB)
│   │   └── health/             # liveness/readiness
│   ├── (authenticated)/        # auth-required app surfaces
│   ├── (public)/               # marketing, login, signup
│   └── (platform-admin)/       # cross-tenant ops surfaces
├── components/
│   ├── ui/                     # shadcn primitives
│   ├── review/                 # invoice-review-template-extending review surfaces
│   ├── tables/                 # data tables
│   └── forms/                  # form helpers
├── lib/
│   ├── api/                    # handler.ts, idempotency.ts, rate-limit.ts, error.ts
│   ├── auth/                   # getCurrentMembership.ts, requireRole.ts, capabilities.ts
│   ├── audit/                  # log.ts (writes activity_log)
│   ├── workflow/               # transition.ts, approvals.ts, recalc.ts, guards.ts
│   ├── ingestion/              # classify.ts, extractors/, commit.ts
│   ├── portability/            # exports.ts, imports.ts, schemas/
│   ├── jobs/                   # background-job helpers (Inngest functions)
│   ├── observability/          # sentry.ts, structured-logger.ts
│   ├── search/                 # tsvector helpers + future pgvector search
│   ├── storage/                # supabase storage helpers (signed URLs, bucket conventions)
│   ├── notifications/          # delivery (Resend), preferences, fan-out
│   ├── supabase/               # client factories (server, browser, service-role)
│   └── types/                  # generated DB types + domain types
└── middleware.ts               # request-level (Sentry tags, impersonation, platform-admin)

supabase/
├── migrations/                 # numbered DDL (R.16)
└── seed.sql                    # idempotent seed for canonical_cost_codes, etc.

__tests__/
├── api/                        # HTTP integration tests (the canonical §12 #9 gap to fill)
├── lib/                        # unit tests
├── fixtures/                   # synthetic per R.21
└── e2e/                        # full Drummond walk-throughs
```

### C.2 API conventions (api-design skill principles)

Per the api-design skill in this repo:

- **Resource-oriented URIs**: `/api/jobs/[id]`, `/api/jobs/[id]/invoices`, never `/api/getInvoicesForJob`
- **HTTP semantics**: GET for reads, POST for creates, PATCH for partial updates, PUT for full replacements (rare), DELETE for soft-delete
- **Status codes**: 200 OK, 201 Created, 204 No Content, 400 validation error, 401 unauth, 403 forbidden, 404 not found, 409 conflict (optimistic lock or duplicate idempotency-key with different payload), 422 unprocessable, 429 rate-limited, 500 unexpected
- **Pagination**: cursor-based (`?cursor=...&limit=...`) for time-ordered lists; offset-based (`?page=...&limit=...`) for static-ordered lists
- **Filtering**: `?status=...&job_id=...&created_after=...` — flat query params, parsed via Zod; complex filters via POST + body
- **Error responses**: `{ error: { code, message, details? } }` consistently
- **Versioning**: header-based (`X-API-Version: 2026-04`) when needed; otherwise URL stays stable. Deprecation via 410 Gone with successor URL.
- **Rate limiting headers**: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`, `Retry-After` on 429

Every route uses the `apiHandler` wrapper (B.5) and Zod-validates its body/query.

### C.3 Observability plan

| Layer | Mechanism | Status |
|---|---|---|
| Errors | Sentry — already in stack; tag `user_id`, `org_id`, `request_id`, `impersonation_active`, `platform_admin` | TIGHTEN: hook into `withApiError`; assert SENTRY_DSN at startup; raise sample rate during incident |
| Structured logs | Pino (or similar) JSON logging to stdout; Vercel ingests | NEW: replace 100+ ad-hoc `console.warn`/`console.error` with structured logger |
| Traces | Sentry tracing (OpenTelemetry-compat); spans for `api_route → db_query → claude_api_call` | TIGHTEN: ensure Claude API calls are spanned; add bg-job spans |
| Metrics | Vercel Analytics for HTTP; Postgres queries for business metrics | TIGHTEN: add per-route p50/p95/p99 dashboard; per-org cost dashboard |
| Audit log | `activity_log` table | TIGHTEN: cover 100% of mutations (current 31/119) |

### C.4 Background jobs

**Recommendation: Inngest as primary + pg_cron for periodic.** Justified vs alternatives:

| Option | Best for | Why not primary |
|---|---|---|
| **Inngest** ★ | Event-driven workflows, durable execution, Next.js-native | — (recommended) |
| Trigger.dev | Same niche as Inngest, slightly heavier infra | Slightly more expensive at scale; Inngest's free tier suffices for first 10 orgs |
| pg-boss | In-database, no new infra | Limited to Postgres throughput; no fan-out/fan-in primitives; no built-in retries with exponential backoff |
| pg_cron | Periodic maintenance (cleanup, rollups) | Not for app-event jobs; complementary to Inngest, not replacement |
| Supabase Edge Functions + cron | Free, in-stack | No durable retries; not great for multi-step workflows |

Implementation:

```typescript
// src/lib/jobs/inngest.ts
import { Inngest } from "inngest";
export const inngest = new Inngest({ id: "nightwork" });

// Event-driven jobs
export const onInvoiceCommitted = inngest.createFunction(
  { id: "invoice/post-commit", concurrency: 50, retries: 3 },
  { event: "invoice/committed" },
  async ({ event, step }) => {
    await step.run("update-pricing-history", () => populatePricingHistory(event.data.invoice_id));
    await step.run("recalc-budget-line", () => recalcBudgetLine(event.data.budget_line_id));
    await step.run("notify-pm", () => notifyPmInvoiceCommitted(event.data));
  }
);
```

```sql
-- pg_cron periodic maintenance
SELECT cron.schedule('cleanup-stale-imports', '0 3 * * *', $$
  SELECT cleanup_stale_import_errors();
$$);

SELECT cron.schedule('refresh-dashboard-mv', '* * * * *', $$
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_dashboard_metrics;
$$);
```

### C.5 Permission system

```typescript
// src/lib/auth/capabilities.ts

type Capability = `${Action}:${EntityType}`;
type Role = 'owner' | 'admin' | 'pm' | 'accounting' | 'owner_view';

const DEFAULT_CAPABILITIES: Record<Role, Capability[]> = {
  owner: ['*:*'],
  admin: ['*:*'],
  pm: ['read:job', 'update:job_own', 'create:invoice', 'approve:invoice_pm', /* ... */],
  accounting: ['read:*', 'create:invoice', 'approve:invoice_qa', 'create:draw', 'submit:draw', /* ... */],
  owner_view: ['read:dashboard', 'read:draw_summary', 'approve:draw_owner', /* ... */],
};

export async function hasPermission(
  membership: Membership,
  action: Action,
  entity_type: EntityType,
  entity_id?: string
): Promise<boolean> {
  // 1. Look up org-specific override in org_workflow_settings.role_permissions JSONB
  const orgOverrides = await loadOrgPermissionOverrides(membership.org_id);
  const capabilities = orgOverrides[membership.role] ?? DEFAULT_CAPABILITIES[membership.role];

  // 2. Match ('*' wildcards allowed)
  return matchesCapability(capabilities, `${action}:${entity_type}`, { entity_id, membership });
}

export function requireRole(roles: Role[]) {
  return async (req) => {
    const membership = await getCurrentMembership(req);
    if (!roles.includes(membership.role)) throw new ForbiddenError();
    return membership;
  };
}
```

Per-route usage:
```typescript
export const POST = apiHandler(async (req) => {
  const membership = await requireRole(['owner', 'admin', 'pm'])(req);
  if (!await hasPermission(membership, 'approve', 'invoice', body.invoice_id))
    throw new ForbiddenError();
  // ... business logic
});
```

### C.6 Caching strategy

| Cache | Storage | TTL / Invalidation |
|---|---|---|
| Edge HTML (marketing surfaces) | Vercel Edge | Stale-while-revalidate 60s |
| `org_settings` (read-heavy) | Vercel KV | Invalidate on `organizations.settings_version` bump |
| Dashboard metrics | Postgres materialized view + pg_cron | Refresh every 60s |
| Per-request user/org/membership | Request-scoped (React cache or AsyncLocalStorage) | Per request |
| AI parse results | `document_extractions.extracted_data` JSONB | Invalidate on `extraction_prompt_version` bump (canonical §7.3) |
| Idempotency keys | Vercel KV (Redis-compat) | 24h TTL |
| Rate-limit counters | Vercel KV | Sliding-window |

Optimistic UI on the client uses `expected_updated_at` round-trips — no separate client cache layer needed.

### C.7 Data portability framework (V.2)

```
src/lib/portability/
├── schemas/                 # Zod schemas per entity (export + import)
├── exports.ts               # exportEntity(entity_type, id) → ExportEnvelope
├── imports.ts               # importEntity(entity_type, ExportEnvelope) → ImportResult
├── tarball.ts               # multi-entity tarball builder (org export)
└── triggers.ts              # post-import workflow triggers (per D-008)
```

The framework is the foundation for:
- Per-tenant exports (V.2)
- Cross-org migrations
- Backup/restore
- Bulk imports (CSV → ExportEnvelope adapter)
- Drummond fixture replay (re-importing the synthetic Drummond data into a fresh test org)
- Data retention purges (export-then-purge for soft-deleted entities past TTL)

---

## D. Migration strategy

### D.1 Migration posture per D-007

Pre-launch + test-data-only allows aggressive refactors. Per nwrp7.txt, "recommend wipe-and-reseed for foundation phases vs incremental migration." Recommendation: **selective.**

| Refactor | Approach | Justification |
|---|---|---|
| Cost-code triple-table → two-table | **Wipe + reseed** | Production cost codes for Ross Built can be re-derived from Drummond fixtures; org_cost_codes is mostly synthetic (12 rows of test data). One-shot migration. Drummond's real cost codes get backfilled cleanly. |
| Drop `change_order_budget_lines` | **Wipe + drop** | Zero rows, zero consumers. One-line migration. |
| Drop `public.users` | **Incremental** | Need to grep-and-confirm zero consumers first. May reveal stale code paths. |
| RLS policy-stack collapse | **Cross-cutting via /nightwork-propagate** | Touches every tenant table; route through the propagate orchestrator with blast-radius analysis. |
| Universal envelope V.1 retrofit | **Per-table audit + migrations** | Most tables already have envelope (id, org_id, timestamps, deleted_at, status_history). The few missing columns (e.g., `lien_releases.status_history`) get individual migrations. |
| Universal export/import V.2 | **Greenfield framework + per-entity adapters** | Build the framework first (foundation phase F3 work); add adapters per-entity as touched. No wipe needed. |
| Dead-code cleanup (orphan files, console.log) | **Incremental** | Grep + delete; no schema impact. |
| approval_chains wiring | **Incremental** | Build the helper, migrate one entity (invoices) end-to-end, then propagate to other entities. |

### D.2 Migration sequencing

The full sequence (refined in GAP.md F1-F4):

1. **Foundation R.0 — Prep** (one phase, 1-2 days)
   - Drop `change_order_budget_lines` (wipe + drop)
   - Add missing universal-envelope columns where missing (e.g., `lien_releases.status_history`)
   - 5-min docx-html auth fix (canonical Q7)

2. **F1 — Unified entity model** (per MASTER-PLAN.md §8 default)
   - Cost-code consolidation (wipe + reseed)
   - Drop `public.users` (incremental)
   - Promote `payments` to first-class table; junction `payment_invoices`
   - Add `gl_codes` table (VQ2)
   - Add `approvals` table (V.2 dependency)
   - Document the invoice-line-shape contract (no schema change; canonical §5.6 update)

3. **F2 — Workflow framework**
   - Implement `transitionEntity` helper
   - Migrate every workflow route to use it (incremental)
   - Implement approval framework (`startApprovalFlow`, `recordApprovalDecision`)
   - Wire `approval_chains` for invoice flow first, then propagate

4. **F3 — Platform primitives**
   - Inngest setup (background jobs)
   - pg_cron setup (periodic maintenance)
   - Idempotency-Key middleware
   - Rate-limit middleware
   - Structured logger + replace 100+ console.* calls
   - Sentry tightening (SENTRY_DSN startup assert, hook into withApiError)
   - Data portability framework (V.2 framework, no per-entity adapters yet)
   - RLS policy-stack collapse via /nightwork-propagate

5. **F4 — Existing code refactor**
   - `requireRole()` adoption across 92 routes
   - `withOrg(supabase)` wrapper to reduce 200+ `.eq('org_id', …)` repetitions
   - UI uniformity sweep — bring `/change-orders/[id]` and `/draws/[id]` into invoice-template alignment
   - Audit-log coverage gap closure (31/119 → 119/119 mutation routes)
   - Fix `lien_releases` R.7 violation (status_history JSONB column)
   - Approval-chains wiring across remaining workflow entities

### D.3 Atomicity and verification

Per CLAUDE.md / R.16 / R.17:
- Every migration is a numbered SQL file in `supabase/migrations/`
- Every migration has a `.down.sql` paired (from 00060+ established pattern)
- Atomic commits (R.17): one logical change per commit, paired migration + code change in same commit when both move together
- Verification per migration: `EXPLAIN ANALYZE` on aggregation queries; row-count assertions; RLS policy assertions

A foundation-phase verification harness (built in F2 or F3) automates this:

```typescript
// __tests__/migrations/{NNNNN}.test.ts
test('migration NNNNN — cost code consolidation', async () => {
  await applyMigration('NNNNN');
  await expect(query('SELECT COUNT(*) FROM cost_codes')).rejects.toThrow(); // dropped
  await expect(query('SELECT COUNT(*) FROM org_cost_codes')).resolves.toBeGreaterThan(0);
  // RLS assertions
  await expectRLSPolicyShape('org_cost_codes', '3-policy + platform-admin SELECT');
});
```

### D.4 Pre-launch + test-data-only regret-recovery

Per D-007 + R.21 (synthetic test fixtures, never production-shaped data):

The biggest risk in aggressive wipe-and-reseed is regret — we drop something Jake later realizes mattered. Mitigation:

1. **Drummond fixture set is preserved** (Source 1 P-drive untouched, Source 2 exported to gitignored JSON, Source 3 inventoried) — every wipe can re-seed from these
2. **Every wipe-and-reseed migration includes a `.down.sql` that restores the prior shape with empty data** — code can be reverted; data can be re-imported via V.2 framework
3. **No customer data exists in production yet** (D-007) — wipe of test data is reversible by re-running the seed scripts
4. **Backup snapshots before each foundation phase** — Supabase point-in-time recovery covers the rest

### D.5 Acceptance criteria for "foundation complete"

Per D-015 (acceptance criteria are required), the foundation is complete when:

1. ✅ Cost-code consolidation done (one canonical + one org table)
2. ✅ All trigger-maintained caches have rationale comments OR are converted to read-time
3. ✅ Universal envelope V.1 audit passes (every tenant table has the 7 columns)
4. ✅ `transitionEntity` helper used by ≥80% of workflow API routes
5. ✅ `approval_chains` wired for invoice + draw + CO workflows
6. ✅ Inngest set up; first event-driven job runs (e.g., notification fan-out)
7. ✅ pg_cron schedules in place (cleanup_stale_imports, MV refresh)
8. ✅ Idempotency middleware live; Stripe webhook deduped on event.id
9. ✅ Rate limit middleware live; per-org/per-user/per-IP caps in place
10. ✅ Structured logger live; ≤10 ad-hoc `console.*` calls remaining
11. ✅ Sentry asserts SENTRY_DSN at startup; hooks into withApiError
12. ✅ Data portability framework (V.2) framework complete; ≥3 entities have export/import adapters (jobs, vendors, invoices)
13. ✅ RLS policy-stack collapse done; dashboard p95 < 2s on representative load
14. ✅ Audit-log coverage 95%+ of mutation routes
15. ✅ `requireRole` used in ≥80% of role-gated routes
16. ✅ `withOrg(supabase)` wrapper exists; ≥80% of routes use it
17. ✅ UI uniformity 4/4 — every review surface extends the invoice template
18. ✅ `lien_releases.status_history` JSONB added; R.7 violation closed
19. ✅ HTTP integration tests exist for the 10 most-used routes
20. ✅ CI test gate live (GitHub Actions or Vercel pre-build hook)

GAP.md sequences these into F1-F4 phases.

---

**End of TARGET.md.**

Cross-references:
- Vision: `.planning/architecture/VISION.md`
- Current state: `.planning/architecture/CURRENT-STATE.md`
- Foundation phase plan: `.planning/architecture/GAP.md` (next)
- Canonical: `docs/nightwork-plan-canonical-v1.md`
- Operational rules: `CLAUDE.md`
