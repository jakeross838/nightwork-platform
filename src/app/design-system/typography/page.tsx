// Design-system playground — Stage 1.5a Wave C T22.
//
// TYPOGRAPHY — full Slate type system render. Per SYSTEM.md §4 (Q2=B).
//
// Renders:
//   - Type scale (every --fs-* token at its actual size, 13 entries)
//   - Tracking demonstrations (every --tracking-* token on a sample word)
//   - Three families (Space Grotesk / Inter / JetBrains Mono — alphabet sample)
//   - Eyebrow render (4 hierarchies)
//   - Money render (5-10 cents-precision samples)
//   - Anti-pattern callouts (Calibri / Geist / Roboto — fonts banned per .impeccable.md)
//
// Token discipline: every color via --text-* / --bg-*; every type face via
// --font-display / --font-body / --font-mono. Anti-pattern callouts use
// inline `font-family: <fallback only>` so the visual contrast is obvious
// while NOT loading the banned face. This stays compliant with the
// post-edit hook's banned-font check (which catches `font-family:
// "Calibri"` etc. — we use `system-ui` placeholders + label-as-data).

import Card from "@/components/nw/Card";
import Eyebrow from "@/components/nw/Eyebrow";
import Money from "@/components/nw/Money";
import Badge from "@/components/nw/Badge";

// Type-scale entries lifted from SYSTEM.md §4b. 13 tokens total.
const TYPE_SCALE: Array<{
  token: string;
  px: number;
  family: "display" | "body" | "mono";
  use: string;
  sample: string;
}> = [
  { token: "--fs-label", px: 10, family: "mono", use: "Eyebrow size (UPPERCASE)", sample: "STATUS TIMELINE" },
  { token: "--fs-label-sm", px: 11, family: "mono", use: "Smaller eyebrow / Money sm", sample: "$1,234.56" },
  { token: "--fs-meta", px: 12, family: "mono", use: "Metadata, table column headers", sample: "APR 22 · 10:04 AM" },
  { token: "--fs-sm", px: 13, family: "body", use: "Default DataRow value, Money md", sample: "Pelican Bay Estate · Cost code 06101" },
  { token: "--fs-body", px: 14, family: "body", use: "Body text default", sample: "Plumbing rough-in — first floor, master suite + kitchen." },
  { token: "--fs-md", px: 15, family: "body", use: "globals.css body baseline", sample: "Cost-plus contracts give every client visibility into line-item economics." },
  { token: "--fs-lg", px: 17, family: "body", use: "Larger body / lead paragraph", sample: "Every record carries a status history." },
  { token: "--fs-xl", px: 20, family: "display", use: "Section heading-ish", sample: "Cost code allocation" },
  { token: "--fs-h3", px: 22, family: "mono", use: "Money xl (hero totals)", sample: "$87,500.00" },
  { token: "--fs-h2", px: 30, family: "display", use: "Page H2", sample: "Invoice INV-2026-04-0117" },
  { token: "--fs-h1", px: 38, family: "display", use: "Page H1", sample: "Welcome back, Jake." },
  { token: "--fs-display", px: 48, family: "display", use: "Display (rarely used internally)", sample: "Display" },
  { token: "--fs-hero", px: 60, family: "display", use: "Hero (marketing only)", sample: "Hero" },
];

const FAMILY_VAR: Record<"display" | "body" | "mono", string> = {
  display: "var(--font-space-grotesk)",
  body: "var(--font-inter)",
  mono: "var(--font-jetbrains-mono)",
};

const FAMILY_LABEL: Record<"display" | "body" | "mono", string> = {
  display: "Space Grotesk",
  body: "Inter",
  mono: "JetBrains Mono",
};

// Tracking entries from SYSTEM.md §4c.
const TRACKING_TOKENS: Array<{
  token: string;
  value: string;
  family: "display" | "body" | "mono";
  use: string;
  sample: string;
  uppercase: boolean;
}> = [
  { token: "--tracking-eyebrow", value: "0.14em", family: "mono", use: "Eyebrow.tsx, Badge.tsx", sample: "STATUS TIMELINE", uppercase: true },
  { token: "--tracking-button", value: "0.12em", family: "mono", use: "Button.tsx", sample: "PUSH TO QUICKBOOKS", uppercase: true },
  { token: "--tracking-tight", value: "-0.02em", family: "display", use: "Display headings (Space Grotesk)", sample: "Welcome back, Jake.", uppercase: false },
  { token: "--tracking-wordmark", value: "-0.03em", family: "display", use: "Logo wordmark", sample: "Nightwork", uppercase: false },
];

// Three families with their loaded weight set (per SYSTEM.md §4d).
const FAMILIES: Array<{
  family: "display" | "body" | "mono";
  loadedWeights: number[];
  notes: string;
}> = [
  {
    family: "display",
    loadedWeights: [400, 500],
    notes: "Display + headings + wordmark only. Weights 400/500 — never 600/700 (looks heavy on internal screens). Tracking -0.02em on display headings.",
  },
  {
    family: "body",
    loadedWeights: [300, 400, 500, 600, 700],
    notes: "Body text default 14-15px. 400 regular, 500 medium for emphasis. 700 reserved for dashboard KPI exception (the only weight 600+ in Helm + Brass per PHILOSOPHY.md §2.6).",
  },
  {
    family: "mono",
    loadedWeights: [400, 500, 600],
    notes: "Eyebrows + money + audit timestamps + status pills. UPPERCASE 10-11px with 0.14em tracking. tabular-nums on money values.",
  },
];

const ALPHABET_SAMPLE = "Aa Bb Cc Dd Ee Ff Gg Hh Ii Jj Kk Ll Mm Nn Oo Pp Qq Rr Ss Tt Uu Vv Ww Xx Yy Zz 0123456789";

// Money render examples — 5-10 cents-precision samples per spec.
const MONEY_SAMPLES: Array<{
  cents: number;
  variant: "default" | "negative" | "emphasized" | "muted";
  label: string;
}> = [
  { cents: 187_500_000, variant: "emphasized", label: "Hero contract total ($1.875M)" },
  { cents: 6_400_000, variant: "default", label: "Cabinet line item ($64,000)" },
  { cents: 1_860_000, variant: "default", label: "Plumbing rough-in ($18,600)" },
  { cents: 123_456, variant: "default", label: "Standard money ($1,234.56)" },
  { cents: 5_000_000, variant: "default", label: "Round figure ($50,000.00)" },
  { cents: -250_000, variant: "negative", label: "Credit memo (-$2,500.00)" },
  { cents: 0, variant: "muted", label: "Zero-balance row ($0.00)" },
  { cents: null as unknown as number, variant: "muted", label: "Null placeholder (em-dash)" },
];

// Eyebrow examples — different hierarchies.
const EYEBROW_SAMPLES: Array<{
  text: string;
  tone: "default" | "accent" | "warn" | "success" | "danger" | "muted";
  hierarchy: string;
}> = [
  { text: "Section header · Right-rail panel anchor", tone: "muted", hierarchy: "Section anchor" },
  { text: "Active control · Stone Blue active state", tone: "accent", hierarchy: "Active control / accent" },
  { text: "Pending review · 3 days waiting", tone: "warn", hierarchy: "Warning state" },
  { text: "QA approved · Maria D · Apr 22", tone: "success", hierarchy: "Success / completed" },
];

export default function TypographyPage() {
  return (
    <div className="max-w-[1200px]">
      <header className="mb-10 pb-6 border-b" style={{ borderColor: "var(--border-default)" }}>
        <Eyebrow tone="accent" className="mb-3">
          Reference · Slate type system locked
        </Eyebrow>
        <h1
          className="text-[34px] mb-3"
          style={{
            fontFamily: "var(--font-space-grotesk)",
            letterSpacing: "-0.02em",
            fontWeight: 500,
            color: "var(--text-primary)",
          }}
        >
          Typography
        </h1>
        <p
          className="text-[14px] max-w-[760px] leading-relaxed"
          style={{ color: "var(--text-secondary)" }}
        >
          Three families, 13-step type scale, four tracking tokens, square
          aesthetic. Body default 14-15px (NOT 16); eyebrows + money 10-11px
          UPPERCASE mono with 0.14em tracking. Calibri / Geist / Helvetica
          banned by hook on .tsx/.css edits per .impeccable.md §3.
        </p>
      </header>

      {/* SECTION 1 — TYPE SCALE */}
      <section className="mb-14">
        <Eyebrow tone="muted" className="mb-3">Type scale · 13 tokens · SYSTEM.md §4b</Eyebrow>
        <h2
          className="text-[22px] mb-4"
          style={{
            fontFamily: "var(--font-space-grotesk)",
            letterSpacing: "-0.01em",
            fontWeight: 500,
            color: "var(--text-primary)",
          }}
        >
          Type scale
        </h2>
        <Card padding="lg">
          <ul className="space-y-5">
            {TYPE_SCALE.map((entry) => (
              <li
                key={entry.token}
                className="grid grid-cols-1 md:grid-cols-[160px_1fr] gap-4 md:gap-6 pb-4 border-b last:border-b-0 last:pb-0"
                style={{ borderColor: "var(--border-subtle)" }}
              >
                <div className="space-y-1 shrink-0">
                  <div
                    className="text-[10px] uppercase font-medium"
                    style={{
                      fontFamily: "var(--font-jetbrains-mono)",
                      letterSpacing: "0.14em",
                      color: "var(--text-tertiary)",
                    }}
                  >
                    {entry.token}
                  </div>
                  <div
                    className="text-[11px]"
                    style={{
                      fontFamily: "var(--font-jetbrains-mono)",
                      color: "var(--text-secondary)",
                    }}
                  >
                    {entry.px}px &middot; {FAMILY_LABEL[entry.family]}
                  </div>
                  <div
                    className="text-[10px] leading-snug italic"
                    style={{ color: "var(--text-tertiary)" }}
                  >
                    {entry.use}
                  </div>
                </div>
                <div
                  className="min-w-0 break-words"
                  style={{
                    fontSize: entry.px,
                    fontFamily: FAMILY_VAR[entry.family],
                    fontWeight: entry.family === "display" ? 500 : entry.family === "mono" ? 500 : 400,
                    letterSpacing: entry.family === "display" ? "-0.02em" : entry.family === "mono" ? "0.06em" : undefined,
                    color: "var(--text-primary)",
                    lineHeight: 1.15,
                    fontVariantNumeric: entry.family === "mono" ? "tabular-nums" : undefined,
                  }}
                >
                  {entry.sample}
                </div>
              </li>
            ))}
          </ul>
        </Card>
      </section>

      {/* SECTION 2 — TRACKING */}
      <section className="mb-14">
        <Eyebrow tone="muted" className="mb-3">Tracking · 4 tokens · SYSTEM.md §4c</Eyebrow>
        <h2
          className="text-[22px] mb-4"
          style={{
            fontFamily: "var(--font-space-grotesk)",
            letterSpacing: "-0.01em",
            fontWeight: 500,
            color: "var(--text-primary)",
          }}
        >
          Tracking demonstrations
        </h2>
        <Card padding="lg">
          <ul className="space-y-6">
            {TRACKING_TOKENS.map((t) => (
              <li
                key={t.token}
                className="grid grid-cols-1 md:grid-cols-[200px_1fr] gap-3 md:gap-6 pb-5 border-b last:border-b-0 last:pb-0"
                style={{ borderColor: "var(--border-subtle)" }}
              >
                <div className="space-y-1">
                  <div
                    className="text-[10px] uppercase font-medium"
                    style={{
                      fontFamily: "var(--font-jetbrains-mono)",
                      letterSpacing: "0.14em",
                      color: "var(--text-tertiary)",
                    }}
                  >
                    {t.token}
                  </div>
                  <div
                    className="text-[11px]"
                    style={{
                      fontFamily: "var(--font-jetbrains-mono)",
                      color: "var(--text-secondary)",
                    }}
                  >
                    {t.value}
                  </div>
                  <div
                    className="text-[10px] leading-snug italic"
                    style={{ color: "var(--text-tertiary)" }}
                  >
                    {t.use}
                  </div>
                </div>
                <div
                  className="min-w-0 break-words"
                  style={{
                    fontSize: t.uppercase ? 14 : 28,
                    fontFamily: FAMILY_VAR[t.family],
                    fontWeight: t.family === "mono" ? 500 : t.family === "display" ? 500 : 400,
                    letterSpacing: t.value,
                    textTransform: t.uppercase ? "uppercase" : undefined,
                    color: "var(--text-primary)",
                    lineHeight: 1.2,
                  }}
                >
                  {t.sample}
                </div>
              </li>
            ))}
          </ul>
        </Card>
      </section>

      {/* SECTION 3 — THREE FAMILIES */}
      <section className="mb-14">
        <Eyebrow tone="muted" className="mb-3">Families · 3 faces · SYSTEM.md §4a · §4d</Eyebrow>
        <h2
          className="text-[22px] mb-4"
          style={{
            fontFamily: "var(--font-space-grotesk)",
            letterSpacing: "-0.01em",
            fontWeight: 500,
            color: "var(--text-primary)",
          }}
        >
          Three families
        </h2>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {FAMILIES.map((f) => (
            <Card key={f.family} padding="lg">
              <Eyebrow tone="accent" className="mb-3">
                {FAMILY_LABEL[f.family]}
              </Eyebrow>
              <h3
                className="text-[20px] mb-3"
                style={{
                  fontFamily: FAMILY_VAR[f.family],
                  fontWeight: f.family === "display" ? 500 : f.family === "mono" ? 500 : 400,
                  letterSpacing: f.family === "display" ? "-0.02em" : undefined,
                  color: "var(--text-primary)",
                }}
              >
                {FAMILY_LABEL[f.family]}
              </h3>
              <p
                className="text-[12px] mb-4 leading-relaxed"
                style={{ color: "var(--text-secondary)" }}
              >
                {f.notes}
              </p>
              <div className="space-y-3">
                {f.loadedWeights.map((w) => (
                  <div key={w}>
                    <div
                      className="text-[10px] uppercase mb-1"
                      style={{
                        fontFamily: "var(--font-jetbrains-mono)",
                        letterSpacing: "0.14em",
                        color: "var(--text-tertiary)",
                      }}
                    >
                      Weight {w}
                    </div>
                    <div
                      className="text-[14px] leading-snug break-words"
                      style={{
                        fontFamily: FAMILY_VAR[f.family],
                        fontWeight: w,
                        letterSpacing: f.family === "display" ? "-0.02em" : f.family === "mono" ? "0.04em" : undefined,
                        color: "var(--text-primary)",
                        fontVariantNumeric: f.family === "mono" ? "tabular-nums" : undefined,
                      }}
                    >
                      {ALPHABET_SAMPLE}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </div>
      </section>

      {/* SECTION 4 — EYEBROW HIERARCHIES */}
      <section className="mb-14">
        <Eyebrow tone="muted" className="mb-3">
          Eyebrow render · 4 hierarchies · NwEyebrow primitive
        </Eyebrow>
        <h2
          className="text-[22px] mb-4"
          style={{
            fontFamily: "var(--font-space-grotesk)",
            letterSpacing: "-0.01em",
            fontWeight: 500,
            color: "var(--text-primary)",
          }}
        >
          Eyebrows
        </h2>
        <Card padding="lg">
          <ul className="space-y-5">
            {EYEBROW_SAMPLES.map((e) => (
              <li
                key={e.text}
                className="grid grid-cols-1 md:grid-cols-[180px_1fr] gap-3 md:gap-6 pb-4 border-b last:border-b-0 last:pb-0"
                style={{ borderColor: "var(--border-subtle)" }}
              >
                <div
                  className="text-[10px] uppercase italic"
                  style={{
                    fontFamily: "var(--font-jetbrains-mono)",
                    letterSpacing: "0.1em",
                    color: "var(--text-tertiary)",
                  }}
                >
                  {e.hierarchy} &middot; tone={e.tone}
                </div>
                <Eyebrow tone={e.tone}>{e.text}</Eyebrow>
              </li>
            ))}
          </ul>
        </Card>
      </section>

      {/* SECTION 5 — MONEY RENDER */}
      <section className="mb-14">
        <Eyebrow tone="muted" className="mb-3">
          Money render · JetBrains Mono · tabular-nums · cents-precision
        </Eyebrow>
        <h2
          className="text-[22px] mb-4"
          style={{
            fontFamily: "var(--font-space-grotesk)",
            letterSpacing: "-0.01em",
            fontWeight: 500,
            color: "var(--text-primary)",
          }}
        >
          Money values
        </h2>
        <Card padding="lg">
          <ul className="space-y-3">
            {MONEY_SAMPLES.map((m, i) => (
              <li
                key={i}
                className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-2 md:gap-6 items-baseline pb-3 border-b last:border-b-0 last:pb-0"
                style={{ borderColor: "var(--border-subtle)" }}
              >
                <div
                  className="text-[12px] italic"
                  style={{ color: "var(--text-tertiary)" }}
                >
                  {m.label}
                </div>
                <Money cents={m.cents} variant={m.variant} size="lg" />
              </li>
            ))}
          </ul>
          <div
            className="mt-6 pt-4 border-t text-[11px] leading-relaxed"
            style={{
              borderColor: "var(--border-default)",
              color: "var(--text-tertiary)",
            }}
          >
            Money values store amounts in CENTS in the database (per
            CLAUDE.md &ldquo;amounts in cents&rdquo; rule). UI formats to
            dollars at display time. NwMoney wraps tabular-nums + JetBrains
            Mono + variant color (default / negative / emphasized / muted).
          </div>
        </Card>
      </section>

      {/* SECTION 6 — ANTI-PATTERNS (BANNED FONTS) */}
      <section>
        <Eyebrow tone="danger" className="mb-3">
          Anti-patterns · Banned fonts per .impeccable.md §3
        </Eyebrow>
        <h2
          className="text-[22px] mb-4"
          style={{
            fontFamily: "var(--font-space-grotesk)",
            letterSpacing: "-0.01em",
            fontWeight: 500,
            color: "var(--text-primary)",
          }}
        >
          Do not use
        </h2>
        <p
          className="text-[13px] mb-5 leading-relaxed max-w-[680px]"
          style={{ color: "var(--text-secondary)" }}
        >
          The post-edit hook rejects font-family declarations outside the
          Slate type system. Calibri appeared in earlier project notes as
          a paraphrase &mdash; corrected at Stage 1.5a Q2=B. Geist is the
          Vercel marketing font (wrong mood). Helvetica/Arial are too
          generic for construction back-office work. Use Space Grotesk /
          Inter / JetBrains Mono via --font-* tokens.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {[
            { banned: "Calibri", reason: "Office-document association &mdash; wrong tonal register for construction operations." },
            { banned: "Geist", reason: "Vercel marketing-page font &mdash; reads as launch-announcement, not back-office." },
            { banned: "Helvetica / Arial", reason: "Generic system fallback &mdash; lacks the deliberate type personality the Slate stack provides." },
          ].map((b) => (
            <Card key={b.banned} padding="md">
              <div className="flex items-center gap-2 mb-3">
                <Badge variant="danger">DO NOT</Badge>
                <Eyebrow tone="muted">font-family</Eyebrow>
              </div>
              <div
                className="text-[28px] mb-3"
                style={{
                  // Render in system fallback (NOT loading the banned face) —
                  // visual contrast comes from the obvious break in family
                  // continuity, not from invoking the banned face. The hook
                  // catches font-family literals; we keep banned face
                  // names as DATA strings (children) only.
                  fontFamily: "system-ui, sans-serif",
                  fontWeight: 400,
                  color: "var(--text-primary)",
                  letterSpacing: 0,
                }}
              >
                {b.banned}
              </div>
              <p
                className="text-[12px] leading-relaxed"
                style={{ color: "var(--text-tertiary)" }}
                dangerouslySetInnerHTML={{ __html: b.reason }}
              />
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
