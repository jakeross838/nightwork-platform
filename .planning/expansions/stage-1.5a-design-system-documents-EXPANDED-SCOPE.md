# Expanded scope — stage-1.5a-design-system-documents

**Status:** APPROVED 2026-04-29
**Generated:** 2026-04-29
**Approved with amendments per nwrp10.txt:** all 14 targeted questions answered (recommended answers locked except Q14 which Jake narrowed to brand-accent + brand-logo only — see §6). Additional requirement added: each PHILOSOPHY direction must reference real Nightwork screens (invoice review, dashboard, mobile approval) — no abstract aesthetic descriptions.
**Stated scope (Jake's words, verbatim):**

> I want this design system locked down so every screen we build looks like Nightwork and not like generic AI SaaS. The invoice review UI we already have is the gold standard - file preview LEFT, right-rail panel, audit timeline. Anything that's a document review surface should match that.
>
> Stone blue palette stays - #6B8EA3 accent, #2D3E4A dark slate, #8A8A8A warm gray. Calibri font. Ross Built logo top-right. Need full color scales extended (success, error, warning, info) but keeping the stone blue identity.
>
> I want to feel like serious financial software for custom builders, not playful or startup-y. Custom builders should look at this and think "this is real construction software" - more like Procore meets Linear meets Stripe Dashboard, less like Notion or Slack. Dense where it should be dense (tables, financials, line items), comfortable where users need to focus (approval flows, document review). Something that holds up next to QuickBooks for trust but looks 10 years more modern.
>
> Things I never want to see again - bouncy easing, generic gradients, purple/pink accents, dark glows, oversized rounded corners, marketing-page typography on internal screens, anything that feels like a phone app trying to be desktop, or desktop trying to be a phone app.
>
> Mobile matters - PMs in the field approving on phones, owners reviewing draws on phones. But it should feel like real construction software on mobile, not a watered-down version. Touch targets that work with gloves on. Pinch zoom on documents.
>
> Components I know I always need - Button (variants for primary, secondary, destructive, ghost), Input, Select, Combobox (the searchable kind for vendors and GL codes), DatePicker, Table (tons of these for invoices, line items, vendors, etc), DataGrid for editable financial tables, Card, Modal, Drawer, Sheet, Tabs, Toast, Banner, Empty State, Loading State, Error State, Skeleton, Tooltip, Popover, Form. Plus the Document Review pattern for everything that's "look at file + approve/reject."
>
> Patterns I need - Document Review (gold standard), Dashboard (data-dense), Settings (config forms), List+Detail (table with right rail), Wizard (multi-step like new project), Empty Workspace, Print View (AIA G702/G703 has to print perfectly), Mobile Approval, Reconciliation surface (per NQ5 from CP1).
>
> Give me 3 distinct philosophy directions to pick from at checkpoint. Don't just give me one - I want to actually choose. Each direction needs to be concrete enough I can imagine real Nightwork screens in it.
>
> No prototypes in this phase - that's 1.5b. This phase is just the documents (PHILOSOPHY, SYSTEM, COMPONENTS, PATTERNS, PROPAGATION-RULES, .impeccable.md, components playground). Everything that defines what the design system IS so 1.5b has something concrete to render against.
>
> Use frontend-design skill, impeccable skill, shadcn-ui skill throughout. The component inventory should map every component to shadcn equivalents because we're building on shadcn.

---

## 1. Mapped design surfaces and existing tokens

| Surface / token / asset | VISION wave | Current state | Notes |
|---|---|---|---|
| Slate palette hex values | Wave 1 (locked) | **DIVERGES** — Jake's brief: `#6B8EA3` accent / `#2D3E4A` dark slate / `#8A8A8A` warm gray. Existing `nightwork-design` skill: `#5B8699` stone-blue / `#1A2830` slate-deep / `#3B5864` slate-tile / `#F7F5EC` page (white-sand). Q1 below resolves. | Difference is small (perceptual ΔE) but not zero. SYSTEM.md must lock one set. |
| Typography family | Locked per CLAUDE.md? | **CONFLICT** — Jake's brief + CLAUDE.md "standing rules" line 1 say "Calibri is the product typeface." Existing `nightwork-design` skill + `tailwind.config.ts` + `colors_and_type.css` use **Space Grotesk** (display) + **Inter** (body) + **JetBrains Mono** (eyebrows/money). **Q2 below resolves — this is the highest-priority decision in the phase.** | Calibri is a Microsoft system font (commercially licensed), not a Google Font; using it on the web means custom @font-face hosting + license verification. Space Grotesk + Inter are open-licensed. Materially different choice. |
| Page background | Locked | `#F7F5EC` white-sand per existing skill. NEVER pure white. | Should stay; Jake didn't contradict. |
| Border-radius | Locked | "Everything is square. Zero border-radius except avatars and status dots" per existing skill. | Aligns with Jake's "no oversized rounded corners". Stays in SYSTEM.md. |
| Money formatting | Locked | `formatCents()` / `formatDollars()` from `src/lib/utils/format.ts`; `font-variant-numeric: tabular-nums`; mono family. | Stays. |
| Status pills | Locked | Bordered, never filled. `formatStatus()` + `statusBadgeOutline()` helpers. | Stays. |
| Eyebrows | Locked | JetBrains Mono 10px UPPERCASE; `<NwEyebrow>` component. | Family changes if we move off JetBrains Mono — see Q2. |
| Component library | Wave 1 | shadcn/ui + Radix primitives + Tailwind. `<NwButton>`, `<NwEyebrow>` exist. Most others are ad-hoc per surface. | COMPONENTS.md is mostly *codification* of existing-but-undocumented components plus a few new ones. |
| Invoice review template | Wave 1 — gold standard | `src/app/invoices/[id]/page.tsx` (2,229 LOC); `nightwork-ui-template` skill codifies it. File preview LEFT (`grid-cols-1 lg:grid-cols-2`), right-rail panels, audit timeline below. | This IS the gold standard per Jake's brief; PATTERNS.md "Document Review" pattern lifts directly from it. |
| Existing design skills | Build system | `nightwork-design`, `nightwork-design-tokens`, `nightwork-ui-template` already shipped. Define palette intent, token enforcement, document-review template. | New SYSTEM.md / PHILOSOPHY.md / etc. should *reference and extend* these, not replace them. |
| Dark mode posture | Locked? | `tailwind.config.ts` has `darkMode: ["class", '[data-theme="dark"]']`; `nw_theme` cookie + `ThemeProvider` exist. Tokens auto-flip via CSS vars. | Q3 below — is dark mode in 1.5a scope or deferred? |
| Print view | Wave 1 | AIA G702/G703 generation exists; `print:hidden` + `print:block` patterns in invoice page. Not yet codified as a design pattern. | Jake's brief calls out "Print View (AIA G702/G703 has to print perfectly)" as a pattern. PATTERNS.md must define print-view rules. |
| Mobile breakpoints | Tailwind defaults | `lg:` (1024px) is the desktop pivot in invoice template. No phone-vs-tablet distinction yet. | Q4 — explicit Nightwork breakpoints for "phone in field" vs "tablet in office" vs "desktop"? |
| Iconography | Existing | Heroicons outline (stroke 1.5) per existing skill. | Stays. |
| Reference assets | Existing | `Slate *.html` reference screens at the root of `nightwork-design` skill. | These become PHILOSOPHY.md Direction 1 ("the existing Slate") visual anchor. |

---

## 2. Prerequisite gaps

What MUST exist (or be decided) before this phase can ship.

| # | Gap | Source | Blocking? | Resolution |
|---|---|---|---|---|
| 1 | Typography decision (Calibri vs Space Grotesk + Inter + JetBrains Mono) | CLAUDE.md vs existing skill | **HARD BLOCKING** — this phase's SYSTEM.md cannot be written without a single answer | Q2 below. Jake picks. |
| 2 | Palette hex reconciliation (Jake's `#6B8EA3` etc. vs existing `#5B8699` etc.) | Jake's brief vs existing skill | BLOCKING | Q1 below. Jake picks (or I detect it was a paraphrase). |
| 3 | Dark mode posture | Implementation exists but design-system documentation hasn't formally treated it | DEFER acceptable | Q3 below. Recommended: include dark mode in SYSTEM.md scope; the implementation already exists. |
| 4 | Motion library choice | Jake's "no bouncy easing" + existing CSS keyframes; no Framer Motion or motion library in `package.json` per CURRENT-STATE | DEFER acceptable | Q5 below. Recommended: CSS-only motion for 1.5a; Framer Motion deferred. |
| 5 | Components playground technical choice (Storybook vs Ladle vs custom Next.js route vs Histoire) | New work | BLOCKING for the playground deliverable | Q6 below. Recommended: custom Next.js route at `/design-system` (gated to `platform_admin`). |
| 6 | Reconciliation-surface pattern definition | NQ5 / D-036 | BLOCKING for PATTERNS.md (per Jake's brief listing it as a pattern) | Define abstractly in PATTERNS.md; visual mock-up lands in 1.5b. |
| 7 | Density tokens approach | Jake's "dense where dense, comfortable where comfortable" but no formal density system today | BLOCKING for SYSTEM.md | Q7 below. Recommended: explicit `--density-compact` / `--density-comfortable` token group; per-component density via prop. |
| 8 | shadcn baseline confirmation | Jake's brief mentions shadcn-ui skill; existing components use shadcn primitives ad-hoc | Light blocker | Verify each component in Jake's component list maps to a shadcn component (Combobox = `cmdk` + `Popover`; DataGrid = TBD — TanStack Table?). Q8 below. |

---

## 3. Dependent-soon gaps

What's likely needed shortly after this phase — design for it now.

| # | Gap | Likely next phase | Design implication for 1.5a |
|---|---|---|---|
| 1 | Prototype gallery on Drummond data | Stage 1.5b | PATTERNS.md must be concrete enough to render. Each pattern includes: required regions, data shape contract, example states (loading / empty / error / read-only / locked). |
| 2 | Visual regression test harness | Stage 1.5c | COMPONENTS.md must list each component's "snapshot states" (default, hover, focus, disabled, loading, error). 1.5c automates the snapshot capture; 1.5a defines the contract. |
| 3 | Dark mode polish | Stage 1.5b or post-foundation | If Q3 keeps dark mode in scope, 1.5a's SYSTEM.md must define the dark token mapping (`--bg-card-dark`, etc.) per CSS variable. |
| 4 | Reconciliation surface | Post-Phase-3.9 (D-028) + 1.5b mock-up (D-036) | PATTERNS.md "Reconciliation" must define: drift visualization (side-by-side delta? inline diff? timeline overlay?), writeback affordances, accept/dispute/CO actions. The 1.5b mock-up needs this contract. |
| 5 | Mobile-first approval flow on real Drummond data | Wave 1.1 (CP4) | PATTERNS.md "Mobile Approval" must specify: minimum touch target (44 vs 56?), gesture vocabulary, file-preview-on-mobile interaction, approve-by-swipe vs tap. |
| 6 | Owner portal (Wave 3) | Wave 3 client portal | PATTERNS.md must distinguish "internal-builder UI" patterns from "owner-facing" patterns. Owner-facing = reduced density, larger type, less jargon. |
| 7 | AIA G702/G703 PDF print fidelity | Wave 3 / draws polish | PATTERNS.md "Print View" must specify how `print:` Tailwind utilities are applied; static-block fallback in print stylesheet for the AIA form layout that browsers don't render at runtime. |
| 8 | Drag-and-drop file uploads on mobile | Wave 1.1 + Wave 2 daily logs | COMPONENTS.md needs a `<FileDropzone>` entry with mobile-camera-access variant. |
| 9 | Multi-tenant brand customization | Future (post Wave 3) | SYSTEM.md token architecture should allow per-org logo/color override (the `organizations.branding` JSONB per VISION.md §2.1). Don't bake "Ross Built" into the design system; bake the *pattern* of brand swap. |

---

## 4. Cross-cutting checklist

| Concern | Status | Rationale |
|---|---|---|
| **Token enforcement** | APPLIES — explicit | `nightwork-design-tokens` skill + post-edit hook already enforce. SYSTEM.md must enumerate every token name; PROPAGATION-RULES.md must specify how token additions/changes flow (migration path + propagate orchestrator). |
| **Accessibility** | APPLIES | WCAG 2.1 AA minimum. PHILOSOPHY.md commits to it; SYSTEM.md specifies contrast ratios per token; COMPONENTS.md specifies ARIA per component. Q9 below — 2.1 AA or 2.2 AA? Recommended: **2.2 AA** (latest stable; covers focus appearance + dragging gestures relevant to mobile). |
| **Print view** | APPLIES — primary scope item per Jake | PATTERNS.md "Print View" required. AIA G702/G703 layout reproducibility is non-negotiable. CSS `@media print` rules + per-component `print:` variants. |
| **Mobile-first responsive** | APPLIES — primary scope item per Jake | Touch targets ≥44px (WCAG 2.5.5). Gloves-on test = 56px+ for high-stakes actions (approve/reject/void). Q4 below resolves breakpoints. |
| **Dark mode** | APPLIES if Q3 = yes | Existing `tailwind.config.ts` supports it; tokens auto-flip via CSS vars. Codify in SYSTEM.md. |
| **Brand consistency at scale** | APPLIES | Multi-tenant: per-org branding override (logo + accent) without breaking design system. Token architecture allows it. |
| **Design-as-code propagation** | APPLIES — PROPAGATION-RULES.md | When SYSTEM.md changes a token: who runs `/nightwork-propagate`? What's the blast radius? When does the post-edit hook learn the new token name? |
| **Components playground** | APPLIES — explicit deliverable | Q6 below resolves tech. |
| **Documentation cross-reference** | APPLIES | `.impeccable.md` configures the `impeccable` skill for Nightwork; must reference SYSTEM.md/COMPONENTS.md/PATTERNS.md. PHILOSOPHY.md links to anti-references (Procore, Linear, Stripe; anti: Notion, Slack). |
| **Versioning of design system** | DEFER | Big systems version their design system (Material 1/2/3, Salesforce Lightning). For Nightwork at this stage: 1.5a IS v1.0; bumping happens when token shapes change. PROPAGATION-RULES.md notes versioning posture but doesn't formalize. |
| **Audit-log for design changes** | N/A | Design system changes are git history; no DB log needed. |
| **Permissions** | APPLIES — components playground gating | `/design-system` route is platform-admin-only or available to all org members? Recommended: all authenticated users (educational); gate write actions on the playground (none expected). |
| **Idempotency / rate limit / background jobs** | N/A | This phase produces docs + a static playground page. |
| **Drummond fixtures sufficient** | N/A — design phase | The components playground renders sample data, not Drummond data; PATTERNS.md examples may use Drummond fixtures abstractly. |
| **CI gate** | DEFER | 1.5c sets up visual regression CI; 1.5a doesn't. The post-edit hook for design tokens already enforces at commit time. |
| **Anti-patterns enforcement** | APPLIES — strong Jake brief | Jake's "things I never want to see again" list is a hard constraint. Lift verbatim into PHILOSOPHY.md or SYSTEM.md as a "Forbidden" section. The `nightwork-design-system-reviewer` agent reviews against it. |

---

## 5. Construction-domain checklist

| Domain consideration | Applies? | Rationale |
|---|---|---|
| AIA G702/G703 print fidelity | **YES — primary** | Jake explicitly named. PATTERNS.md "Print View" anchors to actual G702/G703 output. The Drummond Pay App PDFs in fixtures (Source 3) are reference. |
| Dense financial tables (line items, vendors, invoices) | **YES — primary** | Jake's "dense where it should be dense" + Procore/Linear/Stripe references. SYSTEM.md density tokens; COMPONENTS.md DataGrid spec. |
| Mobile in the field — PMs approving on phones | **YES — primary** | Touch targets, file preview pinch-zoom, approve-from-mobile flow. PATTERNS.md "Mobile Approval". |
| Mobile in-the-field — gloves | YES | High-stakes touch targets ≥56px (above WCAG 44px minimum). Q10 below — formalize "high-stakes" definition. |
| Cost-plus open-book transparency | YES | Owner portal eventually; design system distinguishes owner-facing vs internal builder-facing densities. PATTERNS.md addresses. |
| Florida-specific (lien releases, payment cutoffs) | INDIRECTLY | Surfaces touched: lien-release detail (extends Document Review template), invoice payment date (computed not user-input). No design-system implication beyond using shared template. |
| Confidence routing (≥85% green / 70-84% yellow / <70% red) | YES | SYSTEM.md color tokens for confidence; COMPONENTS.md `<ConfidenceBadge>`. |
| Stored aggregates rationale | N/A | Not a design concern. |
| Custom builder vs remodeler vs production | YES (forward) | Jake names "custom builders" — design system tone matches. Remodelers (smaller jobs, more volume) and production builders may pick different density defaults. Forward consideration: per-org density preference. |
| GC-fee compounding semantics | N/A | Display issue, not design. Money + tabular-nums already handles. |

---

## 6. Targeted questions for Jake — ALL ANSWERED 2026-04-29

**Locked decisions** (per nwrp10.txt approval):

| Q | Decision | Notes |
|---|---|---|
| Q1 | **C** | Render both palette sets side-by-side in components playground; pick visually at CP2 |
| Q2 | **B** | Keep Space Grotesk + Inter + JetBrains Mono. **Update CLAUDE.md to reflect reality** — Calibri was a paraphrased mistake. Current fonts are more distinctive and align with "Procore meets Linear meets Stripe Dashboard" target. Zero font license cost, zero propagation work. |
| Q3 | **A** | Dark mode in 1.5a scope; codify what's already implemented |
| Q4 | **B** | Semantic breakpoint aliases `nw-phone / nw-tablet / nw-desktop` on top of Tailwind defaults |
| Q5 | **A** | CSS-only motion; defer Framer Motion until a real orchestration need |
| Q6 | **C** | Custom Next.js route at `/design-system`, dev-gated |
| Q7 | **B** | `--density-compact` + `--density-comfortable` tokens |
| Q8 | **A** | TanStack Table v8 as DataGrid base |
| Q9 | **B** | WCAG 2.2 AA |
| Q10 | **A** | 44px standard, 56px high-stakes |
| Q11 | **A** | Evocative names. **HARD REQUIREMENT (Jake addition):** if two directions feel similar, the names are wrong — regenerate. Distinctness is non-negotiable. |
| Q12 | **B** | Reconciliation pattern defined abstractly with strawman; 1.5b validates against real data |
| Q13 | **A** | Logo top-right always; collapses to icon at <360px |
| Q14 | **MODIFIED A (narrower than recommended)** | **ONLY `--brand-accent` and `--brand-logo` are tenant-customizable in v1.** Everything else (palette structure, typography, spacing, motion) stays Nightwork's locked. Enterprise customers want light branding, not re-skinning the product. |

**Jake's additional requirement (post-approval):**

> When generating the 3 PHILOSOPHY directions, each should reference real Nightwork screens (invoice review, dashboard, mobile approval) so I can imagine what they actually look like. Don't give me abstract aesthetic descriptions — give me concrete "here's how the invoice review page would feel in this direction" comparisons.

This becomes a **HARD requirement** for PHILOSOPHY.md: each direction must include side-by-side comparisons of how invoice review, dashboard, and mobile approval pages would render. Abstract aesthetic copy alone fails the deliverable.

---

(Original questions and rationale archived below for reference — these documented the decision context.)

### Q1 — Palette hex reconciliation [BLOCKING]

Jake's brief named `#6B8EA3` accent / `#2D3E4A` dark slate / `#8A8A8A` warm gray.
Existing skill names `#5B8699` stone-blue / `#1A2830` slate-deep / `#3B5864` slate-tile.

These are visually similar but not identical. Which is the source of truth?

- **A: Use Jake's brief values** (`#6B8EA3` / `#2D3E4A` / `#8A8A8A`). Update `colors_and_type.css` and the skill in 1.5a.
- **B: Use existing skill values** (`#5B8699` / `#1A2830` / `#3B5864` / `#F7F5EC`). Document Jake's note as "lighter perception of the same palette" in PHILOSOPHY.md.
- **C: Audit both side-by-side** in the components playground; Jake picks visually at the philosophy-direction checkpoint.

**Recommended:** **C** — visual comparison is faster than guessing intent. The two sets are perceptually close; on a real screen the choice is obvious. Implementation cost is low (the playground renders both swatches).

### Q2 — Typography family decision [BLOCKING — HIGHEST PRIORITY]

CLAUDE.md "standing rules" line 1 + Jake's brief say **Calibri**. Existing `nightwork-design` skill + `tailwind.config.ts` + `colors_and_type.css` use **Space Grotesk** (display) + **Inter** (body) + **JetBrains Mono** (eyebrows/money/labels).

Calibri is a Microsoft proprietary font not natively available in browsers — using it on the web requires either (a) Microsoft's commercial web-font license (cost involved) or (b) accepting fallback to system fonts. Space Grotesk + Inter are open-licensed Google Fonts.

- **A: Calibri** — license web hosting (or accept fallback to local-installed Calibri on user machines + Carlito open-source-substitute fallback). Replaces all existing typography.
- **B: Space Grotesk + Inter + JetBrains Mono** — keep existing system. Update CLAUDE.md standing rules + Jake's brief reference to "Calibri" was paraphrase / aspiration.
- **C: Hybrid** — Calibri for headlines (downloaded license), Inter + JetBrains Mono for body and metadata (open). Requires explicit Microsoft web-font license purchase.

**Recommended:** **B** — keep existing system. Three reasons: (1) the existing system is implemented across the codebase including invoice review template; switching is a major propagation; (2) Calibri's web-font story is messy and license-encumbered; (3) Space Grotesk + Inter is more distinctive — Calibri is the literal default of Microsoft Office and would make Nightwork look like a spreadsheet, not "10 years more modern" per Jake's brief. **CLAUDE.md gets corrected** to reflect the actual implementation. If Jake genuinely wants Calibri, choose A and acknowledge the propagation cost.

### Q3 — Dark mode in 1.5a scope?

`tailwind.config.ts` already supports dark mode via `data-theme`. Tokens auto-flip via CSS vars.

- **A: YES — codify dark mode in SYSTEM.md.** Document every token's dark counterpart. Components inherit automatically.
- **B: NO — defer to 1.5b or later.** SYSTEM.md treats light-mode only; dark-mode polish becomes a separate pass.

**Recommended:** **A** — implementation already exists; not codifying it leaves design and code drifted. Cost is small.

### Q4 — Mobile breakpoints

Tailwind defaults: `sm 640 / md 768 / lg 1024 / xl 1280 / 2xl 1536`. The invoice review template uses `lg` as the desktop pivot.

- **A: Use Tailwork defaults.** Tag breakpoints in SYSTEM.md.
- **B: Custom Nightwork breakpoints.** E.g., `nw-phone 0-480 / nw-tablet 481-1023 / nw-desktop 1024+ / nw-print TBD`. Maps to actual user devices (iPhone field PMs, iPads in office, large monitors at HQ).

**Recommended:** **B** — Tailwind defaults serve general web; Nightwork's user reality (PM iPhone in field vs Diane's office monitor vs Jake on iPad reviewing draws) maps to phone/tablet/desktop more cleanly. Keep Tailwind defaults available; ADD `nw-phone` etc. as semantic aliases.

### Q5 — Motion library

Existing system uses CSS @keyframes (in tailwind.config). Jake explicitly forbade "bouncy easing".

- **A: CSS-only motion** for the foreseeable future. SYSTEM.md defines easing curves (no bouncy / no elastic; standard ease-in / ease-out / linear). All animations declared in `@keyframes`.
- **B: Framer Motion** as a complement when needed. Adds bundle size.

**Recommended:** **A** — Jake's anti-bouncy rule + Stripe-Linear visual language doesn't need physics-driven animation. CSS does it cleaner and lighter. Framer Motion can be added later if a specific surface needs it.

### Q6 — Components playground tech

Jake explicitly named "components playground" as a 1.5a deliverable. Options:

- **A: Storybook** — industry standard; heavy dep; usually a separate repo or root-level stories.
- **B: Ladle** — lighter Storybook alternative; faster.
- **C: Custom Next.js route at `/design-system`** — built into the existing app; reuses real auth + tokens; visible at the deployed URL (gated by role).
- **D: Histoire** — Vue-friendly; less suited.

**Recommended:** **C** — custom Next.js route. Two reasons: (1) the playground IS the design system in context — same tokens, same auth, same fonts — no setup divergence; (2) Storybook adds significant tooling; for ~30 components and Nightwork's small team, a single-route playground at `/design-system` is sufficient. Gate to authenticated users (or all if Jake prefers).

### Q7 — Density tokens

Jake said "dense where it should be dense, comfortable where users need to focus." How does the design system express this?

- **A: Single density** — every component picks its own density via Tailwind utilities. Most permissive.
- **B: Two density tokens** — `--density-compact` (16px row, 4px padding) and `--density-comfortable` (24px row, 8px padding). Components accept a `density` prop. Patterns specify which.
- **C: Three densities** — compact / standard / comfortable. More gradation.

**Recommended:** **B** — two is easier to communicate ("compact for tables of money; comfortable for approval flows") and matches Stripe / Linear's posture. Three densities is a tax with marginal benefit.

### Q8 — DataGrid base library

Jake named "DataGrid for editable financial tables" — needs more than a basic shadcn Table. Options:

- **A: TanStack Table v8** — headless, paired with custom UI. Industry standard for complex tables.
- **B: AG Grid Community** — more features, opinionated UI, larger bundle, license considerations.
- **C: Custom-built atop shadcn Table** — minimal initial, grow as needed.

**Recommended:** **A** — TanStack Table is the natural shadcn complement (shadcn docs show TanStack patterns), keeps the design tokens in our control, and supports the editable-cell + virtual-scroll + multi-column-sort scenarios financial tables need.

### Q9 — Accessibility level

- **A: WCAG 2.1 AA** — current widely-supported standard.
- **B: WCAG 2.2 AA** — latest stable; adds focus appearance + dragging movements (relevant to mobile).
- **C: WCAG AAA** for select surfaces (high-stakes approval flows).

**Recommended:** **B** — 2.2 AA is the current standard and includes mobile-relevant criteria. AAA is overkill for internal financial software at this stage.

### Q10 — High-stakes touch targets

WCAG 2.5.5 minimum is 44×44px. Jake said "gloves on" for field PMs.

- **A: 44px minimum, 56px for high-stakes actions** (approve, reject, void, submit).
- **B: 56px minimum across the board** on mobile.
- **C: 48px / 56px / 64px tiered** by criticality.

**Recommended:** **A** — strikes the balance. Define "high-stakes" in SYSTEM.md as: any action that mutates state irreversibly, transitions a workflow, or moves money. Approve/reject/void/submit/delete qualify; navigation/edit/cancel do not.

### Q11 — Philosophy direction naming convention

Jake wants 3 directions to choose from. Recommended names follow the pattern: short, evocative, distinct.

- **A:** Names like "Stone & Steel" / "Field Manual" / "Architectural Drafting" (illustrative, not recommendations) — evocative-of-construction.
- **B:** Names like "v1" / "v2" / "v3" — neutral, no flavor.
- **C:** Names lifted from references — "Procore-fork" / "Stripe-derived" / "Linear-flavored" — direct.

**Recommended:** **A** — evocative names anchor the direction in Nightwork's domain. Saves us from re-explaining what each direction is in every conversation.

### Q12 — Reconciliation surface in PATTERNS.md scope

Per NQ5/D-036, reconciliation-surface mock-up lands in 1.5b. PATTERNS.md needs to define it abstractly here.

- **A: Define abstractly only.** Acknowledge the pattern; don't commit to a visual treatment until 1.5b mock-up.
- **B: Define abstractly + propose a strawman.** PATTERNS.md proposes side-by-side delta visualization; 1.5b validates.
- **C: Punt entirely.** Drop "Reconciliation" from PATTERNS.md; reintroduce in post-1.5b update.

**Recommended:** **B** — PATTERNS.md is more useful with a strawman. The strawman is explicitly TBD-pending-1.5b validation, but the contract (regions, data shapes, interaction model) is defined.

### Q13 — Logo top-right rendering on mobile

Jake said "Ross Built logo top-right" universally.

- **A: Always visible top-right**, including mobile (may shrink to wordmark or icon-only at <360px).
- **B: Hidden on mobile** below a breakpoint; replaced by hamburger nav.
- **C: Top-left on mobile, top-right on desktop.**

**Recommended:** **A** — preserves brand identity; collapses to icon-only at <360px. PATTERNS.md mobile template specifies.

### Q14 — Multi-tenant brand customization in SYSTEM.md scope

VISION.md §2.1 mentions per-org `branding` JSONB (logo + color overrides). Should SYSTEM.md anticipate it?

- **A: YES — token architecture supports per-org overrides** as a first-class concern. CSS vars for brand-accent are pluggable.
- **B: NO — SYSTEM.md hardcodes Ross Built brand**; multi-tenant brand is a future concern.

**Recommended:** **A** — small forward-looking design that doesn't bake "Ross Built" into the system. Token shape: `--brand-accent` (defaults to stone-blue; per-org overrideable).

---

## 7. Recommended scope expansion

**Stated:** "I want this design system locked down so every screen we build looks like Nightwork and not like generic AI SaaS. ... Give me 3 distinct philosophy directions to pick from at checkpoint. ... No prototypes in this phase - that's 1.5b. This phase is just the documents (PHILOSOPHY, SYSTEM, COMPONENTS, PATTERNS, PROPAGATION-RULES, .impeccable.md, components playground)."

**Recommended phase deliverables:**

1. **`.planning/design/PHILOSOPHY.md`** — 3 distinct directions to choose from at the checkpoint. Each direction has:
   - Name (short, evocative)
   - 2–3 paragraph thesis
   - Sample-screen description (in words; Drummond invoice review imagined in this direction)
   - "What this WOULD look like" / "What this WOULDN'T look like" lists
   - Opinion on the 5 reference benchmarks (Procore, Linear, Stripe vs Notion, Slack)
   - Risks specific to this direction
   - The "Forbidden" section (Jake's "never want to see again" list, lifted verbatim)

2. **`.planning/design/SYSTEM.md`** — design tokens + foundational rules. Sections:
   - Color tokens — full Slate scales with success/error/warning/info extensions per Jake's brief; per-token contrast ratios; dark-mode mapping (per Q3 = A); `--brand-accent` per-org override (per Q14 = A)
   - Typography — depends on Q2 outcome; family + size scale + weight + tracking + line-height + tabular-nums for money
   - Spacing — Tailwind default scale, no arbitrary
   - Border-radius — 0 except avatars + status dots
   - Shadows — minimal; hover-lift only on interactive cards
   - Motion — easing curves (no bouncy / no elastic), durations, supported transitions; CSS-only (per Q5 = A)
   - Layout grid — 12-col desktop, 4-col mobile; breakpoints `nw-phone / nw-tablet / nw-desktop` (per Q4 = B)
   - Iconography — Heroicons outline, stroke 1.5
   - Density — `--density-compact` / `--density-comfortable` (per Q7 = B)
   - Touch targets — 44px / 56px-high-stakes (per Q10 = A)
   - Accessibility — WCAG 2.2 AA (per Q9 = B); per-token contrast values; focus-visible standard
   - Forbidden list — pulled into here as a "things-never-to-render" section (or placed in PHILOSOPHY.md per Q15)

3. **`.planning/design/COMPONENTS.md`** — component inventory with shadcn mapping. One row per component (Jake's list + extensions surfaced in §1):
   - Component | Shadcn equivalent | Variants | Required props | Token bindings | Snapshot states | Accessibility notes | Mobile behavior | Anti-patterns
   - DataGrid uses TanStack Table v8 (per Q8 = A)
   - Combobox uses `cmdk` + Popover
   - DatePicker uses `react-day-picker` + Popover
   - Drawer uses Vaul (shadcn standard)
   - All NwButton / NwEyebrow existing components are codified here

4. **`.planning/design/PATTERNS.md`** — recurring page patterns. Each entry:
   - Pattern name
   - When to use / when NOT to use
   - Required regions + responsive behavior
   - Data shape contract
   - Example states (loading / empty / error / read-only / locked)
   - Reference implementation (where it exists; e.g. invoice review for Document Review)
   - Print behavior (where applicable)
   - Mobile behavior

   Patterns: Document Review (gold standard), Dashboard (data-dense), Settings (config forms), List+Detail (table with right rail), Wizard (multi-step), Empty Workspace, Print View (AIA G702/G703), Mobile Approval, Reconciliation (strawman per Q12 = B).

5. **`.planning/design/PROPAGATION-RULES.md`** — how design changes flow through the codebase. Sections:
   - When to add a token vs use existing
   - When a token change is "everywhere" (route through `/nightwork-propagate`)
   - Component-add workflow (COMPONENTS.md → playground → first usage → enforcement hook)
   - Pattern-add workflow (PATTERNS.md → first surface → second surface validates contract)
   - Cross-references to `nightwork-design-tokens` skill (post-edit hook), `nightwork-design-system-reviewer` agent, `nightwork-ui-template` skill
   - Versioning posture (1.5a is v1.0; bump on token shape change)

6. **`.impeccable.md`** (root level) — `frontend-design` + `impeccable` skill configuration for Nightwork. Anchors the skills to:
   - SYSTEM.md tokens
   - COMPONENTS.md inventory
   - PATTERNS.md page templates
   - The chosen philosophy direction
   - The Forbidden list
   - Reference benchmarks (Procore, Linear, Stripe — anti: Notion, Slack)

7. **Components playground** — Next.js route at `/design-system` (per Q6 = C):
   - Index page lists all components from COMPONENTS.md with live render
   - Each component page shows variants + states + token bindings + sample data + accessibility notes
   - Side-by-side palette comparison (per Q1 = C — both `#6B8EA3` set and `#5B8699` set rendered for visual pick)
   - Side-by-side typography comparison (per Q2 — both Calibri-fallback and Space Grotesk renderings)
   - Gated to authenticated users (any role); read-only

**Out of scope (deferred):**

- **Prototypes on Drummond data** → Stage 1.5b (per Jake's brief)
- **Visual regression test harness** → Stage 1.5c
- **Storybook adoption** → not needed (per Q6)
- **Framer Motion** → defer (per Q5)
- **Per-org brand customization UI** → Wave 3+ (token shape is ready in 1.5a; UI later)
- **CMS-driven design tokens** → never; tokens live in code per the existing `nightwork-design-tokens` enforcement
- **Versioning automation** → defer to first real change
- **AAA accessibility on select surfaces** → defer (per Q9)

**Acceptance criteria target (preview — final criteria locked in `/np`):**

- [ ] PHILOSOPHY.md presents 3 distinct directions; each has thesis + sample-screen description + would/wouldn't lists + risks
- [ ] SYSTEM.md enumerates every CSS variable token with light + dark values + contrast ratio
- [ ] SYSTEM.md typography reflects Q2 decision; CLAUDE.md updated to match
- [ ] COMPONENTS.md inventory has every component from Jake's list + 3-5 implicit extensions (FileDropzone, ConfidenceBadge, etc.) with shadcn mapping
- [ ] PATTERNS.md has all 9 patterns Jake named (Document Review, Dashboard, Settings, List+Detail, Wizard, Empty Workspace, Print View, Mobile Approval, Reconciliation) plus implicit AppShell pattern
- [ ] PROPAGATION-RULES.md covers token-add, component-add, pattern-add workflows + propagate orchestrator integration
- [ ] `.impeccable.md` exists at root and anchors `frontend-design` + `impeccable` skills to SYSTEM/COMPONENTS/PATTERNS
- [ ] Components playground at `/design-system` renders every component from COMPONENTS.md
- [ ] Components playground includes Q1 palette side-by-side comparison and Q2 typography side-by-side comparison
- [ ] No prototypes (verify scope discipline)
- [ ] `nightwork-design-system-reviewer` agent passes on the playground
- [ ] CLAUDE.md "Nightwork standing rules — UI rules" section updated to reflect SYSTEM.md as source of truth
- [ ] Strategic Checkpoint #2 with Jake on PHILOSOPHY direction selection (this is the gating moment per D-012)

---

## 8. Risks and assumptions

| # | Risk | Mitigation |
|---|---|---|
| R1 | Q2 (typography) chosen as "Calibri" forces a multi-week propagation across the existing codebase (every component using `font-display` / `font-sans` / `font-mono`); Wave 1.1 polish slips | Lock Q2 before SYSTEM.md write; if Calibri picked, route through `/nightwork-propagate` for the typography swap as a separate phase. |
| R2 | 3 philosophy directions feel like the same direction with cosmetic differences; Jake can't actually distinguish | Anchor each direction to a different reference benchmark (Procore vs Linear vs Stripe Dashboard); each direction commits to different density/motion/typography defaults. |
| R3 | Components playground at `/design-system` becomes a maintenance burden (every component change forces a playground update) | Make playground generation declarative — components self-register via a small registry pattern; updates are <5 lines per component change. |
| R4 | PATTERNS.md "Reconciliation" strawman gets rejected at 1.5b mock-up and forces a PATTERNS.md rewrite | Mark the strawman explicitly TBD; 1.5b's outcome is an expected revision. PATTERNS.md is a living doc. |
| R5 | Dark mode codification reveals existing component contrast issues (some Slate tokens look fine on light but fail AA on dark) | Components playground renders both modes side-by-side; contrast checker on each token; fixes land in 1.5a or in a follow-up "design-system-polish" mini-phase. |
| R6 | "Forbidden" list interpretation drifts (e.g., "oversized rounded corners" — what counts as oversized?) | SYSTEM.md specifies exact violation thresholds: `border-radius > 4px = oversized`, "bouncy easing" = any `cubic-bezier(.x, y > 1.0)`. Quantified. |
| R7 | Per-org brand customization (`--brand-accent`) overrides break the design's identity at scale | Token architecture allows accent override but locks structural tokens (`--bg-page`, `--text-primary`, etc.). Per-org branding is accent-only by design. |
| R8 | The `nightwork-requirements-expander` agent registry friction (this very expansion required inline execution because the agent registry doesn't pick up new agents until session restart) | Tech debt registry entry: agent-registry session-start friction. Workaround: Jake restarts session before next /nightwork-init-phase invocation. Long-term fix: harness restart, OR document the workaround. |

**Key assumptions:**
- Jake stays on existing palette structure (per Q1 reconciliation)
- Jake answers Q2 typography decision before SYSTEM.md write (1-2 day decision turnaround)
- The design-system documents are all that ships in 1.5a — no prototypes (scope discipline)
- Strategic Checkpoint #2 is the gating moment; Jake selects 1 of the 3 philosophy directions
- Existing `nightwork-design`, `nightwork-design-tokens`, `nightwork-ui-template` skills become subordinate to / cross-reference the new SYSTEM.md / COMPONENTS.md / PATTERNS.md (single source of truth shifts to `.planning/design/` documents; skills point at them)

---

## 9. Hand-off

After Jake approves this expansion (or amends it):

1. **Resolve Q1 + Q2 BEFORE proceeding.** SYSTEM.md cannot be written without the typography decision. Q1 (palette hex) is also blocking but can be deferred to "Q1 = C decided in playground."
2. **`/nightwork-auto-setup stage-1.5a-design-system-documents`** — verify env (Tailwind config matches; existing skills in place; Heroicons; Calibri license-acquired-and-hosted-OR-fallback-confirmed if Q2 = A).
3. **`/np stage-1.5a-design-system-documents`** — chain `/gsd-discuss-phase` (with this EXPANDED-SCOPE as input) → `/gsd-plan-phase` → `/nightwork-plan-review`.
4. **`/nx stage-1.5a-design-system-documents`** — preflight + execute + qa.
5. **Components playground deployed** to Vercel preview URL; Jake reviews 3 PHILOSOPHY directions in context.
6. **Strategic Checkpoint #2 with Jake.** Jake picks one philosophy direction. Documents are updated to commit to that direction.
7. **Hand-off to Stage 1.5b** — prototype gallery on Drummond data, anchored to the chosen philosophy.

---

**Cross-references:**

- VISION.md — §1.3 Pillar 4 "AI as bookkeeper" framing (reinforces "real construction software" not "AI sparkle")
- CURRENT-STATE.md §C.13 — UI uniformity score 2/4 (current state to fix in Wave 1.1, design system in 1.5a)
- TARGET.md §C — file structure includes `components/review/` per pattern
- GAP.md F4 — UI uniformity sweep brings change-orders + draws into invoice template alignment (uses PATTERNS.md "Document Review")
- CP1-RESOLUTIONS.md D-027, D-036 — UCM softening, reconciliation surface mock-up
- MASTER-PLAN.md DECISIONS LOG D-009 (design system before features), D-018 (Stage 1.6 system), D-036 (reconciliation surface in 1.5b)
- CLAUDE.md "Nightwork standing rules — UI rules" — current source-of-truth for UI conventions; gets superseded by SYSTEM.md after 1.5a ships
- Canonical §1.3 — four-pillar moat, "AI as bookkeeper" sells the trustworthy-financial-software identity Jake's brief invokes
- Existing skills: `nightwork-design`, `nightwork-design-tokens`, `nightwork-ui-template` — become cross-references to the new authoritative documents
- Existing config: `src/app/globals.css` + `src/app/colors_and_type.css` + `tailwind.config.ts` — get touched by the eventual implementation phase (post-1.5a if Q2 forces typography swap)
