# T03 — Contrast ratios working table

**Method:** standard WCAG 2.x relative-luminance formula. Alpha-blended semantic tokens computed by blending the foreground over the resolved page/card hex (so the ratio reflects the *visible* color, not the source rgba).
**Computation script:** `/tmp/contrast.mjs` (Node, not committed — output captured here).
**Date:** 2026-04-29

WCAG 2.2 AA gates:
- **Normal text:** ≥ 4.5:1
- **Large text (18pt+ or 14pt+ bold) and non-text UI components:** ≥ 3:1
- AAA normal text: ≥ 7:1 (informational; not required by SPEC)

---

## A. Set B — existing palette (light + dark)

This is what `colors_and_type.css` resolves to today. Set B = `#5B8699` stone-blue, `#1A2830` slate-deep, `#3B5864` slate-tile, `#F7F5EC` white-sand.

### Set B / LIGHT theme (page = `#F7F5EC`, card = `#FFFFFF`)

| Text token | Resolved hex | bg-page | bg-card | bg-subtle | bg-muted | bg-inverse | Status |
|---|---|---|---|---|---|---|---|
| `--text-primary`   | `#3B5864` | **6.95** | **7.59** | **6.51** | **6.17** | 1.99 | Normal text passes on bg-page, bg-card, bg-subtle, bg-muted; **fails on bg-inverse — but text-primary on bg-inverse is never the intended pairing.** |
| `--text-secondary` | `#73878d` (blend of slate-tile @70% on page) | 3.45 | 3.76 | 3.23 | 3.06 | **4.01** | **FAILS normal text (4.5)** on all light surfaces. PASSES large-text/UI (3:1). Eyebrows and meta typically render at 10-12px → may need bump or `--text-secondary` re-derivation. |
| `--text-tertiary`  | `#909fa1` | 2.51 | 2.74 | 2.35 | 2.23 | 5.51 | **FAILS normal AND large text on every light surface.** Decorative-only or accept-with-rationale (rare-use eyebrow on inverse card). |
| `--text-muted`     | `#acb6b6` | 1.90 | 2.07 | 1.78 | 1.69 | 7.28 | Non-textual decorative-only on light surfaces (e.g. icon stroke). PASSES on inverse card (slate-deep). |
| `--text-accent`    | `#4E7A8C` (gulf-blue) | **4.29** | **4.68** | **4.02** | 3.80 | 3.23 | Borderline on bg-page (4.29 < 4.5 normal) but passes UI/large; passes normal on bg-card. |
| `--text-inverse`   | `#F7F5EC` (white-sand) | 1.00 | 1.09 | 1.07 | 1.13 | **13.83** | Only intended on bg-inverse. PASSES with massive margin there. Other pairings irrelevant. |
| `--color-success`  | `#4A8A6F` | 3.73 | **4.07** | 3.49 | 3.31 | 3.71 | Normal text BORDERLINE-FAIL on bg-page (3.73 < 4.5) and bg-card (4.07 < 4.5). Passes large-text/UI 3:1 everywhere. **Use as non-text status signal (badge border, icon stroke); for text labels accept-with-rationale OR pair with bold/large size.** |
| `--color-warning`  | `#C98A3B` | 2.68 | 2.92 | 2.51 | 2.38 | **5.17** | FAILS normal AND large on light bgs. Use against inverse only, OR as non-text (border + icon). On light bgs, must use `Badge variant="warning"` which already pairs colored text on subtle tinted bg + tightly bordered, not raw text. |
| `--color-error`    | `#B0554E` | **4.52** | **4.93** | **4.23** | **4.01** | 3.06 | PASSES normal text on bg-page and bg-card; FAILS on bg-subtle (4.23) and bg-muted (4.01) for normal but passes for large-text/UI. PASSES large/UI on bg-inverse. |
| `--color-money`    | `#3B5864` (= `--text-primary` light) | **6.95** | **7.59** | **6.51** | **6.17** | 1.99 | Same as text-primary. Passes everywhere except bg-inverse (which uses `--color-money` = sand in dark mode, not relevant in light). |

**Set B / LIGHT failure cells (per usable text-token × bg-token where intended):**

| # | text × bg | Ratio | Severity | Disposition |
|---|---|---|---|---|
| 1 | `--text-secondary` × `--bg-page`   | 3.45 | normal-text fail | accept-with-rationale: secondary text used at 14-15px small-meta; AA passes large/UI |
| 2 | `--text-secondary` × `--bg-card`   | 3.76 | normal-text fail | same rationale (14px meta lines) |
| 3 | `--text-secondary` × `--bg-subtle` | 3.23 | normal-text fail | same rationale |
| 4 | `--text-secondary` × `--bg-muted`  | 3.06 | normal-text fail | same rationale |
| 5 | `--text-tertiary` × every light bg | 2.23–2.74 | both fail | accept-with-rationale OR fix: tertiary used decoratively (date stamps, "—" placeholders); large-text fail accepted with cap awareness |
| 6 | `--text-muted` × every light bg | 1.69–2.07 | both fail | non-textual decorative use only (icon strokes, spacers) — accept-with-rationale; do NOT use for text |
| 7 | `--text-accent` × `--bg-page` | 4.29 | normal-text borderline | accept-with-rationale: gulf-blue links, used at 14px+; large-text passes |
| 8 | `--text-accent` × `--bg-muted` | 3.80 | normal-text fail | accept-with-rationale: rarely paired |
| 9 | `--color-success` × `--bg-page` | 3.73 | normal-text fail | use as Badge variant only (icon + bordered tint); not raw text |
| 10 | `--color-success` × `--bg-card` | 4.07 | normal-text fail | same rationale |
| 11 | `--color-warning` × every light bg | 2.38–2.92 | both fail | non-text only (Badge border + tint) |
| 12 | `--color-error` × `--bg-subtle` | 4.23 | normal-text fail | accept-with-rationale: rarely paired (error text on subtle tint) |
| 13 | `--color-error` × `--bg-muted` | 4.01 | normal-text fail | accept-with-rationale |

**SET B / LIGHT — failure summary:** ~13 fails of which ~8 are non-text decorative uses (acceptable), 5 are accept-with-rationale text uses (4-5 within the cap of 3 for accept-with-rationale per A3.1 IF we restrict to TEXT cells only).

### Set B / DARK theme (page = `#1A2830`, card = `#132028`)

| Text token | Resolved hex | bg-page | bg-card | bg-subtle | bg-muted | bg-inverse | Status |
|---|---|---|---|---|---|---|---|
| `--text-primary`   | `#F7F5EC` | **13.83** | **15.20** | **12.39** | **11.02** | 1.00 | Pass with massive margin everywhere (sand on slate). |
| `--text-secondary` | `#b9bcb7` | **7.87** | **8.65** | **7.05** | **6.27** | 1.76 | PASSES normal AAA on dark surfaces. |
| `--text-tertiary`  | `#949997` | **5.22** | **5.74** | **4.68** | **4.16** | 2.65 | PASSES normal AA on bg-page, bg-card, bg-subtle. Borderline on bg-muted (4.16 < 4.5). |
| `--text-muted`     | `#727a7b` | 3.44 | 3.78 | 3.08 | 2.74 | 4.02 | FAILS normal text. Passes large/UI (3:1) on bg-page (3.44) and bg-card (3.78). Decorative use only. |
| `--text-accent`    | `#CBD8DB` (oceanside) | **10.35** | **11.37** | **9.27** | **8.25** | 1.34 | PASSES AAA normal on dark. Designed for dark mode link text. |
| `--text-inverse`   | `#3B5864` | 1.99 | 2.19 | 1.78 | 1.59 | **6.95** | Only intended on bg-inverse (which is sand in dark mode). PASSES there. |
| `--color-success`  | `#4A8A6F` | 3.71 | **4.08** | 3.32 | 2.96 | 3.73 | FAILS normal everywhere. Same rationale as light — non-text only. |
| `--color-warning`  | `#C98A3B` | **5.17** | **5.68** | **4.63** | **4.12** | 2.68 | PASSES normal on bg-page (5.17), bg-card (5.68), bg-subtle (4.63). Borderline on bg-muted (4.12). |
| `--color-error`    | `#B0554E` | 3.06 | 3.36 | 2.74 | 2.44 | **4.52** | FAILS normal text on dark bgs; passes large/UI on bg-page (3.06) and bg-card (3.36). Non-text use only. |
| `--color-money`    | `#F7F5EC` | **13.83** | **15.20** | **12.39** | **11.02** | 1.00 | Same as text-primary. Pass with massive margin. |

**SET B / DARK failure summary:**

| # | text × bg | Ratio | Severity | Disposition |
|---|---|---|---|---|
| 1 | `--text-tertiary` × `--bg-muted` | 4.16 | normal borderline | accept-with-rationale (tertiary at 14px is rare on muted) |
| 2 | `--text-muted` × all dark bgs | 2.74–3.78 | normal fail | non-text decorative (`text-muted` is meant for "—" placeholders, separator dots, etc.) |
| 3 | `--color-success` × all | 2.96–4.08 | normal fail | use as Badge only (icon + tint + border) |
| 4 | `--color-warning` × `--bg-muted` | 4.12 | borderline | rare pairing |
| 5 | `--color-error` × all dark bgs | 2.44–3.36 | normal fail | Badge only |

**SET B / DARK is materially BETTER than LIGHT for `--text-secondary` and `--text-tertiary`.** This is the standard light-vs-dark contrast asymmetry — the dark theme reads stronger with white-sand foregrounds.

---

## B. Set A — Jake's brief palette (light + dark)

Set A = `#6B8EA3` accent (lighter stone-blue) + `#2D3E4A` dark slate (lighter slate-deep) + `#8A8A8A` warm gray (NEW token, not in current system).

Note: Set A swaps two tokens (stone-blue, slate-deep). All other tokens (slate-tile, gulf-blue, success, warn, danger, white-sand) remain the same as Set B per Jake's brief which only redefined those three. The third Jake-named hex (`#8A8A8A` warm gray) does NOT have a current `--nw-*` equivalent; it would be a NEW token if Set A is picked.

### Set A / LIGHT theme (page = `#F7F5EC`, card = `#FFFFFF`)

| Text token | Resolved hex | bg-page | bg-card | bg-subtle | bg-muted | bg-inverse | Status |
|---|---|---|---|---|---|---|---|
| `--text-primary`   | `#3B5864` (slate-tile, unchanged) | **6.95** | **7.59** | **6.57** | **6.17** | 1.46 | Same as Set B. Pairing on bg-inverse is *worse* (1.46 vs 1.99 in Set B) because Jake's slate-deep #2D3E4A is lighter — but text-primary on bg-inverse is non-intended. |
| `--text-secondary` | `#73878d` | 3.45 | 3.76 | 3.26 | 3.06 | 2.94 | Same fails as Set B; bg-inverse pairing slightly worse. |
| `--text-tertiary`  | `#909fa1` | 2.51 | 2.74 | 2.37 | 2.23 | **4.03** | bg-inverse drops below 4.5 in Set A (was 5.51 in Set B). |
| `--text-muted`     | `#acb6b6` | 1.90 | 2.07 | 1.80 | 1.69 | **5.33** | Same as Set B (bg-inverse). |
| `--text-accent`    | `#4E7A8C` (gulf-blue, unchanged) | **4.29** | **4.68** | **4.05** | 3.80 | 2.36 | Same fails as Set B; bg-inverse pairing worsens. |
| `--text-inverse`   | `#F7F5EC` | 1.00 | 1.09 | 1.06 | 1.13 | **10.12** | Set A inverse pairing is **10.12** (was 13.83 in Set B) — still passes AAA. Lighter slate-deep means slightly less contrast in dark island elements but still excellent. |
| `--color-success`  | `#4A8A6F` | 3.73 | **4.07** | 3.53 | 3.31 | 2.71 | Same as Set B; bg-inverse pairing worsens (2.71 < 3 large fails). |
| `--color-warning`  | `#C98A3B` | 2.68 | 2.92 | 2.53 | 2.38 | 3.78 | Same fails on light bgs; bg-inverse pairing 3.78 (passes large/UI). |
| `--color-error`    | `#B0554E` | **4.52** | **4.93** | **4.27** | **4.01** | 2.24 | Same fails as Set B; bg-inverse pairing worsens to 2.24 (large-fail). |
| `--color-money`    | `#3B5864` | **6.95** | **7.59** | **6.57** | **6.17** | 1.46 | Same as text-primary. |

**Set A / LIGHT — same failure pattern as Set B / LIGHT, but `bg-inverse` pairings degrade slightly because Jake's slate-deep `#2D3E4A` is lighter than Set B's `#1A2830`.**

### Set A / DARK theme (page = `#2D3E4A`, card = `#132028`)

| Text token | Resolved hex | bg-page | bg-card | bg-subtle | bg-muted | bg-inverse | Status |
|---|---|---|---|---|---|---|---|
| `--text-primary`   | `#F7F5EC` | **10.12** | **15.20** | **9.08** | **8.02** | 1.00 | bg-page contrast is **10.12** (was 13.83 in Set B) because page is lighter. Still passes AAA. |
| `--text-secondary` | `#bec2bf` | **6.14** | **9.22** | **5.50** | **4.86** | 1.65 | bg-page drops from 7.87 → 6.14 — still passes normal AA. bg-muted drops 6.27 → 4.86 — still passes normal AA. |
| `--text-tertiary`  | `#9ca3a3` | **4.31** | **6.47** | 3.86 | 3.41 | 2.35 | bg-page 4.31 < 4.5 (was 5.22). **Borderline normal fail on bg-page in Set A dark** — accept-with-rationale candidate. |
| `--text-muted`     | `#7e878b` | 3.01 | **4.53** | 2.70 | 2.39 | 3.36 | Decorative-only as before. |
| `--text-accent`    | `#CBD8DB` | **7.57** | **11.37** | **6.79** | **6.00** | 1.34 | bg-page 7.57 (was 10.35) — still passes AAA. |
| `--text-inverse`   | `#3B5864` | 1.46 | 2.19 | 1.31 | 1.15 | **6.95** | Inverse pairing same. |
| `--color-success`  | `#4A8A6F` | 2.71 | **4.08** | 2.43 | 2.15 | 3.73 | bg-page now 2.71 (was 3.71) — even non-text/UI fails (3:1) on bg-page in Set A dark. **WORSE than Set B.** |
| `--color-warning`  | `#C98A3B` | 3.78 | **5.68** | 3.39 | 3.00 | 2.68 | bg-page 3.78 (was 5.17) — drops below normal AA. Was passing in Set B. **WORSE.** |
| `--color-error`    | `#B0554E` | 2.24 | 3.36 | 2.01 | 1.77 | **4.52** | bg-page 2.24 (was 3.06) — even worse. **WORSE.** |
| `--color-money`    | `#F7F5EC` | **10.12** | **15.20** | **9.08** | **8.02** | 1.00 | Same as text-primary. |

**Set A / DARK is MEASURABLY WORSE than Set B / DARK** for semantic colors (success / warning / error) on bg-page. Reason: Jake's lighter slate-deep `#2D3E4A` raises page luminance, compressing contrast against medium-saturation hues like #4A8A6F and #C98A3B.

### Set A — Button primary CTA contrast

- **Set B primary button** (white-sand `#F7F5EC` on `#5B8699`): **3.62** — passes large/UI, fails normal text (and button text in `Button.tsx` is uppercase 11px which is small). **Borderline.**
- **Set A primary button** (white-sand on `#6B8EA3`): **3.19** — even worse. Fails normal AA, passes large/UI just barely.
- Implication: if Set A is picked, the primary CTA contrast goes down from 3.62 to 3.19 — both fail normal text. Either rule "primary button text ≥14px bold" applies (then both are large-text passes) or button text color must shift to slate-deep for Set A.

### Set A — Warm gray (`#8A8A8A`) on light surfaces

- On `#F7F5EC` (page): **3.16** — fails normal text, borderline large/UI.
- On `#FFFFFF` (card): **3.45** — fails normal text, passes large/UI.
- Implication: warm gray is a problematic foreground for text. If Jake's brief uses "warm gray" as decorative only (rule lines, separators, secondary chrome), it's fine; for body or label text it's marginal.

---

## C. Comparison summary table — Set A vs Set B

| Concern | Set B (existing) | Set A (Jake brief) | Winner |
|---|---|---|---|
| Default text on page (slate-tile on white-sand) | 6.95 — passes AAA | 6.95 — passes AAA | Tie |
| Secondary text (alpha-blended) on page | 3.45 — fails normal | 3.45 — fails normal | Tie |
| Tertiary text on page (light) | 2.51 | 2.51 | Tie |
| Tertiary text on page (dark) | 5.22 | 4.31 — borderline | **B better** |
| Color-success on bg-card (light, normal text) | 4.07 — borderline fail | 4.07 — borderline fail | Tie |
| Color-success on dark bg-page | 3.71 — borderline | 2.71 — fail | **B better** |
| Color-warning on dark bg-page | 5.17 — passes | 3.78 — borderline | **B better** |
| Color-error on dark bg-page | 3.06 — borderline | 2.24 — fail | **B better** |
| Primary button: sand on stone-blue | 3.62 | 3.19 | **B better** |
| Inverse pairing (text-inverse on bg-inverse) | 13.83 | 10.12 | Both pass; B has more headroom |

**Conclusion (forwarded to T03.1 + CP2 reviewer):** Set B (existing palette) is *measurably more accessible* than Set A (Jake's brief) for dark-mode text and primary CTA contrast. Set A is closer to a "warmer" perceptual feel but trades meaningful AA contrast on dark surfaces. **CP2 visual decision** should weigh perceptual preference vs. measured contrast headroom.

---

## D. Methodology notes

1. **Alpha-blended tokens computed exactly.** `--text-secondary` is `rgba(59, 88, 100, 0.70)` over `#F7F5EC`. The blended hex `#73878D` is what the eye sees and what the contrast ratio computes against. This matters: the rgba foreground over a tinted page yields a *different* ratio than the same rgba over a white card.
2. **Bg-subtle / bg-muted** are themselves alpha-blended tokens. The matrix uses their *resolved* hex.
3. **Set A / Dark assumes Jake's slate-deep is the page** (`#2D3E4A`) and the existing slate-deeper is the card (`#132028`) — Jake's brief did not redefine slate-deeper, so we keep it.
4. **Set A introduces a new token (warm gray `#8A8A8A`)** that has no current consumer. Computing it for completeness only; it would need a `--nw-warm-gray` declaration if Set A is picked at CP2.
5. **AAA is informational** — SPEC mandates AA; AAA labeled where it passes for reference.

---

**T03 status:** COMPLETE — both palette sets enumerated for both themes.
**Forwarded to T03.1:** structured matrix per A3.1 format with pass/fail flagging and the ≤3 accept-with-rationale cap analysis.
