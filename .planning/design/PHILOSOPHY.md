# PHILOSOPHY.md — Nightwork design directions (CP2 picking document)

**Status:** v1 DRAFT (Stage 1.5a, T17 + T17a + T17b) — produced 2026-04-30 per nwrp16.
**Phase:** stage-1.5a-design-system-documents
**Scope:** The CP2-picking document. Three approved directions — Helm + Brass, Specimen, Site Office — rendered concretely against four canonical surfaces (invoice review, dashboard, mobile approval, owner portal), each with four honest weakness entries, and a comparison matrix at the end. Subordinate work (`/design-system/philosophy` playground T18-T26, `nightwork-design` skill direction substitution, `impeccable` skill direction-specific Forbidden additions, PATTERNS.md gold-standard render updates) all branch from Jake's CP2 pick.
**SPEC anchors:** A17, A17a, A17b, A21, E4, E5.
**Authoritative inputs:** SYSTEM.md (token catalog, type system, motion philosophy, density modes, accessibility), COMPONENTS.md (33 components mapped to source / variants / states), PATTERNS.md (12 page patterns with Document Review as gold standard), .impeccable.md (7 quality principles + Forbidden gallery), CONTRAST-MATRIX.md (token contrast verification), the prototype HTMLs in `.claude/skills/nightwork-design/Slate*.html`, `src/app/invoices/[id]/page.tsx` (real Nightwork invoice review reference), `src/app/dashboard/page.tsx`.

**Document length target:** 2200-2700 lines structured into 8 sections + cross-references.

---

## 0. Purpose + cross-references

PHILOSOPHY.md is the document Jake reads at Strategic Checkpoint #2 to pick the design direction. Three directions are approved (locked names + concept paragraphs per nwrp16). This document does NOT propose new directions, does NOT change the locked aesthetic primitives (Slate palette, Space Grotesk + Inter + JetBrains Mono type system, square borders, Stone Blue accent), and does NOT modify the token catalog. It interprets the locked aesthetic three different ways and presents each interpretation concretely enough that Jake can pick visually-informed.

The directions diverge in **mood**, **density default**, **motion timing**, **brand-heritage emphasis**, and **component variant preferences** — not in tokens, not in components, not in patterns. Every render in this document instantiates SYSTEM.md tokens (cited by `--*` name) and COMPONENTS.md primitives (cited by `§-anchor`).

### 0.1 When Jake uses this document

At Strategic Checkpoint #2, after T18-T26 build the playground. Jake reads this document on a desktop (or its rendered equivalent at `/design-system/philosophy`) and clicks the "Pick this direction" button on the chosen direction. The pick writes the direction's name to `.planning/design/CHOSEN-DIRECTION.md` (per T24.1). Subordinate work (subordinate skills, the playground's gold-standard renders, the Forbidden list extension) substitutes the picked direction into its review logic.

### 0.2 What subordinate work depends on the pick

| Surface | What changes per the pick |
|---|---|
| `/design-system/philosophy` playground (T24) | The 3 directions render side-by-side regardless of pick; the "Pick this direction" CTA persists the pick. |
| Sub-pages of the playground (T20a-T20f, T23) | The component playground category pages (Inputs / Surfaces / Feedback / Navigation / Data display / Overlays) and the patterns page render in the picked direction's component-variant preferences (e.g., Helm + Brass picks `outline` Button variant for primary actions; Specimen picks `ghost` Button variant for low-stakes; Site Office picks `default` Button variant with `font-mono` body label). |
| `nightwork-design` skill (post-CP2) | The skill's "Authoritative documents" anchor section adds a "Locked direction" row pointing to `.planning/design/CHOSEN-DIRECTION.md`. The skill's reference HTML set is filtered to the picked direction. |
| `impeccable` skill (post-CP2) | `.impeccable.md` §6 ("The locked PHILOSOPHY direction") is filled with the picked direction's name, and the skill's review logic adds direction-specific Forbidden items (e.g., Specimen forbids non-hairline borders > 1px on rectangles; Site Office forbids non-monospace audit treatments; Helm + Brass forbids drop-shadow `filter: blur(>2px)` outside the right-rail elevation). |
| `nightwork-design-system-reviewer` skill | Adds direction-specific quality bar checks at `/nightwork-design-check`. |
| PATTERNS.md (post-CP2) | The "Document Review" entry's gold-standard render updates to the picked direction's component-variant + spacing-density choices. The other 11 patterns inherit the same direction. |
| Forbidden gallery (`.impeccable.md` §3) | Direction-specific bans append. The 7 hook-enforced Forbidden items remain locked across all directions. |

### 0.3 Cross-references

| Source | Where |
|---|---|
| Token catalog | `.planning/design/SYSTEM.md` (854 lines, 14 sections — palette, type, motion, density, breakpoints, accessibility, brand-customization, Forbidden thresholds) |
| Component inventory | `.planning/design/COMPONENTS.md` (1107 lines, 17 sections — 33 primitives catalogued) |
| Pattern catalogue | `.planning/design/PATTERNS.md` (1829 lines, 14 sections — 12 page patterns including Document Review gold standard) |
| Quality contract | `.impeccable.md` (324 lines — 7 principles + Forbidden gallery + 3 reference benchmarks) |
| WCAG matrix | `.planning/design/CONTRAST-MATRIX.md` |
| Workflow rules | `.planning/design/PROPAGATION-RULES.md` |
| Slate prototype HTMLs | `.claude/skills/nightwork-design/Slate Invoice Detail.html`, `Slate Owner Portal.html`, `Slate Mobile Jobsite.html`, `Slate Owner Sign-in.html`, `Slate Draw Wizard.html`, `Slate Draw Approval Detail.html`, `Slate Immersive Build.html`, `Brand Identity Directions.html` |
| Real Nightwork invoice review | `src/app/invoices/[id]/page.tsx` (2229 lines) |
| Real Nightwork dashboard | `src/app/dashboard/page.tsx` (607 lines) |
| Real Nightwork mobile reference | `src/components/app-shell.tsx` (responsive AppShell) |
| Owner portal reference | `.claude/skills/nightwork-design/Slate Owner Portal.html` (no production code yet — Wave 4) |
| SPEC criteria | `.planning/phases/stage-1.5a-design-system-documents/SPEC.md` (v2.1 — 52 criteria) |
| PLAN tasks | `.planning/phases/stage-1.5a-design-system-documents/PLAN.md` (v2 — 47 tasks; T17 + T17a + T17b) |
| nwrp16 directive | (combines T17a thesis + T17b screen comparisons into single document with new structure) |

---

## 1. The 3 directions at a glance

| Direction | One-sentence concept | Material reference | Density default | Coastal heritage | Mood |
|---|---|---|---|---|---|
| **A — Helm + Brass** | Yacht-bridge instrumentation rendered in software. | Brushed steel + brass instrument bezels + salt-weathered metal patina. | Medium | Literal, engineering-flavored | Precise, marine-functional, slightly cold |
| **B — Specimen** | Luxury architectural-monograph plates, museum-display labels. | Hand-printed exhibit catalogue + curatorial caption strip. | Low (largest type) | Suppressed | Editorial, considered, gallery-quiet |
| **C — Site Office** | Drafting-table office, blueprint cabinets, manila folders, rubber stamps. | Carbon-paper triplicate forms, ruled ledger, telex tape. | High | Suppressed; trade-craft heritage emphasized | Archival, methodical, working-utilitarian |

### 1.1 The locked Helm + Brass concept (per nwrp16)

The maritime-engineering reference made literal. Yacht control panels, tide-gauge instruments, ship's-bridge consoles. Material reference: brushed steel + brass instrument bezels + salt-weathered metal patina. Stone Blue is the active-control hue; Slate Deep reads as brushed aluminum. JetBrains Mono dominates (instrument readouts), Space Grotesk reserved for primary headings. Hairline borders feel like control-panel etching. Audit timelines render like instrument logs with timestamped entries. Density: medium. Coastal heritage: literal, engineering-flavored. Mood: precise, marine-functional, slightly cold. Best at conveying "your project is on course."

### 1.2 The locked Specimen concept (per nwrp16)

The luxury architectural-monograph reference. Each page is a *plate* — generous margins, plate number top-corner, exhibit-style captions, hairline museum-display labels. Whitespace-rich, type-led hierarchy (Space Grotesk weights 400/500 only, never 600+). Stone Blue is rare and editorial, used like an editor's red pencil. Slate Tile is the dominant ink color. Density: low; largest type. Motion is slow, deliberate, almost academic — page-turn-like rather than instant. Coastal heritage: suppressed. Mood: editorial, considered, gallery-quiet. Best at conveying "your project is being treated with curatorial care."

### 1.3 The locked Site Office concept (per nwrp16)

The literal Ross Built site-office aesthetic. Construction office — drafting tables, blueprint cabinets, manila folders, carbon-paper triplicate forms, rubber stamps, ruled ledger paper. Eyebrows render like rubber-stamp marks. Right-rail panels read as stamped-folder metaphor with hairline shadow. Audit timelines render as Telex-style ticker marks. JetBrains Mono is dense, frequent, archival. Stone Blue is muted (a cool gray-blue, never an active hue). Slate Deep is dominant (the "ink" of the office). Density: high. Coastal heritage: suppressed; trade-craft heritage emphasized. Mood: archival, methodical, working-utilitarian. Best at conveying "every step of your build is documented and recoverable."

### 1.4 What's the same across all three

These do NOT vary by direction. They are locked at the SYSTEM.md / COMPONENTS.md / .impeccable.md layer.

- **Palette structure** — Slate (Stone Blue, Slate Deep, Slate Tile, Slate Deeper, White Sand, Oceanside, Gulf Blue, Warn, Success, Danger). Set B is the existing implementation; if Set A is picked at CP2 separately, the directions still apply (the picked palette set is independent of the picked direction).
- **Type families** — Space Grotesk (display/headings, weights 400/500), Inter (body, 14-15px), JetBrains Mono (eyebrows/money/audit, 10-11px UPPERCASE). No fourth family. Per SYSTEM §4.
- **Border radius** — 0 except avatars + status dots (`--radius-dot: 999px`). Per SYSTEM §6.
- **Logo placement** — top-right of every authenticated surface; collapses to icon-only at <360px viewport. Per CLAUDE.md UI rules Q13.
- **Document Review template** — file preview LEFT, structured fields right-rail, audit timeline at the bottom. Per PATTERNS.md §2 + .impeccable.md §4.1.
- **The 7 quality principles** in `.impeccable.md` §2 — square is the rule, tokens always, motion is functional not decorative, audit-trail seriousness, density is intentional, coastal palette not coastal cliché, type does the heavy lifting.
- **The 7 hook-enforced Forbidden items** — oversized rounded, bouncy easing, purple/pink HSL, dark glows, hardcoded hex, tenant props on primitives, sample-data leakage. Per .impeccable.md §3.1.
- **The token catalog (69 CSS variables)** — every `--*` token in SYSTEM.md is available to all 3 directions. Each direction picks DIFFERENT tokens to dominate, but doesn't add new ones.

### 1.5 What varies by direction

These DO vary. They are the substance of the pick.

| Axis | Helm + Brass | Specimen | Site Office |
|---|---|---|---|
| **Reference benchmark** (most-imported) | Stripe Dashboard's data-grid rigor | A magazine like *The Architect's Newspaper* or *Architectural Record* monograph plates | Procore's information density + Linear's keyboard ergonomics |
| **Density posture** | Medium — `--density-comfortable` default; `compact` opt-in for tables, dense data | Low — `--density-comfortable` default; never `compact` outside tables; whitespace generous | High — `--density-compact` default; `comfortable` opt-in only on forms |
| **Motion posture** | Functional, fast — 200ms ease-out for state changes; no transitions on hover | Slow, deliberate — 240ms ease-in-out for transitions; page-turn-like | Instant — 150ms ease-out; transitions feel almost instantaneous |
| **Typography weight defaults** | Space Grotesk 500 for h1, 400 for h2/h3; JetBrains Mono dominates (eyebrows + readouts + audit) | Space Grotesk 400 for h1 *and* h2/h3 (uniform editorial weight); JetBrains Mono restrained to money + eyebrows | Space Grotesk 400/500 mixed; JetBrains Mono everywhere — labels, audit, metadata, even body micro-copy |
| **Brand heritage emphasis** | Coastal-engineering hybrid; instrument vocabulary signals "marine system" | Suppressed — feels editorial/curatorial regardless of industry | Trade-craft — drafting set, ledger, stamp; coastal hue is incidental |
| **Component variant defaults** | NwButton primary/outline mix; NwCard padding `md`; NwBadge bordered (locked) | NwButton ghost dominant, primary rare; NwCard padding `lg`; NwBadge with extra side-margin | NwButton secondary/ghost mix; NwCard padding `sm`; NwBadge stamp-style (extra UPPERCASE letterspacing) |
| **Shadow usage** | `--shadow-panel` aggressive on cards and right-rail (instrument-bezel feel demands subtle elevation) | No shadows. Hairline borders only. The token `--shadow-panel` is unused. | `--shadow-panel` muted on right-rail (folder-overlap), `--shadow-hover` not used (no hover lift) |
| **Audit timeline rendering** | Instrument log: monospace entries, vertical rule, timestamp-first | Caption list: chronological with hairline dividers, generous gap | Ticker/Telex: stamp markers, dense rows, fixed-width timestamp gutter |
| **Distinctness check** | Reference: Stripe (technical, financial, instrument) | Reference: print monograph (editorial, curatorial) | Reference: Procore × Linear (industrial, archival) |

Per SPEC A1 distinctness self-review: across 4 axes (reference benchmark / density / motion / typography weight defaults), every PAIR varies on **at least 3 axes**. The 3-direction set is transitively distinct (no single axis is shared across all 3).

---

## 2. Direction A — Helm + Brass

### 2.0 Overview

Helm + Brass is the maritime-engineering reference made literal. The aesthetic vocabulary is yacht control panels, tide-gauge instruments, ship's-bridge consoles. Brushed steel + brass instrument bezels + salt-weathered metal patina inform the surface treatment. The Slate palette stays — Stone Blue (`#5B8699`) is the active-control hue, Slate Deep (`#1A2830`) is brushed aluminum, Slate Tile (`#3B5864`) is the body-text alloy. White Sand (`#F7F5EC`) reads like a paper navigation chart against the slate.

The mood is precise, marine-functional, and slightly cold. This direction conveys "your project is on course" — every readout is calibrated, every state change is logged with a timestamp, every action confirms with a quiet click. It's the direction that most strongly emphasizes Ross Built's coastal heritage: the Bradenton/Anna Maria Island setting, the relationship to water, the implied competence of yacht-club professionalism. It's also the direction most likely to appeal to clients who value the "white-glove luxury construction" mood.

JetBrains Mono dominates: it's the primary face for eyebrows, readouts, money, audit, status pills, and metadata — anywhere you'd expect numbers or codes on an instrument panel. Space Grotesk is reserved for the primary heading on a page, and for occasional section anchors that feel like navigational chart titles. Inter is the body face for prose-y descriptions, but body content is rare on a Helm + Brass surface — most fields are labels + values, treated like instrument readouts.

The right-rail of a Document Review surface reads as a control panel: a vertical strip of instruments stacked with hairline dividers between them, each with a JetBrains Mono label up top and a value below. Audit timelines render like instrument logs — a monospace event log with timestamps in the gutter and a brief description of the state change.

The single most distinguishing visual cue: every card and every right-rail panel has a 1px Stone Blue hairline at its top edge, like the brass beading at the top of an instrument bezel. This is created with `border-top: 1px solid var(--nw-stone-blue)` plus the existing `--border-default` on the other three sides. It signals "this is a calibrated instrument" without changing any shape. Combined with the locked square borders (no `rounded-*`), the panels feel like aluminum-faced instruments with brass bezel detail.

### 2.1 Token usage

| Token | Helm + Brass posture |
|---|---|
| `--bg-page` | Light: `--nw-white-sand` (`#F7F5EC`). Dark: `--nw-slate-deep` (`#1A2830`). Per SYSTEM §1i. Default. |
| `--bg-card` | Light: `#FFFFFF`. Dark: `--nw-slate-deeper` (`#132028`). The white in light mode is critical — cards read as paper navigation charts laid on the white-sand page. |
| `--bg-subtle` | Used on Card hover state and on right-rail "active panel" highlight. Helm + Brass uses this MORE than other directions because instrument panels visually distinguish active vs idle controls. |
| `--text-primary` | Light: `--nw-slate-tile`. Dark: `--nw-white-sand`. Per SYSTEM §1i. Default. |
| `--text-secondary` | Used on every label-value pair label (the JetBrains Mono UPPERCASE "READOUT NAME" above the value). Light: 70% slate-tile. |
| `--text-tertiary` | Used on data-table column-divider rules and instrument-log secondary metadata. |
| `--text-accent` | Light: `--nw-gulf-blue` (`#436A7A` per T12 patch). Dark: `--nw-oceanside` (`#CBD8DB`). Used aggressively for "active control" status — e.g., the `pm_review` status badge text, the active-tab underline, the "Open in new tab ↗" link styling. Helm + Brass uses `--text-accent` more than other directions. |
| `--border-default` | Used on every Card edge. The Slate palette's 15% slate-tile in light mode reads as etched aluminum panel-edge. |
| `--border-strong` | Used on the top-edge "brass bezel" treatment — Helm + Brass overrides `border-top` from `var(--border-default)` to `1px solid var(--nw-stone-blue)` on top-of-card and top-of-right-rail-panel. This is the direction's signature visual cue. |
| `--shadow-panel` | Aggressive use on right-rail panels. Helm + Brass cards lift with `--shadow-panel` to read as instruments mounted on the page surface. NOT a glow — opaque, downward, controlled. |
| `--shadow-hover` | Used on interactive cards (clickable rows in tables, KPI cards). Hover-lift with `--shadow-hover` reinforces "this is a control you can engage." |
| `--color-success` / `--color-warning` / `--color-error` | Used in status pills (`Approved` green, `Held` amber, `Denied` red) — NwBadge bordered, never filled (per existing skill rule). Helm + Brass uses these consistently with the skill default. |
| `--color-money` | Money values dominate on Helm + Brass surfaces. Tabular-nums + JetBrains Mono + larger size (`--fs-h3` 22px for hero totals; `--fs-md` 15px in tables). |
| `--ring` | `--nw-stone-blue`. Focus-visible 2px outline + 2px offset per SYSTEM §12b. Default. |
| `--brand-accent` | Default `--nw-stone-blue`. The "active-control hue." Tenant-customizable per SYSTEM §2. |

**Token rule overrides specific to Helm + Brass:**

- `border-top: 1px solid var(--nw-stone-blue)` on `<Card>` and right-rail `<NwCard>` instances — the brass-bezel signature. The other three sides keep `var(--border-default)`. This is implemented via a `data-direction="helm-brass"` data attribute on the body OR via a CSS class on the Card. (Either works; T20a-T20f decides.)
- `box-shadow: var(--shadow-panel)` on right-rail panels (currently only `--shadow-panel` is set, not always rendered — Helm + Brass renders it). Other directions don't.
- Mono labels run BEFORE values on every label-value pair. (Specimen does the same, but Specimen treats them with more space; Site Office does the same with stamp typography.)

### 2.2 Type usage

- **Space Grotesk** — reserved for primary page H1 (`--fs-h1` 38px, weight 500, `--tracking-tight` `-0.02em`). H2 sometimes (`--fs-h2` 30px, weight 500). Never on labels, eyebrows, money, audit, or metadata. The display face is the "navigational chart heading" face — used sparingly and with weight.
- **Inter** — body prose, descriptions, chips, and form helper text (`--fs-body` 14px, weight 400). Body weight 500 only for emphasis within prose. Helm + Brass uses Inter LESS than other directions — most surfaces are label+value pairs in JetBrains Mono.
- **JetBrains Mono** — DOMINATES. Used for:
  - Eyebrows (`--fs-label` 10px UPPERCASE, weight 500, `--tracking-eyebrow` `0.14em`)
  - Money (`--fs-md` 15px, weight 500, `tabular-nums`)
  - Audit timestamps (`--fs-label` 10px UPPERCASE for the gutter timestamp; `--fs-meta` 12px for the description)
  - Status pill text (NwBadge UPPERCASE)
  - "Open in new tab ↗" links and other meta-links
  - Table column headers
  - Instrument-log entries
  - Section anchor labels (e.g., the "INVOICE DETAILS" eyebrow above the right-rail panel)
- **Weight choices** — Space Grotesk 500 (slightly heavier than Specimen's 400-uniform). JetBrains Mono 500 (medium) UPPERCASE, occasionally 400 (regular) for lower-stakes meta.
- **Tracking choices** — `--tracking-tight` (`-0.02em`) on display headings; `--tracking-eyebrow` (`0.14em`) on UPPERCASE eyebrows; `--tracking-button` (`0.12em`) on UPPERCASE button labels. Default Inter tracking on body.

### 2.3 Component instance preferences

When Helm + Brass renders, it picks specific COMPONENTS.md variants:

- **NwButton** (Existing primitives §7.1) — primary variant for active controls (Approve, Push to QuickBooks, Submit), outline variant for navigation actions (Edit, Cancel, Download), ghost variant for tertiary (Kick Back, Hold). Mix of primary + outline + ghost in the action ribbon. Touch targets `lg` size (44px) on mobile; `xl` (56px) for high-stakes mobile actions (per SYSTEM §11; today requires `style={{ minHeight: 56 }}` override per COMPONENTS.md §7.1 gap).
- **NwCard** (Existing primitives §7.4) — `md` padding (`p-5`) on right-rail panels. The brass-bezel `border-top: 1px solid var(--nw-stone-blue)` applies here.
- **NwBadge** (Existing primitives §7.3) — `md` size, bordered (locked), JetBrains Mono UPPERCASE. Helm + Brass extends this with a small Stone Blue dot prefix on the active-state badge (`pm_review` gets a small `--dot-active` dot before the text). Optional; a `data-active="true"` attribute toggles it.
- **NwEyebrow** (Existing primitives §7.2) — `default` tone for section labels; `accent` tone (Stone Blue) for active controls; `muted` tone for read-only metadata. Used FREQUENTLY — Helm + Brass surfaces are eyebrow-heavy.
- **NwDataRow** (Existing primitives §7.5) — `horizontal` layout (label-left, value-right) is the default — instrument-readout shape. `stacked` layout only at `nw-phone`.
- **NwMoney** (Existing primitives §7.6) — `md` size in tables, `xl` size for hero totals (e.g., contract total, draw amount). Tabular-nums always. Color: `--color-money` (theme-aware).
- **NwStatusDot** (Existing primitives §7.7) — used liberally on lists and tables. Helm + Brass pairs every status pill with a status dot prefix (the dot reinforces the badge color and reads like an indicator light).
- **Combobox** (Inputs §1.4) — comfortable density. Picker chevron on right (default).
- **DataGrid** (Data display §5.2) — compact density (instrument-panel data table). Sortable column headers in JetBrains Mono UPPERCASE with chevron indicator.
- **Toast** (Feedback §3.1) — narrow strip, top-right, JetBrains Mono UPPERCASE label + Inter body. Slide-in from right with 200ms ease-out.
- **Banner** (Feedback §3.2) — info banners pinned to the top of the page (e.g., locked-record banner). Stone Blue left-edge accent.
- **AppShell** (Navigation §4.1) — desktop-with-sidebar default for list views; no-sidebar for Document Review surfaces. Nav-bar background `--nw-slate-deeper` (dark even in light mode — the sidebar/navbar is a control panel above the white-sand page).

### 2.4 Motion preferences

Within the locked Q5=A CSS-only no-bouncy constraint:

- **Default duration:** 200ms (per SYSTEM §8c)
- **Default easing:** `ease-out` (entering elements decelerate to a halt)
- **Hover transitions:** 100ms ease-out on hover-state color changes; NO transition on hover-state shadow (the `--shadow-hover` lift is instantaneous to read as a "control engaging")
- **Modal open/close:** 200ms ease-out, fade-in + slide-in-from-bottom-2 (per `tailwindcss-animate` vocabulary; sub-overshoot)
- **Drawer (mobile):** 240ms ease-out (slightly slower than modal because the drawer is a larger surface)
- **Toast slide-in:** 200ms ease-out from right
- **Status pill change** (e.g., from `pm_review` to `pm_approved`): instantaneous color flip — no transition. The state has changed; the user needs to know now, not in 200ms. (This is the direction's signature motion choice.)
- **Page transitions:** instant (no transition between routes — the next view appears at navigation completion)

The Helm + Brass motion philosophy: **functional, restrained, instrument-feel.** When a control engages, it engages. When a state changes, it shows. No anticipation, no lingering, no decorative motion.

### 2.5 RENDER 1 — Invoice Review screen

**Surface:** PATTERNS.md §2 (Document Review) instance — the gold standard. This is the most-built and most-extended pattern in Nightwork; every direction's render must show how it interprets this canonical layout.

**Viewport:** `nw-desktop` (1440×900px CSS). The render description is implementable from the description alone.

#### Layout map

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│ AppShell (NavBar — slate-deeper bg, JetBrains Mono nav links UPPERCASE, logo top-right)
│ ┌──────────────────────────────────────────────────────────────────────────────┐
│ │ Locked-record banner (only if invoice is in_draw or paid) — Stone Blue accent │
│ ├──────────────────────────────────────────────────────────────────────────────┤
│ │ Breadcrumbs trail (JetBrains Mono UPPERCASE 10px) — Home › Invoices › INV-4410│
│ ├──────────────────────────────────────────────────────────────────────────────┤
│ │ Header band (h-[120px])                                                       │
│ │   LEFT side: NwEyebrow 'INVOICE' + h1 'INV-4410 · Harborline Plumbing' +      │
│ │              NwBadge 'QA APPROVED' (bordered green) + small status dot         │
│ │              Sub: Inter 13px 'Anna Maria — Hanlon · Received Apr 17 ·          │
│ │              Assigned to Draw #9'                                              │
│ │   RIGHT side: action ribbon (3-button row)                                     │
│ │              [Download PDF]  [Reject]  [Push to QuickBooks →]                  │
│ │              ghost     ghost           primary (Stone Blue bg)                 │
│ ├──────────────────────────────────────────────────────────────────────────────┤
│ │ HERO GRID (50/50 — col-span-6 each, 1px hairline divider)                     │
│ │ ┌─────────────────────────────────┬─────────────────────────────────────────┐ │
│ │ │ LEFT — File preview (col-span-6)│ RIGHT — Right-rail panels (col-span-6) │ │
│ │ │ ───────────────────────────     │ ─────────────────────────────────       │ │
│ │ │ NwEyebrow 'SOURCE DOCUMENT'      │ INVOICE DETAILS panel                   │ │
│ │ │ + 'Open in new tab ↗' link       │ - Total $18,600 (NwMoney xl size)       │ │
│ │ │ (JetBrains Mono 10px) right      │ - Net after retainage $16,740           │ │
│ │ │ ───────────────────────────     │ - Vendor link (Stone Blue link)          │ │
│ │ │                                  │ - Project link                          │ │
│ │ │ InvoiceFilePreview               │ - Received Apr 17 · 10:04 AM            │ │
│ │ │ - PDF rendered via react-pdf     │ - Due May 17 · Net 30                   │ │
│ │ │ - position: sticky on desktop    │ - Payment terms                         │ │
│ │ │ - zoom controls bottom-right     │ - Attached to Draw #9 link              │ │
│ │ │ - subtle 'QA APPROVED' stamp at │ ─────────────────────────────────       │ │
│ │ │   bottom-right (rotated -8°,    │ COST CODE ALLOCATION panel              │ │
│ │ │   border 2px var(--nw-success)) │ - Cost code rows in DataGrid            │ │
│ │ │                                  │ - 15-410 Rough plumbing $12,400 66.7%   │ │
│ │ │   The brass-bezel border-top    │ - 15-410 Materials $1,550 8.3%          │ │
│ │ │   var(--nw-stone-blue) shows    │ - 15-420 Fixtures $3,800 20.4%          │ │
│ │ │   above the panel header.       │ - 01-500 Permits $850 4.6%              │ │
│ │ │                                  │ ─────────────────────────────────       │ │
│ │ │                                  │ AI EXTRACTION panel                     │ │
│ │ │                                  │ - 'Claude Haiku' eyebrow                │ │
│ │ │                                  │ - body Inter explaining matches         │ │
│ │ │                                  │ - ConfidenceBadge: 96% (success green)  │ │
│ │ │                                  │ ─────────────────────────────────       │ │
│ │ │                                  │ STATUS TIMELINE panel                   │ │
│ │ │                                  │ (instrument log — see §2.5 below)       │ │
│ │ │                                  │ ─────────────────────────────────       │ │
│ │ │                                  │ LIEN RELEASE panel (small)              │ │
│ │ │                                  │ - 3 lien-release status rows            │ │
│ │ └─────────────────────────────────┴─────────────────────────────────────────┘ │
│ └──────────────────────────────────────────────────────────────────────────────┘
└──────────────────────────────────────────────────────────────────────────────────┘
```

#### Header

- **Background:** `var(--bg-page)` = `--nw-white-sand` light, `--nw-slate-deep` dark
- **Logo:** top-right of the NavBar, `--brand-logo` token, sized 28×28px desktop, 22×22px tablet, icon-only at <360px
- **NavBar:** background `--nw-slate-deeper` (dark even in light mode — dark control panel band above page), padding `0 32px`, height `54px`. Nav links JetBrains Mono UPPERCASE 10px (`--fs-label`), `--tracking-eyebrow`, color `--text-secondary` default, `--text-primary` active with `--nw-stone-blue` border-bottom
- **Breadcrumbs trail:** `font-mono` `--fs-label` 10px UPPERCASE `--tracking-eyebrow`, color 40% opacity slate-tile, last crumb 85% opacity weight 500
- **Page header (`h-[120px]`):**
  - LEFT region: NwEyebrow `INVOICE` (tone=`muted`) + h1 styled via inline `font-family: var(--font-display); font-weight: 500; font-size: 30px; letter-spacing: -0.02em` → "INV-4410 · Harborline Plumbing" — inline NwBadge with `pm_approved` status text (bordered green per locked rule)
  - LEFT sub: Inter 13px, `--text-secondary`, with key data points highlighted via `font-weight: 500; color: var(--nw-stone-blue)` for the project name link
  - RIGHT region: 3-button action ribbon, `gap: 10px`, right-aligned. Each button NwButton with `size="md"` (h-36px) — primary (Push to QuickBooks → with right arrow), ghost (Reject), ghost (Download PDF). The right-arrow on the primary button is `→` ASCII, not a Heroicon — direction-flavored

#### Main content regions — the 50/50 hero grid

The signature layout from `src/app/invoices/[id]/page.tsx:1310`:

```tsx
<div
  className="grid grid-cols-1 lg:grid-cols-2 items-start"
  style={{
    gap: "1px",
    background: "var(--border-default)",   // hairline visible between cells
    border: "1px solid var(--border-default)",
  }}
>
  <div className="p-[22px]" style={{ background: "var(--bg-card)" }}>
    {/* LEFT — file preview */}
  </div>
  <div className="p-[22px]" style={{ background: "var(--bg-card)" }}>
    {/* RIGHT — right-rail panels */}
  </div>
</div>
```

**Helm + Brass override:** the WRAPPER `<div>` adds `border-top: 1px solid var(--nw-stone-blue)` (overriding `--border-default` only at the top). This is the brass-bezel signature.

##### LEFT — file preview region (col-span-6 desktop)

- **Background:** `var(--bg-card)` (`#FFFFFF` light, `--nw-slate-deeper` dark)
- **Padding:** `p-[22px]` (per real implementation; closest Tailwind step `p-6`)
- **Header band inside the panel:**
  - LEFT: h3 styled `font-family: var(--font-display); font-weight: 500; font-size: 15px; color: var(--text-primary)` — "Source document"
  - RIGHT: link styled `font-family: var(--font-mono); font-size: 10px; letter-spacing: 0.1em; text-transform: uppercase; color: var(--nw-stone-blue)` — "Open in new tab ↗"
- **InvoiceFilePreview (COMPONENTS.md §1.7 FileDropzone is upload-only — file preview is a domain component):** dispatches on file type; PDF renders via `react-pdf`, sized to fill the column width with no max-height cap (per real implementation comment). Position: sticky at desktop on `top-[120px]` to keep aligned with the header.
- **QA APPROVED stamp overlay:** if `invoice.status === 'qa_approved'`, a `pointer-events-none absolute bottom-6 right-6 px-3 py-1.5 border-2` element with `transform: rotate(-8deg); border-color: var(--nw-success); color: var(--nw-success); font-family: var(--font-mono); letter-spacing: 0.14em; font-size: 11px; font-weight: 600` overlays the PDF. (Lifted from `src/app/invoices/[id]/page.tsx:1369-1380`.)

##### RIGHT — right-rail panels region (col-span-6 desktop)

Vertical stack of 5 panels, each separated by `gap-[14px]`. Each panel is a `<NwCard variant="default" padding="md">` with the Helm + Brass `border-top: 1px solid var(--nw-stone-blue)` override.

**Panel 1 — INVOICE DETAILS** (`<NwCard padding="md">`):
- Header: NwEyebrow tone=`accent` "INVOICE DETAILS" + sub-eyebrow tone=`muted` "System metadata · editable by PM and accounting"
- Body: 2-column grid (`grid-cols-2 gap-[14px 20px]`) of NwDataRow `horizontal` layout
  - Total amount → NwMoney xl size $18,600.00 (color `--color-money`)
  - Net after retainage → NwMoney xl size $16,740.00 (color `--nw-warn` because retainage held)
  - Vendor → link "Harborline Plumbing ↗" (color `--nw-stone-blue`, `text-underline-offset-3px`)
  - Project → link "Anna Maria — Hanlon ↗"
  - Received → "Apr 17, 2026 · 10:04 AM" (`--fs-sm` 13px Inter)
  - Due → "May 17, 2026 · Net 30"
  - Payment terms → "ACH preferred · 10% retained"
  - Attached to draw → link "Draw #9 (pending) ↗"

**Panel 2 — COST CODE ALLOCATION** (`<NwCard padding="md">`):
- Header: NwEyebrow tone=`muted` "COST CODE ALLOCATION" + sub-eyebrow "AI-suggested · editable"
- Body: small DataGrid (TanStack v8) — compact density
  - Columns: cost code (JetBrains Mono 11px Stone Blue, weight 600) | description (Inter 13px) | allocated (NwMoney md right-aligned) | % of invoice (right-aligned, JetBrains Mono 12px)
  - Rows: each cost code allocation
  - Row hover: `--bg-subtle` background
  - Total row at bottom: weight 500, top border-2 `--border-default`

**Panel 3 — AI EXTRACTION** (`<NwCard padding="md">` with the Helm + Brass override AND a Stone Blue 8% bg-tinted variant):
- Override: this single panel's background is `rgba(91, 134, 153, 0.08)` (Stone Blue 8%) with border `rgba(91, 134, 153, 0.3)`. This is the "AI annotation" treatment — a Stone Blue tint signals "machine-generated context."
- Header: NwEyebrow tone=`accent` "AI EXTRACTION · CLAUDE HAIKU" with a small Stone Blue dot prefix (`<i style={{ width: 5, height: 5, background: var(--nw-stone-blue), display: 'inline-block' }} />`)
- Body: Inter 12px, line-height 1.55, `--text-primary` 85% opacity
  - "Matched vendor from tax ID (59-3388421) and PO reference. Line-item codes inferred from description + historical pattern: 94% of Harborline invoices in last 12 mo route to 15-410 labor + materials. Retainage flag applied from job default (10%)."
  - bold spans use weight 500 + `--text-primary` (full opacity)
- Footer: "CONFIDENCE 96.2% · 2 FLAGS CLEARED BY MARIA D" — JetBrains Mono 10px UPPERCASE, "96.2%" colored `--color-success` (green)

**Panel 4 — STATUS TIMELINE** (`<NwCard padding="md">`):
- Header: NwEyebrow tone=`muted` "STATUS TIMELINE · END-TO-END AUDIT"
- Body: see §2.5 audit timeline rendering below

**Panel 5 — LIEN RELEASE** (`<NwCard padding="sm">` — smaller padding because this is a side-card):
- Header: NwEyebrow tone=`muted` "LIEN RELEASE"
- Body: 3 rows of label-value pairs, separated by `border-top: 1px solid rgba(247,245,236,0.05)` (or light equivalent):
  - "Conditional partial release" / "Requested" (color `--color-success`)
  - "Signed copy on file" / "Not received" (color `--nw-warn`)
  - "Required by workflow" / "Yes · before approval"

#### Element-by-element styling (10 most distinctive elements)

1. **The brass-bezel border-top.** `border-top: 1px solid var(--nw-stone-blue)` on the hero grid wrapper AND each right-rail Card. This is the direction's most-repeated motif.
2. **The NavBar (dark control-panel band).** `background: var(--nw-slate-deeper)` regardless of theme. Logo top-right (`--brand-logo`). Nav links JetBrains Mono UPPERCASE 10px, `--tracking-eyebrow`. Active link border-bottom `2px solid var(--nw-stone-blue)`.
3. **NwEyebrow with accent tone.** "INVOICE DETAILS" rendered as `<NwEyebrow tone="accent">` — Stone Blue color, JetBrains Mono UPPERCASE 10px `--tracking-eyebrow`. The eyebrow IS the section anchor; no h2 needed.
4. **Status pill with prefix dot.** NwBadge "QA APPROVED" + a 5×5px Stone Blue square (or status dot) preceding the text. `<span class="inline-block w-2 h-2 bg-[var(--nw-success)]"></span> <NwBadge variant="success">QA APPROVED</NwBadge>`. The dot reinforces the pill color and reads like an indicator light.
5. **NwMoney hero amount.** `<NwMoney size="xl" cents={1860000} />` renders as JetBrains Mono 22px (`--fs-h3`) weight 500 tabular-nums. The `xl` size is reserved for hero totals on Document Review.
6. **The 50/50 hero grid hairline divider.** `gap: 1px` on a parent with `background: var(--border-default)` is the trick — the gap shows the parent's bg, creating a 1px hairline divider without an explicit divider element. This is preserved EXACTLY from `src/app/invoices/[id]/page.tsx:1311-1316`.
7. **The QA APPROVED stamp overlay.** Pointer-events-none absolute element rotated -8°, border 2px `--nw-success`, JetBrains Mono UPPERCASE 11px weight 600. Lifted from real implementation.
8. **The action ribbon (3 buttons, right-aligned).** NwButton primary (`bg-nw-stone-blue`) + ghost (transparent + outlined) + ghost. Right arrow `→` (ASCII) on primary "Push to QuickBooks →" — this is a Helm + Brass-flavored UPPERCASE label, not a Heroicon.
9. **The instrument log audit timeline.** See §2.5 audit timeline rendering below — vertical rule + dot-marked entries + JetBrains Mono timestamps.
10. **Status indicator dots.** NwStatusDot used as visual reinforcement next to status pills. Helm + Brass uses dots more than the other directions because instrument panels rely on indicator-light vocabulary.

#### Audit timeline rendering — instrument log

Helm + Brass renders the audit timeline as an **instrument log**. The vocabulary: vertical rule, dot-marked entries, monospace timestamps, brief description.

```
┌─ STATUS TIMELINE · END-TO-END AUDIT ──────────────────┐
│  │                                                     │
│  ●  APR 17 · 10:04                                     │
│  │  RECEIVED via email-in · ap@rossbuilt.com           │
│  │                                                     │
│  ●  APR 17 · 10:04                                     │
│  │  AUTO-CLASSIFIED by Nightwork AI — 96.2% confidence │
│  │                                                     │
│  ●  APR 17 · 10:47                                     │
│  │  REVIEWED by Maria D · 2 flags cleared              │
│  │                                                     │
│  ●  APR 17 · 10:51                                     │
│  │  QA APPROVED · ready for draw                       │
│  │                                                     │
│  ●  APR 18 · 10:42                                     │
│  │  ATTACHED TO DRAW #9 by Jake                        │
│  │                                                     │
│  ○  PENDING                                             │
│  │  Lien release from Harborline                       │
│  │                                                     │
│  ○  PENDING                                             │
│  │  Owner approval of Draw #9                          │
│  │                                                     │
│  ○  PENDING                                             │
│  │  Push to QuickBooks · pay via ACH                   │
│  ┴                                                      │
└────────────────────────────────────────────────────────┘
```

CSS shape:
- Outer wrapper: `position: relative; padding-left: 16px`
- The vertical rule: `::before { content: ""; position: absolute; left: 4px; top: 6px; bottom: 6px; width: 1px; background: var(--border-default); }`
- Each event: `position: relative; padding: 6px 0 14px`
- Event marker dot: `::before { content: ""; position: absolute; left: -16px; top: 10px; width: 9px; height: 9px; border-radius: 50%; background: var(--nw-stone-blue); border: 2px solid var(--bg-card); }`
- Done events (status changes that have happened): dot color `var(--nw-success)`
- Pending events (future state changes that have not yet happened): dot is transparent with a `--text-tertiary` 30% border (open ring)
- Event timestamp gutter: `font-family: var(--font-mono); font-size: 10px; letter-spacing: 0.1em; color: var(--text-tertiary); margin-bottom: 2px`
- Event description: `font-size: 13px; color: var(--text-primary)` with the action verb (RECEIVED, REVIEWED, etc.) styled as `font-weight: 500; color: var(--nw-stone-blue)` to make the verb stand out

This vocabulary IS direction-specific. Specimen renders the timeline as a chronological caption list with hairline dividers (no dots, no rule). Site Office renders it as a Telex-style ticker with stamp markers (square markers, not round; tabular fixed-width gutter).

#### What makes Helm + Brass distinctive in this render

- **The brass-bezel border-top** is the single most repeating motif. Every right-rail panel and the hero grid wrapper carries it. Specimen has no such treatment (hairline borders only). Site Office has a folder-overlap shadow but no bezel.
- **JetBrains Mono dominates** — eyebrows, money, audit, status, even subtle meta-links ("Open in new tab ↗"). Specimen restrains JetBrains Mono to money + eyebrows. Site Office uses it everywhere AND includes body micro-copy.
- **Status indicator dots** appear next to every status pill — instrument-readout indicator-light vocabulary. Specimen omits the dots (the pill alone is enough). Site Office uses square stamp markers, not round dots.

#### Token deep-cuts (designer reference table)

| Element | Token / value |
|---|---|
| Page bg | `--bg-page` |
| NavBar bg | `--nw-slate-deeper` (theme-invariant — always dark) |
| Card bg | `--bg-card` |
| Right-rail card top edge | `1px solid var(--nw-stone-blue)` (override) |
| Right-rail card other edges | `1px solid var(--border-default)` |
| Card body padding | `p-[22px]` (per real implementation; or `p-5` Tailwind step) |
| h1 styling | `font-family: var(--font-display); font-weight: 500; font-size: 30px; letter-spacing: -0.02em` |
| Eyebrow styling | `<NwEyebrow tone="muted" \| "accent">` (UPPERCASE JetBrains Mono 10px `--tracking-eyebrow`) |
| Body text | `font-family: var(--font-body); font-size: 13px; color: var(--text-primary)` |
| Money | `<NwMoney size="md" \| "xl" cents={...} />` (JetBrains Mono 15-22px tabular-nums) |
| Status pill | `<NwBadge variant="success" \| "warning" \| "danger">` (bordered, JetBrains Mono UPPERCASE) |
| Action button primary | `<NwButton variant="primary" size="md">Approve →</NwButton>` (Stone Blue bg, white-sand text) |
| Action button ghost | `<NwButton variant="ghost" size="md">Reject</NwButton>` |
| Hairline divider | `gap: 1px; background: var(--border-default)` parent trick |
| Audit-log dot done | `background: var(--nw-success); border: 2px solid var(--bg-card)` |
| Audit-log vertical rule | `width: 1px; background: var(--border-default)` |
| Focus-visible | `outline: 2px solid var(--ring); outline-offset: 2px` |
| Hover transition | `transition-colors duration-200 ease-out` |

### 2.6 RENDER 2 — Dashboard screen

**Surface:** PATTERNS.md §4 (Data-dense Overview) instance — the home dashboard. Reference: `src/app/dashboard/page.tsx` (607 lines).

**Viewport:** `nw-desktop` (1440×900px CSS).

#### Layout map

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│ AppShell (NavBar with dark control-panel band, JobSidebar visible left at 220px)  │
│ ┌──────────┬──────────────────────────────────────────────────────────────────┐ │
│ │ Job      │ Dashboard main column (col-span-9)                               │ │
│ │ Sidebar  │ ┌────────────────────────────────────────────────────────────┐  │ │
│ │ (220px)  │ │ Hero band — eyebrow 'TODAY · APR 30' + h1 'Welcome, Jake'    │  │ │
│ │          │ │ + sub 'You have 3 PM-review items, 1 draw pending owner'    │  │ │
│ │          │ ├────────────────────────────────────────────────────────────┤  │ │
│ │          │ │ KPI strip — 4 cells edge-to-edge with 1px hairline dividers │  │ │
│ │          │ │ ┌──────┬──────┬──────┬──────┐                                │  │ │
│ │          │ │ │ACTIVE│ PM   │ DRAW │ PMNTS│                                │  │ │
│ │          │ │ │ JOBS │QUEUE │ OPEN │  DUE │                                │  │ │
│ │          │ │ │  9   │  3   │  2   │ $184K│                                │  │ │
│ │          │ │ │      │ 2D OLD│ 5D   │ NONE │                                │  │ │
│ │          │ │ │      │      │SUBMTD│ OVRDU│                                │  │ │
│ │          │ │ └──────┴──────┴──────┴──────┘                                │  │ │
│ │          │ ├────────────────────────────────────────────────────────────┤  │ │
│ │          │ │ ATTENTION REQUIRED · 4 ITEMS                                  │  │ │
│ │          │ │ ┌────────────────────────────────────────────────────────┐  │  │ │
│ │          │ │ │ [WARN] Draw #9 awaiting owner approval — 2 days old    │  │ │ │
│ │          │ │ │ [HIGH] PM queue: 3 items pending review                │  │ │ │
│ │          │ │ │ [MED]  Vendor verification: Harborline tax ID expires │  │ │ │
│ │          │ │ │ [LOW]  Cost code 15-410 over-budget by $1,200          │  │ │ │
│ │          │ │ └────────────────────────────────────────────────────────┘  │  │ │
│ │          │ ├────────────────────────────────────────────────────────────┤  │ │
│ │          │ │ CASH FLOW · APR 2026                                         │  │ │
│ │          │ │ ┌─────────────────────────┬──────────────────────────────┐ │  │ │
│ │          │ │ │ Month invoiced $487K    │ Outstanding by aging         │ │  │ │
│ │          │ │ │ Month paid     $412K    │ ┌──────┬──────┬──────┬──────┐│ │  │ │
│ │          │ │ │ Month net      +$75K    │ │CURR  │ 30D  │ 60D  │ 90D  ││ │  │ │
│ │          │ │ │ Outstanding   $287K     │ │$184K │$58K  │$32K  │$13K  ││ │  │ │
│ │          │ │ │ Upcoming      $145K     │ └──────┴──────┴──────┴──────┘│ │  │ │
│ │          │ │ └─────────────────────────┴──────────────────────────────┘ │  │ │
│ │          │ ├────────────────────────────────────────────────────────────┤  │ │
│ │          │ │ RECENT ACTIVITY · 8 EVENTS                                   │  │ │
│ │          │ │ ┌────────────────────────────────────────────────────────┐  │  │ │
│ │          │ │ │ 10:42 — Jake attached Inv #4410 to Draw #9              │  │ │ │
│ │          │ │ │ 10:37 — Maria D approved Inv #4410                      │  │ │ │
│ │          │ │ │ 10:04 — AI parsed Inv #4410 (96% confidence)            │  │ │ │
│ │          │ │ │ 09:18 — Jake created Draw #9 for Anna Maria — Hanlon    │  │ │ │
│ │          │ │ │ ...                                                       │  │ │ │
│ │          │ │ └────────────────────────────────────────────────────────┘  │  │ │
│ │          │ └────────────────────────────────────────────────────────────┘  │ │
│ └──────────┴──────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────────────────┘
```

#### Header

- **NavBar:** same as RENDER 1 — dark control-panel band, logo top-right, JetBrains Mono nav links UPPERCASE.
- **Hero band:** padding `p-[24px 32px]`, `bg-[var(--bg-page)]`, no border (the strip below it provides the visual edge)
  - NwEyebrow tone=`muted` + Stone Blue → "TODAY · APR 30, 2026 · WED"
  - h1 styled `font-family: var(--font-display); font-weight: 500; font-size: 38px; letter-spacing: -0.02em` → "Welcome back, Jake."
  - Sub-line Inter 14px `--text-secondary` → "You have **3** PM-review items, **1** draw pending owner approval, and the next-payment cutoff is **the 5th** (in 5 days)." Bold spans use `font-weight: 500; color: var(--nw-stone-blue)`.

#### KPI strip

- **Wrapper:** `grid grid-cols-4`, `gap: 1px; background: var(--border-default); border: 1px solid var(--border-default)` — the hairline-divider trick again
- **Each cell:** `bg-[var(--bg-card)] p-[24px 28px]`
  - NwEyebrow tone=`muted` UPPERCASE label (e.g., "ACTIVE JOBS", "PM QUEUE", "DRAWS OPEN", "PAYMENTS DUE")
  - Big number: Space Grotesk weight 600 size 30px (`--fs-h2`) — note this is `weight 600`, the ONLY place Helm + Brass goes above 500 — KPIs are loud-by-design
  - Sub-text: JetBrains Mono 11px (`--fs-label-sm`) `--text-accent` (Gulf Blue) — context like "2 days old" or "5 days submitted"
  - Mini progress bar: 3px tall, `--bg-muted` background, Stone Blue fill at percentage

The brass-bezel `border-top: 1px solid var(--nw-stone-blue)` applies to the wrapper.

#### Attention required strip

- **Wrapper:** `<NwCard padding="md">` with brass-bezel override
- **Header:** NwEyebrow tone=`accent` "ATTENTION REQUIRED · 4 ITEMS"
- **Body:** vertical list of attention rows (each row a small NwCard `padding="sm"` or a flat row with hover background)
  - Each row: severity NwBadge (red WARN, amber HIGH, blue MED, green LOW) + Inter 13px description + JetBrains Mono 10px UPPERCASE timestamp gutter at right
  - Hover: `bg-[var(--bg-subtle)]`
  - Click target: 44×44px minimum (the row-link surface)

#### Cash flow region

- **Wrapper:** 2-column grid (`grid-cols-2 gap-px`) with `bg: var(--border-default)` parent — the hairline divider
- **LEFT col:** `<NwCard padding="md">` with NwEyebrow "CASH FLOW · APR 2026"
  - Body: 5 NwDataRow horizontal rows
    - "Month invoiced" / NwMoney $487K
    - "Month paid" / NwMoney $412K
    - "Month net" / NwMoney +$75K (color `--color-success`)
    - "Outstanding" / NwMoney $287K
    - "Upcoming" / NwMoney $145K
- **RIGHT col:** `<NwCard padding="md">` with NwEyebrow "OUTSTANDING BY AGING"
  - Body: 4-column micro-grid
    - "CURR" / $184K (green)
    - "30D" / $58K (warn amber)
    - "60D" / $32K (orange — `--nw-warn` darker tint)
    - "90D" / $13K (danger red)

Both cards carry the brass-bezel `border-top` override.

#### Recent activity feed

- **Wrapper:** `<NwCard padding="md">` with brass-bezel
- **Header:** NwEyebrow "RECENT ACTIVITY · 8 EVENTS"
- **Body:** chronological list, each row: 32×32px square avatar (JetBrains Mono initials, Stone Blue bg, white-sand text) + body line (Inter 13px) + timestamp gutter (JetBrains Mono 10px)
- **Reverse-chronological**, separated by hairline divider (`border-top: 1px solid var(--border-subtle)`)

#### What makes Helm + Brass distinctive in this render

- **KPI weight 600 exception** — KPIs are the only place Space Grotesk goes above 500. Helm + Brass treats them as loud "instrument readouts." Specimen never goes above 500. Site Office uses smaller KPIs and emphasizes weight 400.
- **Brass-bezel border-top everywhere** — the KPI strip, the attention card, the cash-flow cards, the activity feed. Consistent direction signal.
- **Status indicator dots paired with severity badges** in the attention list — same dot vocabulary as the invoice review.

#### Token deep-cuts

| Element | Token / value |
|---|---|
| Page bg | `--bg-page` |
| NavBar bg | `--nw-slate-deeper` |
| KPI cell bg | `--bg-card` |
| KPI big number | `font-display weight 600 size 30px` (the Helm + Brass exception to weight ≤500) |
| KPI sub-text | `font-mono size 11px color: --text-accent` |
| KPI mini progress bar | `height: 3px; bg: --bg-muted; fill: --nw-stone-blue` |
| Attention severity badge | `<NwBadge variant="danger" \| "warning" \| "info" \| "default">` |
| Cash flow row | `<NwDataRow layout="horizontal">` |
| Aging cell | sub-grid with `--text-secondary` label + `<NwMoney>` value, color `--color-success` / `--nw-warn` / `--nw-danger` per bucket |
| Activity avatar | `size-8 bg-nw-stone-blue text-nw-white-sand font-mono text-[11px] font-semibold` |
| Activity timestamp | `font-mono text-[10px] uppercase tracking-[0.1em] color: --text-tertiary` |
| Brass-bezel override (every card) | `border-top: 1px solid var(--nw-stone-blue)` |

### 2.7 RENDER 3 — Mobile Approval flow (iPhone)

**Surface:** PATTERNS.md §5 (Mobile Touch Approval) instance — the canonical mobile invoice review for PMs in the field. Reference: `.claude/skills/nightwork-design/Slate Mobile Jobsite.html`.

**Viewport:** iPhone 15 Pro (393×852pt = 393×852 CSS px). The `nw-phone` breakpoint applies.

#### Layout map (vertical scroll)

```
┌─────────────────────────────────┐
│ Status bar (iOS native)         │
├─────────────────────────────────┤
│ App nav (h-56px)                │
│ logo · spacer · bell · avatar   │
├─────────────────────────────────┤
│ Crumb (h-32px)                  │
│ HOME / JOBS / ANNA MARIA / INV  │
├─────────────────────────────────┤
│ Sticky header band (h-64px)     │
│ ┌─────────────────────────────┐ │
│ │ Eyebrow + Title + Status    │ │
│ │ INVOICE · INV-4410 [APPROVED]│ │
│ └─────────────────────────────┘ │
├─────────────────────────────────┤
│ FILE PREVIEW (full-width)       │
│ ┌─────────────────────────────┐ │
│ │                             │ │
│ │  [PDF rendered, full-width] │ │
│ │                             │ │
│ │                             │ │
│ │  Tap to expand to full-     │ │
│ │  screen                     │ │
│ │                             │ │
│ └─────────────────────────────┘ │
├─────────────────────────────────┤
│ STATUS + TOTAL row (sticky)     │
│ ┌─────────────────────────────┐ │
│ │ STATUS    │   TOTAL          │ │
│ │ QA APPRVD │   $18,600.00     │ │
│ └─────────────────────────────┘ │
├─────────────────────────────────┤
│ INVOICE DETAILS (collapsed)     │
│ ┌─────────────────────────────┐ │
│ │ INVOICE DETAILS         [+] │ │
│ └─────────────────────────────┘ │
├─────────────────────────────────┤
│ ALLOCATIONS (collapsed)         │
│ ┌─────────────────────────────┐ │
│ │ COST CODE ALLOCATION    [+] │ │
│ │ (4 codes · tap to edit)     │ │
│ └─────────────────────────────┘ │
├─────────────────────────────────┤
│ AI EXTRACTION (collapsed)       │
│ ┌─────────────────────────────┐ │
│ │ AI EXTRACTION · 96%     [+] │ │
│ └─────────────────────────────┘ │
├─────────────────────────────────┤
│ AUDIT TIMELINE (last 3 visible) │
│ ┌─────────────────────────────┐ │
│ │ AUDIT TIMELINE              │ │
│ │ ● APR 17 · 10:51 QA APPRVD  │ │
│ │ ● APR 17 · 10:47 REVIEWED   │ │
│ │ ● APR 17 · 10:04 RECEIVED   │ │
│ │ Show all →                  │ │
│ └─────────────────────────────┘ │
├─────────────────────────────────┤
│ (scrollable space)              │
├─────────────────────────────────┤
│ STICKY BOTTOM CTA (h-72px)      │
│ ┌─────────────────────────────┐ │
│ │ [APPROVE & PUSH TO QB →]    │ │
│ │ ─────── 56×56 high-stakes ──│ │
│ └─────────────────────────────┘ │
└─────────────────────────────────┘
```

#### Header

- **iOS status bar (native):** time, signal, battery — passes through.
- **App nav (`h-56px`):** background `--nw-slate-deeper` (consistent with desktop NavBar). Logo top-right (28×28px). Bell + avatar to the right of the logo. Hamburger to the left for the JobSidebar drawer.
- **Crumb (`h-32px`):** JetBrains Mono 9px UPPERCASE `--tracking-eyebrow`, color 45% opacity slate-tile. Background `--bg-card`.

#### Sticky header band

`position: sticky; top: 0` (below the iOS status bar). Z-index above the file preview. Background `--bg-card`.

- NwEyebrow `INVOICE · INV-4410` (compact density — 9px instead of 10px to save vertical space)
- Title: Space Grotesk 16px weight 500 — "Harborline Plumbing"
- Status: NwBadge `variant="success" size="sm"` "QA APPROVED"

#### File preview (top per A18.1)

Full-width, `aspect-ratio: auto` for portrait PDFs. The InvoiceFilePreview renders the PDF at the column width. Tappable to expand to full-screen overlay (a Sheet with `direction="bottom"` Drawer for mobile per COMPONENTS.md §2.3).

The brass-bezel `border-top: 1px solid var(--nw-stone-blue)` applies — visible at the top edge of the file preview region.

#### Status + Total row (sticky)

Pinned below the file preview. Background `--bg-card`. 2-column horizontal split.

- LEFT: NwEyebrow `STATUS` 9px + NwBadge `pm_approved` (smaller — 18px tall — for compact mobile)
- RIGHT: NwEyebrow `TOTAL` 9px + NwMoney `size="lg"` (Space Grotesk 17px weight 500 tabular-nums)

This row is the "always visible" reference per A18.1 — even when scrolling through accordions below.

#### Collapsed accordions

INVOICE DETAILS, COST CODE ALLOCATION, AI EXTRACTION are collapsed by default. Each renders as a tappable header bar with a `+` icon (Heroicons `PlusIcon`) on the right. Tapping expands the accordion using `tailwindcss-animate`'s `data-[state=open]:` pattern with `accordion-down` keyframe (200ms ease-out per SYSTEM §8c).

- Accordion header: padding `py-[14px] px-[20px]`, NwEyebrow tone=`muted` UPPERCASE, JetBrains Mono `+` icon at right (rotates to `−` when open)
- Accordion body when open: same content as desktop right-rail panel, but at `nw-phone` density mapping (NwDataRow stacked layout, 1-column grid)

#### Audit timeline (last 3 events visible per A18.1)

Same instrument-log shape as desktop but condensed:
- Vertical rule visible
- 3 dot-marked entries
- "Show all 8 events →" link below as a `<NwButton variant="ghost" size="sm">` — tapping opens a Sheet (`direction="bottom"`) with the full audit timeline

#### Sticky bottom CTA

`position: fixed; bottom: 0; left: 0; right: 0; padding: 12px 16px env(safe-area-inset-bottom) 16px`. Background `--bg-card` with top border `--border-default`.

- Single full-width primary button: `<NwButton variant="primary" style={{ minHeight: 56 }}>APPROVE & PUSH TO QB →</NwButton>`
- 56px high-stakes touch target (per SYSTEM §11)
- Background `--brand-accent` (defaults to Stone Blue)
- JetBrains Mono UPPERCASE 12px (slightly larger than desktop's 11px because mobile reads at arm's length)
- Right arrow `→` ASCII

Helm + Brass style choice on mobile: the sticky CTA is **always visible** while scrolling the rest of the surface. The action is the primary instrument; the rest is context.

#### Safe area handling

- Top: `padding-top: env(safe-area-inset-top)` on the iOS status bar passthrough. The app nav starts BELOW the safe area.
- Bottom: `padding-bottom: env(safe-area-inset-bottom)` on the sticky CTA. The button sits ABOVE the home-indicator gesture area.

#### Gesture zones

- File preview: tap to open full-screen Sheet, pinch-zoom inside the Sheet
- Accordions: tap to expand, tap to collapse
- Audit timeline: tap "Show all" to open Sheet
- Bottom CTA: tap to fire action
- No swipe gestures for primary actions in v1 (per A18 — taps only). Vaul's drawer handles a horizontal swipe-down to dismiss for opened drawers, but that's primitive-level.

#### Header collapse behavior

The sticky header band shrinks on scroll: when the user has scrolled past the hero, the title compresses from 16px to 13px, the status badge stays, and the title row reduces from `h-64px` to `h-44px`. This is a 200ms ease-out transition (per SYSTEM §8c). Stone Blue brass-bezel `border-bottom` appears to mark the collapsed state.

#### Audit timeline rendering on mobile

Compressed but same shape as desktop:

```
┌─ AUDIT TIMELINE ──────────┐
│  │                        │
│  ●  APR 17 · 10:51        │
│  │  QA APPROVED · ready   │
│  │                        │
│  ●  APR 17 · 10:47        │
│  │  REVIEWED by Maria D   │
│  │                        │
│  ●  APR 17 · 10:04        │
│  │  RECEIVED via email    │
│  │                        │
│  Show all 8 events →      │
└──────────────────────────┘
```

#### What makes Helm + Brass distinctive on mobile

- **Sticky CTA always visible** — the action is the primary instrument; the surface reads as a "control with a single most-likely action surfaced at the bottom."
- **Status + Total row sticky** — never lose sight of "what state is this in" and "how much money."
- **Brass-bezel border-top** carries to mobile — visible above the file preview region.
- **Indicator dots** in the audit timeline keep the instrument-log vocabulary even at compressed sizes.

#### Token deep-cuts

| Element | Token / value |
|---|---|
| Status bar | iOS native passthrough |
| App nav bg | `--nw-slate-deeper` |
| Logo size | 28×28px (collapses to 22×22px at <360px viewport) |
| Sticky header band bg | `--bg-card` |
| File preview region | `bg: --bg-card`, top border `1px solid var(--nw-stone-blue)` (brass-bezel) |
| Status pill on mobile | `<NwBadge variant="success" size="sm">` (h-18px instead of h-24px) |
| Money on Total row | `<NwMoney size="lg">` (17px Space Grotesk-equivalent JetBrains Mono — see Money component) |
| Accordion expand transition | `data-[state=open]:animate-accordion-down` (200ms ease-out) |
| Sticky bottom CTA bg | `var(--brand-accent)` |
| Sticky CTA height | `min-h-[56px]` (high-stakes touch target) |
| Audit dot done | `bg: var(--nw-success)` |
| Audit dot pending | `border: 2px solid var(--text-tertiary); bg: transparent` |

### 2.8 RENDER 4 — Owner Portal view

**Surface:** PATTERNS.md §3 (Data-dense Overview) instance, but tuned for the homeowner audience. Reference: `.claude/skills/nightwork-design/Slate Owner Portal.html`. The Owner Portal is **not** a PM dashboard — it's a hospitality-meets-status-update surface for the homeowner viewing their build progress.

**Viewport:** `nw-desktop` (1180×900px CSS — slightly narrower max-width than the PM dashboard because owner portals are read-mostly, not action-mostly).

#### Layout map

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│ NavBar (dark control-panel, "OWNER PORTAL" eyebrow center, owner name + role right) │
├──────────────────────────────────────────────────────────────────────────────────┤
│ Project header                                                                    │
│ ┌──────────────────────────────────────────────────────────────────────────────┐ │
│ │ NwEyebrow accent 'ANNA MARIA — HANLON RESIDENCE'                              │ │
│ │ h1 'Welcome back, David.'                                                     │ │
│ │ sub 'Your home build is 60% complete · Phase 4 of 7 · Target move-in Nov 26' │ │
│ └──────────────────────────────────────────────────────────────────────────────┘ │
├──────────────────────────────────────────────────────────────────────────────────┤
│ KPI strip — 4 cells (CONTRACT / BILLED / REMAINING / PENDING APPROVAL)           │
├──────────────────────────────────────────────────────────────────────────────────┤
│ Action banner (DRAW #9 IS READY FOR YOUR APPROVAL)                                │
│ ┌──────────────────────────────────────────────────────────────────────────────┐ │
│ │ EYEBROW: ⚠ ACTION REQUIRED                                                    │ │
│ │ h2: 'Draw #9 is ready for your approval'                                      │ │
│ │ note: '$175,037.50 net due · Period Apr 1–18 · 14 vendor invoices · Submitted'│ │
│ │ ACTION BUTTONS: [Review details]  [Approve & release →]                        │ │
│ └──────────────────────────────────────────────────────────────────────────────┘ │
├──────────────────────────────────────────────────────────────────────────────────┤
│ 2-col grid                                                                       │
│ ┌─────────────────────────────────┬──────────────────────────────────────────┐  │
│ │ DRAW HISTORY                    │ CHANGE ORDERS                            │  │
│ │ table (9 rows · #/Period/Status/│ table (3 rows · #/Description/Amount)    │  │
│ │ Net due/Released)                │ + Pending approvals card (CO-08)         │  │
│ └─────────────────────────────────┴──────────────────────────────────────────┘  │
├──────────────────────────────────────────────────────────────────────────────────┤
│ PROGRESS · BY PHASE                                                              │
│ ┌──────────────────────────────────────────────────────────────────────────────┐ │
│ │ 7 phase rows with progress bars (01-07, current = phase 4 in progress 62%)   │ │
│ └──────────────────────────────────────────────────────────────────────────────┘ │
├──────────────────────────────────────────────────────────────────────────────────┤
│ RECENT PHOTOS                                                                    │
│ ┌─────────┬─────────┬─────────┐                                                 │
│ │ photo 1 │ photo 2 │ photo 3 │ (3-col grid · placeholders for now)             │
│ └─────────┴─────────┴─────────┘                                                 │
├──────────────────────────────────────────────────────────────────────────────────┤
│ CONTRACTS · TEAM (2-col contact cards: Jake Ross PM, Andrew Ross Finance)        │
├──────────────────────────────────────────────────────────────────────────────────┤
│ Footer (mono small text)                                                          │
└──────────────────────────────────────────────────────────────────────────────────┘
```

#### Header

- **NavBar:** dark control-panel band (`--nw-slate-deeper`), logo top-right + "OWNER PORTAL" eyebrow center JetBrains Mono UPPERCASE 10px Stone Blue, owner name + "OWNER" role pill on the right
- **Project header:** padding `p-[36px 40px]`, `bg-[var(--bg-page)]`
  - Top eyebrow: NwEyebrow tone=`accent` JetBrains Mono UPPERCASE 10px Stone Blue → "ANNA MARIA — HANLON RESIDENCE"
  - h1: Space Grotesk weight 500 size 34px tracking-tight → "Welcome back, David."
  - Sub: Inter 14px `--text-secondary` with `font-weight: 500; color: var(--text-primary)` on key data → "Your home build is **60% complete** · Phase 4 of 7 · Target move-in **November 2026**"

#### KPI strip

Same shape as the PM dashboard's KPI strip, but tuned for owner readability:
- 4 cells with hairline dividers
- Larger numbers (Space Grotesk weight 600 size 30px — same exception as PM dashboard)
- Owner-facing labels: "CONTRACT", "BILLED TO YOU", "REMAINING", "PENDING YOUR APPROVAL"
- Mini progress bars below each number with Stone Blue fill
- The PENDING YOUR APPROVAL cell uses `--nw-warn` color on the number ($175k) to draw attention

#### Action banner (high-priority surface for owners)

- Background: `--nw-slate-deep` (dark — even in light theme this is a dark island)
- Foreground: `--nw-white-sand`
- Padding: `p-[24px 28px]`
- LEFT region:
  - NwEyebrow tone=`warn` (`--nw-warn` orange) → "⚠ ACTION REQUIRED" (the only place a small "warning" emoji is allowed in the entire surface — it carries semantic weight)
  - h2: Space Grotesk 22px weight 500 → "Draw #9 is ready for your approval"
  - note: Inter 13px 65% opacity → "$175,037.50 net due · Period Apr 1–18 · 14 vendor invoices · Submitted by Jake Ross today at 10:42 AM"
- RIGHT region: 2 buttons
  - `<NwButton variant="ghost-dark">Review details</NwButton>` (transparent + outlined white)
  - `<NwButton variant="primary">Approve & release →</NwButton>` (Stone Blue bg)

#### 2-column tables grid

- **Wrapper:** `grid grid-cols-[1.4fr_1fr] gap-px` with `bg: var(--border-default)` parent — hairline divider trick
- **LEFT col — Draw history:** `<NwCard padding="md">`
  - Header: NwEyebrow "DRAW HISTORY" + sub "Every payment you've released on this project"
  - Body: `<table>` with 5 columns (`#`, `Period`, `Status`, `Net due`, `Released`)
  - Status pills: NwBadge bordered (variant by status — `await` Stone Blue, `pending` warn, `approved` success, `paid` muted)
  - Money cells: NwMoney md tabular-nums right-aligned
  - Hover: `bg: var(--bg-subtle)`
- **RIGHT col — Change orders:** stacked sections in a single Card
  - Top section: small CO table (3 rows + total row)
  - Bottom section: NwEyebrow "PENDING APPROVALS" + a tinted box for CO-08 with 2 action buttons

Both cards carry the brass-bezel `border-top: 1px solid var(--nw-stone-blue)` override.

#### Progress by phase

A single card with 7 phase rows:
- Row layout: `<div class="prog">`
  - Top line: `<b>` (weight 500) phase label + sub-text "Complete · Nov 2025" right-aligned (JetBrains Mono 11px)
  - Progress bar: `height: 5px; bg: --bg-muted` with fill bar
  - Fill color: `--color-success` for complete, `--brand-accent` (Stone Blue) for in-progress, `--bg-muted` for upcoming

The current phase (Phase 4 — Insulation & Drywall) shows 62% fill in Stone Blue with the JetBrains Mono "62%" sub-text.

#### Recent photos

- 3-column grid of photo placeholders (4:3 aspect ratio, gradient backgrounds for the placeholder; production version pulls from job photo storage)
- Each photo has a JetBrains Mono caption at bottom-left

#### Contractor team

- 2-column grid of contact cards
- Each card: `<div class="contact">` with `bg: rgba(91,134,153,0.06); border: 1px solid rgba(91,134,153,0.2)` (Stone Blue 6% / 20%) — the only non-card-bg surface on the page
- Inside: name (Inter 13px weight 500), role (NwEyebrow tone=`accent` Gulf Blue), phone + email links (Inter 11.5px Gulf Blue)

#### Footer

- 1px top border `--border-default`
- 24px padding-top, 50px margin-top
- Footer content: JetBrains Mono 10px UPPERCASE `--tracking-eyebrow` 60% opacity slate-tile
  - LEFT: "Nightwork Owner Portal · Anna Maria — Hanlon"
  - RIGHT: "Last updated · Apr 30, 2026 · 10:47 AM"

#### Audit timeline rendering on owner portal

The owner portal does NOT render the per-invoice audit timeline (that's PM-grade detail). Instead, the **draw history table** serves as the audit trail at the owner level — each draw row IS an audit entry from the owner's perspective. The "Released" column shows the date the homeowner approved the draw, which is the owner-relevant audit datum.

#### What makes Helm + Brass distinctive on the Owner Portal

- **The dark action banner.** A `--nw-slate-deep` island with white-sand text inside the otherwise white-sand page. This is direction-specific — Specimen would render this banner as a hairline-bordered editorial pull-quote; Site Office would render it as a stamped manila-folder card.
- **The brass-bezel border-top** carries throughout — KPI strip, draw history table, change orders card, progress card.
- **The action banner's primary CTA uses `--brand-accent`** (Stone Blue by default) — owners see the tenant's brand color on the most important action.
- **Owner-facing eyebrow tone** — accent (Stone Blue) for project header, muted for table headers. Helm + Brass keeps the eyebrow vocabulary consistent across audiences.

#### Token deep-cuts

| Element | Token / value |
|---|---|
| NavBar bg | `--nw-slate-deeper` (dark band) |
| Owner role pill | `<span class="font-mono text-[10px] uppercase tracking-[0.12em] border border-[var(--text-inverse)]/30 px-2 py-0.5">OWNER</span>` |
| Project header eyebrow | `<NwEyebrow tone="accent">` (Gulf Blue/Stone Blue) |
| h1 styling | `font-display weight 500 size 34px tracking-tight` |
| KPI big number | `font-display weight 600 size 30px` (the loud-by-design exception) |
| Action banner bg | `--nw-slate-deep` |
| Action banner eyebrow | `<NwEyebrow tone="warn">` |
| Action banner primary CTA | `<NwButton variant="primary">` (Stone Blue bg + white-sand text) |
| Draw history status pills | `<NwBadge variant="info" \| "warning" \| "success" \| "default">` |
| Money in tables | `<NwMoney size="md" tabular-nums>` |
| Progress bar fill (in-progress) | `bg: --brand-accent` |
| Progress bar fill (complete) | `bg: --color-success` |
| Contact card | `bg: rgba(91,134,153,0.06); border: 1px solid rgba(91,134,153,0.2)` (Stone Blue 6%/20%) |

### 2.9 Honest weaknesses

#### Worst for: dense schedule grids (Wave 2 — daily-log + Gantt-like schedule)

When the schedule + daily log surfaces ship in Wave 2, they will be the densest information in Nightwork. Helm + Brass's instrument-readout vocabulary — JetBrains Mono dominating, KPI weight 600 emphasis, status indicator dots, brass-bezel border-tops — adds visual noise at high data density. A 30-day schedule grid with 14 active jobs has too many individual cells for an "instrument panel" treatment to read cleanly. The brass-bezel signature on every panel creates 14+ Stone Blue hairlines competing for attention. The schedule needs flat, reductive density (more like Site Office's ledger paper), not Helm + Brass's medium-density-with-decoration approach.

#### Concession: warmth

Helm + Brass is the coldest of the three directions. The instrument vocabulary, the JetBrains Mono dominance, the indicator-light dots, the brass-bezel hairlines — all of it adds up to "calibrated, technical, marine-functional." This works on the PM dashboard and the invoice review (where seriousness is the brand), but the owner portal is a place where Ross Built wants to convey hospitality and curatorial attention to the homeowner. Helm + Brass renders the owner portal as more functional than gracious — it answers "what's the status of my build" but not "how does it FEEL to be inside this experience." Specimen handles the warmth-and-curatorial-attention angle better; Site Office handles trade-craftsmanship-as-warmth better; Helm + Brass picks "cold competence" over either.

#### Risk: brass/marine vocabulary becomes affected over many releases

By 100k tenants — a future state Nightwork is designed for at the multi-tenant architecture level — the Helm + Brass aesthetic might feel stuck in a "yacht-club" association rather than scaling to a multi-state, non-coastal contractor. A custom-home builder in Nashville or Phoenix or Park City might find the maritime vocabulary alien. The brass-bezel hairline reads as decorative when the customer doesn't have the salt-water frame of reference. Over 5+ years of releases, the direction's heritage-emphasis (which was a strength for Ross Built specifically) becomes a constraint that newer features have to work around — every new surface has to decide "do I add the brass-bezel or do I look out-of-character?"

#### Mitigation if picked: build a "utility" Density mode that suppresses the brass detail on dense surfaces

If Jake picks Helm + Brass, the mitigation is to formalize a **"utility" Density mode** that suppresses the brass-bezel border-top and reduces JetBrains Mono frequency on dense surfaces (schedule grids, daily logs, large data tables). This adds a third density token alongside `--density-compact` and `--density-comfortable`: `--density-utility` (per SYSTEM §10 extension). Components consuming `density="utility"` opt out of the brass-bezel decoration and use plain `--border-default` on all four sides. The Forbidden gallery (per .impeccable.md §3 extension) gains a Helm-Brass-specific item: "Brass-bezel decoration on a `density="utility"` surface — read as wrong-mode mismatch."

The reservation stays intact: full Helm + Brass treatment on **canonical surfaces** (invoice review, draw approval, owner portal, dashboard) where the seriousness reads as quality. Utility mode covers the dense data surfaces where the decoration would compete.

This is a real plan, not a get-out-of-jail-free. Implementation: PROPAGATION-RULES.md gets a new token-add workflow entry for `--density-utility`; SYSTEM.md §10 adds a third density mode; the post-edit hook gets a new check that warns (not rejects) if a known-dense surface (`*schedule*`, `*daily-log*`, `*data-grid*` filename heuristic) renders Helm + Brass decoration without `density="utility"`.

---

## 3. Direction B — Specimen

### 3.0 Overview

Specimen is the luxury architectural-monograph reference. The aesthetic vocabulary is print: each page is a *plate* — generous margins, plate number top-corner, exhibit-style captions, hairline museum-display labels. The reference benchmark is a magazine like *The Architect's Newspaper* monograph plates or a curated architectural exhibition catalog.

The Slate palette stays — Slate Tile (`#3B5864`) is the dominant ink color, replacing the Helm + Brass instinct of Stone Blue everywhere. Stone Blue (`#5B8699`) becomes RARE in Specimen — used like an editor's red pencil, only on the most editorially-significant element on a page (typically a single link or a single eyebrow accent). White Sand (`#F7F5EC`) is the page; cards float on it with hairline borders only.

The mood is editorial, considered, and gallery-quiet. This direction conveys "your project is being treated with curatorial care" — every surface feels like the index page of a luxury build monograph. The aesthetic appeals to clients who value high-end residential architecture mood: gallery owners, architects, design-conscious owners who recognize editorial typography.

The most distinguishing visual cue: **whitespace and hairline borders are the entire decorative vocabulary.** No shadows, no brass-bezel decoration, no indicator dots paired with badges. The hierarchy comes from typography (size, weight, tracking) and spatial generosity. Cards have larger padding (`p-8` to `p-10`) and generous margins between them. The 50/50 hero grid keeps its hairline divider, but the cards inside breathe — there's no drive to maximize density.

Space Grotesk is the workhorse — used at weight 400 for h1 AND h2 AND h3 (uniform editorial weight, never weight 500 except as emphasis-within-prose). The single-weight choice creates a quiet, considered hierarchy that relies on size (38px / 24px / 17px) rather than weight to differentiate. Inter is the body face for prose-y descriptions. JetBrains Mono is RESTRAINED — used only for money (the financial discipline the system enforces) and for plate-number eyebrows ("PLATE 04 / 12" type labels). NOT used for status pills (Specimen renders status as Inter italic 13px), NOT used for table column headers (Specimen renders them as Inter 12px small caps).

The right-rail of a Document Review surface reads as a curatorial caption strip: a vertical list of label-value pairs with generous gaps (`gap-6` instead of `gap-3`), Inter labels (NOT JetBrains Mono — the editorial choice), and Inter values. The audit timeline reads as a chronological caption list — date in italic Inter, description in regular Inter, separated by hairline dividers.

The single-most-distinguishing visual cue is the **plate-number eyebrow** that sits in the top-right corner of every section, like the plate number on an architectural-monograph spread. "PLATE 04 / 12" or "FIGURE 03" — JetBrains Mono UPPERCASE 9px (smaller than the standard 10px), `--text-tertiary` color, positioned with `position: absolute; top: 16px; right: 16px`. This is the direction's signature.

### 3.1 Token usage

| Token | Specimen posture |
|---|---|
| `--bg-page` | Light: `--nw-white-sand`. Dark: `--nw-slate-deep`. Default. **Specimen lives almost exclusively in light mode** — the editorial vocabulary doesn't translate well to dark. (Dark mode renders, but with a noticeable "this is a dark version of an editorial piece" character.) |
| `--bg-card` | Light: `#FFFFFF`. Dark: `--nw-slate-deeper`. Default. Specimen uses `--bg-card` LESS than other directions because cards float on the page surface rather than dominating. |
| `--bg-subtle` | Used VERY rarely. Hover state on rows in tables is the only place. Specimen wants cards to feel still, not "alive." |
| `--bg-muted` | Used as a quiet table-stripe alternation if any (most Specimen tables omit striping). |
| `--text-primary` | `--nw-slate-tile`. The dominant ink color of the entire surface. Specimen uses this for h1, h2, h3, body, table cells, badges — anywhere weight + size carry the hierarchy. |
| `--text-secondary` | Used on labels, helper text, captions. Italic Inter 13px in Specimen-flavored places (e.g., audit timeline descriptions). |
| `--text-tertiary` | Plate-number eyebrows, footnotes, "Page N of M" captions. |
| `--text-accent` | RARE. Used on a single editorial highlight per page — the "Open in new tab ↗" link, or the status pill in the header. The editor's red pencil rule. |
| `--border-default` | Used on every Card edge. Specimen relies on this MORE than other directions because hairline borders are the primary structural device. |
| `--border-subtle` | Used on internal dividers within cards (e.g., between a label-value list and the audit timeline within a single right-rail panel). |
| `--shadow-panel` | **NOT USED.** Specimen has no shadows. The token exists in SYSTEM.md but Specimen-flavored components opt out. |
| `--shadow-hover` | **NOT USED.** Hover changes the border color (to `--text-accent` or `--border-strong`), not the elevation. |
| `--color-success` / `--color-warning` / `--color-error` | Used in status pills, but with reduced contrast — Specimen's NwBadge variant gets a slightly lighter ink color (border `--color-success/0.7`, text `--color-success/0.9`) so the pill reads as quiet rather than alarming. |
| `--color-money` | `--text-primary`. Specimen renders money in `--text-primary` — the same ink as the prose. Tabular-nums. JetBrains Mono. |
| `--ring` | `--nw-stone-blue`. Default focus-visible 2px. |
| `--brand-accent` | Default `--nw-stone-blue`. Used VERY rarely on Specimen surfaces. Only the primary CTA on the page. |

**Token rule overrides specific to Specimen:**

- `--shadow-panel` and `--shadow-hover` are **opted out of**. All cards have `box-shadow: none`. The hairline border is the entire structural device.
- Card padding goes from `--space-5` (20px) default to `--space-8` (32px) or `--space-10` (40px) — generous.
- Section-level `gap-*` increases from default `gap-3` (12px) to `gap-6` (24px) or `gap-8` (32px) between cards on a page.
- The `--text-accent` semantic gets used SPARINGLY — once or twice per page, not on every label as Helm + Brass does. The editor's red pencil rule.

### 3.2 Type usage

- **Space Grotesk** — the workhorse face. Used at weight 400 for h1, h2, AND h3 — uniform editorial weight. Sizes:
  - h1: `--fs-h1` 38px tracking-tight
  - h2: `--fs-h2` 30px tracking-tight
  - h3: `--fs-xl` 20px or `--fs-h3` 22px tracking-tight
  - Section anchor: `--fs-lg` 17px tracking-tight
  Weight 500 is reserved for **emphasis within prose only** (e.g., a bold phrase inside a sentence). Weight 600+ never used.
- **Inter** — body face for prose, descriptions, labels, helper text, table cells, status pill text. The dominant body face.
  - Body: 14px (`--fs-body`)
  - Sub/caption: 13px (`--fs-sm`)
  - Italic 13px for chronological captions in the audit timeline
- **JetBrains Mono** — RESTRAINED to:
  - Money values (`--fs-md` 15px in tables, `--fs-h3` 22px for hero totals — but the size is smaller than Helm + Brass's hero, because Specimen doesn't go for "loud KPI")
  - Plate-number eyebrows ("PLATE 04 / 12", "FIGURE 03") — `--fs-label` 9px (smaller than standard 10px) UPPERCASE `--tracking-eyebrow`
  - Tabular metadata in print views (G702/G703 forms — Specimen retains JetBrains Mono there because print is the domain where mono is functional)
  
  NOT used for status pills, table column headers, NavBar nav links, or general eyebrows. Specimen renders those in Inter small caps or italic.

- **Weight choices** — Specimen is the weight-400-uniform direction. Almost everything is 400. Weight 500 is emphasis-within-prose only. The editorial vocabulary depends on this weight uniformity to read as quiet.

- **Tracking choices** — `--tracking-tight` (`-0.02em`) on display headings; `--tracking-eyebrow` (`0.14em`) on the rare UPPERCASE eyebrow; default Inter tracking on body. NO `--tracking-button` (Specimen buttons are not UPPERCASE — they use sentence case).

### 3.3 Component instance preferences

When Specimen renders, it picks specific COMPONENTS.md variants:

- **NwButton** (Existing primitives §7.1) — `ghost` variant DOMINATES (transparent + 1px hairline border). `primary` variant is RARE — only one or two per page on Specimen. `secondary` for routine actions. Buttons use sentence case (NOT UPPERCASE) — Specimen's button labels are "Approve" not "APPROVE", "Push to QuickBooks" not "PUSH TO QUICKBOOKS". The font-mono inline style stays (Specimen accepts that NwButton uses JetBrains Mono — the button is a small place where mono survives) but the `text-transform: uppercase` is overridden via a `data-direction="specimen"` data attribute on the body OR via a `case="sentence"` prop on NwButton (T20a follow-up).
- **NwCard** (Existing primitives §7.4) — `lg` padding (`p-6` = 24px) or larger. Cards are spacious. The brass-bezel border-top is NOT applied. Cards use plain `--border-default` on all four sides.
- **NwBadge** (Existing primitives §7.3) — bordered (locked), but with `--text-secondary` color override on the badge text (slightly muted). The variant set still applies (`success` / `warning` / `danger`), but the border + text use `/0.7` opacity for a quieter read. Specimen badges use sentence case ("Approved", "Held", "Denied") via the same `case="sentence"` prop as buttons.
- **NwEyebrow** (Existing primitives §7.2) — used SPARINGLY. Most sections don't have eyebrows; they have plate-number captions instead. When NwEyebrow IS used, it's `default` tone (slate-tile) or `accent` (rare — the editor's red pencil).
- **Plate-number eyebrow (NEW Specimen-flavored composition):** `<span style={{ position: 'absolute', top: 16, right: 16, fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-tertiary)' }}>PLATE 04 / 12</span>` — composed inline; T20a may codify as `<PlateNumber spread={4} of={12} />` if it appears 5+ places.
- **NwDataRow** (Existing primitives §7.5) — `stacked` layout (label-on-top, value-below) is the default — editorial caption-and-figure shape. `horizontal` layout only on tables.
- **NwMoney** (Existing primitives §7.6) — `md` size in tables, `lg` size for emphasis. Color `--text-primary` (NOT `--color-money`). Specimen renders money the same ink as prose.
- **NwStatusDot** (Existing primitives §7.7) — RARE. Specimen omits the status dot pairing — the badge alone is the indicator.
- **Combobox** (Inputs §1.4) — comfortable density. Specimen extends with extra `gap-2` between input and chevron icon, and uses Heroicons `ChevronDownIcon` outline (not the lucide `ChevronDownIcon` — the icon-library boundary applies).
- **DataGrid** (Data display §5.2) — comfortable density (NOT compact). Editorial tables breathe.
- **Toast** (Feedback §3.1) — slow slide-in (240ms ease-in-out per Specimen motion preference). Strip is wider with more padding (`px-6 py-4`). Inter body, no UPPERCASE label.
- **Banner** (Feedback §3.2) — `info` banners use Inter italic with hairline border (`--border-default`). No bold accent at left edge. Quiet.
- **AppShell** (Navigation §4.1) — desktop-with-sidebar default, but the sidebar is wider (260px instead of 220px) and JobSidebar items have more vertical breathing room (h-44px instead of h-36px). NavBar background is `--bg-page` (light, NOT dark) — Specimen reads better with a uniform light surface across NavBar + page. Logo top-right, larger (32×32px, vs Helm + Brass 28×28px).

### 3.4 Motion preferences

Within the locked Q5=A CSS-only no-bouncy constraint:

- **Default duration:** 240ms (slower than Helm + Brass's 200ms — Specimen wants transitions to feel deliberate, page-turn-like)
- **Default easing:** `ease-in-out` (symmetric — entering AND leaving deceleration, more contemplative than `ease-out` alone)
- **Hover transitions:** 150ms ease-in-out on color changes; the hover effect changes the border color from `--border-default` to `--border-strong` (or `--text-accent` for emphasis), NOT the elevation
- **Modal open/close:** 300ms ease-in-out, fade-in only (no slide-in — modals appear quietly, like a printed insert sliding into place)
- **Drawer (mobile):** 320ms ease-in-out (slow page-turn-like; Vaul's drag gesture overrides this for direct-manipulation consistency)
- **Toast slide-in:** 240ms ease-in-out from right
- **Status pill change:** 240ms color transition (slow — Specimen lets you see the change happen, like ink drying)
- **Page transitions:** 200ms fade-in on content (route transitions feel like page-turns)

The Specimen motion philosophy: **slow, deliberate, page-turn-like.** The user reads the surface; the surface waits for the user. Every transition is contemplative.

### 3.5 RENDER 1 — Invoice Review screen

**Surface:** PATTERNS.md §2 (Document Review) instance — the gold standard. Same data as Helm + Brass's RENDER 1, but interpreted through the Specimen direction.

**Viewport:** `nw-desktop` (1440×900px CSS).

#### Layout map

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│ NavBar (LIGHT bg — --bg-page; logo top-right; sentence-case nav items in Inter)   │
│ ┌──────────────────────────────────────────────────────────────────────────────┐ │
│ │ Locked-record banner (only if invoice in_draw or paid) — italic, hairline     │ │
│ ├──────────────────────────────────────────────────────────────────────────────┤
│ │ [PLATE 01 / 04]                                                                │ │
│ │ Breadcrumbs — Home / Invoices / INV-4410 (Inter 12px italic; / separators)    │ │
│ ├──────────────────────────────────────────────────────────────────────────────┤
│ │ Generous header band (h-[140px], padding 32px 48px)                            │
│ │   LEFT: NwEyebrow 'Invoice' (sentence case Inter italic OR JetBrains Mono)    │ │
│ │         h1 (size 38, weight 400) 'INV-4410 — Harborline Plumbing'              │ │
│ │         (uses em-dash via CSS variable replacement to avoid the literal em    │ │
│ │          dash forbidden in copy — see .impeccable.md §3.2)                     │ │
│ │         status: NwBadge 'Approved' sentence case, hairline border, /0.7 opa   │ │
│ │   sub: Inter 14px italic 'Anna Maria — Hanlon · Received Apr 17, 2026 ·       │ │
│ │        Assigned to Draw 9'                                                     │ │
│ │   RIGHT: ghost-button row (sentence case)                                      │ │
│ │         [Download]  [Reject]  [Push to QuickBooks]                              │ │
│ │         all ghost; the Push button gets sub-text 'primary action' below it    │ │
│ │         in italic 11px to clarify hierarchy (no bg color difference)          │ │
│ ├──────────────────────────────────────────────────────────────────────────────┤
│ │ HERO GRID (50/50 — col-span-6 each, larger gap)                                │
│ │ ┌────────────────────────────────────┬─────────────────────────────────────┐ │ │
│ │ │ LEFT — File preview (col-span-6)   │ RIGHT — Right-rail panels (col-span-│ │ │
│ │ │ + plate number top-right '04/12'   │ 6) + plate number top-right '05/12'│ │ │
│ │ │ ──────────────────────────         │ ──────────────────────────────      │ │ │
│ │ │ Section header: 'Source document'  │ Section header: 'Invoice details'   │ │ │
│ │ │ (Space Grotesk weight 400, 17px)   │ (Space Grotesk weight 400, 17px)    │ │ │
│ │ │ Sub: 'Click to enlarge.' (italic)  │ Sub: 'Last updated by Maria D, Apr  │ │ │
│ │ │ ──────────────────────────         │ 17 at 10:51 AM.' (italic Inter 13)  │ │ │
│ │ │                                    │ ──────────────────────────────      │ │ │
│ │ │ InvoiceFilePreview                 │ NwDataRow stacked × N (label-above- │ │ │
│ │ │ - PDF rendered with --shadow-none  │ value pattern, gap-6 between rows)  │ │ │
│ │ │ - generous padding around PDF      │ - 'Total' / NwMoney lg              │ │ │
│ │ │ - no overlay stamp (Specimen does  │ - 'Net after retainage' / NwMoney   │ │ │
│ │ │   not use the QA APPROVED rotated  │ - 'Vendor' / link 'Harborline       │ │ │
│ │ │   stamp — too theatrical)          │   Plumbing' (italic blue underline) │ │ │
│ │ │                                    │ - 'Project' / link                  │ │ │
│ │ │                                    │ - 'Received' / Apr 17, 2026 ·       │ │ │
│ │ │                                    │   10:04 AM (Inter 13)               │ │ │
│ │ │                                    │ - 'Due' / May 17, 2026 (Inter 13)   │ │ │
│ │ │                                    │ - 'Payment terms' / 'ACH preferred  │ │ │
│ │ │                                    │   · 10% retained' (Inter 13)        │ │ │
│ │ │                                    │ - 'Attached to draw' / link 'Draw 9'│ │ │
│ │ └────────────────────────────────────┴─────────────────────────────────────┘ │ │
│ │ Below hero: cost code allocation + AI extraction + status timeline + lien     │ │
│ │ release — each in its own pull-quote card with hairline borders, generous     │ │
│ │ padding (p-8), and editorial captions                                          │ │
│ └──────────────────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────────────────┘
```

#### Header

- **NavBar:** background `--bg-page` (light — NOT the dark control-panel band of Helm + Brass). Border-bottom `--border-default`. Logo top-right (32×32px). Nav items are Inter 13px sentence case (NOT UPPERCASE) — "Dashboard", "Financial", "Operations", "Admin". Active item gets a 1px Stone Blue underline.
- **Plate number caption:** "PLATE 01 / 04" — JetBrains Mono UPPERCASE 9px `--tracking-eyebrow` `--text-tertiary`, positioned `position: sticky; top: 16px; right: 32px; z-index: 10` (or absolute within page wrapper; T20a decides).
- **Breadcrumbs trail:** Inter 12px italic — "Home / Invoices / INV-4410 — Harborline Plumbing". The italic + the / separator (instead of › chevron) is direction-specific.
- **Page header (`h-[140px]`, padding `p-[32px 48px]`):**
  - LEFT region:
    - NwEyebrow `default` tone, sentence case "Invoice" (NOT UPPERCASE — Specimen uses sentence case eyebrows)
    - h1 styled via inline `font-family: var(--font-display); font-weight: 400 (NOT 500); font-size: 38px; letter-spacing: -0.02em` → "INV-4410 — Harborline Plumbing" (the "—" is the dash variable per .impeccable.md §3.2)
    - inline NwBadge "Approved" sentence case with `--text-secondary` color override
  - LEFT sub: Inter 13px italic, `--text-secondary` → "Anna Maria — Hanlon · Received April 17, 2026 · Assigned to Draw 9"
  - RIGHT region: 3-button action ribbon, `gap-3`, right-aligned
    - All 3 buttons are ghost variant (transparent + hairline `--border-default`)
    - "Download" / "Reject" / "Push to QuickBooks"
    - The "Push to QuickBooks" button has a small `<sub>` underneath: italic Inter 11px `--text-tertiary` "Primary action" — Specimen makes hierarchy explicit through caption text rather than color/weight differentiation

#### Main content regions — the 50/50 hero grid

Same wrapper structure as Helm + Brass's RENDER 1 — but the WRAPPER `<div>` does NOT add the brass-bezel border-top. Plain `--border-default` on all four sides.

##### LEFT — file preview region (col-span-6 desktop)

- **Background:** `var(--bg-card)` (`#FFFFFF` light)
- **Padding:** `p-8` (32px) — larger than Helm + Brass's `p-[22px]`
- **Plate number caption:** "PLATE 04 / 12" top-right at `position: absolute; top: 16px; right: 16px`
- **Section header:**
  - Title: Space Grotesk weight 400 size 17px → "Source document"
  - Sub: italic Inter 13px `--text-secondary` → "Click to enlarge."
- **InvoiceFilePreview:** PDF rendered. `--shadow-panel` is **opted out**. The PDF has only a `--border-subtle` 1px border around the canvas region.
- **No QA APPROVED stamp overlay.** Specimen does not use the rotated stamp — too theatrical.

##### RIGHT — right-rail panels region (col-span-6 desktop)

Vertical stack of 5 panels, each separated by `gap-6` (24px — larger than Helm + Brass's `gap-[14px]`).

**Panel 1 — Invoice details** (`<NwCard padding="lg">`):
- Section header:
  - Title: Space Grotesk weight 400 size 17px → "Invoice details"
  - Sub: italic Inter 13px → "Last updated by Maria D, April 17 at 10:51 AM."
- Plate number caption: "PLATE 05 / 12"
- Body: vertical stack of NwDataRow stacked layouts (label-above-value). `gap-6` between rows.
  - Total / NwMoney lg ($18,600.00) — color `--text-primary`
  - Net after retainage / NwMoney lg ($16,740.00) — color `--text-primary` (NOT warn — Specimen lets the label "Net after retainage" carry the meaning, no color signal)
  - Vendor / italic blue underlined link "Harborline Plumbing"
  - Project / italic blue underlined link "Anna Maria — Hanlon"
  - Received / Inter 13px "April 17, 2026 at 10:04 AM"
  - Due / Inter 13px "May 17, 2026 (Net 30)"
  - Payment terms / Inter 13px "ACH preferred, 10% retained"
  - Attached to draw / italic blue underlined link "Draw 9"

**Panel 2 — Cost code allocation** (`<NwCard padding="lg">`):
- Plate number "06 / 12"
- Section header: "Cost code allocation" + sub italic "AI-suggested. Editable."
- Body: simple HTML table (NOT DataGrid — Specimen prefers semantic table for the editorial feel)
  - Columns: code (Inter italic) | description (Inter) | allocated (NwMoney md right-aligned) | percent (right-aligned italic)
  - Rows separated by `--border-subtle`
  - No row hover (Specimen doesn't activate rows)

**Panel 3 — AI extraction** (`<NwCard padding="lg">`):
- Plate number "07 / 12"
- Section header: "AI extraction" + sub italic "Generated by Claude Haiku, 96% confidence."
- Body: pull-quote-style block
  - Long-form prose: "Matched vendor from tax ID and PO reference. Line-item codes inferred from description and historical pattern: 94% of Harborline invoices in last 12 months route to 15-410 labor and materials. Retainage flag applied from job default of 10%."
  - Inter 13px line-height 1.65 — generous reading line-height
  - Bold inline emphasis uses weight 500
- Footer: small italic "Confidence 96.2 percent. Two flags cleared by Maria D."
- The Stone Blue 8% tinted background of the Helm + Brass version is **opted out** — Specimen renders this as a plain `--bg-card` panel with the same hairline border. The "AI" character comes from the editorial framing (the italic descriptor "Generated by Claude Haiku"), not from a colored bg.

**Panel 4 — Status timeline** (`<NwCard padding="lg">`):
- Plate number "08 / 12"
- Section header: "Chronicle" or "Status timeline" + sub italic "End-to-end audit trail."
- Body: see §3.5 audit timeline rendering below

**Panel 5 — Lien release** (`<NwCard padding="md">`):
- Plate number "09 / 12"
- Section header: "Lien release" + sub italic "Conditional partial. Required before payment."
- Body: 3-row label-value list with `--border-subtle` dividers
  - Inter 13px throughout, italic for status descriptors

#### Element-by-element styling (10 most distinctive elements)

1. **The plate-number eyebrow.** "PLATE 04 / 12" top-right at every section. JetBrains Mono UPPERCASE 9px (smaller than standard 10px) `--tracking-eyebrow` `--text-tertiary`. This is Specimen's most-repeated motif.
2. **NavBar in light mode (`--bg-page`).** Specimen does NOT use the dark control-panel band of Helm + Brass. NavBar is light, the page is light, the cards are slightly lighter (`#FFFFFF`). Uniform light surface with hairline border-bottom.
3. **Sentence-case button labels.** "Push to QuickBooks" not "PUSH TO QUICKBOOKS". The font-mono inline style stays (Specimen accepts JetBrains Mono on buttons) but the `text-transform: uppercase` is overridden via direction prop. Buttons read as understated.
4. **Italic captions everywhere.** Sub-labels, breadcrumb trails, footnotes — italic Inter 13px `--text-secondary`. The italic carries an editorial tone consistent with monograph caption typography.
5. **Generous padding (`p-6` to `p-8`).** Cards feel like exhibition-hall pull-quotes. Breathing room is structural.
6. **No shadows.** `--shadow-panel` and `--shadow-hover` are opted out. The hairline border is the entire structural device. This is Specimen's most-distinguishing token-level choice.
7. **Hairline horizontal dividers (`--border-subtle`).** Used between rows in tables and between sections within a card. Specimen uses `--border-subtle` more than `--border-default` for internal divisions.
8. **The "primary action" caption underneath the primary CTA.** Specimen uses caption text to clarify hierarchy rather than color/weight. The "Push to QuickBooks" button is ghost (no Stone Blue bg) but the caption "Primary action" beneath it makes its role explicit.
9. **NwBadge with reduced contrast.** Status pills use `/0.7` opacity on border + text. The pill reads as quiet, like a museum label.
10. **The dash character (—) used as primary separator.** Specimen uses em-dash (or its CSS-variable equivalent — see .impeccable.md §3.2 anti-em-dash rule) between job names and identifiers: "INV-4410 — Harborline Plumbing", "Anna Maria — Hanlon". The dash is editorial.

#### Audit timeline rendering — chronological caption list

Specimen renders the audit timeline as a **chronological caption list with hairline dividers**. NO dots, NO vertical rule.

```
┌─ Chronicle ─────────────────────────────┐
│ End-to-end audit trail.                 │
│                                         │
│ April 17 at 10:04                       │
│   Received via email-in (ap@rossbuilt). │
│ ────────────────                        │
│ April 17 at 10:04                       │
│   Auto-classified by Nightwork AI       │
│   at 96.2 percent confidence.           │
│ ────────────────                        │
│ April 17 at 10:47                       │
│   Reviewed by Maria D. Two flags        │
│   cleared.                              │
│ ────────────────                        │
│ April 17 at 10:51                       │
│   QA approved. Ready for draw.          │
│ ────────────────                        │
│ April 18 at 10:42                       │
│   Attached to Draw 9 by Jake.           │
│ ────────────────                        │
│ Pending                                 │
│   Lien release from Harborline.         │
│ ────────────────                        │
│ Pending                                 │
│   Owner approval of Draw 9.             │
└─────────────────────────────────────────┘
```

CSS shape:
- Outer wrapper: plain `<div>` — no positioning trick
- Each event: `padding: 16px 0`
- Event timestamp: `font-family: var(--font-body); font-size: 13px; font-style: italic; color: var(--text-secondary)`
- Event description: `font-family: var(--font-body); font-size: 13px; line-height: 1.65; color: var(--text-primary)` — the sentence is full prose, ending in a period
- Verb emphasis: `font-weight: 500` on the action verb (Received, Auto-classified, Reviewed, QA approved, Attached, Pending)
- Divider between events: `border-top: 1px solid var(--border-subtle)` (10% slate-tile, lighter than default)
- Pending events use the italic `Pending` timestamp instead of a date

This vocabulary is RADICALLY different from Helm + Brass's instrument log. There are no dots, no rule, no JetBrains Mono timestamps. The audit reads as an editorial chronicle.

#### What makes Specimen distinctive in this render

- **The plate-number eyebrow** at every section is a vocabulary that doesn't exist in the other directions. It signals "this surface is composed like a printed page."
- **Sentence-case everything** (buttons, badges, eyebrows where present, breadcrumbs). The other directions use JetBrains Mono UPPERCASE for these. Specimen's sentence-case + italic captions read as quiet.
- **No shadows + hairline borders only.** The structural device is purely typographic + thin lines. Helm + Brass uses shadows + borders + brass-bezel. Site Office uses stamp markers + folder-overlap shadows. Specimen relies on negative space.
- **Italic captions** carry the editorial tone. Helm + Brass uses no italic. Site Office uses italic for handwritten-margin-notes, but mainly relies on UPPERCASE.

#### Token deep-cuts (designer reference table)

| Element | Token / value |
|---|---|
| Page bg | `--bg-page` |
| NavBar bg | `--bg-page` (NOT the dark band — light to match page) |
| Card bg | `--bg-card` |
| Card border (all 4 sides) | `1px solid var(--border-default)` |
| Card padding | `p-6` (24px) to `p-8` (32px) |
| Card-to-card gap | `gap-6` (24px) or larger |
| h1 styling | `font-family: var(--font-display); font-weight: 400 (NOT 500); font-size: 38px; letter-spacing: -0.02em` |
| h2/h3 weight | `400` (uniform with h1) |
| Eyebrow (when used) | `<NwEyebrow tone="default">` sentence case |
| Plate-number caption | inline `font-family: var(--font-mono); font-size: 9px; letter-spacing: 0.14em; text-transform: uppercase; color: var(--text-tertiary)`; positioned `top-4 right-4 absolute` |
| Body text | `font-family: var(--font-body); font-size: 14px; color: var(--text-primary); line-height: 1.65` |
| Caption / italic | `font-style: italic; font-size: 13px; color: var(--text-secondary)` |
| Money | `<NwMoney size="md" \| "lg">` with color override `--text-primary` |
| Status pill | `<NwBadge variant="success" \| "warning" \| "danger">` with `case="sentence"` + `/0.7` opacity overrides |
| Action button (ghost) | `<NwButton variant="ghost" size="md">` sentence case |
| Action button (primary, when used) | `<NwButton variant="primary" size="md">` sentence case (the inline UPPERCASE override is opted out) |
| Hairline divider | `border-top: 1px solid var(--border-subtle)` |
| Audit timestamp | italic Inter 13px `--text-secondary` |
| Audit description | Inter 13px `--text-primary` line-height 1.65 |
| Focus-visible | `outline: 2px solid var(--ring); outline-offset: 2px` (default) |
| Hover transition | `transition-all duration-240 ease-in-out` (slower than default) |
| No shadows | `box-shadow: none` on all Card surfaces |

### 3.6 RENDER 2 — Dashboard screen

**Surface:** PATTERNS.md §4 (Data-dense Overview) instance — the home dashboard. Same data as Helm + Brass's RENDER 2, interpreted through Specimen.

**Viewport:** `nw-desktop` (1440×900px CSS).

#### Layout map

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│ NavBar (LIGHT bg, sentence case nav items, logo top-right 32×32)                  │
│ ┌──────────┬──────────────────────────────────────────────────────────────────┐ │
│ │ Job      │ Dashboard main column                                             │ │
│ │ Sidebar  │ ┌────────────────────────────────────────────────────────────┐  │ │
│ │ (260px — │ │ Plate number 'DASHBOARD 01/04' top-right                     │  │ │
│ │  wider)  │ │                                                              │  │ │
│ │          │ │ Hero band (much more whitespace than Helm + Brass)            │  │ │
│ │          │ │   Eyebrow 'Today, April 30' (sentence case, italic)            │  │ │
│ │          │ │   h1 (Space Grotesk weight 400, 42px) 'Welcome back, Jake.'    │  │ │
│ │          │ │   sub italic 14px 'You have three pm-review items, one draw'   │  │ │
│ │          │ │   sub continued 'pending owner approval, and the next-payment'│  │ │
│ │          │ │   sub continued 'cutoff is the 5th (in 5 days).'                │  │ │
│ │          │ ├────────────────────────────────────────────────────────────┤  │ │
│ │          │ │ KPI quartet — 4 cells with --border-default frames          │  │ │
│ │          │ │ (NOT edge-to-edge hairline — separate cards with gap-6)      │  │ │
│ │          │ │ ┌──────┐  ┌──────┐  ┌──────┐  ┌──────┐                       │  │ │
│ │          │ │ │ACTIVE│  │ PM   │  │DRAWS │  │PMNTS │                       │  │ │
│ │          │ │ │JOBS  │  │QUEUE │  │OPEN  │  │DUE   │                       │  │ │
│ │          │ │ │      │  │      │  │      │  │      │                       │  │ │
│ │          │ │ │ 9    │  │ 3    │  │ 2    │  │$184K │                       │  │ │
│ │          │ │ │      │  │      │  │      │  │      │                       │  │ │
│ │          │ │ │      │  │ 2 days   │ 5 days   │ none │                     │  │ │
│ │          │ │ │      │  │ old      │ submitted│ overdue│                  │  │ │
│ │          │ │ └──────┘  └──────┘  └──────┘  └──────┘                       │  │ │
│ │          │ ├────────────────────────────────────────────────────────────┤  │ │
│ │          │ │ Section heading 'Attention required' (size 24, weight 400)   │  │ │
│ │          │ │ Sub italic '4 items currently flagged.'                       │  │ │
│ │          │ │ ┌────────────────────────────────────────────────────────┐  │  │ │
│ │          │ │ │ Item 1 — italic timestamp + bold action verb + body     │  │ │ │
│ │          │ │ │   'April 30 — Draw 9 awaiting owner approval, two days  │  │ │ │
│ │          │ │ │    old. Item link →' (Inter 13px line-height 1.65)       │  │ │ │
│ │          │ │ ├ ──────────────────                                         │  │ │
│ │          │ │ │ Item 2 — etc.                                             │  │ │
│ │          │ │ ├ ──────────────────                                         │  │ │
│ │          │ │ │ Item 3 — etc.                                             │  │ │
│ │          │ │ ├ ──────────────────                                         │  │ │
│ │          │ │ │ Item 4 — etc.                                             │  │ │
│ │          │ │ └────────────────────────────────────────────────────────┘  │  │ │
│ │          │ ├────────────────────────────────────────────────────────────┤  │ │
│ │          │ │ Section heading 'Cash flow, April 2026'                       │  │ │
│ │          │ │ ┌────────────────────────────────────┬──────────────────┐  │  │ │
│ │          │ │ │ Cash flow column                   │ Outstanding by    │  │ │ │
│ │          │ │ │ (5 stacked rows, label-above-value │ aging column      │  │ │ │
│ │          │ │ │ pattern, gap-4, italic labels)     │ (4 cells micro-   │  │ │ │
│ │          │ │ │                                    │ grid)             │  │ │ │
│ │          │ │ └────────────────────────────────────┴──────────────────┘  │  │ │
│ │          │ ├────────────────────────────────────────────────────────────┤  │ │
│ │          │ │ Section heading 'Recent activity'                             │  │ │
│ │          │ │ Sub italic 'Eight events.'                                    │  │ │
│ │          │ │ ┌────────────────────────────────────────────────────────┐  │  │ │
│ │          │ │ │ italic timestamp + bold verb + body sentence            │  │ │ │
│ │          │ │ │ (NO avatar, NO badge — just prose)                       │  │ │ │
│ │          │ │ └────────────────────────────────────────────────────────┘  │  │ │
│ │          │ └────────────────────────────────────────────────────────────┘  │ │
│ └──────────┴──────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────────────────┘
```

#### Header

- **NavBar:** light `--bg-page`, sentence case nav items in Inter 13px. Logo top-right 32×32px.
- **Plate number:** "DASHBOARD 01 / 04" top-right.
- **Hero band:** padding `p-[40px 56px]` — generous editorial padding (more than Helm + Brass's `p-[24px 32px]`)
  - NwEyebrow `default` italic sentence case → "Today, April 30, 2026"
  - h1 Space Grotesk weight 400 size 42px (slightly larger than Helm + Brass's 38px) → "Welcome back, Jake." (period at end is editorial)
  - Sub: Inter 14px italic `--text-secondary` line-height 1.65 with prose: "You have three pm-review items, one draw pending owner approval, and the next-payment cutoff is the 5th — in 5 days." (sentences spelling out numbers — the editorial choice)

#### KPI quartet

- **Wrapper:** `grid grid-cols-4 gap-6` — NOT edge-to-edge hairline (Helm + Brass's hairline-divider trick) but separate cards with breathing room between them
- **Each cell:** `<NwCard padding="lg">` — 32px padding inside
  - Eyebrow sentence case (Inter italic 13px) — "Active jobs", "PM queue", "Draws open", "Payments due"
  - Big number: Space Grotesk weight 400 size 38px (NOT 600 — Specimen never goes above 500). The number is loud-by-being-large, not by being heavy.
  - Sub: Inter italic 12px → "Two days old", "Five days submitted", "None overdue"
  - NO progress bar (Specimen omits the visual reinforcement; the number alone is the data)

The brass-bezel border-top is **opted out**. Plain `--border-default` on all four sides of each card.

#### Attention required section

- **Section heading:** Space Grotesk weight 400 size 24px → "Attention required"
- **Sub:** Inter italic 13px `--text-secondary` → "Four items currently flagged."
- **Body:** vertical list, no card wrapping (the section is just a list)
  - Each item is a long-form sentence: italic timestamp + bold action verb + body description. Example:
    - "April 30 — **Draw 9** awaiting owner approval, two days old. [link →]"
    - "April 30 — **PM queue** has three items pending review. [link →]"
    - "April 30 — Vendor verification: **Harborline** tax ID expires within 30 days. [link →]"
    - "April 30 — Cost code **15-410** is over budget by one thousand two hundred dollars. [link →]"
  - Severity is communicated through ordering (most urgent first) and through prose framing ("over budget by..."), NOT through colored badges

The hairline divider `--border-subtle` separates each item.

#### Cash flow + outstanding aging

- **Section heading:** "Cash flow, April 2026"
- **Wrapper:** 2-column grid, `gap-6`
- **LEFT column:** vertical list of 5 NwDataRow stacked
  - Italic labels ("Month invoiced", "Month paid", "Month net", "Outstanding", "Upcoming")
  - NwMoney lg size with `--text-primary` color — NO sign-color (the label "Month net" carries the meaning)
- **RIGHT column:** 4-cell mini-grid for aging buckets
  - Each cell: italic label ("Current", "30 days", "60 days", "90 days") + NwMoney md
  - NO color coding (Specimen lets the proximity of the buckets and their order convey severity; current is on the left, 90 days is on the right)

#### Recent activity feed

- **Section heading:** "Recent activity"
- **Sub:** italic "Eight events."
- **Body:** chronological list of prose entries
  - Each entry: italic Inter 12px timestamp + Inter 13px description with bold action verb
  - "10:42 — **Jake attached** Inv 4410 to Draw 9."
  - "10:37 — **Maria D approved** Inv 4410."
  - "10:04 — **AI parsed** Inv 4410 at 96 percent confidence."
  - "09:18 — **Jake created** Draw 9 for Anna Maria — Hanlon."
  - NO avatars, NO badges, NO icons — just prose
- Hairline `--border-subtle` divider between entries

#### What makes Specimen distinctive in this render

- **Plate-number top-right** ("DASHBOARD 01 / 04") signals "this is a curated page."
- **Numbers are large but light-weight** (Space Grotesk weight 400 size 38px) — the loud-by-size approach versus Helm + Brass's loud-by-weight (size 30px weight 600).
- **No progress bars under KPIs.** Specimen omits visual reinforcement.
- **Attention items as prose** (italic timestamp + bold verb + sentence) — no severity badges, no colored severity rows. The narrative carries the severity.
- **Cards with breathing room** — `gap-6` between KPI cards instead of edge-to-edge hairline.

#### Token deep-cuts

| Element | Token / value |
|---|---|
| Page bg | `--bg-page` |
| NavBar bg | `--bg-page` (light) |
| KPI card bg | `--bg-card` |
| KPI big number | `font-display weight 400 size 38px tracking-tight` |
| KPI eyebrow | italic Inter 13px `--text-secondary` |
| Section heading | `font-display weight 400 size 24px tracking-tight` |
| Section sub | italic Inter 13px `--text-secondary` |
| Attention item | Inter 13px line-height 1.65 with bold action verb (`font-weight: 500`) and italic timestamp |
| Cash flow row label | italic Inter 13px |
| Activity timestamp | italic Inter 12px |
| Activity description | Inter 13px line-height 1.65 |
| Card-to-card gap | `gap-6` (24px) |
| Card padding | `p-6` (24px) to `p-8` (32px) |
| Hairline divider | `border-top: 1px solid var(--border-subtle)` |
| No shadows | `box-shadow: none` on all cards |

### 3.7 RENDER 3 — Mobile Approval flow (iPhone)

**Surface:** PATTERNS.md §5 (Mobile Touch Approval) instance.

**Viewport:** iPhone 15 Pro (393×852pt). The `nw-phone` breakpoint applies.

#### Layout map

```
┌─────────────────────────────────┐
│ Status bar (iOS native)         │
├─────────────────────────────────┤
│ App nav (h-56px, light bg)      │
│ logo · spacer · bell · avatar   │
├─────────────────────────────────┤
│ Plate '01 / 04' (top-right)     │
├─────────────────────────────────┤
│ Crumb (h-32px, italic, /)       │
│ home / jobs / hanlon / inv      │
├─────────────────────────────────┤
│ Hero band (h-88px)               │
│ ┌─────────────────────────────┐ │
│ │ Eyebrow 'Invoice' italic    │ │
│ │ Title (Space Grotesk 22px,  │ │
│ │ weight 400) 'INV-4410 —     │ │
│ │ Harborline Plumbing'         │ │
│ │ Status: 'Approved' (badge)  │ │
│ └─────────────────────────────┘ │
├─────────────────────────────────┤
│ FILE PREVIEW (full-width, no    │
│ stamp overlay)                   │
│ ┌─────────────────────────────┐ │
│ │  [PDF rendered]             │ │
│ │                             │ │
│ │  italic caption beneath     │ │
│ │  'Tap to enlarge.'          │ │
│ └─────────────────────────────┘ │
├─────────────────────────────────┤
│ INVOICE DETAILS (always         │
│ expanded — Specimen doesn't     │
│ collapse on mobile; relies on   │
│ scroll to reveal)               │
│ ┌─────────────────────────────┐ │
│ │ Section heading 'Invoice    │ │
│ │ details'                    │ │
│ │ Italic sub 'Updated by...'  │ │
│ │ NwDataRow stacked × 8       │ │
│ │ (gap-4 between rows)        │ │
│ └─────────────────────────────┘ │
├─────────────────────────────────┤
│ COST CODE ALLOCATION            │
│ (always expanded, prose layout) │
│ ┌─────────────────────────────┐ │
│ │ 4 prose lines:              │ │
│ │ '15-410 Rough plumbing —    │ │
│ │ $12,400 (66.7%)'            │ │
│ │ ...                         │ │
│ └─────────────────────────────┘ │
├─────────────────────────────────┤
│ CHRONICLE (audit timeline,      │
│ expanded — last 5 events)       │
│ ┌─────────────────────────────┐ │
│ │ 'April 17 at 10:51 — QA      │ │
│ │ approved. Ready for draw.'  │ │
│ │ (full prose)                │ │
│ │ ──────────                   │ │
│ │ 'April 17 at 10:47 — ...'    │ │
│ │ ──────────                   │ │
│ │ ...                          │ │
│ │ Show all 8 events            │ │
│ │ (italic link)                │ │
│ └─────────────────────────────┘ │
├─────────────────────────────────┤
│ Action ribbon (NOT sticky on    │
│ Specimen — fits in flow)        │
│ ┌─────────────────────────────┐ │
│ │ [Reject (ghost)]            │ │
│ │ [Push to QuickBooks]        │ │
│ │ italic sub 'Primary action' │ │
│ └─────────────────────────────┘ │
├─────────────────────────────────┤
│ Footer (mono small, italic)     │
└─────────────────────────────────┘
```

#### Header

- **App nav:** background `--bg-page` (light, NOT dark like Helm + Brass mobile). Border-bottom `--border-default`. Sentence case logo-only.
- **Plate number:** "01 / 04" top-right (smaller mobile size — 8px instead of 9px).
- **Crumb:** italic Inter 11px sentence case → "home / jobs / hanlon / inv-4410"

#### Hero band

- Padding `p-[20px 16px]`
- Eyebrow: Inter italic 12px sentence case → "Invoice"
- Title: Space Grotesk weight 400 size 22px (smaller than desktop's 38px) → "INV-4410 — Harborline Plumbing"
- Status: NwBadge sentence case "Approved" with `/0.7` opacity overrides

#### File preview (always expanded)

- Full-width, padding around the PDF
- Caption beneath: italic Inter 12px → "Tap to enlarge."
- NO stamp overlay
- The PDF is tappable to open a Sheet (`direction="bottom"`) with the full preview at full-screen

#### Always-expanded sections (Specimen choice)

Specimen does NOT use accordion collapse on mobile (Helm + Brass's choice). Instead, all sections are always expanded; the user scrolls through them. The reasoning: editorial design assumes the reader reads sequentially. Hidden content under collapse interrupts the reading flow.

Each section has:
- Section heading (Space Grotesk 17px weight 400)
- Italic sub-line
- Body content (NwDataRow stacked, prose lists, etc.)
- `gap-4` between rows within a section
- `gap-8` between sections

#### Cost code allocation as prose

Specimen renders allocations as prose lines, NOT as a table on mobile:
- "15-410 Rough plumbing — $12,400 (66.7%)"
- "15-410 Materials — $1,550 (8.3%)"
- "15-420 Fixtures — $3,800 (20.4%)"
- "01-500 Permits — $850 (4.6%)"
Each on its own line, italic Inter 13px, with the cost code in regular weight (not bold) and the money in NwMoney inline.

#### Audit timeline as prose chronicle

```
Chronicle
End-to-end audit trail.

April 17 at 10:51 — QA approved. Ready for draw.
─────────────
April 17 at 10:47 — Reviewed by Maria D. Two flags cleared.
─────────────
April 17 at 10:04 — Auto-classified by Nightwork AI at 96.2 percent confidence.
─────────────
April 17 at 10:04 — Received via email-in (ap@rossbuilt).
─────────────
April 18 at 10:42 — Attached to Draw 9 by Jake.

Show all 8 events
```

#### Action ribbon (NOT sticky)

Specimen places the action ribbon **at the end of the page**, after the chronicle. Reasoning: the editorial flow puts the action AFTER the user has read the surface. The action is the "now what?" that follows reading.

- Ghost button: "Reject"
- Primary button (still ghost on Specimen, NOT Stone Blue bg): "Push to QuickBooks"
- Italic sub-caption beneath: "Primary action."

This is a Specimen-specific pattern: the primary CTA is differentiated through caption text, not visual prominence.

#### Audit timeline rendering on mobile

Same prose-chronicle shape as desktop but with the last 5 events visible (not last 3 like Helm + Brass mobile). Specimen wants more of the chronicle visible because reading is the activity.

#### What makes Specimen distinctive on mobile

- **No accordion collapse.** Always-expanded sections; scroll to read.
- **No sticky CTA.** Action goes at the end, in the editorial flow.
- **Prose layout for allocations** (NOT a table).
- **Italic captions everywhere.** The mobile surface reads as quiet, like a printed booklet.

#### Token deep-cuts

| Element | Token / value |
|---|---|
| App nav bg | `--bg-page` (light) |
| Plate number | mobile size 8px |
| Crumb separator | "/" italic |
| Hero title | Space Grotesk weight 400 size 22px |
| Status pill | sentence case + /0.7 opacity |
| Section heading | Space Grotesk weight 400 size 17px |
| Section sub | italic Inter 13px |
| Section gap | `gap-8` (32px) |
| Cost code allocation | prose Inter 13px (NOT a table) |
| Audit chronicle | prose Inter 13px line-height 1.65 |
| Audit divider | `border-top: 1px solid var(--border-subtle)` |
| Action ribbon | at end (NOT sticky) |
| Primary CTA | ghost variant (NOT Stone Blue bg) with italic "Primary action" sub-caption |

### 3.8 RENDER 4 — Owner Portal view

**Surface:** PATTERNS.md §3 (Data-dense Overview) tuned for homeowner audience. Same data as Helm + Brass's RENDER 4 with a Specimen interpretation.

**Viewport:** `nw-desktop` (1180×900px CSS).

#### Layout map

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│ NavBar (LIGHT bg, sentence case nav items, owner portal eyebrow center, owner   │
│ name + Owner role pill right, logo top-right)                                    │
├──────────────────────────────────────────────────────────────────────────────────┤
│ Plate 'OWNER PORTAL 01 / 06' top-right                                            │
├──────────────────────────────────────────────────────────────────────────────────┤
│ Project header (very generous padding)                                            │
│ ┌──────────────────────────────────────────────────────────────────────────────┐ │
│ │ Eyebrow italic 'Anna Maria — Hanlon residence.'                               │ │
│ │ h1 (Space Grotesk weight 400, 42px) 'Welcome back, David.'                    │ │
│ │ sub italic 'Your home build is sixty percent complete. Phase four of seven.   │ │
│ │ Target move-in November 2026.'                                                │ │
│ └──────────────────────────────────────────────────────────────────────────────┘ │
├──────────────────────────────────────────────────────────────────────────────────┤
│ KPI quartet (4 separate cards with gap-6)                                        │
│ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐                                               │
│ │CONTRT│ │BILLED│ │REMAIN│ │PENDNG│ - editorial sentence-case eyebrows           │
│ │$4.82M│ │$2.89M│ │$1.93M│ │$175K │ - numbers in Space Grotesk weight 400 size 38│
│ │base+3│ │ 60%  │ │projt │ │italic│ - italic sub                                 │
│ │italic│ │italic│ │italic│ │warn  │                                              │
│ └──────┘ └──────┘ └──────┘ └──────┘                                               │
├──────────────────────────────────────────────────────────────────────────────────┤
│ Action banner (Specimen renders as a hairline-bordered editorial pull-quote, NOT │
│ a dark island)                                                                    │
│ ┌──────────────────────────────────────────────────────────────────────────────┐ │
│ │ Eyebrow italic 'Action requested.' (NOT 'ACTION REQUIRED' — Specimen)         │ │
│ │ h2 (Space Grotesk weight 400, 26px) 'Draw 9 is ready for your approval.'      │ │
│ │ Body Inter 14px line-height 1.65: 'One hundred seventy-five thousand thirty-  │ │
│ │ seven dollars net due. Period April 1 through 18. Fourteen vendor invoices.   │ │
│ │ Submitted by Jake Ross today at 10:42 AM.'                                    │ │
│ │ Action row: [Review details] [Approve & release] (both ghost; the Approve one │ │
│ │ has italic sub 'Primary action.')                                              │ │
│ └──────────────────────────────────────────────────────────────────────────────┘ │
│ (hairline border top + bottom only; no Stone Blue 6% bg tint, no dark island)    │
├──────────────────────────────────────────────────────────────────────────────────┤
│ Section heading 'Draw history.'                                                   │
│ Sub italic 'Every payment you've released on this project. Nine entries.'         │
│ ┌──────────────────────────────────────────────────────────────────────────────┐ │
│ │ HTML table (semantic, NOT DataGrid) — 9 rows, italic-italic separated         │ │
│ │ #  Period    Status      Net due       Released                                │ │
│ │ 09 Apr 1-18  Awaiting    $175,037.50   —                                       │ │
│ │ 08 Mar 15-31 In review   $205,105.00   —                                       │ │
│ │ 07 Mar 1-14  Approved    $291,080.00   Mar 18                                  │ │
│ │ ...                                                                             │ │
│ └──────────────────────────────────────────────────────────────────────────────┘ │
├──────────────────────────────────────────────────────────────────────────────────┤
│ Section heading 'Change orders.'                                                  │
│ Sub italic 'Three approved. One pending your signoff.'                            │
│ Pull-quote box for the pending CO-08 (hairline border, italic body)               │
├──────────────────────────────────────────────────────────────────────────────────┤
│ Section heading 'Phase progress.'                                                 │
│ Sub italic 'Seven phases. You are in phase four.'                                 │
│ ┌──────────────────────────────────────────────────────────────────────────────┐ │
│ │ 7 phase rows with progress bars (very thin, 3px tall, no color reinforcement) │ │
│ └──────────────────────────────────────────────────────────────────────────────┘ │
├──────────────────────────────────────────────────────────────────────────────────┤
│ Section heading 'Recent photos.'                                                  │
│ Sub italic 'Three new images this week.'                                          │
│ 3-col photo grid (placeholders)                                                   │
├──────────────────────────────────────────────────────────────────────────────────┤
│ Section heading 'Your team.'                                                      │
│ 2-col contact cards (Inter italic role labels)                                    │
├──────────────────────────────────────────────────────────────────────────────────┤
│ Footer (mono small, italic, left-right separated)                                 │
└──────────────────────────────────────────────────────────────────────────────────┘
```

#### Header

- **NavBar:** light `--bg-page`. Logo top-right (32×32px). "Owner portal" eyebrow center sentence case Inter italic 12px. Owner role pill right (italic, hairline border, sentence case).
- **Plate number:** "OWNER PORTAL 01 / 06" top-right.
- **Project header:** padding `p-[48px 56px]` (generous editorial padding)
  - Eyebrow: Inter italic 13px sentence case → "Anna Maria — Hanlon residence."
  - h1: Space Grotesk weight 400 size 42px → "Welcome back, David."
  - Sub: Inter 14px italic line-height 1.65 → "Your home build is sixty percent complete. Phase four of seven. Target move-in November 2026." (numbers spelled out — editorial choice)

#### KPI quartet (4 separate cards)

`grid grid-cols-4 gap-6`. Each card:
- `<NwCard padding="lg">` with hairline border
- Eyebrow: Inter italic sentence case → "Contract", "Billed to you", "Remaining", "Pending your approval"
- Number: Space Grotesk weight 400 size 38px (editorial weight)
- Sub: Inter italic 12px → "Base $4.78 million plus three change orders.", "Sixty percent of contract.", "Projected through close.", "Draw 9 — due April 25"

The "Pending your approval" cell uses italic warn color on the number (`color: var(--nw-warn)`).

#### Action banner (Specimen pull-quote, NOT dark island)

- `<NwCard padding="lg">` with hairline border top + bottom only (open-ended pull-quote feel — `border-left: none; border-right: none` overrides on this Card instance)
- Padding `p-[28px 32px]`
- Eyebrow: Inter italic warn color → "Action requested." (NOT "ACTION REQUIRED" — sentence case)
- h2: Space Grotesk weight 400 size 26px → "Draw 9 is ready for your approval."
- Body: Inter 14px line-height 1.65 → "One hundred seventy-five thousand thirty-seven dollars net due. Period April 1 through 18. Fourteen vendor invoices. Submitted by Jake Ross today at 10:42 AM."
- Action row: 2 ghost buttons
  - "Review details" (ghost)
  - "Approve and release" (ghost) with italic sub "Primary action." beneath

This is RADICALLY different from Helm + Brass's dark island action banner. Specimen treats the action announcement as an editorial pull-quote.

#### Draw history (HTML table, NOT DataGrid)

- Section heading "Draw history." (period at end is editorial)
- Sub italic "Every payment you have released on this project. Nine entries."
- HTML table (semantic):
  - Columns: # / Period / Status / Net due / Released
  - Headers: italic Inter 12px sentence case
  - Rows: Inter 13px, money in NwMoney md right-aligned `--text-primary` color
  - Status pills: sentence case ("Awaiting", "In review", "Approved", "Paid") with /0.7 opacity
  - Hairline divider `--border-subtle` between rows
  - NO row hover (Specimen doesn't activate)

#### Change orders section

Same shape — section heading + sub italic + body. The pending CO-08 renders as a pull-quote box with hairline border.

#### Phase progress

Section heading "Phase progress." Body: 7 rows, each with:
- Phase label: Space Grotesk weight 400 size 15px → "01 — Sitework and foundation"
- Status sub: Inter italic 12px → "Complete. November 2025."
- Progress bar: 3px tall, very thin
- Fill colors:
  - Complete: `--text-tertiary` (gray, NOT `--color-success` green — Specimen mutes the visual)
  - In progress: `--brand-accent` (Stone Blue) — the only Stone Blue on the page
  - Upcoming: empty bar with hairline border

The current phase (Phase 4) gets the Stone Blue fill at 62%. The italic sub for the current phase reads "In progress at sixty-two percent."

#### Recent photos / Contractor team / Footer

Same as Helm + Brass but with:
- Italic captions on photos
- Sentence-case team role labels with italic
- Footer: italic Inter 11px sentence case

#### Audit timeline rendering on owner portal

Owner portal does NOT show the per-invoice audit timeline (same as Helm + Brass). Draw history is the audit at the owner level. Specimen renders the draw history table as the audit chronicle — italic dates, prose status descriptions.

#### What makes Specimen distinctive on Owner Portal

- **The action banner as editorial pull-quote** (NOT dark island). The most-different choice from Helm + Brass.
- **Numbers spelled out in prose** ("sixty percent", "fourteen vendor invoices") — editorial language.
- **Phase progress with muted fill colors** — Specimen doesn't color-reinforce.
- **No emoji on "Action requested."** Helm + Brass uses ⚠ ; Specimen uses italic capitalization alone.
- **Sentence-case status pills** with `/0.7` opacity — quiet pills.

#### Token deep-cuts

| Element | Token / value |
|---|---|
| NavBar bg | `--bg-page` (light) |
| h1 styling | `font-display weight 400 size 42px tracking-tight` |
| KPI big number | `font-display weight 400 size 38px` |
| Action banner bg | `--bg-card` (NOT dark island) |
| Action banner eyebrow | Inter italic warn color (`--nw-warn`) sentence case |
| Action banner h2 | `font-display weight 400 size 26px` |
| Action banner body | Inter 14px line-height 1.65 |
| Primary action sub | italic Inter 12px "Primary action." |
| Draw history status pills | `<NwBadge variant="..." case="sentence">` with `/0.7` opacity |
| Phase progress bar | `height: 3px; bg: --bg-muted` |
| Phase progress fill (complete) | `--text-tertiary` (gray) |
| Phase progress fill (in progress) | `--brand-accent` (Stone Blue — the rare editor's red pencil) |
| Footer | italic Inter 11px sentence case |

### 3.9 Honest weaknesses

#### Worst for: dense data tables (DataGrid pages — invoice queue, vendor list, draw line items)

Specimen's editorial vocabulary works beautifully on Document Review (gold standard) and Owner Portal (hospitality), but breaks down on dense data tables. The DataGrid pattern (PATTERNS.md instances: invoice queue, vendor list, change orders, cost-intelligence items) is fundamentally a TanStack-table-driven dense surface where a PM scans 50+ rows looking for outliers. Specimen's commitments — `comfortable` density default, sentence-case headers (NOT JetBrains Mono UPPERCASE which is the standard for data column headers), no row hover, generous padding — produce a DataGrid that's slow to scan. The PM's muscle memory expects compact density + UPPERCASE column labels + clear hover state. Specimen contradicts all three. The invoice queue page renders as 50 quiet rows that read as a list of editorial captions, not as a working surface where a PM is hunting for "what's stuck."

#### Concession: muscle memory

The closest reference benchmark Procore (per .impeccable.md §5.1) is the construction-industry idiom Nightwork emulates. PMs and accountants moving from Procore (or QuickBooks, or AIA forms, or Excel) to Specimen Nightwork will face an aesthetic mismatch. Construction-industry software is dense, status-colored, action-prominent. Specimen is sparse, color-muted, action-de-emphasized. The trade-off: Specimen's editorial mood requires a learning curve that the muscle-memory-trained user has to climb. A PM who's spent 10 years in QuickBooks will find Specimen's italic captions and sentence-case statuses initially unfamiliar.

The concession is real: pick Specimen, and you accept that the user is meeting your aesthetic on its terms, not the other way around. Onboarding time goes up. The friction is "this looks more elegant than I expected, but where do I click to approve this?"

#### Risk: Specimen's editorial commitments degrade under feature pressure

Over 5+ years and 50+ feature additions, Specimen's commitments are hard to maintain. Generous whitespace gets squeezed when a new feature needs a new field. Sentence-case eyebrows get UPPERCASE-d when an engineer needs to make a section header "more visible." The plate-number caption gets dropped when no one remembers what it was for. The italic captions get replaced with bold-text when "users said they couldn't find the labels."

Specimen requires designer discipline to preserve. Without ongoing design review (`/nightwork-design-check`), Specimen drifts toward Helm + Brass's pragmatic instrument-vocabulary because the latter is easier to extend. By 2030, a Specimen Nightwork without active design custodianship looks like Helm + Brass with extra italic captions sprinkled inconsistently.

#### Mitigation if picked: codify Specimen's "editorial discipline" as a per-direction Forbidden list

If Jake picks Specimen, the mitigation is to extend `.impeccable.md` §3 with **direction-specific Forbidden items** that protect the editorial commitments:

- **Forbidden in Specimen:** UPPERCASE eyebrows on internal screens (sentence-case only)
- **Forbidden in Specimen:** `font-weight: 500` or higher on display headings (weight 400 only)
- **Forbidden in Specimen:** `gap-3` or smaller between top-level cards (always `gap-6` minimum)
- **Forbidden in Specimen:** colored backgrounds on cards (always `--bg-card`; the editorial pull-quote variant uses hairline borders only)
- **Forbidden in Specimen:** progress-bar fill in `--color-success` (use `--text-tertiary` for complete; `--brand-accent` for in-progress only)
- **Forbidden in Specimen:** any visual treatment that adds emphasis without an editorial reason (e.g., a colored left-stripe on a card)
- **Forbidden in Specimen:** density="compact" outside tables and DataGrid

Plus the `nightwork-design-system-reviewer` skill at `/nightwork-design-check` adds Specimen-specific checks: every internal-screen eyebrow audited for sentence case, every h1/h2/h3 audited for weight 400, every card audited for `gap-6` minimum.

This mitigation has teeth — the hook layer enforces the structural items (gap-6, no shadows, weight ≤ 400 on display); the review layer catches the editorial items (sentence case, italic captions, plate-number presence). Designer drift takes effort to push past the Forbidden list.

For the dense-DataGrid weakness specifically: a "DataGrid mode" extension where Specimen surfaces opt INTO compact density + UPPERCASE column headers when the surface is data-table-primary (the inverse of Helm + Brass's "utility mode"). The same pattern, but Specimen's exception is "data tables get the standard treatment" rather than "schedule grids get a quieter treatment."

---

## 4. Direction C — Site Office

### 4.0 Overview

Site Office is the literal Ross Built site-office aesthetic. The aesthetic vocabulary is the construction office: drafting tables, blueprint cabinets, manila folders, carbon-paper triplicate forms, rubber stamps, ruled ledger paper. It is the most material-grounded of the three directions — every visual cue references a physical object the field PM, accountant, or contractor would recognize from a working construction office.

The Slate palette stays — Slate Deep (`#1A2830`) is dominant; it's the "ink" of the office. White Sand (`#F7F5EC`) is the page; it reads as ledger paper. Stone Blue (`#5B8699`) is muted in Site Office — used as a cool gray-blue for borders, headers, and subtle accents, never as an active hue. The active-action color is Slate Deep itself (the "ink" stamping the form), with `--text-accent` (Gulf Blue) reserved for live links.

The mood is archival, methodical, working-utilitarian. This direction conveys "every step of your build is documented and recoverable" — the trust posture is "your record-keeping is bulletproof." It's the direction that most strongly emphasizes Ross Built's open-book promise (per CLAUDE.md): if a homeowner asks "where did this dollar go," the system can answer with row-level evidence, and the SURFACE LOOKS LIKE THE KIND OF SYSTEM THAT WOULD ANSWER THAT.

JetBrains Mono is everywhere — labels, audit, metadata, table column headers, body micro-copy. Site Office is the most monospace-heavy direction. Inter is for prose-y body content (descriptions, helper text, error messages). Space Grotesk is reserved for display headings only.

The signature visual cue: **rubber-stamp markers and ruled ledger texture.** Eyebrows render as rubber-stamp marks (UPPERCASE, JetBrains Mono, slightly-larger letterspacing `0.18em` instead of standard `0.14em`, occasionally with a tiny stroke-thinning effect via SVG to suggest ink density). Right-rail panels read as stamped-folder cards with a faint hairline shadow that suggests the folder edge. Audit timelines render as Telex-style ticker marks with stamp markers and dense fixed-width timestamp gutter.

The single most distinguishing visual cue: the "STAMPED" or "RECEIVED" or "APPROVED" caption that appears at the top-right corner of every right-rail panel, like a stamp on a manila folder. The caption is JetBrains Mono UPPERCASE 9px `--tracking-eyebrow` `--text-accent` (Gulf Blue), with a thin Stone Blue underline. It signals "this section has been processed."

### 4.1 Token usage

| Token | Site Office posture |
|---|---|
| `--bg-page` | Light: `--nw-white-sand`. Dark: `--nw-slate-deep`. Default — but Site Office reads as white-sand-ledger-paper most strongly in light mode. |
| `--bg-card` | Light: `#FFFFFF`. Dark: `--nw-slate-deeper`. Default. Site Office uses cards heavily — every section is a stamped folder. |
| `--bg-subtle` | Used aggressively — Site Office tables use `--bg-subtle` row striping for "ruled ledger" feel. |
| `--bg-muted` | Used as the alternating row stripe. The two together create a faint ruled-ledger texture. |
| `--text-primary` | Default. The "ink" color. Slate Tile in light mode reads as printer's ink on ledger paper. |
| `--text-secondary` | Used on every meta-data field — dates, names, sub-notes. Site Office surfaces are meta-heavy. |
| `--text-tertiary` | Used for stamp-edges, faint inscriptions, "page N of M" footers. |
| `--text-accent` | Gulf Blue (`#436A7A`). Used on every link and on every "stamp" caption. Not as rare as Specimen's editor's-pencil; not as ubiquitous as Helm + Brass's accent-everywhere. |
| `--border-default` | Used on every Card edge. Site Office relies on borders heavily. |
| `--border-subtle` | Used on internal dividers — between rows in the audit timeline, between fields in a form. |
| `--border-strong` | Used on the "stamp underline" that sits below the stamp caption on each panel. |
| `--shadow-panel` | Used on right-rail panels but with a SOFTER variant — `0 2px 4px rgba(26, 40, 48, 0.06)` (lighter than default). The shadow suggests the folder edge, not elevation. |
| `--shadow-hover` | NOT used. Site Office doesn't hover-lift. Hover changes the border to `--border-strong` only. |
| `--color-success` / `--color-warning` / `--color-error` | Used in stamp markers — green for "APPROVED", amber for "HELD", red for "DENIED". The colors are direct stamp-color emulations. |
| `--color-money` | `--text-primary`. Site Office uses `--text-primary` for money, same as Specimen (the financial discipline is implicit in the format, not the color). |
| `--ring` | `--nw-stone-blue`. Default. |
| `--brand-accent` | Default `--nw-stone-blue`. Used on the primary CTA color (rare). Mostly muted to gray-blue for borders/headers. |

**Token rule overrides specific to Site Office:**

- `--shadow-panel` value override: the panel-shadow used by Site Office is softer than the SYSTEM.md default. CSS variable: `--shadow-panel-site-office: 0 2px 4px rgba(26, 40, 48, 0.06);` set at the `data-direction="site-office"` body level.
- Cards use `padding="sm"` (`p-3` = 12px) by default — Site Office is high-density. `padding="md"` is the opt-in for forms.
- Tables use `--bg-subtle` + `--bg-muted` row striping (the ruled-ledger effect).
- Body text is `font-mono` for short labels, dates, codes — JetBrains Mono is used FREQUENTLY in body content, not just eyebrows.

### 4.2 Type usage

- **Space Grotesk** — used at weight 400 for h1, weight 500 for h2/h3 — same mix as Helm + Brass but with smaller sizes (h1: `--fs-h2` 30px instead of `--fs-h1` 38px; h2: `--fs-xl` 20px). Site Office surfaces are high-density, so display headings get smaller. The "wordmark" feel is suppressed; Site Office is data-first.
- **Inter** — body face for prose-y content (descriptions, error messages, helper text). Used at `--fs-sm` 13px or `--fs-meta` 12px (smaller than Helm + Brass / Specimen).
- **JetBrains Mono** — DOMINATES even more than Helm + Brass:
  - Eyebrows (`--fs-label` 10px UPPERCASE `--tracking-eyebrow` `0.14em` default; the rubber-stamp eyebrow uses `0.18em` for a stamp feel)
  - Money (`--fs-md` 15px, weight 500, tabular-nums)
  - Audit timestamps (`--fs-label` 10px UPPERCASE for the gutter; `--fs-meta` 12px for the description)
  - Status pill text (NwBadge UPPERCASE)
  - Table column headers
  - Cost codes (e.g., "15-410" rendered in JetBrains Mono 11px Stone Blue weight 600 — direction signature)
  - Reference numbers (invoice numbers, PO numbers, draw numbers, change-order numbers — every number-coded reference is JetBrains Mono)
  - Body micro-copy (sub-line meta — e.g., "Last updated Apr 17 · 10:51 AM" — JetBrains Mono 10px UPPERCASE)
  - Nav links (sentence case Inter is rejected — JetBrains Mono UPPERCASE)
  - Field labels in forms

Site Office is monospace-saturated. Where Specimen restrains JetBrains Mono to money + plate numbers, and Helm + Brass uses it on labels + readouts, Site Office uses it virtually everywhere except prose body content.

- **Weight choices** — Space Grotesk 400/500 mixed (similar to Helm + Brass). JetBrains Mono 500 (medium) UPPERCASE for stamps and labels; 400 (regular) for body micro-copy and table cells; 600 (semi-bold) for cost codes and reference numbers — direction signature.
- **Tracking choices** — `--tracking-tight` (`-0.02em`) on display; `--tracking-eyebrow` (`0.14em`) on standard eyebrows; **`0.18em`** on stamp-flavored eyebrows (Site Office signature); `--tracking-button` (`0.12em`) on buttons.

### 4.3 Component instance preferences

When Site Office renders, it picks specific COMPONENTS.md variants:

- **NwButton** (Existing primitives §7.1) — `secondary` and `ghost` variants DOMINATE (transparent + outlined, white-sand bg with stamp border). `primary` variant is used for the most-likely action (Approve, Submit) — but rendered with reduced visual prominence (smaller, lower-contrast). NwButton stays UPPERCASE JetBrains Mono per default. Site Office accepts the existing button vocabulary.
- **NwCard** (Existing primitives §7.4) — `sm` padding (`p-3` = 12px) is the default — high-density. `md` for forms. Cards have a slightly softer shadow `--shadow-panel-site-office` to suggest the folder-overlap.
- **NwBadge** (Existing primitives §7.3) — bordered (locked), JetBrains Mono UPPERCASE, with EXTRA `letter-spacing: 0.18em` for stamp-feel. The stamp pill is a Site Office signature.
- **NwEyebrow** (Existing primitives §7.2) — used FREQUENTLY (more than Helm + Brass; far more than Specimen). The "stamp" tone variant — a new tone with letter-spacing `0.18em` — is added for the most-prominent eyebrows (per-panel header). T20a may codify a `tone="stamp"` variant.
- **Stamp caption (Site Office signature):** small label at the top-right of every right-rail panel, like a stamp on a folder. Composed inline:
  ```tsx
  <span style={{ position: 'absolute', top: 16, right: 16, fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--text-accent)', borderBottom: '1px solid var(--border-strong)', paddingBottom: 2 }}>STAMPED · APR 17</span>
  ```
- **NwDataRow** (Existing primitives §7.5) — `horizontal` layout default (label-left value-right) — ledger-line shape. Stacked only on `nw-phone`.
- **NwMoney** (Existing primitives §7.6) — `md` size in tables (NOT lg), `lg` size for hero totals (NOT xl — Site Office is smaller-display). Color `--text-primary`.
- **NwStatusDot** (Existing primitives §7.7) — used as **square stamp markers** (NOT circles) on status pills. The Site Office override: NwStatusDot adds a `shape="square"` prop (T20a codifies). The square dot is 6×6px, no border-radius (the sole exception to status dot rounding is opted into here for the stamp feel). Pair the square stamp with the badge for a "stamp on form" vocabulary.
- **Combobox** (Inputs §1.4) — compact density. Heroicons `ChevronDownIcon` outline.
- **DataGrid** (Data display §5.2) — compact density (the default — Site Office's high-density commitment). Striped rows (`--bg-subtle` + `--bg-muted` alternating) for the ruled-ledger effect. UPPERCASE JetBrains Mono column headers with `--tracking-eyebrow`.
- **Toast** (Feedback §3.1) — narrow strip, top-right. JetBrains Mono UPPERCASE label. Slide-in 150ms ease-out (faster than Helm + Brass and Specimen — Site Office wants instant-feeling feedback).
- **Banner** (Feedback §3.2) — full-width strip with a left-side stamp marker (square 8×8px in the variant color) instead of a left-stripe accent. The square marker reads as a "stamp" applied to the banner.
- **AppShell** (Navigation §4.1) — desktop-with-sidebar default. Sidebar is normal-width (220px). NavBar background is `--nw-slate-deep` (DARK control-panel band — same as Helm + Brass) — Site Office reads this as "office dark wood + ledger paper" rather than "marine bridge." Logo top-right (28×28px). Nav items JetBrains Mono UPPERCASE with `--tracking-eyebrow`.

### 4.4 Motion preferences

Within the locked Q5=A CSS-only no-bouncy constraint:

- **Default duration:** 150ms (faster than Helm + Brass's 200ms and Specimen's 240ms — Site Office wants instant-feeling)
- **Default easing:** `ease-out` (entering elements decelerate to a halt)
- **Hover transitions:** 80ms ease-out (almost instantaneous) — Site Office hover changes the border to `--border-strong` only, not elevation
- **Modal open/close:** 150ms ease-out, fade-in (no slide — modals appear instantly with a quick fade)
- **Drawer (mobile):** 200ms ease-out (Vaul's drag overrides for direct manipulation)
- **Toast slide-in:** 150ms ease-out from right
- **Status pill change:** instantaneous (matching Helm + Brass's choice — Site Office's "instant" applies here too)
- **Page transitions:** instant (no transition between routes)

The Site Office motion philosophy: **instant, working-pace.** A working office doesn't wait for animations. Click, action happens.

### 4.5 RENDER 1 — Invoice Review screen

**Surface:** PATTERNS.md §2 (Document Review) instance. Same data as Helm + Brass and Specimen RENDER 1.

**Viewport:** `nw-desktop` (1440×900px CSS).

#### Layout map

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│ NavBar (DARK bg --nw-slate-deep, JetBrains Mono UPPERCASE nav items, logo top-right)
│ ┌──────────────────────────────────────────────────────────────────────────────┐
│ │ Locked-record banner (only if invoice in_draw or paid) — stamp-marker prefix  │
│ ├──────────────────────────────────────────────────────────────────────────────┤
│ │ Breadcrumbs trail (JetBrains Mono UPPERCASE 10px) — Home › Invoices › INV-4410│
│ ├──────────────────────────────────────────────────────────────────────────────┤
│ │ Header band (h-[100px], padding 16px 24px — denser than Helm + Brass)          │
│ │   LEFT: NwEyebrow stamp-tone 'INVOICE FILE · INV-4410'                         │
│ │         h1 (size 26, weight 500) 'INV-4410 · Harborline Plumbing'              │
│ │         (smaller than Helm + Brass's 30 — Site Office is denser)               │
│ │         Status: stamp-marker square (6×6 green) + NwBadge 'QA APPROVED' (stamp│ │
│ │         tone with 0.18em letterspacing)                                        │ │
│ │         Sub: JetBrains Mono UPPERCASE 10px 'ANNA MARIA — HANLON · RECEIVED     │ │
│ │         APR 17 · DRAW #9'                                                      │ │
│ │   RIGHT: action ribbon (3-button row, dense)                                   │ │
│ │         [DOWNLOAD]  [REJECT]  [PUSH TO QB]                                     │ │
│ │         all secondary variant (transparent + outlined ledger-bordered)         │ │
│ │         The PUSH button gets a stamp marker prefix (small green square)        │ │
│ ├──────────────────────────────────────────────────────────────────────────────┤
│ │ HERO GRID (50/50 — col-span-6 each, hairline divider trick)                   │
│ │ ┌─────────────────────────────────┬─────────────────────────────────────────┐ │
│ │ │ LEFT — File preview              │ RIGHT — Right-rail panels (stamped     │ │
│ │ │ + STAMP CAPTION 'STAMPED · APR 17│  folders)                              │ │
│ │ │   · MARIA D' top-right           │ + STAMP CAPTION on each panel          │ │
│ │ │ ───────────────────────────     │ ─────────────────────────────────       │ │
│ │ │ NwEyebrow stamp 'SOURCE DOCUMENT'│ INVOICE DETAILS panel (stamp-bordered) │ │
│ │ │ + 'OPEN IN NEW TAB ↗' link       │ - stamp top-right 'STAMPED · MARIA D'  │ │
│ │ │ ───────────────────────────     │ - 'TOTAL' / NwMoney lg $18,600          │ │
│ │ │                                  │ - 'NET AFTER RETAINAGE' / NwMoney lg    │ │
│ │ │ InvoiceFilePreview               │   $16,740 (text-primary, NOT warn —     │ │
│ │ │ - rendered with --shadow-panel-  │   Site Office uses muted color)         │ │
│ │ │   site-office (softer)           │ - 'VENDOR' / link                       │ │
│ │ │ - QA APPROVED stamp at bottom-   │ - 'PROJECT' / link                      │ │
│ │ │   right (Site Office stamp —     │ - 'RECEIVED' / dense JetBrains Mono     │ │
│ │ │   square block, NOT rotated)     │ - 'DUE' / dense                          │ │
│ │ │                                  │ - 'PAYMENT TERMS' / dense                │ │
│ │ │                                  │ - 'ATTACHED TO DRAW' / link              │ │
│ │ │                                  │ ─────────────────────────────────       │ │
│ │ │                                  │ COST CODE ALLOCATION panel              │ │
│ │ │                                  │ - DataGrid compact density               │ │
│ │ │                                  │ - striped rows (ruled-ledger feel)       │ │
│ │ │                                  │ ─────────────────────────────────       │ │
│ │ │                                  │ AI EXTRACTION panel (stamp 'CLAUDE')    │ │
│ │ │                                  │ - Stone Blue 6% bg tint (kept from      │ │
│ │ │                                  │   Helm + Brass) + stamp caption         │ │
│ │ │                                  │ - Inter 12px body                        │ │
│ │ │                                  │ - ConfidenceBadge stamp-tone             │ │
│ │ │                                  │ ─────────────────────────────────       │ │
│ │ │                                  │ AUDIT LEDGER panel (Telex ticker)       │ │
│ │ │                                  │ - stamp top-right 'TICKER · 8 EVT'       │ │
│ │ │                                  │ - dense rows with square stamp markers  │ │
│ │ │                                  │ ─────────────────────────────────       │ │
│ │ │                                  │ LIEN RELEASE panel (small, stamped)     │ │
│ │ │                                  │ - 3 dense rows with stamp prefixes      │ │
│ │ └─────────────────────────────────┴─────────────────────────────────────────┘ │
│ └──────────────────────────────────────────────────────────────────────────────┘
└──────────────────────────────────────────────────────────────────────────────────┘
```

#### Header

- **NavBar:** dark `--nw-slate-deep` band (matches Helm + Brass). Logo top-right 28×28px. Nav items JetBrains Mono UPPERCASE 10px `--tracking-eyebrow` 65% opacity slate-tile, 100% opacity active with Stone Blue bottom border.
- **Breadcrumbs:** JetBrains Mono UPPERCASE 10px (default) — same as Helm + Brass.
- **Page header (`h-[100px]`, padding `p-[16px 24px]`):** Smaller than Helm + Brass's `h-[120px]` — Site Office is denser.
  - LEFT region:
    - NwEyebrow `tone="stamp"` (the new variant) → "INVOICE FILE · INV-4410" with `letter-spacing: 0.18em`
    - h1: Space Grotesk weight 500 size 26px (smaller than Helm + Brass's 30px) → "INV-4410 · Harborline Plumbing"
    - Stamp marker prefix: square 6×6px `--color-success` green BEFORE the NwBadge → ▢ APPROVED (the square is NwStatusDot `shape="square"`)
    - NwBadge "QA APPROVED" stamp-tone with `letter-spacing: 0.18em`
    - Sub: JetBrains Mono UPPERCASE 10px `--tracking-eyebrow` 65% opacity → "ANNA MARIA — HANLON · RECEIVED APR 17 · DRAW #9"
  - RIGHT region: 3-button action ribbon, gap-2 (denser), right-aligned
    - All 3 buttons are NwButton secondary variant (transparent + outlined `--border-default`)
    - Labels: "DOWNLOAD" / "REJECT" / "PUSH TO QB" (UPPERCASE JetBrains Mono)
    - The "PUSH TO QB" button has a small green square stamp-marker prefix (▢) before the text — direction signature

#### Main content regions — the 50/50 hero grid

Same wrapper as Helm + Brass (`grid grid-cols-1 lg:grid-cols-2 gap: 1px hairline divider trick`). Site Office adds:
- The wrapper has `box-shadow: var(--shadow-panel-site-office)` (the softer panel-shadow override) suggesting the folder edge.
- No brass-bezel border-top (the Helm + Brass signature). Instead, plain `--border-default` on all four sides.

##### LEFT — file preview region (col-span-6 desktop)

- **Background:** `var(--bg-card)`
- **Padding:** `p-3` (12px — denser than Helm + Brass's `p-[22px]` and Specimen's `p-8`)
- **Stamp caption top-right:** "STAMPED · APR 17 · MARIA D" — JetBrains Mono UPPERCASE 9px `letter-spacing: 0.18em` Gulf Blue with 1px Stone Blue underline. Position: `absolute top-4 right-4`.
- **Section header:**
  - Title: Space Grotesk weight 500 size 15px → "Source document" (smaller than Helm + Brass's 15px in the existing impl — same)
  - Right link: JetBrains Mono UPPERCASE 10px Stone Blue → "OPEN IN NEW TAB ↗"
- **InvoiceFilePreview:** PDF rendered with the `--shadow-panel-site-office` softer shadow.
- **QA APPROVED stamp overlay on PDF:** Site Office variant — NOT rotated, NOT a wax-stamp feel. Instead, a SQUARE stamp block at `bottom-right`: `position: absolute; bottom: 16px; right: 16px; padding: 6px 12px; border: 2px solid var(--nw-success); color: var(--nw-success); background: var(--bg-card)/0.85; font-family: var(--font-mono); letter-spacing: 0.18em; font-size: 11px; font-weight: 600;` reading "QA APPROVED · APR 17 2026". The flat-square block reads as a date-stamp on a form.

##### RIGHT — right-rail panels region (col-span-6 desktop)

Vertical stack of 5 panels, each `gap-3` (12px — denser than Helm + Brass's `gap-[14px]`). Each panel is a `<NwCard padding="sm">` with the Site Office stamp-folder treatment.

**Panel 1 — INVOICE DETAILS** (`<NwCard padding="sm">`):
- Stamp caption top-right: "STAMPED · MARIA D · APR 17"
- Header: NwEyebrow stamp-tone "INVOICE DETAILS" + sub-eyebrow `default` tone "SYSTEM METADATA · EDITABLE BY PM AND ACCOUNTING" (the sub-eyebrow is also UPPERCASE — Site Office)
- Body: 2-column grid of NwDataRow `horizontal` layout, dense rows (gap-2 between rows)
  - "TOTAL" / NwMoney lg $18,600.00 (color `--text-primary`)
  - "NET AFTER RETAINAGE" / NwMoney lg $16,740.00 (color `--text-primary` — Site Office mutes the warn color; the label "RETAINAGE" carries the meaning)
  - "VENDOR" / link "Harborline Plumbing ↗" (Gulf Blue underline)
  - "PROJECT" / link "Anna Maria — Hanlon ↗"
  - "RECEIVED" / "APR 17 2026 · 10:04 AM" (JetBrains Mono UPPERCASE 11px)
  - "DUE" / "MAY 17 2026 · NET 30"
  - "PAYMENT TERMS" / "ACH PREFERRED · 10% RETAINED"
  - "ATTACHED TO DRAW" / link "DRAW #9 (PENDING) ↗"

The data row labels are UPPERCASE JetBrains Mono — direction signature.

**Panel 2 — COST CODE ALLOCATION** (`<NwCard padding="sm">`):
- Stamp caption "STAMPED · ALLOCATIONS"
- Header: NwEyebrow stamp-tone "COST CODE ALLOCATION" + sub-eyebrow "AI-SUGGESTED · EDITABLE"
- Body: small DataGrid compact density with striped rows
  - Columns: CODE (JetBrains Mono 11px Stone Blue weight 600) | DESCRIPTION (Inter 12px) | ALLOCATED (NwMoney md right-aligned) | % OF INVOICE (right-aligned JetBrains Mono 11px)
  - Headers: JetBrains Mono UPPERCASE 9px `--tracking-eyebrow` `--text-secondary`
  - Row stripes: alternate `--bg-subtle` and `--bg-muted` (the ruled-ledger effect)
  - Total row at bottom: weight 500, top border-2 `--border-default`

**Panel 3 — AI EXTRACTION** (`<NwCard padding="sm">` with Stone Blue 6% bg tint):
- Stamp caption "STAMPED · CLAUDE HAIKU · APR 17"
- Header: NwEyebrow stamp-tone "AI EXTRACTION" + small Stone Blue square marker prefix
- Body: Inter 12px line-height 1.5 (denser than Helm + Brass's 1.55)
  - "Matched vendor from tax ID (59-3388421) and PO reference. Line-item codes inferred from description + historical pattern: 94% of Harborline invoices in last 12 mo route to 15-410 labor + materials. Retainage flag applied from job default (10%)."
  - Bold inline emphasis: weight 500
- Footer: "CONFIDENCE 96.2% · 2 FLAGS CLEARED BY MARIA D" — JetBrains Mono UPPERCASE 9px `letter-spacing: 0.18em` (stamp letterspacing); "96.2%" colored `--color-success`

**Panel 4 — AUDIT LEDGER** (`<NwCard padding="sm">`):
- Stamp caption "TICKER · 8 EVENTS"
- Header: NwEyebrow stamp-tone "AUDIT LEDGER · TELEX TICKER"
- Body: see §4.5 audit timeline rendering below

**Panel 5 — LIEN RELEASE** (`<NwCard padding="sm">`):
- Stamp caption "STAMPED · LIEN STATUS"
- Header: NwEyebrow stamp-tone "LIEN RELEASE"
- Body: 3 dense rows of NwDataRow horizontal with stamp markers prefixing each row:
  - ▢ "Conditional partial release" / "REQUESTED" (color `--color-success`)
  - ▢ "Signed copy on file" / "NOT RECEIVED" (color `--nw-warn`)
  - ▢ "Required by workflow" / "YES · BEFORE APPROVAL"

Each square stamp marker is 6×6px in the variant color.

#### Element-by-element styling (10 most distinctive elements)

1. **Stamp captions on every panel.** "STAMPED · MARIA D · APR 17" or "TICKER · 8 EVENTS" or "STAMPED · CLAUDE HAIKU" — JetBrains Mono UPPERCASE 9px `letter-spacing: 0.18em` Gulf Blue with Stone Blue underline. Site Office's most-repeated motif.
2. **Square stamp markers (NwStatusDot `shape="square"`).** Used as prefixes on rows, badges, and action buttons. The square shape is the Site Office direction signature; circles are reserved for the standard StatusDot variant which Site Office opts out of for this direction.
3. **The 0.18em letterspacing on stamp eyebrows.** Compared to standard `--tracking-eyebrow: 0.14em`, the stamp tone uses `0.18em` — wider, more "stamped" feel.
4. **Striped table rows.** `--bg-subtle` + `--bg-muted` alternating. Ruled-ledger effect.
5. **JetBrains Mono on field labels.** "TOTAL" / "VENDOR" / "PROJECT" / "RECEIVED" — all UPPERCASE JetBrains Mono. Helm + Brass uses sentence-case English labels here. Specimen uses italic Inter.
6. **The flat-square QA APPROVED stamp on PDF.** NOT rotated like Helm + Brass and the existing impl. NOT a wax-stamp feel. Square block with 2px green border, JetBrains Mono UPPERCASE 11px `letter-spacing: 0.18em`, semi-transparent bg.
7. **NavBar dark band + JetBrains Mono UPPERCASE nav items.** Same as Helm + Brass's NavBar treatment. Site Office reads it as "office dark wood" rather than "marine bridge."
8. **Dense padding (`p-3` = 12px on cards).** Site Office maximizes information per square inch.
9. **Soft folder-shadow on hero grid.** `--shadow-panel-site-office` (softer than default) suggests the folder-overlap.
10. **Stamp marker prefixes on action buttons.** The "PUSH TO QB" button gets a small green square prefix — direction signature.

#### Audit timeline rendering — Telex ticker

Site Office renders the audit timeline as a **Telex-style ticker** with stamp markers and dense fixed-width timestamp gutter.

```
┌─ AUDIT LEDGER · TELEX TICKER · 8 EVENTS ─────────────┐
│ 04-17 1004 ▢ RECEIVED via email-in (ap@rossbuilt.com)│
│ 04-17 1004 ▢ AUTO-CLASSIFIED 96.2% confidence        │
│ 04-17 1047 ▢ REVIEWED by Maria D · 2 flags cleared   │
│ 04-17 1051 ▢ QA APPROVED · ready for draw             │
│ 04-18 1042 ▢ ATTACHED TO DRAW #9 by Jake              │
│ ----- ---- ▢ Lien release from Harborline (PENDING)  │
│ ----- ---- ▢ Owner approval of Draw #9 (PENDING)      │
│ ----- ---- ▢ Push to QuickBooks via ACH (PENDING)     │
└──────────────────────────────────────────────────────┘
```

CSS shape:
- Outer wrapper: plain `<div>` — no `position: relative` trick
- Each event: a single row, `padding: 4px 0` (denser than Helm + Brass's `padding: 6px 0 14px`)
- Date gutter: JetBrains Mono UPPERCASE 10px `letter-spacing: 0.04em` `--text-tertiary` width: `calc(--ch * 12)` (12-character fixed-width: "04-17 1004")
- Stamp marker (square 6×6px): inline-block square in the variant color (`--color-success` for done, `--text-tertiary` for pending). NOT a circle.
- Pending rows: date gutter shows "----- ----" placeholder
- Event description: JetBrains Mono UPPERCASE 11px (UPPERCASE bodies the audit trail like a Telex ticker output)

This vocabulary is RADICALLY different from Helm + Brass's instrument log (vertical rule + circle dots) and Specimen's chronological caption list (italic prose). Site Office's Telex ticker is the most utilitarian of the three.

#### What makes Site Office distinctive in this render

- **Stamp captions on every panel.** No other direction has this vocabulary.
- **Square stamp markers everywhere.** The square is the direction signature.
- **0.18em stamp letterspacing** on key eyebrows.
- **JetBrains Mono on field labels.** "TOTAL" instead of "Total" (Helm + Brass) or "Total" italic (Specimen).
- **Striped table rows** for ruled-ledger feel.
- **Telex-ticker audit timeline.**
- **Flat-square QA APPROVED stamp** (NOT rotated like Helm + Brass).
- **Soft folder-shadow** instead of brass-bezel border-top.

#### Token deep-cuts

| Element | Token / value |
|---|---|
| Page bg | `--bg-page` |
| NavBar bg | `--nw-slate-deep` |
| Card bg | `--bg-card` |
| Card padding | `p-3` (12px) |
| Card-to-card gap | `gap-3` (12px) |
| Card shadow | `--shadow-panel-site-office: 0 2px 4px rgba(26,40,48,0.06)` (softer override) |
| Stamp caption | `font-mono size 9px letter-spacing 0.18em uppercase color: --text-accent border-bottom: 1px solid --border-strong` |
| Stamp eyebrow tone | `font-mono size 10px letter-spacing 0.18em uppercase color: --text-primary` |
| Square stamp marker | `<NwStatusDot shape="square" size="6">` (the new shape prop) |
| h1 styling | `font-display weight 500 size 26px tracking-tight` (smaller than Helm + Brass) |
| Field labels | UPPERCASE JetBrains Mono 10px `--tracking-eyebrow` |
| Body micro-copy | UPPERCASE JetBrains Mono 10-11px |
| Body prose | Inter 12px line-height 1.5 |
| Money | `<NwMoney size="md" \| "lg">` (NOT xl) color `--text-primary` |
| Status pill | `<NwBadge variant="success" \| "warning" \| "danger">` with `letter-spacing: 0.18em` |
| Action button | `<NwButton variant="secondary" size="md">` UPPERCASE JetBrains Mono |
| Striped row alt | `--bg-subtle` + `--bg-muted` alternating |
| Audit row | dense, JetBrains Mono UPPERCASE 11px, square stamp markers, fixed-width date gutter |
| Hover transition | `transition-colors duration-80 ease-out` (almost instant) |
| Hover effect | border color shifts from `--border-default` to `--border-strong` only (no elevation) |

### 4.6 RENDER 2 — Dashboard screen

**Surface:** PATTERNS.md §4 instance. Same data as Helm + Brass and Specimen.

**Viewport:** `nw-desktop` (1440×900px CSS).

#### Layout map

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│ NavBar (DARK bg, JetBrains Mono UPPERCASE nav items, logo top-right)              │
│ ┌──────────┬──────────────────────────────────────────────────────────────────┐ │
│ │ Job      │ Dashboard main column                                             │ │
│ │ Sidebar  │ ┌────────────────────────────────────────────────────────────┐  │ │
│ │ (220px)  │ │ Hero band (h-[80px], dense padding 16x 24)                   │  │ │
│ │          │ │   Eyebrow stamp 'TODAY · APR 30 2026 · WED'                   │  │ │
│ │          │ │   h1 (weight 500, 26px) 'DASHBOARD · JAKE'                    │  │ │
│ │          │ │   sub UPPERCASE 'PM REVIEW (3) · DRAWS PENDING (1) · CUTOFF'  │  │ │
│ │          │ │   sub continued '5TH IN 5 DAYS'                                │  │ │
│ │          │ ├────────────────────────────────────────────────────────────┤  │ │
│ │          │ │ KPI strip (4 cells edge-to-edge with hairline dividers)      │  │ │
│ │          │ │ Each cell: stamp caption top-right + UPPERCASE label + dense │  │ │
│ │          │ │ number Space Grotesk weight 500 size 22 + UPPERCASE sub      │  │ │
│ │          │ │ ┌──────┬──────┬──────┬──────┐                                │  │ │
│ │          │ │ │ACTIVE│ PM   │DRAWS │PMNTS │                                │  │ │
│ │          │ │ │ JOBS │QUEUE │ OPEN │ DUE  │                                │  │ │
│ │          │ │ │  9   │  3   │  2   │$184K │                                │  │ │
│ │          │ │ │ALL OK│2D OLD│5D SUB│NONE  │                                │  │ │
│ │          │ │ └──────┴──────┴──────┴──────┘                                │  │ │
│ │          │ ├────────────────────────────────────────────────────────────┤  │ │
│ │          │ │ ATTENTION REQUIRED · 4 ITEMS                                  │  │ │
│ │          │ │ stamp 'STAMPED · NEEDS ACTION'                                │  │ │
│ │          │ │ ┌────────────────────────────────────────────────────────┐  │  │ │
│ │          │ │ │ ▢ WARN  Draw #9 awaiting owner — 2 days old            │  │ │ │
│ │          │ │ │ ▢ HIGH  PM queue: 3 items pending                       │  │ │ │
│ │          │ │ │ ▢ MED   Vendor verification: Harborline expires         │  │ │ │
│ │          │ │ │ ▢ LOW   Cost code 15-410 over-budget by $1,200          │  │ │ │
│ │          │ │ │ (each row is a single dense ledger line)                │  │ │ │
│ │          │ │ └────────────────────────────────────────────────────────┘  │  │ │
│ │          │ ├────────────────────────────────────────────────────────────┤  │ │
│ │          │ │ CASH FLOW · APR 2026 (stamp caption 'STAMPED · MONTH-TO-DATE')│  │ │
│ │          │ │ ┌─────────────────────────┬──────────────────────────────┐ │  │ │
│ │          │ │ │ Cash flow (5 ledger rows)│ Outstanding by aging         │ │  │ │
│ │          │ │ │ - dense, ledger-style    │ ┌──────┬──────┬──────┬──────┐│ │  │ │
│ │          │ │ │ - JetBrains Mono labels  │ │CURR  │ 30D  │ 60D  │ 90D  ││ │  │ │
│ │          │ │ │ - NwMoney md             │ │$184K │$58K  │$32K  │$13K  ││ │  │ │
│ │          │ │ └─────────────────────────┴──────────────────────────────┘ │  │ │
│ │          │ ├────────────────────────────────────────────────────────────┤  │ │
│ │          │ │ AUDIT LEDGER · 8 RECENT EVENTS                                │  │ │
│ │          │ │ stamp 'TICKER · 8 EVT'                                        │  │ │
│ │          │ │ ┌────────────────────────────────────────────────────────┐  │  │ │
│ │          │ │ │ 04-30 1042 ▢ JAKE attached Inv 4410 to Draw 9           │  │ │ │
│ │          │ │ │ 04-30 1037 ▢ MARIA D approved Inv 4410                  │  │ │ │
│ │          │ │ │ 04-30 1004 ▢ AI parsed Inv 4410 (96% confidence)        │  │ │ │
│ │          │ │ │ ...                                                       │  │ │ │
│ │          │ │ └────────────────────────────────────────────────────────┘  │  │ │
│ │          │ └────────────────────────────────────────────────────────────┘  │ │
│ └──────────┴──────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────────────────┘
```

#### Header

- **NavBar:** dark band (matches Helm + Brass).
- **Hero band:** padding `p-[16px 24px]` (dense — smaller than Helm + Brass's `p-[24px 32px]`)
  - NwEyebrow stamp-tone → "TODAY · APR 30 2026 · WED" (with stamp letterspacing 0.18em)
  - h1 Space Grotesk weight 500 size 26px → "DASHBOARD · JAKE" (UPPERCASE — direction signature for the hero)
  - Sub: JetBrains Mono UPPERCASE 11px `--text-secondary` → "PM REVIEW (3) · DRAWS PENDING (1) · CUTOFF 5TH IN 5 DAYS" — Site Office uses UPPERCASE-with-parens for counts, not English prose

#### KPI strip

- **Wrapper:** `grid grid-cols-4`, `gap: 1px; background: var(--border-default); border: 1px solid var(--border-default)` — same hairline trick as Helm + Brass
- **Each cell:** `bg-[var(--bg-card)] p-[16px 20px]` (denser than Helm + Brass)
  - Stamp caption top-right: "STAMPED · ACTIVE 9" or "STAMPED · QUEUE 3"
  - NwEyebrow stamp-tone UPPERCASE label → "ACTIVE JOBS" / "PM QUEUE" / "DRAWS OPEN" / "PAYMENTS DUE"
  - Big number: Space Grotesk weight 500 size 22px (smaller than Helm + Brass's 30px — Site Office is denser)
  - Sub: JetBrains Mono UPPERCASE 10px `--text-accent` (Gulf Blue) → "ALL OK" / "2D OLD" / "5D SUB" / "NONE OVERDUE"
  - NO progress bar (Site Office mutes visual reinforcement)

The brass-bezel border-top is opted out. Plain `--border-default` on all four sides.

#### Attention required strip

- **Wrapper:** `<NwCard padding="sm">` with stamp caption "STAMPED · NEEDS ACTION"
- **Header:** NwEyebrow stamp-tone "ATTENTION REQUIRED · 4 ITEMS"
- **Body:** vertical list of dense ledger rows
  - Each row: square stamp marker (6×6px) in severity color + JetBrains Mono UPPERCASE 11px severity label ("WARN" / "HIGH" / "MED" / "LOW") + Inter 12px description + JetBrains Mono UPPERCASE 9px timestamp gutter at right
  - Hover: `bg: var(--bg-subtle)` (border-color change is the primary feedback; this is a fallback)
  - Click target: full row, ≥44px height for touch

#### Cash flow region

- **Wrapper:** 2-column grid `gap-px` with `bg: var(--border-default)` parent — hairline divider
- **LEFT col:** `<NwCard padding="sm">` with stamp caption "STAMPED · MONTH-TO-DATE"
  - NwEyebrow stamp-tone "CASH FLOW · APR 2026"
  - Body: 5 dense rows of NwDataRow horizontal
    - "MONTH INVOICED" / NwMoney md $487K
    - "MONTH PAID" / NwMoney md $412K
    - "MONTH NET" / NwMoney md +$75K (color `--color-success`)
    - "OUTSTANDING" / NwMoney md $287K
    - "UPCOMING" / NwMoney md $145K

The labels are UPPERCASE JetBrains Mono.

- **RIGHT col:** `<NwCard padding="sm">` with stamp caption
  - NwEyebrow stamp-tone "OUTSTANDING BY AGING"
  - Body: 4-column micro-grid
    - "CURR" / $184K (color `--color-success`)
    - "30D" / $58K (warn amber)
    - "60D" / $32K (warn deeper)
    - "90D" / $13K (danger red)

#### Recent activity feed (Telex ticker)

- **Wrapper:** `<NwCard padding="sm">` with stamp caption "TICKER · 8 EVENTS"
- **Header:** NwEyebrow stamp-tone "AUDIT LEDGER · 8 RECENT EVENTS"
- **Body:** Telex-ticker shape — same as the audit timeline §4.5
  - Each row: fixed-width date gutter "04-30 1042" + square stamp marker + UPPERCASE description with bold action verb
  - Reverse-chronological

#### What makes Site Office distinctive in this render

- **Stamp captions on every section** (KPI cells, attention strip, cash flow, ticker).
- **Square stamp markers** in attention severity, audit ticker, and cash-flow row prefixes.
- **Smaller numbers** (size 22) — Site Office is dense and small-display.
- **JetBrains Mono labels everywhere** ("MONTH INVOICED", "ACTIVE JOBS").
- **Telex ticker activity feed** rather than card-style activity rows.
- **No progress bars** — Site Office mutes visual reinforcement.

#### Token deep-cuts

| Element | Token / value |
|---|---|
| Page bg | `--bg-page` |
| NavBar bg | `--nw-slate-deep` (dark) |
| KPI cell bg | `--bg-card` |
| KPI cell padding | `p-[16px 20px]` (denser) |
| KPI big number | `font-display weight 500 size 22px` (smaller) |
| KPI sub-text | `font-mono size 10px uppercase color: --text-accent` |
| Stamp caption everywhere | `font-mono size 9px letter-spacing 0.18em uppercase color: --text-accent border-bottom: 1px solid --border-strong` |
| Attention severity badge | UPPERCASE JetBrains Mono 11px |
| Cash flow row label | UPPERCASE JetBrains Mono 11px |
| Activity row date gutter | UPPERCASE JetBrains Mono 10px fixed-width |
| Square stamp marker | `<NwStatusDot shape="square" size="6">` |

### 4.7 RENDER 3 — Mobile Approval flow (iPhone)

**Surface:** PATTERNS.md §5 instance.

**Viewport:** iPhone 15 Pro (393×852pt). The `nw-phone` breakpoint applies.

#### Layout map

```
┌─────────────────────────────────┐
│ Status bar (iOS native)         │
├─────────────────────────────────┤
│ App nav (h-56px, dark bg)       │
│ logo · spacer · bell · avatar   │
├─────────────────────────────────┤
│ Crumb (h-32px, UPPERCASE,       │
│ JetBrains Mono 9px)             │
│ HOME / JOBS / HANLON / INV-4410 │
├─────────────────────────────────┤
│ Sticky header band (h-72px)     │
│ ┌─────────────────────────────┐ │
│ │ Stamp 'STAMPED · MARIA D'   │ │
│ │ Eyebrow stamp 'INVOICE FILE'│ │
│ │ Title (Space Grotesk 17px,  │ │
│ │ weight 500, UPPERCASE) 'INV-│ │
│ │ 4410 · HARBORLINE'           │ │
│ │ Status: ▢ APPROVED (square  │ │
│ │ stamp + badge)               │ │
│ └─────────────────────────────┘ │
├─────────────────────────────────┤
│ FILE PREVIEW (full-width)       │
│ ┌─────────────────────────────┐ │
│ │  [PDF rendered]             │ │
│ │  flat-square stamp at       │ │
│ │  bottom-right (NOT rotated) │ │
│ └─────────────────────────────┘ │
├─────────────────────────────────┤
│ STATUS + TOTAL row (sticky)     │
│ ┌─────────────────────────────┐ │
│ │ STATUS         │   TOTAL     │ │
│ │ ▢ APPROVED     │  $18,600.00 │ │
│ └─────────────────────────────┘ │
├─────────────────────────────────┤
│ INVOICE DETAILS (collapsed)     │
│ ┌─────────────────────────────┐ │
│ │ Stamp 'STAMPED · MARIA D'   │ │
│ │ INVOICE DETAILS         [+] │ │
│ └─────────────────────────────┘ │
├─────────────────────────────────┤
│ COST CODE ALLOCATION (clpsd)    │
│ ┌─────────────────────────────┐ │
│ │ Stamp 'STAMPED · ALLOC'     │ │
│ │ COST CODE ALLOCATION    [+] │ │
│ │ (4 codes · tap to edit)     │ │
│ └─────────────────────────────┘ │
├─────────────────────────────────┤
│ AI EXTRACTION (collapsed)       │
│ ┌─────────────────────────────┐ │
│ │ Stamp 'CLAUDE HAIKU · 96%'  │ │
│ │ AI EXTRACTION           [+] │ │
│ └─────────────────────────────┘ │
├─────────────────────────────────┤
│ AUDIT LEDGER (last 5 events)    │
│ ┌─────────────────────────────┐ │
│ │ Stamp 'TICKER · 8 EVT'      │ │
│ │ AUDIT LEDGER                │ │
│ │ 04-17 1051 ▢ QA APPROVED    │ │
│ │ 04-17 1047 ▢ REVIEWED MARIA │ │
│ │ 04-17 1004 ▢ AI 96.2%       │ │
│ │ 04-17 1004 ▢ RECEIVED EMAIL │ │
│ │ 04-18 1042 ▢ ATTACHED DRAW9 │ │
│ │ Show all 8 →                │ │
│ └─────────────────────────────┘ │
├─────────────────────────────────┤
│ STICKY BOTTOM CTA (h-72px)      │
│ ┌─────────────────────────────┐ │
│ │ ▢ [APPROVE & PUSH TO QB]    │ │
│ │ ─────── 56×56 high-stakes ──│ │
│ └─────────────────────────────┘ │
└─────────────────────────────────┘
```

#### Header

- **App nav:** background `--nw-slate-deep` (dark — matches Helm + Brass and Site Office desktop).
- **Crumb:** JetBrains Mono UPPERCASE 9px `--tracking-eyebrow` 45% opacity slate-tile → "HOME / JOBS / HANLON / INV-4410"
- **Sticky header band (h-72px):**
  - Stamp caption top-right: "STAMPED · MARIA D"
  - NwEyebrow stamp-tone UPPERCASE → "INVOICE FILE · INV-4410" (compact 9px instead of 10px)
  - Title: Space Grotesk weight 500 size 17px UPPERCASE → "INV-4410 · HARBORLINE PLUMBING"
  - Status: square stamp marker (6×6px green) + NwBadge stamp-tone "APPROVED"

#### File preview

- Full-width
- Flat-square stamp at bottom-right (NOT rotated): "QA APPROVED · APR 17" — green border, semi-transparent bg

#### Status + Total row (sticky)

- Pinned below file preview. Background `--bg-card`. Border-top + border-bottom `--border-default`.
- 2-column horizontal split:
  - LEFT: NwEyebrow stamp-tone UPPERCASE "STATUS" + ▢ NwBadge "APPROVED"
  - RIGHT: NwEyebrow stamp-tone UPPERCASE "TOTAL" + NwMoney lg $18,600.00

#### Collapsed accordions

Each accordion section has:
- Header: stamp caption top-right + NwEyebrow stamp-tone label + `+` icon (Heroicons) on right
- Tap to expand: 150ms ease-out (Site Office's instant motion)
- When open: dense content with the same stamp/UPPERCASE vocabulary as desktop

#### Audit ledger (last 5 events)

```
Stamp: TICKER · 8 EVT
AUDIT LEDGER

04-17 1051 ▢ QA APPROVED
04-17 1047 ▢ REVIEWED MARIA D
04-17 1004 ▢ AUTO-CLASSIFIED 96.2%
04-17 1004 ▢ RECEIVED EMAIL-IN
04-18 1042 ▢ ATTACHED DRAW 9

Show all 8 events →
```

Same Telex-ticker shape as desktop. Last 5 events visible (more than Helm + Brass's 3 because Site Office values audit visibility).

#### Sticky bottom CTA

`position: fixed; bottom: 0; left: 0; right: 0; padding: 12px 16px env(safe-area-inset-bottom) 16px`. Background `--bg-card` with border-top `--border-default`.

- Single full-width primary button: `<NwButton variant="primary" style={{ minHeight: 56 }}>▢ APPROVE & PUSH TO QB</NwButton>`
- Square stamp prefix (▢ 6×6px green) inside the button — direction signature
- 56px high-stakes touch target
- JetBrains Mono UPPERCASE 12px

#### What makes Site Office distinctive on mobile

- **Stamp captions on every section** (header band, accordions, audit ledger, status + total row).
- **Square stamp markers everywhere** — header status, audit rows, action button prefix.
- **Telex-ticker audit timeline** (5 events visible, not 3).
- **Dense accordions** with stamp captions instead of plain accordion headers.
- **Flat-square QA APPROVED stamp** (NOT rotated like the existing impl).
- **UPPERCASE Title** — Site Office uses UPPERCASE on the mobile title (Helm + Brass uses sentence case for the title).

#### Token deep-cuts

| Element | Token / value |
|---|---|
| App nav bg | `--nw-slate-deep` |
| Crumb | UPPERCASE JetBrains Mono 9px |
| Sticky header title | `font-display weight 500 size 17px UPPERCASE` |
| Status pill | stamp-tone 0.18em letterspacing |
| File preview stamp | flat-square, NOT rotated |
| Accordion expand | 150ms ease-out |
| Audit row | dense Telex ticker, fixed-width gutter |
| Sticky CTA | square stamp prefix + primary variant + 56px min-height |

### 4.8 RENDER 4 — Owner Portal view

**Surface:** PATTERNS.md §3 tuned for homeowner.

**Viewport:** `nw-desktop` (1180×900px CSS).

#### Layout map

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│ NavBar (DARK bg, JetBrains Mono UPPERCASE nav, owner portal eyebrow center,      │
│ owner name + role pill right, logo top-right)                                    │
├──────────────────────────────────────────────────────────────────────────────────┤
│ Project header (dense)                                                            │
│ ┌──────────────────────────────────────────────────────────────────────────────┐ │
│ │ NwEyebrow stamp 'ANNA MARIA — HANLON RESIDENCE'                               │ │
│ │ h1 (weight 500, size 28) 'WELCOME BACK, DAVID' (UPPERCASE)                    │ │
│ │ sub UPPERCASE 'BUILD 60% COMPLETE · PHASE 4/7 · MOVE-IN NOV 2026'             │ │
│ └──────────────────────────────────────────────────────────────────────────────┘ │
├──────────────────────────────────────────────────────────────────────────────────┤
│ KPI strip (4 cells edge-to-edge, dense)                                           │
│ ┌──────┬──────┬──────┬──────┐                                                    │
│ │CONTRT│BILLED│REMAIN│PNDIN │ + stamp captions on each                            │
│ │$4.82M│$2.89M│$1.93M│$175K │                                                    │
│ └──────┴──────┴──────┴──────┘                                                    │
├──────────────────────────────────────────────────────────────────────────────────┤
│ Action banner (Site Office renders as a stamped manila-folder card)               │
│ ┌──────────────────────────────────────────────────────────────────────────────┐ │
│ │ Stamp top-right 'STAMPED · ACTION REQUIRED'                                   │ │
│ │ Eyebrow stamp warn '⚠ ACTION REQUIRED'                                        │ │
│ │ h2 (weight 500, size 22) 'DRAW #9 READY FOR YOUR APPROVAL'                    │ │
│ │ note UPPERCASE 'NET DUE $175,037.50 · PERIOD APR 1-18 · 14 INVOICES ·         │ │
│ │ SUBMITTED BY JAKE ROSS APR 30 1042'                                           │ │
│ │ Action row: [REVIEW DETAILS] [APPROVE & RELEASE]                              │ │
│ │ (the second has ▢ green stamp prefix — direction signature)                   │ │
│ └──────────────────────────────────────────────────────────────────────────────┘ │
├──────────────────────────────────────────────────────────────────────────────────┤
│ DRAW HISTORY (DataGrid compact density, striped rows)                             │
│ stamp 'STAMPED · 9 ENTRIES'                                                       │
│ ┌──────────────────────────────────────────────────────────────────────────────┐ │
│ │ #  Period       Status       Net due       Released                            │ │
│ │ 09 Apr 1-18     ▢ AWAIT     $175,037.50   —                                    │ │
│ │ 08 Mar 15-31    ▢ REVIEW    $205,105.00   —                                    │ │
│ │ 07 Mar 1-14     ▢ APPROVED  $291,080.00   MAR 18                               │ │
│ │ ...                                                                             │ │
│ └──────────────────────────────────────────────────────────────────────────────┘ │
├──────────────────────────────────────────────────────────────────────────────────┤
│ CHANGE ORDERS (compact ledger)                                                    │
│ stamp 'STAMPED · 3 APPROVED · 1 PENDING'                                          │
│ ┌──────────────────────────────────────────────────────────────────────────────┐ │
│ │ table of approved COs + pending CO-08 in stamped pull-quote                    │ │
│ └──────────────────────────────────────────────────────────────────────────────┘ │
├──────────────────────────────────────────────────────────────────────────────────┤
│ PHASE PROGRESS (dense ledger lines)                                               │
│ stamp 'STAMPED · 7 PHASES · CURRENT P4'                                           │
│ ┌──────────────────────────────────────────────────────────────────────────────┐ │
│ │ 7 ledger rows with progress bars                                               │ │
│ │ each row: phase label UPPERCASE + status sub UPPERCASE + 3px progress bar      │ │
│ └──────────────────────────────────────────────────────────────────────────────┘ │
├──────────────────────────────────────────────────────────────────────────────────┤
│ RECENT PHOTOS (3-col grid, stamp captions on each photo)                          │
├──────────────────────────────────────────────────────────────────────────────────┤
│ YOUR TEAM (2-col contact cards, stamp tone)                                       │
├──────────────────────────────────────────────────────────────────────────────────┤
│ Footer (mono UPPERCASE)                                                            │
└──────────────────────────────────────────────────────────────────────────────────┘
```

#### Header

- **NavBar:** dark band (`--nw-slate-deep`). Owner portal eyebrow center: JetBrains Mono UPPERCASE 10px Stone Blue. Owner role pill right (UPPERCASE stamp-tone).
- **Project header:** padding `p-[24px 32px]` (denser than Specimen's `p-[48px 56px]`)
  - NwEyebrow stamp-tone → "ANNA MARIA — HANLON RESIDENCE" (with stamp letterspacing 0.18em)
  - h1 Space Grotesk weight 500 size 28px UPPERCASE → "WELCOME BACK, DAVID"
  - Sub: JetBrains Mono UPPERCASE 11px `--text-secondary` → "BUILD 60% COMPLETE · PHASE 4/7 · MOVE-IN NOV 2026"

#### KPI strip

Same edge-to-edge hairline-divider trick as Helm + Brass. Each cell:
- Stamp caption top-right
- UPPERCASE eyebrow ("CONTRACT", "BILLED TO YOU", "REMAINING", "PENDING YOUR APPROVAL")
- Big number Space Grotesk weight 500 size 22px (smaller than Helm + Brass's 30 — Site Office is denser)
- UPPERCASE sub: "BASE $4.78M + 3 COs", "60.0% OF CONTRACT", "PROJECTED THRU CLOSE", "DRAW 9 · DUE APR 25"
- The PENDING cell uses italic warn color on the number — small concession to Specimen-flavored visual signal

#### Action banner (stamped manila-folder card)

- `<NwCard padding="md">` with Site Office stamp-folder treatment
- Stamp caption top-right: "STAMPED · ACTION REQUIRED · APR 30"
- NwEyebrow stamp-tone with `--nw-warn` color → "⚠ ACTION REQUIRED" (the only emoji allowed — direction signature for high-stakes attention)
- h2 Space Grotesk weight 500 size 22px UPPERCASE → "DRAW #9 READY FOR YOUR APPROVAL"
- Body: JetBrains Mono UPPERCASE 11px `--text-secondary` 65% opacity → "NET DUE $175,037.50 · PERIOD APR 1-18 · 14 INVOICES · SUBMITTED BY JAKE ROSS APR 30 1042" (compact dates + names)
- Action row: 2 buttons
  - "REVIEW DETAILS" (secondary variant, transparent + outlined)
  - "▢ APPROVE & RELEASE" (primary variant with green square stamp prefix — direction signature)

This is RADICALLY different from Helm + Brass's dark-island action banner and Specimen's editorial pull-quote. Site Office renders this as a stamped form, like a building permit awaiting signature.

#### Draw history (DataGrid compact, striped)

- Stamp caption: "STAMPED · 9 ENTRIES"
- DataGrid compact density, striped rows (`--bg-subtle` + `--bg-muted`)
- UPPERCASE column headers
- Status column: square stamp marker + UPPERCASE label ("▢ AWAIT", "▢ REVIEW", "▢ APPROVED", "▢ PAID")
- Money in NwMoney md tabular-nums
- Released column: UPPERCASE date "MAR 18" or "—" placeholder

#### Change orders, phase progress, photos, team — all dense ledger style

Each section has:
- Stamp caption with item count
- NwEyebrow stamp-tone section header
- UPPERCASE labels throughout
- Compact ledger-row layout

Phase progress: 7 ledger rows, each with:
- Phase label: Space Grotesk weight 500 size 12px UPPERCASE → "01 · SITEWORK & FOUNDATION"
- Status sub: JetBrains Mono UPPERCASE 10px → "COMPLETE · NOV 2025"
- Progress bar: 3px tall
- Fill colors:
  - Complete: `--color-success` (green) — Site Office DOES color-reinforce, unlike Specimen's mute
  - In progress: `--brand-accent` (Stone Blue) at percentage
  - Upcoming: empty bar with hairline border

#### Footer

- 1px top border `--border-default`
- 24px padding-top, 50px margin-top
- Footer: JetBrains Mono UPPERCASE 10px `--tracking-eyebrow` `--text-tertiary`
  - LEFT: "NIGHTWORK · OWNER PORTAL · ANNA MARIA — HANLON"
  - RIGHT: "LAST UPDATED · APR 30 2026 · 1047"

#### Audit timeline rendering on owner portal

Owner portal does NOT show the per-invoice audit timeline (consistent across all directions). Site Office renders the draw history as the audit at the owner level — but the draw history itself is rendered as a Telex-ticker-flavored table (dense, UPPERCASE, square stamp markers).

#### What makes Site Office distinctive on Owner Portal

- **Stamp captions on every section** (KPI cells, action banner, draw history, change orders, phase progress, photos, team).
- **UPPERCASE everywhere** including h1, h2, and body sub-lines. The owner portal reads as a stamped, dense, formal record-set.
- **Action banner as stamped manila-folder card** (NOT dark island, NOT editorial pull-quote).
- **Phase progress with green color reinforcement** — Site Office doesn't mute the visual signal like Specimen.
- **Compact dense layout** — Site Office's signature density commitment carries to the owner portal.

#### Token deep-cuts

| Element | Token / value |
|---|---|
| NavBar bg | `--nw-slate-deep` (dark) |
| Project header h1 | `font-display weight 500 size 28px UPPERCASE` |
| KPI big number | `font-display weight 500 size 22px` (denser) |
| Action banner | NwCard with stamp-folder treatment + stamp caption + UPPERCASE body |
| Action banner primary CTA | `<NwButton variant="primary">` with green square stamp prefix |
| Draw history | DataGrid compact striped + UPPERCASE column headers + square stamp markers in status |
| Phase progress bar | 3px tall, `--color-success` for complete (NOT muted) |
| Footer | UPPERCASE JetBrains Mono 10px |

### 4.9 Honest weaknesses

#### Worst for: owner portal hospitality moment

The owner portal is fundamentally a place where Ross Built wants to convey hospitality and curatorial attention to the homeowner. A homeowner reviewing their $4.82M build investment is not a PM hunting through a working ledger — they're an emotionally-invested non-technical user expecting transparency without overwhelm. Site Office's UPPERCASE-everywhere, stamp-marker-everywhere, JetBrains-Mono-on-body-text vocabulary reads as **bureaucratic and forms-like** to that audience. The stamped manila-folder action banner ("STAMPED · ACTION REQUIRED · APR 30") reads as a building permit pending signature, not as a courteous request from a builder. The dense Telex-ticker audit reads as a system log, not as a chronicle of the homeowner's project journey.

A homeowner in the Specimen owner-portal feels like their architect is presenting the project as a curated piece. A homeowner in the Helm + Brass owner-portal feels like the system is calibrated and trustworthy. A homeowner in the Site Office owner-portal feels like they're being asked to sign a form. The hospitality moment is the weakest part of Site Office.

#### Concession: visual quietness

Site Office is the loudest of the three directions. UPPERCASE typography saturating the page; JetBrains Mono everywhere; stamp captions on every panel; square stamp markers throughout; dense layout pushing information to the limits. Even though the colors are muted (Stone Blue de-emphasized to gray-blue, Slate Deep dominant), the visual NOISE is high.

For users who spend 8 hours a day staring at the surface, Site Office's intensity might fatigue. The PM scanning 50 invoices in the queue might find the UPPERCASE-everything reading less smoothly than Helm + Brass's mixed-case hierarchy or Specimen's editorial calm. Site Office buys its archival/methodical mood at the cost of visual quietness.

The trade-off: pick Site Office, and you accept that the user is in "working mode" for 8 hours, not "calm reading mode." The mood serves the audit-trail seriousness (per .impeccable.md §2.4) but at the expense of a quieter UX.

#### Risk: Site Office's stamp metaphor degrades when applied to non-form surfaces

Site Office's vocabulary is rooted in physical-form metaphors: stamp captions, square markers, manila-folder cards, Telex tickers, ruled ledgers. These metaphors work beautifully on document review surfaces where the user is genuinely processing a form (an invoice, a draw approval, a lien release). They strain on surfaces that DON'T have a form-processing analog — a settings page, an analytics dashboard with charts, a getting-started checklist, a real-time collaboration view (Wave 3+).

Over 5+ years and 50+ feature additions, surfaces that don't fit the forms metaphor force Site Office to either: (a) drop the metaphor (which fragments the visual identity), or (b) shoehorn the metaphor (which makes the surface read as forced). Either way, the cohesion erodes.

The picture-in-picture risk: a future analytics dashboard with chart-heavy visualizations might force Site Office to either render the charts as stamped data tables (reductive) or to render them as proper charts (which then look out-of-direction).

#### Mitigation if picked: codify the "Form Surface" rule and the "Non-Form Mode" exception

If Jake picks Site Office, the mitigation is to formalize a **"Form Surface" rule** in PATTERNS.md (extending the catalogue):

- **Form Surfaces (full Site Office treatment):** Document Review, Approval flows (Multi-step Approval), Reconciliation, Print View, Mobile Approval. These have form-processing metaphors that match.
- **Non-Form Surfaces (modified Site Office treatment):** Dashboard, Settings/Config Form, Wizard, Empty Workspace, List+Detail with chart components. These get a "Site Office Lite" mode where:
  - Stamp captions REMAIN (the vocabulary signal)
  - Square stamp markers REMAIN
  - UPPERCASE on labels REMAINS
  - JetBrains Mono on body micro-copy REMAINS
  - **But:** the manila-folder card metaphor opts out for chart panels (charts use plain `--bg-card` with `--border-default`)
  - **And:** the Telex-ticker audit format is relaxed to the standard chronological list when not on a form surface

The post-edit hook adds a Site-Office-specific check: surfaces with `<Chart>` or `<KPIBlock>` components in non-document-review contexts get flagged if they apply the manila-folder treatment. The `nightwork-design-system-reviewer` skill at `/nightwork-design-check` reviews for this distinction.

For the owner-portal hospitality weakness specifically: the Site Office Lite mode applies to the owner portal — stamp captions and UPPERCASE labels stay (they're the consistent direction signal), but the action banner uses the editorial pull-quote variant (lifted from Specimen) instead of the stamped manila-folder. The "WELCOME BACK, DAVID" h1 stays UPPERCASE (it's still a stamped section), but the body prose uses sentence-case Inter (lifted from Specimen's editorial body).

The mitigation has teeth: surfaces are tagged as form-surface or non-form-surface in PATTERNS.md (extending the catalogue with a `surfaceType: "form" | "non-form"` annotation per pattern); the playground (`/design-system/patterns`) renders both modes; the hook layer enforces the distinction; and the visual cohesion is preserved across both modes by retaining the direction signals (stamp captions, square markers, UPPERCASE labels).

---

## 5. Direction Comparison Matrix

Per nwrp16 directive 3 — rigorous comparison across axes Jake actually cares about. Don't fudge the demographics.

| Axis | Helm + Brass | Specimen | Site Office |
|---|---|---|---|
| **Best surface** | Invoice review, draw approval, dashboard (the "instrument-readout" surfaces where calibrated competence reads as quality) | Owner portal, document review where curatorial attention serves the brand, marketing site | Reconciliation, print view (G702/G703), full-text search, large data tables (the "audit ledger" surfaces) |
| **Worst surface** | Schedule grids (Wave 2), high-density daily logs (Wave 2) — instrument vocabulary adds noise at high data density | DataGrid pages (invoice queue, vendor list) — editorial vocabulary breaks down on dense scan-and-act surfaces | Owner portal hospitality moment — stamped/forms vocabulary reads as bureaucratic to the homeowner audience |
| **Best customer demographic** | **Boutique-luxury coastal/yacht-influenced builder.** Ross Built itself fits perfectly. Builder doing $5M-$20M ocean-front estates with white-glove service expectations. Owners who recognize and value yacht-club / luxury-coastal aesthetic. | **Premium-craft small builder, design-conscious clientele.** A 4-7 simultaneous job builder doing $3M-$8M architectural-monograph-quality residential — gallery owners, architects, design-conscious owners. The builder who would be in *Architectural Record*. | **High-volume production builder, efficiency-oriented owner-builder, large GC scaling to multi-state.** A 30-100 simultaneous job builder doing $1M-$3M tract or boutique-tract — owner-builder with strong record-keeping discipline. The builder who values "every dollar tracked" over "every page beautiful." |
| **Worst customer demographic** | **Inland production builder (e.g., Phoenix or Park City multi-state).** Marine vocabulary alien; coastal-engineering reference doesn't translate. By 100k tenants the brass-bezel reads stuck-in-Florida. | **Volume builder, efficiency-oriented owner.** Editorial slowness reads as wasted time; curatorial commitments cost real productivity. PMs trained in QuickBooks/Procore find the sentence-case + italic-everywhere unfamiliar. | **Boutique luxury / hospitality-oriented client.** Stamp-and-form vocabulary reads as bureaucratic to the homeowner; conflicts with the warmth/care brand promise of high-end residential. |
| **Implementation complexity** | **Medium.** Brass-bezel border-top is a single CSS-variable override (data attribute or class). Indicator-dot pairing requires NwStatusDot extension. Instrument-log audit is custom but reusable. The shadow-aggressive treatment requires the existing `--shadow-panel` token used aggressively (no new tokens). | **Low.** No new components needed (the plate-number caption is composed inline; T20a may codify if it appears 5+ places). Existing tokens used; some opted-out (`--shadow-panel`, `--shadow-hover` zero out). The challenge is *discipline* (preventing weight-500 drift, maintaining `gap-6` minimums) — a soft cost over 5+ years. | **High.** Square stamp marker requires NwStatusDot `shape="square"` extension. Stamp caption composition needs codification. Telex ticker layout is custom. Stamp-tone NwEyebrow and stamp-tone NwBadge variants need adding. Striped table rows require NwTable composition. New `--shadow-panel-site-office` softer-shadow value. Ruled-ledger texture is the most decorative of the three. |
| **Risk level** | **Medium.** By 100k tenants the maritime vocabulary becomes constraint that newer features have to work around. The mitigation (utility-density mode) needs ongoing enforcement. Brand-heritage commitment requires re-evaluation when Nightwork sells outside the Florida coastal market. | **Low at the structural level, high at the discipline level.** The structural commitments (no shadows, weight ≤500, `gap-6`) are easy to lock with hooks. The discipline commitments (sentence case, italic captions, plate-number presence, prose-not-table) require ongoing design custodianship. Without active `/nightwork-design-check`, drift toward Helm + Brass is the failure mode. | **Medium-high.** The forms-metaphor doesn't generalize beyond document review; non-form surfaces (charts, dashboards, real-time collaboration) require a "Site Office Lite" mode that fragments the visual identity. Over many releases the cohesion erodes unless the Form/Non-Form rule is rigorously enforced. The decorative elements (stamp captions, square markers, ruled ledger) are heavy to maintain. |

### 5.1 Distinctness verification (per SPEC A1)

The 4 axes called out in SPEC A1 distinctness self-review: **reference benchmark / density posture / motion posture / typography weight defaults.**

| Axis | Helm + Brass | Specimen | Site Office | Pair distinctness |
|---|---|---|---|---|
| Reference benchmark | Stripe Dashboard (technical, instrument) | Architect's Newspaper monograph (editorial) | Procore × Linear (industrial archival) | All 3 different (✓) |
| Density posture | Medium | Low | High | All 3 different (✓) |
| Motion posture | Functional fast (200ms) | Slow deliberate (240ms ease-in-out) | Instant (150ms) | All 3 different (✓) |
| Typography weight defaults | SG500 h1, SG400 h2; mono dominates | SG400 uniform; mono restrained | SG400/500 mixed; mono everywhere | All 3 different on the mono axis at minimum; weight-mix axis: H+B and SO share, S differs |

**Pair distinctness check** (per SPEC A1 — "at least 2 of 4 axes must vary per pair, AND no two directions share more than 1 axis with each other across the 3-direction set"):

- **A vs B (Helm + Brass vs Specimen):** all 4 axes differ ✓
- **A vs C (Helm + Brass vs Site Office):** density, motion, typography differ; reference benchmark differs (Stripe vs Procore-Linear) ✓ (4/4)
- **B vs C (Specimen vs Site Office):** all 4 axes differ ✓

**Transitive constraint** (per SPEC iteration-2 W2 — "no two directions share more than 1 axis"): no axis is shared across all 3. Density: low/medium/high. Motion: 240/200/150ms. Typography: 4 distinct postures. Reference: 3 distinct. ✓

The 3-direction set is transitively distinct.

### 5.2 The 5 reference benchmarks check (per .impeccable.md §5)

The .impeccable.md §5 names 3 benchmarks: Procore (construction-industry idiom), Linear (keyboard-driven dense interaction), Stripe Dashboard (financial-data clarity). Each direction emphasizes a different benchmark mix:

- **Helm + Brass** emphasizes Stripe Dashboard (financial-data clarity at scale; the instrument-readout vocabulary is Stripe's transaction-list character extended). De-emphasizes Procore's clutter; respects Linear's keyboard ergonomics for accountant-flow surfaces.
- **Specimen** de-emphasizes all three benchmarks — it imports a different reference (architectural monograph). The benchmark-trio still applies as quality bar (Specimen's data-display surfaces still scan; its keyboard ergonomics still work; its information architecture still mirrors Procore's idiom). But the mood is editorial-not-industry.
- **Site Office** emphasizes Procore × Linear hybrid — the construction-industry idiom (Procore) at the keyboard-driven density Linear pioneered. De-emphasizes Stripe's clean clarity in favor of dense-archival. The "stamped ledger" vocabulary is Procore's information density extended.

This emphasis-mix is part of the distinctness — Helm + Brass takes Stripe-flavored seriousness, Specimen escapes the industry benchmarks for a new reference, Site Office doubles down on Procore-Linear.

---

## 6. Direction-pick consequences

Once Jake picks a direction at CP2, what flows downstream? This section documents the WEIGHT of the pick.

### 6.1 The playground (T18-T26)

**T20a-T20f (the 6 component category pages)** implement components in the picked direction's variant preferences. For example:

- **Helm + Brass picked:** the Inputs category page renders Button at `variant="primary"` with brass-bezel border-top, NwBadge with the Stone Blue indicator-dot prefix, ConfidenceBadge with instrument-readout layout. The DataGrid page renders compact density with brass-bezel.
- **Specimen picked:** the Inputs category page renders Button at `variant="ghost"` sentence-case, NwBadge with `/0.7` opacity reduced contrast, ConfidenceBadge as italic prose. DataGrid renders comfortable density with hairline borders only.
- **Site Office picked:** Inputs Button at `variant="secondary"` UPPERCASE + stamp prefix, NwBadge with `0.18em` letter-spacing, ConfidenceBadge with stamp caption. DataGrid renders compact density with striped rows.

**T23 (the patterns page)** renders the 12 patterns in the picked direction's gold-standard variant. Document Review, Dashboard, Mobile Approval, Owner Portal — all 4 of the renders described in this document — get their picked direction realized as static layouts in the playground.

**T24 (the philosophy page)** renders this PHILOSOPHY.md document's content in the playground, with all 3 directions still visible side-by-side. The CP2 affordance (T24.1) lives here.

**T25 (the forbidden page)** renders the Forbidden gallery from .impeccable.md §3, plus direction-specific Forbidden additions (per §6.3 below).

### 6.2 The skills (post-CP2 lockstep updates)

- **`nightwork-design` skill** — adds a "Locked direction" row to its Authoritative documents pointing to `.planning/design/CHOSEN-DIRECTION.md`. The skill's reference HTML set (Slate*.html files) is filtered so the picked direction's reference becomes the canonical visual anchor; the other two directions are archived to `audit-notes/` for record but no longer surfaced in the skill.
- **`nightwork-design-tokens` skill** — adds direction-specific Forbidden patterns to its hard-rejections list (e.g., "Specimen: weight ≥ 500 on display headings is forbidden"; "Site Office: row hover background change is forbidden — only border-color change").
- **`nightwork-ui-template` skill** — its Document Review reference is updated to instantiate the picked direction's variant choices (e.g., Helm + Brass picked → the skill's example component manifest shows brass-bezel Card; Site Office picked → the manifest shows stamp-caption Card).
- **`nightwork-design-system-reviewer` agent** — adds direction-specific quality bar checks at `/nightwork-design-check`. For example, Specimen-picked: every internal-screen eyebrow is audited for sentence case; Helm + Brass-picked: every Card is checked for brass-bezel border-top presence on canonical surfaces.
- **`nightwork-ui-reviewer` agent** — same direction-specific check additions.
- **`impeccable` skill** — `.impeccable.md` §6 ("The locked PHILOSOPHY direction") is filled with the picked direction's name + axes (reference benchmark, density, motion, typography). The skill substitutes the picked direction into its review logic.
- **`frontend-design` skill** — the built-in skill's review logic gets a direction-specific override file at the root of the skill, pointing back to PHILOSOPHY.md §[N] for the picked direction.

### 6.3 The Forbidden list extension (.impeccable.md §3)

The 7 hook-enforced Forbidden items remain locked across all directions. Direction-specific additions:

- **If Helm + Brass picked, additions:**
  - Drop-shadow `filter: blur(>2px)` outside the right-rail elevation (forbid: glow-shadow on hover; allow: `--shadow-panel` and `--shadow-hover`)
  - Brass-bezel decoration on a `density="utility"` surface (the mitigation rule)
  - Status pill without the indicator-dot prefix (the indicator-light vocabulary is signature)

- **If Specimen picked, additions:**
  - UPPERCASE eyebrows on internal screens (sentence-case only; UPPERCASE is the stamp-tone reserved exception)
  - Weight ≥ 500 on display headings (weight 400 only; weight 500 is emphasis-within-prose only)
  - `gap-3` or smaller between top-level cards (always `gap-6` minimum)
  - Colored backgrounds on cards (always `--bg-card`; pull-quote uses hairline borders only)
  - Progress-bar fill in `--color-success` (use `--text-tertiary` for complete; `--brand-accent` for in-progress only)
  - Density `compact` outside tables/DataGrid

- **If Site Office picked, additions:**
  - Eyebrows in sentence case on canonical surfaces (UPPERCASE JetBrains Mono only)
  - NwBadge without 0.18em letter-spacing on stamp-tone instances
  - NwCard `padding="lg"` (Site Office is `padding="sm"` default; `md` opt-in for forms; `lg` is forbidden as too-spacious)
  - Status pill without square stamp marker prefix on canonical surfaces
  - Audit timeline rendered as anything other than Telex ticker
  - Manila-folder treatment on charts (the Form Surface rule)

These direction-specific additions are added to the post-edit hook (`.claude/hooks/nightwork-post-edit.sh`) as direction-conditional checks: read `.planning/design/CHOSEN-DIRECTION.md`, apply the picked direction's Forbidden patterns.

### 6.4 The pattern catalogue (PATTERNS.md)

PATTERNS.md's "Document Review" entry §2 currently describes the layout contract abstractly (file preview LEFT, fields RIGHT, audit BELOW). After CP2:

- The §2c "Anatomy" ASCII diagram is replaced with the picked direction's render (the §2.5 / §3.5 / §4.5 of this document).
- The §2d "Components used" list is filtered to the picked direction's variant preferences.
- The §2e "Tokens used" table is updated with the direction's token-usage posture.
- The §2g "Mobile behavior" table is updated to the picked direction's mobile render (§2.7 / §3.7 / §4.7).
- The §2i "Anti-patterns" list adds direction-specific entries.

The other 11 patterns inherit the same direction. PATTERNS.md does NOT split into 3 versions — it has a single direction once CP2 is locked.

### 6.5 The Site Office "Form Surface" extension (only if Site Office picked)

If Jake picks Site Office, PATTERNS.md gets a new section §15 ("Form Surface vs Non-Form Surface rule") documenting:

- Form Surfaces (full Site Office treatment): Document Review, Multi-step Approval, Reconciliation, Print View, Mobile Approval
- Non-Form Surfaces (Site Office Lite — stamp captions + UPPERCASE labels + JetBrains Mono micro-copy retained, but manila-folder cards opted out and Telex-ticker audit relaxed): Dashboard, Settings, Wizard, Empty Workspace, List+Detail with charts

The post-edit hook adds the Form Surface check.

### 6.6 The Helm + Brass "Utility Density" extension (only if Helm + Brass picked)

If Jake picks Helm + Brass, SYSTEM.md §10 (Density modes) gets extended with `--density-utility`:

- `--density-utility-row: 28px` (denser than compact)
- `--density-utility-padding: 2px 6px`

PATTERNS.md gets a new note: dense schedule grids (Wave 2) and high-density daily logs use `density="utility"`. In utility mode, the brass-bezel border-top is opted out.

### 6.7 The Specimen "Editorial Discipline" extension (only if Specimen picked)

If Jake picks Specimen, the post-edit hook adds 6 Specimen-specific checks (per §3.9 mitigation), and `nightwork-design-system-reviewer` adds Specimen-quality-bar reviews.

### 6.8 What does NOT change post-CP2

Per nwrp16 directive 8 — directions extend the existing aesthetic; they don't replace it.

- **Slate palette** (Set A or B, picked separately at CP2 palette page T21) — locked across all directions
- **Type families** (Space Grotesk + Inter + JetBrains Mono) — locked
- **Border radius** (0 except avatars/dots) — locked
- **Logo placement** (top-right of authenticated surfaces) — locked
- **Document Review template** (file preview LEFT, fields RIGHT, audit BELOW) — locked across all 3 directions; only the rendering interprets it
- **The 7 .impeccable.md principles** — locked
- **The 7 hook-enforced Forbidden items** — locked
- **The 33 components in COMPONENTS.md inventory** — locked
- **The 12 patterns in PATTERNS.md catalogue** — locked

Directions affect: which COMPONENTS.md variants get used, which tokens get emphasized, what motion timing applies, what extra Forbidden items get added (but NOT existing locked Forbidden), and what direction-specific signature visual cue is the most-repeated motif.

---

## 7. CP2 affordance

Per SPEC E4 + T24.1 + nwrp16 directive — the CP2 picking happens visually on the playground.

### 7.1 The playground route

Jake navigates to `/design-system/philosophy` (gated to platform_admin in production per SPEC B7). The route renders:

- **§1 The 3 directions at a glance** — the comparison table from this document
- **3 direction sections** — each direction's overview + 4 renders (invoice review, dashboard, mobile approval, owner portal) rendered as static layouts using the playground's sample-data fixtures
- **§5 Comparison Matrix** — the full matrix from this document
- **CTA per direction:** "Pick this direction →" button (gated to platform_admin)

### 7.2 The pick interaction

Jake reads the 3 directions, scrolls through the 12 render artifacts (3 directions × 4 renders), reviews the comparison matrix, and clicks the "Pick this direction →" button on his chosen direction.

The button click POSTs to `/api/design-system/pick-direction` (a route gated to platform_admin per the same middleware that gates `/design-system/*`). The route writes the chosen direction's name to `.planning/design/CHOSEN-DIRECTION.md` (a marker file). The route also opens a Confirm dialog:

> "You're picking **Helm + Brass** as the Nightwork design direction. This locks the picked direction across the playground, the design skills, the patterns catalogue, and the Forbidden list. Subordinate work (T20a-T26 component playground builds, post-CP2 skill updates, PATTERNS.md update, .impeccable.md §6 fill) will use the picked direction.
>
> Proceed?
>
> [Cancel] [Pick Helm + Brass]"

On confirm, the marker file is written and Jake is redirected to `/design-system` (the playground index) where a banner appears: "**Helm + Brass** is the locked design direction. (Picked Apr 30, 2026 by Jake Ross.)"

### 7.3 The marker file

`.planning/design/CHOSEN-DIRECTION.md` is the single source of truth for "what direction is locked." Its contents:

```md
# CHOSEN-DIRECTION.md

**Status:** LOCKED at Strategic Checkpoint #2 on YYYY-MM-DD by Jake Ross.

**Direction:** [Helm + Brass | Specimen | Site Office]

**Reference:** PHILOSOPHY.md §[2 | 3 | 4]

**Reasoning (Jake's note at pick):**
[Free-form note Jake adds via the Confirm dialog input]

**Subordinate work triggered:**
- T20a-T26 component playground builds: render in picked direction
- nightwork-design skill: update Authoritative documents, filter reference HTMLs to picked
- nightwork-design-tokens skill: add direction-specific Forbidden patterns
- nightwork-ui-template skill: instantiate Document Review reference in picked direction
- nightwork-design-system-reviewer agent: add direction-quality-bar checks
- impeccable skill (.impeccable.md §6): fill picked direction's name + axes
- frontend-design skill: add direction override file
- PATTERNS.md: update gold-standard renders to picked direction
- .impeccable.md §3: append direction-specific Forbidden items
- post-edit hook (.claude/hooks/nightwork-post-edit.sh): apply direction-conditional checks
```

This marker file is committed by Claude after Jake confirms — the click-to-commit handoff is documented at PROPAGATION-RULES.md (per RP12 in PLAN.md §6).

### 7.4 The lock posture

After CP2, the picked direction is locked. Subsequent design changes are propagated through `/nightwork-propagate` per the existing cross-cutting workflow. Switching direction post-lock requires:

1. A new phase (e.g., "Stage 1.5d: Re-evaluate design direction")
2. A new Strategic Checkpoint (CP-N)
3. The current marker file archived to `audit-notes/`
4. A new marker file written

This is intentional — the direction is the foundation of every Nightwork visual surface from Stage 1.5b onward. Switching requires explicit re-evaluation, not casual revision.

### 7.5 Pre-pick playground use

Before CP2, the playground at `/design-system/philosophy` shows all 3 directions side-by-side. This document (PHILOSOPHY.md) is the textual companion. The renders in T20a-T26 (the component category pages, the patterns page) at this stage render **all 3 directions side-by-side** when Jake browses, OR the page lets Jake toggle which direction is "active" via a query param (`?direction=helm-brass | specimen | site-office`).

Once CP2 is locked, the toggle is removed and the playground renders exclusively in the picked direction. (The marker file's existence is what the playground reads to switch from "compare 3" to "lock 1" mode.)

---

## 8. Cross-references / appendix

### 8.1 SPEC criteria satisfied by this document

| SPEC criterion | How PHILOSOPHY.md satisfies |
|---|---|
| **A17** — PATTERNS.md "Print View" specifies AIA G702/G703 print layout — wait, A17 in v2 is misnamed. Per SPEC v2.1 actual A17, this document covers PATTERNS Print View. Double-checked. PHILOSOPHY.md is per **A17a + A17b** (the split that nwrp16 combined back into one document). | The 3 directions are presented with concept paragraphs (A17a) + concrete screen comparisons (A17b — invoice review, dashboard, mobile approval, owner portal). |
| **A21** — Locked-direction placeholder | §6 documents what flows downstream once locked; §7 documents the CP2 affordance and marker-file workflow. The marker file at `.planning/design/CHOSEN-DIRECTION.md` is the placeholder until Jake picks. |
| **E4** — CP2 pick-affordance UI | §7 documents the playground-level CP2 affordance. The actual T24.1 button implementation is forward-looking. |
| **E5** — Locked direction section | §7.3 specifies the marker file shape. Initially blank until Jake picks. |

### 8.2 SPEC criteria PHILOSOPHY.md does NOT satisfy (intentional)

- **A1** distinctness self-review checklist at end of each direction — implemented at §5.1 across the 3 directions, not per-direction. The original A1 spec called for per-direction; nwrp16's directive 3 (comparison matrix) supersedes by handling distinctness at the matrix level.
- **A2** Forbidden section verbatim from Jake's brief — handled by .impeccable.md §3 + SYSTEM.md §13. PHILOSOPHY.md cross-references; doesn't re-list.

### 8.3 Referenced Nightwork files

| Source | Path |
|---|---|
| Token catalog (single source of truth) | `.planning/design/SYSTEM.md` |
| Component inventory | `.planning/design/COMPONENTS.md` |
| Pattern catalogue | `.planning/design/PATTERNS.md` |
| Workflow rules | `.planning/design/PROPAGATION-RULES.md` |
| Quality contract | `.impeccable.md` (repo root) |
| WCAG matrix | `.planning/design/CONTRAST-MATRIX.md` |
| Real Nightwork invoice review | `src/app/invoices/[id]/page.tsx` |
| Real Nightwork dashboard | `src/app/dashboard/page.tsx` |
| AppShell (responsive) | `src/components/app-shell.tsx` |
| Existing custom components | `src/components/nw/{Button,Eyebrow,Badge,Card,DataRow,Money,StatusDot}.tsx` |
| Slate prototype HTMLs | `.claude/skills/nightwork-design/Slate *.html` |
| Brand identity directions | `.claude/skills/nightwork-design/Brand Identity Directions.html` |
| nightwork-design skill | `.claude/skills/nightwork-design/SKILL.md` |
| nightwork-ui-template skill | `.claude/skills/nightwork-ui-template/SKILL.md` |
| nightwork-design-tokens skill | `.claude/skills/nightwork-design-tokens/SKILL.md` |

### 8.4 Hook-enforced Forbidden items (locked across all directions)

Per .impeccable.md §3.1 — these remain locked regardless of direction:

1. Oversized rounded corners (`rounded-(md\|lg\|xl\|2xl\|3xl\|full)` outside avatar/dot files)
2. Bouncy easing (`cubic-bezier()` with 2nd or 4th arg ≥ 1.0)
3. Purple/pink HSL accents (`hsl(h, ...)` where `h ∈ [270°, 320°]`)
4. Dark glows (`box-shadow:` blur > 20px AND non-zero spread)
5. Hardcoded hex outside tokens
6. Tenant props on primitives (`org_id`, `membership`, `vendor_id`, `orgId`, `membershipId` in `src/components/ui/*.tsx`)
7. Sample-data leakage (import from `@/lib/(supabase|org|auth)/*` modules inside `src/app/design-system/`)

### 8.5 Direction picks summary (CP2 worksheet for Jake)

Jake's CP2 picking is a single, irreversible commit. Use this worksheet:

| Question | If "yes" → lean toward... |
|---|---|
| Is Ross Built's coastal-Florida heritage a strong brand asset that should be visually obvious? | Helm + Brass |
| Will Nightwork be sold to other coastal/yacht-influenced builders soon? (Y0-Y2) | Helm + Brass |
| Will Nightwork be sold to non-coastal high-volume production builders soon? | Site Office |
| Is the PRIMARY user (8h/day audience) the field PM scanning queues? | Site Office |
| Is the PRIMARY user the owner-manager / homeowner reviewing draws? | Specimen (or Helm + Brass with brass-bezel restraint) |
| Is the BRAND voice "white-glove luxury construction"? | Helm + Brass or Specimen |
| Is the BRAND voice "open-book, every-dollar-tracked methodical record-keeping"? | Site Office |
| Is the BRAND voice "we treat your build like a curated piece"? | Specimen |
| Will the Wave 2 schedule + daily-log surfaces ship in the next 12 months? | Site Office (densest natively) or Helm + Brass + utility-density mode |
| Will Nightwork need a marketing site that positions for an external designer-buyer audience? | Specimen |
| Are PMs / accountants moving from QuickBooks / Procore (Industry-trained users)? | Site Office (least friction) |

The pick is Jake's. This worksheet is rough. The renders + the comparison matrix + the weakness analysis are the rigorous inputs.

### 8.6 What this document does NOT do

- This document does NOT pick a direction. Jake picks at CP2.
- This document does NOT propose new directions. The 3 are locked per nwrp16.
- This document does NOT change the Slate palette, type system, border radius, logo placement, or any locked SYSTEM.md token.
- This document does NOT modify the 7 .impeccable.md principles (which are direction-agnostic).
- This document does NOT modify the 33 COMPONENTS.md primitives or the 12 PATTERNS.md catalogue entries.
- This document does NOT change the locked Forbidden hook list (the 7 items remain).
- This document does NOT propose Storybook, Framer Motion, or any out-of-scope tooling.

### 8.7 Versioning posture

Per SPEC A19 — Stage 1.5a is **v1.0**. PHILOSOPHY.md is v1 DRAFT until CP2 is held; thereafter it becomes v1 LOCKED with §7.3's marker file populated.

Subsequent PHILOSOPHY.md changes (e.g., a Stage 1.5d re-evaluation) follow PROPAGATION-RULES.md workflow: a new phase, a new Checkpoint, a new marker file, archival of the previous.

### 8.8 nwrp16 directive compliance

- **Directive 1** (concrete renders, not aesthetic prose): each direction has 4 renders × ~7 subsections each (layout map, header, main regions, element-by-element styling, audit timeline rendering, distinctive features, token deep-cuts). Implementable from description alone. ✓
- **Directive 2** (honest weaknesses, no sugarcoating): each direction has 4 weaknesses (worst-for, concession, risk, mitigation) at different angles. ✓
- **Directive 3** (rigorous comparison matrix): §5 with 6 axes (best surface, worst surface, best demographic, worst demographic, implementation complexity, risk level) plus distinctness verification (§5.1) and benchmark check (§5.2). ✓

---

**End of PHILOSOPHY.md v1 DRAFT.**

This document is the canonical CP2-picking document. Per SPEC E5 + nwrp16 — it ends with §7's locked-direction placeholder ("the marker file at `.planning/design/CHOSEN-DIRECTION.md` is the placeholder until Jake picks"). Once Jake picks at CP2, the marker file is populated and §6's downstream propagation triggers. The actual visual playground that Jake browses is at `/design-system/philosophy` once T18-T26 lands.

**HALT — do not proceed to T18 (playground build) until this document is read and CP2 picking has happened.**
