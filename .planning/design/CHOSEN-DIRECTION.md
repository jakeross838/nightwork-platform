# CP2 Direction Lock

**Status:** LOCKED
**Picked-at:** 2026-05-01T18:00:46Z
**Picked-by:** jakeross838@gmail.com (platform_admin)

## Direction
**Site Office** (Direction C, per PHILOSOPHY.md §4)

## Palette
**Set B** — no override needed; existing token implementation already aligned to:
- `--nw-stone-blue: #5B8699`
- `--nw-slate-deep: #1A2830`
- `--nw-slate-tile: #3B5864`
- `--nw-white-sand: #F7F5EC`

## Reasoning (Jake, verbatim per nwrp21)
"I like the Site Office, ill let you decide the rest"
"Ok, I pick Pallete B"

## Audit footnote
Manually recorded per nwrp22 message. Vercel-preview click failed to persist due to read-only filesystem at runtime (`src/app/api/design-system/pick-direction/route.ts:18-26` caveat). Treated as Jake's authoritative pick — verbally stated direction (Site Office) and palette (Set B) in chat, manually transcribed by Claude Code per Option 2 of nwrp22 escalation. No re-architecture of the pick mechanism in this phase; logged as `1.5a-followup-2` tech debt (see `.planning/MASTER-PLAN.md` D-039 + §11).

---

## Subordinate work triggered (per PHILOSOPHY.md §7.3)

This marker locks the direction across the playground, the design skills,
the patterns catalogue, and the Forbidden list. The downstream propagation:

- **Playground (T20a-T26):** component category pages render in Site Office variant preferences (UPPERCASE eyebrows + 0.18em tracking + JetBrains Mono, compact density, 1px slate-tile left-stamp on cards, 150ms ease-out motion)
- **`nightwork-design` skill:** updates Authoritative documents row to point at this marker; reference HTMLs filtered to Site Office variant; Helm + Brass and Specimen variants archived to `audit-notes/` for record
- **`nightwork-design-tokens` skill:** adds Site Office Forbidden patterns (sentence-case eyebrows on canonical surfaces forbidden; NwBadge without 0.18em letter-spacing forbidden on stamp-tone instances; NwCard `padding="lg"` forbidden as too-spacious)
- **`nightwork-ui-template` skill:** Document Review reference instantiates Site Office variant (stamp captions in eyebrows, square stamp markers, Telex ticker audit timeline)
- **`nightwork-design-system-reviewer` agent:** adds Site Office quality-bar checks at `/nightwork-design-check`
- **`impeccable` skill (`.impeccable.md` §6):** PHILOSOPHY direction slot fills with "Site Office (C)" + axes (reference benchmark Procore × Linear hybrid, density high, motion 150ms ease-out instant, typography weight SG400/500 mixed + mono everywhere)
- **`frontend-design` skill:** direction override file points back to PHILOSOPHY.md §4
- **PATTERNS.md:** Document Review gold-standard render updates to Site Office variant (per PROPAGATION-RULES.md §6.4)
- **`.impeccable.md` §3:** Site Office Forbidden additions appended (sentence-case eyebrows on canonical surfaces forbidden; padding="lg" forbidden; manila-folder treatment on charts forbidden — Form/Non-Form rule per PHILOSOPHY.md §6.5)
- **post-edit hook (`.claude/hooks/nightwork-post-edit.sh`):** direction-conditional checks read this marker and apply Site Office Forbidden patterns

The DARK + Set A semantic-color special-case rule documented in SYSTEM.md §1b is **NOT applicable** since Set B was picked. Per nwrp14 directive 2026-04-30 + SYSTEM.md §1b note: that rule was a Set-A-only mitigation; Set B clears AA-normal on all four semantic-color × bg-page pairings without the special-case.

## Switching the lock

Switching direction or palette post-lock requires a new Strategic
Checkpoint per PHILOSOPHY.md §7.4. The replacement is a new phase with a
new pick at a new CP, archived as a successor to this marker. This file
itself is never overwritten without a CP — it is the audit record of the
1.5a pick.
