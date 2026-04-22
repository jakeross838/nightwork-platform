# Consolidate payment scheduling: invoice routes still compute schedule client-side; draw RPC duplicates ~25 lines of date math in PL/pgSQL. Candidate for Branch 8 or Branch 9.

_Ready-to-paste issue body. Title goes in the `gh issue create --title` flag._

## Background

Phase 1.3 of the Nightwork rebuild (commit `78b57e6` — `fix(draws): atomic RPC transactions for submit/approve/void`) moved the draw-cascade payment scheduling logic into a Postgres RPC (`draw_approve_rpc`, in `supabase/migrations/00061_transactional_draw_rpcs.sql`) so it runs atomically with the draw status change.

Per the R.5 blast-radius check at Phase 1.3 kickoff, `src/lib/payment-schedule.ts` was **not** draw-cascade-only — the utility functions `getOrgPaymentSchedule` and `scheduledPaymentDate` are called by `src/app/api/invoices/[id]/payment/route.ts` and `src/app/api/invoices/payments/bulk/route.ts`.

Rather than expand Phase 1.3's scope into invoice routes (explicitly out-of-scope per plan §Phase 1.3), Jake chose option (a) — narrow rebuild:
- `autoScheduleDrawPayments` removed from `src/lib/payment-schedule.ts` (moved into the RPC as PL/pgSQL)
- `getOrgPaymentSchedule` + `scheduledPaymentDate` kept as TS utilities for invoice routes
- Invoice routes untouched

## The debt

~25 lines of date-math logic are now duplicated between:
1. **TS:** `src/lib/payment-schedule.ts::scheduledPaymentDate()`
2. **PL/pgSQL:** `public._compute_scheduled_payment_date` in `supabase/migrations/00061_transactional_draw_rpcs.sql`

Both implementations must stay in sync. If the org's payment-schedule policy changes (e.g., new schedule type, holiday calendar, weekend-bump tweak), both copies need updating. Silent drift would produce quiet incorrect payment dates for one path — most likely caught during a dogfood draw, but not before.

## Candidates for consolidation

- **Branch 8 (Performance + observability + polish):** move invoice-payment scheduling into a Postgres function too; have both draw RPC and invoice routes call a shared SQL helper.
- **Branch 9 (Final pre-deploy sweep):** include payment-schedule consistency as part of the full schema audit.

Either branch can pick this up. The cost of duplication is low today (date math is stable); the cost if it drifts would be quiet incorrect payment dates.

## Acceptance criteria

- Single source of truth for payment-date computation (likely PL/pgSQL given the RPC already uses it).
- Invoice payment routes call the same helper (via `supabase.rpc()` or a wrapping TS function that delegates to the SQL helper).
- Test coverage verifying both paths produce identical outputs for a range of schedule types and received dates (including weekend/holiday bumps).
- `src/lib/payment-schedule.ts::scheduledPaymentDate` either deleted or marked as a thin wrapper over the SQL helper.
- `public._compute_scheduled_payment_date` promoted from `_`-prefixed internal helper to a first-class function with a stable comment linking the old TS call sites.

## Context

- Plan doc: `docs/nightwork-rebuild-plan.md` — Phase 1.3 section + Branch 9 note (references this issue).
- RPC source: `supabase/migrations/00061_transactional_draw_rpcs.sql`
- TS utility: `src/lib/payment-schedule.ts`
- Phase 1.3 QA report: `qa-reports/qa-branch1-phase1.3.md`

---

## Commands

Create the issue via CLI (once `gh` is installed locally):

```bash
gh issue create \
  --title "Consolidate payment scheduling: invoice routes still compute schedule client-side; draw RPC duplicates ~25 lines of date math in PL/pgSQL. Candidate for Branch 8 or Branch 9." \
  --body-file qa-reports/gh-issue-body-phase1.3.md
```

Or paste the body above into the web UI at `https://github.com/jakeross838/Ross-Built-Command/issues/new`.

Once the issue number exists, the stub references in the migration comment (`supabase/migrations/00061_transactional_draw_rpcs.sql`) and in Phase 1.3's QA report (`qa-reports/qa-branch1-phase1.3.md`) should be updated to `#N` in a small follow-up commit.
