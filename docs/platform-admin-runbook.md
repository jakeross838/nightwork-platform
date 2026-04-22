# Platform admin runbook

Operational playbook for Nightwork staff (currently Jake + Andrew) when
a customer reports an issue that can't be self-served. Every action here
writes an append-only row to `platform_admin_audit` so the company has a
permanent record of what we did and why.

> **One rule, repeat:** if you're acting on another org's data, *always*
> leave a reason. "Debugging invoice stuck in pm_review for Ross Built"
> beats "testing". Future-you reading the audit log will thank present-
> you.

---

## Before you start

1. You need to be a row in `public.platform_admins`. Sign in as
   yourself at `https://app.nightwork.build/admin/platform` — if you
   get redirected to `/dashboard`, you don't have the grant. Ping Jake.
2. Most actions require a `reason` string. The modal won't submit
   without one.
3. Impersonation has a hard 60-minute cap. Cookie expires, middleware
   clears it, next request drops back to your normal context.

---

## Scenario: customer says "I can't log in"

1. `/admin/platform/users` → search by email.
2. Click into the user. Check:
   - Memberships list: do they have an active membership in any org?
   - If "inactive" on every row, the org or admin removed them. Verify
     with the customer before reactivating.
3. If they have memberships but still can't log in, their auth account
   may be locked (`ban_duration` set).
   - Use **Unlock account** (opens reason modal). Writes
     `user_unlock` to the audit log.
4. If they forgot their password:
   - Use **Send password reset**. That emails a recovery link via
     Supabase Auth. Writes `user_password_reset` to the audit log.
5. If the org is past_due → see "Unstick a billing gate" below.

## Scenario: customer's invoice is stuck mid-workflow

1. Impersonate the org first so you can see what they see:
   - `/admin/platform/organizations` → find their row → **Impersonate**
     → enter a reason like "Debugging stuck invoice 7a2c…".
   - Red banner appears: you're now acting as them. Every write you
     make is double-logged.
2. Open `/invoices` as the customer sees it. Find the stuck record.
3. **Reads work normally** — you can inspect the parsed data, line
   items, allocations.
4. **Writes during impersonation are not yet wired through the service-
   role shim** (planned work; see PHASE 5.4 of the original build plan).
   If you need to mutate the record:
   - Exit impersonation.
   - Use the Supabase SQL editor with an explicit `WHERE id = 'x' AND
     org_id = 'y'` filter.
   - Add a `record_edit` audit row manually:
     ```sql
     INSERT INTO public.platform_admin_audit
       (admin_user_id, action, target_org_id, target_record_type,
        target_record_id, reason, details)
     VALUES
       (auth.uid(), 'record_edit', 'ORG', 'invoice', 'INVOICE_ID',
        'Reason text', '{"before": {...}, "after": {...}}'::jsonb);
     ```
5. End impersonation when done.

## Scenario: trial expired, customer needs more time

1. `/admin/platform/organizations/[id]`.
2. **Extend trial +30d** button in the "Admin actions" card.
3. Reason: "Extended per Stripe ticket #NNN" or similar. The audit
   entry captures before/after.
4. This flips `subscription_status` back to `trialing` and pushes
   `trial_ends_at` out 30 days. The billing gate lifts on next request.

## Scenario: Stripe shows paid but app still shows past_due

1. Likely the webhook didn't land. Check Stripe Dashboard → Events for
   the customer.
2. If the invoice is paid and we missed it, use **Unlock account**
   which flips `subscription_status` to `active`. Note the Stripe event
   id in the reason.
3. Follow up: figure out why the webhook failed and log a ticket.

## Scenario: customer wants to close their account

1. `/admin/platform/organizations/[id]` → **Mark as churned**.
2. Reason: include the cancellation ticket number.
3. This sets `subscription_status = 'cancelled'`. The billing gate
   kicks in — they're redirected to `/settings/billing` on next visit.
4. Nothing is deleted. Data stays on disk. Reversible by extending the
   trial or switching status back.

## Scenario: debugging a parse failure

1. If the customer reports "AI didn't read this right", pull up their
   invoice:
   - Impersonate (reads only).
   - Open the invoice detail page.
   - The raw AI response is stored in `invoices.ai_raw_response`. You
     can also grab it via SQL:
     ```sql
     SELECT ai_raw_response, confidence_details, flags
     FROM public.invoices
     WHERE id = 'INVOICE_ID';
     ```
2. If the model misread a field, log a `parser_corrections` row so
   future parses use it as reference. (The PM-override flow already
   does this for owner/admin edits.)

---

## Sentry

- URL: Sentry dashboard for the `nightwork` project (set
  `NEXT_PUBLIC_SENTRY_DSN` in `.env.local` locally; prod DSN lives in
  Vercel env vars).
- Every error is tagged with `user_id`, `org_id`,
  `impersonation_active`, `platform_admin` — filter by `org_id:<uuid>`
  to isolate a customer's errors.
- Source-map upload is deliberately off until `SENTRY_AUTH_TOKEN` is
  set in deploy env. Stack traces will be minified until then.

---

## Querying the audit log directly

The UI at `/admin/platform/audit` covers the common cases (filter by
admin, action, org, date range + CSV export). For anything gnarlier:

```sql
-- Everything one admin did in the last week
SELECT created_at, action, target_org_id, target_user_id, reason
FROM public.platform_admin_audit
WHERE admin_user_id = 'ADMIN_UUID'
  AND created_at >= NOW() - INTERVAL '7 days'
ORDER BY created_at DESC;

-- Every impersonation session targeting a specific org
SELECT created_at, action, admin_user_id, reason, details
FROM public.platform_admin_audit
WHERE target_org_id = 'ORG_UUID'
  AND action IN ('impersonate_start', 'impersonate_end')
ORDER BY created_at DESC;

-- Paired start/end so you can see session durations
WITH starts AS (
  SELECT id, admin_user_id, target_org_id, created_at AS started
  FROM public.platform_admin_audit
  WHERE action = 'impersonate_start'
),
ends AS (
  SELECT admin_user_id, target_org_id, created_at AS ended,
         details->>'start_audit_id' AS start_id
  FROM public.platform_admin_audit
  WHERE action = 'impersonate_end'
)
SELECT s.admin_user_id, s.target_org_id, s.started, e.ended,
       EXTRACT(EPOCH FROM (e.ended - s.started))/60 AS minutes
FROM starts s
LEFT JOIN ends e ON e.start_id = s.id::text
ORDER BY s.started DESC;
```

Audit rows are **append-only by design**. There is no RLS path to
`UPDATE` or `DELETE` them. If you find yourself wanting to, stop and
ask why.

---

## Backups

- Dev project: `egxkffodxcefwpqmwrur.supabase.co`. Backup status is
  managed by Supabase at the project level — check the dashboard under
  **Database → Backups** to confirm retention. The MCP server does not
  expose backup configuration.
- **Free tier has no backups.** If dev is on Free, treat any work that
  would be painful to recreate as deploy-blocking — bump to Pro before
  relying on the data.
- Prod project: not yet provisioned. When it is, it **must** be on a
  plan that includes daily backups with at least 7-day retention
  before any paying customer lands.
- PITR (Point-In-Time Recovery) is a separate Pro-tier feature. Enable
  it on prod before go-live.

---

## Escalation

If you can't fix it via the UI or a targeted SQL tweak, the root cause
is probably at the schema or workflow level. File a ticket against the
`nightwork-platform` repo (or ping Jake directly) and attach:

- Screenshot of the UI state.
- Copy of the relevant audit log rows.
- The SQL you ran, if any.
- What you expected vs. what happened.

Do not "fix" data by bulk-updating rows without logging each change in
`platform_admin_audit` — the company owes itself a paper trail.
