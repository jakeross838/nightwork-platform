# PROPAGATION-RULES.md — Nightwork design system change workflows

**Status:** v1 DRAFT (Stage 1.5a, T15) — produced 2026-04-30.
**Phase:** stage-1.5a-design-system-documents
**Scope:** Single source of truth for HOW the design system changes — when to add a token vs reuse, when to add a component, when to extend a pattern, when to bump a breakpoint, when to route through `/nightwork-propagate`, when to extend the codemod, when to extend the post-edit hook, and how skills update in lockstep with these documents.
**SPEC anchors:** A19 (full PROPAGATION-RULES scope), A11.1-A11.7 (brand-customization), A12.1 (tenant-blind), A12.2 (icon boundary), A12.3 (brand-customization companion), A19.1 (skill anchors), C7 (Forbidden hook), C8 (tenant-blind hook), D5.1 (Forbidden positive test).

**Document length target:** 700-1100 lines structured into 13 sections + appendix.

**Versioning:** Stage 1.5a is **v1.0** of the Nightwork design system. Subsequent changes follow the workflows below. Backward-compat: design-system breaking changes never silently land — every change has a migration note here OR a propagate plan in `.planning/propagate/`.

---

## 0. Purpose + cross-references

PROPAGATION-RULES.md is the meta-rules document. Where SYSTEM.md / COMPONENTS.md / PATTERNS.md document **WHAT** the design system is, this document codifies **WORKFLOWS** for changing it. The post-edit hook (`.claude/hooks/nightwork-post-edit.sh`), the shadcn-v3 codemod (`scripts/shadcn-v3-codemod.ts`), and the propagate orchestrator (`.claude/commands/nightwork-propagate.md`) are the runtime enforcement layer; this file is the human-readable companion.

A change is in scope here if it touches any of:

- Tokens (`--*` CSS variables in `colors_and_type.css` / `globals.css`)
- Component primitives (`src/components/ui/*.tsx` and the catalog in COMPONENTS.md)
- Custom Nightwork primitives (`src/components/nw/*.tsx`)
- Patterns (the 12 entries in PATTERNS.md)
- Breakpoints (`tailwind.config.ts` `screens` extension; the 4 `nw-*` aliases)
- Brand customization (`--brand-accent` / `--brand-logo` per A11.1-A11.7)
- Forbidden-list rules (the SYSTEM.md §13 quantification table + the post-edit hook regex set)
- Icons (the Heroicons enumeration in COMPONENTS.md §9.3)

Changes outside that scope (data migrations, API routes, server logic) are NOT design-system changes and do not route through this document.

**Cross-references:**

| Source | Where |
|---|---|
| Token catalog | `.planning/design/SYSTEM.md` (854 lines, 14 sections) |
| Component inventory | `.planning/design/COMPONENTS.md` (1107 lines, 17 sections) |
| Pattern catalog | `.planning/design/PATTERNS.md` (T14 — drafted by sibling agent) |
| WCAG matrix | `.planning/design/CONTRAST-MATRIX.md` (243 lines) |
| Token enumeration audit | `audit-notes/T01-css-variables.md` |
| Tailwind config audit | `audit-notes/T02-tailwind-config.md` |
| Contrast ratios source | `audit-notes/T03-contrast-ratios.md` |
| Skill audit | `audit-notes/T04-skills-and-template.md` |
| Existing-component audit | `audit-notes/T05-custom-components.md` |
| Icon inventory audit | `audit-notes/T06-icon-inventory.md` |
| Codemod test outcomes | `audit-notes/T08-codemod-test.md` |
| shadcn-v3 codemod | `scripts/shadcn-v3-codemod.ts` (12 rule families) |
| Post-edit hook | `.claude/hooks/nightwork-post-edit.sh` (T10a-T10d enforcement) |
| Propagate orchestrator | `.claude/commands/nightwork-propagate.md` (5-phase) |
| SPEC criteria | `.planning/phases/stage-1.5a-design-system-documents/SPEC.md` (v2.1, 52 criteria) |
| PLAN tasks | `.planning/phases/stage-1.5a-design-system-documents/PLAN.md` (v2, 47 tasks) |
| MASTER-PLAN decisions | `.planning/MASTER-PLAN.md` §10 (D-009, D-016, D-018, D-028) |
| CLAUDE.md global posture | `CLAUDE.md` "UI rules" + "Workflow posture" sections |

---

## 1. Decision tree — does this change need /nightwork-propagate?

Most design-system changes are local (one component, one token, one pattern). Some are cross-cutting (a token used in 60+ files, a Forbidden rule that retroactively applies to all existing UI, a pattern contract change that ripples through every consumer). Cross-cutting changes route through `/nightwork-propagate`.

**Use this decision tree FIRST when planning a design-system change.**

```
Q1. Does the change touch tokens / components / patterns / breakpoints?
    NO  → not a design-system change; out of scope here.
    YES → continue.

Q2. Is it a NEW addition (token-add, component-add, pattern-add, icon-add)?
    YES → follow the relevant §3-§6 / §10 add workflow. Local; no propagate.
    NO  → continue (this is a change to an existing thing).

Q3. Is the existing thing used in fewer than 5 source files?
    Run: grep -rn "<thing>" src/ | wc -l   (token name, component name, etc.)
    YES (<5) → local change; no propagate. Update the canonical source +
               first usage(s) + skill if listed in §11. Commit, ship.
    NO  → continue (change has cross-cutting blast radius).

Q4. Does the change have RETROACTIVE scope (existing surfaces must update)?
    e.g., a Forbidden rule expansion ("rounded-md is now forbidden" → all
    existing rounded-md usages must convert to rounded-none).
    YES → /nightwork-propagate (5-phase orchestrator). Mandatory.
    NO  → continue.

Q5. Is it a token VALUE change (e.g., the recent --nw-gulf-blue bump)?
    YES → see §2 token-value-change workflow. Likely propagate.
    NO  → continue.

Q6. Is it a structural rename ("rename --bg-card to --surface-card")?
    YES → /nightwork-propagate. Mandatory — every consumer must update.
    NO  → likely local; document in SYSTEM.md / COMPONENTS.md.
```

**Trigger phrases that ALWAYS route through `/nightwork-propagate`** (per CLAUDE.md "Workflow posture → Cross-cutting changes go through `/nightwork-propagate`"):

- "everywhere"
- "all components"
- "all surfaces"
- "make X match Y"
- "every page"
- "across the app"
- "system-wide"
- "pattern-wide"

When you hear or read these phrases for a design-system change, do NOT do the change ad-hoc. Run `/nightwork-propagate "<description>"` and follow the 5-phase orchestrator.

---

## 2. Token VALUE change workflow

Token VALUE changes (`--nw-gulf-blue` from `#4E7A8C` → `#436A7A`) are the most common cross-cutting design-system change. The recent T12 patch is the canonical example — Wave 1 contrast verification surfaced that `--text-accent` (which aliases to `--nw-gulf-blue`) failed AA-normal at 4.29:1 on `bg-page` light. The fix: bump `--nw-gulf-blue` to `#436A7A` (5.37:1 — PASS).

### 2a. Trigger conditions for a token VALUE change

A token's hex value changes when ONE of these is true:

1. **Contrast verification surfaces a failure.** CONTRAST-MATRIX.md cell falls below WCAG 2.2 AA-normal (4.5:1) for a TEXT use, OR below AA-large/UI (3:1) for a non-text use.
2. **Brand pick at CP2 (one-time).** Q1 palette pick (Set A vs Set B per SPEC A3) shifts `--nw-stone-blue` / `--nw-slate-deep` / `--nw-slate-tile` if Set A is chosen. The `/design-system/palette` page exists for the visual pick.
3. **Tenant brand customization.** `--brand-accent` is per-tenant overrideable per A11.1 — but this is a runtime mechanism, NOT a token-value change in this sense (see §6).
4. **Vendor / accessibility regression.** A browser update changes how a hex resolves (extremely rare); a font swap shifts metrics that ripple into spacing.

Outside these triggers, **DO NOT bump a token value.** Token values are the foundation; surfaces compose them. Changing values churns the matrix.

### 2b. Workflow steps

The T12 `--nw-gulf-blue` bump exercised every step:

1. **Audit surfaces the need.** A failing CONTRAST-MATRIX cell, or a Wave-1 review note, or a SYSTEM.md re-verification trigger documents WHY the value changes.
2. **Compute new value.** The candidate value MUST clear AA-normal in every text-use pairing. Use `audit-notes/T03-contrast-ratios.md` as the methodology. Verify by running the contrast script on the candidate before committing.
3. **Compute side-effects.** Every consumer of the token sees a contrast shift. List the consumers:
   - `src/app/colors_and_type.css` — single source of truth (the literal hex)
   - `tailwind.config.ts` — the `nw-*` color extension
   - `.claude/skills/nightwork-design/colors_and_type.css` — skill copy
   - `.claude/skills/nightwork-design/README.md` — token docs table
   - `.planning/design/SYSTEM.md` — §1a raw token table + §1i text-token table + §12a applied-fix annotation
   - `.planning/design/CONTRAST-MATRIX.md` — every cell where the token appeared (across LIGHT/DARK and Set A/Set B if applicable) re-verified
   - Any source file consuming the token (`grep -rn "<token-name>" src/`)
4. **Decide the route — local or propagate?**
   - If side-effect surfaces ≥ 5 files: route through `/nightwork-propagate` (per §1 Q3).
   - If < 5: local change, single commit.
5. **Execute.** For propagate: Phase 1 BLAST RADIUS, Phase 2 PROPAGATION PLAN, Phase 3 EXECUTE chunks (with `/nightwork-qa` between each), Phase 4 SMOKE TEST, Phase 5 REPORT. For local: single commit + ship.
6. **Re-verify.** CONTRAST-MATRIX.md cells re-computed; SYSTEM.md applied-fix annotation added; skill cross-references updated.
7. **Audit log.** Add a "Carry-forward" or "Applied at" entry in SYSTEM.md §16 (or equivalent footer) documenting the patch. The recent T12 entry is the template.

### 2c. T12 reference example — `--nw-gulf-blue` bump

The recent T12 SYSTEM.md patch (2026-04-30) bumped `--nw-gulf-blue` from `#4E7A8C` → `#436A7A`. Side-effects cascaded into:

- 1× `src/app/colors_and_type.css` line edit (token literal)
- 1× `.claude/skills/nightwork-design/colors_and_type.css` skill-copy edit
- 1× `.claude/skills/nightwork-design/README.md` token-docs table edit
- 4× `.planning/design/SYSTEM.md` edits (§1a raw token table, §1i text token table, §1i applied-fix block, §12a applied-fix annotation)
- 8× `.planning/design/CONTRAST-MATRIX.md` cell re-verifications (LIGHT+B accent row, LIGHT+A accent row, §3.5 disposition table, §8 summary metrics)
- N× source-file impact: every `text-nw-gulf-blue` / `hover:bg-nw-gulf-blue` / `.nw-primary-btn:hover` background — measured ratios all see strict improvement (4.68 → 5.86)

**This bump affected ~60 files across SOURCE + DOCS + SKILLS.** Per the §1 decision tree (Q3 ≥ 5 files), this should have routed through `/nightwork-propagate`. In practice the T12 patch was executed as a focused single-PR change because:
- The hex value is mathematically dominated (ratios strictly improve)
- The change does not break any contract (token name unchanged)
- Side-effects are documentation-only (no API surface change)

For FUTURE token value changes that do not have this dominance property (e.g., `--nw-stone-blue` → a different hue, where ratios may move in either direction), `/nightwork-propagate` is mandatory.

### 2d. Forbidden token-value changes

These are the values that **must not change** without a phase-level decision (NOT just a token bump):

- Page background `--bg-page` light (`#F7F5EC` white-sand) and dark (`#1A2830` slate-deep) — changing these is a brand re-skin, not a fix.
- Type-system font families (`--font-display` / `--font-body` / `--font-mono`) — fixed at Space Grotesk / Inter / JetBrains Mono per A4. Changing requires PHILOSOPHY-level discussion.
- The 3 semantic-status hexes `--nw-success` / `--nw-warn` / `--nw-danger` — these are construction-domain signals; changing requires Q-level decision (e.g., "should success be greener / less olive?" is a CP2-class question).
- Border-radius defaults (`--radius-none: 0`, `--radius-dot: 999px`) — locked per A2.1; changing is a Forbidden-list violation.

If you THINK one of these needs to change, escalate to Jake first via a phase decision.

---

## 3. Token ADD vs token REUSE decision tree

When a new token name is proposed (`--text-emphasis`, `--bg-overlay-dark`, etc.), apply this decision tree before adding:

```
Q1. Does an existing token already serve this need?
    Search SYSTEM.md §1 (the 69 tokens enumerated) for similar semantic.
    YES → reuse the existing token. Do NOT add. Document the reuse in
          the consuming component's COMPONENTS.md entry.
    NO  → continue.

Q2. Is the proposed token a near-duplicate of an existing one?
    e.g., --text-secondary-on-card vs --text-secondary-on-page
    "Token sprawl" anti-pattern: don't add a token when context-sensitive
    semantics belong in the COMPONENT, not the token.
    YES → use the existing token + a component-level rule
          ("on a card-bg surface, --text-secondary inherits from
           component-bound classname"). Do NOT add.
    NO  → continue.

Q3. Is the proposed token a structural / semantic / brand role NOT yet
    represented?
    Examples that are JUSTIFIED:
    - A new structural region (e.g., a new page-level layout layer that
      doesn't fit any existing --bg-* token)
    - A new semantic role (e.g., a "draft" status that is neither
      success nor warning)
    - A brand customization extension (--brand-secondary if v2 lifts
      A11's "only --brand-accent + --brand-logo" cap)
    YES → add. Continue to §3a workflow.
    NO  → reject. The proposed token is sprawl.

Q4. Has it been signed off?
    Token additions are SYSTEM.md changes. Per CLAUDE.md "Workflow
    posture" — design-system additions need acceptance criteria.
    Discussion via /gsd-discuss-phase or a brief phase-discussion is
    required. Token additions DO NOT happen mid-feature.
    YES → proceed to §3a.
    NO  → halt; surface to phase planning.
```

### 3a. Token-add workflow

1. **Audit notes update** — `audit-notes/T01-css-variables.md` gets a new row enumerating the token's name, value, light/dark mapping, contrast verification, intended consumers.
2. **CSS source update** — `src/app/colors_and_type.css` adds the new variable in the appropriate group (`--bg-*` / `--text-*` / `--border-*` / `--color-*` / `--brand-*` / `--shadow-*` / `--space-*` / `--fs-*` / `--tracking-*` / `--radius-*` / `--density-*` / `--dot-*` / `--nw-*` raw).
3. **shadcn token alias** — if the new token is a shadcn-named token (e.g., `--my-accent`), update `globals.css` shadcn alias remap section per SYSTEM §3a.
4. **CONTRAST-MATRIX re-verify** — if the new token is a `--text-*` or `--bg-*`, every cell × every other surface gets re-computed and the matrix table updates.
5. **SYSTEM.md update** — §1 (Color tokens) gains a row in the appropriate table. The `1j Token totals` count increments (was 69; goes up by 1 per token added).
6. **Tailwind utility extension** — `tailwind.config.ts` extends the `nw-*` map only if the new token is a brand-color (otherwise it stays bracket-value-utility-only via `bg-[var(--name)]`).
7. **Skill cross-reference** — `nightwork-design-tokens` skill (`Allowed shapes` table) gains the new token. `nightwork-design` skill `colors_and_type.css` copy updates.
8. **First usage** — the token's first consumer in `src/components/<domain>/` or `src/app/<route>/` documents the `intended-use` reason in a code comment.
9. **PROPAGATION-RULES.md update** — the §11 cross-reference index (and the §12 versioning ledger) gains a row. If the new token introduces a new "Forbidden" pattern (e.g., a new `--radius-*` value implies a Forbidden expansion), §7 Forbidden updates.

The above 9 steps are the canonical order. If the token addition has cross-cutting blast radius (used by ≥5 files at first commit), route through `/nightwork-propagate`.

### 3b. Token-removal workflow

Tokens are NOT removed in v1. The Phase E namespaces (`cream-*`, `teal-*`, `brass-*`, `brand-*`, `status-*`, `nightwork-*`) were the LAST removal; the post-edit hook permanently rejects them.

**If a token MUST be removed in a future v2:**

1. Document deprecation in §12 versioning ledger as `_deprecated`.
2. Run `/nightwork-propagate` to migrate every consumer.
3. After 1 release of `_deprecated` status, remove from CSS source + tailwind + skills + SYSTEM.md.
4. Permanent post-edit hook entry blocks future re-introduction (modeled on the legacy-namespaces rejection in `.claude/hooks/nightwork-post-edit.sh:78-84`).

This deprecation discipline preserves backward-compat for at least 1 release.

---

## 4. Component-add workflow

New components route through one of TWO paths. Pick by D1=C hybrid rule (per SPEC §4 and COMPONENTS.md §1.1, §17.4):

- **Custom Nw***** — for Nightwork brand-aware composition (NwButton, NwEyebrow, NwBadge, NwCard, NwDataRow, NwMoney, NwStatusDot pattern). Lives at `src/components/nw/<Name>.tsx`.
- **shadcn primitive** — for shadcn-derived headless / Base UI primitive (Button, Input, Combobox, Calendar, Drawer, Tooltip, Popover, HoverCard, etc.). Lives at `src/components/ui/<name>.tsx`.

The two coexist (D1=C hybrid). They do NOT compete.

### 4a. shadcn primitive path

1. **Pre-install backup.** `tailwind.config.ts`, `globals.css`, `colors_and_type.css`, `package.json` get backed up to `.planning/phases/<phase>/_backups/` before running shadcn (per PLAN PRE-T07 / RP2 mitigation).
2. **`npx shadcn@latest add <component>`** — interactive run; accept defaults (TS, src/components/ui/, CSS vars). If the install touches `tailwind.config.ts` or `globals.css` in unexpected ways, restore from backup and triage.
3. **Run codemod** — `npx tsx scripts/shadcn-v3-codemod.ts src/components/ui/<component>.tsx`. The 12 rule families (see appendix A) rewrite v4 syntax → v3-compatible utilities + apply SPEC A2.1 `rounded-* → rounded-none` sweep. Idempotent.
4. **Manual spot-check** — open the primitive, verify:
   - No `oklch(...)` neutral tokens persist (per SPEC C9; verify by `grep -c "oklch(" src/app/globals.css` returning 0).
   - No `lucide-react` import outside this primitive (per A12.2 Icon Library Boundary; if a new lucide icon is needed inside the primitive, that's allowed).
   - No tenant-identifying props (`org_id`, `orgId`, `membership`, `vendor_id`, `membershipId`) in the prop signature (per A12.1; the post-edit hook T10d rejects these — verified).
   - Border-radius is `rounded-none` everywhere except avatar/dot files.
5. **COMPONENTS.md entry** — add the new primitive to the appropriate section (Inputs / Surfaces / Feedback / Navigation / Data display / Overlays). Required columns per A12: Component | Source | Variants | Required props | Token bindings | States | A11y | Mobile | Anti-patterns.
6. **First usage** — wire the primitive into ONE category page in `/design-system/components/<category>` AND/OR ONE first real consumer in `src/components/<domain>/`.
7. **Tenant-blind verification** — confirm the primitive is tenant-blind. If you need a tenant-aware version, write a domain wrapper at `src/components/<domain>/<Domain><Primitive>.tsx` per COMPONENTS.md §8.3 composition pattern.
8. **Atomic commit** — both the `shadcn add` raw output AND the codemod-rewritten file in ONE commit (per SPEC A13 amended). Commit message format: `feat(<phase>): T<N> add shadcn <component> primitive (codemod-rewritten to v3)`.
9. **Re-evaluate Storybook** — if total component count exceeds 40 (today: 26 catalogued + 7 Nw* = 33), re-evaluate Storybook installation per SPEC A19 / M-E5. Below 40, the components playground (`/design-system/components/<category>`) suffices.

### 4b. Custom Nw* path

1. **Decide the Nw* primitive name.** Naming: `Nw<Role>` PascalCase. The role is semantic (Button, Eyebrow, Badge, Card, DataRow, Money, StatusDot — the 7 codified). Avoid one-off names; if a role is novel enough to need a new name, surface to phase planning.
2. **Create the file at `src/components/nw/<Name>.tsx`.** Pattern to follow: existing Nw* primitives (per COMPONENTS.md §7). Each Nw* primitive is functional component + variant prop + size prop + token bindings via CSS vars + JetBrains Mono inline `fontFamily` for typography-flavored primitives (NwBadge, NwButton, NwEyebrow).
3. **Brand consumption.** Nightwork primary buttons consume `--brand-accent` via the chained alias `--primary: var(--brand-accent, var(--nw-stone-blue))` (per A12.3). Other Nw* primitives use locked structural tokens (`--text-primary`, `--bg-card`, etc.).
4. **A11y baseline.** Required:
   - Native semantic element (`<button>`, `<span>`, `<div>` as appropriate)
   - `focus-visible` styling per SYSTEM §12b
   - Touch target: ≥44×44px standard / ≥56×56px high-stakes per SYSTEM §11
   - Color is NOT the only differentiator (WCAG 1.4.1) — text or icon required
5. **COMPONENTS.md §7 entry** — add the new Nw* primitive to the existing-custom-primitives section. Mirror the table format of NwButton/NwEyebrow/NwBadge/etc.
6. **Skill update** — `.claude/skills/nightwork-design-tokens/SKILL.md` Allowed-shapes table gains a row if the new primitive replaces an inline pattern (e.g., NwFileDropzone supersedes raw `<input type="file" />` styling).
7. **First usage** — wire into ONE real consumer in `src/components/<domain>/` or `src/app/<route>/`.
8. **Atomic commit** with a descriptive message.

### 4c. The shadcn-hybrid boundary (per H10 / M-A4 / SPEC A19)

**Hard rule:** if shadcn ships an upstream version of an existing custom Nw* component, **we do NOT auto-migrate.** The custom primitive remains canonical for Nightwork-authored UI.

Reasoning:
- Nightwork primitives encode brand-aware decisions (JetBrains Mono labels, `--brand-accent` chain, locked square aesthetic, touch-target ergonomics) that shadcn's generic primitive does not.
- Auto-migration would introduce tens of subtle UI regressions across already-shipped surfaces.
- D1=C is the hybrid posture by intent.

**The shadcn primitive is reserved for shadcn-internal composition only.** Example: if a future shadcn `<Combobox>` ships with an internal `<Button>` for the clear icon, that internal Button uses shadcn's button (not NwButton). Domain-level UI ALWAYS uses NwButton.

**Migration to shadcn is a phase-level decision** triggered by ONE of:
- Maintenance burden of the custom primitive exceeds shadcn's update cadence
- A11y / contract regression in the custom primitive that shadcn solves out-of-box
- A breaking shadcn update that forces the question

Before migrating: discuss in `/gsd-discuss-phase`, get phase decision, route through `/nightwork-propagate`.

### 4d. Storybook re-evaluation marker (per SPEC A19 / M-E5)

The components playground (`/design-system/components/<category>`) serves the inventory-render need today. **At 40+ catalogued components**, re-evaluate Storybook:

- Today (Stage 1.5a): 26 SPEC-named components + 7 Nw* = 33 (under threshold).
- Trigger: when a future phase adds 7+ new components (one wave of Wave 1.1 polish + a new domain), the count crosses 40.
- Re-evaluation criteria (when triggered):
  1. Story-isolation: are inter-component coupling-tests becoming noise in the playground pages?
  2. Variant matrix: are any components shipping >12 variant × state combinations?
  3. Visual regression infra: is Stage 1.5c's harness working with the playground, or does Storybook offer better snapshot story tooling?

If 2+ of those are YES, plan a Storybook installation phase. Until then, the playground is enough.

---

## 5. Pattern-add workflow

A "pattern" is a multi-component layout contract — Document Review, Dashboard, Settings, List+Detail, Wizard, Empty Workspace, Print View, Mobile Approval, Reconciliation, AppShell, Audit Timeline, File Uploader (the 12 catalogued in PATTERNS.md per SPEC A14).

Adding a new pattern is a **larger commitment** than adding a token or component. Patterns lock layout contracts that ripple into every consumer. The bar is: a new pattern is justified ONLY when 2+ surfaces need the same multi-region layout shape AND no existing pattern extends to fit.

### 5a. Pattern-add decision tree

```
Q1. Does an existing PATTERNS.md entry extend to this need?
    e.g., "I'm building a daily-log review surface."
    Existing: Document Review (file preview LEFT + right-rail + audit timeline).
    YES → extend the existing pattern; document the new entity in
          PATTERNS.md's "Extending for new entities" subsection (per
          nightwork-ui-template skill convention). Do NOT add a new
          pattern.
    NO  → continue.

Q2. Is the proposed pattern a layout shape NOT already covered?
    Cross-reference the 12 in PATTERNS.md.
    YES → continue.
    NO  → it's a duplicate; reject; reuse the existing.

Q3. Will at least 2 surfaces use the new pattern?
    A pattern with 1 consumer is just a page; codify only when 2+ exist.
    YES → continue to §5b.
    NO  → defer; build the page; if a 2nd consumer materializes, then
          codify as a pattern.
```

### 5b. Pattern-add workflow

1. **Phase decision.** New patterns require phase-level sign-off — `/gsd-discuss-phase` or a brief phase-discussion. Patterns do NOT land mid-feature.
2. **PATTERNS.md entry.** Add the new pattern to PATTERNS.md (T14 currently in flight as sibling agent draft). Required columns:
   - When to use / when NOT to use
   - Required regions (header / left rail / right rail / center / bottom / audit timeline / etc.)
   - Responsive behavior (per SYSTEM §9 breakpoints — `nw-phone` / `nw-tablet` / `nw-desktop` / `nw-print`)
   - Data shape contract (the JSON shape consumers must provide)
   - Example states (default / loading / error / empty)
   - Reference implementation (if exists) — `src/app/<route>/page.tsx`
   - Print behavior
   - Mobile behavior
   - Anti-patterns (one-off layouts that should extend this pattern)
3. **First surface.** The pattern's first consumer at `src/app/<route>/page.tsx` follows the locked layout. Required regions are present; data shape conforms.
4. **Second surface validates contract.** The 2nd consumer is the contract-test. If the 2nd consumer needs to deviate from the locked layout, the pattern needs revision (or the 2nd surface needs a different pattern).
5. **Skill update.** If the new pattern is review-flavored (file preview + structured fields + audit), update `.claude/skills/nightwork-ui-template/SKILL.md` to reference it. Other pattern types may not need a skill anchor.
6. **Reviewer skill update.** `nightwork-design-system-reviewer` and `nightwork-ui-reviewer` (when implemented as agents) gain a check for the new pattern's contract — anti-patterns rejected at `/nightwork-design-check` / `/nightwork-qa`.
7. **Cross-reference index update.** PROPAGATION-RULES.md §11 (this doc's index) gains a row.

### 5c. Anti-pattern: ad-hoc layouts that should extend an existing pattern

The most common pattern-violation is a one-off review surface that should extend Document Review. The `nightwork-ui-template` skill encodes this rule — the canonical invoice review at `src/app/invoices/[id]/page.tsx` is the gold standard, and every document review / approval / right-rail surface (proposals, draws, lien releases, change orders, daily logs) extends it.

Per CLAUDE.md "UI rules → Invoice review is the gold standard":

> Any document review / approval / right-rail surface (proposals, draw approvals, lien releases, change orders, daily logs once they ship) extends the invoice-review template — file preview LEFT, structured fields right-rail, audit timeline at the bottom. Do not invent one-off layouts when the template extends.

**Enforcement:** `nightwork-ui-template` skill (auto-fired by description match on these surface names) flags one-off layouts. PATTERNS.md "Document Review" entry (T14) elaborates with explicit data-shape + example-state details.

### 5d. Pattern revision workflow (existing pattern changes)

If an existing pattern's contract NEEDS to change (rare):

1. Surface the proposed change in `/gsd-discuss-phase` — this is a phase decision, not a quick edit.
2. Run `/nightwork-propagate "<change description>"` — 5-phase orchestrator.
   - Phase 1 BLAST RADIUS — list every consumer surface (`grep -rn "<pattern marker>" src/`)
   - Phase 2 PROPAGATION PLAN — atomic chunks per consumer
   - Phase 3 EXECUTE — chunks in order, `/nightwork-qa` between each
   - Phase 4 SMOKE TEST — full repo verification
   - Phase 5 REPORT — what changed, what verified, rollback steps
3. Update PATTERNS.md entry.
4. Update `nightwork-ui-template` and reviewer skills.

---

## 6. Brand customization workflow (A11.1-A11.7)

Per A11 / A11.1-A11.7 / A12.3, **only TWO tokens are tenant-customizable in v1**: `--brand-accent` (one per org) and `--brand-logo` (one per org). Everything else is locked Nightwork. This section codifies HOW the customization flow works and HOW to extend it (the v2 question).

### 6a. The locked v1 contract

| Aspect | Rule |
|---|---|
| Customizable tokens | `--brand-accent` (hex) and `--brand-logo` (asset URL) — TWO ONLY |
| Override mechanism | Server-side: `getOrgBranding()` reads `org_settings`. Client-side: `document.documentElement.style.setProperty('--brand-accent', value)` per A11.1. NEVER `<style>` tag string concatenation; NEVER inline HTML interpolation. |
| Hex validation | Server-side regex `/^#[0-9A-Fa-f]{6}$/` per A11.2. Invalid → fall back to default `--nw-stone-blue`. |
| Cache headers | Every response carrying tenant-branded HTML sets `Cache-Control: private, no-store` AND `Vary: Cookie` per A11.3. Prevents CDN cross-tenant pollution. |
| Logo storage | Supabase Storage `branding/{org_id}/logo.{ext}`; signed URL scoped to requesting org's membership; refresh policy documented; never public bucket. Per A11.4. |
| Logo file types | Allow-list: `image/png`, `image/svg+xml`, `image/jpeg`. SVG sanitized server-side via `isomorphic-dompurify` with `USE_PROFILES: { svg: true, svgFilters: true }` per A11.5. |
| Logo file size | Max 200KB. Rejected at upload time per A11.6. |
| Role gate | Override write requires `owner` or `admin` org role per A11.7. |
| Audit log | Every mutation appends to `activity_log` with `action='branding.logo_updated'` or `branding.accent_updated` per A11.7. Append-only. |

### 6b. The v1 components consuming brand tokens (per A12.3)

| Component | Token consumed | How |
|---|---|---|
| NwButton primary | `--brand-accent` | `bg-nw-stone-blue` falls back via the chained alias `--primary: var(--brand-accent, var(--nw-stone-blue))` |
| shadcn Button (default) | `--brand-accent` | `bg-primary` → same chained alias |
| AppShell active nav indicator | `--brand-accent` | Active tab underline + sidebar active-item border |
| Loading state spinner accent | `--brand-accent` | Spinner ring leading stroke |
| TabsList active indicator | `--brand-accent` | Active tab underline color |
| Form FocusRing | `--brand-accent` | Input focus-visible ring (via `--ring` alias) |
| AppShell NavBar logo | `--brand-logo` | Top-right of every authenticated surface; shrinks to icon-only at <360px viewport per CLAUDE.md UI rules Q13 |
| Public footer / public header | `--brand-logo` | Marketing site uses same asset |
| Print View header | `--brand-logo` | AIA G702/G703 print header uses contractor logo |

Components that explicitly DO NOT consume `--brand-accent` (deliberate — tenant consistency required):
- NwBadge variant colors (status semantics — must read consistently across orgs)
- NwMoney variant colors (financial signal — tenant-invariant)
- All `--text-*` / `--bg-*` / `--border-*` semantic tokens (locked structural palette)

### 6c. Brand-customization extension workflow (the v2 question)

Adding a new tenant-customizable token (`--brand-secondary`, `--brand-text`, `--brand-button-radius`, etc.) is a **phase-level decision**.

```
Q1. Does the proposed extension fit within v1's contract?
    v1: only --brand-accent + --brand-logo. Anything else = NO.
    YES → impossible (v1 contract caps at 2). Continue.
    NO  → continue.

Q2. Is the proposed token in the "structural" or "brand-identity"
    category?
    Structural = palette structure / typography / spacing / motion —
                 NOT customizable per A11 intent.
    Brand-identity = secondary brand color, brand-flavored radius,
                     tenant logo wordmark — possibly customizable.
    Structural → reject. Re-state as a Forbidden expansion if needed.
    Brand-identity → continue.

Q3. Has it been signed off?
    Brand-customization extensions are SECURITY-RELEVANT (server-side
    validation, sanitization, role gate, audit log). Per CLAUDE.md
    "Workflow posture" — they need /nightwork-plan-review with
    multi-tenant-architect + security reviewer concurrence.
    YES → proceed to §6d.
    NO  → halt; surface to phase planning.
```

### 6d. Brand-customization-add workflow

1. **Phase discussion.** `/gsd-discuss-phase` discusses the brand-customization extension — what token, what validation regex, what file-type allow-list (if asset), what role gate, what audit-log action.
2. **Plan review.** `/nightwork-plan-review` — multi-tenant-architect + security reviewer mandatory. Critical findings block.
3. **SYSTEM.md §2 update.** Add new token to the brand-customization tokens table. Add validation regex, cache headers (still `private, no-store + Vary: Cookie`), storage path (if asset), file-types, max-size, audit-log action.
4. **COMPONENTS.md §10 update.** Add new token to "Components consuming `--brand-*`" table. List which primitives reach the new token.
5. **Migration.** New `org_settings` column or related schema migration — uses optimistic locking (`expected_updated_at`) per CLAUDE.md "Development Rules". `activity_log` action enum extends.
6. **Server-side validation.** New API route validates the input. Hex regex / file-type check / sanitization (via `isomorphic-dompurify` for assets) — server-side ALWAYS; client validation is UX, not security.
7. **Role gate.** `getCurrentMembership()` check ensures owner/admin role.
8. **Audit log writer.** Mutation appends `activity_log` with new action.
9. **First override flow** — wire into `/admin/branding` page (or equivalent). Test with two distinct org overrides; verify cross-tenant isolation (CDN cache headers + `Vary: Cookie` working).
10. **PROPAGATION-RULES.md update.** §6 (this section) gains a new row in §6a contract table + a new row in §6b consumers table. §11 cross-reference index updates.
11. **Skill update.** `nightwork-design-system-reviewer` (when implemented as agent) gains a check for the new brand-customizable token's intended consumption.

### 6e. Hook enforcement of brand-customization rules

The post-edit hook (`.claude/hooks/nightwork-post-edit.sh`) does NOT directly enforce brand-customization correctness. The enforcement layers are:

- **Hex hardcoding rejection** (T10a, hook line 52-60) — components that hardcode hex instead of using `--brand-accent` are rejected. This indirectly enforces the brand path (hex hardcoding bypasses tenant override).
- **Tenant-blind primitives** (T10d, hook line 232-252 — per A12.1 / C8) — primitives in `src/components/ui/*.tsx` cannot accept `org_id` / `membership` / `vendor_id` props. This forces tenant context to flow as data (rendered tokens), not as identifiers — which is what brand-customization does.
- **Server-side API enforcement** — the actual validation regex, sanitization, role gate live in API routes. NOT in the hook.

**Future enforcement extension:** if a future hook rule blocks "primitive code reading any token NOT in the v1 brand-customizable list as if it were tenant-customizable" — that would be a new T10e regex per §7 hook-update workflow.

---

## 7. Forbidden-list update workflow (Hook regex patches)

The Forbidden-list (per SYSTEM.md §13) is enforced by the post-edit hook (`.claude/hooks/nightwork-post-edit.sh`). The hook has 4 enforcement extensions today (T10a-T10d) plus the codemod's 12 rule families. Each Forbidden category is automated where feasible; some remain review-only.

### 7a. Existing Forbidden enforcement layers

| Forbidden category | SPEC reference | Hook block | File line | Enforcement strength |
|---|---|---|---|---|
| Hardcoded hex colors | (general) | hook block 1 | `:52-60` | Strong — regex reject |
| Tailwind named colors | (Phase E) | hook block 1 | `:62-68` | Strong — regex reject |
| Pure white/black | (Slate posture) | hook block 1 | `:70-76` | Strong — regex reject |
| Legacy namespaces | (Phase E) | hook block 1 | `:78-84` | Strong — regex reject |
| RLS-less migrations | (CLAUDE Architecture) | hook block 2 | `:88-118` | Strong — regex reject |
| Hardcoded ORG_ID | (CLAUDE Development) | hook block 3 | `:121-128` | Strong — regex reject |
| Bouncy easing (cubic-bezier ≥ 1.0 args) | A2.1 / D5.1 | hook block T10b | `:147-160` | Strong — regex reject |
| Oversized rounded corners | A2.1 / D5.1 | hook block T10b | `:163-174` | Strong — regex reject (avatar/dot exception) |
| Generic gradients | A2.1 (§13c) | (none) | — | Weak — review only at `/nightwork-design-check` |
| Purple/pink HSL [270°, 320°] | A2.1 / D5.1 | hook block T10b | `:185-191` | Strong — regex reject |
| Dark glows | A2.1 / D5.1 | hook block T10b | `:177-183` | Strong — regex reject |
| Marketing typography | A2.1 (§13f) | (partial) | — | Weak — review only |
| Phone/desktop confusion | A2.1 (§13g) | (none — pattern-level) | — | None at hook |
| Sample-data isolation in design-system/ | C6 / D9 | hook block T10c | `:202-230` | Strong — regex reject |
| Tenant-blind primitives | C8 / A12.1 | hook block T10d | `:236-252` | Strong — regex reject |

### 7b. Forbidden-add workflow

Adding a new Forbidden rule (a SYSTEM.md §13 expansion) is a security-flavored design-system change. Follow these steps:

1. **Quantify the criterion.** Per A2.1, every Forbidden rule must be **automated-check-verifiable**. "Don't use ugly colors" is NOT a Forbidden rule. "HSL hue ∈ [270°, 320°]" IS — measurable, regex-able.
2. **Hook regex patch.** Extend `.claude/hooks/nightwork-post-edit.sh`:
   - Mirror the existing T10b extension pattern (line 145-192).
   - Use a labeled comment block `# Stage <phase> — T<N>: <rule name>`.
   - The regex MUST distinguish positive (target patterns) from negative (false-positive cases). For example, T10b's rounded-rule excludes avatar/dot files via `case "$FILE_NORM" in *avatar* | …`.
   - Match against `.tsx`, `.ts`, `.css`, `.scss` — the file types where styling lives.
   - Use the `[forbidden-A<spec>]` tag prefix in the rejection message so QA knows which SPEC criterion the rule traces to.
3. **SYSTEM.md §13 entry.** Add the new Forbidden category with:
   - Quantified violation criterion
   - Forbidden examples
   - Allowed exceptions (if any)
   - Cross-reference to the hook block
4. **COMPONENTS.md anti-pattern entry.** Add the new violation to §15 cross-cutting anti-patterns gallery (today: 15 entries). Add a per-component anti-pattern row in the relevant component's table (e.g., "Don't use `cubic-bezier(.4, 1.5, ...)` on transition prop" in Button table).
5. **Enforcement test (positive + negative).** Create a positive-test entry in `.planning/phases/<phase>/artifacts/T35.5-hook-positive-tests.md` (or equivalent):
   - **Positive test:** attempt to commit a file CONTAINING the forbidden pattern; hook rejects.
   - **Negative test:** attempt to commit a file with a pattern that LOOKS LIKE forbidden but isn't (e.g., `cubic-bezier(.4, 0.5, .3, 0.5)` — all args < 1.0); hook does NOT reject.
6. **Retroactive scope check.** If the new rule has retroactive scope (existing surfaces violate it):
   - Run `grep -rn "<violation pattern>" src/` to enumerate violators.
   - Route through `/nightwork-propagate` for the migration. Phase 1 BLAST RADIUS lists violators; Phase 2 PROPAGATION PLAN chunks the migration; Phase 3 EXECUTE migrates each chunk + runs `/nightwork-qa`.
7. **PHILOSOPHY.md "Forbidden" lift check.** If the new rule extends Jake's "things I never want to see again" list, mirror the lift in PHILOSOPHY.md. (Nightwork-design Forbidden is a subset of Jake's brief; quantification lives here.)

### 7c. The codemod as a Forbidden-style enforcement layer

`scripts/shadcn-v3-codemod.ts` rewrites shadcn 4.x output to v3-compatible syntax + applies SPEC A2.1 (rounded-rectangle sweep). It is also a "Forbidden" enforcement layer in spirit — preventing v4-only syntax + oversized rounded corners from reaching the codebase.

Per `audit-notes/T08-codemod-test.md`, the **12 rule families** are:

1. **`v4-descendant-double-star`** — `**:data-[slot=X]:Y` → `[&_[data-slot=X]]:Y` (deep descendant)
2. **`v4-descendant-single-star`** — `*:data-[slot=X]:Y` → `[&>[data-slot=X]]:Y` (direct child)
3. **`v4-var-shorthand`** — `utility-(--var)` → `utility-[var(--var)]` (var shorthand)
4. **`v4-data-bare-word`** — `data-WORD:Y` (20 known words) → `data-[WORD]:Y`
5. **`v4-trailing-important`** — `class!` → `!class` (preserves variant chain)
6. **`v4-has-data-shorthand`** — `has-data-[slot=X]:Y` → `has-[[data-slot=X]]:Y` (compound)
7. **`v4-has-bare-pseudo`** — `has-WORD:Y` (7 known pseudos) → `has-[:WORD]:Y` (CSS pseudo)
8. **`v4-group-has-data`** — `group-has-data-[slot=X]/scope:Y` → `group-has-[[data-slot=X]]/scope:Y`
9. **`v4-not-data-shorthand`** — `not-data-[X=Y]:Z` → `not-[[data-X=Y]]:Z` (negation)
9b. **`v4-in-data-shorthand`** — `in-data-[X=Y]:Z` → `[[data-X=Y]_&]:Z` (parent-scope)
10. **`v4-outline-hidden`** — `outline-hidden` → `outline-none` (v4 → v3 rename)
11. **`v4-spacing-fn`** — `--spacing(N)` → `calc(0.25rem * N)` (v4 calc helper)
11b. **`v4-supports-bare`** — `supports-WORD:Y` → `supports-[WORD]:Y` (v4 shorthand)
11c. **`v4-backdrop-blur-xs`** — `backdrop-blur-xs` → `backdrop-blur-[2px]` (v3 has no xs)
11d. **`v4-blur-xs`** — `blur-xs` → `blur-[2px]` (v3 has no xs)
12. **`spec-a2.1-rounded-rectangle`** — `rounded-{md,sm,lg,xl,2xl,3xl,full,[Npx]}` → `rounded-none` (SPEC A2.1)

The codemod is **idempotent** — re-running on an already-rewritten file is a no-op (per `audit-notes/T08-codemod-test.md`).

### 7d. Codemod re-run trigger

The codemod runs:

1. **At every shadcn primitive install.** Per §4a step 3, after `npx shadcn add <component>`, run the codemod on the new file before committing.
2. **At Tailwind upgrades.** If a future phase upgrades Tailwind to v4 (the codemod's reverse), the codemod's mission is complete and it's archived (NOT just deleted — kept in `scripts/_archived/` for reference).
3. **At codemod expansion.** When a new shadcn install surfaces a v4 pattern not yet in the codemod (the original 17 → 12 rule-family expansion happened this way; per `audit-notes/T08-codemod-test.md`), add the new rule via the same workflow as a Forbidden-add (§7b) — rule family, sanity pattern, idempotency check.

### 7e. Hook positive-test structure

The post-edit hook is verified by attempting forbidden patterns. Each hook extension has a positive test in `.planning/phases/stage-1.5a-design-system-documents/artifacts/T35.5-hook-positive-tests.md` (or equivalent). Pattern:

```bash
# T10b — Forbidden-list (cubic-bezier ≥ 1.0)
echo "transition: cubic-bezier(.4, 1.5, .3, 1.2);" > /tmp/forbidden-test.css
# Attempt to edit a file containing this; hook should REJECT.

# T10c — Sample-data isolation
# In src/app/design-system/components/inputs/page.tsx, add:
import { createClient } from '@/lib/supabase/server';
# Hook should REJECT.

# T10d — Tenant-blind primitives
# In src/components/ui/button.tsx, add:
function Button({ org_id, ... }) { ... }
# Hook should REJECT.
```

Each hook extension's positive test is a one-time addition during T35.5 (per PLAN); future hook extensions follow the same template.

---

## 8. Icon-add workflow (per A12.2 / design-pushback W3)

Heroicons is the only icon library Nightwork-authored UI imports directly. Lucide is a transitive shadcn dep, scoped to `src/components/ui/*.tsx` only. New icons follow this workflow.

### 8a. Icon Library Boundary (locked v1 contract)

| Library | Where it imports | Variant | Stroke |
|---|---|---|---|
| `@heroicons/react@^2.2.0` | `src/components/<domain>/*` and `src/app/**/*.tsx` | `outline` | 1.5 (default) |
| `lucide-react@^1.14.0` | `src/components/ui/*.tsx` ONLY | (shadcn-determined) | (shadcn-determined) |

`@heroicons/react/24/solid` is NOT used by default — too heavy for Nightwork screens. Solid variant is reserved for explicit reasons (status icon where weight signals importance).

### 8b. Icon-add decision tree

```
Q1. Is the new icon in the Heroicons semantic mapping (COMPONENTS.md §9.3)?
    YES → use the existing entry. Do NOT add a new icon row.
    NO  → continue.

Q2. Does Heroicons ship the icon at all?
    Search heroicons.com. Try outline + solid variants.
    YES → continue.
    NO  → reject. Inline SVG is NOT a fallback. Re-evaluate the design
          intent — the missing-icon problem is usually a UX problem,
          not an icon-library problem. Consider Heroicons request
          OR a different semantic that maps to an existing icon.

Q3. Is the new icon's semantic role distinct from existing rows?
    e.g., "send" is distinct from "save"; "filter" is distinct from
    "search". But "send" overlapping with "submit" might not be.
    YES → continue.
    NO  → reuse the existing icon row.
```

### 8c. Icon-add workflow

1. **Heroicons name confirmation.** Identify the exact Heroicons name (e.g., `PaperAirplaneIcon`). Verify the import path: `@heroicons/react/24/outline`.
2. **COMPONENTS.md §9.3 update.** Add a new row in the appropriate semantic group:
   - Status (success / warning / error / info)
   - Action (edit / delete / save / cancel / download / upload / add / search / settings)
   - Navigation (forward / back / down / up / external)
   - File-type (PDF / image / spreadsheet / Word / generic)
   - Progress (in-progress / complete / locked)
   - Alert (critical / heads-up)
   - **NEW:** if the new icon doesn't fit any existing semantic group, propose a new group; phase decision required.
3. **First usage.** Use the new icon in ONE category page (`/design-system/components/<category>`) AND/OR ONE first real consumer in `src/components/<domain>/`.
4. **No inline SVG.** Per A19 — inline SVGs are NOT allowed as a fallback for "I couldn't find a matching Heroicon." If the user-need is to reach for an inline SVG, file an issue; or revisit the design intent (the missing-icon problem is usually UX).
5. **Existing inline SVGs are NOT migrated.** Per SPEC §4 — inline SVGs in `src/components/` predating Stage 1.5a are NOT migrated in this phase. Only NEW icons go through Heroicons.
6. **Lucide migration disallowed.** Domain code MUST NOT import `lucide-react` directly. If a future shadcn primitive happens to expose a lucide icon name as a public API, escalate to phase decision (it's a leaky abstraction).

### 8d. Hook enforcement of icon boundary

The post-edit hook does NOT directly enforce the icon-library boundary today (per COMPONENTS.md §9.2 — flagged for follow-up). Enforcement layers:

- **Manual review** at `/nightwork-design-check` via `nightwork-design-system-reviewer` agent (when implemented).
- **Manual review** at `/nightwork-qa` via `nightwork-ui-reviewer` agent (when implemented).
- **Future hook extension (T10e candidate):** regex check for `from ['"]lucide-react['"]` in files outside `src/components/ui/*.tsx`. Reject. (Deferred to a future Stage 1.5x — not implemented in 1.5a.)

### 8e. T09 reference example — Heroicons install

The recent T09 install added `@heroicons/react@^2.2.0` (per SPEC C1). Side-effects:

- 1× `package.json` add (npm install)
- 1× `package-lock.json` lockfile update
- 0× source-file changes (no migration of existing inline SVGs per §4 deferral)
- N× COMPONENTS.md §9.3 enumerated icons (canonical Heroicons reference table)

**No retroactive scope** — existing inline SVGs stay as-is. Only new components use Heroicons. The COMPONENTS.md §9.3 table is the canonical list for new additions.

---

## 9. Breakpoint-change workflow

Breakpoints are the responsive grid skeleton — `nw-phone (0-480px)`, `nw-tablet (481-1023px)`, `nw-desktop (1024+)`, `nw-print` (per SYSTEM §9 / SPEC A7 / T08b). Changing them is rare and high-blast-radius.

### 9a. The 4 named breakpoints (locked v1)

```ts
// tailwind.config.ts (per T08b extension)
screens: {
  'nw-phone':   { max: '480px' },
  'nw-tablet':  { min: '481px', max: '1023px' },
  'nw-desktop': { min: '1024px' },
  'nw-print':   { raw: 'print' },
  // Tailwind defaults sm/md/lg/xl/2xl remain available
}
```

The Tailwind defaults remain available — use them when granularity beyond the 4 nw-* aliases is needed.

### 9b. Breakpoint-add workflow (rare)

Adding a new breakpoint (e.g., `nw-tablet-portrait` for 481-768px) is rare. When justified:

1. **Phase discussion.** `/gsd-discuss-phase` — what surfaces benefit, what regression risk to existing responsive logic.
2. **Tailwind config extension.** `tailwind.config.ts` `screens` map gains the new alias. Range MUST NOT overlap existing aliases.
3. **SYSTEM.md §9 update.** New breakpoint row in the table. Pixel range, intended device, when to use.
4. **Audit existing responsive surfaces.** Run `grep -rn "nw-(phone|tablet|desktop)" src/` to find every consumer. If the new breakpoint overlaps one of these, plan the migration.
5. **First usage.** Wire the new breakpoint into ONE responsive surface; verify it renders correctly at the new range.
6. **Skill update.** `nightwork-design` skill `README.md` references the breakpoint set; update.

**Breakpoints rarely justify addition.** The 4 named breakpoints + Tailwind defaults cover virtually every responsive need. If you THINK you need a new one, ask: can a Tailwind default + a named alias compose to fit?

### 9c. Breakpoint-change workflow (very rare)

Changing an existing breakpoint range (e.g., shifting `nw-tablet` from 481-1023 to 481-1199) **rebuilds responsive logic across every consumer.** This is `/nightwork-propagate` mandatory.

1. `/gsd-discuss-phase` — what device-category shift triggered this; why a new range is justified.
2. `/nightwork-plan-review` — multi-tenant-architect + design-pushback + scalability concurrence.
3. `/nightwork-propagate "<change description>"` — 5-phase orchestrator:
   - Phase 1 BLAST RADIUS — every responsive surface (run `grep -rn "nw-tablet" src/`).
   - Phase 2 PROPAGATION PLAN — atomic chunks per surface category.
   - Phase 3 EXECUTE — chunks in order; `/nightwork-qa` between each.
   - Phase 4 SMOKE TEST — full repo + visual regression at the new breakpoint.
   - Phase 5 REPORT — what changed, what verified, rollback steps if needed.
4. SYSTEM.md §9 update; tailwind.config.ts update.

### 9d. T08b reference example — adding `nw-print`

The T08b task added the 4 named breakpoint aliases including `nw-print`. The `nw-print` raw query maps to CSS `@media print`. Side-effects:

- 1× `tailwind.config.ts` `screens` map extension
- 1× SYSTEM.md §9 table (canonical reference)
- N× responsive surface usages — primarily new (the playground `/design-system/components/<category>` pages use `nw-print:density-compact` to force compact in print)

T08b shipped without `/nightwork-propagate` because it was an ADDITION (no existing responsive surface used the new aliases — all existing surfaces used Tailwind defaults). For a CHANGE to an existing breakpoint, propagate is mandatory.

---

## 10. Versioning posture (per SPEC A19)

Stage 1.5a is **v1.0** of the Nightwork design system. Subsequent versions follow this versioning ledger.

### 10a. Versioning convention

- **v1.x** — patch / non-breaking additions. Token additions per §3, component additions per §4, pattern additions per §5, icon additions per §8, breakpoint additions per §9.
- **v2.0** — first breaking change. A token rename, a component contract narrowing, a pattern revision, a breakpoint change all count as breaking. v2.0 requires phase-level decision + `/nightwork-propagate` migration of every consumer.
- **v3.0+** — reserved for major reworks (design re-spec, brand re-skin, technology shift). Not currently scoped.

### 10b. Versioning ledger (changes since v1.0)

| Version | Date | Change | Rationale |
|---|---|---|---|
| v1.0 | 2026-04-29 | Stage 1.5a documents locked: SYSTEM, COMPONENTS, PATTERNS (T14), PROPAGATION-RULES (this), CONTRAST-MATRIX, PHILOSOPHY (post-CP2). | Per D-009 (design system before features). |
| v1.0.1 | 2026-04-30 | T12 patch: `--nw-gulf-blue` bumped `#4E7A8C` → `#436A7A` for AA-normal compliance on `bg-page` light. Side-effect cascade: 4 SYSTEM edits, 8 CONTRAST-MATRIX cell re-verifications, skill copy update. | Wave 1 contrast matrix verification surfaced text-accent failure; bumped to clear AA-normal. |

Future entries: every token-value change, component addition, pattern addition, icon addition, breakpoint addition, brand-customization extension, or Forbidden-list expansion gets a row.

### 10c. Deprecation policy

When a token / component / pattern is deprecated:

1. Mark with `_deprecated` suffix in canonical source (CSS variable name; component file name; etc.).
2. Document in §10b versioning ledger as `_deprecated` row with rationale.
3. Run `/nightwork-propagate` to migrate every consumer to the replacement.
4. Wait 1 release of `_deprecated` status (deferred deletion).
5. Remove from canonical source. Permanent post-edit hook entry blocks future re-introduction.

The Phase E namespaces (`cream-*`, `teal-*`, `brass-*`, `brand-*`, `status-*`, `nightwork-*`) were the LAST removal. The post-edit hook permanently rejects them via `LEGACY_HITS` regex (line 78-84 of `nightwork-post-edit.sh`).

### 10d. Backward-compat posture

Design-system breaking changes never silently land. Every change has a migration note in PROPAGATION-RULES.md §10b (this ledger) OR a propagate plan in `.planning/propagate/<timestamp>-PROPAGATION-PLAN.md`. Users (other Claude agents, Jake, future contributors) reading SYSTEM.md / COMPONENTS.md / PATTERNS.md should ALWAYS find a recent change documented here.

---

## 11. Skill anchor (per A19.1 / H10 / M-DP1)

PROPAGATION-RULES.md is consumed by skills that enforce design-system rules at edit time and review time. This section is the **bidirectional cross-reference** — which skills depend on this document, and which sections of this doc each skill cares about.

### 11a. Skills depending on PROPAGATION-RULES.md

| Skill | Sections cared about |
|---|---|
| `nightwork-design` | §1 decision tree (when to propagate); §2 token-value-change; §3 token-add; §10 versioning ledger; §11 skill anchor |
| `nightwork-design-tokens` | §3 token-add (Allowed shapes table extension); §7 Forbidden-list update (regex patches); §11 skill anchor |
| `nightwork-design-system-reviewer` (when implemented as agent) | §3-§10 all add/change workflows (verifies SYSTEM/COMPONENTS/PATTERNS compliance); §7 Forbidden enforcement (review layer); §11 skill anchor |
| `nightwork-ui-template` | §5 pattern-add (extending Document Review pattern); §11 skill anchor |
| `nightwork-anti-drift` | §1 decision tree (drift-check input — design-system changes need MASTER-PLAN.md citation); §10 versioning ledger |
| `frontend-design` (Anthropic-built skill) | §3-§5 add workflows (reads to understand WHAT exists before proposing component additions); §10 versioning |
| `impeccable` (Anthropic-built skill) | §7 Forbidden-list (anti-pattern reference) |

### 11b. PROPAGATION-RULES.md → skill propagation rules

When this document changes:

1. **The corresponding skill file MUST update in lockstep.** A new Forbidden rule in §7 = a new entry in `nightwork-design-tokens` skill. A new component path in §4 = a new line in `nightwork-design` skill `Allowed shapes` table.
2. **The post-edit hook (`.claude/hooks/nightwork-post-edit.sh`) MUST update** if §7 introduces a new automated-check Forbidden rule.
3. **The components playground MUST re-render correctly** after a contract change — visual regression spot-check per SPEC D4.
4. **Existing consumers** in `src/components/<domain>/` get reviewed for breakage if a contract narrows; widened contracts are non-breaking.
5. **CONTRAST-MATRIX.md re-verification** if any token in §3 or §6 changes value.

The `/nightwork-propagate` orchestrator runs this lockstep update for any PROPAGATION-RULES.md change tagged "everywhere" or "all".

### 11c. Skills referenced FROM PROPAGATION-RULES.md

This document references back to:

- `colors_and_type.css` — single canonical token source
- `tailwind.config.ts` — `nw-*` color extensions and breakpoint aliases (T08b)
- `globals.css` — shadcn token alias remap + `--brand-accent` server injection
- `.planning/design/SYSTEM.md` — token catalog (every §3 / §6 reference)
- `.planning/design/COMPONENTS.md` — component inventory (every §4 / §8 reference)
- `.planning/design/PATTERNS.md` (T14, sibling agent) — pattern catalog (every §5 reference)
- `.planning/design/CONTRAST-MATRIX.md` — A11y verification source (re-verified on §3 / §6 changes)
- `.planning/design/PHILOSOPHY.md` (T17a/b, post-CP2) — design directions that interpret this document
- `scripts/shadcn-v3-codemod.ts` — codemod (every §4a / §7c reference)
- `.claude/hooks/nightwork-post-edit.sh` — post-edit hook (every §7 reference)
- `.claude/commands/nightwork-propagate.md` — propagate orchestrator (every cross-cutting reference)
- `.claude/skills/nightwork-*/SKILL.md` — skill files (§11a anchor)

---

## 12. Design-system access audit-logging — N/A (per M-E3)

**Explicit declaration:** design docs (`.planning/design/*.md`) and the components playground (`/design-system/*`) are NOT SOC2-relevant view events. **No audit log is written on read access.**

Reasoning:
- Design docs are static artifacts (no PII, no tenant data).
- The components playground is gated to `platform_admin` in production (per SPEC B7) but the gate is access control, not view tracking.
- Sample data in the playground is constants-only (per SPEC D9 / hook T10c) — no tenant data leaks even on accidental view.
- SOC2 view-event logging applies to tenant-data surfaces (invoice review, draw approval, lien release, etc.) — NOT design-system docs.

**Future reviewers:** do not propose audit logging on design-system access. It's intentional that we don't track who viewed PHILOSOPHY.md or `/design-system/components/inputs`. The right check is the production gate (`platform_admin` middleware), not view tracking.

This declaration documents the choice so future security reviewers don't add unnecessary logging.

---

## 13. Cross-reference index

The complete index of file paths referenced in this document (and the design system at large):

### Source code
- `src/app/colors_and_type.css` — single source of truth for token literals
- `src/app/globals.css` — shadcn token alias remap + `--brand-accent` server injection
- `tailwind.config.ts` — Tailwind utility extensions for `nw-*` colors + breakpoints (T08b)
- `src/components/ui/*.tsx` — shadcn primitives (codemod-rewritten to v3)
- `src/components/nw/*.tsx` — custom Nightwork brand-aware primitives
- `src/components/<domain>/*.tsx` — domain-aware composition
- `src/app/design-system/**/*.tsx` — components playground (sample-data isolation enforced)
- `src/app/design-system/_fixtures/*.ts` — pure constants for playground rendering

### Documents
- `.planning/design/SYSTEM.md` — tokens, type, motion, density, accessibility (854 lines)
- `.planning/design/COMPONENTS.md` — component inventory (1107 lines)
- `.planning/design/PATTERNS.md` — pattern catalog (T14, sibling agent — drafting in parallel)
- `.planning/design/CONTRAST-MATRIX.md` — WCAG 2.2 AA verification (243 lines)
- `.planning/design/PROPAGATION-RULES.md` — this document
- `.planning/design/PHILOSOPHY.md` — design directions (T17a/b, post-CP2)

### Scripts + hooks + commands
- `scripts/shadcn-v3-codemod.ts` — 12 rule families; idempotent
- `.claude/hooks/nightwork-post-edit.sh` — T10a-T10d enforcement
- `.claude/commands/nightwork-propagate.md` — 5-phase orchestrator
- `.claude/commands/nightwork-qa.md` — code-level QA orchestrator
- `.claude/commands/nightwork-design-check.md` — design audit

### Skills
- `.claude/skills/nightwork-design/SKILL.md` — palette intent
- `.claude/skills/nightwork-design-tokens/SKILL.md` — token enforcement
- `.claude/skills/nightwork-ui-template/SKILL.md` — Document Review pattern
- `.claude/skills/nightwork-anti-drift/SKILL.md` — pre-flight drift check

### Phase artifacts
- `.planning/phases/stage-1.5a-design-system-documents/SPEC.md` — 52 falsifiable acceptance criteria
- `.planning/phases/stage-1.5a-design-system-documents/PLAN.md` — 47 tasks
- `.planning/phases/stage-1.5a-design-system-documents/audit-notes/T01-css-variables.md` — 69 token enumeration
- `.planning/phases/stage-1.5a-design-system-documents/audit-notes/T02-tailwind-config.md`
- `.planning/phases/stage-1.5a-design-system-documents/audit-notes/T03-contrast-ratios.md`
- `.planning/phases/stage-1.5a-design-system-documents/audit-notes/T04-skills-and-template.md`
- `.planning/phases/stage-1.5a-design-system-documents/audit-notes/T05-custom-components.md`
- `.planning/phases/stage-1.5a-design-system-documents/audit-notes/T06-icon-inventory.md`
- `.planning/phases/stage-1.5a-design-system-documents/audit-notes/T07-twanimate-evaluation.md`
- `.planning/phases/stage-1.5a-design-system-documents/audit-notes/T08-shadcn4-tailwind-v3-incompatibility.md`
- `.planning/phases/stage-1.5a-design-system-documents/audit-notes/T08-codemod-test.md`
- `.planning/phases/stage-1.5a-design-system-documents/artifacts/T35.5-hook-positive-tests.md` (T35.5)
- `.planning/phases/stage-1.5a-design-system-documents/artifacts/axe-report.json` (T33.1)
- `.planning/phases/stage-1.5a-design-system-documents/artifacts/npm-audit-baseline.json` (T11.5)

### MASTER-PLAN references
- `.planning/MASTER-PLAN.md` §10 DECISIONS LOG — D-009 (design system before features), D-016 (gitignore carve-outs), D-018 (Stage 1.6 wrappers), D-028 (reconciliation surface)
- `.planning/MASTER-PLAN.md` §11 TECH DEBT REGISTRY — known deferrals (per-user dark-mode preference, platform_admin role-revocation refresh, Side-by-Side Compare pattern, Timeline/Gantt pattern)
- `.planning/MASTER-PLAN.md` §12 NEXT PLANNED WORK — Stage 1.5a position

### CLAUDE.md global posture
- "UI rules" section — Stone Blue palette + Slate type system + logo top-right
- "Architecture posture" — Multi-tenant RLS, every aggregation needs indexes, org-configurable not hardcoded, data portability first-class
- "Code behavior" — Recalculate not increment, never kill running processes, financial calculations auditable
- "Workflow posture" — Acceptance criteria required, plan-level review precedes execute, QA review precedes ship, end-to-end test precedes ship, cross-cutting changes go through `/nightwork-propagate`

---

## Appendix A — codemod's 12 rule families (per audit-notes/T08-codemod-test.md)

For convenience, the full rule catalog reproduced here. Source: `scripts/shadcn-v3-codemod.ts`.

### v4-only utility syntax → v3 equivalents

| # | Rule id | v4 form | v3 rewrite |
|---|---|---|---|
| 1 | `v4-descendant-double-star` | `**:data-[slot=X]:Y` | `[&_[data-slot=X]]:Y` (deep descendant) |
| 2 | `v4-descendant-single-star` | `*:data-[slot=X]:Y` | `[&>[data-slot=X]]:Y` (direct child) |
| 3 | `v4-var-shorthand` | `utility-(--var)` | `utility-[var(--var)]` |
| 4 | `v4-data-bare-word` | `data-WORD:Y` (20 known words) | `data-[WORD]:Y` |
| 5 | `v4-trailing-important` | `class!` | `!class` (preserves variant chain) |
| 6 | `v4-has-data-shorthand` | `has-data-[slot=X]:Y` | `has-[[data-slot=X]]:Y` |
| 7 | `v4-has-bare-pseudo` | `has-WORD:Y` (7 known pseudos) | `has-[:WORD]:Y` |
| 8 | `v4-group-has-data` | `group-has-data-[slot=X]/scope:Y` | `group-has-[[data-slot=X]]/scope:Y` |
| 9 | `v4-not-data-shorthand` | `not-data-[X=Y]:Z` | `not-[[data-X=Y]]:Z` |
| 9b | `v4-in-data-shorthand` | `in-data-[X=Y]:Z` | `[[data-X=Y]_&]:Z` (parent-scope) |
| 10 | `v4-outline-hidden` | `outline-hidden` | `outline-none` |
| 11 | `v4-spacing-fn` | `--spacing(N)` | `calc(0.25rem * N)` |
| 11b | `v4-supports-bare` | `supports-WORD:Y` | `supports-[WORD]:Y` |
| 11c | `v4-backdrop-blur-xs` | `backdrop-blur-xs` | `backdrop-blur-[2px]` |
| 11d | `v4-blur-xs` | `blur-xs` | `blur-[2px]` |

### SPEC A2.1 (Forbidden — oversized rounded corners)

| # | Rule id | Source | Rewrite |
|---|---|---|---|
| 12 | `spec-a2.1-rounded-rectangle` | `rounded-{md,sm,lg,xl,2xl,3xl,full,[Npx]}` (where N≥1) | `rounded-none` |

The codemod is **idempotent** — rule patterns match ONLY v4 form, never v3. Re-running on an already-rewritten file is a no-op.

---

## Appendix B — post-edit hook enforcement summary

For convenience, the full enforcement table reproduced. Source: `.claude/hooks/nightwork-post-edit.sh`.

| Block | SPEC ref | File line | Enforcement | Files matched |
|---|---|---|---|---|
| Hex hardcoding | (general design tokens) | 52-60 | Reject `#[0-9a-fA-F]{6}` outside globals.css / tailwind.config | `.tsx` `.ts` `.css` `.scss` |
| Tailwind named colors | (Phase E removal) | 62-68 | Reject `bg-blue-500`, `text-gray-700`, etc. | `.tsx` `.ts` `.css` `.scss` |
| Pure white/black | (Slate posture) | 70-76 | Reject `bg-white`, `text-black`, etc. | `.tsx` `.ts` `.css` `.scss` |
| Legacy namespaces | (Phase E removal) | 78-84 | Reject `cream-*`, `teal-*`, `brass-*`, etc. | `.tsx` `.ts` `.css` `.scss` |
| RLS on CREATE TABLE | (CLAUDE Architecture) | 88-93 | Reject `CREATE TABLE` without `ENABLE ROW LEVEL SECURITY` | `supabase/migrations/*.sql` |
| Hard DELETE FROM | (soft-delete only) | 95-101 | Reject `DELETE FROM` outside comments | `supabase/migrations/*.sql` |
| DROP TABLE | (justification required) | 103-109 | Reject `DROP TABLE` without `-- nightwork: drop-justified` | `supabase/migrations/*.sql` |
| TRUNCATE | (never on tenant tables) | 111-117 | Reject `TRUNCATE` | `supabase/migrations/*.sql` |
| Hardcoded ORG_ID | (CLAUDE Development) | 121-128 | Reject `const ORG_ID =` outside cost-codes/template | `.ts` `.tsx` |
| **T10b: Bouncy easing — 4th arg ≥ 1.0** | A2.1 / D5.1 | 147-152 | Reject `cubic-bezier(...,...,...,[1-9].[0-9])` | `.tsx` `.ts` `.css` `.scss` |
| **T10b: Bouncy easing — 2nd arg ≥ 1.0** | A2.1 / D5.1 | 154-160 | Reject `cubic-bezier(...,[1-9].[0-9],...)` | `.tsx` `.ts` `.css` `.scss` |
| **T10b: Oversized rounded corners** | A2.1 / D5.1 | 163-174 | Reject `rounded-{lg,xl,2xl,3xl,full}` outside avatar/dot files | `.tsx` `.ts` `.css` `.scss` |
| **T10b: Dark glow box-shadow** | A2.1 / D5.1 | 177-183 | Reject `box-shadow:` with blur > 20px AND non-zero spread | `.tsx` `.ts` `.css` `.scss` |
| **T10b: Purple/pink HSL hue** | A2.1 / D5.1 | 185-191 | Reject `hsl(...)` with hue ∈ [270°, 320°] | `.tsx` `.ts` `.css` `.scss` |
| **T10c: Sample-data isolation** | C6 / D9 | 202-230 | Reject `from '@/lib/(supabase\|org\|auth)/...'` in `src/app/design-system/**` (allows type-only `@/lib/supabase/types` imports) | `src/app/design-system/**/*.{tsx,ts,jsx,js}` |
| **T10d: Tenant-blind primitives** | C8 / A12.1 | 236-252 | Reject prop names `org_id`, `orgId`, `membership`, `vendor_id`, `membershipId` in `src/components/ui/*.tsx` | `src/components/ui/**/*.{tsx,ts,jsx,js}` |

Path filters: hook applies only inside `src/*` and `supabase/migrations/*`. Skips `globals.css` and `tailwind.config.*` (those define tokens). Skips files outside `nightwork-platform` working tree.

Override: `NIGHTWORK_HOOKS_DISABLE=1` last-resort escape hatch. Logged at QA time.

---

## Appendix C — SPEC criteria satisfied by this document

| SPEC criterion | Section in this document |
|---|---|
| **A19** — token-add / component-add / pattern-add / icon-add / breakpoint-change / brand-customization workflows + propagate orchestrator integration + shadcn-hybrid boundary + Storybook re-evaluation marker + design-system access audit-logging N/A | §3, §4, §5, §8, §9, §6, §1, §4c, §4d, §12 |
| **A19.1** — bidirectional skill anchor cross-reference | §11 |
| **A11.1-A11.7** — brand-customization contract | §6 |
| **A12.1** — tenant-blind primitives rule (referenced from PROPAGATION) | §6e, §11 (cross-cutting), Appendix B |
| **A12.2** — icon library boundary | §8 |
| **A12.3** — brand-customization companion (which components consume `--brand-accent` / `--brand-logo`) | §6b |
| **A2.1** — Forbidden thresholds quantification | §7a, §7b, Appendix B |
| **C7** — Forbidden hook enforcement | §7c, Appendix B |
| **C8** — tenant-blind hook enforcement | §6e, Appendix B |
| **D5.1** — Forbidden positive test verification | §7e |

---

**T15 status:** PROPAGATION-RULES.md DRAFT COMPLETE (2026-04-30). 13 sections covering token-add / token-value-change / component-add (shadcn primitive + custom Nw* paths + shadcn-hybrid boundary + Storybook re-eval marker) / pattern-add / breakpoint-change / brand customization (v1 contract + v2 extension workflow) / Forbidden-list update (hook regex + codemod rule families) / icon-add / versioning posture / skill anchor / audit-logging N/A / cross-reference index. Plus 3 appendices (codemod rule families, hook enforcement summary, SPEC criteria coverage). Subordinate skills (`nightwork-design`, `nightwork-design-tokens`, `nightwork-ui-template`, `nightwork-anti-drift`) reference this document as authoritative for change workflows. Re-verification triggered by any new Forbidden rule addition, new component path, or new brand-customizable token.
