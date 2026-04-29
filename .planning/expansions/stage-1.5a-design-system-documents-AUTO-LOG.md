# Auto-setup log — stage-1.5a-design-system-documents

**Run timestamp:** 2026-04-29
**Verdict:** ALL AUTO ITEMS PASSED. No MANUAL items required.

## Inventory

This is a docs-and-playground phase. Most typical setup categories (DB tables, env vars, third-party services, background-job framework, rate-limit infrastructure) are N/A.

### AUTO items

| # | Item | Status | Evidence |
|---|---|---|---|
| 1 | Create `.planning/design/` destination directory | ✅ COMPLETE | `mkdir -p .planning/design && ls .planning/` shows directory present |
| 2 | Verify existing design skills present | ✅ COMPLETE | `nightwork-design`, `nightwork-design-tokens`, `nightwork-ui-template` all in `.claude/skills/` |
| 3 | Verify token-enforcement post-edit hook present | ✅ COMPLETE | `.claude/hooks/nightwork-post-edit.sh` exists; `grep "design.token\|hardcoded\|hex"` confirms enforcement logic active |
| 4 | Verify Tailwind config + dark-mode + Slate tokens already wired | ✅ COMPLETE | `tailwind.config.ts` defines `darkMode`, `nw-*` color tokens; `colors_and_type.css` is the source of truth for CSS vars |
| 5 | Verify Heroicons / iconography availability | ✅ NOTED, deferred | Heroicons not in package.json; existing icons use SVG inline. No deps install needed for 1.5a (icons referenced abstractly in COMPONENTS.md). Icon library install decision deferred to execute. |
| 6 | Verify components playground destination | ✅ NOTED | `src/app/design-system/` does not yet exist; will be created during execute. |
| 7 | Update CLAUDE.md typography reference per Q2=B | ✅ COMPLETE | CLAUDE.md "UI rules" section updated 2026-04-29; Calibri reference replaced with Slate type system (Space Grotesk + Inter + JetBrains Mono); paraphrase mistake explicitly noted. |

### MANUAL items

**None.** Stage 1.5a is a documents-and-playground phase. No third-party signups, OAuth flows, API keys, or strategic decisions remain after EXPANDED-SCOPE approval.

### Items deferred to /gsd-discuss-phase

Two strategic questions surfaced during inventory that are appropriate for /gsd-discuss-phase to lock (not auto-setup blockers):

**D1 — shadcn primitive installation strategy.**

Current state: `package.json` has **zero shadcn primitives** (no `@radix-ui/*`, no `cmdk`, no `react-day-picker`, no `vaul`, no `class-variance-authority`, no `tailwind-merge`). Jake's brief says "we're building on shadcn" — but the existing UI is custom-Tailwind, not shadcn-based.

Options for /gsd-discuss-phase:
- **A.** Install shadcn now (`npx shadcn-ui@latest init` + add primitives as components are documented). COMPONENTS.md maps every component to a real shadcn primitive that's installed.
- **B.** Document existing custom-Tailwind components as the truth. COMPONENTS.md notes "shadcn-equivalent" patterns built directly on Tailwind without the shadcn CLI/registry. Migration to actual shadcn deferred to a future phase.
- **C.** Hybrid — install shadcn primitives we DON'T have custom equivalents for (Combobox via cmdk, DatePicker via react-day-picker, Drawer via Vaul, Tooltip + Popover via Radix). Keep existing custom NwButton / NwEyebrow / NwInput / etc. COMPONENTS.md is mixed but pragmatic.

Recommended: **C** — pragmatic, no rebuild of existing components, fills the gaps Jake explicitly named (Combobox + DatePicker + Drawer).

**D2 — TanStack Table v8 install timing.**

Q8 = A (TanStack Table v8 as DataGrid base). The package isn't yet installed. Two options:
- Install during execute as part of the components-playground build.
- Install now in SETUP for transparency.

Recommended: install during execute (clean atomic commit when DataGrid component lands). Auto-setup leaves `package.json` untouched at this stage.

## Next

Run `/np stage-1.5a-design-system-documents` to begin planning. /gsd-discuss-phase resolves D1 + D2 above. /gsd-plan-phase locks the task breakdown. /nightwork-plan-review gates execute.
