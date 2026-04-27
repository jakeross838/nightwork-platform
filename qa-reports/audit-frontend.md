# Audit — Frontend Code Quality
**Date:** 2026-04-24
**Scope:** `src/components/` (96 files), `src/app/` pages + layouts (73 files), `src/lib/` hooks/helpers (63 files)
**Files reviewed:** 232 files examined via grep sweeps + targeted reads

---

## Summary

The frontend is in reasonable health for a Phase 3 codebase but carries **two HIGH-severity XSS vectors**, **15 suppressed exhaustive-deps warnings** indicating potential stale-closure bugs, **31 page-level files bypassing the API layer** to query Supabase directly, and **4 `any` type uses** in client-visible code paths. No legacy Tailwind token namespace violations (cream/teal/brass/brand/nightwork/status as class names) were found — Phase E migration is clean. The token system is correctly using `nw-*` utilities and `bracket-value` CSS-var patterns throughout.

---

## Findings

### CRITICAL

#### C-1: Unsanitized Mammoth HTML rendered via `dangerouslySetInnerHTML`
- **Location:** `src/components/invoice-file-preview.tsx:258` and `src/components/invoice-upload-content.tsx:147`
- **Finding:** Both components render `mammoth.convertToHtml()` output directly into the DOM with no HTML sanitization. The `/api/invoices/parse` route returns `docx_html` in the JSON payload (stored as part of parse result), and `/api/invoices/[id]/docx-html/route.ts` also returns raw mammoth output. The route docstring says "sanitized HTML" but no sanitization library (`DOMPurify`, `sanitize-html`) is present in `package.json` or anywhere in `src/`.
- **Impact:** If a malicious DOCX containing `<script>` tags or `javascript:` URIs is uploaded (invoice file), the script executes in the authenticated user's browser context. The uploader doesn't need to be a trusted user — any vendor that submits a DOCX invoice could trigger this. With access to the Supabase client token, an XSS payload could exfiltrate session data or issue authenticated API calls.
- **Suggested fix:** Add `dompurify` (or `isomorphic-dompurify` for SSR safety) and wrap every mammoth output before render:
  ```tsx
  import DOMPurify from "isomorphic-dompurify";
  <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(html) }} />
  ```
  Also update the `parse` route and `docx-html` route to sanitize before storing/returning.

---

### HIGH

#### H-1: 31 page-level files import and directly query the Supabase browser client
- **Location:** See full list in "Client-side Supabase" table below
- **Finding:** 31 `page.tsx` and `layout.tsx` files import `{ supabase } from "@/lib/supabase/client"` and issue `.from(...).select(...)` directly, bypassing the API layer. All of these are `'use client'` pages, so they use the anon-key browser client. The queries skip the `getCurrentMembership()` pattern and `org_id` filter that API routes enforce — org scoping relies entirely on RLS.
- **Impact:** This is the pattern CONCERNS.md (SEC-M-2) already flags: RLS is a backstop, not the auth layer. If an RLS policy is accidentally dropped or misconfigured (as already happened for join-embedded queries on 6 routes per F-002), these queries silently return cross-org data. The pattern is also inconsistent with the architecture rule: "All business logic in server-side API routes or Supabase functions. Frontend is display + forms only." Large pages like `invoices/[id]/page.tsx` (2,592 lines), `invoices/queue/page.tsx` (1,550 lines), `jobs/[id]/budget/page.tsx` (1,514 lines) and `draws/new/page.tsx` (1,134 lines) are the worst offenders — they contain direct multi-table query orchestration that belongs in API routes.
- **Suggested fix:** Migrate client-side Supabase queries to `fetch("/api/...")` calls. The highest-priority targets are the 4 pages over 1,000 lines. Medium-term: introduce a `useApiQuery` hook that wraps `fetch` with org headers, replacing the patchwork of inline `supabase` calls.

#### H-2: 15 suppressed `react-hooks/exhaustive-deps` warnings — multiple legitimate stale-closure risks
- **Location:** 15 total; most significant are:
  - `src/app/draws/new/page.tsx:251` — `[jobId, jobs]` dep array, `selected` state used inside the effect but omitted
  - `src/app/draws/new/page.tsx:305` — `[jobId, periodStart, periodEnd]` omits `selected` and `draftId`
  - `src/app/draws/[id]/page.tsx:127` — `[drawId]` omits `load` function reference
  - `src/components/invoice-import-content.tsx:186` — `[]` dep array for `useCallback` that closes over `cancelledRef`
  - `src/app/jobs/[id]/budget/page.tsx:319` — omits `loadBudget`
  - Full list: csv-importer:367, invoice-allocations-editor:52, invoice-import-content:117,186, jobs/home-characteristics-panel:77, draws/new:251,305, draws/[id]:127, invoices/[id]:469,501, invoices/[id]/qa:100, jobs/[id]/budget:319, jobs/[id]/change-orders:98, jobs/[id]/lien-releases:83, jobs/[id]/purchase-orders:86
- **Finding:** ESLint's exhaustive-deps rule is suppressed rather than the dep array being corrected. Several of these are non-trivially stale: `draws/new/page.tsx` line 305 runs the invoice period fetch but omits `draftId` and `selected.size` — if the user edits period dates, the already-selected state doesn't reset, causing re-attach of invoices from the previous period.
- **Impact:** Stale closures produce bugs that are intermittent and hard to reproduce. The draws/new pattern is the highest-risk because it involves financial data selection.
- **Suggested fix:** Review each suppression individually. For load-on-mount patterns where the fn reference changes, wrap in `useCallback` and add it to the dep array. For genuinely intentional one-shot effects, add a comment explaining why the omission is safe.

#### H-3: `--status-danger` CSS variable used but never defined
- **Location:** `src/components/cost-intelligence/invoice-pdf-preview-inner.tsx:136`
- **Finding:** `text-[color:var(--status-danger)]` references a CSS variable that does not exist in `colors_and_type.css` or `globals.css`. The correct token is `var(--nw-danger)` or `var(--color-error)`. The `--status-*` namespace was part of the removed Phase E legacy system. This token silently resolves to empty/initial in both themes.
- **Impact:** The PDF load error message in the invoice detail panel renders with no text color (inherits default, likely invisible or inconsistent). Visual bug in an error state.
- **Suggested fix:** Replace `var(--status-danger)` with `var(--nw-danger)` on that line.

#### H-4: `any` types in 4 client-visible code paths
- **Location:**
  - `src/app/invoices/page.tsx:188,192` — `(li as any).cost_codes` and `(li as any).invoice_id`
  - `src/lib/claude/parse-invoice.ts:25` — `(supabase as any)` to call `.rpc()`
  - `src/lib/invoices/corrections.ts:105` — `const row = invoice as any`
- **Finding:** Three of the four `as any` casts come with `eslint-disable` comments but no reason comment explaining why the cast is safe. The `invoices/page.tsx` casts are on embedded join shapes where the Supabase return type isn't narrowed — a typed join result type would eliminate both.
- **Impact:** Type safety is lost locally; refactors to these shapes won't be caught by TS.
- **Suggested fix:** For the invoice page, define a narrow interface for the join result. For `parse-invoice.ts`, add the `rpc` call to the typed Supabase client or use a server-side API route.

---

### MEDIUM

#### M-1: 10 component/page files over 400 lines (5 over 1,000)
- **Location:** See "Size hotspots" table below
- **Finding:** `src/app/invoices/[id]/page.tsx` at 2,592 lines is the worst case. It is a `'use client'` page with 11 `useEffect` hooks, 12+ `useState` calls, inline render functions, and direct Supabase queries. It handles invoice display, editing, status transitions, file preview, allocation editing, and status timeline — all in one module. The previous CONCERNS.md entry flagged 3,548 LOC (it's now 2,592 after Phase 3b merges), but the underlying complexity remains.
- **Impact:** Cognitive overhead slows feature work. Stale closure risk is proportional to the number of `useEffect` / `useState` combinations in one closure scope.
- **Suggested fix:** Extract sub-components: `InvoiceStatusPanel`, `InvoiceEditForm`, `InvoiceFilePreview` (already partially exists), `InvoiceHistoryTimeline`. Each can own its own data-fetch useEffect.

#### M-2: Array index used as `key` in 8 places across reusable components
- **Location:**
  - `src/components/invoice-allocations-editor.tsx:176` — allocation rows keyed by index
  - `src/components/invoice-upload-content.tsx:291,314` — line items in upload preview
  - `src/components/invoices/InvoiceDetailsPanel.tsx:378` — timeline events
  - `src/components/items/extraction-verification-panel.tsx:499` — overhead rows
  - `src/components/loading-skeleton.tsx:41,52` — skeletons (acceptable here)
  - `src/app/invoices/[id]/page.tsx:2561` — status history entries
  - 7 more in app pages
- **Finding:** For the allocation editor and upload preview specifically, rows can be reordered, added, or removed. Index keys cause React to reuse DOM nodes incorrectly on reorder/delete, potentially keeping stale input state.
- **Impact:** The allocation editor (`invoice-allocations-editor.tsx`) allows adding/removing rows — an index key here can cause edited row values to "shift" to an adjacent row after deletion.
- **Suggested fix:** For `invoice-allocations-editor.tsx`, add a stable `id` or `_rowKey` field to the `Allocation` type. For read-only lists (timeline, overhead), index keys are acceptable; add a comment.

#### M-3: 6 console.log/warn/error calls in production component code
- **Location:**
  - `src/components/connection-banner.tsx:61` — `console.warn` on ping failure
  - `src/components/cost-intelligence/verification-detail-panel.tsx:185` — `console.warn` on JSON parse fail
  - `src/components/invoice-import-content.tsx:90,106,208` — `console.error` on load/fetch errors
  - `src/components/toast-provider.tsx:100` — `console.warn` on missing provider
- **Finding:** All have `eslint-disable-next-line no-console` suppressions, so they pass lint. However, they produce unstructured noise in production browser consoles and are not routed through `src/lib/perf-log.ts`.
- **Impact:** Customer-facing browser consoles show internal error messages. Inconsistent with the no-console convention.
- **Suggested fix:** Replace with conditional `perf-log` calls or silent no-ops. The `toast-provider` and `connection-banner` cases are more defensible as they indicate real runtime issues — those could be re-raised to Sentry.

#### M-4: Inline `style={{}}` used in 845 instances where Tailwind utilities exist
- **Location:** Pervasive — `src/components/admin/audit-row.tsx` (15+ inline styles), `src/components/admin/bootstrap-aliases-panel.tsx` (12+ inline styles), and many others
- **Finding:** 845 `style={{}}` occurrences across components and pages. Most are CSS-variable-based (e.g. `style={{ color: "var(--text-secondary)" }}`), which is the documented alternative for values not expressible as Tailwind utilities. However, `audit-row.tsx` uses 15 inline styles for properties like `borderColor`, `color`, and `fontFamily` that have direct bracket-value Tailwind equivalents (`border-[var(--border-subtle)]`, `text-[color:var(--text-secondary)]`).
- **Impact:** Inconsistency with the project convention; harder to scan for styling intent. No functional bug.
- **Suggested fix:** The font-family inline styles in `bootstrap-aliases-panel.tsx` are legitimate (no `font-[var(...)]` in Tailwind v3). The color/border inline styles in `audit-row.tsx` should migrate to bracket utilities to match the rest of the codebase.

#### M-5: No Suspense boundaries around async client-component data fetches
- **Location:** All 31 direct-Supabase client pages, plus reusable components like `job-overview-cards.tsx`, `budget-drill-down.tsx`
- **Finding:** Every async data fetch in client components is guarded by a `loading` boolean state. Only one Suspense usage was found in the entire codebase (`src/app/cost-intelligence/verification/page.tsx:390`). No loading skeleton integration with React Suspense.
- **Impact:** Loading states are managed manually with boolean flags — this is fine and works, but contributes to the state-count explosion in large pages (budget page has 14+ `useState` calls). Not a blocking issue.
- **Suggested fix:** Lower priority — convert to Suspense + React Query / SWR in a Phase F refactor to reduce manual state management.

---

### LOW

#### L-1: `focus-teal` and `brass-underline` utility class names sound like legacy namespaces but are valid
- **Location:** `src/app/globals.css:71,73`; used in `src/app/settings/company/CompanySettingsForm.tsx:286`
- **Finding:** These are custom utility classes defined in `globals.css @layer components` and are NOT the removed token namespaces. `focus-teal` maps to `var(--border-brand)` (the correct Slate token). `brass-underline` renders a decorative underline using `var(--text-secondary)`. Both are valid. However, their names carry legacy semantics that could confuse future contributors.
- **Impact:** No functional issue. Naming confusion only.
- **Suggested fix:** Consider renaming to `focus-brand` and `nw-section-underline` in a future pass, or add a comment in globals.css clarifying these are maintained utilities.

#### L-2: `typeof window` guard in `invoice-import-content.tsx` batch-ID useEffect is potentially fragile
- **Location:** `src/components/invoice-import-content.tsx:113`
- **Finding:** The effect runs `if (typeof window === "undefined") return` inside a `useEffect` with `'use client'`. In Next.js 14 App Router client components, `useEffect` never runs server-side — the guard is redundant but harmless. The suppressed dep array (`[]`) is the more concerning issue (covered in H-2).
- **Impact:** Dead code; no functional impact.
- **Suggested fix:** Remove the `typeof window` guard.

#### L-3: `src/app/page.tsx`, `src/app/pricing/page.tsx`, and `src/app/settings/usage/page.tsx` use `dangerouslySetInnerHTML` for inline `<style>` tags
- **Location:** `src/app/page.tsx:26`, `src/app/pricing/page.tsx:224`, `src/app/settings/usage/page.tsx:133`
- **Finding:** These inject literal CSS strings (not user content) via `dangerouslySetInnerHTML`. The strings are hardcoded at build time, so there is no XSS risk. This is a common Next.js pattern for page-scoped CSS that avoids CSS Modules.
- **Impact:** Cosmetic convention deviation only; no security risk.
- **Suggested fix:** Move page-scoped styles to CSS Modules (`.module.css`) or Tailwind utilities to eliminate the pattern.

#### L-4: Inconsistent component file naming — one file uses `PascalCase` in a subdirectory of `kebab-case` files
- **Location:** `src/components/invoices/InvoiceDetailsPanel.tsx` (PascalCase), alongside `src/components/invoices/invoice-*.tsx` siblings
- **Finding:** CONVENTIONS.md specifies PascalCase for component file names. However, the majority of component files in `src/components/` use kebab-case (e.g., `invoice-upload-content.tsx`, `budget-drill-down.tsx`). `InvoiceDetailsPanel.tsx` follows CONVENTIONS.md but is the exception in practice.
- **Impact:** Import autocompletion and glob patterns may differ by case sensitivity on Linux CI.
- **Suggested fix:** Standardize on PascalCase per CONVENTIONS.md in a low-priority rename pass, or explicitly document that kebab-case is the working convention.

---

## Legacy token sweep

| Search | Matches | Verdict |
|--------|---------|---------|
| `\bcream-[0-9]` in src/ | 0 | Clean |
| `\bteal-[0-9]` in src/ | 0 | Clean |
| `\bbrass-[0-9]` in src/ | 0 | Clean |
| `\bbrand-[a-z]` in className | 0 | Clean |
| `\bnightwork-[a-z]` in className | 0 | Clean (SVG path `/nightwork-wordmark.svg` is a file path, not a token) |
| `\bstatus-[a-z]` in className | 0 | Clean (no class names) |
| `var(--status-danger)` | 1 | **BUG** — undefined CSS var in `invoice-pdf-preview-inner.tsx:136` |
| `focus-teal` in JSX | 1 | Valid utility defined in globals.css |
| `brass-underline` in JSX | 1 | Valid utility defined in globals.css |

**Legacy namespace migration (Phase E): complete.** Zero class-name violations. One undefined CSS variable (`--status-danger`) used in a bracket-value expression.

---

## Client-side Supabase direct queries (31 page files)

All 31 files import `{ supabase } from "@/lib/supabase/client"` and issue DB queries bypassing the API route layer. Highest-risk files (>500 lines of direct queries):

| File | Lines | Risk |
|------|-------|------|
| `src/app/invoices/[id]/page.tsx` | 2,592 | Highest — multi-table, status transitions |
| `src/app/invoices/queue/page.tsx` | 1,550 | High — batch operations |
| `src/app/jobs/[id]/budget/page.tsx` | 1,514 | High — budget line writes |
| `src/app/draws/new/page.tsx` | 1,134 | High — draw creation |
| `src/app/draws/[id]/page.tsx` | 1,016 | High — draw detail |
| `src/app/jobs/[id]/internal-billings/page.tsx` | 976 | Medium |
| `src/app/dashboard/page.tsx` | 607 | Medium |
| `src/app/invoices/queue/page.tsx` | 1,550 | Medium |
| +23 others | <600 each | Lower |

---

## Size hotspots

| File | Lines | Notes |
|------|-------|-------|
| `src/app/invoices/[id]/page.tsx` | 2,592 | 11 useEffects, 12+ useState, direct DB queries |
| `src/app/invoices/queue/page.tsx` | 1,550 | Should be server component with client sub-widgets |
| `src/app/jobs/[id]/budget/page.tsx` | 1,514 | Manageable — well-structured, 5 useEffects |
| `src/app/draws/new/page.tsx` | 1,134 | 4 useEffects, 2 suppressed dep arrays (H-2) |
| `src/app/draws/[id]/page.tsx` | 1,016 | 1 suppressed dep array |
| `src/app/jobs/[id]/internal-billings/page.tsx` | 976 | New in Phase 3b — not yet refactored |
| `src/components/budget-drill-down.tsx` | 824 | Single useEffect with cancelled-flag, acceptable |
| `src/components/invoice-upload-content.tsx` | 770 | Drag-drop + preview — partially justified |
| `src/components/invoice-import-content.tsx` | 679 | Import batch orchestration — borderline |
| `src/components/invoices/InvoiceDetailsPanel.tsx` | 641 | Read-only panel — low risk |
| `src/components/job-overview-cards.tsx` | 635 | 8 parallel supabase queries in one useEffect |
| `src/components/items/extraction-verification-panel.tsx` | 532 | Dense but single-concern |
| `src/components/cost-intelligence/verification-detail-panel.tsx` | 490 | Dense — extractable |
| `src/components/items/cost-lookup-widget.tsx` | 481 | Borderline |
| `src/components/payment-batch-by-vendor-panel.tsx` | 470 | Borderline |
| `src/components/nav-bar.tsx` | 457 | Nav — inline is common |
| `src/components/support-chat-widget.tsx` | 451 | Floating widget — inline justified |
| `src/components/csv-importer.tsx` | 419 | Acceptable for import wizard |
| `src/components/job-sidebar.tsx` | 415 | Acceptable |

---

## Positive observations

- **Phase E token migration is fully complete.** Zero legacy class-name token uses (cream/teal/brass/brand/nightwork/status as class names). Every color reference uses either `nw-*` utilities or `bg-[var(--...)]` / `text-[color:var(--...)]` bracket syntax. Tailwind config confirms old namespaces were removed.
- **`useEffect` cleanup is generally good.** The large pages (`invoices/[id]`, `draws/[id]`, `budget-drill-down`) all use `cancelled = true` flag patterns or `AbortController` correctly. The CONCERNS.md warning about "no cleanup" in the invoice detail page has been addressed since that earlier audit.
- **No hydration mismatches found.** All components using hooks are properly marked `'use client'`. No server-only APIs called in client components.
- **No prop drilling beyond 2 levels found.** Data flows from page to direct children; sub-components fetch their own data rather than receiving it as deeply nested props.
- **Soft-delete filtering is consistent.** Every client-side Supabase query reviewed includes `.is("deleted_at", null)`.
- **Amounts in cents throughout.** No floating-point currency math found in component code. `NwMoney` component and `formatCents()` used consistently.
- **`useMemo` and `useCallback` are used appropriately** in the components that have them — not over-applied, not missing on expensive computations that are visually re-computed.
