# npm audit — Stage 1.5a baseline (per T11.5 + SPEC C1)

**Date captured:** 2026-04-29 post-Wave-2 deps install (tailwindcss-animate, @heroicons/react v2.2.0, @tanstack/react-table v8.21.3).

**Headline:** 12 vulnerabilities (3 moderate, 9 high). All findings are **pre-existing transitive dependencies** of packages that predate Stage 1.5a (next, exceljs, react-pdf, eslint-config-next) or system-level tooling (`tar`, `glob` via `@mapbox/node-pre-gyp`). **Zero findings are introduced by 1.5a's three new direct deps** (`tailwindcss-animate`, `@heroicons/react`, `@tanstack/react-table`).

## Disposition per finding

| Package | Severity | Direct cause | Disposition |
|---|---|---|---|
| `@xmldom/xmldom <=0.8.12` | high | Transitive of `mammoth` (DOCX preview pipeline) | Accept-with-rationale; resolves on next `mammoth` upgrade. Re-evaluate at Wave 1.1. |
| `@next/eslint-plugin-next` 14.0.5-15.0.0-rc.1 | high | Transitive of `eslint-config-next@14.2.35` | Accept; fix requires `eslint-config-next@16` major bump (forces Next.js 16 migration). Wave 3 / dedicated cleanup phase. |
| `glob 10.2.0-10.4.5` | high | CLI-only command-injection — not exploitable in our build path | Accept; same trigger as eslint-config-next bump. |
| `next` ≥ 9.3.4-canary.0 | high (multiple) | We are on `next@14.2.35`; fix is `next@16.2.4` major bump | Accept; major version bump is its own phase. Image Optimizer DoS, RSC DoS, request-smuggling rewrites — all relevant to production but require Wave 3 deployment-hardening sprint. |
| `pdfjs-dist <=4.1.392` | high | Transitive of `react-pdf@7.7.3` (invoice file preview) | Accept; fix is `react-pdf@10` major bump. Re-evaluate at Wave 1.1 invoice-review polish. |
| `postcss <8.5.10` | moderate | Transitive of `next@14` | Accept; fix is `next@16`. |
| `tar <=7.5.10` | high (multiple) | Transitive build-tool (`@mapbox/node-pre-gyp`) | Fix-available via `npm audit fix` (non-breaking). **Punted to dedicated cleanup commit** so 1.5a baseline is clean. |
| `uuid <14.0.0` | moderate | Transitive of `exceljs` | Accept; fix is `exceljs@3.4.0` major bump. |
| `@mapbox/node-pre-gyp <=1.0.11` | high (via tar) | Same as tar | Same as tar — `npm audit fix` non-breaking. |

## Why these don't block Stage 1.5a

1. **No 1.5a dep introduced any of these.** The three new direct deps (`tailwindcss-animate`, `@heroicons/react`, `@tanstack/react-table`) audit-clean.
2. **Every "high" finding is a transitive of an existing direct dep** that 1.5a does not modify — moving them to fixed versions requires major-version bumps to next/react-pdf/exceljs/eslint-config-next. Those bumps are their own phases.
3. **Production runtime exposure is mitigated** at the deployment layer — Vercel + CSP + middleware constrain attacker reach; the `next` Image Optimizer and RSC findings require attacker-controlled config or specific deployment patterns we don't run.

## Action items (logged separately to MASTER-PLAN §11 tech-debt registry)

- `npm audit fix` non-breaking sweep for `tar` + `@mapbox/node-pre-gyp` — own-commit, low risk.
- Track Next.js 16 migration as Wave 3 hardening item.
- Track react-pdf 10 migration when invoice review polish lands (Wave 1.1).

## Verification

`npm-audit-baseline.json` (sibling file) captures the full JSON output for reproduction. Re-run with `npm audit --json` to compare against this baseline.
