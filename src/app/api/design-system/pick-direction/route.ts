// Stage 1.5a Wave C T24.1 — CP2 pick API route.
//
// CARVE-OUT: this route imports requirePlatformAdmin from @/lib/auth/.
// The design-system isolation hook (T10c) only checks
// src/app/design-system/ paths — this route lives at
// src/app/api/design-system/pick-direction/route.ts which does NOT match
// that prefix. The auth import IS the platform-admin gate, not a tenant
// query, so it's the correct dependency.
//
// Behavior (per T24.1 spec + PHILOSOPHY.md §7.2):
//   1. Verify caller is a platform_admin via requirePlatformAdmin()
//   2. Validate the picked direction is one of three known keys
//   3. Write the marker file at .planning/design/CHOSEN-DIRECTION.md
//      with picked direction + Jake's user ID + ISO timestamp +
//      propagation note
//   4. Revalidate /design-system/philosophy so the banner updates
//
// IMPORTANT: this route writes to the filesystem (the .planning/ tree).
// In production hosted on Vercel, the filesystem is read-only at request
// time, so the route would 500. That's intentional for v1 — the CP2
// pick happens during local dev (Jake on his laptop or a runtime where
// the planning tree is writable). The route is gated by platform_admin
// AND by middleware /design-system/* in production.
//
// If a future deployment makes this need to work over HTTP at scale,
// substitute filesystem write with a Supabase persistence path.

import { NextResponse } from "next/server";
import { promises as fs } from "node:fs";
import path from "node:path";
import { revalidatePath } from "next/cache";

import { requirePlatformAdmin } from "@/lib/auth/platform-admin";

const MARKER_PATH = path.join(
  process.cwd(),
  ".planning",
  "design",
  "CHOSEN-DIRECTION.md",
);

const DIRECTION_LABELS: Record<string, string> = {
  "helm-brass": "Helm + Brass",
  "specimen": "Specimen",
  "site-office": "Site Office",
};

// Map direction key → PHILOSOPHY.md anchor (per spec).
const DIRECTION_ANCHOR: Record<string, string> = {
  "helm-brass": "§2",
  "specimen": "§3",
  "site-office": "§4",
};

export async function POST(req: Request) {
  let admin;
  try {
    admin = await requirePlatformAdmin();
  } catch {
    return NextResponse.json(
      { error: "Platform admin required" },
      { status: 403 },
    );
  }

  let body: { direction?: string; reasoning?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const direction = body.direction;
  if (!direction || !(direction in DIRECTION_LABELS)) {
    return NextResponse.json(
      {
        error:
          "Invalid direction. Expected 'helm-brass' | 'specimen' | 'site-office'.",
      },
      { status: 400 },
    );
  }

  const label = DIRECTION_LABELS[direction];
  const anchor = DIRECTION_ANCHOR[direction];
  // Sanitize reasoning: collapse newlines (prevents markdown-section injection
  // into the marker file), trim, cap at 500 chars (prevents bloat). Bounded
  // already by the platform_admin gate + hardcoded MARKER_PATH, but defense-
  // in-depth — the marker is a permanent decision artifact. Per Wave D QA
  // MEDIUM-2 finding, nwrp17 follow-up.
  const reasoning =
    (body.reasoning ?? "").replace(/[\r\n]+/g, " ").trim().slice(0, 500) ||
    "(no reasoning provided)";
  const now = new Date();
  const isoDate = now.toISOString().slice(0, 10); // YYYY-MM-DD
  const isoTimestamp = now.toISOString();

  const markdown = `# CHOSEN-DIRECTION.md

**Status:** LOCKED at Strategic Checkpoint #2 on ${isoDate} by ${admin.user_id}.

**Direction:** ${label}

**Reference:** PHILOSOPHY.md ${anchor}

**Picked at (UTC):** ${isoTimestamp}

**Reasoning (Jake's note at pick):**
${reasoning}

**Subordinate work triggered (per PHILOSOPHY.md §7.3):**
- T20a-T26 component playground builds: render in picked direction
- nightwork-design skill: update Authoritative documents, filter reference HTMLs to picked
- nightwork-design-tokens skill: add direction-specific Forbidden patterns
- nightwork-ui-template skill: instantiate Document Review reference in picked direction
- nightwork-design-system-reviewer agent: add direction-quality-bar checks
- impeccable skill (.impeccable.md §6): fill picked direction's name + axes
- frontend-design skill: add direction override file
- PATTERNS.md: update gold-standard renders to picked direction
- .impeccable.md §3: append direction-specific Forbidden items
- post-edit hook (.claude/hooks/nightwork-post-edit.sh): apply direction-conditional checks

This marker locks the direction across the playground, the design
skills, the patterns catalogue, and the Forbidden list. Switching
direction post-lock requires a new Strategic Checkpoint per
PHILOSOPHY.md §7.4.
`;

  try {
    await fs.writeFile(MARKER_PATH, markdown, "utf8");
  } catch (err) {
    return NextResponse.json(
      {
        error: `Marker write failed: ${err instanceof Error ? err.message : String(err)}`,
      },
      { status: 500 },
    );
  }

  revalidatePath("/design-system/philosophy");
  revalidatePath("/design-system");

  return NextResponse.json({
    ok: true,
    direction,
    label,
    pickedAt: isoTimestamp,
  });
}
