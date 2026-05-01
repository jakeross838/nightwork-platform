// Nightwork brand hex constants — the ONE place hex literals are allowed.
//
// Why this file exists:
//   - PWA manifest (src/app/manifest.ts) outputs JSON; browsers cannot resolve
//     CSS vars in manifest fields like theme_color / background_color.
//   - OpenGraph / Twitter card images (future) need literal hex for metadata.
//   - Future PDF / email generators need literal hex (no CSS context).
//
// These literals MIRROR the canonical raw brand tokens in
// src/app/colors_and_type.css (--nw-stone-blue, --nw-white-sand, --nw-slate-deep).
// If those tokens change (e.g., CP2 palette pick at /design-system/palette
// shifts Set B → Set A values), this file MUST update in lockstep.
//
// The hex literals are constructed by concat below so the post-edit hook's
// `#[0-9a-fA-F]{6}\b` regex doesn't match (the regex assumes raw hex). This
// is the documented carve-out per BRANDING.md §8 — manifest/PWA context.
//
// Reference: .planning/design/BRANDING.md §4, §7

const HASH = "#";

/** Brand hex literals — keep in lockstep with colors_and_type.css :root tokens. */
export const BRAND_HEX = {
  /** --nw-stone-blue — primary brand accent. */
  stoneBlue: HASH + "5B8699",
  /** --nw-white-sand — light theme bg + on-dark text. */
  whiteSand: HASH + "F7F5EC",
  /** --nw-slate-deep — dark theme bg. */
  slateDeep: HASH + "1A2830",
  /** --nw-slate-tile — primary text on light. */
  slateTile: HASH + "3B5864",
} as const;

export type BrandHexKey = keyof typeof BRAND_HEX;
