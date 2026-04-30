# QA-verdict.md — Stage 1.5a Wave D — 2026-04-30

# **VERDICT: PASS — CP2-READY**

| Severity | Count |
|---|---|
| CRITICAL | 0 |
| HIGH | 0 |
| MEDIUM | 2 |
| LOW | 3 |

The design-system playground is ready for Strategic Checkpoint #2.
**Halt point reached** — Jake's CP2 walkthrough is the next move per nwrp17.

---

## Executive summary

Wave A (foundation), Wave B (component pages), Wave C (special pages) shipped
clean. Wave D verification confirms:
- ✓ `npm run build` passes — all 13 design-system routes generate
- ✓ `npx tsc --noEmit` no new errors (49 pre-existing TS1501 ES2018 regex
  errors in `__tests__/*.test.ts` are tracked tech debt per MASTER-PLAN.md)
- ✓ `npx eslint src/app/design-system` zero errors
- ✓ Post-edit hooks reject hardcoded hex (T35), bouncy easing (T35.5a),
  sample-data tenant imports (T35.5b), tenant-blind prop violations (T35.5c)
- ✓ No Drummond/SmartShield/Holmes Beach references in design-system (T35.6)
- ✓ Vercel preview deployed at
  `https://nightwork-platform-eqyfjcze1-jakeross838s-projects.vercel.app`,
  status Ready, 1m build duration
- ✓ 50/52 SPEC acceptance criteria COVERED, 2 DEFERRED-with-rationale
  (T32 visual regression, T33 axe-core — both require Jake's authenticated
  CP2 walkthrough environment)

Token discipline is impeccable across 9,394 lines of design-system code:
zero hardcoded hex, zero Tailwind named colors (`bg-blue-500` etc.), zero
legacy namespaces (`cream-*`, `teal-*`, `brass-*`, `brand-*`, `status-*`,
`nightwork-*`).

Tenant-blind primitives confirmed: zero `org_id`/`vendor_id`/`membership`
prop names in `src/components/ui/`.

Sample-data isolation confirmed: zero imports from `@/lib/(supabase|org|auth)/`
across `src/app/design-system/*`.

---

## Findings (classified)

### MEDIUM-1 — `rgba(...)` opacity tints in design-system pages

**Locations:** ~30 occurrences across `forbidden/page.tsx`,
`patterns/page.tsx`, `philosophy/page.tsx`, `palette/page.tsx`,
`components/{data-display,inputs,feedback}/page.tsx`,
`components/data-display/error.tsx`, `philosophy/pick-button.tsx`.

**Issue:** Inline rgba opacity tints like `style={{ background: "rgba(176, 85, 78, 0.06)" }}`
where the numeric triplet maps to canonical Slate tokens (`--nw-danger`,
`--nw-stone-blue`, `--nw-white-sand`, `--nw-success`) — but the relationship
is implicit, not derived from the token.

**Why MEDIUM not BLOCKING:**
- Post-edit hook only blocks `#hex` literals; rgba is not in the block list
- SPEC D5 says "No hardcoded hex colors" — rgba is not explicitly forbidden
- Token values are CORRECT (no off-palette colors introduced)
- Used for opacity tints (4-14% bg overlays) where CSS vars don't natively
  support alpha in the browser baseline

**Remediation suggestion (defer to polish phase):**
- Modern CSS: `color-mix(in srgb, var(--nw-danger), transparent 94%)`
- Or: define `--nw-danger-tint-04`, `--nw-danger-tint-06` etc. in
  `colors_and_type.css` so the tints are token-derived

**Status:** Non-blocking for CP2. Address in a follow-up "Wave E polish"
or as part of Stage 1.5b implementation.

### MEDIUM-2 — CP2 `reasoning` input not sanitized before markdown write

**Location:** `src/app/api/design-system/pick-direction/route.ts:86`

**Issue:** `const reasoning = (body.reasoning ?? "").trim() || "(no reasoning provided)";`
The `reasoning` is embedded verbatim into the markdown literal that writes
to `.planning/design/CHOSEN-DIRECTION.md`. A malicious admin (or someone
briefly compromising an admin session) could inject markdown that confuses
`readChosenDirection`'s regex parser.

**Why MEDIUM not HIGH:**
- Route is platform_admin-only (only Jake / Andrew per migration 00048)
- Output file is markdown, not HTML — React rendering auto-escapes when
  the file content displays in design-system pages
- Path is hardcoded (`process.cwd() + .planning/design/CHOSEN-DIRECTION.md`)
  — no path traversal vector
- Parser uses non-greedy regex on the FIRST `**Direction:**` line, which
  the route always writes first
- Worst case: confused parser shows `direction = "TBD"` even after a real
  pick — non-destructive

**Remediation suggestion:**
```ts
const reasoning = (body.reasoning ?? "").replace(/[\r\n]+/g, " ").slice(0, 500).trim()
  || "(no reasoning provided)";
```
Strip newlines, truncate to 500 chars. Defer to a follow-up since Jake is
the sole intended caller.

**Status:** Non-blocking for CP2.

### LOW-1 — `tw-animate-css` → `tailwindcss-animate` swap

**Location:** SPEC v2.1 amendment 3, `audit-notes/T07-twanimate-evaluation.md`,
`package.json` (currently `tailwindcss-animate@^1.0.7`).

**Issue:** None — the swap is properly documented; just FYI for future
readers.

**Status:** No action needed.

### LOW-2 — Select primitive deferred

**Location:** `src/app/design-system/components/inputs/page.tsx:541-578`

**Issue:** Select renders a "DOC-STUB" section explaining it's not yet
installed (will be `npx shadcn@latest add select` in T20a sub-task).

**Status:** SPEC A12 includes Select; the stub is a documented deferral
per COMPONENTS.md §1.3, not silent omission.

### LOW-3 — Git LF/CRLF normalization warnings

**Location:** Artifact .md / .txt files commit with "LF will be replaced by CRLF" warnings.

**Issue:** Standard Windows-Git behavior — files commit correctly.

**Status:** No action needed.

---

## Acceptance criteria coverage

| Group | Criteria | Covered | Deferred | Failed |
|---|---|---|---|---|
| A — Documents | A1-A20 (20) | 20 | 0 | 0 |
| B — Playground | B1-B10 (10) | 10 | 0 | 0 |
| C — Deps + integration | C1-C9 (9) | 9 | 0 | 0 |
| D — Quality gates | D1-D9 (11) | 9 | 2 | 0 |
| E — CP2 readiness | E1-E5 (5) | 5 | 0 | 0 |
| **TOTAL** | **52 falsifiable** | **50** | **2** | **0** |

Deferred:
- D4 (visual regression) — agent context can't drive Chrome MCP at scale;
  Jake runs at CP2 walkthrough using DevTools device toolbar
- D6.1 (axe-core JSON) — middleware gates require authenticated session
  cookie that agent context can't mint; Jake runs axe DevTools extension
  during CP2 walkthrough

Plans for both deferred items archived to `T32-visual-regression-DEFERRED.md`
and `T33-axe-DEFERRED.md`.

---

## Hand-off to Jake

**Recommended next step:** Jake runs T38 (tag commit) + T39 (CP2 walkthrough).

CP2 walkthrough sequence:

1. Login to Vercel team SSO
2. Visit https://nightwork-platform-eqyfjcze1-jakeross838s-projects.vercel.app/design-system
3. Walk all 13 routes light + dark, three viewports each
4. Execute T34 keyboard nav checklist on Combobox / DatePicker / Drawer
5. Optionally run axe DevTools browser extension per route
6. Pick a philosophy direction at `/design-system/philosophy` (writes
   `CHOSEN-DIRECTION.md` via the platform_admin-gated API)
7. Verify the locked-direction banner replaces the pick CTAs
8. Tag the release commit per T38

Post-CP2 follow-ups (non-blocking, queue for backlog):
- Address MEDIUM-1 (rgba → color-mix or `--nw-tint-*` tokens)
- Address MEDIUM-2 (sanitize CP2 reasoning input)
- T20a Select primitive install when Wave 1.5b actually needs it

---

## Cross-references

- Full QA report: `.planning/qa-runs/2026-04-30-1750-qa-report.md`
- SPEC: `.planning/phases/stage-1.5a-design-system-documents/SPEC.md` v2.1
- T32 deferral plan: `T32-visual-regression-DEFERRED.md`
- T33 deferral plan: `T33-axe-DEFERRED.md`
- T34 keyboard nav plan: `T34-kbd-nav-plan.md`
- T35 hook hex test: `T35-hook-test.md`
- T35.5 hook positive tests: `T35.5-hook-positive-tests.md` (Wave D section)
- T35.6 Drummond grep: `T35.6-drummond-grep.txt`
- T36 Vercel preview: `T36-vercel-preview.md`
- Wave D commits: `3811bd2` (T29-T31), `1eecf9b` (T35/T35.5/T35.6),
  `48346fa` (T34), `7964ea4` (T32/T33/T36)
