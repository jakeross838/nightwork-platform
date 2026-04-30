# PATTERNS.md — Nightwork page-level pattern catalogue

**Status:** v1 DRAFT (Stage 1.5a, T14) — produced 2026-04-30.
**Phase:** stage-1.5a-design-system-documents
**Scope:** Single source of truth for reusable PAGE LAYOUTS that compose tokens (SYSTEM.md) and components (COMPONENTS.md) into recognizable page shapes that recur across the product. Subordinate documents (.impeccable.md, the components playground patterns page, future per-pattern skills) reference PATTERNS.md as authoritative.
**SPEC anchors:** A14, A15, A16, A16.1, A17, A18, A18.1, B5, plus CLAUDE.md "Nightwork standing rules → UI rules" (Document Review is the gold standard).
**Authoritative inputs:** SYSTEM.md (token catalog, breakpoints, density, motion, accessibility), COMPONENTS.md (component inventory + tenant-blind rule + icon boundary + brand customization), CONTRAST-MATRIX.md (a11y verification), `.claude/skills/nightwork-ui-template/SKILL.md` (the canonical Document Review contract), the prototype HTMLs in `.claude/skills/nightwork-design/Slate*.html`, and the existing invoice-review implementation at `src/app/invoices/[id]/page.tsx`.

**Document length target:** 1100-1500 lines structured into 14 sections + cross-references.

---

## 0. Purpose + cross-references

PATTERNS.md sits at the layer above SYSTEM.md (tokens) and COMPONENTS.md (primitives). It documents the recurring PAGE SHAPES that PMs, accountants, owners, and admins recognize as Nightwork. A pattern picks tokens out of SYSTEM.md and components out of COMPONENTS.md and assembles them into a layout with explicit regions, responsive behavior, and accessibility contract.

This file exists to:

1. **Lock the gold standard.** The Document Review pattern is the canonical layout for every workflow surface where a user reviews a file + edits structured fields + sees an audit trail. Per CLAUDE.md "UI rules" — "any document review / approval / right-rail surface (proposals, draw approvals, lien releases, change orders, daily logs once they ship) extends the invoice-review template — file preview LEFT, structured fields right-rail, audit timeline at the bottom." PATTERNS.md formalizes the contract.
2. **Catalog the 12 patterns Nightwork ships.** PATTERNS.md is closed at 12 entries for v1 (per SPEC A14). New page shapes either reduce to one of these 12 OR require a propagation event (PROPAGATION-RULES.md, T15 pending).
3. **Document the Reconciliation strawman.** Per D-028 / NQ5 / SPEC A16-A16.1 — Reconciliation is the most architecturally novel UI Nightwork ships. PATTERNS.md surfaces 4 candidate visualization models (per SPEC A16) with explicit rejection criteria, NOT a chosen winner. Stage 1.5b mockups will pick one.
4. **Define the Loading/Error/Skeleton overlay layer.** The 3 universal in-flight / empty-data / error states overlay any other pattern. PATTERNS.md documents them as a layer, not as a standalone page pattern.
5. **Provide a pattern selection tree.** Given a workflow need, which of the 12 patterns fits? §13 documents the decision tree.

**Cross-references:**

| Source | Where |
|---|---|
| Token catalog | `.planning/design/SYSTEM.md` (854 lines, 14 sections — palette, type, motion, density, breakpoints, accessibility, brand-customization, Forbidden thresholds) |
| Component inventory | `.planning/design/COMPONENTS.md` (1107 lines, 17 sections — primitives, tenant-blind rule, icon boundary, brand customization, dependencies) |
| WCAG matrix | `.planning/design/CONTRAST-MATRIX.md` |
| Document Review skill (gold standard) | `.claude/skills/nightwork-ui-template/SKILL.md` |
| Slate design skill (palette + reference HTMLs) | `.claude/skills/nightwork-design/SKILL.md` + `Slate *.html` files |
| Invoice review reference implementation | `src/app/invoices/[id]/page.tsx` (2229 lines) |
| Proposal review (Document Review extension) | `src/app/proposals/review/[extraction_id]/page.tsx` + `src/components/proposals/*` |
| Dashboard reference | `src/app/dashboard/page.tsx` (607 lines) |
| Settings shell | `src/app/settings/layout.tsx` |
| Onboard wizard reference | `src/app/onboard/OnboardWizard.tsx` |
| Job creation wizard | `src/app/jobs/new/page.tsx` |
| Draw creation wizard | `src/app/draws/new/page.tsx` |
| Invoice queue (List+Detail) | `src/app/invoices/queue/page.tsx` |
| AppShell (used by every pattern) | `src/components/app-shell.tsx` |
| MASTER-PLAN.md decisions | D-028 (Reconciliation phase post-3.9), D-036 (1.5b reconciliation mock-up adds a prototype) |
| SPEC criteria | `.planning/phases/stage-1.5a-design-system-documents/SPEC.md` (v2.1 — 52 criteria) |
| PLAN tasks | `.planning/phases/stage-1.5a-design-system-documents/PLAN.md` (v2 — 47 tasks) |
| CLAUDE.md UI rules | `CLAUDE.md` "Nightwork standing rules → UI rules" |

---

## 1. The 12 patterns (table of contents)

PATTERNS.md catalogs 12 patterns. The list is locked for v1. The pattern selection tree (§13) maps workflow needs onto these 12. Cross-pattern composition rules (§14) cover layered cases (e.g., Wizard inside Modal, Confirm overlaid on Document Review).

| #  | Pattern                              | Section | Used in (representative)                                            |
|----|--------------------------------------|---------|---------------------------------------------------------------------|
| 1  | **Document Review** (gold standard)  | §2      | Invoice review, proposal review, draw approval, lien release review, change order review, daily log review (Wave 2), punchlist detail (Wave 2) |
| 2  | Multi-step Approval                   | §3      | Invoice approval flow (PM → QA → push to QB), draw approval flow (PM → owner sign-off → submit) |
| 3  | Data-dense Overview (dashboard)       | §4      | Home dashboard, per-job dashboards                                  |
| 4  | Mobile Touch Approval                 | §5      | PM mobile invoice review, mobile approve/hold/deny                  |
| 5  | Config Form (settings)                | §6      | Settings/financial, settings/workflow, settings/company, settings/team, settings/cost-codes |
| 6  | List + Detail                         | §7      | Invoices/queue, vendors, change-orders, cost-intelligence/items     |
| 7  | Wizard                                | §8      | Jobs/new, draws/new, signup/onboard                                 |
| 8  | Empty Workspace (zero-state)          | §9      | Empty queue, empty vendor list, no draws yet                        |
| 9  | Print View (AIA fidelity)             | §10     | Draws/[id]/print, owner-portal AIA forms                            |
| 10 | Reconciliation (strawman)             | §11     | Invoice ↔ PO drift, draw ↔ budget drift, CO ↔ contract drift (post-3.9 per D-028) |
| 11 | Confirm/Destructive Action            | §12     | Delete vendor, void invoice, lock draw, finalize, kick-back         |
| 12 | Loading / Error / Skeleton overlay    | §12.5   | Universal layer; overlays any other pattern                         |

Patterns 1-11 are **page shapes**. Pattern 12 is a **layer**, not a page — it overlays any of patterns 1-11 during in-flight / empty-data / failure states.

---

## 2. Pattern 1 — Document Review (the gold standard)

**Purpose:** The canonical layout for any surface where a user reviews a source document, edits structured fields parsed from it, and sees the workflow status timeline.

### 2a. When to use

- File preview is meaningful (PDF, DOCX, image, spreadsheet) — the user needs to see the source while editing
- Structured fields were parsed (typically by AI, sometimes manually) and are now editable
- Workflow status changes append to a `status_history` JSONB column
- AI-parsed fields carry per-field confidence scores
- The surface is the canonical place for one record (not a list view, not a wizard)
- Per SPEC A15 — `src/app/invoices/[id]/page.tsx` is the reference implementation; new surfaces extend this template verbatim

### 2b. When NOT to use

- The record has no source document (e.g., a manually-created cost code) — use Config Form (§6)
- The user is creating, not reviewing (no source to compare against) — use Wizard (§8) or Config Form (§6)
- The page lists many records — use List + Detail (§7)
- Mobile-only touch approval — use Mobile Touch Approval (§5), which is the mobile collapse of this template
- The user is reading a printed AIA G702/G703 — use Print View (§10)
- The page is a one-line confirmation ("are you sure?") — use Confirm (§12)

### 2c. Anatomy

```
┌─────────────────────────────────────────────────────────────────────┐
│ AppShell (NavBar top, JobSidebar hidden by NO_SIDEBAR matcher)      │
│                                                                       │
│ ┌─────────────────────────────────────────────────────────────────┐ │
│ │  Breadcrumbs — Home › Invoices › Inv 2025-08321                │ │
│ │  Header — eyebrow + title + status badge + actions              │ │
│ │  (NwEyebrow + Space Grotesk h1 + NwBadge + NwButton row)        │ │
│ └─────────────────────────────────────────────────────────────────┘ │
│                                                                       │
│ ┌──────────────────────────────────┬──────────────────────────────┐ │
│ │  LEFT — File Preview              │  RIGHT — Right-rail panels   │ │
│ │  (col-span-6 desktop /            │  (col-span-6 desktop /        │ │
│ │   full-width nw-phone)            │   full-width nw-phone)        │ │
│ │  ─────────────────────            │  ──────────────────────       │ │
│ │  InvoiceFilePreview               │  Header (status, totals,      │ │
│ │  - dispatches on file type:       │   workflow actions)           │ │
│ │    PDF / DOCX-rendered-HTML /     │  Structured fields editor     │ │
│ │    IMG / unknown                  │  - vendor, invoice number,    │ │
│ │  - position: sticky on desktop    │    invoice date, total, type  │ │
│ │  - zoom controls                  │  - per-field confidence       │ │
│ │  - download / open-in-new-tab     │    badges (green/yellow/red)  │ │
│ │                                   │  Allocations editor           │ │
│ │                                   │  - line items × cost codes    │ │
│ │                                   │  - PO matching, CO flag        │ │
│ │                                   │  - real-time budget remaining │ │
│ │                                   │  Payment panel                │ │
│ │                                   │  - check #, picked-up date,   │ │
│ │                                   │    scheduled payment date     │ │
│ └──────────────────────────────────┴──────────────────────────────┘ │
│                                                                       │
│ ┌─────────────────────────────────────────────────────────────────┐ │
│ │  Audit timeline (Pattern §13 in COMPONENTS.md inventory)         │ │
│ │  - status_history JSONB rendered as chronological vertical       │ │
│ │    timeline with {who, when, old_status, new_status, note}       │ │
│ │  - resolves UUID `who` values to human names via a userNames     │ │
│ │    Map fetched alongside the invoice                             │ │
│ │  - locked-record banner if applicable (in_draw, paid, etc.)      │ │
│ └─────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
```

The Tailwind shape, lifted from `src/app/invoices/[id]/page.tsx:1311`:

```tsx
<div className="grid grid-cols-1 lg:grid-cols-2 items-start gap-5">
  <InvoiceFilePreview ... />     {/* LEFT — file preview */}
  <RightRailPanels ... />        {/* RIGHT — structured fields */}
</div>
{/* status_history rendered as a timeline below the grid */}
```

### 2d. Components used

- `AppShell` (Navigation §4.1) — chrome with NavBar, optional JobSidebar (hidden by NO_SIDEBAR matcher on review surfaces)
- `Breadcrumbs` (Navigation §4.3) — trail to context
- `NwEyebrow` (Existing primitives §7.2) — small UPPERCASE label above title
- `Space Grotesk h1` styled per SYSTEM §4 — page title
- `NwBadge` (Existing primitives §7.3) — status pill (bordered, never filled)
- `ConfidenceBadge` (Data display §5.3) — per-field AI confidence indicator
- `NwButton` (Existing primitives §7.1) — workflow actions (Approve, Hold, Deny, Kick-back, Request Info)
- `InvoiceFilePreview` or entity-specific equivalent — file dispatch (PDF, DOCX, IMG)
- `NwCard` (Existing primitives §7.4) — wraps each right-rail panel
- `Form` (Inputs §1.6) + `FormField` + `FormLabel` + `FormControl` + `FormMessage` — for editable fields
- `Combobox` (Inputs §1.4) — for vendor / cost code / PO selection in allocations
- `NwMoney` (Existing primitives §7.6) — every dollar amount, JetBrains Mono + tabular-nums
- `NwDataRow` (Existing primitives §7.5) — read-only label/value pairs
- `NwStatusDot` (Existing primitives §7.7) — workflow state visualizer
- `Banner` (Feedback §3.2) — locked-record banner

### 2e. Tokens used

- `--bg-page` — outer shell background (white-sand light, slate-deep dark per SYSTEM §1i)
- `--bg-card` — every Card surface in the right rail
- `--bg-subtle` — hover states inside the rail
- `--text-primary` — page title, value text
- `--text-secondary` — labels, helper text
- `--text-tertiary` — separator chevrons in breadcrumbs
- `--border-default` — Card borders, between-row dividers
- `--shadow-panel` — right-rail Card elevation
- `--color-success` / `--color-warning` / `--color-error` — confidence badge variants, status badge variants
- `--color-money` — NwMoney value color (theme-aware)
- `--font-display` — page title (Space Grotesk)
- `--font-body` — Inter body text
- `--font-mono` — JetBrains Mono for eyebrows + money + audit timestamps
- `--tracking-eyebrow` — `0.14em` UPPERCASE for NwEyebrow
- `--tracking-tight` — `-0.02em` for h1
- `--space-5` — gap between left preview and right rail (`gap-5`)
- `--space-4` — internal Card padding (`p-4`)
- `--ring` — focus-visible ring (Stone Blue) on form inputs
- `--brand-accent` — primary action button (NwButton primary) — A12.3 tenant-customizable

### 2f. Accessibility

- **Page landmark.** `<main>` wraps the entire page. `<header>` wraps the breadcrumbs + title. Audit timeline uses `<section aria-labelledby="audit-history">`.
- **Reading order.** Screen reader: breadcrumbs → title → status badge → workflow actions → file preview (decorative) → field editor → allocations → audit timeline. `aria-hidden="true"` on the iframe-rendered file preview when SR users read fields directly.
- **Focus order.** Tab from breadcrumbs → workflow actions → first editable field → next field (vertical, top-down) → audit timeline. Skip-to-main-content link (planned T20d) for keyboard users to bypass NavBar.
- **Field updates announce.** Each editable field uses `<FormField>` from COMPONENTS.md §1.6 — `<FormMessage role="alert">` announces validation errors via `aria-live="polite"`.
- **Confidence badges narrate.** Per COMPONENTS.md §5.3 — `aria-label="AI confidence ${pct}%"`. Color is reinforced by text, not color-only (WCAG 1.4.1).
- **Audit timeline reads chronologically.** `<ol>` with `<li>` per entry; each entry has `<time datetime>` and a sentence describing the transition.
- **File preview is decorative for SR.** Users have alternative text-based access via the field editor; preview is `aria-hidden="true"`. Download / open-in-new-tab buttons remain keyboard-accessible.
- **Locked-record banner is a `role="status"`.** Announces "This invoice is locked because it's been included in Draw 8" via `aria-live="polite"`.
- **Modal-overlay actions** (e.g., Confirm dialog for Deny) — see §12; full focus trap, Esc to cancel.

### 2g. Mobile behavior

Per SYSTEM §9 breakpoints (`nw-phone` 0-639px, `nw-tablet` 640-1023px, `nw-desktop` 1024+) and SPEC A18.1 information-density mapping for mobile:

| Region                  | nw-desktop                              | nw-tablet                                | nw-phone                                       |
|-------------------------|-----------------------------------------|------------------------------------------|------------------------------------------------|
| AppShell sidebar        | NO_SIDEBAR matcher hides it             | hidden                                   | hidden                                         |
| Breadcrumbs             | full trail                              | full trail                               | trail collapses to "…" if length > 3            |
| Header                  | side-by-side title + actions            | side-by-side                             | title above actions; actions wrap              |
| LEFT file preview       | sticky col-span-6                       | top-row col-span-8                       | top-row full-width (preview moves to top)       |
| RIGHT field editor      | sticky col-span-6                       | bottom-row col-span-8                    | below preview, full-width                      |
| Allocations editor      | inline in right rail                    | inline                                   | collapsed by default with "edit allocations" tap-expand (per SPEC A18.1) |
| Status badge + total    | inline in header                        | inline                                   | sticky above-the-fold via small fixed header   |
| Primary action          | inline in header                        | inline                                   | full-width sticky bottom CTA (≥56px high-stakes touch target per SYSTEM §11) |
| Audit timeline          | full chronological                      | full                                     | last 3 events visible; "show all" tap-expands  |

Per SPEC A18.1: `nw-phone` collapses preview to top, allocations to tap-expand, audit to last-3-with-expand, and floats the primary action as a sticky bottom CTA. Status badge + total + primary action stay above-the-fold.

### 2h. Examples (real Nightwork screens)

1. **Invoice review** — `src/app/invoices/[id]/page.tsx` (2229 lines). The reference implementation. File preview LEFT, right-rail panels (`InvoiceHeader`, `InvoiceDetailsPanel`, `PaymentPanel`, `PaymentTrackingPanel`, `InvoiceAllocationsEditor`), audit timeline below. `grid grid-cols-1 lg:grid-cols-2 items-start gap-5` at line 1311.
2. **Proposal review** — `src/app/proposals/review/[extraction_id]/page.tsx` + `src/components/proposals/*` (Phase 3.4). Lifted the invoice template verbatim. `ProposalFilePreview` LEFT, `ProposalDetailsPanel` + `ProposalLineItemsEditor` RIGHT, history timeline below.
3. **Draw approval detail (planned)** — extends Document Review for owner sign-off on AIA pay applications. AIA G702 PDF preview LEFT, line-item review + sign-off form RIGHT, audit history below.
4. **Lien release review (planned)** — extends Document Review for accounting QA. Vendor's lien release PDF LEFT, payment-match form RIGHT, history below.

### 2i. Anti-patterns

- **Right-rail above file preview on desktop.** The muscle memory PMs and accountants have is preview LEFT, fields RIGHT. Flipping breaks recognition. `nightwork-ui-reviewer` rejects.
- **Modal-only review (no full-page view).** A right-rail panel that lives only in a modal hides context and prevents copy/paste between fields.
- **Inline editing without an audit timeline.** Status changes must append to `status_history` JSONB and render below. Inline edit without history means no audit trail.
- **File preview rendered with custom `<iframe>` instead of `InvoiceFilePreview`'s dispatch.** The dispatch handles PDF / DOCX-as-HTML / IMG / unknown. Skipping it loses fallbacks.
- **Hardcoded color hex instead of CSS variables.** Per SYSTEM §13 + COMPONENTS.md anti-patterns gallery — hook T10a rejects.
- **Status badges rendered ad-hoc** (not via `formatStatus` + `statusBadgeOutline`). Use `NwBadge` with the locked variant set.
- **Nesting modals inside the right-rail.** Modals belong above the page (Confirm pattern §12). Nesting inside a panel breaks focus management.
- **Audit timeline above the right-rail.** Anti-pattern — history is below the working surface, not above. Above-rail history forces scrolling past historical noise to reach the editor.

### 2j. Cross-references

- The `nightwork-ui-template` skill (`.claude/skills/nightwork-ui-template/SKILL.md`) IS the canonical Document Review reference — read it before extending.
- SPEC A15 mandates `src/app/invoices/[id]/page.tsx` as the reference implementation.
- CLAUDE.md "UI rules" repeats the rule.
- Per Section §14 cross-pattern rules, Document Review can be overlaid by Confirm (§12) and uses Loading/Error/Skeleton (§12.5).

---

## 3. Pattern 2 — Multi-step Approval

**Purpose:** A sequential approval chain where a record moves through ordered states (e.g., PM → QA → push to QB), each step gated by a different role, each transition logged to status_history.

### 3a. When to use

- The workflow has multiple distinct roles approving in sequence (PM, then QA, then accounting; or PM, then owner, then finalize)
- Each role sees the same record but a different set of allowed actions
- A kick-back / reject path exists (e.g., QA can kick back to PM)
- Status transitions append to status_history JSONB per CLAUDE.md "Architecture rules"
- The pattern composes WITHIN Document Review (§2) — Multi-step Approval is the workflow PATTERN; Document Review is the SURFACE that hosts it

### 3b. When NOT to use

- The workflow is single-step (Submit → Done) — that's a Form (Pattern §6 Config Form for settings, or simple submit inside §2)
- The chain has 5+ steps with branching — that's a custom workflow surface; surface to PROPAGATION-RULES.md before extending
- No source document — Multi-step Approval is conceptually the workflow layered over Document Review or Config Form, not a standalone page

### 3c. Anatomy

```
┌─────────────────────────────────────────────────────────────────────┐
│ Document Review surface (file preview LEFT, fields RIGHT, audit BELOW)│
│ ┌─────────────────────────────────────────────────────────────────┐ │
│ │ Header — status badge shows current step (e.g., "QA REVIEW")     │ │
│ │ Workflow actions — role-gated:                                   │ │
│ │   PM at pm_review → [Approve] [Hold] [Deny] [Kickback] [Request] │ │
│ │   QA at qa_review → [QA Approve] [Kick Back to PM]                │ │
│ │   Accounting at qa_approved → [Push to QB] [Mark Failed]          │ │
│ └─────────────────────────────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────────────────────────────┐ │
│ │ Field editor (right rail of Document Review)                     │ │
│ │ - PM Review: can edit any AI-suggested field                     │ │
│ │ - QA Review: CAN'T edit PM-approved cost codes/amounts           │ │
│ │   (per CLAUDE.md "Edit Rules") — only vendor/QB mapping          │ │
│ │ - After QB push: locked; void+re-enter only                      │ │
│ └─────────────────────────────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────────────────────────────┐ │
│ │ Audit timeline                                                    │ │
│ │ - Each transition: {who, when, old_status, new_status, note}     │ │
│ │ - Color-coded by step (PM blue, QA green, push amber)            │ │
│ │ - Kick-back entries show as red with the inbound reason           │ │
│ └─────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
```

The pattern's UNIQUE element is the **role-gated workflow action set in the header**. Document Review supplies the rest.

### 3d. Components used

All Document Review components (§2d) plus:

- Role-gated action set composed of `NwButton` per allowed action — gated via `useCurrentRole()` hook (`src/hooks/use-current-role.ts`)
- `Confirm` (Overlays §6.3) — every non-trivial transition opens a Confirm modal with note field (Hold/Deny/Kickback always; Approve sometimes — controlled by org_settings.approve_requires_confirm)
- Inline `Form` (Inputs §1.6) inside Confirm for note capture
- `NwBadge` (Existing primitives §3.3) status badge — variant maps to step (pm_review→info, qa_review→warning, in_draw→success, denied→danger)
- `Banner` (Feedback §3.2) — kick-back banner showing reason from previous reviewer
- Audit timeline (rendered as `<ol>` of timeline items per Document Review)

### 3e. Tokens used

- All Document Review tokens (§2e)
- `--color-warning` — kick-back banner accent
- `--color-success` — push-to-QB success state
- `--color-error` — denied status
- `--bg-subtle` — kick-back banner tinted background
- `--brand-accent` — primary action button (Approve, QA Approve, Push)

### 3f. Accessibility

- **Action set narrates step.** `<div role="group" aria-label="Workflow actions for QA Review">` so SR users know which step they're at.
- **Kick-back reason is `role="alert"`.** When a record arrives from a kick-back, the banner uses `role="alert"` + `aria-live="polite"` so SR users hear the reason.
- **Note modal is a Confirm dialog.** Esc-to-cancel default focus on cancel button per SYSTEM §12 + Confirm pattern §12.
- **Audit-timeline transitions read with verb prefixes.** "PM approved on …" / "QA kicked back to PM on …" / "Pushed to QuickBooks on …" — SR users hear the verb, not just the state name.
- **Locked-record (after QB push) banner reads "Locked. Void and re-enter to change."**

### 3g. Mobile behavior

Inherits Document Review mobile (§2g). Specifically for Multi-step Approval:

- Action set collapses to a single primary CTA at the bottom (the most-likely action — e.g., "Approve" for PM at pm_review). Secondary actions (Hold, Deny, Kickback, Request Info) move into an overflow menu (`Popover` triggered by a "More" button) per `nw-phone`.
- The overflow Popover is keyboard- and touch-accessible per Overlays §6.2.
- Status badge stays above-the-fold per Document Review §2g.
- Confirm modal for note capture is full-screen at `nw-phone` per Modal §2.2.

### 3h. Examples

1. **Invoice approval flow.** PM → QA → push to QB → in_draw → paid. `src/app/invoices/[id]/page.tsx` is the live implementation. Action set varies by `useCurrentRole()` and `invoice.status`.
2. **Draw approval flow.** PM creates → QA reviews → owner approves → submitted. `src/app/draws/[id]/page.tsx` (planned to extend this pattern; current implementation is partial).
3. **Proposal review flow.** PM reviews AI extraction → Save / Convert to PO / Convert to CO / Reject. `src/app/proposals/review/[extraction_id]/page.tsx`.
4. **Lien release review flow (planned, Wave 2).** Accounting QA reviews vendor's lien release; payment match; mark released; or kick back to vendor.

### 3i. Anti-patterns

- **Role-blind action set.** Every NwButton in the action set must be gated by `useCurrentRole()`. Showing all actions to all users (with disabled styling for unauthorized) is anti-pattern — it leaks workflow shape.
- **Approve without note option.** Even Approve should have an optional note field (in Confirm modal) for audit purposes.
- **Kick-back without reason.** Kick-back ALWAYS requires a note. Confirm modal's submit is disabled when note is blank.
- **Skipping status_history append.** Every transition appends to status_history JSONB. The DB trigger backstop is a backstop, not the primary path — application code writes the entry. Per CLAUDE.md.
- **Allowing edit on locked records.** After QB push or draw inclusion, fields are read-only. The right-rail field editor swaps to read-only display per `isInvoiceLocked()` (`src/lib/invoice-permissions.ts`).
- **Confirm dialog without Esc.** Per SYSTEM §12c, Esc must dismiss the dialog. Cancel-as-default-focus is the safety contract.

---

## 4. Pattern 3 — Data-dense Overview (dashboard)

**Purpose:** A multi-widget summary page for a role or domain — many KPI cards, multiple data widgets, a single top-line headline. The user scans for status, drills into one widget to take action.

### 4a. When to use

- The page surfaces 4-12 distinct metrics or widget areas relevant to a role
- The user's job is to scan first, then act — not to edit in place
- Most widgets are read-only or "click through to drill in"
- The page has at most one primary action (e.g., "Create Job" on home dashboard)
- Density is high — comfortable padding wastes a desktop screen
- Per SPEC: home dashboard, per-job dashboard

### 4b. When NOT to use

- The page is for editing, not scanning — use Config Form (§6) or Document Review (§2)
- The page lists records uniformly — use List + Detail (§7)
- Mobile-first surface — collapse to Mobile Touch Approval (§5) or Empty Workspace (§9)
- The user needs detail on one record — drill in to Document Review (§2)
- A wizard is appropriate (sequential creation) — use Wizard (§8)

### 4c. Anatomy

```
┌─────────────────────────────────────────────────────────────────────┐
│ AppShell (NavBar top, JobSidebar visible at desktop)                  │
│ ┌─────────────────────────────────────────────────────────────────┐ │
│ │  Breadcrumbs (optional — usually omitted on top-level dashboards) │
│ │  Header — eyebrow + greeting + sub                               │ │
│ │  (e.g. "GOOD MORNING — Jake, here's your Tuesday.")              │ │
│ └─────────────────────────────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────────────────────────────┐ │
│ │ KPI strip — 3-4 stat cards, equal-width, 1px gap, bordered      │ │
│ │ ┌──────────┬──────────┬──────────┬──────────┐                  │ │
│ │ │ Active   │ PM Queue │ Open     │ Payments │                  │ │
│ │ │ Jobs     │          │ Draws    │ Due      │                  │ │
│ │ │ 14       │ 7 · 3d+  │ 3 · 1submd│ $42,108  │                  │ │
│ │ └──────────┴──────────┴──────────┴──────────┘                  │ │
│ └─────────────────────────────────────────────────────────────────┘ │
│ ┌─────────────────────┬───────────────────────────────────────────┐ │
│ │ Attention list      │ Cash flow / aging / activity feed          │ │
│ │ (Critical actions   │ (Multi-card stack)                         │ │
│ │  needing your input)│                                            │ │
│ │ - Card per item     │ - This month: invoiced / paid / net        │ │
│ │ - Severity dot      │ - Aging bands (current, 30d, 60d, 90d+)    │ │
│ │ - "Take action" CTA │ - Activity feed (last N events)            │ │
│ └─────────────────────┴───────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
```

Per `src/app/dashboard/page.tsx` lines 76-607 — KPI strip uses `grid-cols-4 gap-px` (1px hairline grid lines per Slate non-negotiable visual rule #4).

### 4d. Components used

- `AppShell` (Navigation §4.1)
- `NwEyebrow` (Existing primitives §7.2) — section labels
- `Space Grotesk h1` — greeting / page title
- `NwCard` (Existing primitives §7.4) — every widget container
- KPI stat card composition: `NwCard` + `NwEyebrow` + `Space Grotesk` value + `NwMoney` (when money) + `NwStatusDot` (when status)
- `NwMoney` (Existing primitives §7.6) — every dollar amount
- `NwStatusDot` (Existing primitives §7.7) — status indicators
- `NwBadge` (Existing primitives §7.3) — aging / severity / kind badges
- `NwButton` (Existing primitives §7.1) — drill-in / primary CTA
- `Banner` (Feedback §3.2) — global state banners (e.g., trial expiring)
- `EmptyState` (Feedback §3.3) — when a widget has zero data
- `Skeleton` (Feedback §3.6) — initial load
- `SkeletonStatCard` and `SkeletonList` from `loading-skeleton.tsx` for prefab loading shapes

### 4e. Tokens used

- `--bg-page` — outer shell
- `--bg-card` — every Card
- `--bg-muted` — KPI strip's hairline grid (1px gap shows the gray underneath)
- `--text-primary` — KPI values, card titles
- `--text-secondary` — KPI labels (eyebrows), card sub-text
- `--text-tertiary` — metadata
- `--border-default` — Card borders
- `--shadow-hover` — Card lifts on hover (interactive cards only)
- `--color-success` — green accents (active jobs, paid)
- `--color-warning` — yellow accents (held, awaiting)
- `--color-error` — red accents (overdue, denied)
- `--color-money` — money values
- `--font-display` — KPI values, h1 (Space Grotesk)
- `--font-mono` — KPI labels (eyebrows), counts (JetBrains Mono)
- `--space-px` — 1px hairline gap in KPI strip
- `--space-4` to `--space-6` — Card internal padding
- `--brand-accent` — primary CTA, active-tab indicator

### 4f. Accessibility

- **Page landmark.** `<main role="main">` wraps the dashboard. KPI strip uses `<section aria-labelledby="kpi-heading">` with a visually-hidden h2.
- **KPI cards are read as a list.** `<ul>` + `<li>` per KPI; each KPI card has a visible label + visible value. SR users hear "Active jobs, fourteen. PM queue, seven, oldest three days ago. …"
- **Drill-in CTAs.** Each clickable widget area has either a descriptive button OR a link with descriptive text. "View attention" not "View".
- **Status dots paired with labels.** Per WCAG 1.4.1 — `NwStatusDot label="Active"` provides SR-only text. Visual only never.
- **Empty widgets render `EmptyState` with `role="status"`.** "No invoices in your queue" announces.
- **Skeleton states announce.** `Skeleton` with `ariaLabel="Loading dashboard"` announces while data is fetching.

### 4g. Mobile behavior

| Region                  | nw-desktop                    | nw-tablet                    | nw-phone                                       |
|-------------------------|-------------------------------|------------------------------|------------------------------------------------|
| AppShell sidebar        | visible                       | hidden (drawer overlay)      | hidden (drawer overlay)                        |
| Greeting header         | full text                     | full text                    | shortened sub-text                             |
| KPI strip               | 4-col grid                    | 2-col grid                   | 1-col stack (each KPI card full-width)         |
| Attention + cashflow    | side-by-side 2-col            | stacked 1-col                | stacked 1-col                                  |
| Activity feed           | list                          | list                         | list with "show more" pagination               |
| Primary CTA             | inline in header              | inline                       | sticky bottom CTA if "Create Job" is the action |

### 4h. Examples

1. **Home dashboard.** `src/app/dashboard/page.tsx` (607 lines). Greeting + KPI strip (active jobs, PM queue, open draws, payments due) + attention list + cash flow + activity feed.
2. **Per-job dashboard.** `src/app/jobs/[id]/page.tsx` (planned — Wave 1.1). Job-scoped KPIs (current contract, total spent, draws to date, payments due) + budget snapshot + recent activity.
3. **Owner portal dashboard.** Per `Slate Owner Portal.html` prototype. Job-scoped KPIs for the owner role + draw approval action card + payment history.
4. **Settings overview** (`/settings`) — currently redirects to `/settings/company`; if expanded, would use this pattern as a sub-area dashboard.

### 4i. Anti-patterns

- **Filled status pills on a dashboard.** Per Slate non-negotiable visual rule #7 (COMPONENTS.md anti-patterns #10) — bordered, never filled. NwBadge enforces.
- **Background gradients on KPI cards.** Per SYSTEM §13c — no generic gradients. Cards are flat with optional hover lift.
- **More than 12 widgets on one dashboard.** Information overload. Split by role (home dashboard vs job dashboard vs owner portal).
- **Edit-in-place on a dashboard.** Anti-pattern. Drill into Document Review or Config Form for editing.
- **Custom widget shapes.** Every widget uses NwCard with consistent padding and eyebrow + content structure. Inventing new widget shapes per dashboard is anti-pattern; surface to PROPAGATION-RULES.md.
- **Hardcoded color hex** (`bg-[#5B8699]`) — hook T10a rejects.

---

## 5. Pattern 4 — Mobile Touch Approval

**Purpose:** A touch-first single-action surface optimized for PMs in the field. Maximum context above-the-fold, single primary action button, secondary actions in an overflow.

### 5a. When to use

- The user is on a phone (`nw-phone` breakpoint per SYSTEM §9)
- The action is approval / hold / deny — high-stakes, irreversible-ish workflow transition
- The user has reviewed the content already (read it on desktop, comes back to phone to act) OR the content is small enough to review on phone
- Single canonical action is most likely (e.g., "Approve" 80% of the time, secondary actions used rarely)
- Per SPEC A18 — touch targets 56×56 high-stakes; gesture vocabulary is taps only (no swipe-to-approve in v1)

### 5b. When NOT to use

- Multi-field editing — use Document Review (§2) which collapses to mobile via §2g
- The page is desktop-first with a mobile fallback — that's Document Review (§2g) collapse, not Mobile Touch Approval
- The user must do detailed work on phone — use the Document Review collapse, not this pattern
- The user is browsing many records — use List + Detail (§7) collapse to card-stack
- The user is on tablet (`nw-tablet`) — use the Document Review collapse; Mobile Touch Approval is `nw-phone`-specific

### 5c. Anatomy

```
┌─────────────────────────┐  (nw-phone — 0-639px)
│ NavBar (icon + role chip)│
│ ┌─────────────────────┐ │
│ │ Eyebrow / Crumbs    │ │
│ │ Space Grotesk title │ │
│ │ Status badge        │ │
│ └─────────────────────┘ │
│ ┌─────────────────────┐ │
│ │ TOTAL — large money │ │
│ │ ($12,450.00)         │ │
│ └─────────────────────┘ │
│ ┌─────────────────────┐ │
│ │ 4-quad meta grid    │ │
│ │ ┌──────┬──────┐     │ │
│ │ │ Vend │ Date │     │ │
│ │ ├──────┼──────┤     │ │
│ │ │ Job  │ Cost │     │ │
│ │ │      │ Code │     │ │
│ │ └──────┴──────┘     │ │
│ └─────────────────────┘ │
│ ┌─────────────────────┐ │
│ │ File preview        │ │
│ │ (tap to expand to   │ │
│ │  full-screen)       │ │
│ │ - pinch-zoom        │ │
│ │ - pan               │ │
│ └─────────────────────┘ │
│                         │
│ ╔═════════════════════╗ │  (sticky bottom — always visible)
│ ║ [APPROVE]   ⋮ More  ║ │   ≥56×56 high-stakes
│ ╚═════════════════════╝ │
└─────────────────────────┘
```

Above-the-fold from top: NavBar (~54px) + Eyebrow + Title (~50px) + Status badge inline with title + TOTAL (large, ~60px) + 4-quad meta grid (~120px) ≈ 280px. The first ~370px on a 6.7" phone shows everything except the file preview. Sticky bottom CTA stays available regardless of scroll.

### 5d. Components used

- `NavBar` (mobile variant) — collapsed to icon + role chip
- `NwEyebrow` (Existing primitives §7.2) — top label
- `Space Grotesk h1` (smaller — `--fs-h2` or `--fs-xl`) — title
- `NwBadge` (Existing primitives §7.3) — status pill
- `NwMoney` (Existing primitives §7.6) — TOTAL value (large size = `xl`)
- `NwDataRow` (Existing primitives §7.5) — 4-quad meta grid (label + value pairs)
- `InvoiceFilePreview` — tap-to-expand to full-screen
- `NwButton` (Existing primitives §7.1) — primary action (`xl` size = 56px high-stakes per SYSTEM §11)
- `Popover` (Overlays §6.2) — overflow menu for secondary actions (Hold, Deny, Kick Back, Request Info)
- `Confirm` (Overlays §6.3) — full-screen on phone for note capture

### 5e. Tokens used

- All Document Review tokens (§2e)
- `--brand-accent` — primary CTA bg
- `--space-3` — internal padding (denser on mobile)
- `--space-2` — gaps in 4-quad meta grid
- `--font-display` — TOTAL value size = `--fs-h2` (30px) for legibility
- `--shadow-panel` — sticky bottom CTA elevation (slight lift to separate from page)
- `--bg-card` — card surface

### 5f. Accessibility

- **Above-the-fold landmarks.** `<header>` for title + status; `<section aria-labelledby="invoice-summary">` for the meta grid.
- **TOTAL is announced as money.** `<NwMoney aria-label="Total amount, twelve thousand four hundred fifty dollars">` so SR users hear the formatted value, not the digits. (NwMoney aria-label gap per COMPONENTS.md §14.2 — T20e remediation; until then, the `formatCents` output is the visible text.)
- **File preview is a button.** "Open file preview" — tappable to enter full-screen mode. Inside full-screen: pinch-zoom and pan gestures supported via Vaul Drawer (per COMPONENTS.md §2.3) OR a custom modal.
- **Primary CTA touch target ≥56×56px.** Per SYSTEM §11. The Approve button uses `<NwButton size="lg">` plus an inline `style={{ minHeight: 56 }}` since NwButton doesn't have an `xl=56px` size variant today (per COMPONENTS.md §13.3 high-stakes gap). T20a addresses with formal `xl` variant.
- **Overflow menu reads as a button.** "More actions, opens menu" — Popover with `aria-haspopup="menu"`.
- **Sticky bottom CTA respects safe-area-inset.** `padding-bottom: env(safe-area-inset-bottom)` keeps the CTA above iPhone home indicator.

### 5g. Mobile behavior

This pattern IS the mobile pattern. Variations:

| Viewport     | Behavior                                                            |
|--------------|---------------------------------------------------------------------|
| nw-phone     | this pattern (sticky bottom CTA, tap-to-expand preview, 4-quad meta) |
| nw-tablet    | reverts to Document Review §2 collapsed-tablet mode (preview top, fields bottom) — Mobile Touch Approval is `nw-phone`-only |
| nw-desktop   | reverts to Document Review §2 desktop layout                          |

Per SPEC A18.1 — Mobile Touch Approval is the `nw-phone` collapse of Document Review. They're the SAME workflow, different surfaces.

### 5h. Examples

1. **PM mobile invoice approval.** Per `Slate Mobile Jobsite.html` prototype — PM sees an invoice on their phone, taps Approve. Implementation: Document Review (§2) at `nw-phone` breakpoint adopts this anatomy. Drives `src/app/invoices/[id]/page.tsx` mobile collapse.
2. **PM mobile draw review.** When the draw is small enough to scan on phone, PM can approve from phone. Otherwise drill into desktop.
3. **Owner mobile draw sign-off.** Per `Slate Owner Portal.html` mobile collapse — owner sees draw summary, taps Approve.
4. **PM mobile change order approval.** Same shape — CO summary + tap Approve.

### 5i. Anti-patterns

- **Tiny touch targets on mobile.** Per SYSTEM §11 — high-stakes actions are ≥56×56. Anti-pattern: 32px Approve button on phone.
- **No sticky bottom CTA.** PMs in the field scroll while reviewing the file preview; CTA must always be reachable. Anti-pattern: Approve button only at bottom-of-page (after long scroll).
- **Swipe-to-approve gestures.** Per SPEC A18 — taps only. Swipe-to-dismiss on lists is OK; swipe-to-approve on a single record is anti-pattern (too easy to mis-trigger).
- **Hiding the status badge below-the-fold.** Per SPEC A18.1 — status above-the-fold. PM must know the workflow state without scrolling.
- **Modal-only review.** Phone users can't easily switch between modal and underlying page. Use full-screen Drawer or Sheet instead.
- **Desktop-trying-to-be-phone-app.** Per SYSTEM §13g — desktop shouldn't force single-column stack at >1024px. Mobile Touch Approval is `nw-phone`-specific; desktop uses Document Review.

---

## 6. Pattern 5 — Config Form (settings)

**Purpose:** A form-driven page for configuring a tenant or domain. Fields grouped into sections, save bar at the bottom, no source document, no audit timeline (settings audit lives in admin/audit-log).

### 6a. When to use

- The page edits org-scoped config (settings/financial, settings/workflow, settings/company, settings/team)
- All fields are direct-edit (no AI parsing, no source document)
- Fields are grouped into sections (e.g., "Payment Schedule" group with 3 fields, "GC Fee Defaults" group with 2 fields)
- A single Save button persists all fields atomically (or per-section save if the form is large)
- Validation is field-level + form-level (e.g., "GC fee must be 0-100%" + "either deposit OR retainage required")

### 6b. When NOT to use

- The page edits a record with a source document — use Document Review (§2)
- The page lists records — use List + Detail (§7)
- The page creates a new record sequentially — use Wizard (§8)
- The page is one-time onboarding — use Wizard (§8)
- A modal is appropriate (small confirm + save) — use Confirm (§12)

### 6c. Anatomy

```
┌─────────────────────────────────────────────────────────────────────┐
│ AppShell (NavBar top, AdminSidebar visible at desktop)                │
│ ┌─────────────────────────────────────────────────────────────────┐ │
│ │  Page header — eyebrow + h1 + sub                                │ │
│ │  ("ADMIN — Financial Settings — Payment, fees, defaults")         │ │
│ └─────────────────────────────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────────────────────────────┐ │
│ │  Settings sub-nav — AdminSidebar at desktop / horizontal tabs   │ │
│ │  at tablet, scroll on overflow at phone                          │ │
│ │  - Company - Financial - Workflow - Cost Codes - Team - Billing  │ │
│ └─────────────────────────────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────────────────────────────┐ │
│ │  Section group 1 — "Payment Schedule"                            │ │
│ │  ┌──────────────────────────────────────────────────────────┐   │ │
│ │  │ Eyebrow — PAYMENT SCHEDULE                                │   │ │
│ │  │ Description — When checks are issued for invoices.       │   │ │
│ │  │ Form field 1 — Cutoff day 1 (radio: 5th / 15th / custom) │   │ │
│ │  │ Form field 2 — Cutoff day 2 (radio: 20th / 30th / custom)│   │ │
│ │  │ Form field 3 — Honor weekends/holidays (toggle)          │   │ │
│ │  └──────────────────────────────────────────────────────────┘   │ │
│ │                                                                   │ │
│ │  Section group 2 — "GC Fee Defaults"                              │ │
│ │  ┌──────────────────────────────────────────────────────────┐   │ │
│ │  │ Eyebrow — GC FEE DEFAULTS                                 │   │ │
│ │  │ Form field 1 — Default GC fee % (number, suffix %)        │   │ │
│ │  │ Form field 2 — Default deposit % (number, suffix %)       │   │ │
│ │  └──────────────────────────────────────────────────────────┘   │ │
│ │                                                                   │ │
│ │  …additional sections…                                            │ │
│ └─────────────────────────────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────────────────────────────┐ │
│ │  Save bar (sticky bottom, full-width)                            │ │
│ │  - Reset / Save Changes (NwButton primary at right)              │ │
│ │  - "Saved 2 minutes ago" timestamp at left                        │ │
│ └─────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
```

Per `src/app/settings/layout.tsx` — the settings shell renders NavBar + AdminMobileNav + AdminSidebar wrapping `{children}`. Each settings page (`/settings/financial`, `/settings/workflow`, etc.) supplies its own form composition.

### 6d. Components used

- `AppShell` (Navigation §4.1) — outer chrome; layout-level redirect to `/login` if no membership
- `AdminSidebar` + `AdminMobileNav` (Navigation §4.2 — Tabs-as-nav variant) — settings sub-nav
- `NwEyebrow` (Existing primitives §7.2) — section labels
- `Space Grotesk h1` — page title
- `NwCard` (Existing primitives §7.4) — wraps each section group
- `Form` (Inputs §1.6) + `FormField` + `FormLabel` + `FormControl` + `FormMessage` + `FormDescription` — every editable field
- `Input` (Inputs §1.2) — text fields
- `Select` (Inputs §1.3) / `Combobox` (Inputs §1.4) — dropdown / searchable picks
- `Switch` (planned T20a) — booleans
- `RadioGroup` (planned T20a) — radio choices (e.g., payment cutoff schedule)
- `NwButton` (Existing primitives §7.1) — Save / Reset
- `Toast` (Feedback §3.1) — "Settings saved" announcement
- `Banner` (Feedback §3.2) — for warnings (e.g., "Changing payment schedule will affect 7 in-flight invoices")
- `Confirm` (Overlays §6.3) — for destructive section-level changes (e.g., "Reset cost codes to template")

### 6e. Tokens used

- `--bg-page` — outer
- `--bg-card` — Card surfaces (each section group)
- `--bg-subtle` — input background, hover row
- `--text-primary` — values
- `--text-secondary` — labels (eyebrows are mono-uppercase)
- `--text-tertiary` — descriptions
- `--border-default` — Card borders, input borders
- `--ring` — focus on inputs (Stone Blue)
- `--color-error` — invalid state, FormMessage red
- `--font-display` — h1
- `--font-body` — Inter for input text
- `--font-mono` — eyebrows + JetBrains Mono for any number/percentage suffix
- `--space-6` — between section groups
- `--space-4` — internal section padding
- `--brand-accent` — Save primary CTA

### 6f. Accessibility

- **Section landmarks.** Each Card uses `<section aria-labelledby="section-eyebrow-id">`. SR users navigate sections by landmarks.
- **Field labels via `<FormLabel htmlFor>`.** Always paired with `<FormControl id>`. SR users hear "GC Fee, percent input, current value 20".
- **Field descriptions via `<FormDescription>`.** Linked via `aria-describedby` so SR users hear context.
- **Field errors via `<FormMessage role="alert">`.** Live-announced via `aria-live="polite"`. Field also gets `aria-invalid="true"`.
- **Save bar always reachable.** Sticky bottom; respects safe-area-inset; SR users can tab from any field to the Save button without leaving the form context.
- **Toast announces save.** `role="status"` + `aria-live="polite"` per Feedback §3.1.
- **Confirm dialogs for destructive actions.** Esc-cancel default focus per §12.

### 6g. Mobile behavior

| Region          | nw-desktop                | nw-tablet                 | nw-phone                                       |
|-----------------|---------------------------|---------------------------|------------------------------------------------|
| AdminSidebar    | visible (left rail)       | visible (collapsible)     | hidden (drawer overlay or AdminMobileNav)      |
| Header          | full title + sub          | full                      | shortened sub                                  |
| Section group   | Card with comfortable pad | Card                      | Card with compact padding                      |
| Form field layout | label-on-top vertical    | label-on-top              | label-on-top vertical (no horizontal collapse) |
| Save bar        | sticky bottom full-width  | sticky bottom             | sticky bottom; respects safe-area-inset        |
| Save CTA        | inline right              | inline right              | full-width                                     |

Vertical (label-on-top) layout is the default per COMPONENTS.md §1.6 — horizontal layout collapses to vertical at `nw-phone` regardless of caller intent.

### 6h. Examples

1. **Financial settings.** `src/app/settings/financial/FinancialSettingsForm.tsx` — payment schedule, GC fee defaults, deposit defaults, retainage rules.
2. **Workflow settings.** `src/app/settings/workflow/WorkflowSettingsForm.tsx` — invoice approval gates, duplicate detection toggle, over-budget note requirement.
3. **Company settings.** `src/app/settings/company/CompanySettingsForm.tsx` — company name, logo upload, address, contact info, brand-accent + brand-logo (per A11 contract — see SYSTEM §2 + COMPONENTS.md §10).
4. **Team settings.** `src/app/settings/team/TeamSettings.tsx` — invite users, manage roles, deactivate.
5. **Cost codes.** `src/app/settings/cost-codes/CostCodesManager.tsx` — extends Config Form with a List + Detail (§7) inline editor for cost code rows. (Hybrid pattern — surface to PROPAGATION-RULES.md if pattern divergence becomes problematic.)

### 6i. Anti-patterns

- **No save bar (auto-save on blur).** Per construction-finance settings — auto-save means PMs accidentally change values mid-edit. Explicit Save is required.
- **Save bar at the top instead of bottom.** Anti-pattern. PMs reach for the bottom. Top-save bar means scroll-up after every section.
- **Confirm dialog for trivial changes.** Anti-pattern. Confirm is for destructive (per §12). Auto-saving forms have no confirm; settings forms have an explicit Save button + a Confirm dialog only for destructive sub-actions ("Reset to defaults").
- **Field-level inline edit (click value, edit in place, blur to save).** Anti-pattern for settings — too easy to mis-edit. Use explicit form fields with an explicit Save.
- **Settings on a non-AppShell layout.** Settings always uses `src/app/settings/layout.tsx` — NavBar + AdminSidebar. Skipping the sidebar means PMs lose nav context.
- **Hardcoded section titles instead of `NwEyebrow`.** Per SYSTEM §4 — eyebrows are JetBrains Mono UPPERCASE 0.14em tracking.

---

## 7. Pattern 6 — List + Detail

**Purpose:** A table or card list with optional drill-in to a detail panel or right-rail. Used when the user is browsing many records of the same type and may select one for detail.

### 7a. When to use

- The page lists records (vendors, invoices, change orders, cost codes, etc.)
- Selecting a record opens a detail view (right-rail, drawer, or new page)
- Filtering / sorting / pagination is common
- The user's primary mode is "scan list, open one"
- Per SPEC: invoices/queue, vendors, change-orders, cost-intelligence/items

### 7b. When NOT to use

- The list is short (≤7 items) and selection auto-loads detail in a sidebar — that's a Wizard step or part of a Config Form
- The list is for navigation only (no detail) — use Tabs-as-nav (Navigation §4.2) or AppShell sidebar
- Each record has a heavy right-rail (file preview + fields + audit) — use Document Review (§2), drilling in from a separate list page
- The user is creating a record — use Wizard (§8) or Config Form (§6)

### 7c. Anatomy (two sub-shapes — see §7c.1 and §7c.2)

#### 7c.1. List + Drill-in (separate page detail)

```
┌─────────────────────────────────────────────────────────────────────┐
│ AppShell (NavBar top)                                                 │
│ ┌─────────────────────────────────────────────────────────────────┐ │
│ │  Header — eyebrow + h1 + Primary CTA (e.g., "+ Add Invoice")    │ │
│ │  Filter chips bar (kind / status / aging / pm)                   │ │
│ │  Search input (full-width or top-right)                          │ │
│ └─────────────────────────────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────────────────────────────┐ │
│ │  Table / Card list                                                │ │
│ │  - rows are sortable                                              │ │
│ │  - row click → navigate to detail page                            │ │
│ │  - confidence / status badge per row                              │ │
│ │  - aging badge if relevant                                        │ │
│ │  - row hover lift via --shadow-hover                              │ │
│ └─────────────────────────────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────────────────────────────┐ │
│ │  Pagination (or infinite-scroll at nw-phone)                     │ │
│ └─────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
```

Used when each record is heavyweight (e.g., an invoice with file preview + fields + audit). Click navigates to `/invoices/[id]`.

#### 7c.2. List + Right-rail (in-page detail)

```
┌─────────────────────────────────────────────────────────────────────┐
│ AppShell                                                              │
│ ┌─────────────────────────────────────────────────────────────────┐ │
│ │  Header (same as 7c.1)                                            │ │
│ └─────────────────────────────────────────────────────────────────┘ │
│ ┌──────────────────────────────────────┬──────────────────────────┐ │
│ │  List (col-span-7)                    │  Right-rail detail        │ │
│ │  - selectable rows                    │  (col-span-5)             │ │
│ │  - selected row highlighted           │  - selected record's fields│ │
│ │  - infinite scroll or pagination      │  - inline edit             │ │
│ │                                       │  - Empty state if nothing │ │
│ │                                       │    selected                │ │
│ └──────────────────────────────────────┴──────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
```

Used when each record is lightweight (e.g., a cost code with name + sort_order + category). Right-rail edits in place, no separate page.

### 7d. Components used

- `AppShell` (Navigation §4.1)
- `NwEyebrow` (Existing primitives §7.2)
- `NwButton` (Existing primitives §7.1) — primary CTA in header
- `Combobox` (Inputs §1.4) — search OR filter picker
- `Tabs` (Surfaces §2.5) — filter chips bar (variant `pills`)
- `NwBadge` (Existing primitives §7.3) — aging / status / confidence per row
- `Table` (Data display §5.1) OR `DataGrid` (Data display §5.2) — list rendering
  - Use `Table` when fewer than 50 rows and no sort/filter complexity
  - Use `DataGrid` when 50+ rows, sortable, filterable, paginated, column-visibility
- `NwMoney` (Existing primitives §7.6) — money columns
- `NwStatusDot` (Existing primitives §7.7) — status indicator
- `NwCard` (Existing primitives §7.4) — for card-stack collapse on mobile
- `EmptyState` (Feedback §3.3) — when filter returns 0 records
- `Skeleton` / `SkeletonTableRow` (Feedback §3.6) — initial load
- For 7c.2 List + Right-rail: `Sheet` (Surfaces §2.4) at `nw-tablet`+ for the right-rail; collapses to `Drawer` (Surfaces §2.3) at `nw-phone`

### 7e. Tokens used

- `--bg-page` — outer
- `--bg-card` — Card surfaces (in card-stack mobile)
- `--bg-muted` — Table header bg, striped row alt
- `--bg-subtle` — row hover bg
- `--text-primary` — cell values
- `--text-secondary` — header labels
- `--border-default` — table dividers, Card borders
- `--shadow-hover` — Card lift on row hover (interactive)
- `--brand-accent` — selected row left border + primary CTA
- `--font-mono` — money columns + count badges + table header eyebrows
- `--space-3` to `--space-4` — Table cell padding (density-driven per SYSTEM §10)

### 7f. Accessibility

- **Table semantics.** Per COMPONENTS.md §5.1 — `<thead>`, `<tbody>`, `<th scope="col">`, `<th scope="row">`. Sortable columns get `aria-sort`. Caption via `<TableCaption>`.
- **DataGrid keyboard nav.** Per COMPONENTS.md §5.2 — sortable headers Enter/Space toggle sort; row selection via spacebar; pagination buttons have explicit labels.
- **Filter chips read as buttons.** "Filter: status, currently 'pm_review'" — clicking removes the filter.
- **Row click → drill-in.** Each row has a `<Link>` wrapping the row OR a button per row. Either is keyboard-accessible.
- **Empty state announces.** `EmptyState` with `role="status"` per Feedback §3.3.
- **Selection in 7c.2.** Selected row gets `aria-selected="true"`. Right-rail's content has `aria-live="polite"` so SR users hear when selection changes.

### 7g. Mobile behavior

| Region          | nw-desktop                  | nw-tablet                  | nw-phone                                       |
|-----------------|-----------------------------|----------------------------|------------------------------------------------|
| Header + CTA    | inline                       | inline                     | wrapped, CTA full-width                        |
| Filter chips    | horizontal row              | horizontal row, scroll on overflow | horizontal scroll (show chevron indicators)|
| Search          | top-right                   | top-right                  | full-width below header                        |
| List rendering  | Table OR DataGrid           | Table OR DataGrid          | Card stack (one Card per row)                  |
| Selected detail (7c.2) | inline col-span-5    | bottom-row Sheet           | Drawer (bottom-up, dismissible)                |
| Pagination      | numbered + page-size        | numbered                   | "Load more" infinite-scroll                    |

For 7c.2 specifically — the right-rail collapses to a Sheet at `nw-tablet`, then Drawer at `nw-phone`. Selecting a row opens the Drawer per COMPONENTS.md §2.3.

### 7h. Examples

1. **Invoice queue.** `src/app/invoices/queue/page.tsx` — List + Drill-in (7c.1). Filter chips for kind/status, search by vendor/number/job, card-stack at mobile per `MissingDataBadges` per row, click row → `/invoices/[id]`.
2. **Vendors.** `src/app/vendors/page.tsx` (planned) — List + Right-rail (7c.2). Vendor list with inline edit in right-rail.
3. **Change orders.** `src/app/change-orders/page.tsx` (planned) — List + Drill-in (7c.1). PCCO log → click → CO detail review.
4. **Cost codes.** `src/app/settings/cost-codes/CostCodesManager.tsx` — Hybrid Config Form + List + Right-rail. Cost code list with inline edit panel.
5. **Cost intelligence items.** `src/app/cost-intelligence/items/page.tsx` (planned) — List + Drill-in. AI-suggested cost code items pending PM acceptance.

### 7i. Anti-patterns

- **Mixing Table + DataGrid in one page.** Pick one. Use Table for ≤50 rows; DataGrid for sort/filter/paginate.
- **Card-stack at desktop.** Per SYSTEM §13g — "phone-trying-to-be-desktop" is anti-pattern. Card-stack belongs at `nw-phone`; desktop uses Table or DataGrid.
- **Pagination + infinite-scroll mixed.** Pick one per breakpoint. Pagination at desktop, infinite-scroll at mobile is allowed; mixing on the same surface confuses.
- **Row click that opens a modal instead of navigating.** Modal is for confirms; navigation is for drill-in. Use `<Link>` not modal.
- **Filter chips that don't show their current value.** Each filter chip displays "Status: pm_review" not just "Status" — value is part of the chip text.
- **No empty state.** A filter that returns 0 records must show an EmptyState, not a blank page.
- **No skeleton on initial load.** Initial page load shows Skeleton rows; subsequent filter changes are instant from cached data per `loading-skeleton.tsx` comment.
- **Hardcoded color hex** (`bg-[#5B8699]`) — hook T10a rejects.

---

## 8. Pattern 7 — Wizard

**Purpose:** A multi-step entity creation flow. Step indicator at top, per-step form below, back/next navigation, validation per step.

### 8a. When to use

- Creating a new entity that needs 2-5 distinct sections
- The user's path is sequential (Step 1 must complete before Step 2 makes sense)
- Each step has its own form fields and own validation
- The user can step back without losing data
- Per SPEC: jobs/new (job creation), draws/new (draw creation), signup/onboard (onboarding)

### 8b. When NOT to use

- Creating an entity with all fields fitting on one page — use Config Form (§6)
- Editing an existing entity — use Document Review (§2) or Config Form (§6)
- Sequential approval (PM → QA → push) — use Multi-step Approval (§3)
- The user can do steps in any order — use a tabbed Config Form (§6)

### 8c. Anatomy

```
┌─────────────────────────────────────────────────────────────────────┐
│ AppShell (NavBar top)                                                 │
│ ┌─────────────────────────────────────────────────────────────────┐ │
│ │  Header — eyebrow + h1                                            │ │
│ │  ("NEW JOB — Drummond Residence")                                 │ │
│ └─────────────────────────────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────────────────────────────┐ │
│ │  Stepper — equal-width steps, hairline dividers, current bold   │ │
│ │  ┌──────┬──────┬──────┬──────┬──────┐                          │ │
│ │  │ ① done│ ② done│ ③ now │ ④     │ ⑤     │                          │ │
│ │  │ Co.  │ Fin. │ Codes │ Team │ Done │                          │ │
│ │  └──────┴──────┴──────┴──────┴──────┘                          │ │
│ └─────────────────────────────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────────────────────────────┐ │
│ │  Step body — form for this step's fields                         │ │
│ │  - section eyebrow                                                │ │
│ │  - description                                                    │ │
│ │  - form fields per the step                                       │ │
│ │  - inline validation                                              │ │
│ └─────────────────────────────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────────────────────────────┐ │
│ │  Footer — Back (left) / Skip / Next (right)                      │ │
│ │  - Back disabled on first step                                   │ │
│ │  - Next disabled until step validates                             │ │
│ │  - Final step: "Complete" instead of "Next"                       │ │
│ └─────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
```

Per `Slate Draw Wizard.html` prototype lines 35-44 — the stepper uses `display: flex; gap: 2px;` with each step at `flex: 1`. Done steps have `--success` color border; current step has `--stone-blue` background; pending steps have muted styling.

### 8d. Components used

- `AppShell` (Navigation §4.1)
- `NwEyebrow` (Existing primitives §7.2)
- `Space Grotesk h1`
- Stepper composition (custom — using NwEyebrow + numbered indicator + label per step)
- `NwCard` (Existing primitives §7.4) — wraps the step body
- `Form` + `FormField` + `FormLabel` + `FormControl` + `FormMessage` + `FormDescription` (Inputs §1.6) — per-step form
- `Input` / `Select` / `Combobox` / `DatePicker` (Inputs §1.2-§1.5)
- `RadioGroup` (planned T20a) — for choice-driven steps (e.g., contract type)
- `NwButton` (Existing primitives §7.1) — Back / Skip / Next / Complete (Next is `primary`; Back is `ghost`; Skip is `secondary`)
- `Banner` (Feedback §3.2) — for warnings (e.g., "GC fee exceeds typical for this builder type")
- `Confirm` (Overlays §6.3) — for "Are you sure you want to skip team setup?" or destructive actions
- `LoadingState` (Feedback §3.4) — when next-step requires async (e.g., importing CSV)

### 8e. Tokens used

- `--bg-page` — outer
- `--bg-card` — step body Card
- `--bg-subtle` — stepper inactive step bg
- `--bg-inverse` — stepper current step bg (slate-deep)
- `--text-primary` — current step label, form values
- `--text-secondary` — inactive step labels
- `--text-tertiary` — pending step labels
- `--color-success` — done step indicator border
- `--brand-accent` — current step bg, Next CTA, focus ring
- `--border-default` — Card border
- `--font-mono` — step number, eyebrows
- `--font-display` — h1 only
- `--space-px` — hairline divider in stepper
- `--space-2` — gap between stepper steps

### 8f. Accessibility

- **Stepper as `<ol role="list">`.** Each step is `<li>`. Done steps have `aria-current="false"`; current step `aria-current="step"`; pending steps no aria-current. SR users hear "Step 3 of 5: Cost codes, current step".
- **Step body as `<form>`.** With explicit `<form aria-labelledby="step-title-id">`. SR users hear the form's title.
- **Validation announces.** Form field errors via `<FormMessage role="alert">` + `aria-live="polite"`.
- **Next button disabled until valid.** `aria-disabled="true"` while invalid; tooltip explains why ("Fill required fields to continue").
- **Back doesn't lose data.** State persists across step changes; Back returns to the previous step with its form values intact.
- **Skip is explicit.** SKIP is allowed on optional steps with confirmation. Confirm dialog "Skip team setup? You can invite users later in Settings."

### 8g. Mobile behavior

| Region          | nw-desktop                  | nw-tablet                  | nw-phone                                       |
|-----------------|-----------------------------|----------------------------|------------------------------------------------|
| Header          | full title                   | full                       | shortened                                      |
| Stepper         | horizontal (5 cells)         | horizontal                 | horizontal scroll on overflow; sticky current  |
| Step body       | Card with comfortable pad    | Card                       | Card with compact padding                      |
| Form layout     | label-on-top vertical        | vertical                   | vertical                                       |
| Footer (back/next) | inline                    | inline                     | sticky bottom; full-width Next, ghost Back       |

Stepper at `nw-phone` becomes a horizontal-scrollable strip with the current step sticky-positioned. The user can swipe through previous steps without losing the current-step indicator.

### 8h. Examples

1. **Onboard wizard.** `src/app/onboard/OnboardWizard.tsx` — 4-5 steps for new tenant: company, financial defaults, cost codes (template/csv/blank), team, done. Per `Slate Owner Sign-in.html` for the auth shell preceding it.
2. **New job.** `src/app/jobs/new/page.tsx` — single-page form OR wizard (currently single-page; planned migration to 3-4 step wizard: contract type → owner info → financials → review).
3. **New draw.** `src/app/draws/new/page.tsx` (430+ lines) — multi-step preview-and-commit. Per `Slate Draw Wizard.html` for the layout. Steps: select invoices → review G703 → review G702 → submit.
4. **Bulk import wizard (planned).** Wave 2 — for AIA G702/G703 historical-data import. Steps: upload file → map columns → preview → commit.

### 8i. Anti-patterns

- **No back button.** Anti-pattern. Users mis-click Next; need to step back.
- **Validation only on Next click.** Anti-pattern. Per-field inline validation is required.
- **Stepper that doesn't show progress.** Hide-or-show-only-current is anti-pattern. Show all steps; visible progress is part of the user model.
- **Wizard for editing.** Anti-pattern. Wizards are creation-only. Editing uses Document Review or Config Form.
- **Wizard for ≤2 steps.** Anti-pattern. 2 steps is just two screens; use Config Form. Wizard is 3+ steps.
- **Modal-only wizard.** Anti-pattern for non-trivial wizards. A 4-step wizard in a modal cramps each step. Use full-page wizard. Modal-wizard is acceptable for ≤2 steps (e.g., "Add user" → "Set role").
- **Skipping the audit timeline.** Wizards create entities; the new entity's first status_history entry is the wizard's "Created by Jake on 2026-04-30 via wizard" — Document Review then takes over.
- **Allowing Next without saving step state.** Anti-pattern. Each step's data persists immediately (or holds in memory until Complete on the last step). Refresh-mid-wizard should resume.

---

## 9. Pattern 8 — Empty Workspace (zero-state)

**Purpose:** A first-time-user surface with a single-action prompt. Used when a list, queue, or domain has zero records yet.

### 9a. When to use

- The user opens a page that has no records to show (empty queue, no vendors, no draws yet)
- The page is on a list, dashboard, or domain area where records are expected
- The empty state is "expected first-time" not "filter returned 0" (filter-empty uses a different EmptyState — see §9b)
- The user has a single primary action to populate the page (e.g., "Create your first job", "Upload your first invoice")

### 9b. When NOT to use

- The page returned 0 records due to a filter — use `EmptyState` component (Feedback §3.3) inside the existing pattern (List + Detail §7), NOT this Empty Workspace pattern
- The page is showing 0 records due to error — use Error State (in Pattern §12.5)
- The user just deleted the last record — show a brief Toast + offer an undo, not Empty Workspace
- The page should have a record but loading is in progress — use Skeleton (Pattern §12.5)

### 9c. Anatomy

```
┌─────────────────────────────────────────────────────────────────────┐
│ AppShell (NavBar top)                                                 │
│ ┌─────────────────────────────────────────────────────────────────┐ │
│ │  Header — eyebrow + h1 (e.g., "INVOICES — PM Queue")             │ │
│ │  Optional: filter chips disabled (since nothing to filter)        │ │
│ └─────────────────────────────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────────────────────────────┐ │
│ │                                                                   │ │
│ │                          ┌───────────────┐                        │ │
│ │                          │   ┌────────┐  │                        │ │
│ │                          │   │  ICON  │  │                        │ │
│ │                          │   └────────┘  │                        │ │
│ │                          │               │                        │ │
│ │                          │   Title       │                        │ │
│ │                          │   Description │                        │ │
│ │                          │               │                        │ │
│ │                          │  [Primary CTA]│                        │ │
│ │                          │  Secondary    │                        │ │
│ │                          └───────────────┘                        │ │
│ │                                                                   │ │
│ └─────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
```

The Empty Workspace pattern is essentially an `EmptyState` (Feedback §3.3) component scaled up to fill the page. It's not a separate pattern from EmptyState — it's a layout treatment of EmptyState as the dominant page content.

### 9d. Components used

- `AppShell` (Navigation §4.1)
- `NwEyebrow` (Existing primitives §7.2)
- `Space Grotesk h1` — page title (so user knows what page they're on)
- `EmptyState` (Feedback §3.3) — the centerpiece
- `NwButton` (Existing primitives §7.1) — primary CTA inside EmptyState
- Heroicons (per COMPONENTS.md §9.3) — semantic icon for the empty area:
  - Empty queue: `InboxIcon` or `DocumentTextIcon`
  - No vendors: `UserGroupIcon` or `BuildingOffice2Icon`
  - No draws: `DocumentTextIcon`
  - Generic: `Cog6ToothIcon` (for settings) or `FolderOpenIcon` (for list)

### 9e. Tokens used

- `--bg-page` — outer
- `--bg-card` — EmptyState container bg (or transparent if it's a borderless treatment)
- `--border-default` — dashed border around EmptyState container
- `--text-primary` — title
- `--text-secondary` — description
- `--text-tertiary` — secondary action text
- `--color-success` — for success-variant icon (e.g., "All caught up!")
- `--brand-accent` — primary CTA
- `--space-12` to `--space-16` — large vertical padding to center on page
- `--font-display` — title (Space Grotesk)
- `--font-mono` — eyebrow above title

### 9f. Accessibility

- **Page landmark.** `<main>` wraps the page; the EmptyState is `<section role="region" aria-label="No invoices yet">`.
- **EmptyState reads as a status.** `role="status"` so SR users hear "No invoices yet. Upload your first invoice."
- **Icon is decorative.** `aria-hidden="true"` on the Heroicon. Title text carries semantics.
- **Primary CTA is keyboard-reachable.** Tab focuses the button after the title is read.
- **Secondary action (link to import or help docs)** has descriptive text. "Learn how to onboard from spreadsheets" not "Click here".

### 9g. Mobile behavior

| Region        | nw-desktop                | nw-tablet               | nw-phone                                       |
|---------------|---------------------------|-------------------------|------------------------------------------------|
| Header        | full                       | full                    | shortened sub if any                           |
| EmptyState    | centered, py-16 px-6       | centered, py-16         | py-12 px-4                                     |
| Icon          | 56px circle                | 56px                    | 48px                                           |
| Primary CTA   | inline center              | inline center           | full-width below title                         |
| Secondary     | inline below primary       | inline                  | full-width below primary                       |

### 9h. Examples

1. **Empty PM queue.** `src/app/invoices/queue/page.tsx` first-load state — uses `EmptyState` from `src/components/empty-state.tsx` with `EmptyIcons.Inbox` + "No invoices in your queue" + "Upload an invoice" primary action.
2. **Empty vendor list.** `src/app/vendors/page.tsx` — uses `EmptyState` + "No vendors yet" + "Add your first vendor" primary action.
3. **No draws yet.** `src/app/draws/page.tsx` — "No draws created yet" + "Create your first draw" primary action.
4. **Empty cost code intelligence.** `src/app/cost-intelligence/items/page.tsx` — "No AI-suggested codes pending" + "Train the AI" secondary or no CTA at all (success state — "All caught up!" with `success` variant).
5. **Empty change order log.** `src/app/change-orders/page.tsx` — "No change orders for this job yet" + "Create a CO" primary action.

### 9i. Anti-patterns

- **No primary action.** Anti-pattern except for the success variant ("All caught up!"). Empty Workspace is a CTA opportunity per COMPONENTS.md §3.3.
- **Multiple primary actions.** Pick ONE primary; secondary is a link, not another button.
- **Loading spinner instead of EmptyState.** Anti-pattern. Loading uses Skeleton (§12.5); empty uses EmptyState.
- **Error message in Empty Workspace.** Anti-pattern. Errors use Error State (§12.5). Empty is "this is normal, no records yet."
- **Tiny EmptyState (h-24 in the middle of a list).** Anti-pattern for first-time user. Empty Workspace is page-dominating. Tiny empty is for filter-empty (List + Detail).
- **Custom icon outside Heroicons.** Per COMPONENTS.md §9 + A12.2 — Heroicons only. No inline SVG.

---

## 10. Pattern 9 — Print View (AIA G702/G703 fidelity)

**Purpose:** A page-fidelity print output for AIA G702 (project summary) and G703 (continuation sheet) pay applications. Static, paginated, density-compact, no interactive elements.

### 10a. When to use

- The page outputs a printed AIA G702 or G703 document
- The page also serves as the PDF export source
- The output has fixed margins, fixed orientation, fixed page-break points
- Per SPEC A17 — print mode forces `--density-compact` (per A2.2)
- Per CLAUDE.md — Drummond Pay App 8 is the reference layout

### 10b. When NOT to use

- The print is non-AIA (e.g., a vendor invoice receipt) — use a simpler print stylesheet, not this pattern
- The output is for screen viewing only (no print) — use Document Review (§2) or List + Detail (§7)
- The output is interactive (editable fields) — use Document Review (§2)
- The output is a multi-record list export (CSV) — use a CSV export endpoint, not Print View

### 10c. Anatomy

```
┌─────────────────────────────────────────────────────────────────────┐
│ Print page (8.5×11 portrait OR landscape per page type)              │
│                                                                       │
│ ┌─────────────────────────────────────────────────────────────────┐ │
│ │  G702 page — project summary                                     │ │
│ │  Header — Owner, Project, Contractor, Application No, Period     │ │
│ │  Lines 1-7 — original contract / changes / completed / due / bal│ │
│ │  Change order summary table                                       │ │
│ │  Signature block — Contractor (Jake Ross), date                   │ │
│ │                                                                   │ │
│ │  Page break →                                                     │ │
│ └─────────────────────────────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────────────────────────────┐ │
│ │  G703 page 1 — continuation sheet                                │ │
│ │  Columns A-J: Item No / Description / Original Estimate /        │ │
│ │    Previous / This Period / Total to Date / % Complete /         │ │
│ │    Balance to Finish / Proposal Amount / Balance in Contract     │ │
│ │  One row per cost code (budget line)                              │ │
│ │  Page subtotal at bottom                                          │ │
│ │                                                                   │ │
│ │  Page break →                                                     │ │
│ └─────────────────────────────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────────────────────────────┐ │
│ │  G703 page 2-N — additional rows + grand total on final page    │ │
│ └─────────────────────────────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────────────────────────────┐ │
│ │  PCCO log (Change Order log) — separate page                     │ │
│ │  Columns: PCCO# / App# / Description / Beg. Contract /           │ │
│ │   Addition/Deduction / GC Fee / New Contract / Days Added         │ │
│ │  Running contract total at bottom                                 │ │
│ └─────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
```

The print stylesheet enforces:
- Page size: `@page { size: letter portrait; margin: 0.5in; }` for G702; `@page { size: letter landscape; margin: 0.5in; }` for G703
- Page break: `page-break-after: always` between G702 and G703 page 1; between G703 pages
- Density forced compact: `:root { --density-row: var(--density-compact-row); --density-padding: var(--density-compact-padding); }` per SYSTEM §10b
- Animations disabled: `*, *::before, *::after { animation: none !important; transition: none !important; }` per SYSTEM §8e
- Color reduction: `print-color-adjust: exact` so ink renders true-to-screen

### 10d. Components used

- Static-block fallback: NO interactive primitives. The print stylesheet renders plain `<table>`, `<th>`, `<td>`, `<div>`, `<span>` with token-bound styling — no React-interactive children.
- `Breadcrumbs` (Navigation §4.3) — printed at top with `print:hidden` toggle stripped (page header is enough)
- Native HTML `<table>` — for G702 lines, G703 grid, PCCO log
- `NwMoney` formatter helpers (`formatCents`, `formatDollars` from `src/lib/utils/format.ts`) — for money values rendered as plain `<span>` with mono + tabular-nums
- `<time datetime>` — for dates
- Static company / contractor / owner block — populated from `org_settings` + `jobs` + `clients`

### 10e. Tokens used

- `--bg-page` — sand background (white-sand light, slate-deep dark) — but in print, white background is forced via `@media print { :root { --bg-page: #FFFFFF; } }`
- `--text-primary` — slate-tile
- `--border-default` — table dividers
- `--font-display` — Space Grotesk for h1 / contractor name
- `--font-body` — Inter for body
- `--font-mono` — JetBrains Mono for column headers (eyebrows) and money values
- `--density-compact-row` + `--density-compact-padding` — forced compact per SYSTEM §10b
- `--space-2` to `--space-3` — table cell padding (compact)
- `tabular-nums` — money columns

### 10f. Accessibility

- **Print is not screen-readable in real time.** SR users access the same data on screen via Document Review (§2). Print View is the export format, not the primary user surface.
- **Headings are hierarchical.** h1 → h2 → h3 — SR users using assistive readers on the PDF can navigate.
- **Tables have `<caption>`, `<th scope>`.** Even on print, table semantics matter for assistive PDF readers (some software exposes structure).
- **No interactive elements.** No focus-visible rings; no `aria-*` for interactive states (there are none).
- **High contrast.** Print mode uses pure black on white per `@page` overrides — exceeds AAA contrast (21:1).

### 10g. Mobile behavior

Print View is not mobile per se — it's the PDF/print export. However:

- **`window.print()`** triggers from any breakpoint (`nw-phone`, `nw-tablet`, `nw-desktop`)
- **Print preview screen** at `nw-phone` shows the print layout zoomed-out; user can print or save as PDF
- The print stylesheet is breakpoint-invariant — `@media print` overrides any breakpoint-specific styling

### 10h. Examples

1. **Draw print view.** `src/app/draws/[id]/print/page.tsx` (planned — Wave 1.1). Renders G702 + G703 + PCCO log per Drummond Pay App 8 reference. Per `Slate Draw Approval Detail.html` for the on-screen variant; print stylesheet strips interactive chrome.
2. **Owner-portal AIA forms.** Owner sees the same print output via the owner portal — read-only PDF-render.
3. **Standalone CO log print** (planned, Wave 1.2). PCCO log standalone print — same print stylesheet.
4. **Lien release export** (planned, Wave 2). Per-vendor lien release printable.

### 10i. Anti-patterns

- **Animated elements in print.** Per SYSTEM §8e — animations disabled in print. Anti-pattern: a spinning loader visible in print output.
- **Background colors that don't print.** Per `@media print` override — bg colors are forced to print (`print-color-adjust: exact`). Anti-pattern: relying on screen-bg that prints as white.
- **Interactive elements in print.** Buttons, dropdowns, focus rings — anti-pattern in print. Print stylesheet hides them via `.print:hidden` or `.no-print`.
- **Variable-width money columns.** Per SYSTEM §4e — money uses `tabular-nums`. Without it, columns mis-align on print.
- **Page break in middle of a row.** Use `page-break-inside: avoid` on table rows.
- **Density comfortable in print.** Per SYSTEM §10b — print forces compact regardless of user preference.
- **Tenant brand-accent on print.** Per-tenant brand-accent doesn't apply to Print View — AIA forms are contractor-name-based but use Slate-locked styling. Logo is `--brand-logo` per A12.3.

---

## 11. Pattern 10 — Reconciliation (STRAWMAN — deferred to first reconciliation phase implementation per NQ5/D-028)

**Status:** STRAWMAN. Per SPEC A16-A16.1 — Reconciliation defines required regions, data shape contract, and 4 candidate visualization models (NOT a chosen winner). Stage 1.5b prototype gallery (per D-036) renders candidate models against Drummond drift fixtures; the 1.5b mock-up review picks one model. The picked model then locks PATTERNS.md §11; non-trivial PATTERNS.md rewrite expected if the picked model is 2/3/4 (per A16.1 strawman acceptance posture).

**This section catalogs the strawman. It is not a chosen pattern.**

### 11a. Purpose

Reconciliation surfaces drift between two related entities — typically a predecessor entity (commitment) and a successor entity (actual) — and lets the user inspect, accept, or remediate the drift. Examples:

- **Invoice ↔ PO drift.** PO committed $50,000 for materials; invoices total $52,300. Drift is +$2,300 (4.6%). PM reviews; either accepts the over (cost overrun documented) or writes a CO.
- **Draw ↔ Budget drift.** Budget line "Concrete/Foundation" is $45,000; draw 8 includes $48,000 against it. Drift is +$3,000. PM reviews; either accepts (budget revision needed) or removes from the draw.
- **CO ↔ Contract drift.** Contract was $1,500,000; sum of approved COs is $1,540,000. Drift is +$40,000 not yet reflected in the contract amount. Reconciliation surfaces the discrepancy.

### 11b. When to use (post-D-028 phase implementation)

- Two related entities have diverged (commitment vs actual)
- The user's job is to inspect drift and either accept it or remediate it
- The drift is row-level (per line item) AND header-level (sum total)
- Per D-028 — Reconciliation surface lands as its own phase post-Phase-3.9 (after constituent extractors land); cross-entity drift detection is post-foundation
- Per D-036 — Stage 1.5b prototype gallery renders a reconciliation mock-up with all 4 candidate models for visual review

### 11c. When NOT to use

- The two entities have NOT diverged — show a "balanced" status badge inside Document Review (§2), not a Reconciliation surface
- The user is creating an entity (no predecessor to compare against) — use Wizard (§8)
- The user is reviewing a single document — use Document Review (§2)
- The drift is across more than 2 entities (e.g., 4-way drift) — out of scope for v1; surface to PROPAGATION-RULES.md if needed

### 11d. Required regions (from DISCUSSION.md D5)

```
┌─────────────────────────────────────────────────────────────────────┐
│ AppShell (NavBar top)                                                 │
│ ┌─────────────────────────────────────────────────────────────────┐ │
│ │  Header — entity-pair label, drift summary                        │ │
│ │  ("Invoice ↔ PO — Drift: +$2,300 (4.6%) — 12 days since divergence")│
│ └─────────────────────────────────────────────────────────────────┘ │
│ ┌──────────────┬───────────────────────────────────┬─────────────┐ │
│ │  LEFT rail    │  CENTER — drift visualization     │  RIGHT rail │ │
│ │  Predecessor  │  (one of 4 candidate models —     │  Successor  │ │
│ │  preview      │   Candidate A / B / C / D below)   │  preview    │ │
│ │  - data fields│                                   │  - data     │ │
│ │  - source doc │                                   │  - source   │ │
│ └──────────────┴───────────────────────────────────┴─────────────┘ │
│ ┌─────────────────────────────────────────────────────────────────┐ │
│ │  Bottom — actions (Accept / Dispute / Write CO / Split / Annotate)│
│ └─────────────────────────────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────────────────────────────┐ │
│ │  Audit timeline — drift history + writeback events               │ │
│ │  - Drift first detected on …                                      │ │
│ │  - Drift updated to +$X on …                                      │ │
│ │  - Resolved by … via {Accept / Dispute / Write CO}                │ │
│ └─────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
```

### 11e. Data shape contract

```ts
interface ReconciliationData {
  pair: {
    predecessor: { entity_type: string; entity_id: string; total_cents: number; ... };
    successor:  { entity_type: string; entity_id: string; total_cents: number; ... };
  };
  drift: {
    delta_cents: number;        // successor - predecessor
    delta_pct: number;          // delta_cents / predecessor.total_cents
    detected_at: string;        // ISO timestamp
    last_changed_at: string;    // ISO timestamp
    line_level_drift: Array<{
      line_index: number;
      predecessor_cents: number;
      successor_cents: number;
      delta_cents: number;
      delta_pct: number;
    }>;
  };
  history: Array<{
    when: string;
    who: string;
    action: 'detected' | 'updated' | 'accepted' | 'disputed' | 'co_written' | 'annotated';
    note?: string;
  }>;
  status: 'open' | 'accepted' | 'disputed' | 'resolved_co' | 'resolved_split';
}
```

This contract is stable across all 4 candidate visualization models. Only the CENTER region's rendering varies by model.

### 11f. Candidate A — Side-by-side delta (per H2 / SPEC A16)

**Visualization:** Two columns of fields (predecessor LEFT, successor RIGHT) with diffs highlighted per row. Line items diff'd per row.

```
┌──────────────────────────────────────┐
│ CENTER region                         │
│  ┌─────────────────┬───────────────┐ │
│  │ PREDECESSOR     │ SUCCESSOR     │ │
│  │ (PO #4823)      │ (Invoice 8321)│ │
│  ├─────────────────┼───────────────┤ │
│  │ Total: $50,000  │ $52,300 ▲     │ │
│  │ Materials       │ Materials     │ │
│  │ - Lumber $20K   │ Lumber $21K ▲ │ │
│  │ - Concrete $30K │ Concrete $31K▲│ │
│  └─────────────────┴───────────────┘ │
└──────────────────────────────────────┘
```

**Tradeoffs:**
- ✓ Simple, two-column, mental model is clear ("compare LEFT to RIGHT")
- ✓ Works at desktop and tablet
- ✗ Horizontal scroll likely on `nw-tablet` — A16.1 rejects models requiring horizontal scroll on `nw-tablet`. Candidate A may fail this gate depending on field count.
- ✗ Row-level drift requires careful alignment; mis-alignment risks user mis-reading

### 11g. Candidate B — Inline diff (per H2 / SPEC A16)

**Visualization:** Predecessor's fields with strikethrough + successor's fields highlighted; like a git diff.

```
┌──────────────────────────────────────┐
│ CENTER region                         │
│  PO #4823 → Invoice 8321               │
│  Total:                                │
│  - $50,000      ← predecessor          │
│  + $52,300 ▲   ← successor (+$2,300)   │
│                                        │
│  Materials.Lumber:                     │
│  - $20,000                              │
│  + $21,000 ▲                            │
│                                        │
│  Materials.Concrete:                    │
│  - $30,000                              │
│  + $31,000 ▲                            │
└──────────────────────────────────────┘
```

**Tradeoffs:**
- ✓ Compact (single column, no horizontal scroll concern)
- ✓ git-diff metaphor is familiar to engineering-adjacent users
- ✗ git-diff metaphor unfamiliar to construction users (PMs, accountants)
- ✓ Works at all breakpoints
- ✗ Strikethrough on the predecessor implies "removed"; it's NOT removed, it's "previously committed". Risk of mental-model mis-read.

### 11h. Candidate C — Timeline overlay (per H2 / SPEC A16)

**Visualization:** A chronological view where the predecessor's commitment is overlaid on the successor's commitment, with drift visualized as area-between-curves over time.

```
┌──────────────────────────────────────┐
│ CENTER region                         │
│                                        │
│ $52K┤             ╱─── successor       │
│ $50K┤───── pred. ╱                      │
│ $48K┤            ╱                      │
│ $46K┤           ╱                       │
│ $44K┤        ──╱                        │
│ $42K┤       ╱                           │
│      └─────────────────────────────    │
│       Apr 1   Apr 15   May 1            │
│                                        │
│  Drift area shaded; legend at right.   │
└──────────────────────────────────────┘
```

**Tradeoffs:**
- ✓ Shows TEMPORAL drift (how it built up over time, not just snapshot)
- ✓ Visually rich; summarizes drift at a glance
- ✗ Complex to render correctly; chart rendering library needed (out of v1 scope per Q5=A — no Framer Motion, no chart deps)
- ✗ Doesn't show line-item detail; drilldown required
- ✗ Construction users may not be familiar with area-between-curves chart conventions
- ✓ Works at all breakpoints if rendered as static SVG

### 11i. Candidate D — Hybrid: header-level timeline + line-level inline diff (per H2 / SPEC A16)

**Visualization:** Top half is timeline (Candidate C); bottom half is inline diff (Candidate B). Header-level drift visualized over time; line-level drift detailed as a diff list.

```
┌──────────────────────────────────────┐
│ CENTER region                         │
│  ┌────────────────────────────────┐ │
│  │ TIMELINE (top half)              │ │
│  │  $52K ────╱── successor          │ │
│  │  $50K ── predecessor             │ │
│  │  Apr 1 ─── May 1                  │ │
│  └────────────────────────────────┘ │
│  ┌────────────────────────────────┐ │
│  │ INLINE DIFF (bottom half)         │ │
│  │ - $50K → + $52,300 (+$2,300)      │ │
│  │ Materials.Lumber: -$20K → +$21K   │ │
│  │ Materials.Concrete: -$30K → +$31K │ │
│  └────────────────────────────────┘ │
└──────────────────────────────────────┘
```

**Tradeoffs:**
- ✓ Combines temporal context (top) with line-item detail (bottom)
- ✓ User can choose where to focus
- ✗ Most complex to implement; both halves must work correctly
- ✗ More vertical scroll required; mobile collapse non-trivial
- ✗ Information density highest of the 4 candidates; risk of overwhelm

### 11j. Rejection criteria (per SPEC A16.1)

The 1.5b mock-up review will pick one candidate. Explicit rejection criteria:

1. **Won't ship a model requiring horizontal scroll on `nw-tablet` to see drift.** This eliminates Candidate A if the field count is high (e.g., G703 has 10 columns). Acceptable for a 2-3 field comparison; unacceptable for a 10-row comparison.
2. **Won't ship a model that breaks audit-trail viewability.** All 4 candidates preserve the audit timeline at the bottom; the CENTER region is an additional visualization, not a replacement.
3. **Won't ship a model with metaphor mismatch.** Candidate B (inline diff) carries git-diff metaphor — risk of "removed" misread for predecessor. If user testing in 1.5b prototype shows >25% misread rate, reject.
4. **Won't ship a model requiring chart library / Framer Motion** — Candidate C requires SVG charting. Acceptable as static SVG (no animation per SYSTEM §8); not acceptable as animated d3.js chart in v1.
5. **Won't ship a model that requires >3 distinct UI primitives that aren't yet in COMPONENTS.md.** All 4 candidates use existing primitives + 1-2 new compositions; this gate is met for all.

### 11k. Strawman acceptance posture (per SPEC A16.1)

Per H2 + M-DP3 — Stage 1.5b picking model 2/3/4 (NOT Candidate A) forces non-trivial PATTERNS.md rewrite. The current §11 strawman is provisional; the chosen model + its anatomy + tokens + a11y locks the section. Today's provisional anatomy (CENTER region with one-of-four candidate visualizations) is ABSTRACT — the actual chosen model materializes in 1.5b's SPEC.md / PLAN.md as part of the reconciliation phase.

### 11l. Mobile behavior (provisional — picks model)

- **Candidate A (side-by-side):** `nw-phone` collapses to vertical stack — predecessor on top, successor below. Drift summary stays at top.
- **Candidate B (inline diff):** `nw-phone` keeps same single-column layout; just denser (compact density).
- **Candidate C (timeline):** `nw-phone` re-renders SVG chart at smaller dimensions; legend moves below chart.
- **Candidate D (hybrid):** `nw-phone` collapses to vertical stack — timeline on top (smaller), inline diff below.

### 11m. Examples (none — pre-implementation)

There are no live Reconciliation surfaces in Nightwork as of HEAD `a318d7e`. Per D-028, Reconciliation lands as its own phase post-Phase-3.9. Per D-036, Stage 1.5b prototype gallery renders all 4 candidates against Drummond drift fixtures.

### 11n. Anti-patterns (provisional)

- **Reconciliation in a modal.** Anti-pattern. Drift inspection is a workflow, not a modal-confirmable action. Use full-page or side Sheet.
- **Reconciliation without audit timeline.** Per CLAUDE.md "Status history" — every transition to/from "open / accepted / disputed / resolved" appends to status_history. Skipping is anti-pattern.
- **Reconciliation that auto-resolves.** Anti-pattern. The user's input (Accept / Dispute / Write CO) is the resolution, not the system's silent state-change.
- **Reconciliation that hides drift below the fold.** Anti-pattern. Drift summary is in the header, above the fold, in every breakpoint per SPEC A16.1.
- **Reconciliation without writeback paths.** "Write CO" is a writeback to the CO log; "Accept" is a writeback to the budget cache; "Dispute" is a writeback to a dispute table. Reconciliation surfaces lacking writeback are read-only displays of drift, useful only as a debugging tool.
- **Reconciliation across more than 2 entities.** Out of scope for v1. Surface to PROPAGATION-RULES.md if needed.

---

## 12. Pattern 11 — Confirm/Destructive Action (with Esc-to-cancel safety)

**Purpose:** A modal dialog confirming a destructive or workflow-transitioning action. Cancel-as-default-focus, Esc to dismiss, single primary destructive button.

### 12a. When to use

- The action is destructive (delete, void, finalize, kick-back) per CLAUDE.md "high-stakes" definition
- The action is irreversible OR has a high consequence (transitions a workflow, moves money, locks a record)
- The user must explicitly opt-in (confirm) before the action fires
- Per SPEC + COMPONENTS.md §6.3 — Confirm Dialog variant

### 12b. When NOT to use

- The action is reversible and low-stakes (auto-saving forms have no Confirm) — use inline save
- The action is multi-step (5 steps to finalize) — use Wizard (§8)
- The action is part of a workflow (Approve, Hold, Deny, Kickback, Push to QB) — use the Confirm dialog inside Multi-step Approval (§3); same primitive, but the trigger is workflow-driven, not standalone destructive
- Field-level errors — use FormMessage (Inputs §1.6), not Confirm

### 12c. Anatomy

```
┌─────────────────────────────────────────┐
│ Page (Document Review, List, etc. behind)│
│   [page content dimmed via overlay]      │
│                                          │
│       ┌────────────────────────────┐    │
│       │ Title — "Void Invoice?"     │    │
│       │                            │    │
│       │ Description — "Voiding will │    │
│       │ remove this invoice from the│    │
│       │ draw and require re-entry. │    │
│       │ Are you sure?"              │    │
│       │                            │    │
│       │ Optional note field         │    │
│       │ [textarea]                 │    │
│       │                            │    │
│       │  [Cancel]  [Void Invoice]   │    │
│       └────────────────────────────┘    │
│                                          │
└─────────────────────────────────────────┘
```

The Confirm dialog uses Modal/Dialog primitives (Surfaces §2.2) with a strict structure: Title + Description + Optional Form field + Cancel + Confirm. No tabs, no sub-sections, no scroll.

### 12d. Components used

- `Modal` / `Dialog` (Surfaces §2.2) — the underlying primitive (Base UI Dialog) per COMPONENTS.md §2.2
- `Confirm` (Overlays §6.3) — the specialized variant
- `DialogTitle` — page-prompt
- `DialogDescription` — context
- `Form` + `FormField` + `Input` / `Textarea` (Inputs §1.6) — for note capture (optional)
- `NwButton` (Existing primitives §7.1) — Cancel (`ghost`) + Confirm (`danger` variant for destructive; `primary` for non-destructive transitions)
- `LoadingState` (Feedback §3.4) — when async confirm is in flight (button shows spinner)

### 12e. Tokens used

- `--popover` — content bg
- `--popover-foreground` — content text
- `--bg-inverse/0.5` — overlay (slate-deep at 50% opacity per SYSTEM §1i)
- `--border-default` — content ring
- `--shadow-panel` — content elevation
- `--ring` — focus on cancel/confirm
- `--destructive` — destructive Confirm button bg (NwButton `danger` variant)
- `--brand-accent` — non-destructive primary Confirm button bg
- `--text-primary` — body text
- `--text-secondary` — description text
- `--font-display` — Title (Space Grotesk)
- `--font-body` — body (Inter)
- `--font-mono` — button label (JetBrains Mono UPPERCASE per SYSTEM §4)
- `--space-4` — internal padding
- `--space-2` — gap between Cancel and Confirm

### 12f. Accessibility

- **Dialog primitive contract.** Per COMPONENTS.md §2.2 — `role="dialog"`, `aria-modal="true"`, `aria-labelledby` from `DialogTitle`, `aria-describedby` from `DialogDescription`. Focus trapped, Esc closes.
- **Esc dismisses with cancel semantics** (per SYSTEM §12c). The "Esc-to-cancel" rule in Confirm dialogs is the safety contract: pressing Esc invokes the same code path as clicking Cancel.
- **Cancel is the default focus** (debated — Nightwork chooses confirm-focus for high-stakes ergonomics per COMPONENTS.md §6.3, with Esc always available to cancel). The choice is a deliberate ergonomics decision: if a PM is mid-flow and confirms, they tap Enter on focus → Confirm fires; if they want to escape, they hit Esc. Default-focus on Confirm aligns with "the user is committing to the action they triggered." Documenting the choice as opinionated.
- **Destructive button uses both color + word.** Red color is reinforced by "Void Invoice" label (or "Delete", "Finalize"). Color-only is anti-pattern per WCAG 1.4.1.
- **Note field is keyboard-reachable.** Tab from Confirm button → note field → Cancel. Note is OPTIONAL by default; required when the workflow demands (e.g., kick-back ALWAYS requires note).
- **In-flight loading.** Confirm button shows spinner + `aria-busy="true"` while async resolves; Cancel remains enabled to bail out.

### 12g. Mobile behavior

| Region          | nw-desktop                | nw-tablet                | nw-phone                                       |
|-----------------|---------------------------|--------------------------|------------------------------------------------|
| Modal size      | sm (max-w-sm)             | sm                       | full (full-screen) per Modal §2.2              |
| Buttons         | inline (Cancel + Confirm) | inline                   | stacked vertically (Confirm above Cancel)      |
| Note field      | inline below description  | inline                   | full-width below description                   |
| Backdrop        | dimmed page               | dimmed                   | full opaque overlay                            |

Per COMPONENTS.md §2.2 — Modal at `nw-phone` collapses to full-screen. Confirm follows.

### 12h. Examples

1. **Void invoice.** "Void this invoice? It will be removed from the draw and require re-entry." Triggers from Document Review action set; opens Confirm with `destructive` variant.
2. **Delete vendor.** "Delete this vendor? Their existing invoices remain; future invoices will require selecting a new vendor." Triggers from List + Detail action menu.
3. **Finalize draw.** "Finalize draw 8? This locks the draw; revisions create a new revision (Rev 1)." Triggers from Multi-step Approval; uses Confirm with `warning` variant.
4. **Kick back to PM (QA).** "Kick back to PM? Add a note explaining what's wrong." Triggers from Multi-step Approval QA step; note is required.
5. **Reset cost codes to template.** "Reset all cost codes to template? Existing assignments to invoices remain; cost code references stay valid." Triggers from Settings > Cost Codes; uses Confirm with `warning` variant.

### 12i. Anti-patterns

- **Confirm without Esc.** Per SYSTEM §12c — Esc must dismiss. Anti-pattern: Confirm dialog that traps the user.
- **Two destructive buttons.** Anti-pattern. ONE primary destructive; Cancel is `ghost` (not destructive).
- **Same label for Cancel and Confirm.** Anti-pattern. "OK" / "OK" is anti-pattern. "Cancel" + "Void Invoice" is the canonical shape.
- **Confirm inside Confirm.** Per COMPONENTS.md §2.2 — never stack dialogs. Anti-pattern.
- **Confirm without context.** Anti-pattern. Title + Description must explain WHAT and WHY ("This will remove the invoice from the current draw").
- **No loading state on async confirm.** Anti-pattern. If the action is async (e.g., DB write), Confirm button shows spinner + disables until resolved. Cancel remains enabled.
- **Closing Confirm on backdrop click for destructive actions.** Per Confirm pattern — backdrop click dismisses (cancel semantics) for non-destructive variants; for destructive variants, backdrop click is a no-op (force explicit Cancel button click). This prevents accidental dismiss-as-confirm.

---

## 12.5. Pattern 12 — Loading / Error / Skeleton overlay (universal layer)

**Status:** This is a LAYER, not a page pattern. Patterns 1-11 are page shapes; Pattern 12 is what overlays them during in-flight / empty-data / failure states.

**Purpose:** The 3 universal in-flight, empty-data, and error states that overlay any page in Nightwork.

### 12.5a. The 3 states

| State         | Trigger                                                  | Component               | Section in COMPONENTS.md  |
|---------------|----------------------------------------------------------|-------------------------|---------------------------|
| Loading       | Initial fetch in flight                                  | LoadingState / Skeleton | §3.4, §3.6                |
| Empty         | Fetch succeeded, no data                                 | EmptyState              | §3.3 (Empty Workspace §9) |
| Error         | Fetch failed                                             | ErrorState + error.tsx  | §3.5                      |

### 12.5b. Loading layer

- **Skeleton** (Feedback §3.6) for in-place loading (table rows, card values, dashboard stats). `animate-pulse` linear motion only (per SYSTEM §8a — no bouncy).
- **Spinner LoadingState** (Feedback §3.4) for full-screen route transitions, async submit, or initial page load.
- **Inline LoadingState** for button mid-submit (button shows spinner + `aria-busy="true"`).

Loading states announce via `role="status"` + `aria-live="polite"` per COMPONENTS.md §3.4. Decorative spinners are `aria-hidden`.

### 12.5c. Empty layer

- **EmptyState** (Feedback §3.3) for filter-returns-zero (small empty inside List + Detail) OR for first-time user (Empty Workspace pattern §9, scaled up).
- Two variants: `default` (neutral) and `success` (green — for "all caught up" scenarios).

EmptyState announces via `role="status"` + `aria-live="polite"`.

### 12.5d. Error layer

- **ErrorState** (Feedback §3.5) for inline (form field, row) and block (centered card) errors.
- **error.tsx Next.js boundary** for full-page errors (per SPEC B10 — every category page in `/design-system/components/<category>` has its own error.tsx fallback).
- **Toast** (Feedback §3.1) for cross-page event errors (e.g., "Failed to save settings — try again").
- **Banner** (Feedback §3.2) for global error states (e.g., "Connection lost").

Error states announce via `role="alert"` + `aria-live="assertive"` per COMPONENTS.md §3.5.

### 12.5e. Composition rules (when which)

| Page state          | Pattern 1 Doc Review                  | Pattern 2 Multi-step Approval         | Pattern 3 Dashboard                  | Pattern 6 List+Detail                 | Pattern 7 Wizard                     | Pattern 12 Confirm                |
|---------------------|---------------------------------------|---------------------------------------|--------------------------------------|---------------------------------------|--------------------------------------|-----------------------------------|
| Initial load        | Skeleton on right rail; preview shows pdf-loading message | Same                                | SkeletonStatCard for KPIs; SkeletonList for activity | SkeletonTableRow for list           | Skeleton on step body                | n/a (Confirm only opens after page loaded) |
| Empty               | n/a (record exists by definition)     | n/a                                   | EmptyState in widget areas with no data | EmptyState below table on filter-zero | n/a                                  | n/a                               |
| Error               | ErrorState in right rail; preview shows error fallback | Same                                | ErrorState replaces affected widget   | ErrorState replaces table             | ErrorState in step body              | Toast announces failure          |
| In-flight submit    | Confirm with spinner on Confirm button | Same                                  | n/a (no submit action on dashboard)   | Confirm with spinner                  | Next button shows spinner + disabled  | This IS the layer                 |

### 12.5f. Anti-patterns

- **Loading state with bouncy easing.** Per SYSTEM §13b — no `cubic-bezier` with overshoot. `animate-pulse` linear motion only.
- **Skeleton pulse on filter changes.** Per `loading-skeleton.tsx` comment — filter changes are instant from cached data, NOT a Skeleton-loading event.
- **Empty for errors, error for empty.** Per COMPONENTS.md §3.3 anti-patterns — EmptyState is for "no records yet"; ErrorState is for "fetch failed". Conflating is anti-pattern.
- **Stack of toasts.** Per Feedback §3.1 — max 3 visible; oldest evicts. Stacking >3 is UX overload.
- **Auto-dismiss errors.** Per Feedback §3.1 — auto-dismiss success and info; never auto-dismiss errors. User must dismiss explicitly.
- **Tiny EmptyState inside a heavy page.** A first-time user with zero invoices needs Empty Workspace (§9) — page-dominating empty. A filter-zero on a populated invoice queue uses small EmptyState below the existing list.
- **Loading state without `role="status"`.** Per a11y §12d — invisible loading is a SR bug.

---

## 13. Pattern selection tree (when to use which)

Given a workflow need, walk this decision tree to pick the right pattern.

```
┌─ Is the user EDITING an existing record? ──┐
│  ├─ With a source document attached?        │
│  │   └─ Yes → Document Review (§2)            │
│  ├─ Sequential approval steps (PM→QA→push)? │
│  │   └─ Yes → Multi-step Approval (§3)        │
│  ├─ Org config (settings)?                    │
│  │   └─ Yes → Config Form (§6)                 │
│  └─ Single record edit, no source doc?       │
│      └─ List+Detail right-rail variant (§7c.2) │
│                                                │
├─ Is the user CREATING a new record? ─────────┤
│  ├─ Single-page form fits all fields?        │
│  │   └─ Yes → Config Form (§6) variant        │
│  └─ Sequential 3+ step flow?                 │
│      └─ Wizard (§8)                            │
│                                                │
├─ Is the user BROWSING records? ──────────────┤
│  ├─ Drill into separate detail page?         │
│  │   └─ Yes → List+Detail drill-in (§7c.1)     │
│  └─ Inline edit in right-rail?               │
│      └─ List+Detail right-rail (§7c.2)        │
│                                                │
├─ Is the user RECONCILING two entities? ──────┤
│  └─ Yes → Reconciliation (§11) — STRAWMAN     │
│      (post-D-028, pick model in 1.5b)         │
│                                                │
├─ Is the user SCANNING dashboard for action? ─┤
│  ├─ Home dashboard or job dashboard?         │
│  │   └─ Data-dense Overview (§4)              │
│  └─ Mobile-only quick approve?                │
│      └─ Mobile Touch Approval (§5)            │
│                                                │
├─ Is the user PRINTING / EXPORTING PDF? ──────┤
│  └─ AIA G702/G703 fidelity?                  │
│      └─ Print View (§10)                       │
│                                                │
├─ Is the page first-time user (no records)? ─┤
│  └─ Empty Workspace (§9)                       │
│                                                │
└─ Is the user DESTRUCTING / TRANSITIONING? ───┤
   └─ Confirm/Destructive Action (§12)            │
```

The Loading/Error/Skeleton layer (§12.5) overlays every choice — it's not part of the decision tree, it's the universal in-flight/empty-data/failure state for whichever page pattern was chosen.

---

## 14. Cross-pattern composition rules

When two patterns coexist, follow these rules.

### 14a. Document Review + Multi-step Approval

- Document Review is the SURFACE; Multi-step Approval is the WORKFLOW layered into the action set.
- Always: Document Review hosts the file preview LEFT, fields RIGHT, audit BELOW. Multi-step Approval supplies the role-gated action set in the header.
- Reference: `src/app/invoices/[id]/page.tsx` — invoice review IS Document Review hosting Multi-step Approval.

### 14b. Document Review + Confirm

- Confirm overlays Document Review when the user triggers a workflow transition (Approve, Hold, Deny, Kickback, Void, Finalize).
- Confirm is full-screen on `nw-phone` per Modal §2.2.
- Document Review remains rendered behind the dimmed overlay; user can Esc to return.

### 14c. List + Detail + Wizard

- "Add new vendor" from a vendor list opens a Wizard (§8) — typically a 2-3 step modal-wizard OR full-page wizard.
- Modal-wizard for ≤2 steps; full-page wizard for 3+ steps per Wizard §8i.
- After Wizard completes, list re-fetches + new record is highlighted.

### 14d. Dashboard + List + Detail (drill-in)

- Dashboard (§4) widgets typically drill into a List + Detail (§7) page or a Document Review (§2) page.
- Drill-in is a `<Link>` from the widget; the destination is a fully-formed List or Document Review surface.
- Anti-pattern: dashboard drill-in opens a modal containing the list. Use navigation, not modal.

### 14e. Multi-step Approval + Mobile Touch Approval

- Multi-step Approval at `nw-phone` collapses to Mobile Touch Approval (§5).
- Same workflow, different surface. The action set adapts: primary action becomes the sticky bottom CTA; secondary actions move to the overflow Popover.
- Reference: PM mobile invoice review (Document Review at `nw-phone` adopting Mobile Touch Approval anatomy) hosting the Multi-step Approval workflow.

### 14f. Wizard + Confirm

- Skip step in a Wizard typically opens a Confirm ("Skip team setup? You can invite later.").
- Wizard's Complete (final step submit) MAY open a Confirm if the action is destructive (e.g., "Submit draw 8? This locks the draw."). Routine completes don't need Confirm.

### 14g. Reconciliation + Confirm

- "Accept drift" in Reconciliation opens a Confirm ("Accept this drift? It will be marked resolved without remediation.").
- "Write CO" in Reconciliation routes to the CO creation Wizard (§8) instead of opening a Confirm.

### 14h. Print View + Document Review

- Print View is the export format of Document Review's data — same record, different surface.
- Print stylesheet hides Document Review's interactive chrome (action set, file preview iframe, audit timeline interactivity) and renders the data static.
- The Print View page (`/draws/[id]/print`) MAY embed Document Review's data via shared rendering helpers; OR it MAY be a standalone print-optimized page that fetches the same record.

### 14i. Empty Workspace + Wizard

- Empty Workspace's primary CTA usually launches a Wizard (§8) to create the first record.
- "Create your first job" → opens `jobs/new` Wizard.
- "Upload your first invoice" → opens invoice import flow (Wizard or Config Form variant).

---

## 15. Skill anchors (bidirectional cross-reference per A19.1)

PATTERNS.md is consumed by the following skills as authoritative for page-level layout patterns. **Bidirectional cross-reference** — when a pattern's contract changes here, those skills update too.

### 15a. Skills depending on PATTERNS.md

| Skill                                  | What PATTERNS.md authorizes                                                       |
|----------------------------------------|-----------------------------------------------------------------------------------|
| `nightwork-ui-template`                | The Document Review pattern's anatomy + extension contract — IS this skill's source |
| `nightwork-design`                     | Pattern selection (which Slate prototype HTML maps to which pattern); reference HTMLs as concrete examples |
| `nightwork-design-system-reviewer`     | Runs at `/nightwork-design-check`; verifies pattern adherence (e.g., Document Review must have file preview LEFT) |
| `nightwork-ui-reviewer`                | Runs in `/nightwork-qa`; rejects any review surface diverging from Document Review without justification |
| `frontend-design` (built-in skill)     | Higher-level UI generation — reads PATTERNS.md before proposing page layouts       |
| `impeccable` (built-in skill)          | UI critique — reads PATTERNS.md anti-patterns galleries before flagging issues     |

### 15b. PATTERNS.md → skill propagation rules

When this document changes:
1. The corresponding skill file MUST be updated in lockstep (PROPAGATION-RULES.md T15 elaborates the workflow).
2. The components playground patterns page (`src/app/design-system/patterns/page.tsx`, T23) MUST re-render correctly after a contract change — visual regression spot-check per SPEC D4.
3. Consumers (existing `src/app/<route>/page.tsx` files) get reviewed for breakage if a pattern contract narrows; widened contracts are non-breaking.
4. CLAUDE.md "UI rules → Document Review is the gold standard" gets re-confirmed on every Document Review pattern change; mismatch is flagged by `nightwork-spec-checker`.

The `/nightwork-propagate` orchestrator runs this lockstep update for any PATTERNS.md change tagged "everywhere" or "all".

### 15c. Skills referenced FROM PATTERNS.md

This document references back to:
- `colors_and_type.css` — single canonical token source (read-only from PATTERNS.md's perspective)
- `tailwind.config.ts` — Tailwind utility extensions for breakpoints + nw-* colors
- `globals.css` — shadcn token alias remap + brand-accent server injection
- `.planning/design/SYSTEM.md` — token catalog (cited extensively)
- `.planning/design/COMPONENTS.md` — component inventory (cited by §-anchor in every pattern's "Components used" section)
- `.planning/design/CONTRAST-MATRIX.md` — A11y verification source
- `.planning/design/PROPAGATION-RULES.md` (T15, pending) — workflow for pattern changes
- `.planning/design/PHILOSOPHY.md` (T17a/b, pending) — design directions that interpret these patterns
- `.claude/skills/nightwork-ui-template/SKILL.md` — Document Review's canonical reference
- `.claude/skills/nightwork-design/SKILL.md` + Slate `*.html` files — concrete prototypes for each pattern
- `src/app/invoices/[id]/page.tsx` — Document Review reference implementation
- `src/app/dashboard/page.tsx` — Data-dense Overview reference implementation
- `src/app/onboard/OnboardWizard.tsx` — Wizard reference implementation
- CLAUDE.md "Nightwork standing rules → UI rules" — Document Review gold-standard rule

---

## 16. T14 carry-forward

### Applied at T14 (2026-04-30)

1. **All 12 patterns catalogued** — 9 Jake-named (Document Review, Multi-step Approval, Data-dense Overview, Mobile Touch Approval, Config Form, List+Detail, Wizard, Empty Workspace, Print View) + Reconciliation (strawman) + Confirm/Destructive Action + Loading/Error/Skeleton overlay (universal layer). Aligns to SPEC A14's enumeration (note: SPEC A14 lists 9 Jake-named + AppShell + Audit Timeline + File Uploader; PATTERNS.md instead enumerates Reconciliation + Confirm + Loading/Error layer per nwrp15 directive — AppShell, Audit Timeline, FileUploader are documented as COMPONENTS.md entries, not page patterns; AppShell §4.1, audit-timeline composition §3 of Doc Review, FileDropzone §1.7).
2. **Document Review is the gold standard** — explicit contract referenced from `nightwork-ui-template` skill verbatim; anatomy + components + tokens + a11y + mobile + examples + anti-patterns + cross-references documented in §2.
3. **Reconciliation strawman** — 4 candidate visualization models (A: side-by-side delta, B: inline diff, C: timeline overlay, D: hybrid) documented per SPEC A16 with explicit tradeoffs and rejection criteria per SPEC A16.1. Marked as "STRAWMAN — deferred to first reconciliation phase implementation per NQ5/D-028."
4. **Mobile Touch Approval density mapping** — per SPEC A18.1, file preview moves to top, allocations collapse with tap-expand, audit shows last-3-with-expand, status+total+primary-action above-the-fold.
5. **Print View AIA G702/G703 fidelity** — per SPEC A17, references Drummond Pay App 8, print stylesheet forces compact density, animations disabled, page-break behavior documented.
6. **Pattern selection tree** — §13 maps workflow needs to one of 12 patterns.
7. **Cross-pattern composition rules** — §14 covers 9 common composition cases (Document Review + Multi-step Approval, Wizard + Confirm, etc.).
8. **All token references cited from SYSTEM.md by name**, no hardcoded hex outside historical-context footnotes (e.g., `#5B8699` in stone-blue accent ratio explanations).
9. **All component references cited from COMPONENTS.md by §-anchor**, e.g., "AppShell (Navigation §4.1)", "Card (Surfaces §2.1)", "NwButton (Existing primitives §7.1)".
10. **Real Nightwork screen examples** — every pattern cites at least 2-3 real or planned implementation paths (`src/app/invoices/[id]/page.tsx`, `src/app/dashboard/page.tsx`, etc.).

### Deferred (not blocking T15)

1. **Reconciliation pattern model selection** — per D-028, post-Phase-3.9 phase. The current §11 strawman is provisional; actual chosen model + its anatomy locks the section in 1.5b mock-up review (per D-036).
2. **Print View concrete implementation** — `src/app/draws/[id]/print/page.tsx` is planned for Wave 1.1. Today's §10 documents the contract; live implementation is forward.
3. **Mobile Touch Approval as standalone surface** — currently documented as the `nw-phone` collapse of Document Review per §14e. If a standalone mobile-only surface emerges (e.g., "Mobile Quick Approve from notification"), surface to PROPAGATION-RULES.md.
4. **List + Detail right-rail (7c.2) for vendors / change orders** — pattern documented; concrete `src/app/vendors/page.tsx` implementation planned for Wave 1.1.
5. **Wizard for new job migration** — `src/app/jobs/new/page.tsx` is currently single-page; planned migration to 3-4 step wizard.
6. **Per-job dashboard** — `src/app/jobs/[id]/page.tsx` planned for Wave 1.1; Pattern §4 documents the contract.
7. **Reconciliation rejection criteria #5** — "won't ship a model with metaphor mismatch" — final rejection threshold (>25% misread rate) is provisional; 1.5b user testing locks the threshold.
8. **AppShell as standalone pattern** — SPEC A14 lists AppShell as one of the 12 patterns; PATTERNS.md instead documents AppShell as a COMPONENTS.md entry (§4.1) used by every page pattern as outer chrome. Per nwrp15 directive — page patterns are 12 listed entities; AppShell is shared chrome. Resolution: AppShell stays in COMPONENTS.md; this PATTERNS.md notes its role as universal outer wrapper.

These are tracked as deferred items within Stage 1.5a — none block T15 PROPAGATION-RULES.md drafting.

---

**T14 status:** PATTERNS.md DRAFT COMPLETE (2026-04-30). 12 patterns documented (Document Review gold standard + Multi-step Approval + Data-dense Overview + Mobile Touch Approval + Config Form + List+Detail + Wizard + Empty Workspace + Print View + Reconciliation strawman + Confirm + Loading/Error/Skeleton layer). Pattern selection tree + cross-pattern composition rules + bidirectional skill anchors locked. Subordinate documents (PROPAGATION-RULES.md, .impeccable.md) and the components playground patterns page (T23) reference this document as authoritative. Reconciliation pattern picks one of 4 candidate models in 1.5b prototype review per D-028 / D-036.
