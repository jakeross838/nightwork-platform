// src/app/design-system/prototypes/layout.tsx
//
// Prototype gallery layout — locks Site Office direction (C) + Set B
// palette for every /design-system/prototypes/* route. Per CONTEXT D-02
// (Phase 1.5b) the parent design-system layout exposes a
// DirectionPaletteSwitcher for picking direction; the prototypes
// gallery hard-codes the CP2 verdict so accidental flips can't
// invalidate the validation walkthrough.
//
// Per .planning/design/CHOSEN-DIRECTION.md (locked 2026-05-01) — Site
// Office + Set B is the locked direction. This file enforces that for
// /prototypes/*.
//
// Layout-nesting note: parent src/app/design-system/layout.tsx already
// wraps children in DirectionPaletteShell (which reads ?dir=&palette=
// from the URL). The shell renders a `.design-system-scope` div with
// `data-direction` + `data-palette` attributes. We render an inner div
// with the same attributes hard-coded to C / B. Since CSS attribute
// selectors in design-system.css use both
//   `.design-system-scope[data-direction="C"]`         (outer match)
// and
//   `.design-system-scope [data-direction="C"]`        (inner descendant)
// the inner attributes win for descendants — content inside this layout
// always renders Site Office regardless of `?dir=A` / `?palette=A` URL
// params. Verified at execute time via the `?dir=A` test in the plan
// halt verification step 6.
//
// Hook T10c (nightwork-post-edit.sh:194-230) — no imports from
// @/lib/supabase|org|auth.

import type { ReactNode } from "react";

export default function PrototypesLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div data-direction="C" data-palette="B" className="design-system-scope">
      {children}
    </div>
  );
}
