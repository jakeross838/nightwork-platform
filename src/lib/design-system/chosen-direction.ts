// Stage 1.5a Wave C T24.1 — chosen-direction marker reader.
//
// CARVE-OUT: this file is the single piece of design-system support that
// touches the .planning/design/CHOSEN-DIRECTION.md marker file. It is NOT
// under src/app/design-system/ so the design-system isolation hook
// (T10c) does not apply to it. Imports from @/lib/auth/* are NOT used
// here — this helper only reads the filesystem for the marker. The pick
// route (./pick-route.ts) is what gates on platform_admin via
// requirePlatformAdmin().
//
// Marker contract (per T24.1 spec + PHILOSOPHY.md §7.3):
//   - Path: .planning/design/CHOSEN-DIRECTION.md
//   - Until pick: file may not exist OR may contain "TBD" sentinel.
//   - After pick: contains a markdown header with picked direction +
//     Jake's user ID + ISO timestamp + propagation note.
//
// Returned shape: a small object the philosophy page can render. If the
// file is missing, returns null. If it contains the TBD placeholder,
// returns { direction: "TBD", ... } so consumers can branch.

import { promises as fs } from "node:fs";
import path from "node:path";

export type ChosenDirection = {
  direction: string; // "Helm + Brass" | "Specimen" | "Site Office" | "TBD"
  pickedAt: string; // ISO timestamp or "—"
  pickedBy: string; // human-readable name or "—"
  reasoning: string | null;
  raw: string; // raw markdown (for debug surfaces)
};

const MARKER_PATH = path.join(
  process.cwd(),
  ".planning",
  "design",
  "CHOSEN-DIRECTION.md",
);

/**
 * Read the CHOSEN-DIRECTION.md marker. Returns null if the file does not
 * exist (pre-CP2 or marker hasn't been seeded yet). Returns a parsed
 * shape otherwise. The parser is forgiving — if the file exists but is
 * malformed (no Direction line), the direction defaults to "TBD".
 */
export async function readChosenDirection(): Promise<ChosenDirection | null> {
  let raw: string;
  try {
    raw = await fs.readFile(MARKER_PATH, "utf8");
  } catch (err) {
    // ENOENT = marker not yet seeded; any other error = surface up
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw err;
  }

  // Quick TBD check — if the file is the placeholder seed, surface that.
  const isTbd = /Direction:\s*(?:TBD|tbd|—|---)/.test(raw);
  if (isTbd) {
    return {
      direction: "TBD",
      pickedAt: "—",
      pickedBy: "—",
      reasoning: null,
      raw,
    };
  }

  // Parse the canonical shape (per PHILOSOPHY.md §7.3):
  //   **Direction:** Helm + Brass
  //   **Status:** LOCKED at Strategic Checkpoint #2 on 2026-MM-DD by …
  //   **Reasoning (Jake's note at pick):** …
  const directionMatch = raw.match(/\*\*Direction:\*\*\s*(.+?)(?:\n|$)/);
  const statusMatch = raw.match(/\*\*Status:\*\*\s*(.+?)(?:\n|$)/);
  const reasoningMatch = raw.match(/\*\*Reasoning[^*]*?\*\*\s*\n([\s\S]*?)(?:\n\n|\*\*|$)/);

  const direction = directionMatch?.[1].trim() ?? "TBD";

  // Parse status line for date + picker. Default if missing.
  let pickedAt = "—";
  let pickedBy = "—";
  if (statusMatch) {
    const dateMatch = statusMatch[1].match(/on (\d{4}-\d{2}-\d{2})/);
    if (dateMatch) pickedAt = dateMatch[1];
    const byMatch = statusMatch[1].match(/by (.+?)\.?$/);
    if (byMatch) pickedBy = byMatch[1].trim();
  }

  return {
    direction,
    pickedAt,
    pickedBy,
    reasoning: reasoningMatch?.[1].trim() ?? null,
    raw,
  };
}
