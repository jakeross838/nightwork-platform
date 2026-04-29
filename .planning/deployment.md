# Nightwork deployment runbook

This file is authoritative for Nightwork's Vercel deployment posture. Update it any time deployment, env vars, or infra change.

## URLs

| Environment | URL                  | Notes |
|-------------|----------------------|-------|
| Production  | `https://nightwork-platform.vercel.app` (alias) — canonical immutable: `https://nightwork-platform-9zyp98rnw-jakeross838s-projects.vercel.app` | First prod deploy 2026-04-29 (`dpl_8xtqsJ49GHQvntAY8Y7dEzkkaPyJ`). Trigger: push to `main` |
| Preview     | `https://nightwork-platform-git-{branch}-jakeross838s-projects.vercel.app` | Auto-generated per PR / branch. Trigger: every push to non-`main` branch |
| Local dev   | `http://localhost:3000`                              | `npm run dev` |

## CLI status

- Vercel CLI installed: ✓ (v52.0.0 as of 2026-04-29).
- Project linked: ✓ (2026-04-29) — `jakeross838s-projects/nightwork-platform` (project ID `prj_3jpf8g2tBtS360fMClgM4EPdJLxh`, team `team_3Zx8Ov6Cq8cykl2B8qBUIorI`). Local metadata at `.vercel/project.json` (gitignored).
- GitHub repo connected: ✓ — `https://github.com/jakeross838/nightwork-platform`.
- GitHub auto-preview-deploy: enabled by default after link (per `vercel.json` `github.autoAlias: true`).
- Vercel MCP registered with Claude Code: ✗ removed 2026-04-29 — `npx @vercel/mcp-adapter` adapter could not connect; rely on the `vercel` CLI directly. Re-evaluate if/when Vercel ships a stable MCP endpoint.
- First deployment: ✓ **2026-04-29** — `https://nightwork-platform.vercel.app` (alias) backed by `dpl_8xtqsJ49GHQvntAY8Y7dEzkkaPyJ`. Build healthy; no missing-env errors at boot.

## Env var inventory

Required in BOTH **Production** and **Preview** environments on Vercel. Verify with `vercel env ls`.

**Status (2026-04-29):** ✓ 11 keys populated in both Production and Preview via `vercel env add KEY <env> "" --value <val> --force --yes`. The 3 Stripe price IDs (`STRIPE_PRICE_STARTER`, `STRIPE_PRICE_PROFESSIONAL`, `STRIPE_PRICE_ENTERPRISE`) are still empty in `.env.local` — populate after Stripe products exist, then push to Vercel. `NEXT_PUBLIC_APP_URL` is currently `http://localhost:3000` in both envs — **flag**: update Production to `https://nightwork-platform.vercel.app` (and Preview to a per-branch pattern or leave localhost) before the URL is referenced for Stripe return URLs in production.

| Key                                  | Source            | Notes |
|--------------------------------------|-------------------|-------|
| NEXT_PUBLIC_SUPABASE_URL             | .env.local ✓      | Public — safe to expose |
| NEXT_PUBLIC_SUPABASE_ANON_KEY        | .env.local ✓      | Public anon key — safe |
| SUPABASE_SERVICE_ROLE_KEY            | .env.local ✓      | Server only — never exposed |
| ANTHROPIC_API_KEY                    | .env.local ✓      | Server only |
| STRIPE_SECRET_KEY                    | .env.local ✓      | Server only |
| STRIPE_WEBHOOK_SECRET                | .env.local ✓      | Server only |
| NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY   | .env.local ✓      | Public |
| NEXT_PUBLIC_APP_URL                  | .env.local ✓      | Public — set per environment |
| RESEND_API_KEY                       | .env.local ✓      | Server only — email send |
| NOTIFICATION_FROM_EMAIL              | .env.local ✓      | Public-ish — reply-to address |
| STRIPE_PRICE_STARTER                 | .env.local ✓      | Public — Stripe price ID |
| STRIPE_PRICE_PROFESSIONAL            | .env.local ✓      | Public |
| STRIPE_PRICE_ENTERPRISE              | .env.local ✓      | Public |
| OPENAI_API_KEY                       | .env.local ✓      | Optional fallback parser; remove if unused |

The setup spec calls out the first 6 as required. The rest are needed for current Nightwork features (Stripe pricing tiers, Resend email).

After linking, run:

```bash
# List what's currently in Vercel
vercel env ls

# Add a value (server prompts for secret without printing back)
vercel env add NEXT_PUBLIC_SUPABASE_URL production
vercel env add NEXT_PUBLIC_SUPABASE_URL preview
# ... repeat per key per environment
```

Or upload all from .env.local (BE CAREFUL — this leaks all values to Vercel's logs once):

```bash
vercel env pull .env.production.local  # to fetch what's there
# Manual add via dashboard is safer for secrets
```

## vercel.json contents

Located at repo root. Current settings:

- `framework: "nextjs"` — explicit declaration.
- `regions: ["iad1"]` — N. Virginia. Pinning to a single region for predictable latency; reconsider when adding global tenants outside US East.
- Security headers on all paths: HSTS, X-Frame-Options SAMEORIGIN, X-Content-Type-Options nosniff, Referrer-Policy strict-origin-when-cross-origin, Permissions-Policy locking down camera/mic/geolocation.
- `/api/*` carries `X-Robots-Tag: noindex, nofollow`.
- `github.silent: false`, `github.autoAlias: true` — preview deploys are surfaced and aliased automatically per branch.

## First-time deploy steps

All steps complete 2026-04-29.

1. ~~**Log in to Vercel:**~~ ✓ done.

2. ~~**Link the repo:**~~ ✓ done — `jakeross838s-projects/nightwork-platform`.

3. ~~**Add env vars to Vercel:**~~ ✓ done — 11 keys × 2 envs = 22 entries via `vercel env add`. Note for future keys: in non-interactive mode, preview adds require a positional empty branch (`""`) before `--value`, e.g. `vercel env add KEY preview "" --value <val> --force --yes`. Without it the CLI returns `action_required: git_branch_required`.

4. ~~**Trigger first deploy:**~~ ✓ done — `https://nightwork-platform.vercel.app` (alias). Deploy id `dpl_8xtqsJ49GHQvntAY8Y7dEzkkaPyJ`.

5. **Confirm GitHub integration — REMAINING:** Push a commit to a non-`main` branch and verify Vercel auto-builds a preview. The PR comment should show the preview URL.

## Rollback steps

If production breaks after a deploy:

```bash
# Find a previous good deploy
vercel ls --prod

# Roll back via dashboard (Domains → Production → Promote a different deploy)
# Or via CLI:
vercel promote <previous-deploy-url> --prod
```

For schema migrations specifically, follow `nightwork-rollback-planner` agent's plan template — code revert alone does not undo a destructive migration.

## Smoke test post-deploy

After every prod deploy, run:

```
/nightwork-end-to-end-test --mode=preview-url
```

Or manually:

1. Open the production URL.
2. Log in as a test user (Drummond org).
3. Walk: dashboard loads → invoice list → open one invoice → confirm preview + right-rail render.
4. Check Sentry for new errors in the 5 minutes after deploy.

## Known constraints

- Single region (iad1). Florida-based Ross Built users get reasonable latency. Adding clients outside US East should trigger a region review.
- Vercel functions have a 10s default timeout (30s on Pro/Enterprise). Long-running tasks (bulk import, draw generation) need to be moved to a job table + cron / queue, not synchronous API calls.
- Vercel Postgres is NOT used — Supabase Postgres handles all DB. Vercel handles Next.js runtime + edge functions only.
