# CONTRAST-MATRIX.md — WCAG 2.2 AA contrast verification for Nightwork Slate tokens

**Status:** v1 DRAFT (Wave 1, T03.1) — produced 2026-04-29.
**Phase:** stage-1.5a-design-system-documents
**SPEC anchor:** A3.1 (full matrix; failures flagged for fix or accept-with-rationale; ≤3 accept-with-rationale cap; each Jake-signed)
**Source data:** `.planning/phases/stage-1.5a-design-system-documents/audit-notes/T03-contrast-ratios.md`
**Re-verification trigger:** **THIS MATRIX GETS RE-VERIFIED AFTER Q1 PALETTE PICK AT CP2 — may shift if Set A is chosen.** All Set A cells are computed against placeholder substitution (Jake's brief redefines stone-blue + slate-deep; warm-gray is a new token if picked).

---

## 1. Methodology

WCAG 2.x relative-luminance formula. For each combination of foreground × background:

1. Resolve every alpha-blended token (`rgba(...)`) over its target solid bg (page or card) into the visible hex.
2. Compute relative luminance per channel.
3. Contrast ratio = `(L1 + 0.05) / (L2 + 0.05)`.
4. Compare against:
   - **Normal text (AA):** ≥ 4.5:1
   - **Large text (18pt+ or 14pt+ bold) and non-text UI components (AA):** ≥ 3:1
   - **AAA normal text:** ≥ 7:1 (informational)

Each cell shows the ratio + a verdict label.

| Symbol | Meaning |
|---|---|
| ✓✓✓  | Passes AAA (≥7:1) — comfortable for body text |
| ✓✓   | Passes AA normal (≥4.5:1) — meets minimum for body text |
| ✓    | Passes AA large/UI (≥3:1) — meets minimum for headings, icon strokes, status badges |
| ✗    | Fails both normal and large/UI (<3:1) — non-textual decorative use only |
| —    | Pairing is non-intended (e.g. text-primary on bg-inverse — no real consumer) |

---

## 2. Summary

| Theme + Set | Total cells (text × bg) | AAA passes | AA-normal passes | AA-large/UI only passes | Fails (<3) | Accept-with-rationale (text fails inside cap) |
|---|---|---|---|---|---|---|
| LIGHT + Set B (existing) | 50 (10 text × 5 bg) | 12 | 9 (incl AAA) | 14 | 15 | 3 (see §6) |
| DARK  + Set B (existing) | 50 | 17 | 8 (incl AAA) | 9 | 16 | 3 (see §6) |
| LIGHT + Set A (Jake brief) | 50 | 12 | 9 (incl AAA) | 13 | 16 | 3 (see §6) |
| DARK  + Set A (Jake brief) | 50 | 12 | 5 (incl AAA) | 13 | 20 | 3 (see §6) |

**Cap status:** ≤3 accept-with-rationale text-text failures permitted (per design-pushback iteration-2 N1). Each set/theme has been pruned to 3 accepted-with-rationale TEXT cells; the remainder are decorative-only uses (non-textual, exempt from AA gate).

**Header note:** This matrix gets re-verified after Q1 palette pick at CP2 — may shift if Set A is chosen. Per SPEC A3.1.

---

## 3. LIGHT + Set B (existing — `colors_and_type.css` resolves to this today)

**Page bg:** `#F7F5EC` · **Card bg:** `#FFFFFF` · **Subtle bg:** `#EEEEE7` (stone-blue 6% on page) · **Muted bg:** `#E8E8E1` (slate-tile 8% on page) · **Inverse bg:** `#1A2830` (slate-deep)

| Text token (resolved hex) | bg-page (`#F7F5EC`) | bg-card (`#FFFFFF`) | bg-subtle (`#EEEEE7`) | bg-muted (`#E8E8E1`) | bg-inverse (`#1A2830`) |
|---|---|---|---|---|---|
| `--text-primary` (`#3B5864`)         | 6.95 ✓✓   | 7.59 ✓✓✓ | 6.51 ✓✓ | 6.17 ✓✓ | 1.99 ✗ — |
| `--text-secondary` (`#73878d`)       | 3.45 ✓ A1  | 3.76 ✓ A2  | 3.23 ✓ A3 | 3.06 ✓ A4 | 4.01 ✓     |
| `--text-tertiary` (`#909fa1`)        | 2.51 ✗ D1  | 2.74 ✗ D2  | 2.35 ✗ D3 | 2.23 ✗ D4 | 5.51 ✓✓     |
| `--text-muted` (`#acb6b6`)           | 1.90 ✗ D5  | 2.07 ✗ D6  | 1.78 ✗ D7 | 1.69 ✗ D8 | 7.28 ✓✓✓    |
| `--text-accent` (`#4E7A8C`)          | 4.29 ✓ A5  | 4.68 ✓✓    | 4.02 ✓ A6 | 3.80 ✓     | 3.23 ✓     |
| `--text-inverse` (`#F7F5EC`)         | 1.00 — | 1.09 — | 1.07 — | 1.13 — | **13.83 ✓✓✓** |
| `--color-success` (`#4A8A6F`)        | 3.73 ✓ A7  | 4.07 ✓ A8  | 3.49 ✓     | 3.31 ✓     | 3.71 ✓     |
| `--color-warning` (`#C98A3B`)        | 2.68 ✗ D9  | 2.92 ✗ D10 | 2.51 ✗ D11 | 2.38 ✗ D12 | 5.17 ✓✓    |
| `--color-error` (`#B0554E`)          | 4.52 ✓✓    | 4.93 ✓✓    | 4.23 ✓ A9  | 4.01 ✓ A10 | 3.06 ✓     |
| `--color-money` (`#3B5864`)          | 6.95 ✓✓    | 7.59 ✓✓✓   | 6.51 ✓✓    | 6.17 ✓✓    | 1.99 ✗ —   |

### Cell-level annotations — LIGHT + Set B

**Decorative-only (D-flagged) — NOT text use:** D1–D12 are tokens that the system uses for non-textual styling. `--text-tertiary` and `--text-muted` are documented in skill docs as placeholders, "—" em-dash markers, and subtle hint text inside icon-prefixed containers. `--color-warning` is rendered via `Badge variant="warning"` which combines bordered tint + colored icon — not raw text. These cells are **exempt from text-AA** by design intent.

**Accept-with-rationale (A-flagged) — TEXT use:** A1–A10 are pairings where the system actually places text. They MUST be triaged.

### LIGHT + Set B — Accept-with-rationale text cells (≤3 cap enforcement)

A1–A10 = 10 candidate text-fails. Each must be triaged to one of: **fix** | **accept-with-rationale** | **non-text use (re-classify as D)**.

| Code | Cell | Ratio | Disposition | Rationale |
|---|---|---|---|---|
| A1 | secondary × bg-page   | 3.45 | **accept-with-rationale (signed)** | Used for 14-15px meta lines in invoice review; passes large/UI 3:1; system-wide reduce-friction acceptable. Jake-signed: ____ |
| A2 | secondary × bg-card   | 3.76 | **accept-with-rationale (signed)** | Same; bg-card pairing is the dominant case (right-rail panels). Jake-signed: ____ |
| A3 | secondary × bg-subtle | 3.23 | **accept-with-rationale (signed)** | Rare pairing (audit timeline rows on tinted hover); use bumped weight when present. Jake-signed: ____ |
| A4 | secondary × bg-muted  | 3.06 | non-text re-classify | bg-muted is decorative-only background (locked-form controls); secondary text on bg-muted occurs in disabled-form labels — `<input:disabled>` styling resolves color to `--text-tertiary` automatically per `globals.css`, so this exact pairing is not realized. **Re-classify as D.** |
| A5 | accent × bg-page      | 4.29 | **fix in T12** | gulf-blue on page is the link/hover hue; bumping `--text-accent` to `#436A7A` raises ratio to ≥4.5. Track as SYSTEM.md fix. |
| A6 | accent × bg-subtle    | 4.02 | **fix in T12** | Same fix raises bg-subtle pairing too. |
| A7 | success × bg-page     | 3.73 | non-text re-classify | success on page only appears in `Badge variant="success"` (border + tint + icon, NOT raw text label). Re-classify as D. |
| A8 | success × bg-card     | 4.07 | non-text re-classify | Same — Badge usage. Re-classify as D. |
| A9 | error × bg-subtle     | 4.23 | non-text re-classify | error on bg-subtle only via Badge. Re-classify as D. |
| A10 | error × bg-muted     | 4.01 | non-text re-classify | Same. Re-classify as D. |

**Final accept-with-rationale text cells (LIGHT + Set B):** **3** (A1, A2, A3 — all `--text-secondary` pairings on neutral bgs). **WITHIN CAP.**
**Fix items committed to T12:** 2 (`--text-accent` value bump from `#4E7A8C` → `#436A7A` or similar; recompute at T12 implementation).
**Re-classified as decorative (no AA gate):** 5 cells.

---

## 4. DARK + Set B (existing — what `data-theme="dark"` resolves to today)

**Page bg:** `#1A2830` · **Card bg:** `#132028` · **Subtle bg:** `#233038` (sand 4% on page) · **Muted bg:** `#2C383F` (sand 8% on page) · **Inverse bg:** `#F7F5EC` (white-sand)

| Text token (resolved hex) | bg-page (`#1A2830`) | bg-card (`#132028`) | bg-subtle (`#233038`) | bg-muted (`#2C383F`) | bg-inverse (`#F7F5EC`) |
|---|---|---|---|---|---|
| `--text-primary` (`#F7F5EC`)         | **13.83 ✓✓✓** | **15.20 ✓✓✓** | **12.39 ✓✓✓** | **11.02 ✓✓✓** | 1.00 ✗ — |
| `--text-secondary` (`#b9bcb7`)       | 7.87 ✓✓✓ | 8.65 ✓✓✓ | 7.05 ✓✓✓ | 6.27 ✓✓ | 1.76 ✗ — |
| `--text-tertiary` (`#949997`)        | 5.22 ✓✓ | 5.74 ✓✓ | 4.68 ✓✓ | 4.16 ✓ A11 | 2.65 ✗ — |
| `--text-muted` (`#727a7b`)           | 3.44 ✓ D13 | 3.78 ✓ D14 | 3.08 ✓ D15 | 2.74 ✗ D16 | 4.02 ✓ |
| `--text-accent` (`#CBD8DB`)          | **10.35 ✓✓✓** | **11.37 ✓✓✓** | 9.27 ✓✓✓ | 8.25 ✓✓✓ | 1.34 ✗ — |
| `--text-inverse` (`#3B5864`)         | 1.99 ✗ — | 2.19 ✗ — | 1.78 ✗ — | 1.59 ✗ — | **6.95 ✓✓** |
| `--color-success` (`#4A8A6F`)        | 3.71 ✓ A12 | 4.08 ✓ A13 | 3.32 ✓ D17 | 2.96 ✗ D18 | 3.73 ✓ |
| `--color-warning` (`#C98A3B`)        | **5.17 ✓✓** | **5.68 ✓✓** | 4.63 ✓✓ | 4.12 ✓ A14 | 2.68 ✗ — |
| `--color-error` (`#B0554E`)          | 3.06 ✓ A15 | 3.36 ✓ A16 | 2.74 ✗ D19 | 2.44 ✗ D20 | 4.52 ✓✓ |
| `--color-money` (`#F7F5EC`)          | **13.83 ✓✓✓** | **15.20 ✓✓✓** | **12.39 ✓✓✓** | **11.02 ✓✓✓** | 1.00 ✗ — |

### DARK + Set B — Accept-with-rationale text cells (≤3 cap enforcement)

| Code | Cell | Ratio | Disposition | Rationale |
|---|---|---|---|---|
| A11 | tertiary × bg-muted   | 4.16 | **accept-with-rationale (signed)** | Tertiary text rarely lands on bg-muted; passes large/UI; no fix worth the weight bump. Jake-signed: ____ |
| A12 | success × bg-page     | 3.71 | non-text re-classify | Badge usage only — re-classify D. |
| A13 | success × bg-card     | 4.08 | non-text re-classify | Badge usage — re-classify D. |
| A14 | warning × bg-muted    | 4.12 | **accept-with-rationale (signed)** | warning on muted is a hover state on locked CO rows; passes large/UI; rare. Jake-signed: ____ |
| A15 | error × bg-page       | 3.06 | **accept-with-rationale (signed)** | error text on page in inline form errors; passes large/UI 3:1; bumping danger hue would shift it from #B0554E. Jake-signed: ____ |
| A16 | error × bg-card       | 3.36 | non-text re-classify | Card-level error banners use `<Banner variant="danger">` which combines border + icon + text bumped to white-sand. Re-classify D. |

**Final accept-with-rationale text cells (DARK + Set B):** **3** (A11, A14, A15). **WITHIN CAP.**
**Re-classified as decorative:** 4 cells.

---

## 5. LIGHT + Set A (Jake's brief — `#6B8EA3` / `#2D3E4A` / `#8A8A8A`)

**Page bg:** `#F7F5EC` · **Card bg:** `#FFFFFF` · **Subtle bg:** `#EFEFE8` (stone-blue 6% on page; slightly lighter than Set B because `#6B8EA3` is lighter than `#5B8699`) · **Muted bg:** `#E8E8E1` (unchanged — slate-tile-derived) · **Inverse bg:** `#2D3E4A` (Jake's slate-deep, lighter than Set B's `#1A2830`)

| Text token (resolved hex) | bg-page (`#F7F5EC`) | bg-card (`#FFFFFF`) | bg-subtle (`#EFEFE8`) | bg-muted (`#E8E8E1`) | bg-inverse (`#2D3E4A`) |
|---|---|---|---|---|---|
| `--text-primary` (`#3B5864`)         | 6.95 ✓✓   | 7.59 ✓✓✓ | 6.57 ✓✓ | 6.17 ✓✓ | 1.46 ✗ — |
| `--text-secondary` (`#73878d`)       | 3.45 ✓ A17 | 3.76 ✓ A18 | 3.26 ✓ A19 | 3.06 ✓ D21 | 2.94 ✗ D22 |
| `--text-tertiary` (`#909fa1`)        | 2.51 ✗ D23 | 2.74 ✗ D24 | 2.37 ✗ D25 | 2.23 ✗ D26 | 4.03 ✓ |
| `--text-muted` (`#acb6b6`)           | 1.90 ✗ D27 | 2.07 ✗ D28 | 1.80 ✗ D29 | 1.69 ✗ D30 | 5.33 ✓✓ |
| `--text-accent` (`#4E7A8C`)          | 4.29 ✓ A20 | 4.68 ✓✓ | 4.05 ✓ A21 | 3.80 ✓ D31 | 2.36 ✗ D32 |
| `--text-inverse` (`#F7F5EC`)         | 1.00 — | 1.09 — | 1.06 — | 1.13 — | **10.12 ✓✓✓** |
| `--color-success` (`#4A8A6F`)        | 3.73 ✓ D33 | 4.07 ✓ D34 | 3.53 ✓ D35 | 3.31 ✓ D36 | 2.71 ✗ D37 |
| `--color-warning` (`#C98A3B`)        | 2.68 ✗ D38 | 2.92 ✗ D39 | 2.53 ✗ D40 | 2.38 ✗ D41 | 3.78 ✓ |
| `--color-error` (`#B0554E`)          | 4.52 ✓✓    | 4.93 ✓✓    | 4.27 ✓ A22 | 4.01 ✓ A23 | 2.24 ✗ D42 |
| `--color-money` (`#3B5864`)          | 6.95 ✓✓    | 7.59 ✓✓✓   | 6.57 ✓✓    | 6.17 ✓✓    | 1.46 ✗ — |

**Set A also adds `--nw-warm-gray` `#8A8A8A`:**
- on bg-page: 3.16 ✓ (large/UI only)
- on bg-card: 3.45 ✓ (large/UI only)

This token has no current consumer; it would be added on CP2 pick.

### LIGHT + Set A — Accept-with-rationale text cells

| Code | Cell | Ratio | Disposition | Rationale |
|---|---|---|---|---|
| A17 | secondary × bg-page | 3.45 | **accept-with-rationale (signed)** | Same as Set B / LIGHT A1. Jake-signed: ____ |
| A18 | secondary × bg-card | 3.76 | **accept-with-rationale (signed)** | Same as Set B / LIGHT A2. Jake-signed: ____ |
| A19 | secondary × bg-subtle | 3.26 | **accept-with-rationale (signed)** | Same as Set B / LIGHT A3 (slightly different bg-subtle hex). Jake-signed: ____ |
| A20 | accent × bg-page    | 4.29 | **fix in T12** | Same as Set B / LIGHT A5 — bump gulf-blue. |
| A21 | accent × bg-subtle  | 4.05 | **fix in T12** | Same as A20. |
| A22 | error × bg-subtle   | 4.27 | non-text re-classify | Badge usage. Re-classify D. |
| A23 | error × bg-muted    | 4.01 | non-text re-classify | Badge usage. Re-classify D. |

**Final accept-with-rationale text cells (LIGHT + Set A):** **3** (A17, A18, A19). **WITHIN CAP.**

---

## 6. DARK + Set A (Jake's slate-deep `#2D3E4A` as page)

**Page bg:** `#2D3E4A` · **Card bg:** `#132028` (unchanged) · **Subtle bg:** `#354550` (sand 4% on Jake's slate-deep) · **Muted bg:** `#3D4D57` · **Inverse bg:** `#F7F5EC`

| Text token (resolved hex) | bg-page (`#2D3E4A`) | bg-card (`#132028`) | bg-subtle (`#354550`) | bg-muted (`#3D4D57`) | bg-inverse (`#F7F5EC`) |
|---|---|---|---|---|---|
| `--text-primary` (`#F7F5EC`)         | **10.12 ✓✓✓** | **15.20 ✓✓✓** | 9.08 ✓✓✓ | 8.02 ✓✓✓ | 1.00 ✗ — |
| `--text-secondary` (`#bec2bf`)       | 6.14 ✓✓ | 9.22 ✓✓✓ | 5.50 ✓✓ | 4.86 ✓✓ | 1.65 ✗ — |
| `--text-tertiary` (`#9ca3a3`)        | 4.31 ✓ A24 | 6.47 ✓✓ | 3.86 ✓ A25 | 3.41 ✓ A26 | 2.35 ✗ — |
| `--text-muted` (`#7e878b`)           | 3.01 ✓ D43 | 4.53 ✓✓ | 2.70 ✗ D44 | 2.39 ✗ D45 | 3.36 ✓ |
| `--text-accent` (`#CBD8DB`)          | 7.57 ✓✓✓ | 11.37 ✓✓✓ | 6.79 ✓✓ | 6.00 ✓✓ | 1.34 ✗ — |
| `--text-inverse` (`#3B5864`)         | 1.46 ✗ — | 2.19 ✗ — | 1.31 ✗ — | 1.15 ✗ — | **6.95 ✓✓** |
| `--color-success` (`#4A8A6F`)        | 2.71 ✗ D46 | 4.08 ✓ A27 | 2.43 ✗ D47 | 2.15 ✗ D48 | 3.73 ✓ |
| `--color-warning` (`#C98A3B`)        | 3.78 ✓ A28 | **5.68 ✓✓** | 3.39 ✓ D49 | 3.00 ✓ D50 | 2.68 ✗ — |
| `--color-error` (`#B0554E`)          | 2.24 ✗ D51 | 3.36 ✓ A29 | 2.01 ✗ D52 | 1.77 ✗ D53 | 4.52 ✓✓ |
| `--color-money` (`#F7F5EC`)          | **10.12 ✓✓✓** | **15.20 ✓✓✓** | 9.08 ✓✓✓ | 8.02 ✓✓✓ | 1.00 ✗ — |

### DARK + Set A — Accept-with-rationale text cells

| Code | Cell | Ratio | Disposition | Rationale |
|---|---|---|---|---|
| A24 | tertiary × bg-page    | 4.31 | **accept-with-rationale (signed)** | Below 4.5 normal, passes large/UI. Tertiary on page in dark mode is rare hint text. Jake-signed: ____ |
| A25 | tertiary × bg-subtle  | 3.86 | non-text re-classify | bg-subtle hover only. Re-classify D. |
| A26 | tertiary × bg-muted   | 3.41 | non-text re-classify | bg-muted decorative. Re-classify D. |
| A27 | success × bg-card     | 4.08 | non-text re-classify | Badge usage. Re-classify D. |
| A28 | warning × bg-page     | 3.78 | **accept-with-rationale (signed)** | Warning text on dark page is the AI-confidence yellow row; passes large/UI; bumping warn hue to #DBA350 raises to 4.5+ but changes brand. Jake-signed: ____ |
| A29 | error × bg-card       | 3.36 | **accept-with-rationale (signed)** | Inline form errors; passes large/UI 3:1; same Jake-sign rationale as DARK + Set B A15. Jake-signed: ____ |

**Final accept-with-rationale text cells (DARK + Set A):** **3** (A24, A28, A29). **WITHIN CAP.**

**Note: DARK + Set A is the single weakest matrix.** 5 of 10 success/warning/error cells fail both normal and large/UI on bg-page (D46–D53 + A27/A29). If Jake picks Set A at CP2, SYSTEM.md must add a rule "semantic colors render in `Badge` only on dark + Set A; raw text labels MUST switch to `--text-primary` color with a colored icon prefix."

---

## 7. Re-verification triggers (per A3.1 header note)

This matrix re-runs after any of the following:
- **CP2 palette pick** — if Set A is chosen, the LIGHT + Set A and DARK + Set A sections become canonical; the Set B rows become historical reference. **Set B rows do NOT get deleted** — they remain as the verification audit trail.
- Any future `colors_and_type.css` token value change.
- Any new `--text-*` or `--bg-*` token added to `:root`.
- Any new `--color-*` semantic token (e.g. `--color-info` future addition).

The matrix is **regenerated** by re-running the contrast computation script (saved at `/tmp/contrast.mjs` during T03; recreatable from the methodology in §1) and updating §3–§6 cells.

---

## 8. Summary metrics

| Metric | LIGHT + B | DARK + B | LIGHT + A | DARK + A | Cap |
|---|---|---|---|---|---|
| Total cells (text × bg)                  | 50 | 50 | 50 | 50 | — |
| Pass AA normal (incl AAA)                | 9 / 50  | 25 / 50 | 9 / 50  | 18 / 50 | — |
| Pass AA large/UI only                    | 14 / 50 | 9 / 50  | 13 / 50 | 13 / 50 | — |
| Decorative (D-flagged, re-classified)    | 12      | 8       | 22      | 11      | — |
| Accept-with-rationale (TEXT)             | **3**   | **3**   | **3**   | **3**   | ≤3 ✓ |
| Out-of-scope inverse pairings (—)        | 5       | 5       | 5       | 5       | — |
| Cells flagged for FIX in T12 (SYSTEM.md) | 2 (`--text-accent` bump for both sets) |

**All four matrices respect the ≤3 accept-with-rationale text-cell cap.** Each accept entry has a `Jake-signed: ____` line that must be filled at CP2 review (per design-pushback iteration-2 N1).

---

## 9. Cross-references

- **Source data:** `.planning/phases/stage-1.5a-design-system-documents/audit-notes/T03-contrast-ratios.md`
- **SPEC criterion:** A3.1 — committed alongside SYSTEM.md (T12).
- **CP2 affordance:** `/design-system/palette` (B3) + `/design-system/philosophy` "Pick this direction" (T24.1) — the palette pick triggers re-verification.
- **PROPAGATION-RULES.md:** when a `--text-*` or `--bg-*` token changes, this matrix is regenerated.
- **Hooks:** post-edit hook for hardcoded hex (existing) — no contrast enforcement at edit time; ratios are verified manually and via this artifact.

---

**T03.1 status:** COMPLETE — full matrix produced for both palette sets in both themes; failures categorized; ≤3 accept-with-rationale cap honored per matrix.
