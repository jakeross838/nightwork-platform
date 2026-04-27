# Audit — UI/UX Static Review
**Date:** 2026-04-24
**Scope:** `src/app/` pages, `src/components/`, `src/components/ui/`
**Files reviewed:** 68 pages + ~85 component files across the full app surface

---

## Pillar scores (1–4)

| Pillar | Score | Rationale |
|---|---|---|
| Consistency | 3 | NW primitives (Button, Badge, Card, Money, Eyebrow, DataRow, StatusDot) are well-specified and consistently used in new code. However several older page-level components inline raw Tailwind classes that duplicate or slightly diverge from the primitive tokens — two distinct `StatCard` implementations exist (dashboard vs invoices list), some modals use raw `button` instead of `NwButton`, and the `ImpersonateButton` reimplements button chrome outside the design system. |
| Accessibility | 2 | `aria-label` / `aria-live` / `role="alert"` are nearly absent from business-critical interactive elements. All major list views (invoices, draws, POs, COs) use `<tr onClick>` with no keyboard event or `<a>` wrapper — middle-click, keyboard, and screen-reader navigation are broken. Filter form controls lack `<label>` elements (only placeholder text). Modals lack focus trapping and explicit `aria-modal`. `StatusDot` only optionally supplies a `label` prop and callers rarely pass it. The loading skeleton uses `aria-busy/aria-label` but the actual async fetch states on most pages have no live-region announcement. |
| State completeness | 3 | Loading skeletons exist and are used on the dashboard and invoice list. Empty states are well-designed and used in the queue. Error states render inline text on most pages. However: the invoice detail page's load error state is a plain string with no retry action; the allocations editor loading state is just an unstyled text node; the draw wizard has no skeleton between steps; the budget page's `add line` inline form has no empty/error state for the cancel path; several API call failure paths only `console.warn` and leave the UI blank. |
| Information density | 3 | The dashboard and invoice list strike a good balance for desktop. The invoice detail 50/50 hero is the best surface in the product — original document on left, parsed fields on right, allocations editor below, all on one scroll. The queue cards are well-structured. Two density problems: (1) the `FinancialViewTabs` secondary tab rail doubles the header chrome on every financial page, adding vertical height before content; (2) the draw wizard's step 3 (line items table) can overflow on laptop screens because the 6-column G703 table is not horizontally scrollable. |
| Mobile fitness | 2 | NavBar has a working mobile hamburger and collapsible `MobileNavSection` — well done. The `AppShell` sidebar drawer is properly gated and dismissible. However: (1) the invoice detail 50/50 hero collapses to single-column (`grid-cols-1 lg:grid-cols-2`) which is correct, but the allocations editor table has no horizontal scroll on small viewports — three native inputs (`select`, `input`, `input[type=number]`) side-by-side will clip at 375px; (2) all filter bars on list pages use `flex-row` wrapping with fixed `md:w-*` widths — below the breakpoint these stack but their touch height is only `py-2.5` (40px), borderline for the 44px minimum; (3) the 14-value status toggle grid in `/invoices` advanced filters wraps into an unreadable pile on 375px; (4) the queue keyboard shortcuts (j/k/a/d) are desktop-only and there is no touch-equivalent fast-path for PM approval on phones. |
| Micro-interactions | 3 | The disabled state was fixed globally (commit d134d11) and the allocations editor scoped it with styled-jsx for specificity parity. `NwButton` has a clean loading spinner with `loading` prop. The upload flow has a multi-step progress indicator with elapsed-time warning. Hover lift on interactive cards via `.card-hover`. Weaknesses: (1) the mobile drawer uses `animate-slide-in-left` but this class is not defined in `globals.css` — it will silently no-op; (2) action buttons on the invoice detail (Approve / Partial / Hold / Deny) have no hover feedback beyond the NwButton primitive — no active/press state; (3) the "Quick Approve" inline confirm has no dismiss affordance visible until the user looks carefully at the card; (4) no optimistic update on batch approve in the queue — cards persist until a full re-fetch completes. |

---

## Findings

### CRITICAL

#### U-1: Six broken nav links serve 404 on every Financial dropdown hit

- **Location:** `src/components/nav-bar.tsx:93–104` + `src/components/nav/nav-dropdown.tsx`
- **Flow affected:** Every role's primary navigation (Financial dropdown)
- **Finding:** `buildFinancialItems()` hardcodes `/payments`, `/aging`, `/lien-releases`, `/change-orders`, `/purchase-orders` — none of these paths have a `page.tsx`. The real pages live at `/invoices/payments`, `/financials/aging-report`, `/invoices/liens`, and `/change-orders` (only a detail route exists, no list). The `/purchase-orders` page was deleted per the surface audit (2026-04-20). Clicking any of these routes 404s silently.
- **Impact:** Accounting and admin users cannot reach Payments, Liens, Aging, Change Orders, or Purchase Orders from the nav. These are Phase 1 core workflows.
- **Suggested fix:** Update `buildFinancialItems()` to the real canonical paths: `/invoices/payments`, `/financials/aging-report`, `/invoices/liens`, and remove the Change Orders / Purchase Orders entries (per-job access only). Add `/settings/integrations` fix to `buildAdminItems()` similarly (or remove the entry).

---

#### U-2: Invoice list and payment tracking use `window.location.href` on `<tr onClick>` — broken semantics

- **Location:** `src/app/invoices/page.tsx:586–591` and `src/app/invoices/payments/page.tsx:472`
- **Flow affected:** Invoice → detail navigation (most-used path in the product)
- **Finding:** Rows are `<tr>` elements with `onClick={() => window.location.href = …}`. There is no `<a>` or `<Link>` element wrapping the row or its primary cell. Also noted in `CONCERNS.md` (item "List rows use onClick instead of `<a href>`"). Additionally, line 590 contains dead code: `reviewable ? /invoices/${inv.id} : /invoices/${inv.id}` — both branches point to the same URL, suggesting a copy-paste remnant.
- **Impact:** Cannot open in new tab (Ctrl+click, Cmd+click). Screen readers announce no link destination. Keyboard-only users have no way to activate rows. Breaks automated testing and browser history navigation.
- **Suggested fix:** Replace `<tr onClick>` with a `<tr>` containing a `<td>` whose first cell wraps the vendor name in `<Link href=…>`. Or use a full-row anchor technique with `display: contents`.

---

### HIGH

#### U-3: Form filter controls lack `<label>` associations — screen reader and accessibility failure

- **Location:** `src/app/invoices/page.tsx:459–476`, `src/app/invoices/queue/page.tsx:800–836`, `src/app/jobs/[id]/budget/page.tsx` filter bar
- **Flow affected:** Invoice list filtering, PM queue filtering, budget filtering
- **Finding:** All filter `<select>` and `<input>` elements use placeholder text or nearby `<p>` text to convey their purpose but have no `<label for>` or `aria-label`. Examples: the Job, PM, Confidence, Status, and Amount Range dropdowns on both list pages have no programmatic label.
- **Impact:** Screen readers announce these as unlabeled inputs. Users relying on voice control ("click Job filter") cannot target them. Fails WCAG 2.1 SC 1.3.1 (Info and Relationships) and SC 3.3.2 (Labels or Instructions).
- **Suggested fix:** Add `aria-label` attributes to all filter controls. For visible labels like "From" / "To" date range inputs, use a `<label>` element with `htmlFor`.

---

#### U-4: Modals lack focus trapping and `aria-modal`

- **Location:** `src/components/admin/reason-modal.tsx:58–64`, `src/app/invoices/[id]/page.tsx:1850–1920` (approve confirm), `src/app/invoices/[id]/page.tsx:1924–2000` (over-budget modal)
- **Flow affected:** All admin platform actions (impersonate, extend trial), invoice approval flow
- **Finding:** The `ReasonModal` uses `fixed inset-0` and does focus the textarea via `setTimeout` on open, but there is no focus trap — tabbing past the textarea and buttons will move focus to the document behind the backdrop. The approve confirm and over-budget modals in `invoices/[id]` have no focus management at all. None set `aria-modal="true"` on the modal container. The `ImagePreview` zoom overlay (`invoice-file-preview.tsx:148`) has `role="dialog"` and `aria-modal="true"` — this is the correct pattern, but it's inconsistently applied.
- **Impact:** Keyboard users can tab into content behind the modal backdrop. Screen readers may not announce the modal context correctly.
- **Suggested fix:** Implement focus trap (trap to the modal container using a ref and `keydown` handler on Tab). Add `aria-modal="true"` and ensure `role="dialog"` is present. The `ImagePreview` overlay is the reference implementation — match it.

---

#### U-5: `animate-slide-in-left` class is undefined — mobile sidebar has no open animation

- **Location:** `src/components/app-shell.tsx:66`
- **Flow affected:** Mobile PM workflow — opening the job sidebar drawer
- **Finding:** The mobile sidebar drawer applies `animate-slide-in-left` but this animation keyframe is not defined in `globals.css` or the Tailwind config. On mobile the drawer will appear instantly with no transition, making the UI feel abrupt and potentially disorienting on fast taps.
- **Impact:** Every PM on a phone (primary mobile user) sees a jarring instant-appear sidebar. Minor but visible to the target audience.
- **Suggested fix:** Add the keyframe to `globals.css` (a simple `translateX(-100%) → translateX(0)` over 200ms) or switch to a CSS transition approach on a wrapper `div`.

---

#### U-6: Badge component has no `role` — status conveys meaning by color only

- **Location:** `src/components/nw/Badge.tsx`, all callers in queue cards, invoice rows
- **Flow affected:** Invoice approval status scanning for PM queue and all invoice lists
- **Finding:** `NwBadge` renders a `<span>` with border+text color conveying status. There is no `role="status"` and the design-system rule says "status pills are bordered, never filled." The color differentiation (success green, danger red, warning amber) is the only signal — there is no icon or text prefix indicating the category. WCAG 1.4.1 prohibits using color as the only differentiator. For example, "No Invoice #" (warning/amber) and "No Date" (danger/red) look identical in grayscale.
- **Impact:** Users with color blindness (deuteranopia/protanopia, ~8% of males) cannot distinguish warning vs danger badge states without reading the text. The text itself is in `11px` JetBrains Mono uppercase — readable, but the color is the primary scan-state signal.
- **Suggested fix:** Add a leading symbol (`!` for danger, `⚠` for warning — per brand's exception for these glyphs) or prefix text ("ERROR:" / "WARN:") within the badge text, or rely purely on text content and drop the color dependency for accessibility-critical status signals.

---

#### U-7: Invoice detail page has ~12 `useEffect` hooks with no AbortController on most of them

- **Location:** `src/app/invoices/[id]/page.tsx:465–540` (multiple consecutive useEffect blocks)
- **Flow affected:** Invoice review — main PM and QA flow
- **Finding:** The page correctly uses an `AbortController` for the primary `fetchInvoice` call (line 466), but subsequent effects for status history user-name resolution (line 476), draw info lookup (line 507), cost code lookup (line 525), and workflow settings (line 541) use `let cancelled = false` flag patterns inconsistently — the status history effect cleans up via `cancelled = true`, but the draw info and lookups lack cleanup. On fast navigation between invoices, stale results from a previous invoice can overwrite the current invoice's state. Per `CONCERNS.md` (BUG-H-2), this is a known race condition but not yet resolved.
- **Impact:** PM sees stale cost codes or status history from a previous invoice. Manifests on rapid back-navigation in the queue.
- **Suggested fix:** Consolidate all secondary lookups into a single `useEffect` keyed on `invoiceId` using a shared `AbortController`. Or refactor to a Server Component with parallel RSC fetches — this page's 2592-line size makes it the top candidate for decomposition.

---

### MEDIUM

#### U-8: `StatCard` component is defined twice with diverging styles

- **Location:** `src/app/invoices/page.tsx:99–107` and `src/app/dashboard/page.tsx` (inline)
- **Flow affected:** Invoice list statistics row, Dashboard metric cards
- **Finding:** Both pages define their own `StatCard` function locally. The invoices version uses `text-xl font-display font-medium` and `text-[var(--text-primary)]`. The dashboard uses `SkeletonStatCard` for the loading state but then renders its own card with different padding (`p-4 vs px-4 py-3`). The `NwCard` primitive exists and would unify both.
- **Impact:** Visual inconsistency between the dashboard and the invoice list — same conceptual element renders at slightly different sizes and weights. Adds maintenance burden when the design changes.
- **Suggested fix:** Extract a shared `StatCard` using `NwCard` into `src/components/nw/` or `src/components/`. Consolidate both callers.

---

#### U-9: Allocations editor loading state is an unstyled text node

- **Location:** `src/components/invoice-allocations-editor.tsx:121–123`
- **Flow affected:** Invoice detail → allocations section
- **Finding:** When `loading` is true, the component returns `<div className="text-xs text-[color:var(--text-secondary)] py-2">Loading allocations...</div>`. There is no skeleton, no spinner, and no `aria-busy` — just plain text. The surrounding card has a border but this loading state has no border, causing a layout jump when the allocations table appears.
- **Impact:** Layout shift on invoice detail load. Low visual fidelity compared to the rest of the page's loading patterns.
- **Suggested fix:** Render a `SkeletonBlock` or a 2-row `SkeletonTableRow` during loading, matching the eventual table dimensions.

---

#### U-10: Queue filter bar has no `aria-label` on the search input and the "More Filters" button has no `aria-expanded` on the invoice list page

- **Location:** `src/app/invoices/page.tsx:479–481`
- **Flow affected:** Invoice list filtering
- **Finding:** The "More Filters" toggle button on the invoice list page does not have `aria-expanded` or `aria-controls`. The queue page's version at line 841 also lacks these attributes. The search `<input>` elements throughout the app have `placeholder` text but no `aria-label`.
- **Impact:** Screen reader users cannot determine whether the filter panel is expanded. Search field is announced as unlabeled.
- **Suggested fix:** Add `aria-expanded={showMoreFilters}` to the toggle button. Add `aria-label="Search invoices"` (or context-appropriate label) to search inputs.

---

#### U-11: Operations nav dropdown is 100% disabled placeholders — occupies top-level slot for nothing

- **Location:** `src/components/nav-bar.tsx:107–112` (`buildOperationsItems`)
- **Flow affected:** Navigation — all authenticated users with pm/admin/owner role
- **Finding:** The Operations dropdown renders three items all with `disabled: true, soon: true`. Every user sees this top-level entry but clicking it shows only "Coming Soon" entries. Per `product-surface-audit.md`, this is the recommended removal. The `/operations` page itself is not linked from this dropdown.
- **Impact:** Wasted top-level nav real estate. Misleads PMs (the primary mobile user) into thinking there is scheduling/daily-log functionality.
- **Suggested fix:** Remove the Operations entry from `buildOperationsItems` and the corresponding `{show.operations && ...}` block. Re-add when a real Operations page ships.

---

#### U-12: `/admin` redirects to `/settings/company` instead of `/admin/platform`

- **Location:** `src/app/admin/page.tsx`
- **Flow affected:** Platform admin — staff muscle-memory navigation
- **Finding:** Platform admins (Jake, Andrew) who navigate to `/admin` expect the platform tools. Instead they land at the org settings page (`/settings/company`). This was called out in `product-surface-audit.md` but remains unfixed. The redirect target is surprising and could cause a staff member to inadvertently edit org settings instead of using platform tools.
- **Impact:** Disorienting for platform admins. Small but regular friction on an admin flow.
- **Suggested fix:** Change the redirect in `src/app/admin/page.tsx` to point to `/admin/platform`.

---

#### U-13: Invoice detail approve confirm modal amount is colored with `nw-warn` (amber) even for normal invoices

- **Location:** `src/app/invoices/[id]/page.tsx:1876`
- **Flow affected:** Invoice approval — PM review
- **Finding:** In the approve confirmation modal, the amount field is rendered with `text-[color:var(--nw-warn)]` unconditionally (except for credit memos which use stone-blue). A normal positive invoice amount displays in amber/warning color even when there is nothing problematic about the invoice. The `NwMoney` component supports a `"emphasized"` variant that renders in `--text-primary` — this is the appropriate default.
- **Impact:** Visual confusion — the PM sees the invoice amount flagged in warning yellow on every approval, even for routine, high-confidence invoices. Desensitizes users to warning colors.
- **Suggested fix:** Change the amount span's color to `text-[color:var(--text-primary)]` (or use `<NwMoney variant="emphasized">`) unless the invoice is genuinely flagged (over-budget, missing fields, etc.).

---

#### U-14: Mobile — allocations editor table has no horizontal scroll wrapper

- **Location:** `src/components/invoice-allocations-editor.tsx:159–245`
- **Flow affected:** Invoice detail → allocations on mobile
- **Finding:** The allocations editor renders a `<table>` with three input columns (`select`, `input`, `input[number]`) side-by-side. On a 375px viewport, this table will overflow its container with no horizontal scroll because there is no `overflow-x-auto` wrapper. The inputs are full-width (`width: 100%` in styled-jsx `.input`), which collapses them to very narrow widths rather than scrolling.
- **Impact:** On phones the allocations section becomes unusable — inputs are too narrow to read or interact with. Accounting users reviewing allocations on a phone cannot effectively use this feature.
- **Suggested fix:** Wrap the `<table>` in `<div className="overflow-x-auto">` and set minimum column widths (`min-w-[140px]`, `min-w-[120px]`, `min-w-[80px]`).

---

#### U-15: Draw wizard step 3 G703 table has no scroll on narrow viewports

- **Location:** `src/app/draws/new/page.tsx` (step 3 line items table)
- **Flow affected:** Draw creation — G703 preview
- **Finding:** The G703 line items table in the draw wizard has 6+ columns (Description, Scheduled Value, Previous Applications, This Period, Total to Date, % Complete, Balance to Finish). There is no `overflow-x-auto` wrapper. On a laptop at 1280px with the sidebar present (220px + content padding) the available width is ~980px which can accommodate the table, but on smaller screens (1024px MacBook) columns will be clipped.
- **Impact:** Diane and Andrew reviewing draws on non-wide monitors will see truncated column data.
- **Suggested fix:** Wrap the table in `<div className="overflow-x-auto -mx-4 px-4">` in the step 3 section.

---

#### U-16: Empty state in `filtered.length === 0` on PM queue lacks EmptyState component treatment

- **Location:** `src/app/invoices/queue/page.tsx:940–950`
- **Flow affected:** PM queue — filtered-to-empty state
- **Finding:** When all queue invoices are filtered out, the page renders a minimal inline `<div className="text-center py-16 animate-fade-up">` with plain text and a small `Clear filters` link. The rest of the app uses the `EmptyState` component with an icon, title, message, and primary/secondary action buttons. The `EmptyState` component even has an `EmptyIcons.Inbox` preset.
- **Impact:** Inconsistent empty state treatment. The queue is one of the most important pages for PMs — a polished empty state ("Your queue is clear" or "No invoices match your filters") improves perceived quality.
- **Suggested fix:** Replace the inline div with `<EmptyState icon={<EmptyIcons.Check />} title="Queue is clear" message="No invoices match your current filters." primaryAction={{ label: "Clear filters", onClick: clearAllFilters }} />`.

---

#### U-17: `ReasonModal` textarea focus uses `setTimeout` — fragile pattern

- **Location:** `src/components/admin/reason-modal.tsx:42`
- **Flow affected:** All platform admin actions (impersonate, extend trial, mark churned)
- **Finding:** The modal uses `setTimeout(() => inputRef.current?.focus(), 50)` to focus the textarea. This is a fragile DOM-race workaround. If the 50ms paint time is exceeded on a slow device (e.g. an older iPad accessing the admin panel), the focus does not move. The `ImagePreview` fullscreen overlay and `InvoiceFilePreview`'s DOCX expanded modal have the same pattern.
- **Impact:** Minor — but keyboard users launching admin actions on slower devices may not get auto-focus, requiring an extra Tab press.
- **Suggested fix:** Use `useEffect` with `open` as dependency and `requestAnimationFrame` or `flushSync` instead of a raw timeout. Alternatively, use the `dialog` HTML element with `autofocus` on the first interactive field.

---

#### U-18: Dashboard `load()` function doesn't guard against unmount — can call `setState` after unmount

- **Location:** `src/app/dashboard/page.tsx:83–116`
- **Flow affected:** Dashboard — first paint
- **Finding:** The `load` async function calls `supabase.auth.getUser()`, then fetches `/api/dashboard`, then calls multiple `setState` functions. There is no AbortController or mounted-flag guard. If the user navigates away before the fetch completes, React will log a "can't perform state update on unmounted component" warning. This is a category of the same BUG-H-2 issue documented in `CONCERNS.md`.
- **Impact:** Runtime warnings in development; potential state corruption or hydration mismatch in production.
- **Suggested fix:** Add `let mounted = true` guard and return cleanup: `useEffect(() => { let mounted = true; load(mounted); return () => { mounted = false; }; }, [])`.

---

#### U-19: Invoice list row has dead code — both conditional branches of the navigation check navigate to the same URL

- **Location:** `src/app/invoices/page.tsx:589–591`
- **Flow affected:** Invoice list → detail navigation
- **Finding:** `const reviewable = ["pm_review", "ai_processed"].includes(inv.status); window.location.href = reviewable ? /invoices/${inv.id} : /invoices/${inv.id};` — both branches navigate to the same path. The original intent was likely to differentiate between the PM review page and a read-only view, but the dead code now means no routing distinction exists.
- **Impact:** Minor; the navigation works but the intent is obscured and the `reviewable` variable is computed for nothing.
- **Suggested fix:** Either remove the conditional and use a single `Link href`, or restore the intended routing (e.g., PM queue items route to `/invoices/queue` or the detail page with a `?from=queue` param).

---

### LOW

#### U-20: `ImpersonateButton` uses raw `<button>` styles instead of `NwButton`

- **Location:** `src/components/admin/impersonate-button.tsx:41–58`
- **Flow affected:** Platform admin — impersonation
- **Finding:** The button renders with manually inline `style={{ borderColor: "var(--nw-stone-blue)", color: "var(--nw-stone-blue)", background: "rgba(91, 134, 153, 0.06)" }}`. This is effectively the `NwButton` secondary variant with stone-blue color. The `NwButton` primitive's focus ring (`focus-visible:ring-2 focus-visible:ring-nw-stone-blue/40`) is absent here.
- **Impact:** Focus state is invisible on this button. Minor polish inconsistency.
- **Suggested fix:** Replace with `<NwButton variant="secondary" size={size}>Impersonate</NwButton>` with appropriate color overrides.

---

#### U-21: `ReasonModal` cancel and confirm buttons use raw `<button>` — no focus ring

- **Location:** `src/components/admin/reason-modal.tsx:134–163`
- **Flow affected:** All platform admin actions
- **Finding:** Cancel and confirm use raw `<button>` with inline style. They lack the `focus-visible:ring` pattern from `NwButton`. Keyboard users who Tab into the modal see no focus outline on these action buttons (since there is no default browser focus styling with `focus:outline-none` being applied globally via Tailwind base reset).
- **Impact:** Keyboard accessibility gap on the most sensitive admin UI surface.
- **Suggested fix:** Use `NwButton` or add `focus-visible:ring-2 focus-visible:ring-[var(--nw-stone-blue)]/40` manually.

---

#### U-22: Dashboard `load()` calls three sequential async operations before rendering — causes perceived slowness

- **Location:** `src/app/dashboard/page.tsx:86–116`
- **Flow affected:** Dashboard first paint
- **Finding:** `load()` does: (1) `supabase.auth.getUser()`, then awaits (2) `Promise.all([profile + membership])`, then (3) `fetch("/api/dashboard")`. Steps 1 and 2 happen in series before the API fetch starts. The auth user should already be available from the session; combining it with the API fetch would eliminate one serial round trip. Per `CONCERNS.md`, this contributes to the ~3.3s full page time.
- **Impact:** Users see "Loading…" skeleton for the full 3.3s instead of ~2s.
- **Suggested fix:** Parallel-fire the Supabase auth call and the `/api/dashboard` fetch via `Promise.all`. The dashboard API endpoint already handles auth server-side; the client-side role fetch is secondary and can render after the KPI data.

---

#### U-23: `NwBadge` has no `role="status"` or semantic wrapper — status changes are not announced

- **Location:** `src/components/nw/Badge.tsx:57–86`
- **Flow affected:** Invoice status changes, PM queue cards
- **Finding:** Status badges render as `<span>` elements. When a status changes client-side (after approve/deny/hold), the badge re-renders but there is no `aria-live` region or `role="status"` to announce the change to screen readers.
- **Impact:** Screen reader users approving invoices receive no confirmation that the status changed.
- **Suggested fix:** For status-change scenarios, the parent component should use an `aria-live="polite"` region. `NwBadge` itself does not need `role="status"` (it's not always announcing a live change), but callers should wrap the badge or adjacent text in a `<span aria-live="polite">` when the status can change.

---

#### U-24: Multiple pages use `font-mono` var which may differ from `font-jetbrains-mono`

- **Location:** `src/components/nav-bar.tsx:79` (`fontFamily: "var(--font-mono)"`)
- **Flow affected:** Nav bar role badge
- **Finding:** The nav bar `RoleBadge` uses `var(--font-mono)` while all `nw/` primitives use `var(--font-jetbrains-mono)`. If these CSS variables point to different fonts (or if `--font-mono` falls back to the system mono stack), the role badge will render in a different typeface than the rest of the Nightwork monospace typography.
- **Impact:** Minor typographic inconsistency. Low chance of visible difference if both resolve to JetBrains Mono via Next.js font loading.
- **Suggested fix:** Audit `colors_and_type.css` to confirm `--font-mono` and `--font-jetbrains-mono` resolve to the same font stack. If they do, document it; if not, normalize to a single variable.

---

## Flow-level narrative

### Invoice upload → draw pipeline

**Upload (`/invoices/upload` → `InvoiceUploadContent`):**
The multi-step progress indicator (uploading → analyzing → extracting → matching → complete) is clean and shows elapsed time after 15 seconds. The `FilePreview` dispatches on MIME type correctly. File acceptance is handled at both the MIME and extension level. No issues at this stage.

**Parse result → invoice detail (`/invoices/[id]`):**
The 50/50 hero (original document left, parsed data right) is the strongest surface in the app and matches the Slate Invoice Detail reference screen. The `InvoiceDetailsPanel` correctly uses `DataRow` + `Eyebrow` primitives. The `InvoiceAllocationsEditor` follows suit. 

Friction points on this page:
- The page has ~12 useEffect hooks, and cleanup is incomplete on several (U-7). Race conditions are possible.
- The approve confirm modal colors the amount in warning amber for all invoices (U-13).
- The over-budget modal is well-designed and graduated (orange warning vs red block), but the `Convert to Change Order` button navigates away without warning — the user's current unsaved edits (notes, cost code changes) will be lost.
- "Push to QuickBooks" (line 1574) fires `toast.info("QuickBooks integration coming soon")` — this is a stub action on a button labeled as a primary CTA for QA-approved invoices. The button should not be visible until the integration exists, or should be clearly labeled as "Coming Soon" rather than a primary action.

**PM Queue (`/invoices/queue`):**
This is the most important page for the primary mobile user (PMs in the field). The keyboard shortcut system (j/k/a/d) is well-implemented. `MissingDataBadges` surface the right signals. The Quick Approve inline confirm is smart.

Mobile concerns: no touch-equivalent for keyboard approvals, filter bar has no `aria-labels`, and the batch-approve mechanism shows no optimistic feedback while processing.

**QA Review (`/invoices/[id]/qa`):**
The page exists but was listed as potentially stale (>60 days since edit per the surface audit). The flow has been merged into `/invoices/[id]` in commit `0190ee0` (Phase 3b QA ports). The separate `/invoices/[id]/qa` route may now be a duplicate path — confirm whether it's still reachable and distinct or whether it can be deprecated.

**Push to QB:** Stub only. Not blocking but visible on the UI.

---

### Budget dashboard (`/jobs/[id]/budget`)

The budget grid with drill-down slide-out is the second most load-bearing surface. The slide-out panel (`SlideOutPanel` + `BudgetDrillDown`) correctly uses `portal`-style rendering. Category collapse/expand persists in localStorage.

Friction points:
- The `add line` inline form (`addingLineFor` state) has no empty state or reset affordance beyond `setAddingLineFor(null)` — if the add fails, `addLineError` renders but there is no "cancel" button visible in the JSX at the offset scanned. Confirm this is complete.
- The `viewMode` toggle ("detail" vs "compare") is stored in localStorage but there is no visual indication of which mode is active beyond the content changing — no active-state on the toggle button.
- Filter label "All Lines / Over Budget / Under Committed / Has Activity / Zero Budget" lives in a plain `<select>` — consistent with other pages, acceptable.

---

### Platform admin (`/admin/platform`)

The platform overview page uses Server Components with parallel Supabase fetches — good. It uses `NwCard`, `NwEyebrow`, `NwBadge` consistently. The impersonation banner is well-designed (red stripe, countdown timer, "every action is logged" copy).

Friction points:
- `ImpersonateButton` does not use `NwButton` — missing focus ring (U-20).
- `ReasonModal` action buttons lack focus states (U-21).
- The `/admin` redirect goes to `/settings/company` instead of `/admin/platform` (U-12) — a trap for staff who type the URL directly.
- The platform admin sidebar (`src/components/admin/platform-sidebar.tsx`) is a separate sidebar from the `AdminSidebar` used in settings — consistent with the two distinct areas, but the visual treatment should be confirmed to match.

---

## Positive observations

1. **`nw/` primitive library is clean and complete.** `Button`, `Badge`, `Card`, `Money`, `Eyebrow`, `DataRow`, `StatusDot` all follow the Slate design rules (square corners, JetBrains Mono for money/eyebrows/badges, CSS var tokens, theme awareness). This is the strongest part of the codebase.

2. **Loading states are present on all major list pages.** `SkeletonStatCard`, `SkeletonList`, `SkeletonBlock`, and `SkeletonCard` are defined and used consistently. The dashboard and invoice list show proper skeleton grids before data lands.

3. **Empty states are handled by a reusable `EmptyState` component** with icon, title, message, and up to two action buttons. The component has a rich preset icon library. It's used correctly on the queue and budget pages.

4. **The invoice detail 50/50 hero layout matches the Slate reference design.** The `lg:grid-cols-2` collapse pattern, the 1px hairline grid gap, the `InvoiceDetailsPanel` + `InvoiceAllocationsEditor` stacking — all correct. The "QA APPROVED" rotated stamp overlay is a nice detail.

5. **Nav keyboard accessibility is well above average.** `NavDropdown` implements full arrow-key navigation, Home/End, Escape, and hover-vs-click detection. `MobileNavSection` has `aria-expanded`. This is the strongest accessibility surface in the codebase.

6. **Disabled state parity.** The global `globals.css` rule for `input:disabled, select:disabled, textarea:disabled` plus the `InvoiceAllocationsEditor` styled-jsx rule correctly surfaces the read-only state for locked invoices. Commit d134d11 addressed the prior invisible-disabled bug.

7. **The impersonation banner is a textbook implementation.** Server Component, reads the cookie at render time (no flash), red stripe, org name, countdown timer, and a clear "End session" action. Compliant with the CLAUDE.md security spec.
