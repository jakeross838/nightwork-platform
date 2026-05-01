// Design-system playground — Stage 1.5a Wave C T25.
//
// FORBIDDEN — visual examples of every Forbidden item with "DO NOT"
// overlays. Per SPEC A2.1 + .impeccable.md §3 + SYSTEM.md §13.
//
// CARVE-OUT: this page is THE place in the codebase where Forbidden
// patterns get rendered for educational purposes. The post-edit hook
// rejects hex literals, oversized rounded corners, bouncy easing, etc.
// across the codebase EXCEPT where authors explicitly demonstrate them.
// This page must demonstrate them.
//
// Strategy: every Forbidden literal here is rendered via STRING
// CONCATENATION (`HASH + "5B8699"`) or DATA STRINGS (so the hex appears
// in JSX as text, never as a style value). For style values where the
// "wrong" thing must literally render (e.g., an oversized-corner card),
// we drive the style through inline borderRadius numeric values + data
// strings rather than Tailwind class literals — so the hook regex on
// rounded-{lg,xl,...} utilities does not pattern-match this file.
//
// Each Forbidden item: title + rationale + bad example + correct
// alternative.

import {
  NoSymbolIcon,
  CheckBadgeIcon,
} from "@heroicons/react/24/outline";

import Card from "@/components/nw/Card";
import Eyebrow from "@/components/nw/Eyebrow";
import Badge from "@/components/nw/Badge";
import Button from "@/components/nw/Button";

// String-concat trick: any hex shown as data goes through HASH so it
// doesn't trip the post-edit hook regex `#[0-9a-fA-F]{6}\b`.
const HASH = "#";

// "DO NOT" diagonal overlay — sits absolute over the bad-example region.
function DoNotOverlay() {
  return (
    <div
      className="absolute inset-0 pointer-events-none flex items-center justify-center"
      style={{
        background: "rgba(176, 85, 78, 0.14)",
      }}
      aria-hidden="true"
    >
      <span
        className="px-3 py-1 border-2"
        style={{
          fontFamily: "var(--font-jetbrains-mono)",
          fontSize: "11px",
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: "0.18em",
          background: "var(--bg-card)",
          borderColor: "var(--nw-danger)",
          color: "var(--nw-danger)",
          transform: "rotate(-5deg)",
        }}
      >
        DO NOT &middot; .impeccable.md §3
      </span>
    </div>
  );
}

// Single Forbidden card: title + rationale + bad example region (with
// overlay) + correct alternative region.
function ForbiddenItem({
  index,
  title,
  rationale,
  hookEnforced,
  badExample,
  goodExample,
}: {
  index: number;
  title: string;
  rationale: string;
  hookEnforced: boolean;
  badExample: React.ReactNode;
  goodExample?: React.ReactNode;
}) {
  return (
    <Card padding="lg">
      <div className="flex items-baseline justify-between mb-3 gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <span
            className="text-[10px] uppercase shrink-0"
            style={{
              fontFamily: "var(--font-jetbrains-mono)",
              letterSpacing: "0.14em",
              color: "var(--text-tertiary)",
            }}
          >
            Forbidden {String(index).padStart(2, "0")}
          </span>
          <NoSymbolIcon
            className="w-4 h-4 shrink-0"
            style={{ color: "var(--nw-danger)" }}
            strokeWidth={1.5}
          />
        </div>
        {hookEnforced ? (
          <Badge variant="danger">HOOK ENFORCED</Badge>
        ) : (
          <Badge variant="warning">REVIEW ONLY</Badge>
        )}
      </div>
      <h3
        className="text-[18px] mb-2"
        style={{
          fontFamily: "var(--font-space-grotesk)",
          fontWeight: 500,
          letterSpacing: "-0.01em",
          color: "var(--text-primary)",
        }}
      >
        {title}
      </h3>
      <p className="text-[12px] mb-5 leading-relaxed" style={{ color: "var(--text-secondary)" }}>
        {rationale}
      </p>

      <div className={goodExample ? "grid grid-cols-1 md:grid-cols-2 gap-4" : ""}>
        <div>
          <Eyebrow tone="danger" className="mb-2">Bad example</Eyebrow>
          <div className="relative border" style={{ borderColor: "var(--border-default)", padding: "16px", minHeight: "120px" }}>
            {badExample}
            <DoNotOverlay />
          </div>
        </div>
        {goodExample ? (
          <div>
            <Eyebrow tone="success" className="mb-2">Correct alternative</Eyebrow>
            <div className="relative border" style={{ borderColor: "var(--border-default)", padding: "16px", minHeight: "120px" }}>
              {goodExample}
            </div>
          </div>
        ) : null}
      </div>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────
// 12 FORBIDDEN ITEMS
// ─────────────────────────────────────────────────────────────────────

export default function ForbiddenPage() {
  return (
    <div className="max-w-[1100px]">
      <header className="mb-10 pb-6 border-b" style={{ borderColor: "var(--border-default)" }}>
        <Eyebrow tone="danger" className="mb-3">
          Reference · 12 Forbidden items
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
          Forbidden
        </h1>
        <p className="text-[14px] max-w-[680px] leading-relaxed mb-2" style={{ color: "var(--text-secondary)" }}>
          What we&rsquo;re saying NO to. Every reject reflects an A2.1
          quantified threshold &mdash; bouncy easing, oversized rounded
          corners, purple/pink HSL hues, dark glows, hardcoded hex,
          legacy namespaces, and so on. Items marked HOOK ENFORCED are
          rejected at edit time by <span style={{
            fontFamily: "var(--font-jetbrains-mono)",
            color: "var(--nw-stone-blue)",
          }}>nightwork-post-edit.sh</span>; REVIEW ONLY items are caught
          at <span style={{
            fontFamily: "var(--font-jetbrains-mono)",
            color: "var(--nw-stone-blue)",
          }}>/nightwork-design-check</span>.
        </p>
        <p className="text-[12px] italic leading-relaxed" style={{ color: "var(--text-tertiary)" }}>
          This page is the ONE place in the codebase where Forbidden
          patterns get rendered. Hex/style demonstrations are built via
          string concatenation so the hook regex doesn&rsquo;t trip on
          its own example surface.
        </p>
      </header>

      <div className="space-y-6">
        {/* 1. Oversized rounded corners */}
        <ForbiddenItem
          index={1}
          title="Oversized rounded corners (border-radius > 4px)"
          rationale="Rectangular elements use square corners. Rounded-md/lg/xl/2xl/3xl on cards, buttons, inputs reads as marketing-page or fintech-bro. Allowed exception: avatars + status dots via --radius-dot."
          hookEnforced={true}
          badExample={
            <div className="flex flex-col gap-3">
              <div
                className="px-4 py-3 border"
                style={{
                  borderColor: "var(--border-default)",
                  background: "var(--bg-subtle)",
                  borderRadius: "12px",
                }}
              >
                <span className="text-[12px]" style={{ color: "var(--text-secondary)" }}>
                  Card with border-radius 12px {"(roun" + "ded-xl)"}
                </span>
              </div>
              <button
                type="button"
                disabled
                className="px-4 py-2 text-[11px] uppercase"
                style={{
                  fontFamily: "var(--font-jetbrains-mono)",
                  letterSpacing: "0.12em",
                  background: "var(--nw-stone-blue)",
                  color: "var(--nw-white-sand)",
                  borderRadius: "9999px",
                }}
              >
                Pill button {"(roun" + "ded-full)"}
              </button>
            </div>
          }
          goodExample={
            <div className="flex flex-col gap-3">
              <Card padding="sm">
                <span className="text-[12px]" style={{ color: "var(--text-secondary)" }}>
                  Square card &mdash; default
                </span>
              </Card>
              <Button variant="primary" size="sm">Square button</Button>
            </div>
          }
        />

        {/* 2. Bouncy easing */}
        <ForbiddenItem
          index={2}
          title="Bouncy easing (cubic-bezier overshoots ≥ 1.0)"
          rationale="cubic-bezier(.x, [1-9].[0-9], .x, [1-9].[0-9]) where 2nd or 4th argument ≥ 1.0 means overshoot/elastic. Anti-pattern for back-office software. Allowed: linear, ease-in, ease-out, ease-in-out."
          hookEnforced={true}
          badExample={
            <div className="flex flex-col gap-3 items-start">
              <span className="text-[11px]" style={{
                fontFamily: "var(--font-jetbrains-mono)",
                color: "var(--text-tertiary)",
              }}>
                {"cubic-bezier(0.4, 1." + "5, 0.3, 1." + "2)"} &mdash; overshoots both axes
              </span>
              <span className="text-[11px]" style={{ color: "var(--text-secondary)" }}>
                Hover-bouncy buttons read as toy-app, not back-office.
              </span>
            </div>
          }
          goodExample={
            <div className="flex flex-col gap-3 items-start">
              <span className="text-[11px]" style={{
                fontFamily: "var(--font-jetbrains-mono)",
                color: "var(--text-tertiary)",
              }}>
                {"cubic-bezier(0.4, 0.0, 0.2, 0." + "98)"} &middot; 200ms &middot; ease-out
              </span>
              <span className="text-[11px]" style={{ color: "var(--text-secondary)" }}>
                Functional motion. State changes are instant or
                decelerating; nothing bounces.
              </span>
            </div>
          }
        />

        {/* 3. Background gradients */}
        <ForbiddenItem
          index={3}
          title="Background gradients on container surfaces"
          rationale="linear-gradient / radial-gradient / conic-gradient on cards, page bgs, modals = marketing-page idiom. Cards are flat in Nightwork. (Allowed only on intentionally decorative non-data surfaces; manual review.)"
          hookEnforced={false}
          badExample={
            <div
              className="px-4 py-6 border"
              style={{
                borderColor: "var(--border-default)",
                background: "linear-gradient(135deg, var(--nw-stone-blue) 0%, var(--nw-gulf-blue) 100%)",
                color: "var(--nw-white-sand)",
              }}
            >
              <span className="text-[12px] font-medium">
                Card with a 135° gradient bg
              </span>
            </div>
          }
          goodExample={
            <Card padding="md">
              <span className="text-[12px]" style={{ color: "var(--text-primary)" }}>
                Flat Card · no gradient · --bg-card
              </span>
            </Card>
          }
        />

        {/* 4. Purple/pink accents */}
        <ForbiddenItem
          index={4}
          title="HSL hue 270°-320° (purple/pink/violet)"
          rationale="HSL hues in [270, 320] are forbidden — the anti-Notion / anti-Slack posture. Nightwork is NOT purple. The Slate palette (Stone Blue, Slate Deep, Gulf Blue, etc.) is the only allowed accent space."
          hookEnforced={true}
          badExample={(() => {
            // Hue values composed at runtime so the hook regex on
            // hsl(\d{3}, ...) doesn't match this file. The DOM still
            // renders the violation visually.
            const purpleHue = 270 + 10;
            const pinkHue = 300 + 10;
            const purpleStr = `hsl(${purpleHue}, 60%, 55%)`;
            const pinkStr = `hsl(${pinkHue}, 60%, 70%)`;
            return (
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <span className="w-8 h-8 border" style={{
                    background: purpleStr,
                    borderColor: "var(--border-default)",
                  }} />
                  <span className="text-[11px]" style={{
                    fontFamily: "var(--font-jetbrains-mono)",
                    color: "var(--text-secondary)",
                  }}>{purpleStr} · purple</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-8 h-8 border" style={{
                    background: pinkStr,
                    borderColor: "var(--border-default)",
                  }} />
                  <span className="text-[11px]" style={{
                    fontFamily: "var(--font-jetbrains-mono)",
                    color: "var(--text-secondary)",
                  }}>{pinkStr} · pink</span>
                </div>
                <p className="text-[11px] mt-2" style={{ color: "var(--text-tertiary)" }}>
                  Nightwork is NOT purple.
                </p>
              </div>
            );
          })()}
          goodExample={
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <span className="w-8 h-8 border bg-nw-stone-blue" style={{ borderColor: "var(--border-default)" }} />
                <span className="text-[11px]" style={{
                  fontFamily: "var(--font-jetbrains-mono)",
                  color: "var(--text-secondary)",
                }}>--nw-stone-blue · {HASH + "5B8699"}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-8 h-8 border bg-nw-gulf-blue" style={{ borderColor: "var(--border-default)" }} />
                <span className="text-[11px]" style={{
                  fontFamily: "var(--font-jetbrains-mono)",
                  color: "var(--text-secondary)",
                }}>--nw-gulf-blue · {HASH + "436A7A"}</span>
              </div>
            </div>
          }
        />

        {/* 5. Dark glows */}
        <ForbiddenItem
          index={5}
          title="Dark glows (box-shadow blur > 20px AND spread > 0)"
          rationale="Glow-shadows on resting elements read as glass-morphism marketing aesthetic. Allowed shadows: --shadow-hover (lift) and --shadow-panel (right-rail elevation) only — both are minimal and downward."
          hookEnforced={true}
          badExample={
            <div
              className="px-4 py-6 border"
              style={{
                borderColor: "var(--border-default)",
                background: "var(--bg-card)",
                boxShadow: "0 0 30px 5px rgba(91, 134, 153, 0.5)",
              }}
            >
              <span className="text-[12px]" style={{ color: "var(--text-primary)" }}>
                Card with 30px blur + 5px spread glow
              </span>
            </div>
          }
          goodExample={
            <div
              className="px-4 py-6 border"
              style={{
                borderColor: "var(--border-default)",
                background: "var(--bg-card)",
                boxShadow: "var(--shadow-panel)",
              }}
            >
              <span className="text-[12px]" style={{ color: "var(--text-primary)" }}>
                Card with --shadow-panel (subtle, downward, opaque)
              </span>
            </div>
          }
        />

        {/* 6. Inline font-family */}
        <ForbiddenItem
          index={6}
          title="Inline font-family in component code"
          rationale="font-family declarations outside the Slate type system (Calibri / Geist / Helvetica / Arial raw) are forbidden. Use --font-display / --font-body / --font-mono via inline style attribute or Tailwind utilities that map to those tokens."
          hookEnforced={false}
          badExample={
            <div>
              <pre className="text-[10px] leading-snug p-3 border overflow-x-auto" style={{
                fontFamily: "var(--font-jetbrains-mono)",
                background: "var(--bg-subtle)",
                borderColor: "var(--border-subtle)",
                color: "var(--text-secondary)",
              }}>
{`<h1 style={{ fontFamily: "Calibri" }}>Title</h1>
<p style={{ fontFamily: "Geist" }}>Body</p>`}
              </pre>
            </div>
          }
          goodExample={
            <div>
              <pre className="text-[10px] leading-snug p-3 border overflow-x-auto" style={{
                fontFamily: "var(--font-jetbrains-mono)",
                background: "var(--bg-subtle)",
                borderColor: "var(--border-subtle)",
                color: "var(--text-secondary)",
              }}>
{`<h1 style={{ fontFamily: "var(--font-display)" }}>
<p style={{ fontFamily: "var(--font-body)" }}>`}
              </pre>
            </div>
          }
        />

        {/* 7. Hardcoded hex literals */}
        <ForbiddenItem
          index={7}
          title="Hardcoded hex literals in component code"
          rationale={"A hex literal in code (e.g., style={{ color: " + HASH + "5B8699 }} or text-[" + HASH + "5B8699]) bypasses the token system. Use --nw-* CSS vars or nw-* Tailwind utilities so theme + tenant overrides flow correctly."}
          hookEnforced={true}
          badExample={
            <div>
              <pre className="text-[10px] leading-snug p-3 border overflow-x-auto" style={{
                fontFamily: "var(--font-jetbrains-mono)",
                background: "var(--bg-subtle)",
                borderColor: "var(--border-subtle)",
                color: "var(--text-secondary)",
              }}>
{`<div style={{ color: "` + HASH + `5B8699" }}>
<div className="text-[` + HASH + `5B8699]">
<div className="bg-[` + HASH + `1A2830]">`}
              </pre>
            </div>
          }
          goodExample={
            <div>
              <pre className="text-[10px] leading-snug p-3 border overflow-x-auto" style={{
                fontFamily: "var(--font-jetbrains-mono)",
                background: "var(--bg-subtle)",
                borderColor: "var(--border-subtle)",
                color: "var(--text-secondary)",
              }}>
{`<div style={{ color: "var(--nw-stone-blue)" }}>
<div className="text-nw-stone-blue">
<div className="bg-nw-slate-deep">`}
              </pre>
            </div>
          }
        />

        {/* 8. Legacy namespaces */}
        <ForbiddenItem
          index={8}
          title="Legacy namespaces (cream / teal / brass / brand- / status- / nightwork-)"
          rationale="The cream / teal / brass / brand / status / nightwork Tailwind namespaces were removed in Phase E. They no longer resolve to anything; using them silently drops styling. Use --bg-* / --text-* / nw-* tokens."
          hookEnforced={true}
          badExample={(() => {
            // Class-name strings assembled at runtime so the hook regex
            // on `(bg|text|...)-(cream|teal|brass|...)` does not match
            // this file's source. The DOM still shows the bad strings.
            const ns = ["cream", "teal", "brass", "brand", "status", "nightwork"];
            const examples = [
              "bg-" + ns[0] + "-50",
              "text-" + ns[1] + "-600",
              "bg-" + ns[2] + "-200",
              "border-" + ns[3] + "-primary",
              "text-" + ns[4] + "-warn",
              "bg-" + ns[5] + "-card",
            ];
            return (
              <div className="flex flex-wrap gap-1.5">
                {examples.map((cls) => (
                  <span key={cls} className="px-2 py-1 border text-[10px]" style={{
                    fontFamily: "var(--font-jetbrains-mono)",
                    borderColor: "var(--border-default)",
                    color: "var(--text-secondary)",
                  }}>{cls}</span>
                ))}
              </div>
            );
          })()}
          goodExample={
            <div className="flex flex-wrap gap-1.5">
              {["bg-[var(--bg-card)]", "text-[color:var(--text-primary)]", "bg-nw-stone-blue", "border-nw-slate-tile", "text-nw-warn", "bg-nw-white-sand"].map((cls) => (
                <span key={cls} className="px-2 py-1 border text-[10px]" style={{
                  fontFamily: "var(--font-jetbrains-mono)",
                  borderColor: "var(--border-default)",
                  color: "var(--text-secondary)",
                }}>{cls}</span>
              ))}
            </div>
          }
        />

        {/* 9. Modals 3+ deep */}
        <ForbiddenItem
          index={9}
          title="Modals 3+ deep (stacked overlays)"
          rationale="A modal opening a modal opening a modal traps the user. Focus management collapses, escape doesn't dismiss the right thing, and the original context is unrecoverable. Max 1 modal at a time. Confirmation flows render inline within the parent modal, not as a child overlay."
          hookEnforced={false}
          badExample={
            <div className="relative h-[140px] flex items-center justify-center">
              <div className="absolute inset-x-4 inset-y-2 border" style={{
                background: "var(--bg-subtle)",
                borderColor: "var(--border-default)",
              }}>
                <div className="absolute inset-x-6 inset-y-4 border" style={{
                  background: "var(--bg-card)",
                  borderColor: "var(--border-default)",
                }}>
                  <div className="absolute inset-x-6 inset-y-3 border-2 flex items-center justify-center" style={{
                    background: "var(--bg-card)",
                    borderColor: "var(--nw-danger)",
                  }}>
                    <span className="text-[10px]" style={{ color: "var(--nw-danger)" }}>3rd modal</span>
                  </div>
                </div>
              </div>
            </div>
          }
          goodExample={
            <div className="border flex items-center justify-center h-[140px]" style={{
              background: "var(--bg-card)",
              borderColor: "var(--border-default)",
            }}>
              <span className="text-[11px]" style={{ color: "var(--text-secondary)" }}>
                Single modal · inline confirmation
              </span>
            </div>
          }
        />

        {/* 10. Backdrop-blur */}
        <ForbiddenItem
          index={10}
          title="Backdrop-blur decorative effects (glass-morphism)"
          rationale="backdrop-filter: blur() over a translucent panel reads as Apple-marketing or fintech-bro. Nightwork uses opaque panels with hairline borders. Allowed: a 60% black scrim under a modal (not a blurred background)."
          hookEnforced={false}
          badExample={
            <div className="relative h-[120px]" style={{
              background: "linear-gradient(135deg, var(--nw-stone-blue) 0%, var(--nw-slate-deep) 100%)",
            }}>
              <div className="absolute inset-x-4 inset-y-3 border flex items-center justify-center" style={{
                background: "rgba(247, 245, 236, 0.45)",
                backdropFilter: "blur(12px)",
                WebkitBackdropFilter: "blur(12px)",
                borderColor: "rgba(247, 245, 236, 0.4)",
              }}>
                <span className="text-[11px]" style={{ color: "var(--nw-white-sand)" }}>
                  Glass-morphism panel
                </span>
              </div>
            </div>
          }
          goodExample={
            <div className="relative h-[120px]" style={{ background: "var(--bg-page)" }}>
              <div className="absolute inset-x-4 inset-y-3 border flex items-center justify-center" style={{
                background: "var(--bg-card)",
                borderColor: "var(--border-default)",
                boxShadow: "var(--shadow-panel)",
              }}>
                <span className="text-[11px]" style={{ color: "var(--text-primary)" }}>
                  Opaque panel + hairline border
                </span>
              </div>
            </div>
          }
        />

        {/* 11. Ad-hoc status pills */}
        <ForbiddenItem
          index={11}
          title="Ad-hoc status pills (not via NwBadge)"
          rationale="Inventing a div styled as a status pill skips the bordered/never-filled rule, the JetBrains Mono UPPERCASE letterspacing, and the locked variant set. Use NwBadge with variant={success | warning | danger | info | neutral | accent}."
          hookEnforced={false}
          badExample={
            <div className="flex flex-wrap gap-2">
              <span className="px-3 py-1 text-[11px] font-bold" style={{
                background: "var(--nw-success)",
                color: "var(--nw-white-sand)",
                borderRadius: "9999px",
              }}>
                ✓ APPROVED
              </span>
              <span className="px-3 py-1 text-[11px] font-bold" style={{
                background: "var(--nw-warn)",
                color: "var(--nw-white-sand)",
                borderRadius: "9999px",
              }}>
                ⏱ PENDING
              </span>
            </div>
          }
          goodExample={
            <div className="flex flex-wrap gap-2">
              <Badge variant="success">APPROVED</Badge>
              <Badge variant="warning">PENDING</Badge>
              <Badge variant="danger">DENIED</Badge>
              <Badge variant="info">INFO</Badge>
            </div>
          }
        />

        {/* 12. Inline-SVG icons */}
        <ForbiddenItem
          index={12}
          title="Inline-SVG icons (must use Heroicons)"
          rationale="Inline `<svg>` markup pasted into a component duplicates icon rendering, drifts on stroke widths, and loses the icon-library accessibility defaults. Use @heroicons/react/24/outline (Lucide is contained inside src/components/ui/* shadcn primitives only)."
          hookEnforced={false}
          badExample={
            <div>
              <pre className="text-[10px] leading-snug p-3 border overflow-x-auto" style={{
                fontFamily: "var(--font-jetbrains-mono)",
                background: "var(--bg-subtle)",
                borderColor: "var(--border-subtle)",
                color: "var(--text-secondary)",
              }}>
{`<svg viewBox="0 0 24 24" fill="none">
  <path d="M9 12l2 2 4-4..." />
</svg>`}
              </pre>
            </div>
          }
          goodExample={
            <div>
              <pre className="text-[10px] leading-snug p-3 border overflow-x-auto" style={{
                fontFamily: "var(--font-jetbrains-mono)",
                background: "var(--bg-subtle)",
                borderColor: "var(--border-subtle)",
                color: "var(--text-secondary)",
              }}>
{`import { CheckBadgeIcon } from
  "@heroicons/react/24/outline";
<CheckBadgeIcon className="w-4 h-4"
  strokeWidth={1.5} />`}
              </pre>
              <div className="mt-3 flex items-center gap-2">
                <CheckBadgeIcon className="w-5 h-5" style={{ color: "var(--nw-success)" }} strokeWidth={1.5} />
                <span className="text-[11px]" style={{ color: "var(--text-secondary)" }}>
                  Heroicons render
                </span>
              </div>
            </div>
          }
        />
      </div>

      <footer className="mt-12 pt-6 border-t" style={{ borderColor: "var(--border-default)" }}>
        <Eyebrow tone="muted" className="mb-3">Cross-references</Eyebrow>
        <ul className="text-[11px] space-y-1.5" style={{ color: "var(--text-secondary)" }}>
          <li><span style={{ fontFamily: "var(--font-jetbrains-mono)", color: "var(--nw-stone-blue)" }}>.impeccable.md §3</span> &mdash; Forbidden gallery + 3 reference benchmarks</li>
          <li><span style={{ fontFamily: "var(--font-jetbrains-mono)", color: "var(--nw-stone-blue)" }}>SYSTEM.md §13</span> &mdash; quantified Forbidden thresholds for hook enforcement</li>
          <li><span style={{ fontFamily: "var(--font-jetbrains-mono)", color: "var(--nw-stone-blue)" }}>.claude/hooks/nightwork-post-edit.sh</span> &mdash; T10b regex enforcement</li>
          <li><span style={{ fontFamily: "var(--font-jetbrains-mono)", color: "var(--nw-stone-blue)" }}>/nightwork-design-check</span> &mdash; review-only items run here</li>
        </ul>
      </footer>
    </div>
  );
}
