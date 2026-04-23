# Pre-flight Findings — Branch 2 Phase 2.9: Client portal access

**Date:** 2026-04-23
**Migration target:** `supabase/migrations/00074_client_portal.sql` (+ `.down.sql`)
**Origin HEAD at kickoff:** `083167e` (Phase 2.8 closed — plan-doc sync + feat commit both pushed)
**Mode:** PRE-FLIGHT ONLY — no migration written, no SQL applied, no Dry-Run, no plan amendment.
**Plan spec:** `docs/nightwork-rebuild-plan.md` §4642–4674 (27 lines of raw SQL defining 2 tables; zero prior amendments).

---

## §1 Scope call

### §1.1 What the spec says, verbatim (plan §4646–4671)

```sql
CREATE TABLE client_portal_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id),
  job_id UUID NOT NULL REFERENCES jobs(id),
  email TEXT NOT NULL,
  name TEXT,
  access_token TEXT UNIQUE NOT NULL,
  visibility_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  invited_at TIMESTAMPTZ,
  last_accessed_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

CREATE TABLE client_portal_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id),
  job_id UUID NOT NULL REFERENCES jobs(id),
  from_type TEXT NOT NULL CHECK (from_type IN ('builder','client')),
  from_user_id UUID,
  from_client_email TEXT,
  message TEXT NOT NULL,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

No triggers. No RLS declaration. No indexes. No down.sql.

### §1.2 Assessment against Branch 2 standards

| Standard | `client_portal_access` | `client_portal_messages` |
|---|---|---|
| `public.` qualification | ❌ MISSING (`organizations`, `jobs`, `auth.users` all unqualified) | ❌ MISSING |
| `created_at NOT NULL DEFAULT now()` | ❌ spec has `DEFAULT now()` but nullable | ❌ same |
| `updated_at` | ❌ MISSING | ❌ MISSING (see §6 — semantic decision) |
| `created_by` | ✅ present (nullable FK to auth.users) | ❌ MISSING |
| `deleted_at` semantic | 🟡 DECISION — `revoked_at` is the equivalent; no separate soft-delete | 🟡 DECISION — likely omit (append-only like pricing_history / activity_log) |
| RLS policies | ❌ NOT DECLARED | ❌ NOT DECLARED |
| Paired down.sql | ❌ MISSING | ❌ MISSING |
| R.15 test file | ❌ MISSING | ❌ MISSING |
| CHECK enums | ✅ `from_type IN ('builder','client')` (2 values) | same |
| R.8 (cents vs numeric) | ✅ N/A (no money columns) | ✅ N/A |
| UNIQUE / idempotency guards | 🟡 `access_token UNIQUE` (full non-partial); missing `UNIQUE (org_id, job_id, email)` partial for dedup | ❌ no unique surface — messages are inherently non-idempotent |
| Indexes | ❌ MISSING (no timeline index on messages, no lookup index on token or email) | ❌ MISSING |
| `from_type` / `from_user_id` / `from_client_email` cross-column XOR | ❌ MISSING (spec allows builder with no user_id, client with no email) | ❌ same |
| platform-admin RLS bypass | ❌ NOT DECLARED | ❌ NOT DECLARED |

### §1.3 Spec-correctness bugs (not just omissions)

Probes surfaced two concrete defects + one design-space ambiguity:

1. **`access_token UNIQUE` is full, non-partial.** After `revoked_at IS NOT NULL`, the row retains its token row. Re-issuing a new row for the same email × job with a **freshly generated token** works (different token), but **rotating the same conceptual "seat" through multiple tokens over time** requires either a separate `previous_tokens` table or a rotation-tolerant lookup. Minor — recommend partial unique `UNIQUE (access_token) WHERE revoked_at IS NULL` + accept that historical tokens are preserved for audit.
2. **`from_type = 'builder'` + `from_user_id IS NULL`** is currently allowed (would produce unattributable messages). XOR CHECK needed.
3. **Missing `expires_at`** for time-boxed access. The plan spec carries `revoked_at` (explicit revoke) but no natural expiration. `org_invites` precedent uses 14-day expiry; portal access should probably be longer (90 days? tied to job lifetime?). **Flag for Jake as §7 open question #6.**

### §1.4 Verdict: **AMEND-HEAVY**

Not shippable as-is. Roughly 14–16 amendments expected (audit columns × 2 tables, RLS × 2 tables, down.sql, R.15, `public.` qualification, indexes × 2 tables, from_type XOR CHECK, partial unique on access, expires_at decision, visibility_config COMMENT schema, message read_at semantic clarification, SECURITY DEFINER client-side write RPC, platform-admin bypass).

**Amendment-count matches Phase 2.7 + Phase 2.8 pattern** — every fresh-surface Branch 2 phase has landed 12–16 amendments.

See §8 for enumerated list.

---

## §2 Migration number + filename verification

### §2.1 Slot availability

```
$ ls supabase/migrations/ | tail -6
00071_milestones_retainage.sql / .down.sql                     (applied)
00072_job_milestones_pm_write_narrowing.sql / .down.sql        (applied)
00073_pricing_history.sql / .down.sql                          (applied)
00074_*                                                         (next free slot) ✅
```

`mcp__supabase__list_migrations` last entry: `20260423023749` → `00073_pricing_history`. **00074 slot confirmed free.**

### §2.2 In-spec filename references

Phase 2.9 spec body (plan §4644):

| Line | Reference | Verdict |
|---|---|---|
| 4644 | `` Migration `00074_client_portal.sql`: `` | ✅ consistent with numbering |

Only one filename reference in the spec body. No stale `00074` numbering elsewhere inside the Phase 2.9 block.

### §2.3 Cross-section references

- Plan-doc line 4310 (Phase 3.1 exit-gate) still reads `Migration 00072`. **Known stale — Branch 3 pre-context, not Phase 2.9 scope.** Flagged again here; leave.
- Plan-doc line 4770 references `schema from Branch 2 Phase 2.8`. Phase identifier only; not affected by the renumber.

### §2.4 Exit-gate language (plan §4707–4720)

Branch 2 exit gate at line 4710:
> `All 12 migrations (00064 through 00075, with 3 mid-branch insertions…)`

Phase 2.9's 00074 lands cleanly inside this range. The exit-gate already lists `Client portal tables exist and are empty` (line 4717) and `V2.0 hook tables exist (empty, ready for future use)` (4718) — consistent with Phase 2.9 + 2.10 landing.

No exit-gate edit required for Phase 2.9.

---

## §3 R.18 blast-radius grep

**Scope:** everything under repo root except `node_modules/ .next/ .git/ dist/ build/`.

### §3.1 New identifiers introduced by Phase 2.9

| Identifier | src/ hits | __tests__/ hits | supabase/migrations/ hits | Notes |
|---|---|---|---|---|
| `client_portal` / `client_portal_access` / `client_portal_messages` | **0** | **0** | **0** | Only plan-doc references + prior phase QA reports. Clean. |
| `access_token` | 1 (scripts/debug-invoice-preview.js) | 0 | 0 | The existing hit is Supabase session token extraction — unrelated. |
| `visibility_config` | 0 | 0 | 0 | Net-new. |
| `from_type` / `from_client_email` | 0 | 0 | 0 | Net-new. |
| `portal` (generic) | 8 files in src/ | 0 | 0 | All Stripe Customer Portal or React `createPortal` DOM primitive. **Zero semantic collision.** |
| `invited_at` | 0 src | 0 tests | 2 (existing tables — see §3.2) | Semantic parallel, not collision. |
| `revoked_at` | 0 src | 0 tests | 1 (existing tables — see §3.2) | Semantic parallel, not collision. |

### §3.2 Schema-level parallels (not collisions — surface the precedent)

| Column | Where it already exists | Precedent lesson |
|---|---|---|
| `invited_at` | `auth.users`, `public.org_invites`, `public.org_members` | Same semantic — row created at invite time. `org_invites.invited_at` defaults `now()` with `NOT NULL`; Phase 2.9 spec has it nullable — recommend align. |
| `revoked_at` | `auth.oauth_consents`, `public.org_invites` | Same semantic — nullable, row-survival on revoke. `org_invites.revoked_at` is nullable TIMESTAMPTZ; Phase 2.9 matches. |
| `last_accessed_at` | `storage.objects` only | Unrelated (file metadata). Net-new semantic for portal access. |

### §3.3 Summary

Blast radius is **clean**. No live `src/` / `__tests__/` / `supabase/migrations/` references to any of the Phase 2.9 new table names or novel columns. All incidental hits are unrelated (Stripe portal, React createPortal, Supabase session tokens, storage metadata).

---

## §4 Schema Validator pre-probes

### §4.1 Migration state

- **Last applied:** `20260423023749` → `00073_pricing_history`.
- `to_regclass('public.client_portal_access')` = `null` — no pre-existing table.
- `to_regclass('public.client_portal_messages')` = `null` — no pre-existing table.
- 00074 slot free.

### §4.2 FK-target existence

| Target | Exists? | Note |
|---|---|---|
| `public.organizations` | ✅ | 3 active orgs |
| `public.jobs` | ✅ | 15 active jobs (all Ross Built on dev) |
| `auth.users` | ✅ | Standard Supabase |
| `public.org_members` | ✅ | 11 active members |

### §4.3 RLS helper-function availability

| Function | Exists? | Note |
|---|---|---|
| `app_private.is_platform_admin()` | ✅ | Standard Branch 2 bypass |
| `app_private.user_role()` | ✅ | Role-narrowing helper |
| `app_private.user_org_id()` | ✅ | Org-filter helper |

All three RLS helper functions are present — Phase 2.9 can adopt the standard Branch 2 RLS scaffold.

### §4.4 Column-name collision catalog

Zero hard collisions; semantic parallels noted in §3.2.

### §4.5 **Major precedent discovery — `public.org_invites`**

Probing surfaced `public.org_invites` as the **near-exact schema precedent** for `client_portal_access`. Shared semantic axes:

```
org_invites columns:
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL,
  email TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('owner','admin','pm','accounting')),
  token TEXT NOT NULL DEFAULT encode(gen_random_bytes(24), 'hex'),  -- 48-char hex
  invited_by UUID NOT NULL REFERENCES auth.users(id),
  invited_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + '14 days'::interval),
  accepted_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ
```

Constraints:
- `UNIQUE (token)` — full, non-partial
- `UNIQUE (org_id, email)` — full, non-partial
- `FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE`
- `CHECK (role IN ('owner','admin','pm','accounting'))`

**RLS posture on org_invites (2 policies, legacy pattern):**
1. `admins manage org_invites` — `FOR ALL` — USING `(org_id = app_private.user_org_id()) AND (app_private.user_role() IN ('admin','owner'))`
2. `org_invites_platform_admin_read` — `FOR SELECT` — USING `app_private.is_platform_admin()`

**RLS enabled:** yes.

### §4.6 Messaging precedent probe — `public.support_messages`

- Attached to `support_conversations` (AI chat transcripts). `role / content / tool_calls / tokens_input / tokens_output / created_at` — all internal-writer data. Not a strong precedent for builder↔external-client messaging.
- Policies: `support_messages_user_read` (user owns conversation), `support_messages_user_insert` (FOR INSERT, NULL USING), `support_messages_platform_admin_read`.
- Useful as a "SELECT via EXISTS on parent" pattern but NOT useful for the external-auth (client) write path.

---

## §5 R.23 precedent selection

### §5.1 What kind of tables are these?

**`client_portal_access`** is a hybrid:
- **Tenant-config-ish** — "who gets portal access to which job, with what visibility config" is per-tenant routing data configured by org admins + PMs.
- **Token-bearing external-auth invite** — directly parallels `public.org_invites` structure (token + invited_at + revoked_at).
- **Job-scoped** (not org-wide) — PM-on-own-jobs narrowing applies naturally.

**`client_portal_messages`** is a workflow entity with dual-writer semantics:
- **Builder side:** authenticated write by org member (PM, owner, admin, accounting).
- **Client side:** unauthenticated write via `access_token` — must go through SECURITY DEFINER RPC.

### §5.2 Novel enough to warrant R.23 divergence?

**NO — both tables fit inside the existing R.23 catalog via composition.** The mixed-auth surface is handled **at the write-path RPC layer, not in RLS**.

**Recommended shape (composed from existing precedents, zero net-new R.23 categories):**

| Table | Precedent | Shape |
|---|---|---|
| `client_portal_access` | `job_milestones` (Phase 2.7 post-narrowing) + `approval_chains` (Phase 2.6 owner/admin-narrow) **hybrid** | 3 policies: SELECT (PM-narrowed on jobs.pm_id) / INSERT (owner/admin/pm, with PM-on-own-jobs) / UPDATE (same). No DELETE policy (soft-delete via `revoked_at`). Platform-admin bypass via helper. |
| `client_portal_messages` | Same workflow-data pattern + Amendment F.2 SECURITY DEFINER RPC for client-side writes | 3 policies: SELECT (PM-narrowed) / INSERT (org members, from_type='builder' only — CHECK in policy WITH CHECK) / no UPDATE policy except `read_at` flip via service-role or narrow RPC. Client-side INSERT via SECURITY DEFINER RPC `submit_client_portal_message(token, message)` with `GRANT EXECUTE TO anon`. |

### §5.3 Justification for no-new-divergence

The 1-policy R.23 divergence shipped in Phase 2.8 was necessary because **`pricing_history` has no app-layer writer** — all writes are trigger-populated. Phase 2.9 is different: `client_portal_access` writes are ordinary org-member writes; `client_portal_messages` builder-side writes are ordinary org-member writes; only the **client-side write** is external-auth — and that's handled by a SECURITY DEFINER RPC (existing 00032 / 00067 / 00070 / 00073 Amendment F.2 pattern).

**RLS covers the builder side. The RPC covers the client side. Neither surface introduces a new R.23 category.**

### §5.4 PM-on-own-jobs narrowing required?

**Yes for `client_portal_access`.** Portal access is per-job data. A PM should manage portal invites for their own jobs; accounting + owner/admin manage portal invites across all jobs. This is the exact pattern in `job_milestones` post-Phase 2.7 §5.7 write-narrowing fix.

**Yes for `client_portal_messages`** for the same reason. A PM should see + respond to client messages on their own jobs; accounting + owner/admin see all jobs.

### §5.5 Client-side read path — service-role API, NOT RLS

Portal clients are **anon** (no auth.uid()). They authenticate via `access_token`. Three options considered:

- **(a) Service-role API route validates token, returns pre-filtered data.** No RLS policy needed for anon. **← Recommend.** Cleanest, narrowest attack surface, consistent with existing Stripe portal / admin API patterns.
- (b) Custom RLS policy reads token from a request header. Requires JWT-claim injection or a `current_setting` variable set by middleware. Complex + fragile.
- (c) Token-derived signed JWT carries `{portal_access_id, org_id, job_id}` claims; RLS keys off claims. Also complex; adds JWT signing/rotation surface.

### §5.6 Precedent summary

**No new R.23 divergence needed.** Phase 2.9 adopts:
- `client_portal_access` = 3-policy + PM-on-own-jobs (composed from approval_chains + job_milestones)
- `client_portal_messages` = 3-policy + PM-on-own-jobs + Amendment F.2 SECURITY DEFINER RPC for client-side INSERT (GRANT EXECUTE TO **anon**, first such in Branch 2 — prior SECURITY DEFINER Amendment F.2 grants all targeted `authenticated`)
- Both tables: platform-admin SELECT bypass
- Client-side read path: service-role API route, not RLS

---

## §6 Spec gaps / amendments-to-consider

### §6.1 `client_portal_access` gaps

| # | Gap | Recommended resolution |
|---|---|---|
| 1 | No `public.` qualification anywhere | Add on all DDL statements (R.21) |
| 2 | `created_at TIMESTAMPTZ DEFAULT now()` nullable | `TIMESTAMPTZ NOT NULL DEFAULT now()` |
| 3 | No `updated_at` | Add `updated_at NOT NULL DEFAULT now()` + `trg_client_portal_access_updated_at` BEFORE UPDATE trigger using `public.update_updated_at()` |
| 4 | No `deleted_at` — soft-delete or rely on `revoked_at`? | **Decision:** rely on `revoked_at` (semantic equivalent). No separate `deleted_at`. Partial-unique indexes use `WHERE revoked_at IS NULL`. |
| 5 | No `expires_at` | **Flag for Jake (§7 question #6).** Recommend `expires_at TIMESTAMPTZ` nullable (org_invites has it NOT NULL with 14-day default; portal access is ongoing so nullable means "no expiry" = indefinite until revoked). |
| 6 | `invited_at` nullable — drift from org_invites convention | `invited_at TIMESTAMPTZ NOT NULL DEFAULT now()` — align with org_invites |
| 7 | `access_token UNIQUE` full | Change to partial: `UNIQUE (access_token) WHERE revoked_at IS NULL` so historical tokens are preserved but only active tokens enforce uniqueness. Also add generation default `DEFAULT encode(gen_random_bytes(24), 'hex')` matching org_invites. |
| 8 | No minimum-length CHECK on access_token | `CHECK (char_length(access_token) >= 32)` — defense in depth against a future migration that populates short tokens |
| 9 | No dedup UNIQUE on (org_id, job_id, email) | Add partial unique `UNIQUE (org_id, job_id, email) WHERE revoked_at IS NULL` so a client can't hold 2 simultaneous active invites to the same job |
| 10 | No RLS | Enable + 3-policy shape per §5 (read PM-narrowed, insert PM-on-own-jobs, update PM-on-own-jobs; no DELETE — soft-delete via revoked_at) + platform-admin SELECT bypass |
| 11 | No indexes | `idx_client_portal_access_token (access_token) WHERE revoked_at IS NULL` (fast lookup for API auth); `idx_client_portal_access_org_job (org_id, job_id) WHERE revoked_at IS NULL`; `idx_client_portal_access_email (email) WHERE revoked_at IS NULL` |
| 12 | `visibility_config JSONB` has no shape documentation | COMMENT ON COLUMN documenting expected keys: `show_invoices`, `show_budget`, `show_schedule`, `show_change_orders`, `show_draws`, `show_lien_releases`, `show_daily_logs`. All bool. Application-layer writer contract. |

### §6.2 `client_portal_messages` gaps

| # | Gap | Recommended resolution |
|---|---|---|
| 13 | No `public.` qualification | Same (R.21) |
| 14 | `created_at TIMESTAMPTZ DEFAULT now()` nullable | `NOT NULL DEFAULT now()` |
| 15 | No `created_by` | Add `created_by UUID REFERENCES auth.users(id)` nullable — builder-side writes capture `auth.uid()`; client-side writes via RPC capture NULL (from_client_email carries the attribution) |
| 16 | No `updated_at` | **Decision:** omit. Messages are append-only. `read_at` flip is the only legitimate mutation and happens via narrow service-role RPC (see #22). |
| 17 | No `deleted_at` | **Decision:** omit. Messages are append-only historical record (parallel to pricing_history / activity_log). Retraction via `retracted_at TIMESTAMPTZ` column if Jake wants retraction semantics — **flag as §7 question #7**. |
| 18 | from_type CHECK present but no XOR on from_user_id / from_client_email | Add: `CHECK ((from_type = 'builder' AND from_user_id IS NOT NULL AND from_client_email IS NULL) OR (from_type = 'client' AND from_client_email IS NOT NULL AND from_user_id IS NULL))` |
| 19 | from_user_id has no FK declaration | `from_user_id UUID REFERENCES auth.users(id)` |
| 20 | No RLS | Enable + 3-policy shape (SELECT PM-narrowed; INSERT org members with WITH CHECK `from_type = 'builder'` only; UPDATE narrowed to read_at flips only — see #22) |
| 21 | Client-side write path undefined | Amendment F.2 SECURITY DEFINER RPC `public.submit_client_portal_message(p_token text, p_message text)` — validates token, derives org_id/job_id/portal_access_id, INSERTs with `from_type='client'`, returns the new message id. `GRANT EXECUTE TO anon` (first anon GRANT in Branch 2). |
| 22 | `read_at` write path undefined — which side flips it? | **Flag for Jake (§7 question #7).** Recommend: builder flips `read_at` on client→builder messages via normal RLS UPDATE (narrowed to `read_at IS NULL AND from_type = 'client'`); client flips `read_at` on builder→client messages via another SECURITY DEFINER RPC `public.mark_client_portal_message_read(p_token text, p_message_id uuid)` granted to anon. |
| 23 | No indexes | `idx_client_portal_messages_timeline (org_id, job_id, created_at DESC)`; `idx_client_portal_messages_unread (org_id, job_id) WHERE read_at IS NULL`; `idx_client_portal_messages_from_user (from_user_id) WHERE from_user_id IS NOT NULL` |

### §6.3 Non-SQL deliverables (R.15, R.16)

| # | Gap | Recommended resolution |
|---|---|---|
| 24 | No paired `00074_client_portal.down.sql` (R.16) | Write it. Reverse order: drop 2 triggers → drop 2 trigger functions (updated_at trigger fn already exists globally; only drop portal-specific ones) → drop 2 SECURITY DEFINER RPCs (submit + mark-read) → drop RLS policies → DISABLE RLS → drop indexes → drop 2 tables. |
| 25 | No R.15 test file | Write `__tests__/client-portal.test.ts`. Static-regex assertions mirroring Phase 2.7 / 2.8 precedent. Regression fences on: 3-policy shape × 2 tables + no DELETE policies; from_type XOR CHECK; partial uniques on access with `WHERE revoked_at IS NULL`; access_token length CHECK; `GRANT EXECUTE TO anon` on the 2 client-side RPCs (Amendment F.2 + new anon-grant pattern); platform-admin SELECT bypass. |
| 26 | Amendment F.2 GRANT pattern applies (2 SECURITY DEFINER RPCs) | `has_function_privilege('anon', …, 'EXECUTE') = true` probes in Migration Dry-Run for both RPCs (new **anon**-grant pattern — prior Amendment F.2 grants all targeted `authenticated`). |

### §6.4 Cross-column invariant shape

`client_portal_messages` carries a cross-column XOR between `from_type`, `from_user_id`, `from_client_email`. Enforced as a table-level CHECK constraint (§6.2 #18). Unlike Phase 2.7's `draw_mode` / `milestone_completions` invariant (left to application layer), this one is simple enough for a DB CHECK — enforce at the DB layer.

---

## §7 Ross-Built / live-data fit check

### §7.1 Backfill expectation

**None.** 15 live Ross Built jobs; 0 client portal invites currently exist (no such table). **Forward-only apply.**

- Ross Built's pre-Nightwork client communication happens by email. No historical "portal access" records to import.
- Ross Built does share draws with clients (cost-plus open-book model per CLAUDE.md), but that's currently PDF-over-email. Portal is net-new capability.
- Branch 3/4 surfaces the invite flow UI; Branch 2 just lands the tables.

### §7.2 Branch 3/4 write-path shape

- **Invite flow:** `/api/client-portal/invite` — POST from builder UI with `{job_id, email, name, visibility_config}`. Generates access_token, INSERTs row with `invited_at = now()`, sends email with portal URL. Org-member RLS gates this.
- **Portal read flow:** `/api/client-portal/[token]` — service-role API route. Validates token → derives org_id/job_id/portal_access → returns filtered data per `visibility_config`. **Bypasses RLS entirely** (anon has no auth.uid).
- **Message write from builder:** `/api/client-portal/messages` — POST with `{job_id, message}`, INSERTs with from_type='builder', from_user_id=auth.uid(). Org-member RLS gates.
- **Message write from client:** `/api/public/portal/[token]/message` — calls `submit_client_portal_message(token, message)` RPC. No auth.uid needed.
- **Read-at flips:** similar split between auth-side and token-side RPCs.

### §7.3 Open questions flagged for Jake

The 5 prompt-prompted questions + 5 additional discoveries:

1. **Portal client read path** — recommend service-role API route (§5.5 option a). Confirm?
2. **client_portal_access write role-set** — recommend owner/admin/pm with PM-on-own-jobs narrowing; accounting excluded (not their workflow). Alternative: include accounting. Confirm?
3. **client_portal_messages RLS + client-side write** — recommend 3-policy + SECURITY DEFINER RPC `submit_client_portal_message(token, message)` granted to **anon**. Confirm anon grant is acceptable? (First anon grant in Branch 2. Defense-in-depth is the token-validation inside the RPC body; if token is invalid or revoked, the INSERT is skipped.)
4. **Token security model** — recommend plaintext 48-char hex (org_invites convention) + `revoked_at` rotation + minimum-length CHECK. NOT hashing the stored token. Alternative: hash stored, lookup via `crypt()`/`pgcrypto`. Confirm plaintext is acceptable?
5. **Backfill** — none; forward-only. Confirm?
6. **NEW — `expires_at` on `client_portal_access`** — recommend nullable (no expiry by default; revoke explicitly). Alternative: NOT NULL with default `(now() + '90 days')` or `(now() + '1 year')` tied to job lifetime. org_invites uses 14 days but that's for org-member onboarding, not ongoing client access. Which?
7. **NEW — Message retraction** — recommend no `retracted_at` (append-only like pricing_history). Alternative: add `retracted_at` for compliance-sensitive retraction. Which?
8. **NEW — `read_at` write path** — recommend split between RLS UPDATE (builder marks client message read) + SECURITY DEFINER RPC `mark_client_portal_message_read` (client marks builder message read). Confirm?
9. **NEW — `visibility_config` JSONB shape** — recommend document keys in COMMENT (show_invoices, show_budget, show_schedule, show_change_orders, show_draws, show_lien_releases, show_daily_logs); enforce at application-writer-contract layer. Alternative: CHECK expression validating keys, or a JSON schema extension. Which?
10. **NEW — `UNIQUE (org_id, job_id, email)`** partial on `WHERE revoked_at IS NULL` — recommend. Prevents double-invite to same client × same job. Confirm?

---

## §8 Recommended amendment list (for Jake to approve)

Letters mirror Phase 2.7 / 2.8 pattern. If approved, each becomes a one-line entry in the plan-doc amendment block and the migration header's citation list.

| ID | Amendment | Scope |
|---|---|---|
| **A** | **`public.` schema qualification** on every DDL statement across both tables (R.21). | All |
| **B** | **Full audit-column set on `client_portal_access`** — `created_at NOT NULL DEFAULT now()`, `updated_at NOT NULL DEFAULT now()` + trigger using `public.update_updated_at()`, `created_by` nullable FK (spec already has), `invited_at NOT NULL DEFAULT now()` (align with org_invites). No `deleted_at` — `revoked_at` is semantic equivalent. | Table 1 |
| **C** | **Full audit-column set on `client_portal_messages`** — `created_at NOT NULL DEFAULT now()`, `created_by UUID REFERENCES auth.users(id)` nullable (client-side INSERTs NULL). **No `updated_at`** (append-only; `read_at` flip via narrow paths). **No `deleted_at`** (append-only like pricing_history / activity_log; retraction via optional `retracted_at` — see Amendment I scope decision). | Table 2 |
| **D** | **`client_portal_access` token hardening** — change `UNIQUE (access_token)` from full to partial `WHERE revoked_at IS NULL`; add `DEFAULT encode(gen_random_bytes(24), 'hex')` matching org_invites; add `CHECK (char_length(access_token) >= 32)`. | Table 1 |
| **E** | **Partial unique dedup** — `UNIQUE (org_id, job_id, email) WHERE revoked_at IS NULL` on `client_portal_access`. Prevents double-invite to same client × same job. | Table 1 |
| **F** | **`from_type` XOR CHECK on `client_portal_messages`** — `CHECK ((from_type = 'builder' AND from_user_id IS NOT NULL AND from_client_email IS NULL) OR (from_type = 'client' AND from_client_email IS NOT NULL AND from_user_id IS NULL))`. | Table 2 |
| **G** | **FK declaration on `from_user_id`** — `from_user_id UUID REFERENCES public.auth.users(id)`. | Table 2 |
| **H** | **RLS 3-policy + PM-on-own-jobs narrowing for `client_portal_access`** — SELECT (owner/admin/accounting see all; PM sees only their jobs via EXISTS on public.jobs.pm_id); INSERT (owner/admin/pm, PM-on-own-jobs); UPDATE (same). No DELETE (soft-delete via revoked_at). Platform-admin SELECT bypass. Precedent: `job_milestones` Phase 2.7 post-fix. **No new R.23 divergence** — composed from existing precedents. | Table 1 |
| **I** | **RLS 3-policy + PM-on-own-jobs for `client_portal_messages`** — SELECT (PM-narrowed); INSERT (org members with WITH CHECK `from_type = 'builder'` only — client-side INSERTs go through RPC in Amendment J); UPDATE (narrowed to `read_at IS NULL AND from_type = 'client'` flips only). Platform-admin SELECT bypass. **Scope decision sub-amendment I.1:** retraction path — `retracted_at` column + UPDATE policy for authors, OR no retraction. Flag for Jake. | Table 2 |
| **J** | **SECURITY DEFINER RPCs for client-side writes (Amendment F.2 GRANT pattern, first anon-grant in Branch 2)** — (a) `public.submit_client_portal_message(p_token text, p_message text)` validates token, derives org_id/job_id/portal_access_id, INSERTs row with from_type='client', returns new message id; (b) `public.mark_client_portal_message_read(p_token text, p_message_id uuid)` validates token + message belongs to same portal_access, sets `read_at = now()` where `from_type = 'builder'`. Both: SECURITY DEFINER + pinned `search_path = public, pg_temp` + `GRANT EXECUTE TO anon`. Token validation inside function body defends the grant — invalid/revoked tokens are silently no-op'd. R.15 regression fence asserts `has_function_privilege('anon', …, 'EXECUTE')` = true for both. | RPC |
| **K** | **Indexes across both tables** — see §6.1 #11 + §6.2 #23. Five total partial + non-partial btree indexes. No trigram / GIN on message body at this phase (Branch 3/4 can add for search). | Indexes |
| **L** | **Paired `00074_client_portal.down.sql`** per R.16. Reverse dependency order: drop 2 RPCs → drop updated_at trigger on client_portal_access → drop updated_at trigger fn (portal-specific only — shared `public.update_updated_at()` stays) → drop RLS policies (6 total: 3 per table) → DISABLE RLS × 2 → drop indexes (5) → drop 2 tables. | R.16 |
| **M** | **R.15 test file `__tests__/client-portal.test.ts`** — static regex assertions. Regression fences on: 3-policy × 2 tables + no DELETE policies; from_type XOR CHECK; partial uniques on access with `WHERE revoked_at IS NULL`; access_token length + default; 2 SECURITY DEFINER RPCs with `GRANT EXECUTE TO anon` (new anon-grant pattern — R.23 precedent statement in header); PM-on-own-jobs EXISTS subqueries traversing jobs.pm_id. | R.15 |
| **N** | **`visibility_config` JSONB COMMENT** documenting expected keys — `show_invoices, show_budget, show_schedule, show_change_orders, show_draws, show_lien_releases, show_daily_logs` (all bool). Application-writer-contract enforcement. Optional sub-amendment N.1: CHECK expression validating shape (vs. just document). Recommend COMMENT-only (app layer enforces). | Documentation |
| **O** | **Header documentation** — migration header cites: (a) **no R.23 divergence** (both tables compose from existing precedents: job_milestones PM narrowing + approval_chains role narrowing + Amendment F.2 SECURITY DEFINER for client-side writes); (b) Amendment B / C audit-column decisions including no-deleted_at rationale for messages (parallel to pricing_history / activity_log); (c) Amendment D token-hardening decisions + plaintext-storage precedent from org_invites; (d) Amendment J **anon-grant pattern** — first in Branch 2, lineage from 00032 / 00067 / 00070 / 00073 authenticated-grants; (e) forward-only apply (no backfill); (f) Branch 3/4 writer-contract: 4 write paths (invite, builder-message, client-message RPC, read-flip). | Documentation |

**Open questions flagged for Jake before execution** (concentrated in §7.3):

1. Portal client read path: service-role API (recommended) vs. RLS-based?
2. `client_portal_access` write role-set: owner/admin/pm (recommended) vs. include accounting?
3. Anon grant acceptable for Amendment J RPCs? (defense via token-validation inside RPC body)
4. Token storage: plaintext per org_invites (recommended) vs. hashed?
5. Backfill: none (recommended) vs. any retroactive portal access?
6. `expires_at` on access: nullable (recommended) vs. NOT NULL with time-boxed default?
7. Message retraction: no retraction (recommended) vs. `retracted_at` + UPDATE policy for authors?
8. `read_at` write path: RLS UPDATE + SECURITY DEFINER RPC split (recommended)?
9. `visibility_config` enforcement: COMMENT-only (recommended) vs. CHECK expression?
10. `UNIQUE (org_id, job_id, email) WHERE revoked_at IS NULL` partial unique: confirm?

---

## §9 Delta from prior Branch 2 pre-flights

| Dimension | Phase 2.7 | Phase 2.8 | **Phase 2.9 (this)** |
|---|---|---|---|
| Spec size (raw SQL) | ~40 lines | 30 lines | 27 lines |
| Pre-existing amendments | 0 | 0 | 0 |
| Tables | 1 (job_milestones) + jobs + draws ALTERs | 1 (pricing_history) | **2 (client_portal_access + client_portal_messages)** |
| Spec-correctness bugs | 1 (duplicate CHECK on jobs) | 3 (purchase_order_line_items name + canonical_item_id bare UUID + po_line_items column asymmetry) | **2 + 1 design ambiguity** (access_token full vs partial unique + missing from_type XOR CHECK + expires_at design question) |
| Runtime defects surfaced in execution | 0 | 4 (invoice_line_items column names + rate dollars-vs-cents + change_orders no vendor_id + change_order_lines shape) | **likely 0–2** — tables are net-new, FK targets probed and stable; primary risk is RPC implementation details around `access_token` generation/validation |
| R.23 divergence | 0 | 1 (1-policy pricing_history) | **0 expected** — composes from existing precedents |
| Amendment F.2 GRANT reactivation | N/A | 4 functions (authenticated) | **2 functions (first anon-grant)** |
| Amendment count estimate | 12 (A–L + M) | 15 (A–N + O) | **15 (A–O)** |

**Key observations:**

- **Phase 2.9 is closer to Phase 2.7 in R.23 cleanliness** (no divergence) than to Phase 2.8 (1 divergence). The mixed-auth surface was the novel-axis concern at kickoff; on probe it resolves via composition (RLS handles authenticated side; RPC handles anon side) rather than new RLS category.
- **First anon-grant in Branch 2.** Previous Amendment F.2 reactivations (00032, 00067, 00070, 00073) all GRANT EXECUTE TO `authenticated`. Phase 2.9's client-side RPCs grant to `anon` — defended by token-validation inside the SECURITY DEFINER body. Header documentation (Amendment O) frames this as an extension of the Amendment F.2 pattern, not a new divergence.
- **Two-table phase.** First Branch 2 phase with 2 new tables in one migration. Amendment count (15) matches single-table Phase 2.8 (15) because both tables reuse the same RLS + audit + index patterns.
- **`public.org_invites` is the load-bearing precedent** — 48-char hex token generation, invited_at/revoked_at/expires_at semantic. Absent this precedent, the token-hardening decisions (Amendment D) would be much more speculative. The discovery reduces §7.3 question #4 (token storage model) from a design decision to a "confirm we follow the existing convention" question.
