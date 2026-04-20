# Legacy token → Slate semantic mapping

Reference for DES-H-1 migration (Phase E). Every occurrence in `src/**/*.tsx`
of a legacy utility should map to the corresponding Slate/semantic token so
both light and dark themes resolve correctly.

## Text

| Legacy utility | Replacement | Notes |
|---|---|---|
| `text-cream` | `text-brand-default` OR inline `style={{ color: "var(--text-primary)" }}` | primary body/heading color |
| `text-cream-dim` | `text-brand-muted` OR inline `style={{ color: "var(--text-secondary)" }}` | de-emphasized text |
| `text-cream-muted` | inline `style={{ color: "var(--text-muted)" }}` | very low contrast (captions) |

## Background

| Legacy | Replacement | Notes |
|---|---|---|
| `bg-brand` | `bg-brand-default` | main surface |
| `bg-brand-surface` | `bg-brand-default` | alias |
| `bg-brand-card` | keeps (aliased to `--color-white` in light, `--bg-card` in dark) | document / card |
| `bg-brand-elevated` | keeps (maps to `--bg-subtle`) | elevated panel |
| `bg-teal` | `bg-nw-stone-blue` | brand accent fill |

## Borders

| Legacy | Replacement |
|---|---|
| `border-brand-border` | `border-brand-default` |
| `border-brand-row-border` | `border-brand-default` |
| `border-teal` | `border-nw-stone-blue` |

## Status colors

| Legacy | Replacement |
|---|---|
| `bg-status-success` | inline `style={{ background: "var(--nw-success)", color: "var(--nw-white-sand)" }}` |
| `text-status-success` | inline `style={{ color: "var(--nw-success)" }}` |
| `bg-status-danger` | `style={{ background: "var(--nw-danger)", color: "var(--nw-white-sand)" }}` |
| `text-status-danger` | `style={{ color: "var(--nw-danger)" }}` |
| `bg-status-warning` | `style={{ background: "var(--nw-warn)" }}` |
| `text-status-warning` | `style={{ color: "var(--nw-warn)" }}` |

## Raw tailwind grays (should NOT appear in finished UI)

| Legacy | Replacement |
|---|---|
| `bg-gray-500/20 text-gray-300` | neutral badge: `style={{ background: "var(--bg-elevated)", color: "var(--text-secondary)" }}` |
| `bg-blue-500/20 text-blue-300` | info badge: `style={{ background: "var(--nw-oceanside)", color: "var(--nw-white-sand)" }}` |
| `bg-amber-500/20 text-amber-300` | warn badge: `style={{ background: "var(--nw-warn)", color: "var(--nw-slate-deepest)" }}` |
| `bg-green-500/20 text-green-300` | success badge: `style={{ background: "var(--nw-success)", color: "var(--nw-white-sand)" }}` |
| `bg-purple-500/20 text-purple-300` | accent badge: `style={{ background: "var(--nw-stone-blue)", color: "var(--nw-white-sand)" }}` |

## Document surfaces (exception — Q1 decision)

`bg-white` on PDF / DOCX / image preview containers stays — document
surfaces render paper-white in both themes. Each usage is commented
inline so a drive-by change doesn't revert the intent.

## Deprecation timeline (Phase E)

1. **Wave E.2**: auth pages (`/login`, `/signup`, `/forgot-password`, `/onboard`,
   public header + footer).
2. **Wave E.3**: `/settings/**` + admin sidebar.
3. **Wave E.4**: `/change-orders/**`, `/jobs/[id]/change-orders/**`,
   `/jobs/[id]/purchase-orders/**`.
4. **Wave E.5**: `/draws/**`.
5. **Wave E.6**: dashboard, vendors, jobs, internal-billings, remaining bits.
6. **Wave E.7**: delete legacy namespaces from `tailwind.config.ts` —
   `brand.*`, `cream.*`, `teal.*`, `brass.*`, `nightwork.*`, `status.*`.

After Wave E.6, `grep -rn "text-cream\|bg-teal\|border-teal\|bg-status-"
src --include="*.tsx"` must return zero meaningful results.
