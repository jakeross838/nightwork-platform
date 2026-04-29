# Discussion — stage-1.5a-design-system-documents

**Status:** RESOLVED 2026-04-29
**Companion to:** EXPANDED-SCOPE.md (APPROVED), SPEC.md, PLAN.md
**Mode:** Most decisions resolved at EXPANDED-SCOPE approval (Q1-Q14 locked per nwrp10.txt). This DISCUSSION resolves the two remaining items deferred from auto-setup (D1, D2) plus a small set of plan-time clarifications.

---

## Decisions resolved at EXPANDED-SCOPE approval

| ID | Decision |
|---|---|
| Q1 | Render both palette sets side-by-side in components playground; visual pick at CP2 |
| Q2 | Slate type system: Space Grotesk + Inter + JetBrains Mono. Calibri was a paraphrase mistake. CLAUDE.md updated. |
| Q3 | Dark mode in 1.5a scope; codify what's already implemented |
| Q4 | Semantic breakpoint aliases `nw-phone / nw-tablet / nw-desktop` on top of Tailwind defaults |
| Q5 | CSS-only motion; defer Framer Motion |
| Q6 | Custom Next.js route at `/design-system`, dev-gated |
| Q7 | `--density-compact` + `--density-comfortable` tokens |
| Q8 | TanStack Table v8 as DataGrid base |
| Q9 | WCAG 2.2 AA |
| Q10 | 44px standard, 56px high-stakes |
| Q11 | Evocative philosophy direction names; if two feel similar, regenerate |
| Q12 | Reconciliation pattern: abstract definition + strawman; 1.5b validates |
| Q13 | Logo top-right always; collapses to icon at <360px |
| Q14 | Only `--brand-accent` and `--brand-logo` tenant-customizable; rest locked |

**Hard requirement (Jake addition):** Each of the 3 PHILOSOPHY directions must include concrete side-by-side comparisons of how invoice review, dashboard, and mobile approval pages would render in that direction. Abstract aesthetic copy alone fails the deliverable.

---

## D1 — shadcn primitive install strategy [RESOLVED]

**Question:** Current `package.json` has zero shadcn primitives (`@radix-ui/*`, `cmdk`, `react-day-picker`, `vaul`, `class-variance-authority`, `tailwind-merge`). Jake's brief says "we're building on shadcn" but the existing UI is custom-Tailwind.

**Options considered:**
- A. Install shadcn now (`npx shadcn-ui@latest init` + add primitives as documented). COMPONENTS.md maps to real installed primitives. Existing components migrate over time.
- B. Document existing custom-Tailwind as the truth. COMPONENTS.md notes "shadcn-equivalent" patterns built directly on Tailwind. No CLI install. Migration to shadcn deferred to a future phase.
- C. **Hybrid** — install shadcn primitives we DON'T have a custom equivalent for (Combobox via cmdk, DatePicker via react-day-picker, Drawer via Vaul, Tooltip + Popover via Radix). Keep existing custom NwButton / NwEyebrow / NwInput. COMPONENTS.md is mixed but pragmatic.

**Decision:** **C (Hybrid).**

**Rationale:** Pragmatic — no rebuild of existing components, fills the explicit gaps Jake named. Adopts the shadcn standard primitives that the open-source community has validated (Radix accessibility, cmdk command-palette UX, Vaul mobile drawer physics) without forcing a wholesale migration. Sets up future "all-shadcn" migration as a separate phase if and when the value justifies it. The post-edit token enforcement hook applies to both shadcn primitives and custom components — divergence is contained at the component level, not the token level.

**Implementation in PLAN.md:**
- A new task in Wave 2 installs the missing primitives via `npx shadcn-ui@latest init` (Jake runs interactively) + `npx shadcn-ui@latest add <component>` for each gap.
- COMPONENTS.md has a column "Source" for each component: `custom` (existing NwButton, NwEyebrow, NwInput, etc.) vs `shadcn` (new installs) vs `tanstack` (DataGrid).

---

## D2 — TanStack Table v8 install timing [RESOLVED]

**Question:** Q8 = A (TanStack Table v8 as DataGrid base). Install during SETUP or during execute?

**Decision:** **During execute** (Wave 2, alongside shadcn primitive installs).

**Rationale:** Atomic commit when DataGrid component lands. Avoids leaving an orphan dependency in `package.json` if the phase scope shifts. Setup just confirmed the dependency was needed.

---

## D3 — Components playground auth gate [PLAN-TIME CLARIFICATION]

**Question:** EXPANDED-SCOPE Q6 = C (custom Next.js route at `/design-system`). Per the EXPANDED-SCOPE §4 cross-cutting, "components playground gating" was "Recommended: all authenticated users (educational); gate write actions on the playground (none expected)." But also raised: "platform-admin-only or available to all org members?"

**Decision:** **Authenticated users (any role) in development; gated to `platform_admin` in production** via a feature flag check or env-var. The playground is educational documentation, but exposing component variants and AI confidence routing details to all org members in production has minor information-disclosure value. Easier path: dev-only via `NEXT_PUBLIC_NW_DESIGN_SYSTEM_ENABLED=true` env var, or `platform_admin`-only middleware check. Recommend the latter — consistent with the platform-admin gating pattern from CLAUDE.md.

**Implementation in PLAN.md:** middleware check on `/design-system/*` for `platform_admin` role; bypass via env var in development. Returns 404 (not 403) for non-admin users to avoid leaking that the route exists.

---

## D4 — Heroicons library install [PLAN-TIME CLARIFICATION]

**Question:** Existing `nightwork-design` skill says "Heroicons outline (stroke 1.5)." Auto-setup found Heroicons NOT in `package.json`. Existing icons appear to be inline SVG. Install Heroicons as part of 1.5a, or defer?

**Decision:** **Install during execute** (Wave 2). Adds `@heroicons/react` to dependencies. COMPONENTS.md references Heroicons as the icon source. Existing inline SVGs don't get migrated yet (separate refactor).

**Rationale:** Aligns with existing skill direction; small dep (~50KB tree-shaken); future component additions will use it. Migrating existing inline SVGs is out of scope for 1.5a per Jake's "no scope creep into prototypes" directive.

---

## D5 — Reconciliation strawman commitment level [PLAN-TIME CLARIFICATION]

**Question:** Q12 = B (define reconciliation pattern abstractly with strawman; 1.5b validates). How concrete should the strawman be?

**Decision:** **Strawman defines: required regions, data shape contract, 3 candidate visualization models named (NOT chosen). 1.5b mock-up picks a model.**

**Required regions (in PATTERNS.md):**
- Header — entity-pair label (e.g. "Invoice ↔ PO"), drift summary (delta amount, delta percentage, time-since-divergence)
- Left rail — predecessor entity preview (data + source document)
- Right rail — successor entity preview
- Center — drift visualization (one of 3 candidate models)
- Bottom — actions (accept / dispute / write CO / split / annotate)
- Audit timeline — drift history + writeback events

**3 candidate visualization models:**
1. **Side-by-side delta** — two columns of fields with diffs highlighted; line items diff'd per row.
2. **Inline diff** — predecessor's fields with strikethrough + successor's fields highlighted; like a git diff.
3. **Timeline overlay** — a chronological view where the predecessor's commitment is overlayed on the successor's commitment, with drift visualized as area-between-curves.

1.5b mock-up renders all 3 models against Drummond's invoice-vs-PO drift fixture; Jake picks at the prototype gallery review.

---

## Discussion notes (for record)

- **No new entities introduced.** This is a docs + playground phase.
- **No new database tables.** Setup verified.
- **No new API routes.** The `/design-system` route is a marketing-style Next.js page, not an API.
- **No new env vars** (the `NEXT_PUBLIC_NW_DESIGN_SYSTEM_ENABLED` was rejected in favor of role-gate; if admin-only suffices we don't need an env var at all).
- **Foundation F1-F4 are NOT prerequisites** for 1.5a despite Stage 1.5a coming after Stage 1 in MASTER-PLAN.md §12. The design-system documents can land before foundations because they're forward-defining; foundations land later and inherit the design system. Per D-009 explicitly.

This phase converges to PLAN.md without further discussion gates.
