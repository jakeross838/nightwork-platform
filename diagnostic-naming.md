> SUPERSEDED 2026-04-29 by docs/nightwork-plan-canonical-v1.md. Kept for history.

# Diagnostic — canonical-name normalization drift

## 1. What items currently look like

The `items` table is tiny. Two rows in Ross Built, both already normalized:

| canonical_name                      | updated_at (UTC)           |
|-------------------------------------|----------------------------|
| `Standard 4" Backsplash`            | 2026-04-21 19:57:48.632665 |
| `Vetro Stone-Seabrook 3cm Countertop` | 2026-04-21 19:57:48.363903 |

Both were touched by `scripts/normalize-existing-items.ts` after C3. No Pylex item exists here.

## 2. What extraction lines currently look like

82 pending `invoice_extraction_lines` with `proposed_item_data` in Ross Built. 77 (94%) have **sentence-case** names — first word capitalized, everything after in lowercase. Samples:

| raw_description                              | proposed_item_data.canonical_name                              |
|----------------------------------------------|----------------------------------------------------------------|
| `New Construction Standing Seam (Completion)` | `Standing seam metal roof installation`                        |
| `2X6X10 PT NO.2 PRIME GROUND CONTACT`        | `2x6x10 pressure treated lumber No.2 grade ground contact`     |
| `SCREW TRN SYS #D SS 5X1-5/8 100`            | `Stainless steel trim system screws 5" x 1-5/8" (100-pack)`    |
| `BLADE OSCLTNG U-FIT 2-1/2IN`                | `Oscillating U-fit blade 2-1/2 inch`                           |
| `Pylex 32 In. Adjustable Helical Post Black` | `Pylex 32" adjustable helical post black`                      |

Aggregate casing check:

- `starts_lowercase`: 0
- `starts_uppercase`: 58
- `has_lowercase_mid_word`: 77
- `total_with_proposal`: 82

The AI model returns sentence case. That's its default style.

## 3. What `normalizeItemName` actually does

Pure-string normalizer. For each whitespace token, in order:

1. Collapse whitespace, trim, strip trailing punctuation, normalize typographic apostrophes/quotes, collapse dash variants.
2. If token matches `SPEC_TOKEN_RE = /^[0-9][0-9a-z./x\-\\"']*$/i` → lowercase it verbatim (e.g. `3CM` → `3cm`, `2X4X8` → `2x4x8`, `32"` → `32"`).
3. Else if token matches `DIGIT_UNIT_RE` (digit + attached unit like `3cm`, `1/4in`) → lowercase unit.
4. Else if `upper(token)` is in the construction-abbreviation whitelist (PT, MC, SS, PVC, AGM, etc.) → keep uppercase.
5. Else if hyphenated → recurse on each segment.
6. Else → `toTitle(word)`: lowercase, then capitalize first letter.

## 4. Normalizer applied to the requested inputs

| Input                                                  | Output                                                 |
|--------------------------------------------------------|--------------------------------------------------------|
| `Pylex 32 In. Adjustable Helical Post Black`           | `Pylex 32 In. Adjustable Helical Post Black` (unchanged) |
| `pylex 32 in. adjustable helical post black`           | `Pylex 32 In. Adjustable Helical Post Black`           |
| `MYSTERY FOREST 3CM - AGM`                             | `Mystery Forest 3cm - AGM`                             |
| `2x4x8 pt mc #2 prime ground cont`                     | `2x4x8 PT MC #2 Prime Ground Cont`                     |
| `Blade Oscling U-Fit 1-1/4in`                          | `Blade Oscling U-Fit 1-1/4in` (unchanged)              |

And for the specific case in question:

| Input                                         | Output                                         |
|-----------------------------------------------|------------------------------------------------|
| `Pylex 32" adjustable helical post black`     | `Pylex 32" Adjustable Helical Post Black`      |

The normalizer **does** produce correctly title-cased output when fed this line's sentence-case proposal. It has not been run on that row.

## 5. Where the Pylex item actually lives

Not in `items` — not a committed catalog row. The string `Pylex 32" adjustable helical post black` is stored on one `invoice_extraction_lines` row:

- `id = d568d240-0a30-476c-9f75-6e6930f04037`
- `raw_description = "Pylex 32 In. Adjustable Helical Post Black"`
- `proposed_item_data.canonical_name = "Pylex 32\" adjustable helical post black"`

Any UI rendering this is reading the extraction row's proposal — the items-table grouper never sees it because it never became a catalog row.

## 6. Why "adjustable helical post black" is not title-cased

Two facts together:

1. **The AI's raw output is sentence case.** That's what we stored in `proposed_item_data.canonical_name` at extraction time.
2. **The normalizer was wired into `match-item.ts` in commit `572db94` (C2, 2026-04-21 ≈ 19:57 UTC).** The 82 extraction lines in question were created by the earlier pipeline (commit `e03009e` C7, earlier in the day, pre-normalizer). Those rows never passed through `normalizeItemName`.

Subsequent cleanup (`scripts/normalize-existing-items.ts`, commit `952393d` C3) only touched `items.canonical_name`. It does **not** walk `invoice_extraction_lines.proposed_item_data`. The 82 pending proposals still carry the pre-normalizer sentence-case strings verbatim.

New extractions from this point forward run the normalizer inside `match-item.ts` and will land as proper title case. The drift only affects the pending backlog.

## 7. Root cause

> The one-shot normalization script normalized the items table but skipped the `invoice_extraction_lines.proposed_item_data` blobs, which is where these 82 pending rows actually store their AI-proposed canonical names. They remain in the AI's default sentence case because the normalizer never ran on them.

## 8. Fix approach (3–5 bullets)

- **Backfill script for extraction_lines.** Mirror `scripts/normalize-existing-items.ts`: walk every non-deleted `invoice_extraction_lines`, read `proposed_item_data.canonical_name`, run `normalizeItemName`, write back if changed. Dry-run first, then `--apply`. No AI cost. Idempotent.
- **Write the same jsonb merge pattern.** `UPDATE invoice_extraction_lines SET proposed_item_data = jsonb_set(proposed_item_data, '{canonical_name}', to_jsonb(new_name)) WHERE id = $1`.
- **Fix in place at verification time (defence in depth).** When the PM approves a line, `commitLineToSpine` / bulk-approve-group route should also normalize before creating the item — guards against any other upstream path that skips the AI normalize step.
- **Optional UI-side normalization on render.** Cheap, but means raw data in the DB stays messy. Not recommended as the primary fix — prefer fixing the data.
- **No AI re-call needed.** The AI's words are fine; only the casing is off. Pure string transform.

## Investigation scope

No code changes. All findings from Supabase MCP queries plus reading `src/lib/cost-intelligence/normalize-item-name.ts`.
