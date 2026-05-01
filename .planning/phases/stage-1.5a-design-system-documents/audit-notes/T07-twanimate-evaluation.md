# T07 — `tw-animate-css` evaluation outcome (per SPEC Amendment 3)

**Date:** 2026-04-29
**Action taken:** SWAPPED `tw-animate-css` → `tailwindcss-animate`.

---

## What `tw-animate-css` is

`tw-animate-css@1.4.0` was added to `dependencies` as part of `npx shadcn@latest init -d` (T07). The package's `package.json` describes itself as:

> `"description": "TailwindCSS v4.0 compatible replacement for tailwindcss-animate"`

It uses **Tailwind v4 syntax exclusively** — the `dist/tw-animate.css` file (14,880 bytes, single-line minified) is built from `@property`, `@theme inline`, and `@utility` directives. Those are all **Tailwind v4-only directives**.

## Why we can't use it

Nightwork is on **Tailwind v3.4.1** (`"tailwindcss": "^3.4.1"` in `package.json` devDependencies). Tailwind v3 does not understand `@property`, `@theme inline`, or `@utility`. Importing `tw-animate-css` into our `globals.css` under v3 either errors at build time or produces no output. shadcn 4.x's CLI ships a v4-aware default that adds `tw-animate-css`, but the project they're scaffolding into (Nightwork) is still v3.

## A2.1 Forbidden-list audit (still required)

Even though the package is incompatible at the toolchain level, the SPEC asks us to evaluate the actual CSS for bouncy/spring easing per A2.1. Reading `dist/tw-animate.css`:

- Default duration: `var(--tw-duration, .15s)` — short, standard.
- Default easing: `var(--tw-ease, ease)` — standard `ease`, NOT a custom cubic-bezier. Falls back to `ease-out` on accordion / collapsible / caret-blink.
- `caret-blink`: `1.25s ease-out infinite` — linear easing.
- `enter` keyframe: opacity + translate3d + scale3d + rotate (from start values to defaults). Linear interpolation by default.
- `exit` keyframe: same, reversed.
- Accordion/collapsible: linear height transitions.

**Verdict:** clean. No bouncy, no elastic, no overshoot. If we were on Tailwind v4 we'd keep it.

## Why we swapped to `tailwindcss-animate`

`tailwindcss-animate@1.0.7` is the **Tailwind v3-compatible original** that `tw-animate-css` descends from. Same author surface (animate-in, animate-out, fade-in/out, slide-in-from-*, zoom-in/out, accordion-down/up, etc.) produced via Tailwind v3 plugin syntax (`require("tailwindcss-animate")` registered in `tailwind.config.ts`'s `plugins` array).

It's also the plugin that shadcn primitives reference in their generated code under Tailwind v3. So when we `npx shadcn@latest add <primitive>` for combobox/calendar/drawer/tooltip/popover/hover-card later in T08, the generated components consume utility names (`animate-in`, `data-[state=open]:slide-in-from-top-1`, etc.) that `tailwindcss-animate` provides natively.

## Conformance with SPEC A2.1

`tailwindcss-animate` ships with the same base motion vocabulary — fade / slide / zoom / spin — and applies them with `ease-out` (default). No bouncy `cubic-bezier(.x, [1-9].[0-9])` patterns. Same A2.1 evaluation outcome: clean.

The `enter` and `exit` keyframes do support a `--tw-enter-rotate` default of `30deg` (and `--tw-exit-rotate` likewise), exposed as `spin-in` / `spin-out` utilities. We do NOT use those utilities anywhere in Nightwork. If a shadcn primitive ever generates a `spin-in-` utility, it'll be reviewed at T08 add-time per A2.1 (and likely deleted from the generated output as it falls under "things I never want to see again" rotational entrances).

## Implementation

1. `npm uninstall` ran implicitly when we removed `tw-animate-css` from `package.json`.
2. `npm install tailwindcss-animate` added v1.0.7.
3. `tailwind.config.ts`:
   - `plugins: [require("tailwindcss-animate")]` registered.
   - Added `accordion-down` / `accordion-up` keyframes + animation entries in `theme.extend.keyframes` and `theme.extend.animation` (these reference `var(--radix-accordion-content-height)` which Base UI / Radix provides at runtime; safe Tailwind v3 syntax).
4. `globals.css`: did NOT `@import "tw-animate-css"` (the Tailwind v4 import directive). The v3 plugin auto-injects.

## Future re-evaluation marker

When Nightwork migrates to Tailwind v4 (its own future phase), revisit `tw-animate-css`. It would replace `tailwindcss-animate` 1:1 (same utility names, drop-in). Until then, `tailwindcss-animate` is the canonical motion utility provider for shadcn primitives.

## Cross-references

- SPEC v2 §C1 — full dependency list (post-Amendment 3 update reflects swap).
- PLAN v2 T07 (PRE-T07 backup, T07 shadcn init) — context for why `tw-animate-css` arrived.
- `tailwind.config.ts` — `plugins: [require("tailwindcss-animate")]` at the bottom.
- `node_modules/tw-animate-css/package.json` — describes itself as Tailwind v4 only.

---

**T07 evaluation status:** COMPLETE — swap rationale documented; `tailwindcss-animate` ships in Tailwind v3 toolchain.
