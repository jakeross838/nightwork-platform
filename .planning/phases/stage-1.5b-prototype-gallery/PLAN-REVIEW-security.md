# Plan review — security

Reviewer: security-reviewer agent
Phase: stage-1.5b-prototype-gallery
HEAD at review: ddd11fd
Review date: 2026-05-01
Phase nature: Throwaway HTML prototype gallery on sanitized fixtures. No user input, no API
endpoints, no SQL, no auth changes. Platform_admin gated in production.

---

## Verdict

APPROVE-WITH-NOTES

---

## Summary

Stage 1.5b's security posture is well-considered for a throwaway prototype gallery. The primary
risk surface — information disclosure of real client/vendor identities — is addressed through a
coherent three-tier defense (extractor-side grep gate, Claude pre-commit hook, CI workflow). The
authentication boundary is solid and correctly inherited from the existing middleware gate.
No CRITICAL findings. Two WARNING items are residual-accepted by the project (T-1.5b-W0-07 and
T-1.5b-W0-08); one APPROVE-WITH-NOTES item concerns a meaningful coverage gap in the pre-commit
hook and one concerns the T10c regex versus dynamic import bypasses. Three structural
observations are noted below.

---

## Findings

### CRITICAL

None.

---

### WARNING (residual / accepted)

**W-01 — T-1.5b-W0-07: Historical exposure at commit 37c5a92 (real → sanitized substitution map
inlined in PLAN-1 `<interfaces>` block)**

Disposition per plan: ACCEPT (residual). The plan correctly documents this: the full
substitution table was committed in the `<interfaces>` block at 37c5a92 before nwrp31
redacted it. The repo is private. Force-push was deliberately avoided per nwrp31. The
exposure is bounded to repo collaborators with `git log` access.

Security assessment: RESIDUAL ACCEPTED — correctly bounded. The repo's private posture is
the key control. The only additional hardening available would be a force-push squash, which
nwrp31 explicitly declined. Per D-21, real names already appear in CLAUDE.md / VISION.md /
MASTER-PLAN.md anyway — the delta from this exposure is marginal. Verdict: threat is
correctly categorized and the accept rationale is sound.

**W-02 — T-1.5b-W0-08: Source map / Next.js chunk URLs disclose `_fixtures/drummond/` path
to authenticated platform_admin sessions**

Disposition per plan: ACCEPT (residual). The directory name "drummond" is documentation
labeling per D-27. The routes are platform_admin gated. Only staff sessions can load the
chunks containing the path.

Security assessment: RESIDUAL ACCEPTED — correctly bounded. The fixture directory name
"drummond" by itself is not sensitive data (it is the "reference job" label from CLAUDE.md).
Actual PII lives in the fixture values, which are sanitized. Per D-21, the directory naming
is an accepted leak. Verdict: correctly categorized.

---

### APPROVE-WITH-NOTES

**N-01 — T-1.5b-W0-09: `process.env.CI === "true"` guard is correct but does not cover all
cloud environments**

Plan mitigation: `scripts/sanitize-drummond.ts` throws at startup if `process.env.CI ===
"true"` or `process.env.VERCEL === "1"`.

Gap: GitHub Actions sets `CI=true`. Vercel builds set `VERCEL=1`. Both are covered. However,
other CI environments (e.g., CircleCI, Buildkite, self-hosted runners not using the GitHub
Actions standard) may not set either. This is low risk given the repo currently uses GitHub
Actions only (CI workflow does not exist yet at HEAD ddd11fd), but worth noting. The script
is also not in the repo yet, so this is a planning observation.

Recommendation: add a third sentinel: also throw if `process.env.NODE_ENV === "production"`.
This would catch any accidental production invocation regardless of CI platform. Cost: zero.

**N-02 — T-1.5b-W0-10: `git check-ignore -v` hard-fail path only checks
`drummond-invoice-fields.json` — not other hand-curated intermediary files**

Plan mitigation: script throws if `drummond-invoice-fields.json` exists but is not gitignored.

Gap: during execution a developer might also produce other intermediary files (e.g.,
`scripts/drummond-pay-app-raw.json`, extracted XLSX row dumps for debugging). These would not
be covered by the single-path check. This is a process gap, not a code gap — the actual
gitignore coverage depends on what patterns are in `.gitignore` for the `scripts/` directory.

Recommendation: verify that `.gitignore` has a broad pattern covering `scripts/drummond-*.json`
(or `scripts/*.json`) rather than relying only on the startup check for a single named file.
Add a comment in `sanitize-drummond.ts` noting that any intermediary data files extracted
during the session should follow the same gitignore posture.

**N-03 — T-1.5b-W0-11: Pre-commit Drummond grep gate is Claude-only — manual `git commit`
from terminal is NOT covered**

Plan mitigation: `.claude/hooks/nightwork-pre-commit.sh` blocks Claude-initiated `git commit`
calls that contain real Drummond identifiers in staged `src/app/design-system/_fixtures/drummond/`
files.

Gap: the plan correctly acknowledges this: "this hook only fires on Claude-initiated `git
commit` via the Bash tool — manual `git commit` from terminal is NOT covered." In a multi-PC
workflow (per CLAUDE.md dev environment rules), Jake or a future contributor could commit
directly from a terminal on a PC where Claude Code is not the agent, bypassing the hook
entirely. The CI tier-2 gate catches the commit post-push to main, but the window between
local commit and CI gate allows the real name to exist in local and remote git history.

The plan already flags this gap and proposes `.git/hooks/pre-commit` or `.husky/pre-commit`
as future hardening. That recommendation is correct.

Action at execute: confirm the CI workflow fires on PRs AND direct pushes to main (the plan
YAML does include `push: branches: [main]`). Verify the pattern in the CI YAML matches the
nightwork-pre-commit.sh pattern exactly — any divergence between the two tiers means a commit
could pass the hook but fail CI (noise) or vice versa (gap).

**N-04 — T10c regex versus dynamic imports and barrel re-export bypass vectors**

Plan mitigation: Hook T10c (`.claude/hooks/nightwork-post-edit.sh:194-230`) checks for
`from '@/lib/(supabase|org|auth)...'` import syntax in `src/app/design-system/**`.

Gap: the regex check catches static `import` statements. Three bypass vectors are not covered:

1. Dynamic imports: `import('@/lib/supabase/server')` would not match the grep pattern
   `from\s+['"](...)`. A prototype component written with a dynamic import (e.g., for code
   splitting) would bypass T10c entirely.

2. Barrel re-exports: if a file under `src/app/design-system/_fixtures/` or `src/components/nw/`
   itself re-exported something from `@/lib/supabase`, importing from that barrel would not
   trigger T10c on the consuming prototype file.

3. Type-only imports of bare `@/lib/supabase` (not `@/lib/supabase/types`): the hook's awk
   filter explicitly allows `@/lib/supabase/types` and subpaths. A bare `import type { ... }
   from '@/lib/supabase'` would be caught (the regex matches the bare module). Good.

Risk assessment for this phase: LOW. The prototype code in all six plans uses only static
named imports from `@/app/design-system/_fixtures/drummond` and `@/components/nw/*`. No
dynamic imports appear in any plan spec. The barrel `_fixtures/drummond/index.ts` exports
only fixture const arrays and types — no tenant module re-exports. The risk is theoretical
for 1.5b.

Recommendation: document the dynamic import limitation in the hook's comment block (already
present at line 194-230 of nightwork-post-edit.sh) so future contributors know the gap. No
code change needed for 1.5b scope.

**N-05 — T-1.5b-W1-05: Faked status_history timeline in lien-release prototype (PLAN-3
Task 2)**

Plan mitigation: explicit "F1 fixes the schema" disclaimer renders in JetBrains Mono above the
faked timeline.

Gap: the disclaimer is present in the component code but lives inside the rendered page body.
If a future user screenshots or exports the page without noticing the disclaimer, the faked
timeline could be misread as real audit data.

Risk assessment: LOW for a prototype-gallery surface gated to platform_admin. The plan
correctly treats this as an information quality risk rather than a security risk.

Recommendation: no code change. Confirm the disclaimer text is visually distinct (the plan
spec uses `var(--bg-subtle)` background + JetBrains Mono + small font — this is adequate).

**N-06 — Print page hardcoded hex (#000, #999, #f0f0f0) in PLAN-6 — carve-out is correctly
documented**

Plan calls out that the print page (`draws/[id]/print/page.tsx`) and the reconciliation
strawman (`reconciliation/page.tsx`) contain hardcoded hex values for print-specific
overrides (#000 text, #999 borders, #f0f0f0 table header fill) and `rgba(220, 38, 38, ...)` /
`rgba(34, 197, 94, ...)` for inline diff backgrounds. The post-edit hook would normally flag
these. The plan documents them as deliberate carve-outs.

Assessment: acceptable. The print colors must be raw values for browser print rendering
(CSS vars are not reliably resolved in `@media print` in all browsers). The reconciliation
rgba values mirror the existing patterns/page.tsx analog. Both exceptions are narrow and
explicitly documented. The hex check verify step in PLAN-6 explicitly allows only these
values. No security risk — these are non-PII display colors.

Recommendation: confirm the PLAN-6 verify step language ("ALLOWED only inside rgba(...)")
is carried into the actual execute-phase verification checklist so the carve-out is not
silently widened by a future editor.

**N-07 — Middleware production gate: `isProd` check uses `process.env.NODE_ENV === "production"`
rather than an explicit `VERCEL_ENV` check**

Location: `src/middleware.ts` lines 99-115.

The design-system gate uses:
```
const isProd = process.env.NODE_ENV === "production";
if (isProd) { if (!isPlatformAdmin) { ...404 rewrite... } }
```

In development (`NODE_ENV !== "production"`), the gate falls back to "authenticated users
only." This is the intended behavior per the middleware comment ("Dev — authenticated users
can browse the playground for design feedback").

Gap: Vercel preview deployments also run with `NODE_ENV === "production"` (Vercel sets this
for all non-dev builds). This means preview deployments ARE subject to the full
platform_admin gate, which is the desired posture per the brief ("same posture" on preview
URLs). This is actually CORRECT behavior — the concern in the brief is confirmed as a
non-issue.

Conclusion: the gating posture on Vercel preview URLs is identical to production: full
platform_admin check. The brief's concern about "same posture?" is answered: yes, same.
No finding.

**N-08 — Next.js `_next/static/` chunk content reachability without middleware auth**

The middleware matcher excludes `_next/static` (line 145-148 of middleware.ts):
```
"/((?!_next/static|_next/image|favicon.ico|fonts/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"
```

This means static chunks (JS bundles containing serialized fixture data) are directly
accessible without auth if their URL is known.

Analysis: Next.js App Router pages rendered with `"use client"` bundle fixture data into
client-side JS chunks. The chunk URL hash changes on every build, so guessing the URL
requires either: (a) the chunk manifest (which IS protected by middleware), or (b) prior
knowledge of the hash from a previous authenticated session.

The threat model correctly documents this in T-1.5b-W0-08 as RESIDUAL ACCEPTED. The
fixture data is sanitized (Caldwell pseudonyms, not real client names). The chunk hash is
an ephemeral security-by-obscurity barrier — not a meaningful control, but the accepted
residual is bounded by the sanitization guarantee.

For completeness: any server-rendered prototype page (`"use server"` or RSC without
`"use client"`) would NOT bundle fixture data into static chunks — the data stays
server-side. The budget page (PLAN-3), schedule page (PLAN-5), and server-rendered pages
in PLAN-2 that lack `"use client"` headers do not expose fixture data in static chunks.
Pages with `"use client"` (mobile-approval in PLAN-4, budget in PLAN-3 due to
`useState`/`useMemo`) do bundle fixture data into chunks. Given the sanitized posture,
this is acceptable.

Recommendation: maintain the sanitized fixture guarantee as the primary control. No
additional middleware changes needed. Confirm the chunk exposure is noted in the execute
phase SUMMARY so Jake is aware.

---

### N/A (throwaway HTML)

- **Injection / SQL injection** — no database queries, no user input, no parameterized query
  paths exist in 1.5b prototype routes. N/A.
- **CSRF** — no state-mutating API endpoints exist in 1.5b. The only "action" buttons
  (Approve, Reject, Hold, Mark received) have no `onClick` wired to real API routes per the
  plans. N/A.
- **SSRF** — no outbound HTTP from prototype routes. N/A.
- **Cryptographic failures** — SUBSTITUTION-MAP.md is gitignored, not encrypted. Acceptable
  per D-21 (private repo, local-only). N/A.
- **Broken authentication** — no auth changes in 1.5b. Existing session handling unchanged.
  N/A.
- **Insecure deserialization** — no user-controlled deserialization. Fixture data is a static
  const array baked at build time. N/A.
- **Security logging / monitoring** — Sentry not yet wired for 1.5b prototype routes. Per Wave
  0/1 stage, acceptable. N/A.
- **XXE** — no XML parsing. N/A.
- **React XSS via dangerouslySetInnerHTML** — searched all six plans' code snippets. Zero
  occurrences of `dangerouslySetInnerHTML`. React's default JSX escaping applies to all
  fixture string values rendered as children. N/A.

---

## Specific threat model entry verdicts

| Entry | Plan verdict | Security reviewer verdict |
|-------|-------------|--------------------------|
| T-1.5b-W0-01 two-tier grep gate | mitigate | SOUND. Pattern matches pre-commit hook exactly. |
| T-1.5b-W0-02 drummond-invoice-fields.json gitignore | mitigate | SOUND with N-02 note. |
| T-1.5b-W0-03 direction lock | mitigate | SOUND. Data-attribute shadowing is a CSS behavior, not a security control — verify at execute as planned. |
| T-1.5b-W0-04 hand-edit drift | mitigate | SOUND. CI tier-2 gate catches drift. |
| T-1.5b-W0-05 middleware gate | mitigate (existing) | SOUND. Middleware confirmed: line 98, `startsWith("/design-system/")` covers all `/prototypes/*` subroutes. |
| T-1.5b-W0-06 T10c hook | mitigate (existing) | SOUND with N-04 note re: dynamic import bypass. |
| T-1.5b-W0-07 git history exposure | accept (residual) | RESIDUAL ACCEPTED. Correctly bounded. |
| T-1.5b-W0-08 source map disclosure | accept (residual) | RESIDUAL ACCEPTED. Correctly bounded. |
| T-1.5b-W0-09 CI guard | mitigate | SOUND. N-01 recommends adding `NODE_ENV === "production"` check as belt. |
| T-1.5b-W0-10 gitignore hard-fail | mitigate | SOUND with N-02 note re: single-file scope. |
| T-1.5b-W0-11 pre-commit Claude-only | mitigate | SOUND. Gap correctly documented. N-03 restates and recommends .git/hooks follow-up. |
| T-1.5b-W1-01 through W1-13 | mitigate / accept | All correctly categorized for a static prototype gallery. |
| T-1.5b-W2-01 through W2-05 | mitigate / accept | All correctly categorized. |

---

## Privacy hardening (D-28) — Caldwell naming check

The D-28 hardening (all Drummond* types renamed Caldwell*, all DRUMMOND_* consts renamed
CALDWELL_*) is reflected correctly across all six plans. The grep gate pattern in both
nightwork-pre-commit.sh and the planned CI YAML includes "Drummond" as a blocked identifier.
The only "Drummond" surviving in planned committed code is:

- `scripts/sanitize-drummond.ts` (file name — acceptable per D-28 rationale; script reads the
  source data by definition)
- Directory label `_fixtures/drummond/` (accepted per D-27)
- Body text references in plan documents under `.planning/` (accepted per D-28 historical
  context commentary)

No `DRUMMOND_*` const names appear in any plan code snippets. All fixture consts in all plans
use `CALDWELL_*` prefix. Naming hardening is complete as planned.

---

## Recommended next step

Execute PLAN-1 (Wave 0) with the following reminders:

1. Before writing `scripts/sanitize-drummond.ts`: verify `.gitignore` covers
   `scripts/drummond-*.json` broadly, not just the single named file.
2. Add `process.env.NODE_ENV === "production"` as a third sentinel in the CI guard block
   alongside the existing `CI === "true"` and `VERCEL === "1"` checks.
3. After CI YAML is written, confirm the grep PATTERN string exactly matches the
   nightwork-pre-commit.sh DRUMMOND_PATTERN string — any drift between the two tiers creates
   either a false-positive gap or a false-negative gap.
4. At the Wave 0 HALT checkpoint, run the privacy grep exactly as documented in the
   verification block. The halt is blocking and correct — do not waive it.
5. At execute phase for each Wave 1-2 plan: the T10c verification grep must be run
   immediately after writing each new prototype file, before moving to the next task.
6. For PLAN-6 print + reconciliation: confirm the hardcoded hex carve-out language
   is preserved verbatim in the execute-phase verify checklist so it is not silently expanded.
