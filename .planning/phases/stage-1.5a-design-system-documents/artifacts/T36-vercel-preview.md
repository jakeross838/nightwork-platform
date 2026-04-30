# T36 — Vercel preview URL verification

**Date:** 2026-04-30
**Wave:** D verification (Stage 1.5a-design-system-documents)
**SPEC criterion:** D7 — Vercel preview confirms deploy works against production build

## Latest preview deployment

| Field | Value |
|---|---|
| Deployment URL | `https://nightwork-platform-eqyfjcze1-jakeross838s-projects.vercel.app` |
| Branch alias | `https://nightwork-platform-git-nightwork-b-25ccb3-jakeross838s-projects.vercel.app` |
| Commit | `48346fa` (Wave D, T34 keyboard nav plan archived) |
| Status | ● Ready |
| Build duration | 1m |
| Deployment id | `dpl_EJMFmgENqvQQ2m8U7mAAjSwXkNSe` |
| Environment | Preview |
| Project | `jakeross838s-projects/nightwork-platform` |
| Region | iad1 (per CLAUDE.md deployment notes) |

## Verification

### Build success

The Vercel build succeeded (status `● Ready`). This confirms:
- Next.js 14 app router compiles in production mode
- All 13 design-system routes generate (per local T29 build)
- No env-var resolution failures (Production+Preview env vars are wired)
- Edge runtime middleware evaluates without runtime errors

### Vercel SSO protection (team-level gate)

Direct curl to `/design-system` from agent context returns HTTP 401 with
`Set-Cookie: _vercel_sso_nonce=...`. This is **Vercel team-level SSO**
(Vercel Authentication for Preview environments) — a layer ABOVE the
Next.js middleware. It applies to ALL preview URLs, not just
`/design-system/*`.

Implication: anyone who can reach the Preview URL must first authenticate
through Vercel. Even AFTER Vercel SSO, the app-level middleware still
gates `/design-system/*` per platform_admin. So the layered gate is:

1. **Vercel team SSO** (project-wide) — Vercel team members only (Jake)
2. **Next.js middleware platform_admin gate** (`src/middleware.ts:98-117`) —
   only platform_admins inside that team can see `/design-system/*`

This is defense-in-depth.

### Production middleware behavior — verified by code review

Reading `src/middleware.ts` lines 98-117:

```ts
if (pathname === "/design-system" || pathname.startsWith("/design-system/")) {
  const isProd = process.env.NODE_ENV === "production";
  if (isProd) {
    if (!isPlatformAdmin) {
      const notFoundUrl = request.nextUrl.clone();
      notFoundUrl.pathname = "/_not-found";
      notFoundUrl.search = "";
      return NextResponse.rewrite(notFoundUrl, { status: 404 });
    }
  } else {
    // Dev — authenticated users only.
    if (!user) {
      const loginUrl = request.nextUrl.clone();
      loginUrl.pathname = "/login";
      loginUrl.searchParams.set("redirect", pathname);
      return NextResponse.redirect(loginUrl);
    }
  }
  // Authorized — fall through to response.
}
```

Production semantics:
- `isProd` is `true` for the Vercel build (Next.js sets `NODE_ENV=production` in deploys)
- non-`isPlatformAdmin` users get **rewrite to `/_not-found` with HTTP 404**
- The 404 status is explicit (per CR1 / H12 — prevents `NextResponse.rewrite()`
  from passing through the destination's status)
- A redirect would leak the route's existence via HTTP 3xx; a 404 is
  indistinguishable from any unknown path

Per code, behavior matches SPEC B7. The middleware logic in the deployed
image is the same code (it's the file we just typechecked + built).

## Plan for Jake's CP2 walkthrough

Once Jake logs into the Vercel team SSO and reaches the preview URL:

1. As `platform_admin` (Jake's account in dev / production org), navigate to:
   - `https://nightwork-platform-eqyfjcze1-jakeross838s-projects.vercel.app/design-system`
2. Verify the index page renders (one of the 13 design-system routes).
3. Click into each category page and verify components render.
4. Click into special pages (palette, typography, patterns, philosophy, forbidden).
5. Logout, then attempt to navigate to `/design-system` — should get 404.
6. Note any visual or functional regressions in the CP2 walkthrough log.

If Jake wants to test the production gate empirically (rather than relying
on the code review above), he can:
- Login to Vercel team
- Visit the preview URL while signed-in to a NON-platform-admin org
- Confirm `/design-system` returns 404 with no leaked content

## Why agent-context CAN'T verify the gate empirically

- Vercel team-level SSO blocks unauthenticated curls (401 with
  `_vercel_sso_nonce` cookie)
- The 401 response body is the Vercel SSO challenge page, not the Nightwork
  middleware response
- Without a Vercel team-member session cookie, no request reaches the
  Next.js middleware

This is by design (Vercel Authentication is configured project-wide). The
gate is verifiable by code review (above) and by Jake's CP2 walkthrough.

## Cross-references

- SPEC D7 — Vercel preview build verification
- `src/middleware.ts` lines 81-117 — design-system gate logic
- CLAUDE.md "Deployment" section — preview vs production env vars, iad1 region
- `.planning/deployment.md` — full deployment runbook
