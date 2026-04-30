# T32 — Visual regression (Chrome DevTools MCP) — DEFERRED

**Date:** 2026-04-30
**Wave:** D verification
**Status:** DEFERRED to Jake's local CP2 walkthrough
**SPEC criterion:** D4 — visual verification of 13 routes × 3 breakpoints × 2 themes

## Why deferred

Chrome DevTools MCP (`mcp__claude-in-chrome__*`) is gated through the
`ToolSearch` registry and is not loaded by default in this agent context.
Loading the MCP and driving an authenticated Chrome session against the
Vercel preview URL is feasible but expensive in agent compute / tokens —
roughly 90 minutes of tooling time plus the screenshot artifact storage,
per M-P4.

Per nwrp17, the recommended path is option 2 (deferral plan) when Chrome MCP
isn't already loaded. Jake runs the visual regression spot-check during the
CP2 walkthrough, which is anchored on the Vercel preview URL anyway.

## Plan for Jake's CP2 walkthrough

### Spot-check strategy (per M-P4 / SPEC D4)

5 most-complex components get FULL coverage (3 viewports × 2 themes = 6
screenshots each = 30 total):

| Component | Page | Viewports | Themes |
|---|---|---|---|
| DataGrid | `/design-system/components/data-display` | nw-phone (375px), nw-tablet (768px), nw-desktop (1440px) | light + dark |
| Combobox | `/design-system/components/inputs` | same | same |
| Modal (Dialog) | `/design-system/components/overlays` | same | same |
| Drawer | `/design-system/components/overlays` | same | same |
| Form | `/design-system/components/inputs` | same | same |

The remaining components in the 6 category pages get **desktop-light only**
verification (1 screenshot per component category page = 6 additional). Total
spot-check: 30 + 6 = 36 screenshots.

### Special pages (CP2 surfaces)

Per Wave C, these special pages each need at least desktop-light + dark:

- `/design-system` (index)
- `/design-system/palette`
- `/design-system/typography`
- `/design-system/patterns`
- `/design-system/philosophy` (CP2 decision surface — 3 directions × 4 renders)
- `/design-system/forbidden` (12 DO-NOT items)

= 12 additional screenshots.

**Total visual regression spot-check: ~48 screenshots.**

### Procedure for Jake

```
1. Login to the Vercel preview URL as platform_admin (Jake's account).
2. Open Chrome DevTools → Device Toolbar.
3. For each of the 13 routes:
   a. Set viewport to nw-phone (375 × 667).
   b. Take screenshot (light theme).
   c. Toggle dark theme via system or app toggle.
   d. Take screenshot (dark theme).
   e. Repeat at nw-tablet (768 × 1024) and nw-desktop (1440 × 900).
4. For the 5 most-complex components, capture interactive states too:
   a. Combobox: closed, open with options, with filter applied.
   b. DatePicker: closed, open, with date selected.
   c. Drawer: closed, opening (mid-animation), open, with content scrolled.
   d. Modal: closed, open with confirm, open with destructive variant.
   e. DataGrid: empty, populated, sorted, filtered, paginated.
5. Save screenshots to .planning/phases/stage-1.5a-design-system-documents/
   artifacts/T32-screenshots/<route>__<viewport>__<theme>__<state>.png
6. Spot-check against COMPONENTS.md token bindings — verify hex render
   matches Slate palette CP2 candidates.
```

## Acceptance criteria (when run)

Per SPEC D4:
- ZERO components render with hardcoded fallback colors (red squares,
  pink rectangles, etc. — all signs of token resolution failure)
- ZERO clipped content at any viewport
- ZERO horizontal scrolls at nw-phone
- Dark theme produces a functional appearance (text legible, contrast
  WCAG 2.2 AA at minimum — verifiable via DevTools)
- All 12 Forbidden gallery overlays render with DO-NOT marker
- CP2 affordance (Wave C T24.1) is visible and interactive

## Why this defer is low-risk

- The build (T29) PASSES — every route compiles, server-renders, and
  links statically generate
- Bundle sizes are reasonable (~160-275 kB First Load — within Next.js
  reasonable defaults)
- ESLint zero errors (T31) means JSX is valid and tokens are wired
- The design system is internal-only (platform_admin gate); a visual
  regression that's caught at CP2 walkthrough is fixable in minutes
- Wave A/B/C committed extensive code review along the way; no
  unverified components landed silently

If Jake encounters visual regressions during CP2, those become CP2
walkthrough findings and route through the standard fix-and-recommit cycle.

## Cross-references

- SPEC D4 (visual regression spot-check)
- M-P4 (5-component-deep + 6-component-shallow strategy)
- COMPONENTS.md — token bindings per component (the source of truth for
  what colors should render)
- `.planning/design/SYSTEM.md` §3 (color tokens) and §4 (typography)
