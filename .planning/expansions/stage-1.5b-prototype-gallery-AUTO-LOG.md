# Auto-setup log — stage-1.5b-prototype-gallery

**Run timestamp:** 2026-05-01 14:25
**Verdict:** AUTO ITEMS COMPLETE. **MANUAL items pending Jake** — see `stage-1.5b-prototype-gallery-MANUAL-CHECKLIST.md`.

## Inventory

This is a **throwaway HTML prototype gallery** built on sanitized Drummond fixtures (per D-009 sequencing → 1.5a documents → 1.5b prototypes → 1.5c test infra). No production database changes, no third-party services, no new env vars. Most typical setup categories (DB tables, env vars, API keys, OAuth flows) are N/A.

What setup exists is concentrated in **fixture infrastructure** (substitution map + sanitized output target dir) and **environment validation** (hook T10c, middleware gating, npm deps).

### AUTO items

| # | Item | Status | Evidence |
|---|---|---|---|
| 1 | `.planning/fixtures/drummond/` parent directory present | ✅ VERIFIED | `ls .planning/fixtures/drummond/` shows source1-pdrive/, source2-supabase/, source3-downloads/ |
| 2 | Source 1 + Source 2 inventories present | ✅ VERIFIED | `INVENTORY.md` in source1-pdrive/, JSON snapshots in source2-supabase/ |
| 3 | Source 3 INVENTORY.md present (raw files staging plan) | ✅ VERIFIED | `INVENTORY.md` enumerates ~94 Tier 1 + 69 Tier 2 Drummond files in `C:\Users\Jake\Downloads\` |
| 4 | Sanitized fixture target directory created | ✅ COMPLETE | `mkdir -p src/app/design-system/_fixtures/drummond/` + `README.md` placeholder so directory tracks in git |
| 5 | SUBSTITUTION-MAP.md template generated | ✅ COMPLETE | `.planning/fixtures/drummond/SUBSTITUTION-MAP.md` written with proposed substitutions for owner / address / 17 vendors / job code; status `TEMPLATE — pending Jake review` |
| 6 | SUBSTITUTION-MAP.md is gitignored | ✅ VERIFIED | `.gitignore` rule `/.planning/*` blocks all under `.planning/` except whitelisted paths; `fixtures/` is NOT whitelisted; map will not commit |
| 7 | Hook T10c sample-data isolation covers `_fixtures/drummond/` subdirectory | ✅ VERIFIED | `.claude/hooks/nightwork-post-edit.sh:202` regex matches `^(.*/)?src/app/design-system/.*\.(tsx\|ts\|jsx\|js)$`; subdirectory `_fixtures/drummond/` inherits enforcement; pure data exports (no `@/lib/supabase\|org\|auth` imports) will pass |
| 8 | Middleware gates `/design-system/prototypes/*` to platform_admin in production | ✅ VERIFIED | `src/middleware.ts:98` matches `pathname === "/design-system" \|\| pathname.startsWith("/design-system/")`; `/design-system/prototypes/*` covered by `startsWith` |
| 9 | `exceljs` available for XLSX parsing (5 pay apps + budget + schedule) | ✅ VERIFIED | `package.json` has `"exceljs": "^4.4.0"` |
| 10 | Vercel preview auto-deploy is configured | ✅ VERIFIED | `vercel.json` has `"github": { "autoAlias": true }`; per `vercel.json` `regions: ["iad1"]` matches deployment runbook |
| 11 | `.planning/expansions/stage-1.5b-prototype-gallery-EXPANDED-SCOPE.md` is APPROVED | ✅ VERIFIED | Header `**Status:** APPROVED 2026-05-01 (with overrides — see "Approved overrides" section below)` |
| 12 | Stage 1.5a artifacts present (CHOSEN-DIRECTION marker, design docs) | ✅ VERIFIED | `.planning/design/CHOSEN-DIRECTION.md` exists (Site Office + Set B locked 2026-05-01); SYSTEM.md, COMPONENTS.md, PATTERNS.md, PHILOSOPHY.md, PROPAGATION-RULES.md all present |

### MANUAL items

| # | Item | Why MANUAL | Validation hook |
|---|---|---|---|
| M1 | **Stage Drummond raw files** from `C:\Users\Jake\Downloads\` into `.planning/fixtures/drummond/source3-downloads/` | Files are personal-machine local; auto-setup cannot copy them without explicit Jake action (privacy posture per D-029) | On re-invocation: file count check that ≥18 priority files exist in source3-downloads/ |
| M2 | **Review and lock SUBSTITUTION-MAP.md** | Strategic naming decisions (Halcyon vs other) require Jake's call; auto-setup cannot lock without his review | On re-invocation: grep for any remaining `?? PROPOSED` markers; halt if found |
| M3 | **Confirm mobile test device** (iPhone? Pixel? iOS Safari? Chrome?) | Q5=B requires real-phone testing on a specific device; preflight check needs to know which device + browser version | On re-invocation: noted in MANUAL-CHECKLIST as ship-time gate, not blocking setup |

### Items deferred to /gsd-discuss-phase

Strategic / planning questions surfaced during inventory — these are NOT setup blockers; they belong to `/np`'s discuss-phase step:

- **D1 — PDF parsing strategy.** Inventory has ~94 Drummond invoice PDFs + lien-release PDFs. Options:
  - **A.** Add `pdf-parse` npm dep + parse programmatically.
  - **B.** Use Claude Code Read tool to manually transcribe key fields from 4-6 selected invoices into the fixture loader (no new dep).
  - **C.** Hand-curate a small JSON file of invoice fields (Jake or Claude transcribes), let extraction script consume it.
  - **Recommended:** B for 1.5b (small N, no new dep, keeps surface area tight). C is the fallback if reading PDFs proves unreliable. A is overkill for prototype scope.

- **D2 — Schedule (Gantt) prototype implementation tech (Q2 override C deliverable #11).** Options:
  - **A.** Build a custom TimelineGrid component using existing primitives (DataGrid + CSS grid + absolute-positioned bars).
  - **B.** Install `frappe-gantt` or similar lightweight Gantt library.
  - **C.** Use plain HTML/CSS table with calculated column widths for time periods.
  - **Recommended:** A — keeps Site Office token discipline intact, no new dep, validates the design system's component primitives at Gantt density. C is fallback if A explodes.

- **D3 — G702 pixel-perfect print stylesheet approach (Q7 override).** Options:
  - **A.** Pure CSS `@page` + print media queries against the existing component tree.
  - **B.** Print-specific component variant with hardcoded layout for G702 cover sheet.
  - **C.** Generate PDF server-side via puppeteer/playwright + custom HTML.
  - **Recommended:** A primary, B fallback. C is overkill (introduces a runtime PDF generator for a prototype).

- **D4 — Sanitized fixture intermediate storage.** Should the extractor write a single `extracted-staging.json` per source file (gitignored, intermediate) before the substitution map applies and final TS files are generated? Options:
  - **A.** Yes — staging file makes debugging easier (inspect what was parsed before substitution).
  - **B.** No — extractor is pure function, raw → sanitized TS in one pass.
  - **Recommended:** A for first build (substitution misses are visible in the staging file); strip to B once stable.

- **D5 — Build-time grep check implementation.** Where does it live?
  - **A.** Pre-commit hook (`.claude/hooks/`).
  - **B.** Inside the extractor script (rejects writing if real names detected post-substitution).
  - **C.** CI workflow (`.github/workflows/`).
  - **Recommended:** B + C. B catches errors at extraction time (fast feedback). C catches errors if Jake bypasses the extractor and writes fixtures by hand.

These resolve at `/np`'s discuss-phase before the plan is locked.

---

## Run summary (initial pass — 2026-05-01 14:25)

- AUTO items: **12 / 12 PASS**
- MANUAL items: **3 pending Jake**
- Strategic questions for plan: **5 surfaced (D1-D5)**
- Verdict: **PENDING JAKE** — see MANUAL-CHECKLIST.md

---

## Re-invocation pass — 2026-05-01 14:50 (per Jake directive nwrp27)

Jake instructed Claude to complete M1 + M2 + M3 autonomously and re-invoke validation.

### M1 — Stage Drummond raw files

- ✅ COMPLETE. PowerShell snippet from MANUAL-CHECKLIST.md executed via PowerShell tool.
- 13 priority top-level files + 6 split-invoices = **19 files copied**, **0 missing**.
- Destination: `.planning/fixtures/drummond/source3-downloads/` (+ `split-invoices/` subdir).
- Gitignore verified via `git check-ignore -v`: both top-level files and `split-invoices/` files match `.gitignore:94:/.planning/*` rule.

### M2 — Lock SUBSTITUTION-MAP.md

- ✅ COMPLETE. File rewritten end-to-end with locked substitutions per nwrp27 RULE 1 (NO-SUB for national/public) + RULE 2 (fake-but-realistic Florida coastal-builder names).
- Owner surname: **Caldwell** (picked from {Henderson, Caldwell, Mitchell, Bennett, Whitfield}).
- Site address: **712 Pine Ave, Anna Maria FL 34216**.
- Job code: **GC0501**.
- Vendor names: 17 mapped (14 fictional + 3 NO-SUB for Ferguson/FPL/Home Depot).
- Validation: `grep -c "??" SUBSTITUTION-MAP.md` returns **0**.
- Status header changed: TEMPLATE → LOCKED 2026-05-01.

### M3 — Phone for Q5=B real-phone gate

- ⚠️ **PENDING JAKE CHAT REPLY.** Directive nwrp27 contained literal `[PHONE]` placeholder ("Phone: [PHONE]") that was not substituted with actual device info.
- Recorded as PENDING in EXPANDED-SCOPE.md §0 and MANUAL-CHECKLIST.md M3.
- Per the original AUTO-LOG MANUAL items contract ("Not setup-blocking — ship-time gate"), M3 does not block SETUP-COMPLETE.md.
- Phone info MUST be locked before `/nx` execute completes (so QA spec-checker can validate against a concrete device).

### Re-validation of all 12 AUTO items

All 12 AUTO items remain ✅ PASS — no infrastructure changed in this re-invocation pass.

### Final verdict

- AUTO items: **12 / 12 PASS**
- MANUAL items: **2 / 3 LOCKED + 1 deferred ship-time** (M3)
- Verdict: **READY FOR PLAN** with M3 ship-time gate deferred (will block `/nx` if not locked by then).
- SETUP-COMPLETE.md written.
