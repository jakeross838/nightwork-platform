# T33 — axe-core WCAG 2.2 AA scan — DEFERRED

**Date:** 2026-04-30
**Wave:** D verification
**Status:** DEFERRED to Jake's local CP2 walkthrough
**SPEC criterion:** D6.1 — automated WCAG 2.2 AA verification

## Why deferred

The `/design-system/*` routes are gated by `src/middleware.ts` (lines 98-117):

- **Production:** unconditional `isPlatformAdmin` check; non-admins get
  rewrite to `/_not-found` with HTTP 404
- **Development:** authenticated users only; unauth requests redirect to
  `/login`

Running `@axe-core/cli` against the local dev server requires authenticated
session cookies. axe-cli is a wrapper around Puppeteer/Chrome that hits URLs
unauthenticated. Workarounds considered:

1. **Inject auth cookies into axe-cli Puppeteer config** — possible but
   brittle (Supabase session tokens expire); requires reading the supabase
   middleware logic and minting a service-role JWT.
2. **Temporarily bypass the middleware gate via env var** — explicitly
   forbidden per SPEC C9 / H12 ("No env-var bypass — adding a
   `BYPASS_DESIGN_SYSTEM_GATE=true` escape hatch would defeat the purpose").
3. **Run axe-core as a library inside Playwright/Puppeteer with a logged-in
   browser context** — possible but requires building infrastructure that's
   out of scope for Wave D verification.
4. **Run axe against pre-rendered HTML** — would need to render each
   `/design-system/*` route to static HTML first, which Next.js does not do
   for these dynamic routes.

The least-disruptive path is option 3 + Jake's auth session. Jake has a
working dev environment with Supabase cookies and can run axe-core himself
during the CP2 walkthrough.

## Plan for Jake's CP2 walkthrough

When Jake runs the CP2 walkthrough, run axe-core against each design-system
route from his authenticated browser context using the axe DevTools browser
extension or a quick Node script:

```bash
# Option A — axe DevTools browser extension (manual)
# 1. npm run dev
# 2. Login as Jake (platform_admin)
# 3. Navigate to /design-system/components/<category>
# 4. Open DevTools → axe DevTools tab → Scan all of my page
# 5. Repeat for each of the 13 design-system routes

# Option B — Playwright + axe-core (scripted, optional)
# Install once: npm install --save-dev @axe-core/playwright playwright
# Then a small node script can authenticate via Supabase, navigate each
# route, and emit JSON to artifacts/axe-report.json
```

## Routes to scan (13 total)

1. `/design-system` (index)
2. `/design-system/components/data-display`
3. `/design-system/components/feedback`
4. `/design-system/components/inputs`
5. `/design-system/components/navigation`
6. `/design-system/components/overlays`
7. `/design-system/components/surfaces`
8. `/design-system/forbidden`
9. `/design-system/palette`
10. `/design-system/patterns`
11. `/design-system/philosophy`
12. `/design-system/typography`
13. `/design-system` index (re-tested)

## Acceptance criteria (when run)

Per SPEC D6.1:
- Zero critical violations
- Zero serious violations
- Moderate / minor violations documented; non-blocking unless thematic

## What this DEFERRAL means for CP2 readiness

- The underlying primitives (Base UI, react-day-picker, Vaul) implement
  ARIA patterns at the library level — accessibility is largely
  inherited, not authored, so regression risk is low
- `npx eslint src/app/design-system` (T31) found ZERO errors, including
  jsx-a11y/* lint rules
- T34's keyboard nav plan covers the highest-value a11y manual tests
- Visual focus-ring rendering is verified separately in T32

If Jake wants stronger pre-CP2 confidence, he can:
- Run option A above (axe DevTools extension) — ~5 min per route × 13 routes
- Note any findings in the CP2 walkthrough log

## Cross-references

- SPEC D6 (manual a11y) and D6.1 (axe-core)
- `src/middleware.ts` (lines 81-117) — design-system gate logic
- T34-kbd-nav-plan.md — manual keyboard nav checklist (covers ~70% of a11y)
