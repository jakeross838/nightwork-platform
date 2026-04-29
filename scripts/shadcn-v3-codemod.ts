#!/usr/bin/env tsx
/**
 * shadcn-v3-codemod.ts — rewrites shadcn 4.x output (Tailwind v4 syntax) to
 * Tailwind v3.4-compatible syntax + Nightwork SPEC A2.1 compliance.
 *
 * Background:
 *   shadcn 4.x emits Tailwind v4-only utility shorthands. Nightwork is on
 *   Tailwind v3.4.1; v4 migration is a separate phase. Rather than freezing
 *   the design system on a deprecated CLI, we run shadcn's `add` command
 *   and pipe the output through this codemod to back-port the syntax.
 *
 *   See `.planning/phases/stage-1.5a-design-system-documents/audit-notes/T08-shadcn4-tailwind-v3-incompatibility.md`
 *   for the full pattern catalog (originally 17; expanded after combobox install
 *   exposed several more compound variants and the `data-WORD:` general shorthand).
 *
 * Patterns handled:
 *
 *   v4-only utility syntax (incompatible with v3):
 *     1.  `**:data-[slot=X]:Y`        → `[&_[data-slot=X]]:Y` (deep descendant)
 *     2.  `*:data-[slot=X]:Y`         → `[&>[data-slot=X]]:Y` (direct child)
 *     3.  `utility-(--var)`           → `utility-[var(--var)]` (var shorthand)
 *     4.  `data-WORD:Y`               → `data-[WORD]:Y` (boolean data-attr presence —
 *                                       general v4 shorthand; Base UI uses presence
 *                                       attributes like data-open / data-closed /
 *                                       data-pressed / data-highlighted / data-empty
 *                                       / data-disabled / data-anchor-hidden / etc.)
 *     5.  `class!`                    → `!class` (trailing important; preserves
 *                                       variant chain — `data-[side=left]:top-1/2!`
 *                                       becomes `data-[side=left]:!top-1/2`, NOT
 *                                       `!data-[…]:top-1/2`)
 *     6.  `has-data-[slot=X]:Y`       → `has-[[data-slot=X]]:Y` (compound selector)
 *     7.  `has-WORD:Y`                → `has-[:WORD]:Y` (CSS pseudo selector)
 *     8.  `group-has-data-[slot=X]/scope:Y` → `group-has-[[data-slot=X]]/scope:Y`
 *                                       (group variant + has-data shorthand combined)
 *     9.  `not-data-[X=Y]:Z`          → `not-[[data-X=Y]]:Z` (negation modifier)
 *    10.  `outline-hidden`            → `outline-none` (v4 rename; v3 spelling)
 *    11.  `--spacing(N)`              → `calc(0.25rem * N)` (v4 calc helper not in v3;
 *                                       preserves semantics — Tailwind v4 default
 *                                       --spacing is 0.25rem = 4px, matching v3)
 *
 *   Nightwork SPEC A2.1 (Forbidden — oversized rounded corners):
 *    12.  `rounded-{md,sm,lg,xl,2xl,3xl,full,[Npx]}` on rectangular elements
 *         → `rounded-none` (avatars + status dots are an explicit exception
 *         per `--radius-dot: 999px`; the 6 primitives this phase installs
 *         are NOT avatar/dot, so rewriting all → `rounded-none` is safe.
 *         Spot-check each output flags any false positives).
 *
 * Idempotency:
 *   Each rule's regex matches ONLY the v4 form, never the v3 form. Running
 *   the codemod twice on the same file is a no-op the second time (verified
 *   by post-rewrite invocation).
 *
 * Usage:
 *   npx tsx scripts/shadcn-v3-codemod.ts <file-or-glob> [<file-or-glob> ...]
 *
 *   With no args, defaults to `src/components/ui/*.tsx`.
 *
 * Exit codes:
 *   0  — all files clean (no v4 syntax remains)
 *   1  — at least one file still contains v4 syntax after rewrite (sanity-check failure)
 *   2  — usage error (no files found)
 */

import { readFileSync, writeFileSync, existsSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { sync as syncGlob } from "glob";

// ---------------------------------------------------------------------------
// Pattern catalog
// ---------------------------------------------------------------------------

interface Rewrite {
  /** Stable id for reporting. */
  id: string;
  /** Human-readable label for the summary. */
  label: string;
  /** v4 source pattern (matches v4-only syntax). */
  pattern: RegExp;
  /** v3 replacement (string or function). */
  replacement: string | ((match: string, ...groups: string[]) => string);
}

// `data-WORD:` general shorthand: which words MEAN a stateful presence
// attribute and should be rewritten to `data-[WORD]:`. We rewrite a curated
// list rather than ALL data-* names because some legitimate v3 patterns
// use `data-` followed by a word (e.g. `data-state` is a valid Base UI
// attribute name and is used as `data-[state=open]:` — those should NOT be
// touched because `data-state:` would mean "is data-state attribute present"
// which is true any time `data-state` exists with any value). Curated list:
const DATA_BARE_WORDS = [
  "open",
  "closed",
  "pressed",
  "highlighted",
  "empty",
  "disabled",
  "active",
  "selected",
  "checked",
  "unchecked",
  "loading",
  "busy",
  "invalid",
  "valid",
  "required",
  "popup-open",
  "trigger-disabled",
  "anchor-hidden",
  "starting-style",
  "ending-style",
];

// Same approach for `has-WORD:` — these are CSS pseudo-class names used
// after `has-`. v4 lets you write `has-disabled:` as sugar for
// `has-[:disabled]:`. v3 needs the explicit selector form.
const HAS_BARE_PSEUDOS = [
  "disabled",
  "checked",
  "required",
  "focus",
  "hover",
  "valid",
  "invalid",
];

const REWRITES: Rewrite[] = [
  // 1. **:data-[slot=X]:Y → [&_[data-slot=X]]:Y (deep descendant)
  {
    id: "v4-descendant-double-star",
    label: "**:data-[slot=X]:utility → [&_[data-slot=X]]:utility (deep descendant)",
    pattern: /(^|\s)\*\*:data-\[slot=([^\]]+)\]:([^\s"'`]+)/g,
    replacement: (_match, prefix: string, slot: string, util: string) =>
      `${prefix}[&_[data-slot=${slot}]]:${util}`,
  },

  // 2. *:data-[slot=X]:Y → [&>[data-slot=X]]:Y (direct child)
  // Tailwind v4's `*:` prefix is "direct children" (>); v3 needs the
  // arbitrary variant form.
  {
    id: "v4-descendant-single-star",
    label: "*:data-[slot=X]:utility → [&>[data-slot=X]]:utility (direct child)",
    // Anchor on whitespace/start; require the `*:` is NOT preceded by a `*`
    // (which would make it `**:`, handled by rule 1). Negative lookbehind.
    pattern: /(^|[\s])\*:data-\[slot=([^\]]+)\]:([^\s"'`]+)/g,
    replacement: (_match, prefix: string, slot: string, util: string) =>
      `${prefix}[&>[data-slot=${slot}]]:${util}`,
  },

  // 3. utility-(--var) → utility-[var(--var)] (var shorthand)
  {
    id: "v4-var-shorthand",
    label: "utility-(--var) → utility-[var(--var)]",
    pattern: /\b([a-z][a-z0-9-]*)-\((--[a-z][a-z0-9_-]*)\)/g,
    replacement: (_match, util: string, varName: string) =>
      `${util}-[var(${varName})]`,
  },

  // 4. data-WORD:Y → data-[WORD]:Y (general bare-word data-attr presence)
  // Curated word list per DATA_BARE_WORDS above. The bare `data-WORD:` form
  // is v4-only sugar; v3 requires the explicit `data-[WORD]:` arbitrary-value
  // form (which compiles to `[data-WORD]` presence selector in v3.4+).
  //
  // Anchor: `data-` must appear at the start of a variant token — not
  // mid-word. Variant tokens are separated by `:` in the variant chain, by
  // whitespace between class-list members, or by start of class string.
  // Allow `:` as a left boundary so compound variants like
  // `not-[[…]]:data-highlighted:` and `dark:data-disabled:` rewrite correctly.
  //
  // Special case: `not-data-WORD:` is handled by rule 9 (not-data-shorthand).
  // We exclude `not-` prefix here because rule 9 expects to see `not-data-[…]`
  // form which we don't produce here. But `not-data-WORD:` (bare word) is a
  // SEPARATE v4 form — let rule 9 catch it, OR let this rule rewrite it to
  // `not-data-[WORD]:` first and then rule 9 catches `not-data-[WORD]:` →
  // `not-[[data-WORD]]:`. We choose the second path: rule 4 runs FIRST, so
  // `not-data-highlighted:` becomes `not-data-[highlighted]:`, and then rule 9
  // (which runs after) catches it. We DON'T need to exclude `not-` here.
  //
  // Compound prefix `group-data-WORD:` similarly: rule 4 rewrites the inner
  // `data-WORD:` part, leaving `group-data-[WORD]:` which is valid v3 syntax.
  {
    id: "v4-data-bare-word",
    label: `data-WORD: → data-[WORD]: (general bare-word; ${DATA_BARE_WORDS.length} known words)`,
    pattern: new RegExp(
      // Left anchor: start-of-string, whitespace, quote, bracket-open, or
      // colon (which separates variant tokens). The `(?<![a-z0-9-])` negative
      // lookbehind alone would be cleaner BUT we need to capture the prefix
      // for replacement. Use a capture group with the allowed boundary chars.
      `(^|[\\s"'\`\\[(:])data-(${DATA_BARE_WORDS.join("|")}):`,
      "g"
    ),
    replacement: (_match, prefix: string, word: string) =>
      `${prefix}data-[${word}]:`,
  },

  // 5. class! → !class (trailing important → leading important)
  // Preserves variant chain: insert `!` AFTER the last top-level `:`.
  {
    id: "v4-trailing-important",
    label: "class! → !class (preserves variant chain)",
    pattern: /(^|\s)([a-z][a-z0-9_:.\-\/\[\]=]*)!(?=\s|"|'|`|$)/g,
    replacement: (_match, prefix: string, klass: string) => {
      let depth = 0;
      let lastTopColon = -1;
      for (let i = 0; i < klass.length; i++) {
        const ch = klass[i];
        if (ch === "[") depth++;
        else if (ch === "]") depth--;
        else if (ch === ":" && depth === 0) lastTopColon = i;
      }
      if (lastTopColon === -1) {
        return `${prefix}!${klass}`;
      }
      return `${prefix}${klass.slice(0, lastTopColon + 1)}!${klass.slice(lastTopColon + 1)}`;
    },
  },

  // 6. has-data-[slot=X]:Y → has-[[data-slot=X]]:Y (compound)
  {
    id: "v4-has-data-shorthand",
    label: "has-data-[slot=X]: → has-[[data-slot=X]]:",
    pattern: /\bhas-data-\[slot=([^\]]+)\]:/g,
    replacement: (_match, slot: string) => `has-[[data-slot=${slot}]]:`,
  },

  // 7. has-WORD:Y → has-[:WORD]:Y (CSS pseudo-class shorthand)
  // Same anchor strategy as rule 4 — allow `:` as left boundary so compound
  // chains like `dark:has-disabled:` rewrite. `group-has-…` is handled by
  // rule 8 with a different anchor, so the negative-prefix concern doesn't
  // apply here.
  {
    id: "v4-has-bare-pseudo",
    label: `has-WORD: → has-[:WORD]: (CSS pseudo; ${HAS_BARE_PSEUDOS.length} known)`,
    pattern: new RegExp(
      `(^|[\\s"'\`\\[(:])has-(${HAS_BARE_PSEUDOS.join("|")}):`,
      "g"
    ),
    replacement: (_match, prefix: string, pseudo: string) =>
      `${prefix}has-[:${pseudo}]:`,
  },

  // 8. group-has-data-[slot=X]/scope:Y → group-has-[[data-slot=X]]/scope:Y
  // Compound prefix. The `group-` part is preserved; `/scope` group-name is
  // preserved; only the `has-data-[slot=…]` portion is rewritten.
  {
    id: "v4-group-has-data",
    label: "group-has-data-[slot=X]/scope: → group-has-[[data-slot=X]]/scope:",
    pattern: /\bgroup-has-data-\[slot=([^\]]+)\](\/[a-z][a-z0-9-]*)?:/g,
    replacement: (_match, slot: string, scope: string | undefined) =>
      `group-has-[[data-slot=${slot}]]${scope || ""}:`,
  },

  // 9. not-data-[X=Y]:Z → not-[[data-X=Y]]:Z
  // Tailwind v4's `not-data-` shorthand — v3 needs the explicit `not-[…]`
  // arbitrary variant form with full CSS selector inside.
  {
    id: "v4-not-data-shorthand",
    label: "not-data-[X=Y]: → not-[[data-X=Y]]:",
    pattern: /\bnot-data-\[([^\]]+)\]:/g,
    replacement: (_match, attr: string) => `not-[[data-${attr}]]:`,
  },

  // 9b. in-data-[X=Y]:Z → [[data-X=Y]_&]:Z (parent-scope variant)
  // Tailwind v4's `in-` variant matches when an ANCESTOR has the data
  // attribute. v3 has no native `in-` but expresses the same with the
  // arbitrary variant `[[selector]_&]` form.
  {
    id: "v4-in-data-shorthand",
    label: "in-data-[X=Y]: → [[data-X=Y]_&]: (parent-scope)",
    pattern: /\bin-data-\[([^\]]+)\]:/g,
    replacement: (_match, attr: string) => `[[data-${attr}]_&]:`,
  },

  // 10. outline-hidden → outline-none (v4 → v3 rename)
  // Tailwind v4 renamed `outline-none` to `outline-hidden` for clarity.
  // Same CSS output (outline: 2px solid transparent; outline-offset: 2px).
  {
    id: "v4-outline-hidden",
    label: "outline-hidden → outline-none",
    pattern: /\boutline-hidden\b/g,
    replacement: "outline-none",
  },

  // 11. --spacing(N) → calc(0.25rem * N) (v4 calc helper)
  // Tailwind v4 introduced the `--spacing(N)` CSS function as shorthand
  // for `calc(var(--spacing) * N)` where `--spacing: 0.25rem` (4px) is the
  // default base unit. v3 has no equivalent function; substitute the
  // multiplied rem value directly.
  //
  // Examples seen in shadcn 4 combobox output:
  //   max-h-[min(calc(--spacing(72)---spacing(9)), …)]
  //   h-[calc(--spacing(5.25))]
  //
  // The `---spacing(9)` form (subtraction) is `- --spacing(9)`. After
  // rewrite: `- calc(0.25rem * 9)` which is `-2.25rem`. CSS calc handles
  // nested calc() so the result is valid.
  {
    id: "v4-spacing-fn",
    label: "--spacing(N) → calc(0.25rem * N)",
    // Match `--spacing(N)` where N is a positive number (integer or decimal).
    pattern: /--spacing\((\d+(?:\.\d+)?)\)/g,
    replacement: (_match, n: string) => `calc(0.25rem * ${n})`,
  },

  // 11b. supports-WORD:Y → supports-[WORD]:Y (v4 shorthand)
  // Tailwind v4 added bare-word `supports-feature:` sugar (e.g. `supports-grid:`,
  // `supports-backdrop-filter:`). v3 requires the explicit arbitrary-value form.
  // Match `supports-(name):` where name is a CSS feature query identifier
  // (alphanum + hyphens; not a `[` since that's already v3-valid).
  {
    id: "v4-supports-bare",
    label: "supports-FEATURE: → supports-[FEATURE]: (CSS @supports query)",
    pattern: /\bsupports-([a-z][a-z0-9-]+):/g,
    replacement: (_match, feature: string) => {
      // Skip if the captured feature is already a known v3-config value
      // (extremely unlikely without theme.supports config). Always rewrite
      // — v3 resolves `supports-[name]:` correctly.
      return `supports-[${feature}]:`;
    },
  },

  // 11c. backdrop-blur-xs → backdrop-blur-[2px] (v4-only utility)
  // Tailwind v4 added `xs: 2px` to the blur scale; v3 default scale starts at
  // `sm: 4px`. Use arbitrary value to preserve the slight-blur intent.
  {
    id: "v4-backdrop-blur-xs",
    label: "backdrop-blur-xs → backdrop-blur-[2px] (v3 has no xs)",
    pattern: /\bbackdrop-blur-xs\b/g,
    replacement: "backdrop-blur-[2px]",
  },

  // 11d. blur-xs → blur-[2px] (same v4-only addition for non-backdrop blur)
  {
    id: "v4-blur-xs",
    label: "blur-xs → blur-[2px] (v3 has no xs)",
    pattern: /\bblur-xs\b/g,
    replacement: "blur-[2px]",
  },

  // 12. SPEC A2.1 — rounded variants on rectangular elements → rounded-none
  // Avatar/dot exceptions are NOT in the 6 primitives this phase installs;
  // sweep all rounded → rounded-none. Spot-check each primitive flags
  // any unintended cases.
  //
  // Includes directional rounded utilities: rounded-t-xl, rounded-r-md,
  // rounded-b-lg, rounded-l-xl, rounded-tl-md, rounded-tr-lg, rounded-bl-xl,
  // rounded-br-2xl, etc. The directional infix is one of:
  //   t (top), r (right), b (bottom), l (left)
  //   tl/tr/bl/br (corners)
  //   ts/te/bs/be (logical: top-start, top-end, bottom-start, bottom-end —
  //                Tailwind v4 added these for RTL support)
  {
    id: "spec-a2.1-rounded-rectangle",
    label: "rounded-{,t,r,b,l,tl,tr,bl,br,ts,te,bs,be}-{md,sm,lg,xl,2xl,3xl,full,[Npx]} → rounded-none",
    pattern:
      /\brounded(?:-(?:t|r|b|l|tl|tr|bl|br|ts|te|bs|be|s|e|ss|se|es|ee))?-(?:md|sm|lg|xl|2xl|3xl|full|\[(?!0(?:px)?\])\d+(?:\.\d+)?px?\])/g,
    replacement: "rounded-none",
  },
];

// ---------------------------------------------------------------------------
// File rewriting
// ---------------------------------------------------------------------------

interface FileResult {
  file: string;
  changed: boolean;
  perRule: Map<string, number>;
  remainingV4Syntax: string[]; // sanity check — empty after rewrite
}

const V4_SANITY_PATTERNS: Array<{ id: string; pattern: RegExp; label: string }> = [
  // After rewrite, NONE of these should match. If any do, the codemod
  // missed a pattern — the file is broken.
  {
    id: "v4-double-star",
    pattern: /\*\*:data-\[/,
    label: "**:data-[…] (deep descendant combinator)",
  },
  {
    id: "v4-single-star",
    // Match `*:data-[…]` but NOT `**:data-[…]`. Use negative lookbehind.
    pattern: /(?<!\*)\*:data-\[/,
    label: "*:data-[…] (direct-child combinator)",
  },
  {
    id: "v4-paren-shorthand",
    pattern: /\b[a-z][a-z0-9-]*-\(--[a-z]/,
    label: "utility-(--var) (var shorthand)",
  },
  {
    id: "v4-data-bare-word",
    // Any of the known stateful data shorthands still bare (followed by `:`,
    // not by `[`). Use the curated list as alternation. Apply same lookbehind
    // exclusions as the rewrite rule.
    pattern: new RegExp(
      `(?<![a-z0-9])data-(${DATA_BARE_WORDS.join("|")}):`
    ),
    label: "data-WORD: (bare-word data shorthand)",
  },
  {
    id: "v4-trailing-bang",
    pattern: /(?:^|\s)[a-z][a-z0-9_:.\-\/\[\]=]*![\s"'`]/,
    label: "class! (trailing important)",
  },
  {
    id: "v4-has-data",
    pattern: /\bhas-data-\[slot=/,
    label: "has-data-[slot=…]:",
  },
  {
    id: "v4-has-bare-pseudo",
    pattern: new RegExp(
      `(?<![a-z0-9-])has-(${HAS_BARE_PSEUDOS.join("|")}):`
    ),
    label: "has-WORD: (bare-word pseudo shorthand)",
  },
  {
    id: "v4-group-has-data",
    pattern: /\bgroup-has-data-\[slot=/,
    label: "group-has-data-[slot=…]:",
  },
  {
    id: "v4-not-data",
    pattern: /\bnot-data-\[/,
    label: "not-data-[…]:",
  },
  {
    id: "v4-in-data",
    pattern: /\bin-data-\[/,
    label: "in-data-[…]:",
  },
  {
    id: "v4-outline-hidden",
    pattern: /\boutline-hidden\b/,
    label: "outline-hidden",
  },
  {
    id: "v4-spacing-fn",
    pattern: /--spacing\(/,
    label: "--spacing(…)",
  },
  {
    id: "v4-supports-bare",
    // Match supports-WORD: but NOT supports-[WORD]: (already v3) and NOT
    // mid-class. Allow alphanum identifiers with hyphens.
    pattern: /(?<![a-z0-9-])supports-[a-z][a-z0-9-]+:/,
    label: "supports-FEATURE: (bare-word @supports shorthand)",
  },
  {
    id: "v4-backdrop-blur-xs",
    pattern: /\bbackdrop-blur-xs\b/,
    label: "backdrop-blur-xs (v4-only utility)",
  },
  {
    id: "v4-blur-xs",
    pattern: /\bblur-xs\b/,
    label: "blur-xs (v4-only utility)",
  },
];

const A2_1_SANITY_PATTERNS: Array<{ id: string; pattern: RegExp; label: string }> = [
  {
    id: "spec-rounded",
    // Match rounded-{md,sm,lg,xl,2xl,3xl,full} OR directional rounded-{t,r,b,l,…}-{md,…}
    pattern: /\brounded(?:-(?:t|r|b|l|tl|tr|bl|br|ts|te|bs|be|s|e|ss|se|es|ee))?-(?:md|sm|lg|xl|2xl|3xl|full)\b/,
    label: "rounded-{,t,r,b,l,tl,tr,bl,br}-{md,sm,lg,xl,2xl,3xl,full} (SPEC A2.1 violation)",
  },
];

function rewriteFile(filePath: string): FileResult {
  const original = readFileSync(filePath, "utf8");
  let next = original;
  const perRule = new Map<string, number>();

  for (const rule of REWRITES) {
    let count = 0;
    next = next.replace(rule.pattern, (...args: unknown[]) => {
      count++;
      const fn = rule.replacement;
      if (typeof fn === "function") {
        return (fn as (...a: unknown[]) => string)(...args);
      }
      return fn;
    });
    if (count > 0) perRule.set(rule.id, count);
  }

  const changed = next !== original;
  if (changed) writeFileSync(filePath, next, "utf8");

  const remainingV4Syntax: string[] = [];
  for (const sanity of [...V4_SANITY_PATTERNS, ...A2_1_SANITY_PATTERNS]) {
    if (sanity.pattern.test(next)) {
      remainingV4Syntax.push(sanity.label);
    }
  }

  return { file: filePath, changed, perRule, remainingV4Syntax };
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function main(): number {
  const argv = process.argv.slice(2);
  const targets = argv.length > 0 ? argv : ["src/components/ui/*.tsx"];

  const files = new Set<string>();
  for (const target of targets) {
    if (existsSync(target)) {
      try {
        if (statSync(target).isFile()) {
          files.add(resolve(target));
          continue;
        }
      } catch {
        /* fall through to glob */
      }
    }
    const matched = syncGlob(target, { absolute: true, nodir: true });
    for (const m of matched) files.add(m);
  }

  if (files.size === 0) {
    console.error(`[shadcn-v3-codemod] no files matched: ${targets.join(" ")}`);
    return 2;
  }

  const results: FileResult[] = [];
  for (const file of files) {
    results.push(rewriteFile(file));
  }

  let totalChanged = 0;
  let totalReplacements = 0;
  for (const r of results) {
    if (r.changed) totalChanged++;
    let fileTotal = 0;
    for (const n of r.perRule.values()) fileTotal += n;
    totalReplacements += fileTotal;
    if (r.changed || r.remainingV4Syntax.length > 0) {
      console.log(`\n${r.file}`);
      if (r.perRule.size > 0) {
        console.log("  rewrites:");
        for (const [id, n] of r.perRule.entries()) {
          const rule = REWRITES.find((rw) => rw.id === id);
          console.log(`    ${id} (${rule?.label ?? "?"}): ${n}`);
        }
      } else {
        console.log("  no changes (already v3-compliant)");
      }
      if (r.remainingV4Syntax.length > 0) {
        console.log("  REMAINING V4 SYNTAX (codemod missed a pattern):");
        for (const label of r.remainingV4Syntax) console.log(`    - ${label}`);
      }
    }
  }

  console.log(
    `\n[shadcn-v3-codemod] processed ${files.size} files; ${totalChanged} changed; ${totalReplacements} replacements total.`
  );

  const sanityFailures = results.filter((r) => r.remainingV4Syntax.length > 0);
  if (sanityFailures.length > 0) {
    console.error(
      `\n[shadcn-v3-codemod] FAIL: ${sanityFailures.length} file(s) still contain v4 or A2.1-forbidden syntax. A new pattern needs adding to the script.`
    );
    return 1;
  }

  return 0;
}

const exitCode = main();
process.exit(exitCode);
