---
name: nightwork-ui-template
description: Use this skill when designing or implementing any document review, approval, right-rail, or audit-trail surface in Nightwork. Triggers on invoice review UIs, proposal review, draw approval, lien release review, change order review, daily log review, punchlist detail, document attach/review panels, or anything with a file preview + structured field editing + status timeline. Codifies the canonical invoice-review pattern (file preview LEFT + right-rail panel + audit timeline) as a reusable template. Hard rule — do not invent one-off layouts when this template extends.
---

# Nightwork UI template — document review surfaces

The invoice review screen is the gold standard for every document review / approval / right-rail surface in Nightwork. New surfaces extend this template; they do not invent their own layout. The `nightwork-ui-reviewer` agent will fail any review surface that diverges without justification.

## Canonical reference

- **Page:** `src/app/invoices/[id]/page.tsx`
- **File preview component:** `src/components/invoice-file-preview.tsx`
- **Right-rail panels:** `src/components/invoices/InvoiceDetailsPanel.tsx`, `src/components/invoices/InvoiceHeader.tsx`, `src/components/invoices/PaymentPanel.tsx`, `src/components/invoices/PaymentTrackingPanel.tsx`
- **Allocations editor:** `src/components/invoice-allocations-editor.tsx`
- **Latest extension:** `src/app/proposals/review/[extraction_id]/ReviewManager.tsx` and `src/components/proposals/*` — proposal review reused this template; mirror that approach.

Read those files BEFORE designing a new review surface. The template is best understood by reading the canonical implementation.

## Layout contract (non-negotiable)

```
┌─────────────────────────────────────────────────────────────┐
│ AppShell                                                    │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ <Header> — eyebrow, title, status badge, actions     │  │
│  └──────────────────────────────────────────────────────┘  │
│  ┌──────────────────────┬───────────────────────────────┐  │
│  │  LEFT — File Preview │  RIGHT — Right-rail panel(s)  │  │
│  │  (PDF / DOCX / IMG)  │  - Header / status / actions  │  │
│  │  position: sticky on │  - Structured field editor    │  │
│  │  desktop, full-width │  - Allocations / line items   │  │
│  │  on mobile           │  - AI confidence indicators   │  │
│  └──────────────────────┴───────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ Audit timeline — status_history rendered as          │  │
│  │ chronological events (who, when, old_status →        │  │
│  │ new_status, note)                                     │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

Tailwind shape (lifted from `src/app/invoices/[id]/page.tsx:1311`):
```tsx
<div className="grid grid-cols-1 lg:grid-cols-2 items-start gap-5">
  <InvoiceFilePreview ... />     {/* or document-equivalent preview */}
  <RightRailPanels ... />        {/* structured fields + actions */}
</div>
```

## Required behaviors

1. **File preview LEFT, fields RIGHT, audit BELOW.** This sequence is the muscle memory PMs and accountants have. Do not flip sides; do not move audit elsewhere.
2. **`grid-cols-1 lg:grid-cols-2`** so mobile collapses to single column with preview on top.
3. **File preview component handles file type dispatch** — PDF / DOCX-rendered-HTML / IMG / unknown. Reuse `InvoiceFilePreview` if you can; if you need a new variant (e.g. `ProposalFilePreview`), follow its dispatch pattern.
4. **Status badge in header**, using `formatStatus()` and `statusBadgeOutline()` from `src/lib/utils/format.ts`. Never invent a new status pill style.
5. **AI confidence rendering** — when AI parsed the document, show per-field confidence (green ≥85%, yellow 70-84%, red <70%) using `confidence_details` JSONB. Match the invoice review's color routing exactly.
6. **PM/QA edit overrides logged** — any field the user changes from the AI suggestion writes to a `*_overrides` JSONB column with `{old, new}`. Mirror invoice's `pm_overrides` / `qa_overrides`.
7. **Status history timeline** — render `status_history` JSONB as a vertical timeline of `{who, when, old_status, new_status, note}` events at the bottom of the page. Same DOM structure as invoice's history section.
8. **Locked-record view** — when a record is locked (in_draw, submitted, paid, etc.), show a banner explaining what is locked, hide write controls, but keep all read views intact. See `isInvoiceLocked()` and `canEditLockedFields()` in `src/lib/invoice-permissions.ts` for the pattern.

## Design token rules (from nightwork-design)

- Colors via CSS variables: `bg-[var(--bg-card)]`, `border-[var(--border-default)]`, `text-[color:var(--text-primary)]`, `text-[color:var(--text-secondary)]`, `bg-[var(--bg-subtle)]`.
- Stone Blue accent for primary action: `var(--nw-stone-blue)` / `bg-[var(--nw-stone-blue)]`.
- Money rendered with `JetBrains Mono` and `font-variant-numeric: tabular-nums` via the `formatCents()` / `formatDollars()` helpers from `src/lib/utils/format.ts`.
- Eyebrows: `<NwEyebrow>` from `src/components/nw/Eyebrow.tsx` — never plain UPPERCASE labels.
- Buttons: `<NwButton>` from `src/components/nw/Button.tsx` — never raw `<button>` styled inline.

## Anti-patterns the reviewer will reject

- Right-rail panel ABOVE file preview on desktop.
- Modal-only review (no full-page view).
- Inline editing without an audit timeline.
- File preview rendered with custom `<iframe>` instead of `InvoiceFilePreview`'s dispatch.
- Hardcoded color hex codes instead of CSS variables.
- Status badges rendered ad-hoc (not via `formatStatus` + `statusBadgeOutline`).
- New status values not added to `status_history` JSONB on transition.

## Extending for a new entity

When building review for a new entity (`X-review`):

1. Create `src/app/<entity>/review/[id]/page.tsx` (or `[extraction_id]` for AI-parsed sources).
2. Create `src/components/<entity>/<Entity>FilePreview.tsx` — dispatch on file type, copy `InvoiceFilePreview` shape.
3. Create `src/components/<entity>/<Entity>ReviewHeader.tsx`, `<Entity>StatusBadge.tsx`, `<Entity>DetailsPanel.tsx` — split into small focused components like `proposals/` did.
4. Add `status_history`, `pm_overrides` (or appropriate role overrides), `confidence_score`, `confidence_details` columns to the entity table — mirror the invoice schema.
5. Compose them in the page using the LEFT/RIGHT/BELOW layout above.
6. Run `/nightwork-design-check` against the new screen before merging.

## Cross-references

- `nightwork-design` skill — palette, typography, component primitives.
- `nightwork-design-tokens` skill — token enforcement.
- `nightwork-ui-reviewer` agent — runs in `/nightwork-qa` and `/nightwork-design-check` and audits new review surfaces against this template.
