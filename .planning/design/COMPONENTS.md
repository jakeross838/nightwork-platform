# COMPONENTS.md — Nightwork component inventory

**Status:** v1 DRAFT (Stage 1.5a, T13 + T13.1) — produced 2026-04-30.
**Phase:** stage-1.5a-design-system-documents
**Scope:** Single source of truth for every component primitive available to Nightwork-authored UI — its source, variants, props, token bindings, states, accessibility shape, mobile behavior, and anti-patterns. Subordinate documents (PATTERNS.md, .impeccable.md) and the components playground (T20a-T20f) reference COMPONENTS.md as authoritative.
**SPEC anchors:** A12, A12.1, A12.2, A12.3, A13, B2, C1, C2, C8.
**Authoritative inputs:** SYSTEM.md (token catalog), CONTRAST-MATRIX.md (a11y verification), `audit-notes/T05-custom-components.md` (existing Nw* codification), `audit-notes/T01-css-variables.md` (token enumeration), `audit-notes/T04-skills-and-template.md` (skill linkage).

**Document length target:** 800-1200 lines structured into 13 sections + cross-references.

---

## 0. Purpose + cross-references

COMPONENTS.md is the contract that every Nightwork UI builder reads before writing a component or composing a page. It exists to:

1. **Lock the component catalog.** Every primitive in scope at Stage 1.5a is enumerated here with its source (custom Nw*, shadcn-derived, TanStack, Base UI, Vaul, react-day-picker), variants, required props, and token bindings.
2. **Enforce the tenant-blind rule (A12.1).** Primitives in `src/components/ui/*.tsx` MUST NOT accept tenant-identifying props (no `org_id`, no `membership`, no `vendor_id`). Tenant-aware composition lives in `src/components/<domain>/` only.
3. **Lock the icon library boundary (A12.2).** Heroicons is the only icon library Nightwork-authored UI imports directly. Lucide is a transitive shadcn dep, scoped to `src/components/ui/*.tsx` only.
4. **Document brand customization (A12.3).** Restate which components consume `--brand-accent` / `--brand-logo` and how the override flows through.
5. **Map planned components to the install reality (A13).** DataGrid → TanStack v8. Combobox → cmdk *(via @base-ui/react in current install)*. DatePicker → react-day-picker. Drawer → Vaul. Tooltip + Popover + HoverCard → @base-ui/react@1.4.1. NO @radix-ui/* installed.

**Cross-references:**

| Source | Where |
|---|---|
| Token catalog | `.planning/design/SYSTEM.md` (854 lines, 14 sections) |
| WCAG matrix | `.planning/design/CONTRAST-MATRIX.md` |
| Existing Nw* codification | `.planning/phases/stage-1.5a-design-system-documents/audit-notes/T05-custom-components.md` |
| CSS variable enumeration | `.planning/phases/stage-1.5a-design-system-documents/audit-notes/T01-css-variables.md` |
| Tailwind config audit | `.planning/phases/stage-1.5a-design-system-documents/audit-notes/T02-tailwind-config.md` |
| Contrast ratios source | `.planning/phases/stage-1.5a-design-system-documents/audit-notes/T03-contrast-ratios.md` |
| Skill audit | `.planning/phases/stage-1.5a-design-system-documents/audit-notes/T04-skills-and-template.md` |
| shadcn-v3 codemod | `scripts/shadcn-v3-codemod.ts` (12 rule families) |
| Codemod test outcomes | `audit-notes/T08-codemod-test.md` |
| SPEC criteria | `.planning/phases/stage-1.5a-design-system-documents/SPEC.md` (v2.1, 52 criteria) |
| PLAN tasks | `.planning/phases/stage-1.5a-design-system-documents/PLAN.md` (v2, 47 tasks) |

---

## 1. Inventory by category — Inputs (per SPEC A12, B2)

Inputs gather user data. 6 entries: Button, Input, Select, Combobox, DatePicker, Form. Plus FileDropzone (Nightwork-authored implicit extension per A12).

### 1.1 Button

| Field | Value |
|---|---|
| **Source** | shadcn (`src/components/ui/button.tsx`, codemod-rewritten to v3) — wraps `@base-ui/react/button` |
| **Variants** | `default` / `outline` / `secondary` / `ghost` / `destructive` / `link` |
| **Sizes** | `default` (h-8) / `xs` (h-6) / `sm` (h-7) / `lg` (h-9) / `icon` (size-8) / `icon-xs` / `icon-sm` / `icon-lg` |
| **Required props** | `children: ReactNode`. All `ButtonPrimitive.Props` pass through (`onClick`, `disabled`, `aria-*`). `variant` + `size` optional with defaults. |
| **Token bindings** | `--primary` (alias of `--nw-stone-blue`), `--primary-foreground` (`--nw-white-sand`), `--secondary` (`--bg-subtle`), `--muted`, `--destructive` (`--nw-danger`), `--border` (`--border-default`), `--ring` (`--nw-stone-blue`), `--radius: 0` (square per SYSTEM §6) |
| **States** | default · hover · focus-visible · active · disabled · loading (parent-controlled) · aria-invalid (red ring) · aria-expanded (popover trigger) |
| **A11y** | Native `<button>` via Base UI; `focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50` per SYSTEM §12b; `disabled:pointer-events-none disabled:opacity-50`; `aria-invalid` styling for form-error pairing |
| **Mobile** | `default` size (h-8 = 32px) is BELOW WCAG 2.5.5 44×44px touch-target minimum. Use `lg` (h-9 = 36px) on mobile — STILL BELOW 44px. **A11y gap:** shadcn button.tsx does not have a 44px or 56px size variant out of box. Either compose with NwButton (which has `lg = h-[44px]`), OR add a 44/56 size in T20a follow-up |
| **Anti-patterns** | (a) Do not pass `org_id` / `membership` / `vendor_id` props — A12.1 violation, hook C8 rejects. (b) Do not use shadcn `default` size on a high-stakes mobile action — fails 56×56 per SYSTEM §11. (c) Do not add `rounded-md/lg/xl` — square per SYSTEM §6, hook T10b rejects. (d) Do not hardcode hex (`bg-[#5B8699]`); use tokens (`bg-primary` or `bg-nw-stone-blue`). |

#### Boundary with NwButton (custom)

The Nightwork brand-aware button is `src/components/nw/Button.tsx` (see §3.1). When to use which:

- **Use `NwButton`** for any Nightwork-authored UI in `src/app/<route>/` or `src/components/<domain>/`. It applies the JetBrains Mono uppercase typography, `--brand-accent` consumption, 44px touch target on `lg`, and the four Nightwork variants (`primary` / `secondary` / `ghost` / `danger`).
- **Use shadcn `Button`** ONLY inside other shadcn primitives (e.g., `Combobox`'s clear button uses `InputGroupButton` which extends shadcn `Button`) — A12.1 keeps shadcn primitives composable without coupling to Nightwork brand. The `/design-system/components/inputs` playground page renders both for visual reference.

Per D1=C hybrid, both exist. Migration is OUT OF SCOPE for Stage 1.5a (per SPEC §4).

### 1.2 Input

| Field | Value |
|---|---|
| **Source** | shadcn (`src/components/ui/input.tsx`) — wraps `@base-ui/react/input` |
| **Variants** | (single — text input. Variants are expressed via `type` prop: `text` / `email` / `password` / `number` / `tel` / `url`.) |
| **Sizes** | (single — h-8 = 32px) |
| **Required props** | `React.ComponentProps<"input">` pass through. Optional: `className`, `type`. |
| **Token bindings** | `--input` (`--border-default`), `--background` (`--bg-page`), `--foreground` (`--text-primary`), `--muted-foreground` (`--text-secondary`) for placeholder, `--ring`, `--destructive` for `aria-invalid` |
| **States** | default · hover · focus-visible · disabled · aria-invalid (red ring) · readonly (inherits default styling) |
| **A11y** | Native `<input>` via Base UI; `focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50`; `disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50`; placeholder uses `placeholder:text-muted-foreground` (passes AA-large at 3:1 — see CONTRAST-MATRIX.md) |
| **Mobile** | h-8 = 32px is BELOW WCAG 2.5.5 44×44px touch-target minimum. **Composition with NwFormField (planned, T20a)** is expected to bump to 44px on `nw-phone` via density mapping per SYSTEM §10c. Until NwFormField exists, hand-bump on mobile via `nw-phone:h-11` arbitrary variant. |
| **Anti-patterns** | (a) Do not nest Input inside Button (use InputGroup composition). (b) Do not hardcode placeholder color (`placeholder:text-gray-400`); use the token (`placeholder:text-muted-foreground`). (c) Do not pass `org_id` — A12.1. (d) Do not reach into the value via DOM — use React state. |

### 1.3 Select

| Field | Value |
|---|---|
| **Source** | **Not yet installed.** Planned shadcn primitive; will run through `scripts/shadcn-v3-codemod.ts` on add (per T20a sub-task). The shadcn 4.x registry default is `@base-ui/react/select` — same library family as Combobox / Tooltip / Popover / HoverCard. |
| **Variants** | deferred to T20a (when first installed). Expected to mirror Combobox's variant surface (filtering vs not is the key differentiator — Combobox has filter, Select does not). |
| **Sizes** | deferred to T20a — expected to mirror Input + Button (h-8 default, h-9 lg). |
| **Required props** | deferred to T20a. Expected: `value`, `onValueChange`, `options` (or compositional `<SelectTrigger>` + `<SelectContent>` + `<SelectItem>` per shadcn convention). |
| **Token bindings** | deferred to T20a. Expected: `--popover` for content, `--popover-foreground` for items, `--accent` for hover, `--ring` for focus. |
| **States** | default · hover · focus-visible · open · disabled · selected (per item) |
| **A11y** | Base UI Select primitive supports keyboard nav (arrow keys, Home/End, type-to-select), `aria-expanded`, `aria-haspopup="listbox"`, `aria-activedescendant` per ARIA listbox spec. |
| **Mobile** | On `nw-phone` Base UI Select renders as native `<select>` for OS-aligned keyboard experience (consistent with system-controls UX). On `nw-tablet` and `nw-desktop` renders as custom popover-based listbox. |
| **Anti-patterns** | (a) Do not use `<select>` for >7 options where filtering is needed — use Combobox (§1.4). (b) Do not pass `org_id` — A12.1. (c) Do not nest Select inside Combobox — they overlap; pick one. |

**Install path:** T20a runs `npx shadcn add select`, then runs the codemod (`scripts/shadcn-v3-codemod.ts`) before commit. See §7 dependency reality.

### 1.4 Combobox

| Field | Value |
|---|---|
| **Source** | shadcn (`src/components/ui/combobox.tsx`, codemod-rewritten to v3) — wraps `@base-ui/react/combobox`. NOTE: SPEC A13 references `cmdk` for Combobox; install reality uses `@base-ui/react` Combobox primitive (consistent with shadcn 4.x registry default). `cmdk` is not currently installed. T20a may add cmdk if Base UI Combobox doesn't satisfy filtering UX — flagged for review. |
| **Variants** | `inline` (default — uses InputGroup composition) |
| **Sizes** | inherit Input / Button sizes (`h-8` default) |
| **Required props** | `value`, `onValueChange`, `items` array (or compositional children: `<ComboboxInput>` + `<ComboboxContent>` + `<ComboboxItem>`). Optional: `showTrigger` (chevron), `showClear` (X icon), `disabled`. |
| **Token bindings** | `--popover`, `--popover-foreground`, `--accent` (hover/active item), `--muted-foreground` (placeholder), `--ring`, `--border-default` (input border + popup ring), `--radius: 0` (square) |
| **States** | default · hover · focus-visible · open · loading (filtering async) · empty (no results) · disabled · single-selected · multi-selected (if multi mode) |
| **A11y** | Base UI Combobox supports `aria-expanded`, `aria-controls`, `aria-activedescendant`, `aria-autocomplete="list"`. Keyboard: arrow up/down, Enter to select, Esc to close, type-to-filter. `Tab` moves focus out of popup. |
| **Mobile** | Popup overlays input; max height + scroll inside. Touch target on items needs ≥44px row height — use `density="comfortable"` from SYSTEM §10. |
| **Anti-patterns** | (a) Do not pass `vendor_id` (A12.1) — use a generic `value` prop that the domain wrapper resolves. (b) Do not import `lucide-react` icons in domain code; the chevron + clear icons inside `combobox.tsx` are scoped exception (A12.2 Icon Library Boundary). (c) Do not use Combobox for <5 options — use Select. |

### 1.5 DatePicker

| Field | Value |
|---|---|
| **Source** | shadcn (`src/components/ui/calendar.tsx`, codemod-rewritten to v3) — wraps `react-day-picker@^9.14.0`. The shadcn `Calendar` is a popover-friendly DayPicker; a "DatePicker" is the composition `<Popover><PopoverTrigger><Button>...</Button></PopoverTrigger><PopoverContent><Calendar /></PopoverContent></Popover>` per shadcn registry pattern. T20a sub-task wires a `<DatePicker>` wrapper component if needed. |
| **Variants** | Calendar `mode`: `single` / `multiple` / `range`. Calendar `captionLayout`: `label` (default) / `dropdown` / `dropdown-months` / `dropdown-years`. |
| **Sizes** | (Calendar grid is its own size; trigger button uses standard Button sizes) |
| **Required props** | `mode`, `selected`, `onSelect`. Optional: `disabled` (date matcher), `fromDate`, `toDate`, `defaultMonth`, `numberOfMonths`, `locale`, `showOutsideDays`. |
| **Token bindings** | `--background`, `--foreground`, `--accent` (selected day), `--accent-foreground`, `--muted-foreground` (outside days, weekday labels), `--ring` (focus), `--primary` (today indicator) |
| **States** | default day · today (dot indicator) · selected · range start/end/middle · hovered (range) · disabled (matcher) · outside-month · weekend · focus-visible |
| **A11y** | DayPicker emits ARIA grid pattern: `role="grid"`, `aria-label="<Month Year>"`, `role="gridcell"` per day. Keyboard: arrow keys move 1 day, PageUp/PageDown 1 month, Home/End start/end of week, Enter to select. |
| **Mobile** | Touch target per cell: aim ≥44px on `nw-phone` via `[--cell-size:44px]` arbitrary variant. Default `--cell-size:1.75rem` (28px) is BELOW WCAG. Density mapping per SYSTEM §10. |
| **Anti-patterns** | (a) Do not roll your own calendar — use this Calendar + Popover composition. (b) Do not store dates as strings — use `Date` objects, format in render. (c) Do not pass `org_id` to a DatePicker — A12.1. (d) Do not use this for date-time pairs without explicit T20a sub-task — DateTime is deferred. |

### 1.6 Form

| Field | Value |
|---|---|
| **Source** | **Not yet installed as a unified primitive.** Today, forms compose Input + Label + helper text by hand. Planned shadcn `Form` primitive wraps `react-hook-form` + Zod for type-safe validation; would install at T20a with codemod. |
| **Variants** | `vertical` (default, label-on-top) / `horizontal` (label-aligned-left, value-right) — mirrors NwDataRow layouts (§3.5). |
| **Sizes** | inherits Input + Button sizes |
| **Required props** | `<Form>` accepts a react-hook-form `useForm()` instance via `{...form}` spread. `<FormField>` requires `name`, `control`, `render`. `<FormLabel>` / `<FormControl>` / `<FormDescription>` / `<FormMessage>` are slot components. |
| **Token bindings** | `--text-primary` (label), `--text-secondary` (description), `--destructive` (error message + invalid border), `--ring` (focus on input), `--border-default` (input border), label uses `font-mono` + `--tracking-eyebrow` per SYSTEM §4 (or NwEyebrow §3.2) |
| **States** | default · invalid (red ring + error message visible) · valid · disabled · submitting (button loading state) · submitted-success · submitted-error |
| **A11y** | `<FormLabel htmlFor>` + `<FormControl id>` association; `<FormMessage role="alert">` for errors with `aria-live="polite"`; `<FormDescription>` linked via `aria-describedby`; `aria-invalid` toggled by validation state. |
| **Mobile** | Vertical orientation default at `nw-phone` (label stacks above input). Horizontal orientation collapses to vertical at `nw-phone` regardless of prop. |
| **Anti-patterns** | (a) Do not bypass FormField — uncontrolled Inputs scattered without form wrapping break validation feedback. (b) Do not use plain `<label>` — use FormLabel for the htmlFor wiring. (c) Do not display errors as toasts — toasts are for cross-page events; field errors render inline. (d) Do not pass `org_id` to Form / FormField — A12.1. |

### 1.7 FileDropzone

| Field | Value |
|---|---|
| **Source** | Nightwork-authored composition. NOT yet a single primitive — the existing pattern is `<input type="file" />` composed with custom drop-event handlers (see `src/components/invoice-import-content.tsx` for current pattern). T20a sub-task may codify into `<NwFileDropzone>` if pattern repeats sufficiently. |
| **Variants** | `single` (one file) / `multi` (many files) |
| **Sizes** | `compact` (h-32) / `comfortable` (h-48) per SYSTEM §10 |
| **Required props** | `accept` (MIME glob, e.g. `application/pdf,image/*`), `onFiles(files: FileList)`. Optional: `maxSize` (bytes), `maxCount`, `disabled`. |
| **Token bindings** | `--bg-card`, `--border-default` (default border-dashed), `--border-brand` (drag-active state), `--text-primary` (instructions), `--text-secondary` (helper text), `--nw-stone-blue` (icon stroke) |
| **States** | default · drag-over (border-brand + bg-subtle) · disabled · uploading (file rows show progress) · error (file rejected — invalid type, oversize) |
| **A11y** | Visible focusable button "Choose files" inside the dropzone; `aria-label="Drop files here or click to browse"`; rejected-file errors announced via `aria-live="polite"`. |
| **Mobile** | Drag-and-drop is desktop-only affordance; mobile shows a tappable button "Choose file" that opens the OS file picker. The dropzone container is itself a tap target ≥44px. |
| **Anti-patterns** | (a) Do not accept `image/*` without per-MIME validation — phones include `image/heic` which most parsers don't handle. (b) Do not bypass server-side virus / type validation — client validation is UX, not security. (c) Do not pass `org_id` — A12.1. (d) Do not store files in component state — pipe to upload immediately. |

---

## 2. Inventory by category — Surfaces (per SPEC A12, B2)

Surfaces hold content. 5 entries: Card, Modal (Dialog), Drawer, Sheet, Tabs. Card overlaps with NwCard (§3.4) — both exist per D1=C.

### 2.1 Card

| Field | Value |
|---|---|
| **Source** | **Not yet installed as shadcn primitive.** NwCard (§3.4) is the canonical Card today. Planned shadcn `Card` would install at T20a. NwCard satisfies the SPEC inventory requirement. |
| **Variants** | `default` (white-on-light, slate-deeper-on-dark) / `inverse` (always-dark island). See NwCard §3.4. |
| **Sizes** | padding tokens: `none` / `sm` (p-3) / `md` (p-5) / `lg` (p-6) |
| **Required props** | `children: ReactNode`. Optional: `variant`, `padding`. |
| **Token bindings** | `--bg-card`, `--text-primary`, `--border-default`, `--shadow-hover` (interactive variant only) |
| **States** | resting · hover (interactive Card lifts via `--shadow-hover`) · focus-visible (if Card is a button-card) · selected (if Card is a list item) |
| **A11y** | Plain `<div>`. Caller may apply `role="region"` + `aria-label` for landmarks, or `role="button"` + tabIndex for clickable cards. |
| **Mobile** | Padding `md`/`lg` collapses to `sm` at `nw-phone` (per density mapping SYSTEM §10). |
| **Anti-patterns** | (a) Do not use Card for short status banners — that's Banner (§3 Feedback). (b) Do not nest Card inside Card without explicit need — visual noise. (c) Do not pass `org_id` — A12.1. (d) Do not add `rounded-md/lg/xl` to a Card — square per SYSTEM §6. |

### 2.2 Modal (Dialog)

| Field | Value |
|---|---|
| **Source** | **Not yet installed as shadcn primitive.** Today: ad-hoc inline modals (e.g. `feedback-modal.tsx`). Planned shadcn `Dialog` wraps `@base-ui/react/dialog`; install at T20a. |
| **Variants** | `default` / `confirm` (specialized Modal — see Overlays §6.3) |
| **Sizes** | `sm` (max-w-sm), `md` (max-w-md, default), `lg` (max-w-lg), `xl` (max-w-xl), `full` (h-screen w-screen — used for invoice review on mobile). |
| **Required props** | `<Dialog open onOpenChange>` + compositional children: `<DialogTrigger>`, `<DialogContent>`, `<DialogTitle>`, `<DialogDescription>`, `<DialogClose>`. |
| **Token bindings** | `--popover` (content bg), `--popover-foreground`, `--border-default` (content ring), `--shadow-panel`, `--bg-inverse/0.5` (overlay), `--ring` (focus on content) |
| **States** | closed · opening (animate-in) · open · closing (animate-out) · disabled (rare — locked workflows) |
| **A11y** | Base UI Dialog primitive: `role="dialog"`, `aria-modal="true"`, `aria-labelledby` from DialogTitle, `aria-describedby` from DialogDescription. Focus trapped inside, Esc to close, focus returns to trigger on close. |
| **Mobile** | At `nw-phone`, sizes `md`/`lg`/`xl` upgrade to `full` (full-screen modal) — NOT a tiny modal centered on phone (anti-pattern per SYSTEM §13g). |
| **Anti-patterns** | (a) Do not use Dialog for confirm-only ("are you sure?") — use Confirm (§6.3) which is a Dialog variant with prescribed buttons. (b) Do not stack Dialogs — a Dialog inside a Dialog is a UX bug. (c) Do not omit `<DialogTitle>` — screen readers need it for orientation. (d) Do not pass `org_id` — A12.1. |

### 2.3 Drawer

| Field | Value |
|---|---|
| **Source** | shadcn (`src/components/ui/drawer.tsx`, codemod-rewritten to v3) — wraps `vaul@^1.1.2`. |
| **Variants** | direction: `bottom` (default — phone-up swipeable) / `left` / `right` / `top`. |
| **Sizes** | direction-dependent: `bottom`/`top` use `max-h-[80vh]`; `left`/`right` use `w-3/4` mobile, `sm:max-w-sm` desktop. |
| **Required props** | `<Drawer open onOpenChange>` + compositional children: `<DrawerTrigger>`, `<DrawerContent>`, `<DrawerHeader>`, `<DrawerTitle>`, `<DrawerDescription>`, `<DrawerFooter>`, `<DrawerClose>`. Optional: `direction`. |
| **Token bindings** | `--popover` (content bg), `--popover-foreground`, `--muted` (handle indicator on bottom drawer), `--nw-slate-deep/10` (overlay backdrop), `--ring` (focus). |
| **States** | closed · opening (slide-in animation) · open · closing (slide-out) · dragging (Vaul-specific — user pulls handle) |
| **A11y** | Vaul provides ARIA dialog pattern: `role="dialog"`, focus trap, Esc to close. `aria-labelledby` from DrawerTitle. Vaul handles drag gestures with reduced-motion fallback. |
| **Mobile** | Native phone-up drawer on `nw-phone` (Vaul's bottom direction). `left`/`right` direction is desktop-first; collapses to `bottom` at `nw-phone` per pattern in PATTERNS.md "Mobile Approval" entry. |
| **Anti-patterns** | (a) Do not use Drawer for primary navigation — that's AppShell + JobSidebar (§4.1). (b) Do not nest Drawer inside Drawer. (c) Do not pass `org_id` to DrawerContent — A12.1. (d) Do not skip the bottom-direction handle indicator — it signals draggability. |

### 2.4 Sheet

| Field | Value |
|---|---|
| **Source** | **Not yet installed.** Existing pattern: `src/components/slide-out-panel.tsx` (custom). Planned shadcn `Sheet` typically wraps `@base-ui/react/dialog` with side-attached positioning; install at T20a. The custom `slide-out-panel.tsx` already satisfies the visual contract for budget drill-downs. |
| **Variants** | side: `top` / `right` (default) / `bottom` / `left` |
| **Sizes** | `sm` / `md` (default) / `lg` / `xl` / `full` |
| **Required props** | `<Sheet open onOpenChange>` + `<SheetTrigger>`, `<SheetContent side>`, `<SheetTitle>`, `<SheetDescription>`, `<SheetClose>`. |
| **Token bindings** | `--popover`, `--popover-foreground`, `--border-default` (edge ring), `--shadow-panel`, `--ring` |
| **States** | closed · opening · open · closing · disabled (rare) |
| **A11y** | Same as Modal — `role="dialog"`, `aria-modal="true"`, focus trap, Esc to close. |
| **Mobile** | At `nw-phone`, side `right`/`left` upgrades to `full` (full-screen sheet) per SYSTEM §13g (no desktop-shrunk-to-phone anti-pattern). |
| **Anti-patterns** | (a) Do not use Sheet where a Drawer is appropriate — Sheet is for desktop-side detail panels, Drawer is for phone-up flows. (b) Do not stack Sheets. (c) Do not pass `org_id` — A12.1. |

### 2.5 Tabs

| Field | Value |
|---|---|
| **Source** | **Not yet installed as shadcn primitive.** Existing pattern: ad-hoc tab implementations (e.g. `budget-costs-sub-tabs.tsx`, `draws-sub-tabs.tsx`, `financial-view-tabs.tsx`). Planned shadcn `Tabs` wraps `@base-ui/react/tabs`; install at T20a. |
| **Variants** | `default` (underline-only) / `pills` (square pills, used for sub-section nav) |
| **Sizes** | inherit Button sizes for tab triggers; tab list height ~h-9 |
| **Required props** | `<Tabs value onValueChange>` + `<TabsList>` + `<TabsTrigger value>` * N + `<TabsContent value>` * N |
| **Token bindings** | `--text-secondary` (inactive tab), `--text-primary` (active), `--nw-stone-blue` (active underline), `--border-default` (separator under tab list), `--bg-subtle` (hover bg on triggers), `--ring` (focus) |
| **States** | inactive · hover · focus-visible · active · disabled |
| **A11y** | Base UI Tabs primitive: `role="tablist"`, `role="tab"`, `aria-selected`, `aria-controls`, `aria-labelledby`. Keyboard: arrow keys to navigate tabs (left/right), Home/End for first/last, automatic activation on focus (default) or manual on Enter. |
| **Mobile** | Tab list horizontally scrolls at `nw-phone` if tabs overflow viewport; current tab indicator stays sticky (not implemented yet — flagged for T20d). |
| **Anti-patterns** | (a) Do not use Tabs for >7 sections — use a Combobox / Select category picker instead. (b) Do not use Tabs to swap entire pages — that's routing. (c) Do not nest Tabs (sub-tabs are OK if visually distinct, but max 1 level deep). (d) Do not pass `org_id` — A12.1. |

---

## 3. Inventory by category — Feedback (per SPEC A12, B2)

Feedback signals system state to the user. 6 entries: Toast, Banner, Empty State, Loading State, Error State, Skeleton. Plus the Nightwork-authored utilities NwBadge (§3.3) and NwStatusDot (§3.7) which are status-feedback primitives.

### 3.1 Toast

| Field | Value |
|---|---|
| **Source** | Custom Nightwork-authored (`src/components/toast-provider.tsx`). NOT Sonner — Nightwork ships a dependency-free implementation. SPEC A12 names "Toast (Sonner)" as the planned source; the install reality is custom. T20c may consider migrating to Sonner if cross-tab toast sync is needed (deferred to follow-up). |
| **Variants** | kind: `success` / `error` / `warning` / `info` |
| **Sizes** | (single — narrow strip card, top-right) |
| **Required props** | Imperative API: `toast(kind, message, durationMs?)` from `@/lib/utils/toast`; OR `usePush()` hook returning the push function. Optional: `durationMs` (default 5000ms). |
| **Token bindings** | `--bg-card` (default toast bg), `--color-success` / `--color-warning` / `--color-error` for left-edge accent + icon. Container uses `--shadow-panel`. |
| **States** | entering (slide-in from right) · resting · exiting (fade-out) |
| **A11y** | Container has `role="status"` (success/info/warning) or `role="alert"` (error) so screen readers announce on append. `aria-live="polite"` for status, `assertive` for alert. Stack max 3 visible (oldest evicts on overflow). |
| **Mobile** | Pinned top-right at `nw-tablet`+; collapses to top-center full-width-minus-padding at `nw-phone`. |
| **Anti-patterns** | (a) Do not use Toast for form-field errors — those render inline (FormMessage). (b) Do not stack >3 toasts — UX overload. (c) Do not auto-dismiss errors — let user dismiss explicitly. (d) Do not pass `org_id` to the Toast API — A12.1; the `message` string is already a domain concern, the toast primitive is blind. |

### 3.2 Banner

| Field | Value |
|---|---|
| **Source** | Nightwork-authored composition (existing patterns: `connection-banner.tsx`, `trial-banner.tsx`, `impersonation-banner.tsx`). NOT yet a unified primitive; T20c may codify into `<Banner>`. |
| **Variants** | `info` / `success` / `warning` / `danger` (matches Toast `kind`) |
| **Sizes** | (single — full-width strip; height varies by content, typically ≥44px to maintain touch-target if dismissable) |
| **Required props** | `kind`, `children: ReactNode`. Optional: `dismissible`, `onDismiss`, `action` (CTA link). |
| **Token bindings** | `--color-success` / `--color-warning` / `--color-error` / `--text-accent` for left edge + icon, `--bg-subtle` for tinted bg, `--text-primary` for body text, `--text-secondary` for sub-text. |
| **States** | resting · dismissing (fade-out) · with-action · without-action · pinned (sticky to viewport top, e.g. impersonation banner) |
| **A11y** | `role="status"` (info/success/warning) or `role="alert"` (danger). Dismiss button has `aria-label="Dismiss"`. `aria-live="polite"` so SR users hear when banner enters DOM mid-session. |
| **Mobile** | Always full-width on `nw-phone`. Action CTA wraps below text if needed. |
| **Anti-patterns** | (a) Do not stack banners — pick the highest-priority. (b) Do not put critical errors in a Banner — use Modal or Toast. (c) Do not pass `org_id` to Banner — A12.1. |

### 3.3 Empty State

| Field | Value |
|---|---|
| **Source** | Nightwork-authored (`src/components/empty-state.tsx`). |
| **Variants** | `default` (neutral icon color) / `success` (green icon — used for "all caught up" scenarios) |
| **Sizes** | (single — fills container with `py-16 px-6`) |
| **Required props** | `title: string`, `message: string`. Optional: `icon: ReactNode`, `primaryAction: { label, href \| onClick }`, `secondaryAction`. |
| **Token bindings** | `--bg-card` (container bg), `--border-default` (dashed border), `--text-primary` (title), `--text-secondary` (message), `--nw-success` for success-variant icon, `--font-display` for title typography (per SYSTEM §4) |
| **States** | resting (no interaction) · hover-on-action (button hover state) |
| **A11y** | Plain `<div>` container. Icon is decorative (`aria-hidden`). Action buttons inherit Button a11y. |
| **Mobile** | Padding collapses to `py-12 px-4` at `nw-phone`. Action buttons stack vertically. |
| **Anti-patterns** | (a) Do not use Empty State for loading — use Skeleton (§3.6). (b) Do not use Empty State for errors — use Error State (§3.5). (c) Do not omit primary action when one exists — empty state is a CTA opportunity. (d) Do not pass `org_id` — A12.1. |

### 3.4 Loading State

| Field | Value |
|---|---|
| **Source** | Nightwork-authored. Today: inline spinner styles (`animate-spin` on a circular border element); planned `<LoadingState>` primitive at T20c. |
| **Variants** | `inline` (small spinner inside text/button) / `block` (centered spinner with helper text inside a container) / `full-screen` (covers viewport — used during route transitions) |
| **Sizes** | `sm` (12px spinner) / `md` (16px) / `lg` (24px) / `xl` (32px) |
| **Required props** | `variant`. Optional: `size`, `label` (text rendered next to / below spinner), `accentColor` (defaults to `--brand-accent`). |
| **Token bindings** | `--brand-accent` (spinner stroke — A12.3 brand-customizable), `--border-default` (spinner ring background), `--text-secondary` (label text), `--bg-card/0.85` (full-screen overlay bg) |
| **States** | spinning (always — pure loading state has no other state) |
| **A11y** | Container has `role="status"` + `aria-live="polite"` + visually-hidden text "Loading…" so screen readers announce on append. Decorative spinner is `aria-hidden`. |
| **Mobile** | `full-screen` variant covers safe-area-inset; mobile-Safari respects `env(safe-area-inset-top)` etc. |
| **Anti-patterns** | (a) Do not use LoadingState for filter changes / tab switches — those should be instant from cached data per `loading-skeleton.tsx` comment. (b) Do not omit `aria-live` — invisible loading is a SR bug. (c) Do not use bouncy easing on spinner (per SYSTEM §13b — hook T10b rejects). (d) Do not pass `org_id` — A12.1. |

### 3.5 Error State

| Field | Value |
|---|---|
| **Source** | Nightwork-authored composition. Today: ad-hoc error UIs across pages; planned `<ErrorState>` primitive at T20c. Also relates to Next.js `error.tsx` boundaries (per SPEC B10 — every category page has one). |
| **Variants** | `inline` (compact error message inside a form / row) / `block` (centered error card with retry CTA) / `full-page` (Next.js error.tsx boundary) |
| **Sizes** | inherits container; full-page version is full-screen |
| **Required props** | `title: string`, `message: string`. Optional: `error: Error` (for stack-trace display in dev), `onRetry: () => void`, `helpLink: string`. |
| **Token bindings** | `--color-error` (icon stroke + accent), `--bg-card` (container bg), `--text-primary` (title), `--text-secondary` (message), `--nw-danger/0.06` (subtle tinted icon backplate) |
| **States** | resting · with-retry-CTA · with-help-link · dev-mode-with-stack |
| **A11y** | Container has `role="alert"` + `aria-live="assertive"` so SR users hear immediately. Retry button inherits Button a11y. |
| **Mobile** | Full-page version respects safe-area inset; retry CTA stays above-the-fold. |
| **Anti-patterns** | (a) Do not include raw stack traces in production — gate with `process.env.NODE_ENV === 'development'`. (b) Do not silently swallow errors and show empty state — distinguish between "no data" and "error fetching". (c) Do not pass `org_id` — A12.1. (d) Per SPEC B10 — every category page in `/design-system/components/<category>` has its own `error.tsx` boundary that falls back to "this component preview failed; check console". |

### 3.6 Skeleton

| Field | Value |
|---|---|
| **Source** | Nightwork-authored (`src/components/loading-skeleton.tsx`). Exports: `Skeleton`, `SkeletonStatCard`, `SkeletonTableRow`. |
| **Variants** | shape determined by Tailwind utilities passed in `className` (e.g. `h-3 w-20`); preset compositions: `SkeletonStatCard` (dashboard), `SkeletonTableRow` (table list view) |
| **Sizes** | (caller-determined via Tailwind dimensions) |
| **Required props** | `Skeleton`: optional `className`, `ariaLabel`. Preset compositions take their own props (e.g. `SkeletonTableRow` takes `columns: string[]`). |
| **Token bindings** | `--bg-muted` (the gray pulse bg) |
| **States** | pulsing (always — pure loading state has no other state). Uses Tailwind's `animate-pulse`. |
| **A11y** | If `ariaLabel` provided, `role="status"` is applied. Screen readers announce on append. Decorative skeletons (no ariaLabel) are SR-silent. |
| **Mobile** | Caller controls dimensions; collapse responsive widths via Tailwind responsive prefixes. |
| **Anti-patterns** | (a) Do not use Skeleton during filter changes — those should be instant. (b) Do not animate Skeleton with bouncy easing — `animate-pulse` is the only allowed Skeleton motion (linear). (c) Do not nest Skeleton inside Skeleton. (d) Do not pass `org_id` — A12.1. |

---

## 4. Inventory by category — Navigation (per SPEC A12, B2)

Navigation moves users between regions. 3 entries: AppShell, Tabs-as-nav, Breadcrumb.

### 4.1 AppShell

| Field | Value |
|---|---|
| **Source** | Nightwork-authored (`src/components/app-shell.tsx`). |
| **Variants** | `with-sidebar` (default — JobSidebar visible at desktop) / `no-sidebar` (sidebar hidden via NO_SIDEBAR regex match — invoice detail, draw detail, admin, settings, login, etc.) |
| **Sizes** | full-viewport (always) |
| **Required props** | `children: ReactNode`. The shell handles NavBar + sidebar visibility internally via path-matching. |
| **Token bindings** | `--bg-page` (shell bg), `--text-primary` (default text), `--border-default` (sidebar / nav-bar separators), `--brand-logo` (logo in NavBar — A12.3 tenant-customizable), `--brand-accent` (active-nav-item indicator — A12.3) |
| **States** | desktop-with-sidebar · desktop-without-sidebar · mobile-collapsed · mobile-drawer-open (hamburger expands sidebar as mobile drawer) |
| **A11y** | NavBar has `role="navigation"` + `aria-label="Primary"`. Sidebar has `role="navigation"` + `aria-label="Job navigation"`. Mobile drawer has `role="dialog"` + `aria-modal="true"` while open. Skip-to-main-content link (planned T20d) for keyboard users. |
| **Mobile** | At `nw-phone`/`nw-tablet`, sidebar collapses; hamburger toggle in NavBar opens overlay drawer. Logo shrinks to icon-only at <360px viewport per CLAUDE.md UI rules Q13. |
| **Anti-patterns** | (a) Do not bypass AppShell — every authenticated page wraps in it for consistent NavBar + sidebar behavior. (b) Do not hardcode the logo asset — it's tenant-customizable via `--brand-logo` (A12.3 / SYSTEM §2). (c) Do not pass `org_id` to AppShell — the org context flows through `<OrgBrandingProvider>` server-side; AppShell consumes the rendered tokens. (d) Do not duplicate NavBar inside a page — AppShell renders it once. |

### 4.2 Tabs-as-nav

| Field | Value |
|---|---|
| **Source** | Same primitive as Tabs (§2.5), used in a navigation context (e.g. `JobTabs` switches between Job → Budget → Invoices → Draws → COs sub-pages). |
| **Variants** | `pills` (square outlined pill — current pattern in `job-tabs.tsx`) |
| **Sizes** | `default` (h-9) for desktop; collapsed to scroll-overflow at `nw-phone` |
| **Required props** | Same as Tabs — `value`, `onValueChange`, with `<Link>`-wrapped triggers for routing. |
| **Token bindings** | `--text-secondary` (inactive), `--text-primary` (active), `--nw-stone-blue` (active indicator stripe + bordered selected tab), `--border-default` (separator), `--bg-subtle` (hover) |
| **States** | inactive · hover · focus-visible · active (matches current route) · disabled (rare) |
| **A11y** | When used as nav, each `<TabsTrigger>` should be a `<Link>` with `aria-current="page"` on the matching one (rather than `aria-selected`). `role="navigation"` on the container; tab semantics yield to nav semantics. |
| **Mobile** | Horizontal scroll on overflow; sticky current-tab indicator. |
| **Anti-patterns** | (a) Do not use the `<TabsTrigger value>` pattern for routing — use `<Link href>` inside the trigger so the URL is the source of truth, not local state. (b) Do not use Tabs-as-nav for >7 destinations — use a Combobox / Select. (c) Do not nest Tabs-as-nav. (d) Do not pass `org_id` — A12.1. |

### 4.3 Breadcrumb

| Field | Value |
|---|---|
| **Source** | Nightwork-authored (`src/components/breadcrumbs.tsx`). |
| **Variants** | `default` (always prepends "Home") |
| **Sizes** | (single — `text-[13px]` per SYSTEM §4) |
| **Required props** | `items: BreadcrumbItem[]` where `BreadcrumbItem = { label: string; href?: string }` |
| **Token bindings** | `--text-secondary` (default crumbs), `--text-primary` (current crumb, last item), `--text-tertiary` (separator chevrons) |
| **States** | resting · hover (link crumbs underline) · current (last crumb, no link, primary text color) |
| **A11y** | `<nav aria-label="Breadcrumb">` wrapper; `<ol>` with crumb items; current item has `aria-current="page"`. |
| **Mobile** | At `nw-phone`, middle crumbs collapse to "…" if trail length > 3. The trail is hidden in print (`print:hidden`) — page header is enough for printed pages. |
| **Anti-patterns** | (a) Do not skip the leading "Home" crumb — Breadcrumbs prepends it automatically; if your trail starts with "Home" the component preserves it. (b) Do not nest Breadcrumbs inside Breadcrumbs. (c) Do not include action-CTAs as crumbs — crumbs are pure navigation. (d) Do not pass `org_id` — A12.1. |

---

## 5. Inventory by category — Data display (per SPEC A12, B2)

Data display surfaces structured information. 3 entries: Table, DataGrid, ConfidenceBadge. Plus utility primitives NwDataRow (§3.5), NwMoney (§3.6), NwEyebrow (§3.2), NwBadge (§3.3) that compose into data display surfaces.

### 5.1 Table

| Field | Value |
|---|---|
| **Source** | **Not yet installed as shadcn primitive.** Today: ad-hoc HTML `<table>` styling across pages. Planned shadcn `Table` is a thin styled wrapper over native `<table>`; install at T20a. |
| **Variants** | `default` (rows separated by border-bottom) / `striped` (alternating row backgrounds) / `bordered` (cell-grid borders) |
| **Sizes** | density-driven via SYSTEM §10: `compact` (h-8 row, px-3) / `comfortable` (h-12 row, px-4) — print mode forces compact |
| **Required props** | composition of `<Table>` + `<TableHeader>` + `<TableRow>` + `<TableHead>` + `<TableBody>` + `<TableCell>` + optional `<TableCaption>`. Caller renders rows. |
| **Token bindings** | `--bg-card` (table bg), `--bg-muted` (header bg + striped row alt), `--text-primary` (cell text), `--text-secondary` (header label), `--border-default` (row dividers), `--font-mono` + `tabular-nums` for money columns (per SYSTEM §4e) |
| **States** | resting · hover (highlight row via `bg-subtle`) · selected (row checkbox checked) · sorting (column header indicates current sort) · loading (Skeleton rows replace data) · empty (Empty State component below table) |
| **A11y** | Native `<table>` semantics: `<thead>`, `<tbody>`, `<th scope="col">`, `<th scope="row">`. Caption via `<TableCaption>`. Sortable columns get `aria-sort="ascending|descending|none"` on `<th>`. |
| **Mobile** | At `nw-phone`, secondary columns collapse; primary columns scroll horizontally OR card-stack (depends on table; e.g. invoice list goes card-stack, AIA G703 keeps column-scroll). Table-of-money tables ALWAYS use `tabular-nums` to keep digits aligned across rows. |
| **Anti-patterns** | (a) Do not use Table for layout — that's a grid. (b) Do not omit `<th scope>` — SR users lose row/column orientation. (c) Do not use `<table>` for forms — that's `<form>`. (d) Do not pass `org_id` to Table — A12.1; the table is data-blind. |

### 5.2 DataGrid

| Field | Value |
|---|---|
| **Source** | TanStack Table v8 (`@tanstack/react-table@^8.21.3`). Headless library — Nightwork wraps with the Table primitive (§5.1) for rendering. |
| **Variants** | `default` (full-feature: sorting, filtering, pagination, column visibility, row selection) / `simple` (read-only — sorting only) |
| **Sizes** | density-driven via SYSTEM §10 (compact / comfortable) |
| **Required props** | TanStack `useReactTable({ data, columns, getCoreRowModel, getSortedRowModel?, getFilteredRowModel?, getPaginationRowModel?, getRowModel })`. The `columns` ColumnDef array drives behavior. |
| **Token bindings** | inherits Table tokens; sort indicator uses `--text-accent`; filter chip uses `--bg-subtle` + `--text-primary`; pagination buttons inherit Button tokens |
| **States** | resting · sorted-asc · sorted-desc · filtered (chips visible) · paginated (page indicator) · row-selected · row-expanded (subrow visible) · loading · empty · error |
| **A11y** | Sortable columns: `aria-sort` on header. Selectable rows: `role="row"` + `aria-selected`. Pagination: button labels "Go to next page", "Go to previous page". Filter chips: dismissible buttons with `aria-label="Remove filter: <name>"`. |
| **Mobile** | Pagination controls grow to 44px touch targets. Column visibility menu is a Popover at `nw-tablet`+; full-screen Sheet at `nw-phone`. |
| **Anti-patterns** | (a) Do not bypass TanStack and roll your own table state — you lose accessibility + cross-feature consistency. (b) Do not pass `org_id` to a column — pass tenant-aware data through the `data` prop only; the columns are tenant-blind. (c) Do not use DataGrid for <10 rows — Table is enough. (d) Do not put DataGrid inside DataGrid — use sub-rows / row-expansion. |

### 5.3 ConfidenceBadge

| Field | Value |
|---|---|
| **Source** | Nightwork-authored composition over NwBadge (§3.3). NOT a separate file today; T20e codifies as `<ConfidenceBadge confidence={0.92} />`. Drives the AI confidence routing per CLAUDE.md "Confidence Routing" rules. |
| **Variants** | derived from `confidence` value: `≥0.85` → `success` (green) / `0.70-0.84` → `warning` (yellow) / `<0.70` → `danger` (red) |
| **Sizes** | inherits NwBadge sizes (`sm` / `md`) |
| **Required props** | `confidence: number` (0-1). Optional: `showPercent: boolean` (default true — shows "92%" inside badge), `size`. |
| **Token bindings** | `--color-success` / `--color-warning` / `--color-error` (variant accent), inherits NwBadge tinted-bg + bordered shape (per Slate non-negotiable #7) |
| **States** | resting (single static state — confidence is read-only at render) |
| **A11y** | NwBadge inherits `<span>` semantics; SR-friendly text (e.g. "Confidence 92%") rendered inside. ARIA: `aria-label="AI confidence ${pct}%"`. The visual color is reinforced by text — never color-only (WCAG 1.4.1). |
| **Mobile** | inherits NwBadge sizing (`sm` 20px / `md` 24px tall). |
| **Anti-patterns** | (a) Do not display confidence as a raw float (`0.92`) — always format as percentage with NwMoney-style formatter. (b) Do not invert the routing thresholds (confidence routing is locked per CLAUDE.md and SPEC). (c) Do not use ConfidenceBadge outside AI parsing contexts — the variant routing is AI-specific. (d) Do not pass `org_id` — A12.1. |

---

## 6. Inventory by category — Overlays (per SPEC A12, B2)

Overlays float above content. 4 entries: Tooltip, Popover, Confirm (Dialog variant), HoverCard.

### 6.1 Tooltip

| Field | Value |
|---|---|
| **Source** | shadcn (`src/components/ui/tooltip.tsx`, codemod-rewritten to v3) — wraps `@base-ui/react/tooltip`. |
| **Variants** | (single — text tooltip with arrow) |
| **Sizes** | (single — `text-xs` content, `w-fit max-w-xs`) |
| **Required props** | `<TooltipProvider delay?>` + `<Tooltip>` + `<TooltipTrigger>` + `<TooltipContent>` (text). Optional: `side`, `sideOffset`, `align`, `alignOffset` on TooltipContent. |
| **Token bindings** | `--foreground` (content bg — note: Tooltip inverts colors — dark popup on light text), `--background` (content text). Arrow uses same `--foreground`. |
| **States** | hidden · opening (delayed-open via TooltipProvider `delay`) · open · closing |
| **A11y** | Base UI Tooltip primitive: `role="tooltip"`, `aria-describedby` on trigger pointing to tooltip id. Hover/focus to show, blur/Esc to dismiss. Keyboard users: focus the trigger, tooltip auto-shows. |
| **Mobile** | Tooltips are desktop-first affordances. On `nw-phone` (touch-only), tap-to-show is unreliable — prefer inline labels OR explicit Popover (§6.2) for non-trivial helper content. Tooltip text on mobile shows on long-press in browsers that support it. |
| **Anti-patterns** | (a) Do not put non-text content in Tooltip — use HoverCard (§6.4) for rich previews. (b) Do not wrap a `<button disabled>` in Tooltip — disabled buttons can't receive hover events; wrap in a focusable parent OR use `aria-disabled` + click-prevented. (c) Do not show tooltips on every element — they're for non-obvious affordances only. (d) Do not pass `org_id` — A12.1. |

### 6.2 Popover

| Field | Value |
|---|---|
| **Source** | shadcn (`src/components/ui/popover.tsx`, codemod-rewritten to v3) — wraps `@base-ui/react/popover`. |
| **Variants** | (single — flexible content container; dimensions caller-controlled) |
| **Sizes** | default `w-72` (288px); caller can override via `className` |
| **Required props** | `<Popover>` + `<PopoverTrigger>` + `<PopoverContent>` + optional `<PopoverHeader>` / `<PopoverTitle>` / `<PopoverDescription>`. |
| **Token bindings** | `--popover` (bg), `--popover-foreground` (text), `--foreground/10` (ring border around popup), `--shadow-md`, `--ring` (focus on content) |
| **States** | closed · opening (animate-in: fade + zoom-in-95 — sub-overshoot, allowed per SYSTEM §13b) · open · closing |
| **A11y** | Base UI Popover primitive: focus moves into popup on open, trap until close, Esc to close, focus returns to trigger. `aria-expanded` on trigger; `aria-controls` linking trigger to content; `role="dialog"` on content if `<PopoverTitle>` is present. |
| **Mobile** | Popover positions relative to viewport on `nw-phone`; if popup would overflow screen, Base UI auto-flips side. For rich content prefer Sheet (§2.4) at `nw-phone`. |
| **Anti-patterns** | (a) Do not use Popover for primary navigation — that's AppShell. (b) Do not stack Popovers (Popover-inside-Popover) — nesting confuses focus management. (c) Do not put forms inside Popover unless the form is single-input (e.g., add-tag). For multi-field forms use Sheet or Modal. (d) Do not pass `org_id` — A12.1. |

### 6.3 Confirm (Dialog variant)

| Field | Value |
|---|---|
| **Source** | Specialized Modal / Dialog composition. NOT yet a unified primitive; T20f codifies. The confirm pattern is a Dialog with prescribed structure: title + body + cancel + destructive-confirm buttons. |
| **Variants** | `info` (neutral confirm — e.g., "Save draft?") / `warning` (e.g., "Unsaved changes — discard?") / `destructive` (e.g., "Delete invoice — are you sure?" — uses NwButton variant `danger`) |
| **Sizes** | `sm` (default — confirms are visually compact) |
| **Required props** | `open`, `onOpenChange`, `title`, `description`, `confirmLabel`, `onConfirm`. Optional: `variant`, `cancelLabel` (default "Cancel"). |
| **Token bindings** | inherits Modal tokens; `destructive` variant uses `--destructive` (`--nw-danger`) on confirm button; `info` uses `--primary` (`--nw-stone-blue`) |
| **States** | closed · open · confirming (button loading state during async onConfirm) · confirmed (auto-closes on success) |
| **A11y** | inherits Modal a11y. `<DialogTitle>` is the prompt text. The confirm button receives initial focus (NOT the cancel button — this is debated; Nightwork chooses confirm-focus to align with high-stakes ergonomics, with the Esc key always available to cancel). |
| **Mobile** | inherits Modal mobile behavior (full-screen at `nw-phone` for `md+` sizes). Buttons stack vertically with primary action above cancel. |
| **Anti-patterns** | (a) Do not use Confirm for low-stakes (auto-saving forms have no confirm). (b) Do not omit destructive styling for delete confirms — visual signal is required (per CLAUDE.md "high-stakes" definition). (c) Do not use the same label for confirm + cancel ("OK" / "OK"). (d) Do not pass `org_id` — A12.1. |

### 6.4 HoverCard

| Field | Value |
|---|---|
| **Source** | shadcn (`src/components/ui/hover-card.tsx`, codemod-rewritten to v3) — wraps `@base-ui/react/preview-card`. (Base UI exposes the rich-content variant as `PreviewCard`, not `HoverCard` — the export is renamed inside the primitive file for consistency with shadcn convention.) |
| **Variants** | (single — flexible content container) |
| **Sizes** | default `w-64` (256px); caller can override |
| **Required props** | `<HoverCard>` + `<HoverCardTrigger>` + `<HoverCardContent>`. Optional: `side`, `sideOffset`, `align`, `alignOffset`. |
| **Token bindings** | inherits Popover token bindings (same Base UI structure): `--popover`, `--popover-foreground`, `--foreground/10`, `--shadow-md` |
| **States** | closed · opening (delayed on hover) · open · closing |
| **A11y** | Base UI PreviewCard: `role="dialog"` on content; trigger gets `aria-haspopup="dialog"`. Hover OR focus on trigger opens; mouse-leave / blur closes. Keyboard users can tab into the content while it's open. |
| **Mobile** | HoverCard is desktop-only — touch events have no hover. At `nw-phone` (touch-primary) prefer Popover (tap-to-show) or Sheet for richer previews. The HoverCard primitive should not be the only path to information that mobile users also need. |
| **Anti-patterns** | (a) Do not use HoverCard for critical info — it's an enhancement. (b) Do not nest HoverCard. (c) Do not put forms inside HoverCard (the focus management around hover-leave is brittle). (d) Do not pass `org_id` — A12.1. |

---

## 7. Existing custom Nw* primitives (codification per audit-notes/T05)

Nightwork ships 7 brand-aware primitives under `src/components/nw/` that pre-date the shadcn install. They remain in the codebase per D1=C hybrid (no migration in scope at Stage 1.5a — see SPEC §4). Each is the canonical Nightwork-flavored primitive for its semantic role; the shadcn equivalent (where one exists) is reserved for shadcn-internal composition only.

### 7.1 NwButton (`src/components/nw/Button.tsx`)

| Field | Value |
|---|---|
| **Variants** | `primary` / `secondary` / `ghost` / `danger` (default `primary`) |
| **Sizes** | `sm` (h-30) / `md` (h-36, default) / `lg` (h-44) |
| **Required props** | `children: ReactNode`. Spreads `ButtonHTMLAttributes`. Optional: `variant`, `size`, `loading`. |
| **Token bindings** | `bg-nw-stone-blue` (primary bg, also acts as `--brand-accent` consumer per A12.3); `bg-nw-gulf-blue` (primary hover — bumped to `#436A7A` in T12 for AA-normal compliance, see SYSTEM §1a); `text-nw-white-sand`; `var(--text-primary)` (secondary/ghost); `var(--bg-subtle)` (secondary/ghost hover bg); `var(--nw-danger)` (danger). Inline `fontFamily: 'var(--font-jetbrains-mono)'`; `letterSpacing: '0.12em'` (`--tracking-button` per SYSTEM §4c) |
| **States** | default · hover · focus-visible (ring on `--nw-stone-blue/40`) · disabled (opacity-40 or stone-blue/40) · loading (spinner before children, `aria-hidden`) |
| **A11y** | Native `<button>`, default `type="button"` (overridable). `disabled` propagates. `focus-visible:ring-2 focus-visible:ring-nw-stone-blue/40 focus-visible:ring-offset-1`. **A11y gap (per T05):** `loading` does not set `aria-busy="true"`. T20a follow-up. **Touch-target gap:** `sm` (30px) and `md` (36px) are below WCAG 2.5.5 44px; `lg` is the only mobile-acceptable size. SPEC A9 mandates 56px for high-stakes mobile actions — **NwButton has no `xl=56px` size today.** Document gap; T20a may add. |
| **Mobile** | Use `lg` size at `nw-phone` for any tap-target. For high-stakes mobile actions (approve/reject/void) use a custom `style={{ minHeight: 56 }}` override OR add `xl` size in T20a. |
| **Anti-patterns** | (a) Do not use raw `<button>` with inline Tailwind — `nightwork-design-tokens` skill rejects. (b) Do not add `rounded-*` — square per SYSTEM §6, hook T10b rejects. (c) Do not replace inline `fontFamily: 'var(--font-jetbrains-mono)'` with `font-mono` Tailwind utility (works but pattern consistency matters across nw/* primitives). |

### 7.2 NwEyebrow (`src/components/nw/Eyebrow.tsx`)

| Field | Value |
|---|---|
| **Variants (tone)** | `default` / `accent` / `warn` / `success` / `danger` / `muted` (default `muted`) |
| **Sizes** | (single — `text-[10px]` per `--fs-label`) |
| **Required props** | `children: ReactNode`. Optional: `tone`, `icon` (decorative — should be `aria-hidden` per T05 gap). Spreads `HTMLAttributes<HTMLSpanElement>`. |
| **Token bindings** | tone-color resolved via map (`--text-primary` / `--nw-stone-blue` / `--nw-warn` / `--nw-success` / `--nw-danger` / `--text-tertiary`). Inline `fontFamily: 'var(--font-jetbrains-mono)'`; `letterSpacing: '0.14em'` (`--tracking-eyebrow` per SYSTEM §4c) |
| **States** | resting (no interactive state — eyebrow is static text) |
| **A11y** | `<span>` element; inline. No `role` — caller adds if context requires. **A11y gap (per T05):** `icon` slot lacks `aria-hidden="true"` for decorative icons. T20a follow-up. |
| **Mobile** | inherits parent layout; eyebrow is horizontal-flex with icon on left of text. |
| **Anti-patterns** | (a) Do not use plain `<span className="text-xs uppercase tracking-widest">` — skill rejects; use NwEyebrow. (b) Do not put non-decorative icons in the icon slot — they need explicit alt-text labels. (c) Do not nest NwEyebrow inside NwEyebrow. |

### 7.3 NwBadge (`src/components/nw/Badge.tsx`)

| Field | Value |
|---|---|
| **Variants** | `neutral` / `success` / `warning` / `danger` / `info` / `accent` (default `neutral`) |
| **Sizes** | `sm` (h-20) / `md` (h-24) |
| **Required props** | `children: ReactNode`. Optional: `variant`, `size`. |
| **Token bindings** | bordered + tinted (per Slate non-negotiable #7 — bordered, never filled). Variant color/tint pairs from a map; e.g. `success` → border + text `--nw-success`, bg `rgba(74, 138, 111, 0.06)`. Inline `fontFamily: 'var(--font-jetbrains-mono)'`; `letterSpacing: '0.14em'` (uppercase). |
| **States** | resting (single static state) |
| **A11y** | `<span>` element. No `role` (caller-determined). **Per T05:** color-only differentiation is mitigated by ALL-CAPS text being the primary differentiator — text is required, not optional. WCAG 1.4.1 satisfied via text. |
| **Mobile** | sizes are intentionally small (20-24px tall); badge sits inline within text or in card headers. |
| **Anti-patterns** | (a) Do not use empty NwBadge as a color-only indicator — text is required (WCAG 1.4.1). (b) Do not stack NwBadges (use one per status; if multiple statuses needed, use a status timeline). (c) Do not invent variant colors — fix variant set is the locked semantic palette. |

### 7.4 NwCard (`src/components/nw/Card.tsx`)

| Field | Value |
|---|---|
| **Variants** | `default` (theme-aware, white-on-light, slate-deeper-on-dark) / `inverse` (always-dark island; doesn't theme-flip) |
| **Sizes (padding)** | `none` (p-0) / `sm` (p-3) / `md` (p-5, default) / `lg` (p-6) |
| **Required props** | `children: ReactNode`. Optional: `variant`, `padding`. |
| **Token bindings** | default: `var(--bg-card)`, `var(--text-primary)`, `var(--border-default)`. inverse: `bg-nw-slate-deep`, `text-nw-white-sand`, hardcoded `rgba(247, 245, 236, 0.08)` border (theme-invariant). |
| **States** | resting (Card is non-interactive by default; hover/active states apply only when caller wraps in a button or link) |
| **A11y** | Plain `<div>`. **Per T05 gap:** no polymorphic `as` prop. To make a Card a `<section>` / `<button>` / `<a>`, wrap externally. T20b may add `as` prop. |
| **Mobile** | padding `md`/`lg` collapses to `sm` at `nw-phone` (per density mapping SYSTEM §10). |
| **Anti-patterns** | (a) Do not use NwCard for short status banners — use Banner. (b) Do not nest NwCard inside NwCard without explicit need. (c) Do not add `rounded-md/lg/xl` — square per SYSTEM §6. |

### 7.5 NwDataRow (`src/components/nw/DataRow.tsx`)

| Field | Value |
|---|---|
| **Variants** | `normal` (default) / `emphasized` (font-medium weight bump) / `danger` (`--nw-danger` value color) |
| **Layouts** | `stacked` (default — label on top via NwEyebrow, value below) / `horizontal` (label left, value right, baseline-aligned) |
| **Required props** | `label: ReactNode`, `value: ReactNode`. Optional: `variant`, `layout`, `inverse` (override eyebrow color for slate-deep card context). |
| **Token bindings** | composes `<NwEyebrow tone="muted">` for label; value as `<span text-[13px]>` with inline color. When `inverse=true`: eyebrow color overrides to `rgba(247,245,236,0.5)`, value resolves to `--nw-white-sand`. |
| **States** | resting (static — no interactive state). Caller can wrap in clickable parent. |
| **A11y** | Plain `<div>` wrapping `<NwEyebrow>` + `<span>`. **Per T05 gap:** no `<dl><dt><dd>` semantics — possible improvement. T20e may add structural option. |
| **Mobile** | `horizontal` collapses to `stacked` at `nw-phone` per density mapping. |
| **Anti-patterns** | (a) Do not bypass NwEyebrow — use NwDataRow's label slot which composes one. (b) Do not put interactive controls in the value slot — use a Form field. (c) Do not pass raw HTML strings as children — React nodes only. |

### 7.6 NwMoney (`src/components/nw/Money.tsx`)

| Field | Value |
|---|---|
| **Variants** | `default` (uses `--color-money` — theme-aware) / `negative` (`--nw-danger`) / `emphasized` (`--text-primary`, weight bumped) / `muted` (`--text-tertiary`) |
| **Sizes** | `sm` (text-11) / `md` (text-13, default) / `lg` (text-15) / `xl` (text-22 — for hero totals) |
| **Required props** | `cents: number \| null \| undefined` (null/undefined → em-dash placeholder). Optional: `variant`, `size`, `signColor` (auto-color negatives), `prefix` (default "$"), `suffix`, `showCents` (default true). |
| **Token bindings** | variant color resolved via map; `--color-money` (theme-aware: `--text-primary` light, `--nw-white-sand` dark). Inline `fontFamily: 'var(--font-jetbrains-mono)'`; `fontVariantNumeric: 'tabular-nums'` (mandatory for column-aligned money per SYSTEM §4e); `whitespace-nowrap`. |
| **States** | resting (static — money is read-only at render) |
| **A11y** | Plain `<span>`. **Per T05 gaps:** (a) em-dash placeholder lacks `aria-label="No value"` — SR announces "—" today. (b) Inline `formatDollars` duplicates `formatCents`/`formatDollars` from `src/lib/utils/format.ts`. Possible refactor — surface to T20e. |
| **Mobile** | sizes scale per breakpoint via caller-controlled `size` prop. Tabular nums keep digits aligned across rows even at small sizes. |
| **Anti-patterns** | (a) Do not use raw `.toFixed(2)` for money formatting — use NwMoney. (b) Do not store dollars; the component takes `cents` per CLAUDE.md "Amounts in cents" rule. (c) Do not use NwMoney for non-money numbers (counts, percentages) — use plain text or a dedicated `NwNumber` (deferred). |

### 7.7 NwStatusDot (`src/components/nw/StatusDot.tsx`)

| Field | Value |
|---|---|
| **Variants** | `active` (`--nw-success`) / `pending` (`--nw-warn`) / `inactive` (theme-aware `--text-muted`) / `danger` (`--nw-danger`) / `info` (`--nw-stone-blue`) (default `active`) |
| **Sizes** | `sm` (1.5×1.5 = 6px) / `md` (2×2 = 8px, default) |
| **Required props** | (none — variant/size optional). Optional: `label` (sr-only screen-reader announcement). |
| **Token bindings** | inline `backgroundColor` from variant map. Uses `rounded-full` — **explicit Slate exception** per SYSTEM §6 (avatars + status dots only). |
| **States** | resting (single static state — status is read-only at render) |
| **A11y** | Outer `<span class="inline-flex">`. Inner colored dot is `<span aria-hidden={label ? undefined : true}>`. If `label` provided, dot is announced via `<span class="sr-only">{label}</span>`. WCAG 1.4.1 satisfied when paired with text label OR `label` prop (color-only is rejected). |
| **Mobile** | sizes are intentionally small (6-8px); status dot sits inline next to label text, never as standalone touch target. |
| **Anti-patterns** | (a) Do not use NwStatusDot as the only status indicator — pair with text or `label` prop (WCAG 1.4.1). (b) Do not size NwStatusDot ≥10px — that's a Badge territory. (c) Do not animate StatusDot (no pulse/blink — that violates SYSTEM §13b "no bouncy" + cognitive-load anti-pattern). |

---

## 8. Tenant-blind primitives rule (per SPEC A12.1, hook C8)

**Rule:** primitives in `src/components/ui/*.tsx` MUST NOT accept tenant-identifying props. Tenant-aware composition lives in `src/components/<domain>/` only.

### 8.1 Forbidden prop names

The post-edit hook (`.claude/hooks/nightwork-post-edit.sh` per SPEC C8 / T10d) rejects ANY of these prop names appearing in a function signature inside `src/components/ui/*.tsx`:

- `org_id` (snake_case — explicit tenant)
- `orgId` (camelCase — explicit tenant)
- `membership` (the membership row object that carries `org_id` + role)
- `membershipId`
- `vendor_id` (specific tenant-aware entity ID)

If a primitive needs to display tenant data (e.g., a logo, an org name), it accepts a generic prop (`logoUrl: string`, `orgName: string`) — the tenant context is resolved by the parent (a domain wrapper in `src/components/<domain>/` or a server component in `src/app/<route>/`) and passed as data, not as a tenant identifier. The primitive remains data-blind.

### 8.2 Why this matters (architectural posture)

Per CLAUDE.md "Multi-tenant RLS is non-negotiable" — tenant safety is built BY CONSTRUCTION. If a primitive accepts `org_id`, the primitive must "know" what to do with it (filter? validate? scope?), which couples primitive logic to tenant logic. A dropped RLS policy + a primitive that filters by `org_id` could bypass server-side checks.

By keeping primitives tenant-blind:
- Server-side query layer is the SINGLE place tenant filtering happens (every query goes through `getCurrentMembership()` per CLAUDE.md "Code behavior").
- Primitives remain reusable across orgs without coupling.
- A future "demo mode" or "platform admin cross-tenant view" works without primitive rewrites.

### 8.3 Composition pattern (allowed)

```tsx
// src/components/invoices/InvoiceVendorPicker.tsx — DOMAIN component (tenant-aware)
'use client';
import { Combobox, ComboboxInput, ComboboxContent, ComboboxItem } from '@/components/ui/combobox';
import { useVendors } from '@/lib/data/vendors'; // hook scoped via getCurrentMembership

export function InvoiceVendorPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { data: vendors } = useVendors(); // tenant-scoped fetch happens here
  return (
    <Combobox value={value} onValueChange={onChange}>
      <ComboboxInput />
      <ComboboxContent>
        {vendors?.map((v) => (
          <ComboboxItem key={v.id} value={v.id}>{v.name}</ComboboxItem>
        ))}
      </ComboboxContent>
    </Combobox>
  );
}
```

The `Combobox` primitive (in `src/components/ui/combobox.tsx`) sees only `value` and items — no `org_id`. The domain wrapper (`src/components/invoices/InvoiceVendorPicker.tsx`) handles tenant scoping via `useVendors()` which reads `getCurrentMembership()` server-side.

### 8.4 Hook positive test (per SPEC D5.1 / T35.5)

The hook is verified by attempting to commit `prop named 'org_id' in src/components/ui/button.tsx` — the hook rejects with explicit error referencing A12.1.

---

## 9. Icon Library Boundary (per SPEC A12.2)

**Rule:** Heroicons is the only icon library imported by Nightwork-authored UI. Lucide is a transitive shadcn dependency, scoped to `src/components/ui/*.tsx` only.

### 9.1 Heroicons — Nightwork-authored UI

`@heroicons/react@^2.2.0` is the canonical icon library for any new component / page in `src/components/<domain>/` or `src/app/<route>/`. Variant: `outline` with `stroke-width: 1.5` (default — matches Slate aesthetic; thicker variants look chunky on internal screens).

**Import pattern:**

```tsx
import { ChevronRightIcon, DocumentTextIcon } from '@heroicons/react/24/outline';
```

NOT `@heroicons/react/24/solid` (filled variant — too heavy for Nightwork screens) unless explicit reason (e.g., status icon where weight signals importance).

### 9.2 Lucide — internal shadcn primitives only

`lucide-react@^1.14.0` ships transitively with shadcn primitives. Today, lucide is imported in:
- `src/components/ui/calendar.tsx` — `ChevronLeftIcon`, `ChevronRightIcon`, `ChevronDownIcon`
- `src/components/ui/combobox.tsx` — `ChevronDownIcon`, `XIcon`, `CheckIcon`

**These imports are allowed.** They're scoped to the shadcn primitives that originally generated them. Nightwork-authored UI MUST NOT import from `lucide-react` directly.

The post-edit hook (T10b family) does not enforce this today — flagged for follow-up enforcement at the `nightwork-design-system-reviewer` agent layer (`/nightwork-design-check` review). T20a-T20f playground pages serve as the visual reminder.

### 9.3 Heroicons semantic mapping (per SPEC A12.2 enumeration)

| Semantic role | Heroicon name | Use case |
|---|---|---|
| **Status** | | |
| Success / approved | `CheckCircleIcon` | Approved invoice, completed step |
| Warning / pending | `ExclamationTriangleIcon` | Held, over-budget, awaiting QA |
| Error / denied | `XCircleIcon` | Denied invoice, void status |
| Info / neutral | `InformationCircleIcon` | Help text, no-op state |
| **Action** | | |
| Edit | `PencilIcon` | Edit row, edit value |
| Delete | `TrashIcon` | Soft-delete (record with `deleted_at`) |
| Save | `CheckIcon` | Confirm save in form |
| Cancel | `XMarkIcon` | Dismiss action |
| Download | `ArrowDownTrayIcon` | Export PDF, download file |
| Upload | `ArrowUpTrayIcon` | File dropzone trigger |
| Add | `PlusIcon` | New record |
| Search | `MagnifyingGlassIcon` | Filter input prefix |
| Settings | `Cog6ToothIcon` | Settings menu |
| **Navigation** | | |
| Forward | `ChevronRightIcon` | Breadcrumb separator, drill-down |
| Back | `ChevronLeftIcon` | Back button |
| Down | `ChevronDownIcon` | Expand, collapse, dropdown trigger |
| Up | `ChevronUpIcon` | Collapse |
| External | `ArrowTopRightOnSquareIcon` | "Open in new tab" links |
| **File-type** | | |
| PDF | `DocumentTextIcon` | Invoice PDF preview |
| Image | `PhotoIcon` | Photo invoice |
| Spreadsheet | `TableCellsIcon` | Excel-based file (e.g. xlsx) |
| Word doc | `DocumentIcon` | Word-formatted file |
| Generic file | `DocumentIcon` | Fallback |
| **Progress** | | |
| In-progress | `ArrowPathIcon` (spinning) | Loading state, async sync |
| Complete | `CheckCircleIcon` | Done step in wizard |
| Locked | `LockClosedIcon` | Locked draw, locked invoice |
| **Alert** | | |
| Critical | `ExclamationCircleIcon` | Destructive confirmation |
| Heads-up | `BellAlertIcon` | Notifications |

This list is the canonical Heroicons reference. Adding a new icon to a Nightwork component requires a row in this table (T15 PROPAGATION-RULES.md "icon-add workflow" ratifies this — pending T15).

### 9.4 No inline SVG fallback (per SPEC A19)

PROPAGATION-RULES.md (T15, pending) will lock the rule: a new icon goes through Heroicons addition → COMPONENTS.md A12.2 update → first usage in a category page. Inline SVGs are NOT allowed as a fallback for "I couldn't find a matching Heroicon" — file an issue OR submit a Heroicons request OR re-evaluate the design (the missing-icon problem is usually a UX problem, not an icon-library problem).

**Exception:** existing inline SVGs in `src/components/` predating Stage 1.5a are NOT migrated in this phase (per SPEC §4 "Migration of existing inline SVG icons to Heroicons (defer)"). Only new icons go through Heroicons.

---

## 10. Brand Customization (per SPEC A12.3)

This section restates the SYSTEM.md §2 contract from the COMPONENTS perspective: which components consume `--brand-accent` / `--brand-logo` and how the override flows.

### 10.1 The two tenant-customizable tokens

| Token | Default | Where it overrides |
|---|---|---|
| `--brand-accent` | `var(--nw-stone-blue)` (Stone Blue) | server-injected via `document.documentElement.style.setProperty('--brand-accent', org.accentHex)` per SYSTEM §2b |
| `--brand-logo` | `url('/branding/default/logo.png')` (Ross Built) | Supabase Storage `branding/{org_id}/logo.{ext}` per SYSTEM §2e |

Everything else (typography, spacing, motion, structural color tokens like `--bg-page` / `--text-primary` / `--border-default`) is locked Nightwork. **There is no per-tenant typography override. There is no per-tenant page background. A11 is intentional — it caps customization to brand identity, not full re-skin.**

### 10.2 Components consuming `--brand-accent`

| Component | How `--brand-accent` is consumed |
|---|---|
| **NwButton (primary variant)** | `bg-nw-stone-blue` falls back to `--brand-accent` via the chained alias `--primary: var(--brand-accent, var(--nw-stone-blue))`. See `tailwind.config.ts` token wiring + `globals.css` shadcn token remap. |
| **shadcn Button (default variant)** | `bg-primary` → `--primary` → falls back to `--brand-accent` |
| **AppShell (active nav indicator)** | Active tab underline + active sidebar item border use `border-[var(--brand-accent)]` |
| **Loading State (spinner accent stripe)** | `--brand-accent` colors the spinning ring's leading stroke per §3.4 |
| **TabsList active indicator** | active tab underline color is `--brand-accent` |
| **Form FocusRing** | input focus-visible ring uses `--ring` which aliases to `--brand-accent` (defaults to `--nw-stone-blue`) |

Components that explicitly DO NOT consume `--brand-accent` (deliberate — tenant consistency required):
- NwBadge variant colors (`success` / `warning` / `danger` / `info` / `accent`) — these are status semantics, must read consistently across orgs
- NwMoney (variant colors) — financial signal must be tenant-invariant
- All `--text-*`, `--bg-*`, `--border-*` semantic tokens — locked structural palette

### 10.3 Components consuming `--brand-logo`

| Component | How `--brand-logo` is consumed |
|---|---|
| **AppShell (NavBar logo)** | Top-right of every authenticated surface; collapses to icon-only at <360px viewport per CLAUDE.md UI rules Q13. The asset is loaded via signed URL from `branding/{org_id}/logo.{ext}` (per SYSTEM §2e). |
| **Public footer / public header** | Marketing site uses the SAME logo asset — Ross Built default served as the public-bucket asset for unauthenticated visitors |
| **Print View header** | AIA G702/G703 print header uses the contractor logo (for Ross Built today; for any future tenant, their `--brand-logo`). |

### 10.4 Override flow (full sequence)

1. **Admin uploads logo** at `/admin/branding` → server-side validates: PNG/SVG/JPEG only (per A11.5), ≤200KB (per A11.6), SVG sanitized via `isomorphic-dompurify` (per A11.5). Owner/admin role required (per A11.7).
2. **Server stores asset** at `branding/{org_id}/logo.{ext}` in Supabase Storage; never public bucket; signed URL refresh on read.
3. **Admin sets accent** (hex string) at `/admin/branding`; server-side `^#[0-9A-Fa-f]{6}$` regex validation (per A11.2); invalid → 400 reject + fallback to `--nw-stone-blue`.
4. **Mutation audit-logged** to `activity_log` with `action='branding.logo_updated'` or `branding.accent_updated` (per A11.7). Append-only.
5. **Next page render** — `OrgBrandingProvider` server component reads `getOrgBranding()` and injects:
   - `<style id="org-branding">html { --brand-accent: #<hex>; --brand-logo: url('<signed-url>'); }</style>` — NEVER inline interpolation, ALWAYS via `setProperty` per A11.1.
6. **Cache headers set:** `Cache-Control: private, no-store; Vary: Cookie` (per A11.3) prevent CDN cross-tenant pollution.
7. **Components render with new tokens** — NwButton primary now displays in tenant-accent; AppShell nav-bar logo updates.

### 10.5 Hook + skill enforcement

- **Hook (T10a-d):** post-edit hook rejects raw hex inside Nightwork-authored components; tenants who want to "customize" must go through the `--brand-accent` / `--brand-logo` mechanism — there is no escape hatch via inline color.
- **Skill (`nightwork-design-system-reviewer`):** `/nightwork-design-check` reviews any new component for:
  - Does it consume `--brand-accent` correctly? (Yes if it should be tenant-customizable, no otherwise.)
  - Does it accidentally consume `--brand-accent` where structural color is needed?
- **PROPAGATION-RULES.md (T15, pending):** locks the rule that tenant-customizable token additions require Owner+Admin sign-off — `--brand-secondary` / `--brand-text` / etc. are NOT tenant-customizable in v1 and proposing one requires a phase.

---

## 11. Dependency reality (per SPEC A13, C1)

### 11.1 Installed primitive libraries (verified from `package.json`)

| Library | Version | Role | SPEC reference |
|---|---|---|---|
| `@base-ui/react` | `^1.4.1` | Single primitives surface — replaces `@radix-ui/*` (none installed) | A13 amended |
| `@tanstack/react-table` | `^8.21.3` | DataGrid base | A13 + Q8=A |
| `@heroicons/react` | `^2.2.0` | Nightwork-authored icon library | A12.2 |
| `lucide-react` | `^1.14.0` | Transitive shadcn dep — scoped to `src/components/ui/*.tsx` only | A12.2 (boundary) |
| `vaul` | `^1.1.2` | Drawer primitive | A13 |
| `react-day-picker` | `^9.14.0` | DatePicker / Calendar base | A13 |
| `tailwindcss-animate` | `^1.0.7` | v3-compatible motion utilities (replaces `tw-animate-css`) | A13 amended (T07) |
| `class-variance-authority` | `^0.7.1` | shadcn variant composition | C1 |
| `clsx` | `^2.1.1` | shadcn className composition | C1 |
| `tailwind-merge` | `^3.5.0` | shadcn className merge | C1 |
| `isomorphic-dompurify` | `^3.10.0` | A11.5 SVG sanitization for brand-logo upload | A11.5 (pre-existing, retained) |

**Pinned per `package.json` at HEAD `a318d7e`**.

### 11.2 NOT installed

| Library | SPEC mention | Why not installed |
|---|---|---|
| `@radix-ui/*` | (legacy reference) | shadcn 4.x ships with `@base-ui/react` — Radix-team's newer library; no `@radix-ui/*` package needed |
| `cmdk` | A13 (Combobox) | install reality uses `@base-ui/react`'s Combobox primitive; if filtering UX is insufficient T20a may add cmdk — flagged as decision point |
| `sonner` | A12 (Toast) | install reality is custom `toast-provider.tsx`; T20c may migrate if cross-tab toast sync needed |
| `framer-motion` | A6 / Q5=A | explicitly out of scope per SPEC §4 + Q5=A — CSS-only motion |
| Storybook | A19 ("re-evaluate at 40+ components") | not installed; re-evaluate if component count exceeds 40 (today: 26 catalogued + 7 Nw* = 33) |

### 11.3 shadcn CLI

`shadcn@^4.6.0` is in `devDependencies` (CLI invoked via `npx`). It's not a runtime dep.

### 11.4 The shadcn-v3 codemod (per audit-notes/T08-shadcn4-tailwind-v3-incompatibility.md)

**All shadcn-generated primitives in `src/components/ui/` have been rewritten through `scripts/shadcn-v3-codemod.ts`** (12 rule families — see audit-notes/T08-codemod-test.md for the full spec). The codemod converts shadcn 4.x's Tailwind v4 syntax into v3-compatible utilities so the existing `tailwindcss@^3.4.1` install works.

**Implication for future primitive adds (T20a-T20f):** when a new primitive is needed (Select, Sheet, Toast, Tabs, Form, Dialog, Table), the install sequence is:
1. `npx shadcn add <component>`
2. Run `npx tsx scripts/shadcn-v3-codemod.ts src/components/ui/<component>.tsx`
3. Visually verify the primitive renders correctly at `/design-system/components/<category>`
4. Commit BOTH the `shadcn add` output AND the codemod-rewritten file in one atomic commit (per SPEC A13)

The codemod is idempotent — re-running on an already-rewritten file is a no-op (per audit-notes/T08-codemod-test.md outcomes).

### 11.5 npm audit baseline

Per SPEC C1 + M-S2/N3 — `npm audit --audit-level=moderate` was run at first install (Wave 2 / T11.5). Baseline captured at `.planning/phases/stage-1.5a-design-system-documents/artifacts/npm-audit-baseline.json`. Pre-existing high findings (Next.js 14, react-pdf 7, exceljs uuid, eslint-config-next 14, @xmldom in mammoth, tar/glob in build tooling) are accepted-with-rationale — none introduced by Stage 1.5a's three new direct deps. Block on **new** high/critical findings only.

---

## 12. State semantics (the standard 7 states)

Every component's "States" column in the inventory tables maps to this canonical set. When a state doesn't apply (e.g., `loading` doesn't apply to NwBadge), the row says so explicitly.

| State | Definition | When it applies | Token consumption |
|---|---|---|---|
| **default** | resting, idle | always (every component) | base tokens (`--text-primary`, `--bg-card`, `--border-default`, …) |
| **hover** | mouse-over (desktop only) | interactive components (Button, link, row, card-clickable, tab) | hover-bg via `--bg-subtle` or `--bg-muted`; hover-text via `--text-primary`; hover-border via `--border-strong` |
| **focus-visible** | keyboard focus | every focusable element | `outline: 2px solid var(--ring)`; `outline-offset: 2px` (per SYSTEM §12b) |
| **active** | pressed (mouse-down) or selected (current-route, current-tab) | Button, link, row, tab, dialog-currentpage | `translate-y-px` micro-shift on Button; bordered via `--border-brand` for selected items |
| **disabled** | non-interactive | Button, Input, link, Form fields | `pointer-events-none`, `opacity-50` (or 40 for Nw* convention); `cursor-not-allowed` |
| **loading** | async pending state | Button (mid-submit), Form (mid-submit), data-fetching containers | spinner via `--brand-accent`; `aria-busy="true"` (per Nw* gap — flagged) |
| **error** | invalid input or failure | Input, Form, FileDropzone, ErrorState | red border via `aria-invalid` + `--destructive` ring; error message in `<FormMessage>` with `role="alert"` |
| **empty** | no data to show | collections (Table, DataGrid, list view) | EmptyState component renders below container; primary CTA available |

**`empty` is collection-specific.** A Button or a Card is never "empty" in this state-machine sense — they're either present or absent. The 7 standard states + `empty` cover every primitive in the inventory.

**Anti-pattern:** inventing custom states like "warning" or "info" as primitive-level states. Those are VARIANTS (e.g., NwBadge has `warning` variant), not states. Variants are visual-style flips; states are interaction-driven.

---

## 13. Mobile + density behavior (per SYSTEM §10, §11)

This section maps SYSTEM.md's density + touch-target rules to specific component behaviors. PATTERNS.md (T14, pending) elaborates on per-pattern density (e.g., the Mobile Approval pattern's information-density mapping per SPEC A18.1).

### 13.1 Density modes (per SYSTEM §10)

| Density | Row height | Padding | Default for | Forces in print? |
|---|---|---|---|---|
| `compact` | 32px | 4px 8px | tables, dense data, status badges | YES (per SYSTEM §10b) |
| `comfortable` | 48px | 8px 16px | forms, approval flows, document review | NO |

### 13.2 Per-component default density

| Component | Default density | Notes |
|---|---|---|
| Button | comfortable | h-9 (lg) on mobile bumps to ≥44px; standard `default` is 32px desktop |
| Input | comfortable | h-8 desktop / h-11 mobile via `nw-phone:h-11` |
| Combobox | comfortable | items ≥44px on `nw-phone` |
| DatePicker | compact | day cells default 28px desktop / 44px on `nw-phone` |
| Table | compact | dense data rows; print forces compact |
| DataGrid | compact | inherits Table |
| Card | comfortable | padding `md` desktop / `sm` mobile |
| Modal | comfortable | full-screen on `nw-phone` |
| Drawer | comfortable | bottom direction on `nw-phone` |
| Sheet | comfortable | full-screen on `nw-phone` |
| Tabs | comfortable | h-9 trigger; horizontal-scroll on `nw-phone` |
| Toast | compact | narrow strip; top-right desktop / top-center `nw-phone` |
| Banner | comfortable | always full-width; ≥44px when dismissable |
| Empty State | comfortable | py-16 desktop / py-12 mobile |
| Loading State | (variant-driven) | full-screen variant covers safe-area |
| Error State | comfortable | inherits container or full-screen |
| Skeleton | (caller-controlled) | dimensions match real content |
| Tooltip | compact | desktop-only |
| Popover | comfortable | content adjusts |
| HoverCard | comfortable | desktop-only |
| Confirm | comfortable | full-screen on `nw-phone` |
| Breadcrumb | compact | text-13 |
| AppShell | (multi-region) | sidebar 220px desktop / drawer overlay mobile |
| ConfidenceBadge | compact | inherits NwBadge |
| FileDropzone | comfortable | h-48 default / h-32 compact |

### 13.3 Touch-target compliance (per SYSTEM §11)

WCAG 2.5.5 mandates 44×44px minimum on touch surfaces. SPEC A9 mandates 56×56px for high-stakes actions (approve / reject / kickback / void / submit / delete / finalize-draw).

**Standard 44×44 components:** NwButton `lg` / shadcn Button (with mobile size variant pending T20a) / Combobox items at `comfortable` density / Tabs triggers / DatePicker day cells (with `--cell-size:44px` mobile override) / Table row tap targets / DataGrid row tap targets.

**High-stakes 56×56 components (need `xl` size variant — pending T20a):** NwButton high-stakes flavor (today: requires `style={{ minHeight: 56 }}` override) / Confirm primary button.

**Non-touch-target components (read-only, no tap):** Eyebrow / DataRow / Money / StatusDot / Badge / Card (when not clickable) / Toast / Banner content / Skeleton / Loading State.

**Touch-target spacing:** adjacent touch targets need ≥8px gap (`gap-2` Tailwind utility) so a finger doesn't trigger the wrong one. PATTERNS.md "Mobile Approval" entry (T14) elaborates.

### 13.4 Breakpoint aliases (per SYSTEM §9 + T08b)

`tailwind.config.ts` extends:

```ts
screens: {
  'nw-phone':   { max: '480px' },
  'nw-tablet':  { min: '481px', max: '1023px' },
  'nw-desktop': { min: '1024px' },
  'nw-print':   { raw: 'print' },
  // Tailwind defaults sm/md/lg/xl/2xl remain available
}
```

Components that respond to breakpoints use these aliases (e.g., `nw-phone:h-11` to bump Input height on phones; `nw-print:density-compact` to force compact on print).

---

## 14. Accessibility checklist (per SYSTEM §12)

Every component in this inventory MUST pass these checks before merging into Stage 1.5a:

1. **Contrast.** Foreground / background combinations meet WCAG 2.2 AA per CONTRAST-MATRIX.md. Token-level pairs are pre-verified in the matrix; components inherit those guarantees.
2. **Focus-visible.** Every focusable element has `outline: 2px solid var(--ring); outline-offset: 2px` per SYSTEM §12b.
3. **Keyboard navigation.** Tab / Shift+Tab / Enter / Space / Esc / arrow keys all work as expected per Base UI / shadcn primitive defaults.
4. **Screen reader.** Visible labels OR `aria-label` / `aria-labelledby` on every interactive element; error states `role="alert"` + `aria-live="assertive"`; status changes `aria-live="polite"`; loading states `role="status"` + visually-hidden text.
5. **Touch targets.** ≥44×44px for standard; ≥56×56px for high-stakes (per SYSTEM §11).
6. **Color is not the only differentiator** (WCAG 1.4.1). Status indicators include text or icons alongside color.
7. **Motion respects `prefers-reduced-motion`.** Components using `tailwindcss-animate` honor user preference automatically; custom `style={{ transition: ... }}` declarations need explicit `@media (prefers-reduced-motion: reduce)` fallback.
8. **Heading hierarchy.** Components don't impose headings; pages compose primitives + headings consistently (h1 once, h2/h3 nested).

### 14.1 axe-core verification (per SPEC D6 / D6.1)

Every category page (`/design-system/components/<category>`) MUST pass axe-core automated checks at WCAG 2.2 AA. Output archived to `.planning/phases/stage-1.5a-design-system-documents/artifacts/axe-report.json` per SPEC D6.1. Manual keyboard-navigation spot-check on Combobox, DatePicker, Drawer (the three most-complex primitives).

### 14.2 Identified A11y gaps (forwarded from T05 audit-notes)

These are NOT blockers for T13 sign-off; they are documented for T20a-T20f follow-up:

| Component | Gap | Remediation phase |
|---|---|---|
| NwButton | `loading` doesn't set `aria-busy="true"` | T20a |
| NwButton | No `xl` (56px) size for high-stakes mobile | T20a |
| NwEyebrow | `icon` slot lacks `aria-hidden="true"` for decorative icons | T20a |
| NwCard | No polymorphic `as` prop (can't render as `<section>` / `<button>`) | T20b |
| NwDataRow | No `<dl><dt><dd>` semantic option | T20e |
| NwMoney | em-dash placeholder lacks `aria-label="No value"` | T20e |
| NwMoney | Inline `formatDollars` duplicates `src/lib/utils/format.ts` helper | T20e (potential refactor) |
| shadcn Button | Default sizes below 44px on mobile | T20a (add 44/56 size variants) |

---

## 15. Anti-patterns gallery (cross-cutting "do not")

Beyond per-component anti-patterns documented in §1-§7, these cross-cutting violations apply to all Nightwork UI:

1. **Do not pass `org_id` / `membership` / `vendor_id` / `orgId` / `membershipId` to a primitive in `src/components/ui/*.tsx`.** A12.1 violation; hook C8/T10d rejects.
2. **Do not import from `lucide-react` outside `src/components/ui/*.tsx`.** A12.2 violation; `nightwork-design-system-reviewer` flags at `/nightwork-design-check`.
3. **Do not hardcode hex colors** (`bg-[#5B8699]`, `style={{ color: '#3B5864' }}`). Tokens always (`bg-nw-stone-blue`, `text-[color:var(--text-primary)]`). Hook T10a rejects.
4. **Do not hardcode font-family** (`font-family: "Calibri"`, `style={{ fontFamily: "Helvetica" }}`). SYSTEM §13f forbids; PROPAGATION-RULES.md (T15, pending) enforces.
5. **Do not add `rounded-md` / `rounded-lg` / `rounded-xl` / `rounded-2xl` / `rounded-3xl` / `rounded-full`** to rectangular elements. Square per SYSTEM §6; hook T10b rejects. Exception: avatars + status dots use `--radius-dot: 999px` per SYSTEM §1f.
6. **Do not use bouncy easing** (`cubic-bezier(.x, [1-9].[0-9], …)`). SYSTEM §13b forbids; hook T10b rejects.
7. **Do not use generic gradients** (`background: linear-gradient(…)`) on non-decorative elements. SYSTEM §13c forbids.
8. **Do not use HSL hue ∈ [270°, 320°]** (purple/pink). SYSTEM §13d forbids; hook T10b rejects.
9. **Do not use dark glows** (`box-shadow` with blur > 20px AND non-zero spread). SYSTEM §13e forbids; hook T10b rejects.
10. **Do not invent ad-hoc status pills** (e.g., custom `<span className="bg-yellow-200 …">`). Use NwBadge with the locked variant set.
11. **Do not display money via `.toFixed(2)`** — use NwMoney with `cents` prop per SYSTEM §4e + CLAUDE.md "Amounts in cents" rule.
12. **Do not extend a one-off layout** when the invoice-review template extends. Per CLAUDE.md "UI rules" — file preview LEFT, structured fields right-rail, audit timeline at the bottom. PATTERNS.md "Document Review" entry (T14, pending) elaborates.
13. **Do not skip the audit-timeline.** Status changes append to `status_history` JSONB (per CLAUDE.md "Architecture rules → Status history"). Components rendering a workflow surface display status_history below the form.
14. **Do not import sample data from `@/lib/supabase/*` / `@/lib/org/*` / `@/lib/auth/*` inside `src/app/design-system/`.** Sample data lives in `src/app/design-system/_fixtures/` as pure constants. Hook T10c (per SPEC C6 / D9) rejects.
15. **Do not let the playground reach Drummond data.** Per SPEC D7 — the playground is constants-only. Verified by build-time grep (`grep -rn "drummond\|smartshield\|holmes beach" src/app/design-system/`).

This gallery is reproduced (in summarized form) at `/design-system/forbidden` (the Forbidden playground page per SPEC B6) with visual examples of each "DO NOT" beside its violation.

---

## 16. Skill anchors (bidirectional cross-reference per A19.1)

COMPONENTS.md is consumed by the following skills as authoritative for component contracts. **Bidirectional cross-reference** — when a component's contract changes here, those skills update too.

### 16.1 Skills depending on COMPONENTS.md

| Skill | What COMPONENTS.md authorizes |
|---|---|
| `nightwork-design` | Component catalog + variant lists; what to render for a given semantic role |
| `nightwork-design-tokens` | Token bindings per component; "this prop binds to this token" enforcement |
| `nightwork-ui-template` | Document Review pattern's component manifest (NwButton + NwEyebrow + InvoiceFilePreview + …) |
| `nightwork-design-system-reviewer` | runs at `/nightwork-design-check`; verifies component usage matches inventory |
| `nightwork-ui-reviewer` | runs in `/nightwork-qa`; verifies component composition follows tenant-blind / icon-boundary / brand-customization rules |
| `frontend-design` (built-in skill) | Higher-level UI generation — reads COMPONENTS.md inventory before proposing component selections |
| `impeccable` (built-in skill) | UI critique — reads COMPONENTS.md anti-patterns gallery before flagging issues |

### 16.2 COMPONENTS.md → skill propagation rules

When this document changes:
1. The corresponding skill file MUST be updated in lockstep (PROPAGATION-RULES.md T15 elaborates the workflow).
2. The post-edit hook (`.claude/hooks/nightwork-post-edit.sh`) MUST be updated if a new tenant-identifying prop name needs blocking (per A12.1 / C8) OR a new icon-library boundary is added.
3. The components playground (`src/app/design-system/components/<category>`) MUST re-render correctly after a contract change — visual regression spot-check per SPEC D4.
4. Consumers (existing `src/components/<domain>/` files) get reviewed for breakage if a contract narrows; widened contracts are non-breaking.

The `/nightwork-propagate` orchestrator runs this lockstep update for any COMPONENTS.md change tagged "everywhere" or "all".

### 16.3 Skills referenced FROM COMPONENTS.md

This document references back to:
- `colors_and_type.css` — single canonical token source (read-only from COMPONENTS.md's perspective)
- `tailwind.config.ts` — `nw-*` color extensions and breakpoint aliases (T08b)
- `globals.css` — shadcn token alias remap + `--brand-accent` server injection
- `.planning/design/SYSTEM.md` — token catalog (cited extensively)
- `.planning/design/CONTRAST-MATRIX.md` — A11y verification source
- `.planning/design/PATTERNS.md` (T14, pending) — page templates that compose these components
- `.planning/design/PROPAGATION-RULES.md` (T15, pending) — workflow for component changes + icon-add workflow
- `.planning/design/PHILOSOPHY.md` (T17a/b, pending) — design directions that interpret these components

---

## 17. Cross-references / appendix

### 17.1 Quick reference — "I want to render X. Which component?"

| Goal | Component | Section |
|---|---|---|
| A standard CTA button | NwButton (primary) | §7.1 |
| A button inside a shadcn primitive | shadcn Button | §1.1 |
| A text input field | shadcn Input + (planned) Form | §1.2, §1.6 |
| A dropdown picker (≤7 options) | (planned) shadcn Select | §1.3 |
| A searchable picker (>7 options) | shadcn Combobox | §1.4 |
| A date input | shadcn DatePicker (Calendar + Popover) | §1.5 |
| A file upload zone | NwFileDropzone (planned) | §1.7 |
| A content card | NwCard | §7.4 |
| A modal dialog | (planned) shadcn Dialog | §2.2 |
| A bottom-up phone drawer | shadcn Drawer (Vaul) | §2.3 |
| A side detail panel (desktop) | (planned) shadcn Sheet (today: `slide-out-panel.tsx`) | §2.4 |
| Tabs to switch sections | (planned) shadcn Tabs | §2.5 |
| A toast / pop notification | Custom Toast (`toast-provider.tsx`) | §3.1 |
| A page-level banner | Banner composition | §3.2 |
| A "no data" screen | EmptyState | §3.3 |
| A loading spinner / skeleton | LoadingState / Skeleton | §3.4, §3.6 |
| An error fallback | ErrorState + Next.js error.tsx | §3.5 |
| An app navigation shell | AppShell | §4.1 |
| Sub-section nav | Tabs-as-nav | §4.2 |
| A breadcrumb trail | Breadcrumbs | §4.3 |
| A simple data table | (planned) shadcn Table | §5.1 |
| A feature-rich data grid (sort, filter, paginate) | TanStack DataGrid | §5.2 |
| AI confidence display | ConfidenceBadge composition | §5.3 |
| A short text tooltip | shadcn Tooltip | §6.1 |
| A click-to-show floating panel | shadcn Popover | §6.2 |
| A "are you sure?" prompt | (planned) Confirm (Dialog variant) | §6.3 |
| A hover-rich preview card (desktop only) | shadcn HoverCard | §6.4 |
| An eyebrow label | NwEyebrow | §7.2 |
| A status pill | NwBadge | §7.3 |
| A label/value row | NwDataRow | §7.5 |
| Money formatting | NwMoney | §7.6 |
| A status dot (active/pending/danger) | NwStatusDot | §7.7 |

### 17.2 What's planned but NOT installed at HEAD `a318d7e`

These primitives are documented in this inventory at the contract level but the file does not yet exist in `src/components/ui/`:

- **Select** — `@base-ui/react/select` (T20a installs, codemods, commits)
- **Sheet** — `@base-ui/react/dialog` with side-positioning (T20b installs)
- **Tabs** — `@base-ui/react/tabs` (T20d installs)
- **Toast** — Sonner OR keep custom; T20c decision point
- **Form** — `react-hook-form` + Zod composition (T20a installs)
- **Modal/Dialog** — `@base-ui/react/dialog` (T20b installs)
- **Table** — thin styled `<table>` wrapper (T20a installs)
- **Confirm** — Dialog variant composition (T20f installs)
- **EmptyState/LoadingState/ErrorState/Banner/FileDropzone** — Nightwork-authored compositions (T20c installs as primitives)

The `cmdk` package is NOT installed; T20a may add if Base UI Combobox filter UX is insufficient.

### 17.3 Versioning posture

Per SPEC A19 — Stage 1.5a is **v1.0** of the Nightwork design system. Subsequent component changes follow PROPAGATION-RULES.md (T15, pending) workflow. Storybook re-evaluation at 40+ components (today: 26 catalogued + 7 Nw* = 33). Audit-logging of design-system access is N/A — design docs are not SOC2-relevant view events (per M-E3).

### 17.4 Distinctions worth restating

- **Custom Nw* and shadcn coexist (D1=C hybrid).** Both are first-class. The boundary is: NwButton/NwEyebrow/NwBadge/NwCard/NwDataRow/NwMoney/NwStatusDot are Nightwork brand-aware; shadcn Button (and other shadcn primitives) are for shadcn-internal composition. Use the Nightwork primitive in domain UI; use the shadcn primitive only inside other shadcn primitives.
- **Heroicons + lucide coexist (per A12.2).** Heroicons in domain UI; lucide ONLY inside `src/components/ui/*.tsx`.
- **`@base-ui/react` is the SINGLE primitives surface.** No `@radix-ui/*` packages installed (per A13 amendment). When the SPEC references "Radix-team's primitives," that means `@base-ui/react@^1.4.1`.
- **`tailwindcss-animate`, NOT `tw-animate-css`.** v3-compatible (per T07 evaluation). Both names appear in older planning docs — `tailwindcss-animate` is the install reality.

---

## 18. T13 + T13.1 carry-forward

### Applied at T13 + T13.1 (2026-04-30)

1. **Inventory completed for 26 SPEC-named components + 7 existing Nw* primitives** (33 total — under the 40 Storybook re-evaluation threshold).
2. **Tenant-blind primitives rule (A12.1)** documented in §8 with prop-name forbidden list, composition pattern, and hook positive-test reference.
3. **Icon Library Boundary (A12.2)** documented in §9 — Heroicons enumerated for status / action / navigation / file-type / progress / alert; Lucide scoped to `src/components/ui/` only.
4. **Brand Customization (A12.3)** documented in §10 — restates A11 contract; lists 6 components consuming `--brand-accent`, 3 consuming `--brand-logo`, full override flow with cache headers + audit log.
5. **Dependency reality (A13)** documented in §11 with package versions from `package.json` HEAD `a318d7e`. Codemod sequence for future primitive adds.
6. **D1=C hybrid boundary** documented in §1.1 (Button), §7 (custom Nw*), §17.4 — when to use which.
7. **A11y gap forwarding** from T05 audit-notes documented in §14.2 with per-gap remediation phase (T20a/T20b/T20e).
8. **All bracket-value Tailwind / token names cited from SYSTEM.md**, no hardcoded hex outside §10.1 and historical-value footnotes (e.g., `#4E7A8C` → `#436A7A` per T12 patch).

### Deferred (not blocking T14/T20a-T20f)

- **NwButton 56px high-stakes size variant** — flagged in §7.1 + §13.3; T20a addresses.
- **shadcn Button mobile size variants** — flagged in §1.1; T20a addresses.
- **`<NwFileDropzone>` codification** — pattern exists in `invoice-import-content.tsx`; T20a may codify.
- **`<NwFormField>` composition primitive** — flagged in §1.2 + §1.6; T20a may codify.
- **NwCard `as` polymorphic prop** — flagged in §7.4 + §14.2; T20b may add.
- **NwDataRow `<dl><dt><dd>` semantic option** — flagged in §7.5 + §14.2; T20e may add.
- **NwMoney `aria-label` on em-dash + lib helper consolidation** — flagged in §7.6 + §14.2; T20e addresses.
- **`cmdk` install vs `@base-ui/react` Combobox decision** — flagged in §1.4 + §17.2; T20a evaluates.
- **Sonner migration of custom Toast** — flagged in §3.1; T20c evaluates.
- **Lucide-import-outside-src/components/ui hook** — flagged in §9.2; deferred to follow-up; review-layer enforcement until then.
- **Confirm Dialog initial-focus debate (confirm-button vs cancel-button)** — flagged in §6.3; chose confirm-focus for high-stakes ergonomics; T20f playground page documents the rationale.

These are tracked as deferred items within Stage 1.5a — none block T14 PATTERNS.md drafting.

---

**T13 + T13.1 status:** COMPONENTS.md DRAFT COMPLETE (2026-04-30). 26 SPEC-named components catalogued + 7 existing Nw* primitives codified. Tenant-blind / icon-boundary / brand-customization rules locked. Subordinate documents (PATTERNS.md, .impeccable.md) and the components playground (T20a-T20f) reference this document as authoritative. Re-verification triggered by any new shadcn primitive install OR new prop name added to the tenant-blind forbidden list.
