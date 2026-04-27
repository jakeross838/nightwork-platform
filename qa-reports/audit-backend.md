# Audit — Backend Logic + API Contracts
**Date:** 2026-04-24
**Scope:** `src/app/api/`, `src/lib/api/`, `src/lib/deletion-guards.ts`, `src/lib/supabase/`
**Files reviewed:** 109 route files + 12 lib files (optimistic-lock, errors, deletion-guards, session, impersonation-client, platform-admin, activity-log, service/server/middleware/browser supabase clients)

---

## Summary

The overall backend health is good-to-strong for the core invoice and draw workflows: `getCurrentMembership()` is consistently called before DB access, optimistic locking is used on the 7 highest-traffic PATCH routes, status_history appends are reliable across the financial entity chain, and the impersonation/audit trail is well-designed. The primary structural weaknesses are two CRITICAL missing `org_id` filters on GET routes for Change Orders and Purchase Orders (RLS is the only backstop), a CRITICAL auth bypass in `partial-approve`, a CRITICAL missing org_id filter in all budget-line write paths, and a HIGH-severity vendor merge route that mutates cross-org data without a `getCurrentMembership()` call before the DB writes begin. The remaining findings are medium/low hygiene issues that don't create immediate data leakage but will degrade as the codebase scales.

---

## Findings

### CRITICAL

#### C-1: `GET /api/change-orders/[id]` — no org_id filter, relies on RLS alone
- **Location:** `src/app/api/change-orders/[id]/route.ts:29–58`
- **Finding:** The GET handler calls `supabase.auth.getUser()` for 401 protection but does NOT call `getCurrentMembership()` and does NOT add `.eq("org_id", membership.org_id)` to either the `change_orders` or `change_order_lines` queries. The architecture rule (CLAUDE.md Dev Rules + R.23) explicitly states "every query filters by `membership.org_id` — RLS is a backstop, not primary." If an RLS policy is ever dropped or misconfigured on `change_orders`, any authenticated user of any org can read any other org's change orders by supplying a known UUID.
- **Impact:** Cross-tenant CO data leakage if RLS drops (a known fragility per CONCERNS.md SEC-M-2). Also violates the invariant that the PATCH handler on the same file correctly calls `getCurrentMembership()` — the GET is an inconsistent half.
- **Suggested fix:** Add `const membership = await getCurrentMembership(); if (!membership) throw new ApiError("Not authenticated", 401);` and `.eq("org_id", membership.org_id)` to both the CO query and the `change_order_lines` query.

---

#### C-2: `GET /api/purchase-orders/[id]` — no org_id filter, relies on RLS alone
- **Location:** `src/app/api/purchase-orders/[id]/route.ts:18–62`
- **Finding:** Same pattern as C-1. The GET handler authenticates via `auth.getUser()` but does not call `getCurrentMembership()` and adds no `org_id` filter to the `purchase_orders`, `po_line_items`, or `invoice_line_items` queries. The PATCH and DELETE handlers on the same file do call `getCurrentMembership()` correctly — another asymmetry.
- **Impact:** Cross-tenant PO data leakage if RLS drops. `invoice_line_items` are a join result here, so both PO content and invoice line details could leak.
- **Suggested fix:** Same pattern as C-1: acquire membership at top of GET handler, filter all three queries by `org_id`.

---

#### C-3: `POST /api/invoices/[id]/partial-approve` — auth via `getUser()` only, no membership check, no org_id filter
- **Location:** `src/app/api/invoices/[id]/partial-approve/route.ts:13–17`
- **Finding:** Handler begins `const supabase = createServerClient(); const { data: { user } } = await supabase.auth.getUser(); if (!user) throw new ApiError(...)`. No `getCurrentMembership()` call. The subsequent `invoices` query uses `.eq("id", params.id)` with no `.eq("org_id", ...)`. The child invoice insert inherits `parent.org_id` which is good — but the parent can be fetched from any org. Any authenticated user who knows a target invoice UUID can partially-approve it from a different org.
- **Impact:** A malicious authenticated user from Org B can split and approve an invoice belonging to Org A, advancing it to `qa_review`. Data leakage and unauthorized state mutation.
- **Suggested fix:** Add `getCurrentMembership()`, verify `parent.org_id === membership.org_id`, and add `.eq("org_id", membership.org_id)` to the parent invoice query.

---

#### C-4: `PATCH /api/budget-lines/[id]` and `DELETE /api/budget-lines/[id]` — no org_id filter on write queries
- **Location:** `src/app/api/budget-lines/[id]/route.ts:22–131`
- **Finding:** Both PATCH and DELETE correctly call `getCurrentMembership()` and check `membership.role`. However, neither the fetch query (`.eq("id", params.id)`) nor the UPDATE queries filter by `membership.org_id`. A user from Org B who discovers a budget line UUID from Org A can mutate (overwrite estimates) or soft-delete it.
- **Impact:** Cross-org budget line mutations if RLS drops. The `deletion-guards.ts` call in DELETE is also against the wrong client (service-role, no user session), but the guard itself doesn't re-verify org ownership.
- **Suggested fix:** Add `.eq("org_id", membership.org_id)` to the fetch and every update query. Pattern is consistently used in adjacent routes (`invoices`, `change-orders`).

---

### HIGH

#### H-1: `POST /api/vendors/merge` — `getCurrentMembership()` called AFTER all DB mutations
- **Location:** `src/app/api/vendors/merge/route.ts:13–118`
- **Finding:** The route creates `const supabase = createServerClient()` and then immediately executes three destructive mutations (update invoices, update purchase_orders, soft-delete vendors) before calling `getCurrentMembership()` at line 93 — which is only used for the activity log. Role check (admin/owner required) is never enforced. No org_id filter on any query.
- **Impact:** Any authenticated user, including a read-only `pm` or `accounting` role, can mass-reassign all invoices of a set of vendors and soft-delete those vendors, across any org. This is one of the most destructive endpoints in the codebase and has zero role gate.
- **Suggested fix:** Move `getCurrentMembership()` to the top (before any DB access), gate on `["admin", "owner"]`, and add `.eq("org_id", membership.org_id)` to all three update queries and the primary vendor fetch.

---

#### H-2: `POST /api/invoices/[id]/partial-approve` — no optimistic locking, no status_history on child invoice's final status
- **Location:** `src/app/api/invoices/[id]/partial-approve/route.ts:88–202`
- **Finding:** The parent invoice update (line 174) uses `.update(...)` without `updateWithLock()`. The child invoice is inserted with status_history for `pm_approved → qa_review` but the parent's status_history only appends one entry (`→ pm_held`) without logging the intermediate `pm_approved` step implied by the split. Per R.10, all PATCH/write operations on mutable entities require `expected_updated_at`.
- **Impact:** Lost updates if two sessions are open simultaneously. History is also incomplete — the pm_approved-portion of the split is only on the child, not on the parent's trail.
- **Suggested fix:** Accept `expected_updated_at` in body, use `updateWithLock()` for the parent update. Add a log entry `→ pm_approved (split-approved portion)` to parent history before the `→ pm_held` entry.

---

#### H-3: `POST /api/invoices/payments/bulk` — `mark_paid` does not log status_history, no optimistic locking
- **Location:** `src/app/api/invoices/payments/bulk/route.ts:61–79`
- **Finding:** The `mark_paid` branch fetches invoices with `.eq("org_id", orgId)` (good) then updates each invoice in a loop with `.eq("id", inv.id)` — no `expected_updated_at`, no `updateWithLock()`, and status flip (`→ paid`) is recorded in `logActivity` but the `status_history` JSONB column is never appended. Per R.7, every status mutation appends to `status_history`.
- **Impact:** Bulk payment marks invoices as paid without any status_history entry, breaking the audit trail for every invoice paid through the bulk path. Concurrent bulk-pay of the same invoice also has no conflict detection.
- **Suggested fix:** Append to `status_history` on each invoice (pattern from `/api/invoices/[id]/action`). Use `updateWithLock()` or at minimum a `status != 'paid'` guard per row.

---

#### H-4: `service.ts` — singleton service-role client shared across requests (memory leak + potential session bleed)
- **Location:** `src/lib/supabase/service.ts:9–42`
- **Finding:** `let cached: SupabaseClient | null = null` is a module-level singleton. In a long-running Node.js process (Vercel Edge functions or containerized deployment), this singleton lives for the process lifetime. The Supabase JS client holds internal state including ongoing subscriptions, auth refresh timers, and connection pool state. If the service-role key rotates, the cached stale client continues to be used until the process restarts.
- **Impact:** In practice for Next.js's serverless model this is low risk, but on a self-hosted or warm-instance deployment it could cause key-rotation failures silently. More importantly: the shared instance is used by `deletion-guards.ts` which is called from multiple concurrent requests — the client is designed to be shared and is stateless for plain queries, so this is LOW actual risk in the current deployment model, but is worth noting.
- **Suggested fix:** Document the singleton pattern explicitly with a note about rotation behavior. Consider `createServiceRoleClient()` returning a fresh client each call (cheap; no persistent connection) or adding a stale-check.

---

#### H-5: `GET /api/invoices/[id]` — `pm_users` query has no org_id filter
- **Location:** `src/app/api/invoices/[id]/route.ts:109–114`
- **Finding:** The query `supabase.from("users").select("id, full_name").in("role", ["pm", "admin"])...` fetches all PM/admin users with no `.eq("org_id", membership.org_id)` filter. The `users` table is a Supabase auth.users proxy — if its RLS policy ever dropped, this would leak user names and IDs across tenants.
- **Impact:** Cross-tenant user enumeration (names + UUIDs of PMs from other orgs) if RLS on the `users` view drops.
- **Suggested fix:** Add `.eq("org_id", membership.org_id)` or equivalent org scope to the `pm_users` query.

---

#### H-6: Batch-action `approve` path has no optimistic locking — concurrent approvals can double-advance status
- **Location:** `src/app/api/invoices/batch-action/route.ts:203–232`
- **Finding:** Batch approve updates each invoice with `.update({ status: "qa_review", status_history: [...] }).eq("id", id).eq("org_id", membership.org_id)` — no optimistic lock. If the same invoice is being batch-approved by two PM sessions concurrently, the second write silently overwrites the first (both succeed because the update condition is met as long as the invoice is still in the target org). The `expected_updated_at` field exists in the `ActionRequest` type for the single-invoice action route but is absent from the batch route entirely.
- **Impact:** Duplicate `qa_review` status entries in `status_history` are benign but the JIRA is that the first writer's note may be silently discarded.
- **Suggested fix:** Acceptable tradeoff for batch operations — at minimum document the known limitation or add an idempotency key per batch request. Not blocking.

---

### MEDIUM

#### M-1: `PATCH /api/invoices/[id]` — `expected_updated_at` is optional; comment says "flip to required in a follow-up" but no tracking
- **Location:** `src/lib/api/optimistic-lock.ts:18` + `src/app/api/invoices/[id]/route.ts:158–282`
- **Finding:** `updateWithLock` documents that `expected_updated_at` is optional "so legacy clients keep working" and says the flip to required is in a follow-up. The PATCH handler for invoices does not validate or require it. A client that omits `expected_updated_at` bypasses the lock silently.
- **Impact:** Lost updates possible on multi-user editing if the client doesn't send the field. Not catastrophic (correct clients always send it) but the safety net is never fully engaged.
- **Suggested fix:** Create a tracking issue and flip `expected_updated_at` to required on the invoice PATCH once frontend is confirmed to always send it. Add a lint rule or test that fails if a new PATCH route doesn't include the field.

---

#### M-2: `POST /api/cron/overdue-invoices` — `CRON_SECRET` check is skipped entirely if env var is unset
- **Location:** `src/app/api/cron/overdue-invoices/route.ts:17–24`
- **Finding:** `if (expectedKey) { ... }` means that if `CRON_SECRET` is not set in the environment, _any unauthenticated request_ triggers the cron, iterates all orgs with service-role, and sends notification emails. There is no fallback auth or IP allowlist.
- **Impact:** An external actor can spam all tenants with "overdue invoices" notification emails by repeatedly hitting the endpoint. Low severity in terms of data leakage (read-only + send notification) but can cause operational noise and user confusion.
- **Suggested fix:** Flip the guard: `if (!expectedKey) { return 401; }` — require CRON_SECRET to be set, fail if not. Or add a Vercel cron header check as a secondary gate.

---

#### M-3: `POST /api/vendors/merge` — no guard against merging vendors from different orgs
- **Location:** `src/app/api/vendors/merge/route.ts:36–82`
- **Finding:** The primary vendor is verified to exist (`.eq("id", primary_id).is("deleted_at", null)`). The `merge_ids` are never individually verified to belong to the same org or to exist at all — they're passed directly to `.in("vendor_id", idsToMerge)` across invoices and POs. A caller who submits `merge_ids` from Org A and `primary_id` from Org B will successfully redirect Org A's invoices to Org B's vendor (subject to RLS; RLS is the only backstop here).
- **Impact:** Cross-org invoice/PO re-assignment. Combined with H-1 (no auth gate), this is a serious exploit surface.
- **Suggested fix:** After acquiring membership, verify each `merge_ids` vendor belongs to `membership.org_id`. Combine with H-1 fix.

---

#### M-4: `PATCH /api/invoices/[id]` — `body` is passed directly to `supabase.update(body)` without key-scrubbing after allowlist check
- **Location:** `src/app/api/invoices/[id]/route.ts:243–251`
- **Finding:** The allowlist check at line 171 correctly rejects keys outside `ALLOWED_PATCH_FIELDS`. However, `expected_updated_at` is accepted by `ALLOWED_PATCH_FIELDS` only if it was added there — check: it is NOT in any of the three field sets. The check at line 171 runs `Object.keys(body).filter(k => !ALLOWED_PATCH_FIELDS.has(k))` and then at line 246, the entire `body` is passed to `.update(body)`. If `expected_updated_at` is in the body it will be rejected by the allowlist check (good). But any key not in the allowlist is rejected, so the update only ever contains allowlisted keys. This is actually correct — this finding is a false positive after deeper read. Marking for documentation clarity.
- **Impact:** None — allowlist is correctly enforced. Documenting because the code pattern (pass whole body to update) looks alarming without reading the allowlist gate above.
- **Suggested fix:** Add a comment at line 246: `// body is safe here: non-allowlisted keys were rejected at line 171.`

---

#### M-5: `service.ts` singleton — `tryCreateServiceRoleClient()` falls back to `allowed: true` in deletion guards when key is absent
- **Location:** `src/lib/deletion-guards.ts:41,92,138,165,192,228` + `src/lib/supabase/service.ts:33–42`
- **Finding:** Every guard function begins: `const supabase = tryCreateServiceRoleClient(); if (!supabase) return { allowed: true, blockers: [] };`. When `SUPABASE_SERVICE_ROLE_KEY` is not set (e.g., during CI runs or misconfigured environments), all guard checks silently pass and every deletion/void is allowed. This is a fail-open design.
- **Impact:** In a production deployment where the service key is always set, this is not triggered. But in a CI/staging environment without the key, every void and delete skips its guard entirely. A misconfigured production deploy would fail-open on all deletion guards.
- **Suggested fix:** Log a structured warning (not just silent pass) when the guard short-circuits. Consider throwing rather than returning `allowed: true` when in production (`NODE_ENV === 'production'` and no service key is a configuration error, not a graceful fallback).

---

#### M-6: `GET /api/change-orders/[id]` + `GET /api/purchase-orders/[id]` — use `auth.getUser()` not `getCurrentMembership()`
- **Location:** `src/app/api/change-orders/[id]/route.ts:30–31`, `src/app/api/purchase-orders/[id]/route.ts:19–21`
- **Finding:** Both GET handlers call `supabase.auth.getUser()` directly instead of `getCurrentMembership()`. This confirms they do not have access to `membership.org_id` and therefore cannot filter by it. Already captured as C-1/C-2, but worth noting the root cause: these are legacy-pattern routes that predate the `getCurrentMembership()` convention and were never updated.
- **Impact:** See C-1, C-2.
- **Suggested fix:** Consistent migration to `getCurrentMembership()` pattern as part of C-1/C-2 fix.

---

#### M-7: `POST /api/invoices/payments/bulk` — `mark_paid` updates invoices individually in a loop (N+1 queries)
- **Location:** `src/app/api/invoices/payments/bulk/route.ts:68–80`
- **Finding:** The loop `for (const inv of invs ?? []) { await supabase.from("invoices").update(...).eq("id", inv.id); }` runs one UPDATE per invoice. For the expected batch size of dozens of invoices, this adds latency and roundtrip cost.
- **Impact:** Performance degradation on large batches (100+ invoices). No correctness issue.
- **Suggested fix:** Use a single `.update(payload).in("id", ids)` after validating the payload is uniform. For non-uniform cases (per-invoice `payment_amount` differs), batch via `.upsert()` or a single RPC.

---

#### M-8: `draws/[id]/route.ts` GET — auto-creates budget_lines during a read
- **Location:** `src/app/api/draws/[id]/route.ts:76–103`
- **Finding:** The GET handler for a draw silently inserts `budget_lines` rows for cost codes that appear on draw invoices but don't have an existing budget line. A GET request mutating the database is unexpected, non-idempotent in practice (second call finds the auto-created row), and could create orphaned budget lines with `original_estimate = 0` if the cost code was later removed from the invoice.
- **Impact:** Unexpected side-effects on reads. If a user opens a draw detail page and the budget line creation fails (e.g., DB constraint), the draw page errors on GET. Also creates zero-estimate budget lines that will show up in the budget view as "unbudgeted spend" with no context.
- **Suggested fix:** Extract auto-creation to a POST endpoint (`/api/draws/[id]/repair-budget-lines`) that is explicitly called. The GET should be a pure read. At minimum, log a structured warning when an auto-creation fires so Jake can see what's happening in production.

---

#### M-9: Inconsistent error response shape — some routes use `withApiError`, others use raw try/catch with their own shape
- **Location:** Multiple routes — e.g., `src/app/api/invoices/[id]/action/route.ts` (raw try/catch, line 485), `src/app/api/invoices/batch-action/route.ts` (raw try/catch), vs. `src/app/api/invoices/[id]/route.ts` (`withApiError`)
- **Finding:** The `withApiError` wrapper guarantees `{ error: string }` on any unhandled exception. Routes that use raw try/catch sometimes return `{ error: message }` and sometimes return other shapes. The action route's catch block at line 485 is well-behaved, but inconsistency means frontend consumers can't rely on a single error shape.
- **Impact:** Frontend error toast parsing may miss errors from non-standard shapes. No data leakage.
- **Suggested fix:** Migrate remaining routes to `withApiError`. Low effort; high consistency gain.

---

#### M-10: `POST /api/invoices/[id]/payment` `mark_paid` — status_history not appended when invoice flipped to `paid`
- **Location:** `src/app/api/invoices/[id]/payment/route.ts:165–210`
- **Finding:** When `isFullPay` is true, `updates.status = "paid"` is set and applied via `updateWithLock`. However, `status_history` is never updated in this path — only `logActivity` is written. Per R.7, status mutations must append to `status_history`. The single-invoice payment action at `/api/invoices/[id]/action` correctly appends; this bulk-payment path does not.
- **Impact:** Invoices paid through the single-invoice payment route have no `→ paid` status_history entry. Audit trail gap.
- **Suggested fix:** Before the `updateWithLock` call, fetch current `status_history` and append `{ from: invoice.status, to: 'paid', actor: actor.id, at: now }` to the updates payload.

---

### LOW

#### L-1: `optimistic-lock.ts` — lock conflict re-fetch uses the same `selectCols` as the original update
- **Location:** `src/lib/api/optimistic-lock.ts:54–66`
- **Finding:** When a lock conflict occurs, the fallback re-fetch uses `opts.selectCols ?? "id, updated_at"` which may be a minimal projection (just id + updated_at). The client receives `current: { id, updated_at }` which is correct for reconciliation, but the conflict response could include more fields to let the client display a useful "what changed" diff without an extra round trip.
- **Impact:** UX limitation — user sees "reload to reconcile" but no diff. Low severity.
- **Suggested fix:** Consider adding a `conflictCols` option that allows richer conflict payloads for entity types where the UI shows a diff modal.

---

#### L-2: `POST /api/invoices/[id]/action` — `getWorkflowSettings` failure is silently swallowed
- **Location:** `src/app/api/invoices/[id]/action/route.ts:110–179`
- **Finding:** The entire workflow settings gate is wrapped in a `try/catch` that logs a `console.warn` and falls through. This means if `getWorkflowSettings` throws (e.g., DB is unavailable), invoices that should be blocked by `require_po_linkage` or `require_budget_allocation` will be approved anyway.
- **Impact:** Workflow policy gates fail-open on DB errors. Low probability in practice but semantically wrong.
- **Suggested fix:** Re-throw DB errors (distinguish "settings row not found" from "DB error") so the route fails safely. A missing settings row should use defaults; a DB timeout should 500.

---

#### L-3: `console.warn` / `console.error` in production code paths (pre-existing, not newly introduced)
- **Location:** Multiple routes — already catalogued in `CONCERNS.md` (HIGH: console.warn/error)
- **Finding:** Confirmed present in routes reviewed during this audit: `src/app/api/invoices/[id]/action/route.ts:174,409,471`, `src/app/api/invoices/[id]/route.ts:87`, `src/app/api/vendors/merge/route.ts:59,70,116`, `src/app/api/draws/[id]/action/route.ts:212,238`. CONCERNS.md already captures this; adding a confirmation that the fix has not been applied.
- **Suggested fix:** See CONCERNS.md recommendation — introduce a `src/lib/logging/index.ts` wrapper.

---

#### L-4: Draw `GET` uses service-role client as default for ALL queries, not just the embed-requiring ones
- **Location:** `src/app/api/draws/[id]/route.ts:31`
- **Finding:** `const supabase = tryCreateServiceRoleClient() ?? createServerClient()` is used for all queries including lien_releases, invoices, and budget_lines. Per CONCERNS.md SEC-M-3, the service-role pattern was introduced to fix RLS join failures for deep embeds. However, the service-role client is used even for queries that don't need it (lien_releases, for instance).
- **Impact:** Every query in the draws route runs with full service-role bypassing all RLS. Combined with explicit `org_id` filters this is safe, but any future developer adding a query to this handler may assume they don't need an `org_id` filter because they haven't seen a RLS rejection.
- **Suggested fix:** Use service-role only for the specific queries that require it (cost_codes embed). All other queries should use `createServerClient()`.

---

#### L-5: `batch-action` route does not call `logImpersonatedWrite` per invoice consistently — it does, but only for `success` IDs
- **Location:** `src/app/api/invoices/batch-action/route.ts:316–323`
- **Finding:** `logImpersonatedWrite` is correctly called for each `success` ID. `failed` IDs do not get a log entry, which is expected (no mutation happened). The loop is correct. Low severity — noting for completeness.
- **No fix needed.** Behavior is correct.

---

#### L-6: `draws/[id]/revise` — optimistic locking is manual (direct timestamp comparison) instead of using `updateWithLock`
- **Location:** `src/app/api/draws/[id]/revise/route.ts:59–68`
- **Finding:** The revision route manually checks `if (expectedUpdatedAt && original.updated_at !== expectedUpdatedAt)` and returns a 409 inline. This replicates `updateWithLock` behavior but is not the canonical helper. Inconsistency means future changes to the locking behavior won't be picked up by this route.
- **Suggested fix:** Migrate to `updateWithLock` for the parent draw's status update. Minor refactor.

---

## Positive Observations

- **`getCurrentMembership()` adoption is broad.** 81 of 109 route files call it. The 28 that don't are almost all read-only routes where RLS + `auth.getUser()` is sufficient, or admin routes with their own `requirePlatformAdmin()` guard.
- **Optimistic locking is consistently applied** to the 7 most critical PATCH routes (`change_orders`, `purchase_orders`, `vendors`, `lien_releases`, `invoices/action`, `invoices/payment`, `invoices/allocations`). The `updateWithLock` helper is clean and well-documented.
- **status_history appends are reliable** across the main workflow chain: invoice actions, CO transitions, PO transitions, and draw RPC transitions all correctly append `{from, to, who, when, note}`.
- **Impersonation audit trail** is thorough: `logImpersonatedWrite` is called in every write-path route that uses `getClientForRequest()`, and the cookie tamper-checks in `impersonation-client.ts` are comprehensive.
- **Deletion guards are well-designed.** `canDeleteJob`, `canDeleteBudgetLine`, `canVoidPO`, `canVoidCO`, and `canDeleteCostCode` all correctly traverse dependency chains and return human-readable blocker messages. Guard-blocked attempts are activity-logged.
- **The `withApiError` wrapper pattern** provides a clean, consistent error surface for routes that adopt it — stack traces never reach the client, and HTTP status codes follow REST conventions.
- **PATCH field allowlists** (e.g., the `FINANCIAL_FIELDS` / `PAYMENT_TRACKING_FIELDS` / `ASSIGNMENT_FIELDS` segmentation in `invoices/[id]/route.ts`) are an excellent pattern for preventing schema-column-leakage and are well-documented with inline comments.
- **Cron secret gate** on the overdue-invoices route is present; the weakness (fail-open when unset) is low-probability in production but is flagged as M-2.
