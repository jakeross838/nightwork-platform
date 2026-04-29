# T06 — Icon inventory

**Date:** 2026-04-29
**Method:** `grep -rn '<svg\|@heroicons\|<path' src/components/ src/app/`

---

## 1. Headline counts

| Metric | Count |
|---|---|
| Total inline `<svg>` usages across `src/components/` + `src/app/` | **93** |
| Distinct files containing inline `<svg>`                          | **37** |
| Files importing `@heroicons` library                              | **1** (only `theme-toggle.tsx` mentions Heroicons in a comment — actual import does NOT exist; the `<svg>`s are hand-rolled "Heroicons-style") |
| Total `<path>` element occurrences (proxy for SVG complexity)     | 184 |
| Files with `<path>`                                               | 37 |

**Implication:** the codebase has **zero `@heroicons/react` imports** today. Every icon is hand-rolled inline SVG, mostly Heroicons-derived (24×24 viewBox, stroke-based).

---

## 2. Per-file `<svg>` usage (descending)

| File | Inline `<svg>` count | Notes |
|---|---|---|
| `src/app/invoices/[id]/page.tsx`                              | 12 | Gold-standard Document Review — uses inline SVG icons throughout |
| `src/components/empty-state.tsx`                              | 10 | Largest concentration — empty-state illustrations (1 per state variant) |
| `src/components/invoice-upload-content.tsx`                   | 9  | Upload + parse-progress affordances |
| `src/components/toast-provider.tsx`                           | 5  | Per-toast-type icons (success/error/info/warning/neutral) |
| `src/components/vendor-contact-popover.tsx`                   | 4  | Phone / email / address / link icons |
| `src/components/nav-bar.tsx`                                  | 4  | Nav navigation icons |
| `src/app/invoices/page.tsx`                                   | 4  | List page filters + actions |
| `src/components/cost-intelligence/recent-learnings-panel.tsx` | 3  | Per-learning-type icons (positive/negative/correction) |
| `src/app/jobs/[id]/budget/page.tsx`                           | 3  | Budget page actions |
| `src/app/invoices/queue/page.tsx`                             | 3  | Queue actions |
| `src/app/draws/[id]/page.tsx`                                 | 3  | Draw actions |
| `src/components/theme-toggle.tsx`                             | 2  | Sun + moon (the file COMMENT says "Heroicons-style outline, 1.5 stroke. Inlined to avoid pulling in @heroicons/react just for two icons.") |
| `src/components/support-chat-widget.tsx`                      | 2  | Chat bubble + send |
| `src/components/nav/nav-dropdown.tsx`                         | 2  | Chevrons |
| `src/components/job-sidebar.tsx`                              | 2  | Sidebar nav |
| `src/components/draw-lien-release-upload-list.tsx`            | 2  | Upload + remove |
| `src/components/cost-code-combobox.tsx`                       | 2  | Caret + clear-X |
| `src/app/jobs/[id]/lien-releases/page.tsx`                    | 2  | List actions |
| 18 other files                                                | 1 each | Single-icon usages |

**Total:** 93 inline SVGs across 37 files.

---

## 3. Stroke-width patterns observed

A `grep` of `strokeWidth={N}` values shows the spread:

| Stroke width | Count (sampled) | Notes |
|---|---|---|
| `1.5` | dominant in empty-state, theme-toggle, larger illustrations | matches `nightwork-design` skill rule "Heroicons outline, stroke 1.5" |
| `2`   | dominant in compact icons (combobox carets, action buttons, nav) | tighter for small viewports; not strictly Heroicons |
| `2.5` | used in `draw-lien-release-upload-list` (upload affordance) | even tighter — emphasized state |

**Implication for COMPONENTS.md A12.2:** the canonical stroke per skill is **1.5** for outline icons. Existing usage is mixed (1.5 / 2 / 2.5). Migration to `@heroicons/react` will normalize stroke to 1.5 (Heroicons "outline" variant default).

---

## 4. Sample inline `<svg>` shapes

```tsx
// src/components/app-shell.tsx (chevron in nav)
<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
  ...
</svg>

// src/components/empty-state.tsx (large illustration)
<svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
  ...
</svg>

// src/components/cost-code-combobox.tsx (compact 14×14)
<svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
  ...
</svg>

// src/components/theme-toggle.tsx (16×16 moon — Heroicons-style with 1.5 stroke)
<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
     strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
</svg>
```

All inline icons consistently:
- Use `viewBox="0 0 24 24"` (Heroicons grid).
- Use `stroke="currentColor"` (theme-aware via parent `text-*` color).
- Use `fill="none"` (outline style).
- Use `aria-hidden="true"` when decorative — most do, but some don't (T13 to flag).

---

## 5. SPEC §4 carve-out reaffirmed

Per SPEC §4 ("Out of scope (explicit)"):

> Migration of existing inline SVG icons to Heroicons (defer; just install Heroicons for new components)

**Phase 1.5a does NOT migrate the 93 inline SVGs.** It installs `@heroicons/react` (T09) so that:
- New components in `src/components/ui/` (shadcn output) can use Heroicons.
- New category pages in `src/app/design-system/components/*/page.tsx` (T20a–T20f) use Heroicons for their reference icons.
- Future Wave 1.1 polish work migrates existing usages incrementally.

This is preserved in the plan via T20a's note "Do NOT refactor existing inline SVG icons in this phase (per planner M-P2 carryover; SVG migration is deferred per scope §4)."

---

## 6. Iconography contract for new code (per A12.2)

When `@heroicons/react` lands (T09 installs `^v2.x`), COMPONENTS.md A12.2 enumerates the semantic icon → use mapping:

| Use category | Heroicons-outline (stroke 1.5) | Example |
|---|---|---|
| Status        | `CheckCircleIcon`, `ExclamationTriangleIcon`, `XCircleIcon`, `InformationCircleIcon` | Status of invoice/job |
| Action        | `PlusIcon`, `TrashIcon`, `PencilSquareIcon`, `ArrowPathIcon`, `ArrowUpTrayIcon`      | Buttons + menu items |
| Navigation    | `ChevronRightIcon`, `ChevronDownIcon`, `Bars3Icon`, `XMarkIcon`                       | Nav + breadcrumbs |
| File-type     | `DocumentIcon`, `DocumentTextIcon`, `PhotoIcon`, `DocumentArrowDownIcon`              | File preview headers |
| Progress      | `ArrowPathIcon` (loading), `CheckIcon` (done), `ClockIcon` (pending)                  | Status flow indicators |
| Alert         | `ExclamationCircleIcon`, `ShieldExclamationIcon`                                       | Warning banners |

Specific icon names come from Heroicons v2 outline set. T13 will finalize.

**Rule:** When adding a NEW component in 1.5a (Wave 4 category pages), use Heroicons. When TOUCHING an EXISTING component (Wave 1.1+), MAY migrate its inline SVGs to Heroicons as a side-effect, but NOT required in 1.5a.

---

## 7. Counts forwarded to SPEC tracking

These counts will appear in `nightwork-spec-checker` validations later:

- 93 inline SVGs → migration backlog for Wave 1.1.
- 37 files with inline icons → migration scope.
- 0 `@heroicons/react` imports today → after T09 there will be ≥1 (in design-system playground); CI count tracks growth.

---

**T06 status:** COMPLETE — inventory captured.
