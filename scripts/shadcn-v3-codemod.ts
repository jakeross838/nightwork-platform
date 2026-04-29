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
 *   for the full pattern catalog (17 patterns) and rationale.
 *
 * Patterns handled:
 *
 *   v4-only utility syntax (incompatible with v3):
 *     1.  `**:data-[slot=X]:Y`        → `[&_[data-slot=X]]:Y` (descendant combinator)
 *     2.  `origin-(--var-name)`       → `origin-[var(--var-name)]` (var shorthand)
 *     3.  `data-open:animate-in`      → `data-[state=open]:animate-in` (stateful shorthand)
 *     4.  `data-closed:animate-out`   → `data-[state=closed]:animate-out`
 *     5.  `class!`                    → `!class` (trailing important → leading important)
 *     6.  `has-data-[slot=X]:Y`       → `has-[[data-slot=X]]:Y` (compound selector)
 *
 *   Nightwork SPEC A2.1 (Forbidden — oversized rounded corners):
 *     7.  `rounded-{md,sm,lg,xl,2xl,3xl,full,[2-4px]}` on rectangular elements
 *         → `rounded-none` (avatars + status dots are an explicit exception
 *         per `--radius-dot: 999px`; the 6 primitives this phase installs
 *         are NOT avatar/dot, so rewriting all → `rounded-none` is safe.
 *         Spot-check each output flags any false positives).
 *
 * Idempotency:
 *   Each rule's regex matches ONLY the v4 form, never the v3 form. Running
 *   the codemod twice on the same file is a no-op the second time (verified
 *   by computing hash before+after).
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

const REWRITES: Rewrite[] = [
  // 1. **:data-[slot=X]:Y → [&_[data-slot=X]]:Y
  // The `**:` prefix is Tailwind v4's "descendant combinator" arbitrary
  // variant. v3 needs the explicit arbitrary-variant + descendant selector
  // form. Y can be any utility class chain (no whitespace).
  {
    id: "v4-descendant-double-star",
    label: "**:data-[slot=X]:utility → [&_[data-slot=X]]:utility",
    // group 1 = slot value, group 2 = utility (everything until whitespace)
    // Anchor at start-of-class-segment via word boundary or whitespace; allow
    // start of string too. Use lookbehind for whitespace OR start.
    pattern: /(^|\s)\*\*:data-\[slot=([^\]]+)\]:([^\s"'`]+)/g,
    replacement: (_match, prefix: string, slot: string, util: string) =>
      `${prefix}[&_[data-slot=${slot}]]:${util}`,
  },

  // 2. origin-(--var-name) → origin-[var(--var-name)]
  // Tailwind v4 lets you write `origin-(--name)` as shorthand for
  // `origin-[var(--name)]`. v3 doesn't recognize the parens-only form.
  // Generalize to ANY utility prefix (origin-, bg-, text-, w-, h-, etc.)
  // since the same shorthand was added v4-wide.
  {
    id: "v4-var-shorthand",
    label: "utility-(--var) → utility-[var(--var)]",
    // Match: word-boundary + (utility)-(--name) where name is CSS-ident-like.
    // Capture the utility prefix and the var name. Allow `-` in identifier.
    pattern: /\b([a-z][a-z0-9-]*)-\((--[a-z][a-z0-9_-]*)\)/g,
    replacement: (_match, util: string, varName: string) =>
      `${util}-[var(${varName})]`,
  },

  // 3. data-open:Y → data-[state=open]:Y
  {
    id: "v4-data-open-shorthand",
    label: "data-open:utility → data-[state=open]:utility",
    pattern: /\bdata-open:/g,
    replacement: "data-[state=open]:",
  },

  // 4. data-closed:Y → data-[state=closed]:Y
  {
    id: "v4-data-closed-shorthand",
    label: "data-closed:utility → data-[state=closed]:utility",
    pattern: /\bdata-closed:/g,
    replacement: "data-[state=closed]:",
  },

  // 5. class! → !class (trailing important → leading important)
  // Match a Tailwind class token followed by `!` + word boundary. v3 wants
  // the `!` BEFORE the BARE UTILITY but AFTER any variant chain.
  //
  //   `top-1/2!`                       →  `!top-1/2`
  //   `data-[side=left]:top-1/2!`      →  `data-[side=left]:!top-1/2`
  //   `hover:focus:bg-red-500!`        →  `hover:focus:!bg-red-500`
  //
  // The trick: split the class on the LAST `:` (which sits between the
  // variant chain and the utility). Insert `!` after that last colon (or
  // at the start of the class if there are no variants). Variant chain may
  // include arbitrary `[...]` segments with internal colons — but in
  // Tailwind syntax those colons are inside brackets, so the LAST
  // top-level colon is well-defined.
  //
  // Anchor with a leading whitespace or start-of-string so we only match
  // class-list contexts (not random `!` in JSX expressions).
  {
    id: "v4-trailing-important",
    label: "class! → !class (preserves variant chain)",
    // Capture: leading whitespace, full class token, then `!` + lookahead
    // for whitespace/quote/EOL.
    pattern: /(^|\s)([a-z][a-z0-9_:.\-\/\[\]=]*)!(?=\s|"|'|`|$)/g,
    replacement: (_match, prefix: string, klass: string) => {
      // Find the LAST top-level `:` (one that's NOT inside `[...]`).
      // Walk the string; track bracket depth; remember last `:` at depth 0.
      let depth = 0;
      let lastTopColon = -1;
      for (let i = 0; i < klass.length; i++) {
        const ch = klass[i];
        if (ch === "[") depth++;
        else if (ch === "]") depth--;
        else if (ch === ":" && depth === 0) lastTopColon = i;
      }
      if (lastTopColon === -1) {
        // No variants — just prepend `!`
        return `${prefix}!${klass}`;
      }
      // Insert `!` after the last top-level colon.
      return `${prefix}${klass.slice(0, lastTopColon + 1)}!${klass.slice(lastTopColon + 1)}`;
    },
  },

  // 6. has-data-[slot=X]:Y → has-[[data-slot=X]]:Y
  // v4 has the `has-data-` shorthand. v3's `has-` arbitrary variant takes
  // a CSS selector inside `[…]`, so the shorthand must expand to
  // `has-[[data-slot=X]]:Y`.
  {
    id: "v4-has-data-shorthand",
    label: "has-data-[slot=X]: → has-[[data-slot=X]]:",
    pattern: /\bhas-data-\[slot=([^\]]+)\]:/g,
    replacement: (_match, slot: string) => `has-[[data-slot=${slot}]]:`,
  },

  // 7. SPEC A2.1 — rounded variants on rectangular elements → rounded-none
  // Per Nightwork SPEC A2.1 Forbidden thresholds, `border-radius > 4px on
  // rectangular elements` is oversized. The 6 shadcn primitives we install
  // in this phase (combobox, calendar, drawer, tooltip, popover, hover-card)
  // are all rectangular surfaces — none are avatar/dot. Rewrite ALL rounded
  // utilities (md, sm, lg, xl, 2xl, 3xl, full, [Npx]) to rounded-none.
  //
  // Avatar/dot exceptions (rounded-full on `aspect-square` + `size-N` blocks)
  // are flagged in a SEPARATE skill rule and would require manual restoration.
  // For the 6 primitives this codemod targets, rounded-full has no
  // legitimate use — spot-check confirms.
  //
  // Match all rounded utilities EXCEPT `rounded-none` (already correct) and
  // `rounded-` followed by absolute zero brackets like `rounded-[0]`,
  // `rounded-[0px]`. Allow rounded with arbitrary px values too (the
  // shadcn-emitted `rounded-[2px]` Arrow case).
  {
    id: "spec-a2.1-rounded-rectangle",
    label: "rounded-{md,sm,lg,xl,2xl,3xl,full,[Npx]} → rounded-none (SPEC A2.1)",
    // Match `rounded-md`, `rounded-sm`, `rounded-lg`, `rounded-xl`,
    // `rounded-2xl`, `rounded-3xl`, `rounded-full`, `rounded-[Npx]` where N
    // is 1-4 digits. Exclude `rounded-none` and `rounded-[0]`/`rounded-[0px]`.
    pattern:
      /\brounded-(?:md|sm|lg|xl|2xl|3xl|full|\[(?!0(?:px)?\])\d+px?\])/g,
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
    label: "**:data-[…] (descendant combinator)",
  },
  {
    id: "v4-paren-shorthand",
    pattern: /\b[a-z][a-z0-9-]*-\(--[a-z]/,
    label: "utility-(--var) (var shorthand)",
  },
  {
    id: "v4-data-open",
    pattern: /\bdata-open:/,
    label: "data-open:",
  },
  {
    id: "v4-data-closed",
    pattern: /\bdata-closed:/,
    label: "data-closed:",
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
];

const A2_1_SANITY_PATTERNS: Array<{ id: string; pattern: RegExp; label: string }> = [
  {
    id: "spec-rounded",
    pattern: /\brounded-(?:md|sm|lg|xl|2xl|3xl|full)\b/,
    label: "rounded-{md,sm,lg,xl,2xl,3xl,full} (SPEC A2.1 violation)",
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
        // The match is args[0]; everything else (groups + offset + string)
        // depends on the regex.
        // We pass args through to the function; TypeScript types are lenient.
        return (fn as (...a: unknown[]) => string)(...args);
      }
      return fn;
    });
    if (count > 0) perRule.set(rule.id, count);
  }

  const changed = next !== original;
  if (changed) writeFileSync(filePath, next, "utf8");

  // Sanity check — scan for any remaining v4 syntax or A2.1 violation.
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

  // Expand globs to file list. Resolve to absolute paths so cwd doesn't matter.
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

  // Report
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

  // Exit non-zero if any file still has v4 syntax (sanity-check failure).
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
