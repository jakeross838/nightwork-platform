# Stage 1.5a — Pre-shadcn-init backups

**Created:** 2026-04-29 (PRE-T07)
**Trigger:** Plan task PRE-T07 — backup config files before Jake runs `npx shadcn-ui@latest init` interactively in T07.
**Risk addressed:** RP1 / RP2 — `npx shadcn-ui@latest init` may modify `tailwind.config.ts`, `package.json`, `package-lock.json`, and may inject CSS into `globals.css` in ways that conflict with the existing Slate token system or the `nw-*` color extensions.

---

## What's in this folder

These are exact copies of the canonical config files at the moment Wave 1 audits completed and immediately before T07 (Jake-interactive shadcn init):

| File | Source path | Bytes | Preserved timestamp |
|---|---|---|---|
| `tailwind.config.ts`   | `tailwind.config.ts` (root)              | 2 831    | 2026-04-20 14:37 |
| `globals.css`          | `src/app/globals.css`                    | 6 851    | 2026-04-24 13:18 |
| `colors_and_type.css`  | `src/app/colors_and_type.css`            | 6 808    | 2026-04-20 10:55 |
| `package.json`         | `package.json` (root)                    | 1 469    | 2026-04-27 11:23 |
| `package-lock.json`    | `package-lock.json` (root)               | 447 848  | 2026-04-27 11:29 |

Copy command used (`cp -p` preserves mtime + access mode):

```bash
cp -p tailwind.config.ts .planning/phases/stage-1.5a-design-system-documents/_backups/tailwind.config.ts
cp -p src/app/globals.css .planning/phases/stage-1.5a-design-system-documents/_backups/globals.css
cp -p src/app/colors_and_type.css .planning/phases/stage-1.5a-design-system-documents/_backups/colors_and_type.css
cp -p package.json .planning/phases/stage-1.5a-design-system-documents/_backups/package.json
cp -p package-lock.json .planning/phases/stage-1.5a-design-system-documents/_backups/package-lock.json
```

---

## Why each file is backed up

### `tailwind.config.ts`

`npx shadcn-ui@latest init` rewrites this file to add:
- `darkMode: ["class"]` (we already have `["class", '[data-theme="dark"]']` — shadcn may overwrite with the simpler form, dropping our custom selector).
- `theme.extend.colors` with shadcn-named tokens (`background`, `foreground`, `card`, `card-foreground`, `popover`, `popover-foreground`, `primary`, `primary-foreground`, `secondary`, `secondary-foreground`, `muted`, `muted-foreground`, `accent`, `accent-foreground`, `destructive`, `destructive-foreground`, `border`, `input`, `ring`).
- `theme.extend.borderRadius.{lg,md,sm}` (calc()-based off `--radius`).
- `theme.container` and animations (e.g. `accordion-down`, `accordion-up`).

Risk: shadcn's color tokens may CONFLICT with our existing `nw-*` namespace or remove our `colors.nw-*` block when rewriting. T11 build pass + visual check after T07 catches; if breakage, restore from this backup and reapply shadcn additions surgically.

### `src/app/globals.css`

shadcn init injects:
- A new `:root` block with `--background`, `--foreground`, `--card`, `--popover`, `--primary`, `--secondary`, `--muted`, `--accent`, `--destructive`, `--border`, `--input`, `--ring`, `--radius` (HSL form).
- A `.dark` selector block with the dark-mode counterparts (HSL form).
- `* { @apply border-border }` base rule.
- `body { @apply bg-background text-foreground; font-feature-settings: ... }` rule.

Risk: shadcn's `:root` block may add new vars or duplicate ones we already have. The HSL-form is alien to our existing hex-based `--nw-*` tokens; the merging may produce style conflicts. The Slate `disabled:` form-control rules in our globals.css must not be overwritten.

### `src/app/colors_and_type.css`

shadcn init does NOT typically touch this file (it's a custom Slate-tokens file Nightwork added). Backed up for safety in case T07's CSS-vars option causes shadcn to suggest deduplication.

### `package.json` and `package-lock.json`

shadcn init runs `npm install` (or yarn/pnpm equivalent) for:
- `class-variance-authority` (latest)
- `clsx` (latest)
- `tailwind-merge` (latest)
- `lucide-react` (latest — but we'll override with `@heroicons/react` per Q12 / Jake's iconography preference; per skill rule "Heroicons outline (stroke 1.5)" + COMPONENTS.md A12.2)
- `tailwindcss-animate` (latest)

Risk: dependency conflicts with our existing pinned versions — especially around React 18, Next.js 14, TypeScript 5. Backup of `package.json` + `package-lock.json` lets us revert exact versions if the new dependencies cause regressions.

---

## How to restore

If T07 / T11 / T11.5 reveals breakage:

```bash
# From repo root
cp -p .planning/phases/stage-1.5a-design-system-documents/_backups/tailwind.config.ts tailwind.config.ts
cp -p .planning/phases/stage-1.5a-design-system-documents/_backups/globals.css src/app/globals.css
cp -p .planning/phases/stage-1.5a-design-system-documents/_backups/colors_and_type.css src/app/colors_and_type.css
cp -p .planning/phases/stage-1.5a-design-system-documents/_backups/package.json package.json
cp -p .planning/phases/stage-1.5a-design-system-documents/_backups/package-lock.json package-lock.json

# Then reinstall to match restored lockfile:
npm ci

# Validate:
npm run build
```

Once restored, T07 can be re-attempted with mitigation (e.g. cherry-pick only the dependency installs from a fresh `npm install` instead of running `npx shadcn-ui@latest init` end-to-end). Document the deviation in the SUMMARY.md for the phase.

---

## What stays in git

These backups are committed to git per the `.planning/phases/**` carve-out in `.gitignore`. They will live in `.planning/phases/stage-1.5a-design-system-documents/_backups/` until the phase ships and Jake confirms post-T07 stability.

After Stage 1.5a ships AND Wave 1.1 polish completes without regression, these backups MAY be archived or deleted in a future cleanup pass — but they are kept for the duration of 1.5a and at minimum until CP2 + CP3 sign-off.

---

**PRE-T07 status:** COMPLETE — 5 files backed up; restore procedure documented.
**Next:** T07 — Jake runs `npx shadcn-ui@latest init` interactively. **HALT — awaiting Jake.**
