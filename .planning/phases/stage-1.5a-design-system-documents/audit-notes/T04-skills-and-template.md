# T04 — Audit existing 3 design skills + invoice review template

**Date:** 2026-04-29
**Sources audited:**
1. `.claude/skills/nightwork-design/SKILL.md`
2. `.claude/skills/nightwork-design-tokens/SKILL.md`
3. `.claude/skills/nightwork-ui-template/SKILL.md`
4. `src/app/invoices/[id]/page.tsx` (gold-standard Document Review pattern reference)

For each: what gets cross-referenced from the new SYSTEM/COMPONENTS/PATTERNS docs, vs lifted-and-replaced.

---

## 1. `nightwork-design` skill

### What it provides today

- **Slate palette** (one short prose summary): `#F7F5EC` page · `#3B5864` primary text · `#1A2830` slate-deep · `#5B8699` stone-blue · `#4E7A8C` gulf-blue · `#C98A3B` warn · `#4A8A6F` success · `#B0554E` danger.
- **Type system:** Space Grotesk (display) + Inter (body) + JetBrains Mono (eyebrows/money).
- **8 non-negotiable visual rules** (everything is square; sand not white; no gradients; thin slate borders; rare shadows; eyebrow everywhere; bordered-not-filled status pills; no emoji).
- **Workflow guidance:** for production code, lift tokens from `colors_and_type.css` into globals.css + Tailwind config; for mockups, copy assets and import Google Fonts.
- **Reference screens:** "Slate *.html" files at the skill root (anchor for visual matching).
- **Stack assumption:** Next.js 14 + Tailwind + shadcn/ui + Supabase.

### Disposition for Wave 3 (T12-T17)

| Aspect | Cross-reference (skill points TO new doc) | Lift-and-replace (skill stays as canonical) |
|---|---|---|
| Slate palette hex values | Skill cross-references SYSTEM.md (T12) for the canonical token enumeration. Q1=C means SYSTEM.md hosts both candidate palettes; the skill tracks the locked one post-CP2. | — |
| Type system | Skill cross-references SYSTEM.md (T12) section 4 (typography). | — |
| 8 non-negotiables | Skill cross-references SYSTEM.md A2.1 "Forbidden thresholds" (quantified). The prose form stays in the skill as a quick orientation. | Prose summary stays in skill (orientation); quantified thresholds live in SYSTEM.md. |
| Reference screens | Skill keeps the "Slate *.html" reference set as the visual anchor. SYSTEM.md cross-references it. | Skill stays canonical for these. |
| Workflow guidance | Skill cross-references PROPAGATION-RULES.md (T15) for the full token-add / component-add flow. | — |
| Stack assumption | Skill cross-references CLAUDE.md "Tech Stack" + SYSTEM.md "tooling" section. | — |

**Action for T27:** Update `nightwork-design/SKILL.md` to add a `## Authoritative documents` section at top:
- SYSTEM.md → `.planning/design/SYSTEM.md` for tokens
- COMPONENTS.md → `.planning/design/COMPONENTS.md` for component contracts
- PATTERNS.md → `.planning/design/PATTERNS.md` for page templates
- CONTRAST-MATRIX.md → `.planning/design/CONTRAST-MATRIX.md` for accessibility
- PHILOSOPHY.md → `.planning/design/PHILOSOPHY.md` (CP2-locked direction)

**Bidirectional anchor:** SYSTEM.md "Skill anchor" section (per A19.1) names this skill as a downstream consumer.

---

## 2. `nightwork-design-tokens` skill

### What it provides today

- **Token sources of truth list:** `globals.css` + `tailwind.config.ts` + `nightwork-design` skill.
- **Allowed shapes table:** every allowed Tailwind utility for backgrounds, text, borders, accent, spacing, fonts, type sizes, money, status, eyebrows, buttons.
- **Hard rejections list:** 8 forbidden patterns (hex codes; Tailwind named colors like `bg-blue-500`; legacy namespaces `cream-*` / `teal-*` / `brass-*` / `brand-*`; hardcoded font-family / font-size; inline color hex via style; custom status pills; direct money `.toFixed(2)`).
- **Allowed exceptions:** `public/brand/`, Tailwind config + globals.css (DEFINE the tokens), test fixtures with explicit comment.
- **Self-check protocol:** 5-step pre-save check.
- **Cross-references:** `nightwork-design`, `nightwork-ui-template`, `nightwork-design-system-reviewer`, `nightwork-design-pushback-agent`, post-edit hook.

### Disposition for Wave 3

| Aspect | Cross-reference | Lift-and-replace |
|---|---|---|
| Token sources of truth list | Skill points to SYSTEM.md as the *primary* enumeration; `globals.css` + `tailwind.config.ts` remain the implementation truth. | — |
| Allowed shapes table | Stays in skill (it's the enforcement contract). SYSTEM.md cross-references it. | Stays canonical here. |
| Hard rejections list | Stays in skill. T10b/T10c/T10d hooks add three NEW rejection categories: bouncy easing, oversized rounded corners, sample-data isolation, tenant-blind primitives. Skill is updated to include these per A2.1 / C6 / C7 / C8. | Stays canonical here, EXTENDED. |
| Self-check protocol | Stays. SYSTEM.md cross-references for the canonical "what is a token" explanation. | Stays canonical. |
| Cross-references | Add: SYSTEM.md, COMPONENTS.md, PATTERNS.md, PROPAGATION-RULES.md, CONTRAST-MATRIX.md. | — |

**Action for T27:** Update `nightwork-design-tokens/SKILL.md` to:
1. Add `## Authoritative documents` section pointing to SYSTEM.md (token enumeration) + CONTRAST-MATRIX.md (token AA verification).
2. Extend "Hard rejections" section with 3 new categories from T10b/T10c/T10d (bouncy easing, oversized rounded corners outside avatar/dot, tenant-blind primitives violations, sample-data isolation in `/design-system`).
3. Add `## Forbidden thresholds (per SYSTEM.md A2.1)` referencing quantified rules.

**Bidirectional anchor:** SYSTEM.md "Skill anchor" section names this skill.

---

## 3. `nightwork-ui-template` skill

### What it provides today

- **Canonical reference paths:** `src/app/invoices/[id]/page.tsx` (page) + `src/components/invoice-file-preview.tsx` (preview) + `src/components/invoices/InvoiceDetailsPanel.tsx`, `InvoiceHeader.tsx`, `PaymentPanel.tsx`, `PaymentTrackingPanel.tsx` (right-rail panels) + `src/components/invoice-allocations-editor.tsx` (allocations editor) + `src/app/proposals/review/[extraction_id]/ReviewManager.tsx` (latest extension example).
- **Layout contract** (ASCII diagram + Tailwind shape):
  - AppShell wrapper
  - Header band (eyebrow + title + status badge + actions)
  - Body grid: `grid grid-cols-1 lg:grid-cols-2 items-start gap-5` — file preview LEFT, right-rail panels RIGHT (mobile: stacked, preview on top)
  - Audit timeline below (status_history JSONB rendered chronologically)
- **8 required behaviors:** file preview LEFT, fields RIGHT, audit BELOW; `grid-cols-1 lg:grid-cols-2`; file preview component handles file-type dispatch; status badge via `formatStatus` + `statusBadgeOutline`; AI confidence rendering with green/yellow/red routing; PM/QA edit overrides logged to `*_overrides` JSONB; status history timeline; locked-record view via `isInvoiceLocked()` + `canEditLockedFields()`.
- **Design token rules:** lifted from `nightwork-design`.
- **Anti-patterns:** right-rail above preview, modal-only review, inline editing without audit, custom iframe instead of `InvoiceFilePreview`, hardcoded hex, ad-hoc status pills, missing `status_history` updates.
- **Extending for a new entity:** 6-step recipe for `<entity>/review/[id]/page.tsx` + matching component sub-tree.
- **Cross-references:** `nightwork-design`, `nightwork-design-tokens`, `nightwork-ui-reviewer`.

### Disposition for Wave 3

| Aspect | Cross-reference | Lift-and-replace |
|---|---|---|
| Canonical reference paths | Stays in skill. PATTERNS.md "Document Review" entry (T14) cross-references this skill rather than duplicating paths. | — |
| Layout contract (ASCII + Tailwind shape) | **LIFTED VERBATIM** into PATTERNS.md "Document Review" entry per A15. | PATTERNS.md becomes canonical; skill cross-references PATTERNS.md. |
| 8 required behaviors | Lifted into PATTERNS.md "Document Review" entry. | PATTERNS.md canonical. |
| Anti-patterns | Lifted into PATTERNS.md (the anti-patterns become rejection-criteria for the pattern); skill cross-references PATTERNS.md. | PATTERNS.md canonical. |
| 6-step recipe for new entity | Skill keeps this (process / how-to). PATTERNS.md describes the contract; skill describes the *adoption recipe*. | Skill stays canonical for the recipe. |
| Design token rules | Skill cross-references SYSTEM.md + nightwork-design-tokens. | — |

**Action for T27:** Update `nightwork-ui-template/SKILL.md` to:
1. Add `## Authoritative documents` section pointing to PATTERNS.md "Document Review" as the canonical contract.
2. Slim the "Layout contract" section to a 1-paragraph summary + link to PATTERNS.md.
3. Keep the "Extending for a new entity" recipe (it's process, not contract).

**Bidirectional anchor:** PATTERNS.md "Document Review" entry references this skill at the bottom.

---

## 4. `src/app/invoices/[id]/page.tsx` — gold-standard Document Review pattern reference

Read for layout structure (skim, not full enumeration):

### Top-level structure observed

1. **Top of page (lines 1–110):** Imports — `AppShell`, `InvoiceFilePreview`, `InvoiceAllocationsEditor`, `NwButton`, `NwEyebrow`, `PaymentPanel`, `PaymentTrackingPanel`, `InvoiceHeader`, `InvoiceDetailsPanel`, `useCurrentRole`, `isInvoiceLocked` / `canEditLockedFields`, plus types and Supabase client.
2. **Type definitions (lines 22–110):** `Job`, `CostCode`, `BudgetInfo`, `InvoiceLineItem`, `InvoiceData`, `EditableLineItem` — exhaustive shape including `confidence_score`, `confidence_details`, `pm_overrides`, `qa_overrides`, `status_history`, `payment_*`, `signed_file_url`.
3. **Page component (line 113+):** uses `useParams` + `useRouter` for deep-linking; `useCurrentRole()` for role-based gating; deep state machinery for `EditableLineItem[]` working copy + AI suggestion confidence.
4. **AppShell wrapping** with header band containing breadcrumb + title + status badge + actions.
5. **50/50 hero grid** at line 1310:
   ```tsx
   <div
     className="grid grid-cols-1 lg:grid-cols-2 items-start"
     style={{
       gap: "1px",
       background: "var(--border-default)",
       border: "1px solid var(--border-default)",
     }}
   >
     {/* LEFT — Source document */}
     <div className="p-[22px]" style={{ background: "var(--bg-card)" }}>
       <h3 style={{ fontFamily: "var(--font-display)", fontWeight: 500, fontSize: "15px", color: "var(--text-primary)" }}>
         Source document
       </h3>
       <InvoiceFilePreview ... />
     </div>
     {/* RIGHT — Right-rail panels */}
     ...
   </div>
   ```
6. **Below the hero** — allocations editor (`<InvoiceAllocationsEditor>`), payment panel, audit timeline (status_history rendered as vertical event list).
7. **Action ribbon** (lines 1280-1306): `<NwButton variant="primary">Approve</NwButton>`, `<NwButton variant="secondary">Hold</NwButton>`, `<NwButton variant="danger">Deny</NwButton>`, `<NwButton variant="ghost">Kick Back to PM</NwButton>`, conditional Push-to-QuickBooks button.

### Key tokens consumed

| Token | Usage in invoice review page |
|---|---|
| `var(--bg-card)`             | Hero grid cells, right-rail panels |
| `var(--bg-page)`             | Page wrapper background |
| `var(--border-default)`      | Hero grid hairline + card border |
| `var(--text-primary)`        | Page heading "Source document" |
| `var(--font-display)`        | Hero heading inline-style font-family |
| `var(--font-mono)`           | "Open in new tab ↗" link styling (10px UPPERCASE) |
| `var(--nw-stone-blue)`       | Open-in-new-tab link color |
| `<NwButton>` variants        | primary (Approve), secondary (Hold), danger (Deny), ghost (Kick Back / Download PDF) |
| `<NwEyebrow>`                | Section labels above structured fields |
| `formatStatus()` + `statusBadgeOutline()` | Status pill in header |
| `formatCents()` / `formatDollars()` | Total amount + line-item amounts |

### Disposition

- This file is the **PATTERNS.md "Document Review" reference implementation** (per A15). PATTERNS.md does NOT duplicate the source; it cross-references this path and lifts the *contract* (regions, data shape, states).
- The `nightwork-ui-template` skill *codifies* the pattern in prose; PATTERNS.md adds rigor (data shape contract, example states, mobile behavior, print behavior).
- COMPONENTS.md (T13) inventories the components consumed (`NwButton`, `NwEyebrow`, `InvoiceFilePreview`, etc.).
- The 50/50 hero grid pattern (`grid grid-cols-1 lg:grid-cols-2 items-start` + 1px hairline via `gap: 1px` + matched `var(--border-default)` background) is a **distinguishing layout choice** — PATTERNS.md preserves this exactly.

---

## 5. Cross-reference matrix — what each new doc anchors

| New doc | Anchors to skill | Anchored from skill |
|---|---|---|
| **SYSTEM.md** (T12) | nightwork-design (palette intent), nightwork-design-tokens (enforcement) | nightwork-design (palette section), nightwork-design-tokens (token sources of truth) |
| **COMPONENTS.md** (T13) | nightwork-design-tokens (allowed shapes table for primitives), nightwork-ui-template (Document Review components) | nightwork-design-tokens (uses these tokens by default) |
| **PATTERNS.md** (T14) | nightwork-ui-template (Document Review reference) | nightwork-ui-template ("Authoritative documents → PATTERNS.md") |
| **PROPAGATION-RULES.md** (T15) | All 3 skills | All 3 skills (workflow guidance) |
| **CONTRAST-MATRIX.md** (T03.1, this Wave) | nightwork-design-tokens (AA enforcement) | nightwork-design-tokens (added cross-ref in T27) |
| **PHILOSOPHY.md** (T17a, T17b) | nightwork-design (Forbidden list verbatim, 5 reference benchmarks) | nightwork-design (post-CP2 direction lock) |
| **`.impeccable.md`** (T16) | All 3 skills + frontend-design + impeccable | All 3 skills (per Q1 anchor section) |

---

## 6. Net work for T27 (skill updates)

For each of the 3 skills, T27 will:
1. Add a `## Authoritative documents` section at top with paths to the new SYSTEM/COMPONENTS/PATTERNS/PROPAGATION-RULES/CONTRAST-MATRIX docs.
2. Slim duplicated content (e.g. `nightwork-ui-template`'s Layout contract becomes a summary + link to PATTERNS.md).
3. Add a `## What changed in 1.5a` short note at the end (1 paragraph) marking the date and the new anchor.

**Order of operations (per PROPAGATION-RULES.md):**
1. T12-T15 produce the new docs.
2. T27 updates the 3 skills.
3. T28 updates CLAUDE.md "UI rules" section (narrowly scoped, per M-S4).

---

**T04 status:** COMPLETE — disposition recorded for each skill + invoice review template.
