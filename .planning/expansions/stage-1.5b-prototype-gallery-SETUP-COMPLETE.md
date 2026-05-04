# Setup complete — stage-1.5b-prototype-gallery

**Status:** READY FOR EXECUTE — all 3 MANUAL items LOCKED (M1 + M2 + M3 phone device on iPhone Safari per nwrp34 Part 4)
**Completed:** 2026-05-01 14:50

## AUTO items (executed)

- [x] `.planning/fixtures/drummond/` parent directory verified (Source 1 + 2 + 3 subdirs)
- [x] Source 1 + Source 2 inventories verified
- [x] Source 3 INVENTORY.md verified (~94 priority Drummond files catalogued in `~/Downloads/`)
- [x] Sanitized fixture target directory created at `src/app/design-system/_fixtures/drummond/` with README placeholder
- [x] SUBSTITUTION-MAP.md template generated and locked (gitignored)
- [x] SUBSTITUTION-MAP.md gitignore status verified (`.gitignore:94:/.planning/*`)
- [x] Hook T10c sample-data isolation covers `_fixtures/drummond/` subdirectory by inheritance
- [x] Middleware gates `/design-system/prototypes/*` to platform_admin (`startsWith("/design-system/")`)
- [x] `exceljs ^4.4.0` available for XLSX parsing (no npm install needed)
- [x] Vercel preview auto-deploy configured (`vercel.json` `github.autoAlias: true`)
- [x] EXPANDED-SCOPE.md is APPROVED (with overrides per 2026-05-01 directive)
- [x] Stage 1.5a artifacts present (CHOSEN-DIRECTION + 5 design docs locked)

## MANUAL items (validated)

- [x] **M1.** 19 priority Drummond raw files staged into `.planning/fixtures/drummond/source3-downloads/` (+ `split-invoices/` subdir). 0 missing. All gitignored. Validated via `ls` + `git check-ignore -v`. Executed autonomously by Claude per Jake directive nwrp27.
- [x] **M2.** SUBSTITUTION-MAP.md locked with all `??` markers resolved (verified by `grep -c "??" → 0`). 17 vendor mappings (14 fictional + 3 NO-SUB for Ferguson/FPL/Home Depot). Owner: Caldwell. Site: 712 Pine Ave, Anna Maria FL 34216. Job code: GC0501. Executed autonomously by Claude per Jake directive nwrp27 (RULE 1 NO-SUB for national/public; RULE 2 fake-but-realistic Florida coastal-builder names).
- [x] **M3.** ✅ **LOCKED 2026-05-04 (per nwrp34 Part 4)** — Phone for Q5=B real-phone gate: **iPhone on Safari** (current iPhone Jake has on hand; whatever current Safari version ships with iOS at walkthrough time). Gate is "Jake walks every prototype on his actual phone" — not version-specific compliance. EXPANDED-SCOPE.md §0 + MANUAL-CHECKLIST.md M3 substituted accordingly.

## Sanitized fixture sample (M2 verification)

A few representative substitution rows from the locked SUBSTITUTION-MAP.md:

| Real | Sanitized |
|---|---|
| Drummond (surname) | Caldwell |
| 501 74th Street | 712 Pine Ave |
| Holmes Beach, FL | Anna Maria, FL |
| GC0525 (job code) | GC0501 |
| SmartShield Homes | Coastal Smart Systems LLC |
| Florida Sunshine Carpentry | Bay Region Carpentry Inc |
| Doug Naeher Drywall | Sandhill Drywall Inc |
| Loftin Plumbing | Anchor Bay Plumbing Inc |
| ML Concrete LLC | Bay Region Concrete Co |
| Ferguson | NO-SUB (national chain) |
| FPL | NO-SUB (public utility) |
| Home Depot | NO-SUB (national chain) |

Full mapping in `.planning/fixtures/drummond/SUBSTITUTION-MAP.md` (gitignored).

## Strategic questions for /gsd-discuss-phase (D1-D5)

These are NOT setup blockers — they belong to `/np`'s discuss-phase step:

- **D1.** PDF parsing strategy — recommend Claude Code Read tool (no `pdf-parse` dep) for 1.5b's small N.
- **D2.** Schedule (Gantt) implementation tech — recommend custom TimelineGrid using existing primitives.
- **D3.** G702 pixel-perfect print stylesheet approach — recommend pure CSS `@page` + print media queries.
- **D4.** Sanitized fixture intermediate staging file — recommend Yes for first build (debuggable).
- **D5.** Build-time grep check location — recommend B (in extractor) + C (CI workflow).

See AUTO-LOG.md "Items deferred to /gsd-discuss-phase" for full options + rationale.

## Next

Run `/np stage-1.5b-prototype-gallery` to begin planning. The chain is:
1. `/gsd-discuss-phase` (with EXPANDED-SCOPE.md + SETUP-COMPLETE.md as context; resolves D1-D5)
2. `/gsd-plan-phase` (with EXPANDED-SCOPE.md + discuss-phase context)
3. `/nightwork-plan-review` (multi-reviewer architectural gate)

After plan ships and is reviewed clean, `/nx stage-1.5b-prototype-gallery` runs:
1. `nightwork-preflight` validates SETUP-COMPLETE.md exists + EXPANDED-SCOPE approved + M3 phone locked + working tree clean + branch matches.
2. `/gsd-execute-phase` runs the plan.
3. `/nightwork-qa` validates against acceptance criteria.

## Reminder for /nx blockers

Before `/nx`:
- ✅ EXPANDED-SCOPE.md approved
- ✅ SETUP-COMPLETE.md exists
- ✅ M1 + M2 locked
- ✅ **M3 phone info substituted** in EXPANDED-SCOPE.md §0 + MANUAL-CHECKLIST.md M3 + this file per nwrp34 Part 4 (LOCKED: iPhone on Safari, current versions). QA spec-checker has concrete device to validate against.

If discovery during planning reveals EXPANDED-SCOPE.md needs revision (a prerequisite was missed), update EXPANDED-SCOPE.md and re-run `/nightwork-auto-setup stage-1.5b-prototype-gallery` to refresh setup.
