# Workflow Audit — Pre-Rebuild Findings

This document tracks findings from the pre-rebuild workflow audit
(April 21, 2026) that informed the Nightwork rebuild plan
([docs/nightwork-rebuild-plan.md](./nightwork-rebuild-plan.md)). Each
finding is numbered per Part 4 of the plan and maintained here through
resolution.

**Status legend:** `OPEN` | `IN PROGRESS` | `CLOSED` (with phase + commit reference)

---

## Critical bugs (data integrity) — Part 4.2

### #1 — CO status enum drift

API accepts `pending` and `denied`; schema CHECK may reject. Canonical
statuses defined as `draft | pending | approved | denied | void`, with
legacy `pending_approval` synonym and `executed` dead value both drifting
between API and schema.

**Status:** `CLOSED` — Phase 1.1, commit `2206ee4`

### #2 — `invoices.status = 'info_requested'` CHECK mismatch

API sets `info_requested` when a PM requests more info on an invoice, but
the `invoices` table CHECK constraint doesn't include that value. The
route would fail for any invoice flipped through the `request_info`
action.

**Status:** `CLOSED` — Phase 1.1, commit `2206ee4`

### #3 — Non-transactional cascades

Draw submit, lien-release generation, and payment-schedule application all
orchestrated across multiple sequential Supabase writes in the route
handler. A mid-sequence failure left orphaned child rows with no
rollback. Cascades rebuilt as Postgres transactional RPCs.

**Status:** `CLOSED` — Phase 1.3, commit `78b57e6`

### #4 — PO PATCH missing app-layer role check

`PATCH /api/purchase-orders/[id]` relied on RLS alone for role
enforcement. A PM could flip PO status even though owner/admin is the
intended gate. App-layer `requireRole(['owner','admin'])` added.

**Status:** `CLOSED` — Phase 1.2, commit `87218b0`

### #5 — Missing `created_by` columns (audit)

`cost_codes`, `budget_lines`, and `draw_line_items` had no `created_by`
column, so insert sites had no audit trail. Migration 00045 had already
added the columns + FKs; Phase 1.4 audited every insert path and patched
the unpopulated sites, shipping assert-only migration 00062 as a
tripwire against regression.

**Status:** `CLOSED` — Phase 1.4, commit `dc5ab64`

### #6 — `lien_releases.waived_at` stamp

Flipping a lien release to `status='waived'` did not stamp a
`waived_at` timestamp (mirror of the existing `received_at` stamp on
the receive transition). Audit trail for waived releases lived only in
`status_history`. Both write paths (PATCH + bulk) now stamp `waived_at`.

**Status:** `CLOSED` — Phase 1.5, commit `19821ad`

---

## Visible breakage (UI / nav / routes) — Part 4.3

### #7 — Six broken nav links

Nav links pointing at routes that return 404 or render empty shells.

**Status:** `OPEN` — deferred to Branch 4 (nav + unified inbox)

### #8 — Orphan `/purchase-orders/[id]` detail route

API exists but there is no page — direct navigation 404s.

**Status:** `OPEN` — deferred to Branch 4

### #9 — Page deleted but nav still links it

Dead nav entry points at a removed page.

**Status:** `OPEN` — deferred to Branch 4

### #10 — Pages don't redirect by role

`/invoices/qa` and similar role-specific pages render for every role
instead of redirecting non-matching roles to an appropriate landing.

**Status:** `OPEN` — deferred to Branch 4

### #11 — `/admin` wrong destination for platform admins

Platform admins hit the tenant admin page instead of `/admin/platform`.

**Status:** `OPEN` — deferred to Branch 4

### #12 — Operations dropdown all placeholders

Every item in the Operations nav dropdown links to placeholder content
(R.14 violation — Phase 1 tolerated because Branch 4 will do the UI
rebuild).

**Status:** `OPEN` — deferred to Branch 4

### #13 — `/operations`, `/financials/aging-report` orphan stubs

Routes exist as empty shells without backing UI or data.

**Status:** `OPEN` — deferred to Branch 4

---

## Notes

- This file was created retroactively during the Branch 1 rollup
  (2026-04-22) after discovery that the reference in Branch 1 Final
  Exit Gate pointed to a non-existent file. The audit findings
  themselves were documented inline in Part 4 of the plan doc from
  the start; this file externalizes them for durable tracking.
- The architectural gaps (Part 4.4) and hardening gaps (Part 4.5) of
  the plan are bulleted rather than numbered and close out across
  Branches 2–9 as scope rather than individual findings. They are
  not tracked as finding numbers in this file.
- Future branches update this file as findings close. Each closure
  references the phase that landed it and the commit SHA for
  traceability.
- New findings discovered mid-rebuild are appended with the next
  available number (#14 onward) and tracked to closure here.
