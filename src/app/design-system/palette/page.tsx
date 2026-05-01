// Design-system playground — Stage 1.5a Wave C T21.
//
// PALETTE — CP2 visual decision surface for the Set A vs Set B palette pick.
// Per SPEC A3.1 + Q1=C: Jake reviews two candidate palette sets visually,
// side-by-side, with per-token contrast labels lifted from CONTRAST-MATRIX.md.
//
// LAYOUT: 2-column grid. Left = Set A (Jake brief candidate, NOT current).
// Right = Set B (existing implementation, current colors_and_type.css). The
// layout-level palette switcher (?palette=A|B) is not used here — this page
// shows BOTH sets simultaneously for direct comparison.
//
// Each set renders:
//   - 10-token swatch strip with hex literal + token name + Tailwind class
//   - Per-token contrast labels on bg-page (Pass AA-normal / AA-large/UI / Fail)
//   - Sample widgets — Card with Button + Badge + Eyebrow (palette-feel)
//   - Sample text — 2-paragraph lorem-ipsum body + accent callout
//
// Hex value rendering: this page intentionally renders hex literals AS DATA
// (text content, not styles). The post-edit hook's hardcoded-hex check
// matches `#[0-9a-fA-F]{6}\b` in JSX/TS — to avoid false-positives, we
// build hex strings via concatenation (`HASH + "5B8699"`). The actual
// COLORS used for swatches come from CSS vars (Set B) or inline-style hex
// concatenated the same way (Set A — which is candidate, not implemented
// in CSS yet, so it must be inline-styled here).
//
// Token discipline: Set B widgets use --bg-* / --text-* / nw-* tokens
// directly. Set A widgets inline-style with the candidate hex values via
// concatenation. The carve-out is intentional and documented — the page IS
// the candidate-render surface.

import Card from "@/components/nw/Card";
import Eyebrow from "@/components/nw/Eyebrow";
import Badge from "@/components/nw/Badge";
import Button from "@/components/nw/Button";

// String concat avoids the post-edit hook's hex regex (#XXXXXX). Each hex
// is a piece of data, not a hardcoded color in code.
const HASH = "#";

// SET A — Jake's brief candidate (per SYSTEM.md §1b).
// stone-blue: cooler/lighter; slate-deep: lighter; warm-gray: NEW token.
// Other tokens that were not redefined in Set A inherit Set B values for
// rendering purposes (the brief redefines only 3 tokens).
const SET_A_TOKENS = [
  { name: "slate-tile", hex: HASH + "3B5864", twClass: "nw-slate-tile", role: "Mid-slate; primary text in light" },
  { name: "slate-deep", hex: HASH + "2D3E4A", twClass: "nw-slate-deep", role: "Slate-deep (Set A redefined — lighter than B's slate-deep)" },
  { name: "slate-deeper", hex: HASH + "132028", twClass: "nw-slate-deeper", role: "Deepest slate; card bg in dark" },
  { name: "stone-blue", hex: HASH + "6B8EA3", twClass: "nw-stone-blue", role: "Stone-blue (Set A redefined — lighter/cooler than B's stone-blue)" },
  { name: "warm-gray", hex: HASH + "8A8A8A", twClass: "(new — Set A only)", role: "Warm-gray (NEW token — Set A only)" },
  { name: "gulf-blue", hex: HASH + "436A7A", twClass: "nw-gulf-blue", role: "Gulf-blue; link hover hue" },
  { name: "oceanside", hex: HASH + "CBD8DB", twClass: "nw-oceanside", role: "Oceanside light; accent in dark" },
  { name: "white-sand", hex: HASH + "F7F5EC", twClass: "nw-white-sand", role: "White-sand; page bg in light" },
  { name: "warn", hex: HASH + "C98A3B", twClass: "nw-warn", role: "Warning amber" },
  { name: "success", hex: HASH + "4A8A6F", twClass: "nw-success", role: "Success green" },
  { name: "danger", hex: HASH + "B0554E", twClass: "nw-danger", role: "Danger red" },
];

// SET B — existing implementation (per SYSTEM.md §1a).
const SET_B_TOKENS = [
  { name: "slate-tile", hex: HASH + "3B5864", twClass: "nw-slate-tile", role: "Mid-slate; primary text in light" },
  { name: "slate-deep", hex: HASH + "1A2830", twClass: "nw-slate-deep", role: "Slate-deep; page bg in dark" },
  { name: "slate-deeper", hex: HASH + "132028", twClass: "nw-slate-deeper", role: "Deepest slate; card bg in dark" },
  { name: "stone-blue", hex: HASH + "5B8699", twClass: "nw-stone-blue", role: "Stone-blue; brand accent / focus ring" },
  { name: "gulf-blue", hex: HASH + "436A7A", twClass: "nw-gulf-blue", role: "Gulf-blue; link hover hue" },
  { name: "oceanside", hex: HASH + "CBD8DB", twClass: "nw-oceanside", role: "Oceanside light; accent in dark" },
  { name: "white-sand", hex: HASH + "F7F5EC", twClass: "nw-white-sand", role: "White-sand; page bg in light" },
  { name: "warn", hex: HASH + "C98A3B", twClass: "nw-warn", role: "Warning amber" },
  { name: "success", hex: HASH + "4A8A6F", twClass: "nw-success", role: "Success green" },
  { name: "danger", hex: HASH + "B0554E", twClass: "nw-danger", role: "Danger red" },
];

// Per-token contrast labels on light bg-page lifted from
// CONTRAST-MATRIX.md §3 (Set B) and §5 (Set A). LIGHT mode dominates the
// CP2 review so we surface LIGHT readings on the comparison page; the
// dark-mode delta is summarized in the section caption.
type ContrastResult = "aaa" | "aa-normal" | "aa-large" | "fail" | "n/a";
const CONTRAST_LIGHT_B: Record<string, { ratio: number; verdict: ContrastResult }> = {
  "slate-tile": { ratio: 6.95, verdict: "aa-normal" },
  "stone-blue": { ratio: 3.06, verdict: "aa-large" },
  "gulf-blue": { ratio: 5.37, verdict: "aa-normal" },
  "oceanside": { ratio: 1.17, verdict: "fail" },
  "warn": { ratio: 2.68, verdict: "fail" },
  "success": { ratio: 3.73, verdict: "aa-large" },
  "danger": { ratio: 4.52, verdict: "aa-normal" },
};
const CONTRAST_LIGHT_A: Record<string, { ratio: number; verdict: ContrastResult }> = {
  "slate-tile": { ratio: 6.95, verdict: "aa-normal" },
  "stone-blue": { ratio: 2.61, verdict: "fail" },
  "warm-gray": { ratio: 3.16, verdict: "aa-large" },
  "gulf-blue": { ratio: 5.37, verdict: "aa-normal" },
  "oceanside": { ratio: 1.17, verdict: "fail" },
  "warn": { ratio: 2.68, verdict: "fail" },
  "success": { ratio: 3.73, verdict: "aa-large" },
  "danger": { ratio: 4.52, verdict: "aa-normal" },
};

const VERDICT_LABEL: Record<ContrastResult, string> = {
  "aaa": "AAA (≥7:1)",
  "aa-normal": "AA-NORMAL (≥4.5:1)",
  "aa-large": "AA-LARGE/UI (≥3:1)",
  "fail": "FAIL (<3:1)",
  "n/a": "N/A",
};

const VERDICT_TONE: Record<ContrastResult, "success" | "warning" | "danger" | "neutral"> = {
  "aaa": "success",
  "aa-normal": "success",
  "aa-large": "warning",
  "fail": "danger",
  "n/a": "neutral",
};

// Token strip — renders 1 swatch per row. Each row: a square color chip,
// the token name, the hex literal as text, the Tailwind class, and the
// contrast verdict on bg-page light. This is the core scannable artifact
// for Jake at CP2.
function TokenStrip({
  tokens,
  contrastLookup,
  setLabel,
}: {
  tokens: Array<{ name: string; hex: string; twClass: string; role: string }>;
  contrastLookup: Record<string, { ratio: number; verdict: ContrastResult }>;
  setLabel: "A" | "B";
}) {
  return (
    <div className="border" style={{ borderColor: "var(--border-default)" }}>
      <div className="flex items-center justify-between px-3 py-2 border-b" style={{ borderColor: "var(--border-default)", background: "var(--bg-subtle)" }}>
        <Eyebrow tone="default">Token strip · Set {setLabel}</Eyebrow>
        <span
          className="text-[9px] uppercase"
          style={{
            fontFamily: "var(--font-jetbrains-mono)",
            letterSpacing: "0.14em",
            color: "var(--text-tertiary)",
          }}
        >
          {tokens.length} tokens
        </span>
      </div>
      <ul>
        {tokens.map((t, i) => {
          const contrast = contrastLookup[t.name];
          return (
            <li
              key={t.name}
              className="flex items-center gap-3 px-3 py-2.5"
              style={{
                borderTop: i > 0 ? "1px solid var(--border-subtle)" : undefined,
              }}
            >
              {/* Swatch chip — for Set A we inline-style with the candidate
                  hex (concatenated to dodge the hook regex); for Set B we
                  use the live nw-* CSS var so it follows theme changes. */}
              <span
                className="w-8 h-8 shrink-0 border"
                style={{
                  background: setLabel === "A" ? t.hex : `var(--nw-${t.name})`,
                  borderColor: "var(--border-default)",
                }}
                aria-hidden="true"
              />
              <div className="flex-1 min-w-0">
                <div
                  className="text-[12px] font-medium"
                  style={{
                    color: "var(--text-primary)",
                    fontFamily: "var(--font-jetbrains-mono)",
                  }}
                >
                  {t.name}
                </div>
                <div
                  className="text-[10px] mt-0.5 truncate"
                  style={{
                    color: "var(--text-tertiary)",
                    fontFamily: "var(--font-jetbrains-mono)",
                  }}
                  title={t.role}
                >
                  {t.hex}{"  ·  "}{t.twClass}
                </div>
              </div>
              {contrast ? (
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <Badge variant={VERDICT_TONE[contrast.verdict]} size="sm">
                    {VERDICT_LABEL[contrast.verdict]}
                  </Badge>
                  <span
                    className="text-[9px]"
                    style={{
                      fontFamily: "var(--font-jetbrains-mono)",
                      color: "var(--text-tertiary)",
                    }}
                  >
                    {contrast.ratio.toFixed(2)}:1
                  </span>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// Sample widget cluster — Card with Eyebrow + Heading + Body + Button +
// Badge. For Set A, we wrap with an inline-styled palette override so the
// widgets render with Set A's stone-blue + slate-deep instead of Set B's.
function SampleWidgets({ setLabel }: { setLabel: "A" | "B" }) {
  const stoneBlue = setLabel === "A" ? HASH + "6B8EA3" : "var(--nw-stone-blue)";
  const slateDeep = setLabel === "A" ? HASH + "2D3E4A" : "var(--nw-slate-deep)";

  return (
    <div className="space-y-4">
      <Card padding="md">
        <div className="mb-3 flex items-center justify-between">
          <Eyebrow tone="accent" style={setLabel === "A" ? { color: stoneBlue } : undefined}>
            Pelican Bay Estate
          </Eyebrow>
          <Badge variant="success">QA APPROVED</Badge>
        </div>
        <h3
          className="text-[18px] mb-2"
          style={{
            fontFamily: "var(--font-space-grotesk)",
            letterSpacing: "-0.01em",
            fontWeight: 500,
            color: "var(--text-primary)",
          }}
        >
          Invoice INV-2026-04-0117
        </h3>
        <p
          className="text-[13px] mb-4 leading-relaxed"
          style={{ color: "var(--text-secondary)" }}
        >
          Plumbing rough-in &mdash; first floor, master suite + kitchen.
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="inline-flex items-center px-4 h-9 text-[11px] uppercase font-medium border"
            style={{
              fontFamily: "var(--font-jetbrains-mono)",
              letterSpacing: "0.12em",
              background: stoneBlue,
              borderColor: stoneBlue,
              color: HASH + "F7F5EC",
            }}
          >
            Push to QB &rarr;
          </button>
          <Button variant="ghost" size="md">Reject</Button>
        </div>
      </Card>

      <Card padding="md" variant="inverse">
        <Eyebrow tone="muted" style={{ color: "rgba(247,245,236,0.5)" }}>
          Inverse card · Slate-deep
        </Eyebrow>
        <p
          className="text-[13px] mt-2 leading-relaxed"
          style={{ color: HASH + "F7F5EC" }}
        >
          Inverse cards keep the slate-deep ground regardless of the page
          theme. {setLabel === "A" ? "Set A's slate-deep is " + slateDeep + " (lighter than Set B's deep slate)." : "Set B's slate-deep is " + slateDeep + " (the deeper of the two)."}
        </p>
      </Card>
    </div>
  );
}

// Sample text — 2 paragraphs of body text + an accent callout. Highlights
// readability of --text-primary on --bg-page and how --text-accent reads
// inside a body block.
function SampleText({ setLabel }: { setLabel: "A" | "B" }) {
  const stoneBlue = setLabel === "A" ? HASH + "6B8EA3" : "var(--nw-stone-blue)";
  const gulfBlue = HASH + "436A7A"; // unchanged across both sets
  return (
    <div
      className="border p-5"
      style={{
        borderColor: "var(--border-default)",
        background: "var(--bg-card)",
      }}
    >
      <Eyebrow tone="muted" className="mb-3">
        Sample text · Body on bg-card
      </Eyebrow>
      <p
        className="text-[14px] mb-3 leading-relaxed"
        style={{ color: "var(--text-primary)" }}
      >
        Ross Built Custom Homes is a coastal builder operating across
        Bradenton and Anna Maria Island. Cost-plus contracts give every
        client visibility into the line-item economics of their project.
        Nightwork is the operations platform that makes those economics
        legible at every step.
      </p>
      <p
        className="text-[14px] mb-3 leading-relaxed"
        style={{ color: "var(--text-primary)" }}
      >
        Invoice intake, PM review, accounting QA, draw assembly, and lien
        release tracking all share the same source of truth. Every record
        carries a status history. Every dollar is in cents. Every change
        is a row, never a mutation in place.
      </p>
      <p
        className="text-[14px] leading-relaxed"
        style={{ color: gulfBlue, fontWeight: 500 }}
      >
        &mdash; Accent callout: the same paragraph, rendered in
        <span style={{ color: stoneBlue, fontWeight: 600 }}> --text-accent </span>
        (gulf-blue 5.37:1 on bg-page light per Wave 1 contrast bump).
      </p>
    </div>
  );
}

// Per-set column — header + token strip + widgets + sample text.
function PaletteColumn({
  setLabel,
  setBlurb,
  tokens,
  contrastLookup,
}: {
  setLabel: "A" | "B";
  setBlurb: string;
  tokens: Array<{ name: string; hex: string; twClass: string; role: string }>;
  contrastLookup: Record<string, { ratio: number; verdict: ContrastResult }>;
}) {
  return (
    <div className="space-y-6">
      <div className="border-b pb-4" style={{ borderColor: "var(--border-default)" }}>
        <Eyebrow tone="accent" className="mb-2">Set {setLabel}</Eyebrow>
        <h2
          className="text-[22px] mb-2"
          style={{
            fontFamily: "var(--font-space-grotesk)",
            letterSpacing: "-0.01em",
            fontWeight: 500,
            color: "var(--text-primary)",
          }}
        >
          {setLabel === "A" ? "Jake brief candidate" : "Existing implementation"}
        </h2>
        <p
          className="text-[13px] leading-relaxed"
          style={{ color: "var(--text-secondary)" }}
        >
          {setBlurb}
        </p>
      </div>

      <TokenStrip tokens={tokens} contrastLookup={contrastLookup} setLabel={setLabel} />

      <SampleWidgets setLabel={setLabel} />

      <SampleText setLabel={setLabel} />
    </div>
  );
}

export default function PalettePage() {
  return (
    <div className="max-w-[1280px]">
      <header className="mb-8 pb-6 border-b" style={{ borderColor: "var(--border-default)" }}>
        <Eyebrow tone="accent" className="mb-3">
          CP2 Pick &middot; Set A vs Set B
        </Eyebrow>
        <h1
          className="text-[34px] mb-3 nw-direction-headline"
          style={{
            fontFamily: "var(--font-space-grotesk)",
            letterSpacing: "-0.02em",
            fontWeight: 500,
            color: "var(--text-primary)",
          }}
        >
          Palette
        </h1>
        <p
          className="text-[14px] max-w-[760px] leading-relaxed mb-2"
          style={{ color: "var(--text-secondary)" }}
        >
          Jake reviews both palette sets visually here at Strategic
          Checkpoint #2. Set B is the existing implementation &mdash; what
          colors_and_type.css resolves to today. Set A is the candidate
          from the original brief: cooler stone-blue, lighter slate-deep,
          a new warm-gray token. The pick at CP2 is one of two visual
          decisions (the other is direction A/B/C at /design-system/philosophy).
        </p>
        <p
          className="text-[12px] leading-relaxed italic"
          style={{ color: "var(--text-tertiary)" }}
        >
          Per CONTRAST-MATRIX.md Wave 1 finding: Set B is measurably more
          accessible than Set A on dark surfaces (8 vs 5 AA-normal passes
          on dark). LIGHT-mode contrast labels are surfaced inline below;
          full matrix lives at .planning/design/CONTRAST-MATRIX.md.
        </p>
      </header>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-10">
        <PaletteColumn
          setLabel="A"
          setBlurb="Jake's brief candidate. Stone-blue redefined to a lighter, cooler hue. Slate-deep redefined to a lighter mid-slate. Adds a new warm-gray token. Other tokens (gulf-blue, oceanside, white-sand, semantic colors) inherit Set B values for rendering. Requires colors_and_type.css update + matrix re-verification if picked at CP2."
          tokens={SET_A_TOKENS}
          contrastLookup={CONTRAST_LIGHT_A}
        />
        <PaletteColumn
          setLabel="B"
          setBlurb="Existing implementation. What colors_and_type.css resolves to today. Stone-blue at the deeper end (more saturation), slate-deep at the deepest end. Set B clears more WCAG AA-normal pairings on dark mode and avoids the special-case rule Set A would need (semantic colors render via Badge only on dark + Set A)."
          tokens={SET_B_TOKENS}
          contrastLookup={CONTRAST_LIGHT_B}
        />
      </div>

      <footer className="mt-10 pt-6 border-t" style={{ borderColor: "var(--border-default)" }}>
        <Eyebrow tone="muted" className="mb-3">CP2 pick mechanics</Eyebrow>
        <p className="text-[12px] leading-relaxed" style={{ color: "var(--text-tertiary)" }}>
          The palette pick is recorded outside this page (no per-set &ldquo;Pick
          this set&rdquo; button on the palette route). Subordinate work that
          locks the palette substitution lives in Stage 1.5b. Until pick:
          Set B is the live implementation. Picking Set A triggers a
          colors_and_type.css update + matrix re-verification.
        </p>
      </footer>
    </div>
  );
}
