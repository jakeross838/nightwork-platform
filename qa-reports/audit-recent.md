# Audit — Recent Un-QA'd Work (commits since bb6eb78)
**Date:** 2026-04-24
**Scope:** Unified invoice detail page rebuild + allocations editor + PATCH hardening + migration 00078
**Commits audited:** 6 (d134d11 → ab690f1)
**Uncommitted files:** None — all three files listed in the pre-session git status (allocations/route.ts, invoice-allocations-editor.tsx, 00078 migration) were committed in ab690f1. Only `.planning/` is untracked (non-code planning notes).

---

## Summary

The work is **conditionally ready for QA** — the PATCH hardening and migration are sound, but two HIGH issues must be confirmed/fixed before PM testing: (1) the PATCH route silently omits `expected_updated_at` (optimistic locking), violating the architecture rule in CLAUDE.md; and (2) the allocations GET route does not filter by `org_id` before executing the backward-compat auto-create INSERT path, creating a potential cross-org data write risk. Both are fixable without schema changes. All other findings are Medium or below.

---

## Findings

### CRITICAL

None identified.

---

### HIGH

#### R-1: PATCH /invoices/[id] missing optimistic lock (`expected_updated_at`)
- **Commit:** `7202368`
- **Location:** `src/app/api/invoices/[id]/route.ts` — entire PATCH handler
- **Finding:** The commit message explicitly calls out "lock check" but refers to the *workflow* lock (status-based). The architecture rule in CLAUDE.md states: "Write endpoints accept `expected_updated_at` for optimistic locking. Use `updateWithLock()` in src/lib/api/optimistic-lock.ts. Stale writes return 409 with the current row so the client can reconcile." Every other write endpoint in the codebase (vendors/[id], purchase-orders/[id], change-orders/[id], draws/[id]/action, lien-releases/[id], invoices/[id]/payment) implements this. The PATCH route performs a raw `.update(body)` without reading or comparing `expected_updated_at`. If two users (e.g. PM and accounting) edit the same invoice simultaneously, the second save silently overwrites the first with no 409.
- **Impact:** Last-write-wins data loss on concurrent edits. This is especially acute for the `vendor_name_raw` and `description` fields that accounting and PM can both edit on QA-review invoices. No client-side reconcile opportunity.
- **Suggested fix:** Import `updateWithLock` from `src/lib/api/optimistic-lock.ts`. Accept `expected_updated_at` in the request body (optional, per `updateWithLock` contract). Replace the raw `.update(body).eq(...).select().single()` call with `updateWithLock(supabase, { table: "invoices", id: params.id, data: body, expectedUpdatedAt: body.expected_updated_at ?? null })`. The client does not yet send `expected_updated_at`, but the route being ready for it is the architecture requirement.

---

#### R-2: Allocations GET auto-create path does not filter by `org_id`
- **Commit:** `ab690f1`
- **Location:** `src/app/api/invoices/[id]/allocations/route.ts:115–124` (INSERT of auto-created rows)
- **Finding:** The GET handler verifies `invoice.org_id !== membership.org_id` before proceeding, which is correct. However the auto-create INSERT path at line 115 uses `supabase` (a user-session Supabase client, not service-role), so RLS *should* catch a cross-org write. The risk is that the `invoice_allocations` table's INSERT policy may not verify `org_id` on the allocation row itself — the allocation rows inserted do not carry `org_id`, they carry `invoice_id`. If RLS on `invoice_allocations` is only `invoice_id`-scoped (which is likely given the table predates Phase D), an impersonated session or a bug in the membership check could write allocations for an invoice belonging to a different org without a database-level rejection. The GET itself does check org membership before reaching the INSERT, but the defense-in-depth property (CLAUDE.md: "Every API route uses `getCurrentMembership()` before DB access. RLS alone is a backstop, not a substitute") is inverted here — the app-layer check is the only guard.
- **Impact:** If a future refactor or test creates a request with `membership.org_id` different from the invoice's org, the INSERT executes. Not currently exploitable from the UI, but fragile.
- **Suggested fix:** Confirm whether `invoice_allocations` has an org-scoped INSERT RLS policy. If not, add one. As a belt-and-suspenders measure, short-circuit the entire backward-compat block with `if (invoice.org_id !== membership.org_id) throw new ApiError("Invoice not found", 404)` before the INSERT (the existing check at line 38 already does this, but an explicit guard in the backward-compat block makes the intent clearer). Also: the GET uses `createServerClient()` (user-session), not `tryCreateServiceRoleClient()` — consistent with the service-role pattern used by the main invoice GET for deep joins, but here the caller does multiple INSERTs which should propagate RLS. Verify the INSERT policy.

---

### MEDIUM

#### R-3: `cost_code_id` column missing from `invoice_allocations` rows (org_id absent by design, but audit trail is incomplete)
- **Commit:** `ab690f1`
- **Location:** `src/app/api/invoices/[id]/allocations/route.ts:107–114`
- **Finding:** The auto-create INSERT does not include `org_id` in the allocation rows because the `invoice_allocations` table apparently doesn't carry `org_id` (the SELECT at line 44 doesn't fetch it, and the INSERT at line 107 omits it). This deviates from the CLAUDE.md architecture rule: "Every record: `id`, `created_at`, `updated_at`, `created_by`, `org_id`." If this is an intentional design decision (allocation rows are scoped via `invoice_id → invoices.org_id`), it should be documented in the migration comment. The migration file 00078 does not mention the absent `org_id`.
- **Impact:** Deviates from architecture invariant. Multi-tenant query isolation relies on joining through `invoices` rather than a direct `org_id` filter on `invoice_allocations`. If someone queries `invoice_allocations` directly without the join, there's no org-level fence.
- **Suggested fix:** Either (a) add `org_id` to `invoice_allocations` and populate it from `invoices.org_id` on insert, or (b) add a comment in the table migration and in the route explaining the deliberate absence with a rationale.

---

#### R-4: Allocations route uses `getCurrentMembership()` (session-only) for GET but the main invoice GET mixes `getMembershipFromRequest` + `getCurrentMembership` — inconsistent auth pattern
- **Commit:** `ab690f1` (GET in allocations route)
- **Location:** `src/app/api/invoices/[id]/allocations/route.ts:29` vs `src/app/api/invoices/[id]/route.ts:61`
- **Finding:** The main invoice route uses `getMembershipFromRequest(req) ?? (await getCurrentMembership())` — a two-step pattern that handles both edge cases (header-injected membership from middleware and cookie-based session). The allocations GET and PUT use only `getCurrentMembership()`, skipping the request-header path. This means the allocations endpoints would return 401 for requests where `getMembershipFromRequest` would have returned a valid membership (e.g. during SSR with injected headers, or impersonation middleware injection).
- **Impact:** Allocations may 401 when the same invoice detail page loads fine. Low probability in current setup but the inconsistency is a maintenance hazard.
- **Suggested fix:** Align both handlers to use `getMembershipFromRequest(req) ?? (await getCurrentMembership())`, same as the invoice GET/PATCH.

---

#### R-5: PATCH does not append to `status_history` on field edits
- **Commit:** `7202368`
- **Location:** `src/app/api/invoices/[id]/route.ts:243–279`
- **Finding:** The PATCH route audit-logs via `logFieldEdit` (which writes to `activity_log`), but it does NOT append to `invoices.status_history`. The CLAUDE.md architecture rule states: "Status changes always append to status_history JSONB." PATCH handles field edits rather than status changes, so this gap is only a problem if anyone relies on `status_history` as a complete edit audit (e.g. the timeline in InvoiceDetailsPanel renders `status_history`, not `activity_log`). The `logFieldEdit` writes to `activity_log` — a different table — which is not currently surfaced in the UI. If Diane needs to see that accounting edited the vendor name on a locked invoice, the only record is in `activity_log` (invisible to the UI today). The timeline shows nothing.
- **Impact:** The audit trail for privileged field edits on locked invoices is invisible in the existing UI. The `activity_log` integration is correct but the timeline panel does not surface it.
- **Suggested fix:** Either (a) surface `activity_log` entries in the timeline (Phase F), or (b) also append a minimal entry to `status_history` for privileged edits so they appear in the existing timeline (lower effort, consistent with current display pattern). Document the choice.

---

#### R-6: Page uses legacy `text-nw-warn` Tailwind class name in banners
- **Commit:** `0190ee0` (QA port) and `68115a0` (hero merge)
- **Location:** `src/app/invoices/[id]/page.tsx:1214–1251` (hold and info banners)
- **Finding:** Four banner sections use `text-nw-warn` and `text-nw-warn/90` (and `text-nw-warn/80`) — bare Tailwind class references without CSS var wrapper. CLAUDE.md: "Never use legacy Tailwind namespace use in new components. Use bracket-value utilities with CSS vars, e.g. `text-[color:var(--text-primary)]`." The deny and kick-back banners correctly use `text-[color:var(--nw-danger)]`, but the hold and info-requested banners use the bare token class. This is inconsistent within the same file and would break if the `nw-warn` Tailwind name is removed in a future token consolidation.
- **Impact:** Styling inconsistency; risk of invisible text if Tailwind config removes the bare `nw-warn` utility.
- **Suggested fix:** Replace `text-nw-warn`, `text-nw-warn/90`, `text-nw-warn/80` with `text-[color:var(--nw-warn)]` (opacity variants: wrap in a `<span>` with `opacity-80` or use `style={{ color: "var(--nw-warn)", opacity: 0.9 }}`). Affects 4 sites in `page.tsx`.

---

#### R-7: `InvoiceDetailsPanel` passed `allocRows` prop in old CONCERNS.md but component signature missing it — potential render gap
- **Commit:** `68115a0`
- **Location:** `src/components/invoices/InvoiceDetailsPanel.tsx` (see `InvoiceDetailsPanelProps`)
- **Finding:** The `InvoiceDetailsPanel` props interface includes `InvoiceDetailsPanelAllocRow[]` type in the file (`allocRows` is defined at line 12–17), but the actual props interface `InvoiceDetailsPanelProps` does not include `allocRows`. The type definition appears to be a leftover from the pre-refactor design where the panel rendered allocations inline. Now the allocations editor sits below the panel in `page.tsx` as a separate `InvoiceAllocationsEditor`. The dead type and dead export add confusion about the component boundary.
- **Impact:** Dead code; low risk. But creates confusion about whether the panel is supposed to receive alloc data or not.
- **Suggested fix:** Remove the unused `InvoiceDetailsPanelAllocRow` type and export from `InvoiceDetailsPanel.tsx` since allocations are now owned by `InvoiceAllocationsEditor`.

---

#### R-8: `PaymentPanel` contains inline `SidebarCard` chrome with a comment calling it intentionally duplicated
- **Commit:** `0190ee0`
- **Location:** `src/components/invoices/PaymentPanel.tsx:58–62`
- **Finding:** The component contains a comment: "Inline SidebarCard chrome — duplicated from page.tsx helper so this component is self-contained (Phase 1 rule: no shared-utility files)." There is no "Phase 1 rule: no shared-utility files" in CLAUDE.md — that rule doesn't exist. The actual CLAUDE.md rule is the opposite: business logic stays in API routes/server functions, but UI primitives belong in `/components`. This comment references a phantom constraint and duplicates styling logic.
- **Impact:** Low direct risk. But the phantom rule comment may mislead future contributors into continuing the duplication pattern.
- **Suggested fix:** Remove the misleading comment. The chrome can either stay inline (fine) or be extracted to a `SidebarCard` component — but the reason for the duplication should be "we chose not to extract it yet" not a phantom rule.

---

#### R-9: `invoice-allocations-editor.tsx` has no error boundary — a failed allocations fetch during page load silently shows "Loading allocations..." indefinitely
- **Commit:** `ab690f1` (editor changes) / `68115a0` (embedding in hero)
- **Location:** `src/components/invoice-allocations-editor.tsx:39–48`
- **Finding:** The `load()` function inside the editor does not catch errors from the `fetch` call. If `GET /api/invoices/${invoiceId}/allocations` returns a non-OK status or throws, `setLoading(false)` is never called (only called at line 47 in the happy path). The component stays in `loading = true` state indefinitely, showing "Loading allocations..." with no retry option or error message.
- **Impact:** Broken loading state on any allocations fetch failure (network error, 500, 403). User cannot recover without a full page reload.
- **Suggested fix:** Wrap the fetch in a try/catch: call `setLoading(false)` in a `finally` block, and `setError(...)` if `!res.ok` or on exception. Pattern mirrors the `save()` function in the same component which already does this correctly.

---

### LOW

#### R-10: `InvoiceAllocationsEditor` is a default export with no named export or JSDoc
- **Commit:** `ab690f1`
- **Location:** `src/components/invoice-allocations-editor.tsx:18`
- **Finding:** Consistent with some components in the codebase, but the extracted `src/components/invoices/` components (InvoiceHeader, PaymentPanel, PaymentTrackingPanel) all use named exports plus a JSDoc block. The allocations editor predates this convention but was modified in this batch. Minor inconsistency.
- **Suggested fix:** Add a brief JSDoc comment explaining the component's role (reads/writes `invoice_allocations` via the allocations API, enforces sum-must-equal-total invariant). Export naming inconsistency is low priority.

---

#### R-11: Migration 00078 contains no `ROLLBACK` path
- **Commit:** `ab690f1`
- **Location:** `supabase/migrations/00078_backfill_invoice_allocations_from_line_items.sql`
- **Finding:** The migration does not include a commented-out rollback script. Standard practice (and Nightwork convention per prior migrations) is to note the reverse operation. The soft-delete approach means rollback is possible (un-soft-delete the stub rows and soft-delete the replacement rows), but that logic isn't documented anywhere.
- **Impact:** Low operational risk — the migration is well-guarded and idempotent, so a second run is safe. But if the backfill was wrong on prod, the ops engineer would have to reconstruct the rollback manually.
- **Suggested fix:** Add a commented rollback block at the bottom of the migration file showing the UPDATE/DELETE sequence to restore pre-migration state.

---

#### R-12: Page.tsx still directly accesses `supabase` (client) for several lookups that bypass the API auth pattern
- **Commit:** pre-existing, worsened by the size of `page.tsx`
- **Location:** `src/app/invoices/[id]/page.tsx:403–414`, `516–521`, `529–538`, `567–580`, `590–598`
- **Finding:** Multiple `useEffect` hooks use `supabase` (the direct client import) for lookups: sibling invoice, draw info, jobs, cost codes, POs, and budget. CLAUDE.md states "All business logic in server-side API routes or Supabase functions. Frontend is display + forms only." These queries bypass the API layer, go directly from the browser to Supabase, and do not benefit from the `getCurrentMembership()` application-layer auth check. They rely on RLS alone — which CLAUDE.md identifies as "a backstop, not a substitute."
- **Impact:** Pre-existing issue documented in CONCERNS.md (large component file). The new work did not add new direct-client queries, but it embedded the `InvoiceAllocationsEditor` inside the hero without consolidating these lookups, so the pattern continues. Not introduced by this batch.
- **Suggested fix:** Tracked as Phase F refactor. Not a regression from this batch — just the continuing tech debt noted in CONCERNS.md.

---

## Per-commit readiness table

| Commit | Short msg | Risk | QA-ready? |
|--------|-----------|------|-----------|
| `d134d11` | Global disabled state for form inputs | Low — pure CSS, no logic | Yes |
| `5ecd7e1` | Allocations editor disabled-state parity | Low — styled-jsx specificity fix | Yes |
| `7202368` | PATCH allowlist + role gate + audit logging | HIGH — missing optimistic lock (R-1) | No — needs `updateWithLock` |
| `0190ee0` | Port QA actions to unified detail page | Medium — legacy Tailwind names (R-6), phantom rule comment (R-8) | Yes with notes |
| `68115a0` | Merge allocations editor into hero, fix PDF sizing | Medium — R-7 dead type, R-9 missing error boundary | Yes with notes |
| `ab690f1` | Backfill allocations from line items + em dash | HIGH — org_id auth gap in GET auto-create (R-2), missing `org_id` on allocation rows (R-3) | Needs R-2 verification |

---

## Uncommitted WIP assessment

All three files listed in the pre-session git status as modified/untracked (`src/app/api/invoices/[id]/allocations/route.ts`, `src/components/invoice-allocations-editor.tsx`, `supabase/migrations/00078_backfill_invoice_allocations_from_line_items.sql`) were committed in ab690f1. The current working tree is clean except for `.planning/` (non-code). There is no uncommitted WIP at this time.

---

## Migration 00078 safety check

**Idempotency:** Confirmed safe. The migration selects only invoices with exactly 1 live allocation whose `cost_code_id` matches `invoices.cost_code_id` (the auto-stub signature). After the first pass, affected invoices have N >= 2 live allocations, so condition (b) "exactly 1 live row" no longer matches. Re-run is a no-op.

**Rollback:** No documented rollback path (see R-11). The soft-delete approach preserves forensics — deleted stubs have `deleted_at IS NOT NULL` and can be restored manually. A commented rollback script should be added.

**Side effects:**
- The migration uses a `TEMP TABLE ON COMMIT DROP`, so it doesn't leave debris.
- The `COALESCE(description, 'Migrated from line items')` sentinel is distinctive enough for downstream consumers to recognize auto-migrated rows.
- No writes to `invoices` table — only `invoice_allocations`.
- The `SUM(amount_cents) = total_amount` invariant guard (condition d) means any invoice where line items don't add up is silently skipped. That's the right behavior — the skipped invoices will need manual allocation review.

**Production deploy note (from commit message):** Run a dry-run COUNT first (`SELECT COUNT(DISTINCT invoice_id) FROM _allocations_backfill_plan`) before executing against prod. The migration does not include this as a formal step — operators must remember to do it manually.

---

## Positive observations

- **PATCH hardening is well-architected.** The three-segment allowlist (FINANCIAL / PAYMENT_TRACKING / ASSIGNMENT) with distinct semantics per segment is the right design. The commit message is exceptionally detailed and includes 8 manual test cases. The integrity guard (hard-block on `in_draw`/`paid` for all roles) is correct and matches the architecture spec.
- **Audit log implementation is clean.** The `logFieldEdit` → `logActivity` chain is non-blocking (fire-and-forget) and won't interrupt saves. The dual auth client pattern (session client for `auth.getUser()`, service-role for the write) is correctly handled and the reason is clearly commented.
- **Allocations backward-compat logic is thorough.** The three-level fallback (line items with matching sum → invoice-level cost code → empty set) correctly handles all legacy invoice shapes. The sum-invariant guard that prevents the auto-create from producing an invalid state is particularly good defensive programming.
- **Migration 00078 comment block is the best in the codebase.** It documents context, what it does, why soft-delete, idempotency proof, and edge cases in a single readable block. This should be the template for all future migration files.
- **Styling commits include Chrome DevTools verification notes.** Both d134d11 and 5ecd7e1 document that the fix was visually verified in DevTools, meeting the CLAUDE.md testing requirement.
- **No legacy Tailwind namespace in extracted components.** `InvoiceHeader`, `PaymentPanel`, `PaymentTrackingPanel`, `InvoiceDetailsPanel` all use CSS var bracket utilities correctly. The namespace violations (R-6) are in `page.tsx`, not the extracted components.
- **`isInvoiceLocked` / `canEditLockedFields` are a clean single source of truth.** Used consistently across the PATCH route, allocations route, and page.tsx `canEdit` derivation. No inline status comparisons scattered through the codebase.
