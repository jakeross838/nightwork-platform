// Design-system playground — Stage 1.5a Wave C T24.
//
// PHILOSOPHY — THE CP2 DECISION SURFACE.
// Per nwrp17 + SPEC A17/A17a/A17b/A21:
//   "the visual playground at /design-system is the decision surface for CP2."
//
// Jake reviews 3 directions × 4 screen renders side-by-side here:
//   - Helm + Brass / Specimen / Site Office
//   - Invoice Review / Dashboard / Mobile Approval / Owner Portal
//
// Layout: 4-row × 3-column grid. Each row is a screen type. Each column
// is a direction. Each cell renders a SCALED-DOWN PREVIEW of that screen
// in that direction. Below the grid: 4 honest-weaknesses per direction
// and the Direction Comparison Matrix.
//
// The Pick affordance lives in T24.1 (separate file: ./pick-button.tsx +
// /api route + CHOSEN-DIRECTION marker). Until pick: we surface the 12
// renders + show a placeholder banner.
//
// Sample data: pulls from _fixtures/. Pelican Bay Estate / Coastal
// Carpentry Co. / cost code 06101 / amount $42,500 (a synthesized blend
// of fixture invoices for the canonical philosophy render).

import {
  DocumentTextIcon,
  ChartBarIcon,
  DevicePhoneMobileIcon,
  HomeModernIcon,
  LockClosedIcon,
  PaperClipIcon,
} from "@heroicons/react/24/outline";

import Card from "@/components/nw/Card";
import Eyebrow from "@/components/nw/Eyebrow";
import Badge from "@/components/nw/Badge";
import Money from "@/components/nw/Money";
import StatusDot from "@/components/nw/StatusDot";

import {
  SAMPLE_INVOICES,
  SAMPLE_VENDORS,
  SAMPLE_JOBS,
} from "@/app/design-system/_fixtures";
import PickDirectionPanel from "./pick-button";
import { readChosenDirection } from "@/lib/design-system/chosen-direction";

// Resolve a canonical sample invoice for renders (Pelican Bay Estate +
// Coastal Carpentry Co. + framing). We compose a synthesized record so
// the same vendor/job/code triplet appears in every direction.
const VENDOR_BY_ID = Object.fromEntries(SAMPLE_VENDORS.map((v) => [v.id, v]));
const JOB_BY_ID = Object.fromEntries(SAMPLE_JOBS.map((j) => [j.id, j]));

const HERO_INVOICE = {
  number: "CC-04-22B",
  vendor: VENDOR_BY_ID["v-coastal-carpentry"],
  job: JOB_BY_ID["j-pelican-bay"],
  costCode: "06101 · Framing — Rough Carpentry",
  amount: 4_250_000, // $42,500
  status: "PM REVIEW" as const,
  receivedAt: "Apr 22 · 10:04",
};

// Dashboard KPI mock — derived from SAMPLE_INVOICES.
const ACTIVE_JOBS = 5;
const PM_QUEUE = SAMPLE_INVOICES.filter((i) => i.status === "pm_review" || i.status === "ai_processed").length;
const MTD_INVOICED = SAMPLE_INVOICES.reduce((acc, i) => acc + i.total_amount, 0);
const HIGH_CONF = SAMPLE_INVOICES.filter((i) => i.confidence_score >= 0.85).length;

// Direction key + label tuple, used to drive every render.
const DIRECTIONS = [
  { key: "helm-brass" as const, label: "Helm + Brass", short: "Helm" },
  { key: "specimen" as const, label: "Specimen", short: "Specimen" },
  { key: "site-office" as const, label: "Site Office", short: "Site Office" },
];

type Direction = (typeof DIRECTIONS)[number]["key"];

// Per-direction theme tokens. These are PURE CSS tokens we already have in
// SYSTEM.md — no new tokens introduced. Each direction emphasizes a
// different posture; the structural grid + components stay identical.
function getDirectionStyle(dir: Direction): {
  cardBorderTop?: string;
  cardShadow?: string;
  fontDominant: string;
  bgAccent?: string;
  motif: string;
  labelTransform: "uppercase" | "none";
  labelTracking: string;
  weightBody: 400 | 500;
} {
  switch (dir) {
    case "helm-brass":
      return {
        cardBorderTop: "1px solid var(--nw-stone-blue)",
        cardShadow: "var(--shadow-panel)",
        fontDominant: "var(--font-jetbrains-mono)",
        motif: "Brass-bezel border-top + indicator dots + JetBrains Mono dominates",
        labelTransform: "uppercase",
        labelTracking: "0.14em",
        weightBody: 400,
      };
    case "specimen":
      return {
        cardBorderTop: undefined, // hairline borders only
        cardShadow: undefined,
        fontDominant: "var(--font-space-grotesk)",
        motif: "Plate caption · sentence case · generous gap-6 + slow ease-in-out",
        labelTransform: "none",
        labelTracking: "0",
        weightBody: 400,
      };
    case "site-office":
      return {
        cardBorderTop: undefined,
        cardShadow: undefined,
        fontDominant: "var(--font-jetbrains-mono)",
        bgAccent: "var(--bg-subtle)",
        motif: "Stamp markers · dense Telex audit · ruled rows · UPPERCASE 0.18em",
        labelTransform: "uppercase",
        labelTracking: "0.18em",
        weightBody: 500,
      };
  }
}

// ─────────────────────────────────────────────────────────────────────
// CELL: Invoice Review render
// ─────────────────────────────────────────────────────────────────────

function InvoiceReviewCell({ dir }: { dir: Direction }) {
  const s = getDirectionStyle(dir);
  return (
    <div
      className="border w-full"
      style={{
        borderColor: "var(--border-default)",
        background: "var(--bg-card)",
        borderTop: s.cardBorderTop,
        boxShadow: s.cardShadow,
        fontSize: "10px",
      }}
    >
      {/* Mock NavBar */}
      <div
        className="h-5 flex items-center justify-between px-2 border-b"
        style={{
          background: "var(--nw-slate-deeper)",
          borderColor: "rgba(247,245,236,0.08)",
        }}
      >
        <div className="flex items-center gap-1">
          <span className="w-1 h-1 bg-nw-stone-blue" style={{ borderRadius: "var(--radius-dot)" }} />
          <span style={{
            fontFamily: "var(--font-space-grotesk)",
            fontSize: "8px",
            color: "var(--nw-white-sand)",
          }}>Nightwork</span>
        </div>
        <span style={{
          fontFamily: "var(--font-jetbrains-mono)",
          fontSize: "6px",
          letterSpacing: "0.1em",
          color: "rgba(247,245,236,0.7)",
        }}>INVOICES</span>
      </div>

      {/* Header band */}
      <div className="px-2 py-1.5 border-b" style={{ borderColor: "var(--border-default)" }}>
        <div className="flex items-center justify-between mb-1">
          <span style={{
            fontFamily: s.fontDominant,
            textTransform: s.labelTransform,
            letterSpacing: s.labelTracking,
            fontSize: "6px",
            color: "var(--text-tertiary)",
          }}>
            {dir === "specimen" ? "Plate · Invoice" : "INVOICE"}
          </span>
          {dir === "helm-brass" ? (
            <span className="flex items-center gap-1">
              <StatusDot variant="pending" size="sm" />
              <Badge variant="warning" size="sm" style={{ fontSize: "5px", height: "11px", padding: "0 3px" }}>PM REVIEW</Badge>
            </span>
          ) : dir === "site-office" ? (
            <span className="px-1 border" style={{
              fontFamily: "var(--font-jetbrains-mono)",
              textTransform: "uppercase",
              letterSpacing: "0.18em",
              fontSize: "5px",
              borderColor: "var(--nw-warn)",
              color: "var(--nw-warn)",
            }}>▢ PM REVIEW</span>
          ) : (
            <span style={{
              fontFamily: "var(--font-space-grotesk)",
              fontStyle: "italic",
              fontSize: "7px",
              color: "var(--nw-warn)",
            }}>under review</span>
          )}
        </div>
        <div style={{
          fontFamily: dir === "specimen" ? "var(--font-space-grotesk)" : "var(--font-space-grotesk)",
          fontSize: dir === "specimen" ? "11px" : "10px",
          fontWeight: dir === "helm-brass" ? 500 : 400,
          letterSpacing: "-0.02em",
          color: "var(--text-primary)",
        }}>
          {HERO_INVOICE.number} · {HERO_INVOICE.vendor?.name}
        </div>
      </div>

      {/* 50/50 hero grid */}
      <div className="grid grid-cols-2" style={{
        gap: "1px",
        background: "var(--border-default)",
      }}>
        <div className="p-2" style={{ background: "var(--bg-card)" }}>
          <div className="flex items-center justify-center aspect-[3/4]" style={{
            background: "var(--bg-subtle)",
            border: "1px solid var(--border-subtle)",
          }}>
            <PaperClipIcon className="w-3 h-3" style={{ color: "var(--text-tertiary)" }} strokeWidth={1.25} />
          </div>
        </div>
        <div className="p-2 space-y-1.5" style={{ background: "var(--bg-card)" }}>
          <div style={{
            fontFamily: s.fontDominant,
            textTransform: s.labelTransform,
            letterSpacing: s.labelTracking,
            fontSize: "6px",
            color: dir === "helm-brass" ? "var(--nw-stone-blue)" : "var(--text-tertiary)",
          }}>
            {dir === "specimen" ? "Invoice details" : "INVOICE DETAILS"}
          </div>
          <div className="space-y-1 text-[7px]" style={{ color: "var(--text-secondary)" }}>
            <div className="flex justify-between"><span>Total</span><Money cents={HERO_INVOICE.amount} size="sm" /></div>
            <div className="flex justify-between"><span>Project</span><span style={{ color: "var(--text-primary)", fontSize: "6px" }}>{HERO_INVOICE.job?.name.slice(0, 14)}…</span></div>
            <div className="flex justify-between"><span>Code</span><span style={{ color: "var(--text-primary)", fontSize: "6px" }}>06101</span></div>
          </div>
        </div>
      </div>

      {/* Audit (compact) */}
      <div className="px-2 py-1.5 border-t" style={{ borderColor: "var(--border-default)" }}>
        <div style={{
          fontFamily: s.fontDominant,
          textTransform: s.labelTransform,
          letterSpacing: s.labelTracking,
          fontSize: "6px",
          color: "var(--text-tertiary)",
          marginBottom: "3px",
        }}>
          {dir === "specimen" ? "Provenance" : dir === "site-office" ? "▢ AUDIT TICKER" : "STATUS TIMELINE"}
        </div>
        <ul className="space-y-0.5 text-[6px]" style={{
          fontFamily: dir === "specimen" ? "var(--font-inter)" : "var(--font-jetbrains-mono)",
          color: "var(--text-secondary)",
        }}>
          <li>● Apr 22 · received</li>
          <li>● Apr 22 · auto-classified · 88%</li>
          <li>○ pending · PM review</li>
        </ul>
      </div>

      <DirectionMotifFooter motif={s.motif} />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// CELL: Dashboard render
// ─────────────────────────────────────────────────────────────────────

function DashboardCell({ dir }: { dir: Direction }) {
  const s = getDirectionStyle(dir);
  const kpis = [
    { label: "Active jobs", value: String(ACTIVE_JOBS), sub: "5 of 5 staffed" },
    { label: "PM queue", value: String(PM_QUEUE), sub: `${HIGH_CONF} high conf.` },
    { label: "Open draws", value: "2", sub: "1 owner pending" },
    { label: "MTD invoiced", value: `$${(MTD_INVOICED / 100_000_000).toFixed(1)}M`, sub: "vs $1.9M Mar" },
  ];
  return (
    <div
      className="border w-full"
      style={{
        borderColor: "var(--border-default)",
        background: "var(--bg-card)",
        borderTop: s.cardBorderTop,
        boxShadow: s.cardShadow,
        fontSize: "10px",
      }}
    >
      {/* NavBar */}
      <div
        className="h-5 flex items-center justify-between px-2 border-b"
        style={{
          background: "var(--nw-slate-deeper)",
          borderColor: "rgba(247,245,236,0.08)",
        }}
      >
        <div className="flex items-center gap-1">
          <span className="w-1 h-1 bg-nw-stone-blue" style={{ borderRadius: "var(--radius-dot)" }} />
          <span style={{
            fontFamily: "var(--font-space-grotesk)",
            fontSize: "8px",
            color: "var(--nw-white-sand)",
          }}>Nightwork</span>
        </div>
        <span style={{
          fontFamily: "var(--font-jetbrains-mono)",
          fontSize: "6px",
          letterSpacing: "0.1em",
          color: "rgba(247,245,236,0.7)",
        }}>DASHBOARD</span>
      </div>

      {/* Greeting */}
      <div className="px-2 py-2 border-b" style={{ borderColor: "var(--border-default)" }}>
        <div style={{
          fontFamily: s.fontDominant,
          textTransform: s.labelTransform,
          letterSpacing: s.labelTracking,
          fontSize: "6px",
          color: "var(--text-tertiary)",
          marginBottom: "2px",
        }}>
          {dir === "specimen" ? "Today" : "TODAY · APR 30"}
        </div>
        <div style={{
          fontFamily: "var(--font-space-grotesk)",
          fontSize: dir === "specimen" ? "13px" : "11px",
          fontWeight: dir === "helm-brass" ? 500 : 400,
          letterSpacing: "-0.02em",
          color: "var(--text-primary)",
        }}>
          {dir === "specimen" ? "Welcome back, Jake." : "Welcome back, Jake."}
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2" style={{
        gap: "1px",
        background: "var(--border-default)",
      }}>
        {kpis.map((k) => (
          <div key={k.label} className="px-2 py-1.5" style={{ background: "var(--bg-card)" }}>
            <div style={{
              fontFamily: s.fontDominant,
              textTransform: s.labelTransform,
              letterSpacing: s.labelTracking,
              fontSize: "5px",
              color: "var(--text-tertiary)",
            }}>
              {dir === "specimen" ? k.label : k.label.toUpperCase()}
            </div>
            <div style={{
              fontFamily: "var(--font-space-grotesk)",
              fontSize: "13px",
              fontWeight: dir === "helm-brass" ? 600 : 400,
              color: "var(--text-primary)",
              letterSpacing: "-0.02em",
            }}>
              {k.value}
            </div>
            <div style={{
              fontFamily: "var(--font-jetbrains-mono)",
              fontSize: "5px",
              color: "var(--text-accent)",
            }}>
              {k.sub}
            </div>
          </div>
        ))}
      </div>

      {/* Attention required */}
      <div className="px-2 py-2">
        <div style={{
          fontFamily: s.fontDominant,
          textTransform: s.labelTransform,
          letterSpacing: s.labelTracking,
          fontSize: "6px",
          color: dir === "helm-brass" ? "var(--nw-stone-blue)" : "var(--text-tertiary)",
          marginBottom: "4px",
        }}>
          {dir === "specimen" ? "Wants your attention" : dir === "site-office" ? "▢ ATTENTION REQUIRED" : "ATTENTION REQUIRED · 3 ITEMS"}
        </div>
        <ul className="space-y-1 text-[7px]" style={{ color: "var(--text-secondary)" }}>
          <li className="flex items-center gap-1">
            <StatusDot variant="danger" size="sm" />
            <span>Draw #9 awaiting owner — 2d</span>
          </li>
          <li className="flex items-center gap-1">
            <StatusDot variant="pending" size="sm" />
            <span>3 invoices in PM queue</span>
          </li>
          <li className="flex items-center gap-1">
            <StatusDot variant="info" size="sm" />
            <span>Tax ID expires in 30d (Bayside)</span>
          </li>
        </ul>
      </div>

      <DirectionMotifFooter motif={s.motif} />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// CELL: Mobile Approval render (iPhone-shaped)
// ─────────────────────────────────────────────────────────────────────

function MobileApprovalCell({ dir }: { dir: Direction }) {
  const s = getDirectionStyle(dir);
  return (
    <div className="flex flex-col items-center gap-2">
      <div
        style={{
          width: "150px",
          aspectRatio: "393 / 852",
          border: "1px solid var(--border-default)",
          background: "var(--bg-card)",
          borderTop: s.cardBorderTop,
          boxShadow: s.cardShadow,
          display: "flex",
          flexDirection: "column",
          fontSize: "8px",
        }}
      >
        {/* Status bar */}
        <div className="h-2 flex items-center justify-between px-1.5" style={{
          background: "var(--nw-slate-deeper)",
          fontSize: "5px",
          color: "rgba(247,245,236,0.7)",
          fontFamily: "var(--font-jetbrains-mono)",
        }}>
          <span>9:41</span><span>•••</span>
        </div>
        {/* App nav */}
        <div className="h-5 flex items-center justify-between px-1.5 border-b" style={{
          background: "var(--nw-slate-deeper)",
          borderColor: "rgba(247,245,236,0.08)",
        }}>
          <span className="w-1 h-1 bg-nw-stone-blue" style={{ borderRadius: "var(--radius-dot)" }} />
          <span style={{
            fontFamily: "var(--font-space-grotesk)",
            fontSize: "7px",
            color: "var(--nw-white-sand)",
          }}>Nightwork</span>
          <div className="w-2 h-2 border" style={{
            borderRadius: "var(--radius-dot)",
            borderColor: "rgba(247,245,236,0.3)",
          }} />
        </div>
        {/* Sticky header */}
        <div className="px-1.5 py-1 border-b" style={{ borderColor: "var(--border-default)" }}>
          <div style={{
            fontFamily: s.fontDominant,
            textTransform: s.labelTransform,
            letterSpacing: s.labelTracking,
            fontSize: "4px",
            color: "var(--text-tertiary)",
          }}>
            {dir === "specimen" ? "Plate · Invoice" : "INV · CC-04-22B"}
          </div>
          <div style={{
            fontFamily: "var(--font-space-grotesk)",
            fontSize: "8px",
            fontWeight: dir === "helm-brass" ? 500 : 400,
            color: "var(--text-primary)",
          }}>
            {HERO_INVOICE.vendor?.name.slice(0, 18)}
          </div>
          {dir === "site-office" ? (
            <span className="inline-block mt-1 px-1 border" style={{
              fontFamily: "var(--font-jetbrains-mono)",
              fontSize: "4px",
              textTransform: "uppercase",
              letterSpacing: "0.18em",
              borderColor: "var(--nw-warn)",
              color: "var(--nw-warn)",
            }}>▢ PM REVIEW</span>
          ) : dir === "specimen" ? (
            <span className="inline-block mt-1" style={{
              fontFamily: "var(--font-space-grotesk)",
              fontStyle: "italic",
              fontSize: "6px",
              color: "var(--nw-warn)",
            }}>under review</span>
          ) : (
            <span className="inline-flex items-center gap-0.5 mt-1">
              <StatusDot variant="pending" size="sm" />
              <Badge variant="warning" size="sm" style={{ fontSize: "4px", height: "9px", padding: "0 2px" }}>PM REVIEW</Badge>
            </span>
          )}
        </div>
        {/* PDF preview */}
        <div className="flex-1 mx-1.5 my-1 flex items-center justify-center" style={{
          background: "var(--bg-subtle)",
          border: "1px solid var(--border-subtle)",
        }}>
          <span style={{
            fontFamily: "var(--font-jetbrains-mono)",
            fontSize: "5px",
            textTransform: "uppercase",
            letterSpacing: "0.14em",
            color: "var(--text-tertiary)",
          }}>PDF preview</span>
        </div>
        {/* Status + Total */}
        <div className="flex items-center justify-between px-1.5 py-1 border-t border-b" style={{ borderColor: "var(--border-default)" }}>
          <div>
            <div style={{
              fontFamily: s.fontDominant,
              textTransform: s.labelTransform,
              letterSpacing: s.labelTracking,
              fontSize: "4px",
              color: "var(--text-tertiary)",
            }}>{dir === "specimen" ? "Status" : "STATUS"}</div>
            <div style={{ fontSize: "6px", color: "var(--nw-warn)", fontWeight: 500 }}>PM Review</div>
          </div>
          <div className="text-right">
            <div style={{
              fontFamily: s.fontDominant,
              textTransform: s.labelTransform,
              letterSpacing: s.labelTracking,
              fontSize: "4px",
              color: "var(--text-tertiary)",
            }}>{dir === "specimen" ? "Total" : "TOTAL"}</div>
            <Money cents={HERO_INVOICE.amount} size="sm" variant="emphasized" />
          </div>
        </div>
        {/* Audit (last 3) */}
        <div className="px-1.5 py-1 text-[5px]" style={{
          fontFamily: dir === "specimen" ? "var(--font-inter)" : "var(--font-jetbrains-mono)",
          color: "var(--text-secondary)",
        }}>
          <div style={{
            fontFamily: s.fontDominant,
            textTransform: s.labelTransform,
            letterSpacing: s.labelTracking,
            fontSize: "4px",
            color: "var(--text-tertiary)",
            marginBottom: "1px",
          }}>{dir === "specimen" ? "Provenance · last 3" : "AUDIT · LAST 3"}</div>
          <ul className="space-y-0.5">
            <li>● Apr 22 · received</li>
            <li>● Apr 22 · auto-classified</li>
            <li>○ pending · PM</li>
          </ul>
        </div>
        {/* Sticky CTA */}
        <div className="p-1 border-t" style={{ borderColor: "var(--border-default)" }}>
          <button
            type="button"
            className="w-full"
            style={{
              fontFamily: dir === "specimen" ? "var(--font-space-grotesk)" : "var(--font-jetbrains-mono)",
              fontSize: dir === "specimen" ? "8px" : "6px",
              fontWeight: 500,
              textTransform: dir === "specimen" ? "none" : "uppercase",
              letterSpacing: dir === "specimen" ? "0" : "0.12em",
              background: "var(--nw-stone-blue)",
              color: "var(--nw-white-sand)",
              padding: "6px 8px",
              border: "1px solid var(--nw-stone-blue)",
            }}
          >
            {dir === "specimen" ? "Approve & continue" : dir === "site-office" ? "▢ APPROVE & PUSH" : "APPROVE & PUSH →"}
          </button>
        </div>
      </div>
      <DirectionMotifFooter motif={s.motif} />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// CELL: Owner Portal render
// ─────────────────────────────────────────────────────────────────────

function OwnerPortalCell({ dir }: { dir: Direction }) {
  const s = getDirectionStyle(dir);
  return (
    <div
      className="border w-full"
      style={{
        borderColor: "var(--border-default)",
        background: "var(--bg-card)",
        borderTop: s.cardBorderTop,
        boxShadow: s.cardShadow,
        fontSize: "10px",
      }}
    >
      {/* Owner-tone header — hospitality phrasing */}
      <div className="px-2 py-2 border-b" style={{ borderColor: "var(--border-default)" }}>
        <div style={{
          fontFamily: s.fontDominant,
          textTransform: s.labelTransform,
          letterSpacing: s.labelTracking,
          fontSize: "6px",
          color: "var(--text-tertiary)",
          marginBottom: "2px",
        }}>
          {dir === "specimen" ? "Owner portal" : dir === "site-office" ? "▢ OWNER PORTAL" : "OWNER PORTAL"}
        </div>
        <div style={{
          fontFamily: "var(--font-space-grotesk)",
          fontSize: dir === "specimen" ? "13px" : "11px",
          fontWeight: dir === "helm-brass" ? 500 : 400,
          letterSpacing: "-0.02em",
          color: "var(--text-primary)",
          marginBottom: "1px",
        }}>
          {HERO_INVOICE.job?.name}
        </div>
        <div style={{
          fontFamily: "var(--font-inter)",
          fontSize: "7px",
          color: "var(--text-secondary)",
          fontStyle: dir === "specimen" ? "italic" : "normal",
        }}>
          {dir === "specimen"
            ? "Welcome back, Sarah. Here is the latest on your home."
            : dir === "site-office"
              ? "Sarah Reilly · Last updated Apr 30"
              : "Welcome, Sarah. Last activity Apr 30."}
        </div>
      </div>

      {/* Headline metric — contract-to-date */}
      <div className="px-2 py-2 border-b" style={{ borderColor: "var(--border-default)" }}>
        <div style={{
          fontFamily: s.fontDominant,
          textTransform: s.labelTransform,
          letterSpacing: s.labelTracking,
          fontSize: "5px",
          color: "var(--text-tertiary)",
        }}>
          {dir === "specimen" ? "Total spent" : "TOTAL SPENT TO DATE"}
        </div>
        <div style={{
          fontFamily: "var(--font-jetbrains-mono)",
          fontSize: "16px",
          fontWeight: dir === "helm-brass" ? 600 : 500,
          color: "var(--text-primary)",
          fontVariantNumeric: "tabular-nums",
          letterSpacing: "-0.01em",
        }}>
          $3,124,500 <span style={{ fontSize: "8px", color: "var(--text-tertiary)" }}>of $5,105,000</span>
        </div>
        <div style={{
          height: "3px",
          width: "100%",
          background: "var(--bg-muted)",
          marginTop: "4px",
        }}>
          <div style={{
            height: "100%",
            width: "61%",
            background: dir === "specimen" ? "var(--text-accent)" : "var(--nw-stone-blue)",
          }} />
        </div>
      </div>

      {/* Pending action */}
      <div className="px-2 py-2 border-b" style={{ borderColor: "var(--border-default)" }}>
        <div style={{
          fontFamily: s.fontDominant,
          textTransform: s.labelTransform,
          letterSpacing: s.labelTracking,
          fontSize: "5px",
          color: dir === "helm-brass" ? "var(--nw-stone-blue)" : "var(--nw-warn)",
          marginBottom: "3px",
        }}>
          {dir === "specimen" ? "Awaiting your review" : dir === "site-office" ? "▢ AWAITING REVIEW" : "AWAITING YOUR REVIEW"}
        </div>
        <div className="flex items-center justify-between gap-2">
          <div className="text-[7px]" style={{ color: "var(--text-primary)" }}>
            <div>Draw #9 · Apr 30</div>
            <div style={{ color: "var(--text-tertiary)" }}>Submitted 2 days ago</div>
          </div>
          <button
            type="button"
            style={{
              fontFamily: dir === "specimen" ? "var(--font-space-grotesk)" : "var(--font-jetbrains-mono)",
              fontSize: dir === "specimen" ? "7px" : "5px",
              fontWeight: 500,
              textTransform: dir === "specimen" ? "none" : "uppercase",
              letterSpacing: dir === "specimen" ? "0" : "0.12em",
              background: "var(--nw-stone-blue)",
              color: "var(--nw-white-sand)",
              padding: "3px 5px",
              border: "1px solid var(--nw-stone-blue)",
            }}
          >
            {dir === "specimen" ? "Review →" : "REVIEW →"}
          </button>
        </div>
      </div>

      {/* Recent activity */}
      <div className="px-2 py-2">
        <div style={{
          fontFamily: s.fontDominant,
          textTransform: s.labelTransform,
          letterSpacing: s.labelTracking,
          fontSize: "5px",
          color: "var(--text-tertiary)",
          marginBottom: "3px",
        }}>
          {dir === "specimen" ? "Recent activity" : dir === "site-office" ? "▢ ACTIVITY LOG" : "RECENT ACTIVITY"}
        </div>
        <ul className="space-y-1 text-[6px]" style={{
          fontFamily: dir === "specimen" ? "var(--font-inter)" : "var(--font-jetbrains-mono)",
          color: "var(--text-secondary)",
        }}>
          <li>● Apr 30 · Draw #9 submitted</li>
          <li>● Apr 22 · Framing 60% complete</li>
          <li>● Apr 18 · Plumbing rough complete</li>
          <li>● Apr 15 · Inspection passed</li>
        </ul>
      </div>

      <DirectionMotifFooter motif={s.motif} />
    </div>
  );
}

// Per-cell motif caption.
function DirectionMotifFooter({ motif }: { motif: string }) {
  return (
    <div
      className="px-2 py-1.5 border-t"
      style={{
        background: "var(--bg-subtle)",
        borderColor: "var(--border-subtle)",
      }}
    >
      <div
        style={{
          fontFamily: "var(--font-jetbrains-mono)",
          fontSize: "8px",
          textTransform: "uppercase",
          letterSpacing: "0.12em",
          color: "var(--text-tertiary)",
        }}
      >
        Direction motif
      </div>
      <div className="text-[10px] mt-0.5 leading-snug" style={{ color: "var(--text-secondary)" }}>
        {motif}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Direction overview card (above the grid)
// ─────────────────────────────────────────────────────────────────────

function DirectionOverviewCard({
  direction,
  oneLiner,
  concept,
}: {
  direction: typeof DIRECTIONS[number];
  oneLiner: string;
  concept: string;
}) {
  return (
    <Card padding="lg" className="h-full">
      <Eyebrow tone="accent" className="mb-2">Direction</Eyebrow>
      <h3
        className="text-[20px] mb-2"
        style={{
          fontFamily: "var(--font-space-grotesk)",
          fontWeight: 500,
          letterSpacing: "-0.02em",
          color: "var(--text-primary)",
        }}
      >
        {direction.label}
      </h3>
      <p className="text-[12px] mb-3 italic" style={{ color: "var(--text-tertiary)" }}>
        {oneLiner}
      </p>
      <p className="text-[12px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>
        {concept}
      </p>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Honest weaknesses block (per direction)
// ─────────────────────────────────────────────────────────────────────

function WeaknessBlock({
  direction,
  weaknesses,
}: {
  direction: string;
  weaknesses: Array<{ heading: string; body: string }>;
}) {
  return (
    <Card padding="lg" className="h-full">
      <Eyebrow tone="danger" className="mb-3">Honest weaknesses · {direction}</Eyebrow>
      <ul className="space-y-4">
        {weaknesses.map((w) => (
          <li key={w.heading}>
            <h4
              className="text-[13px] mb-1"
              style={{
                color: "var(--text-primary)",
                fontWeight: 500,
              }}
            >
              {w.heading}
            </h4>
            <p className="text-[11px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>
              {w.body}
            </p>
          </li>
        ))}
      </ul>
    </Card>
  );
}

const HELM_BRASS_WEAKNESSES = [
  {
    heading: "Worst for: dense schedule grids (Wave 2)",
    body: "Brass-bezel hairlines on every panel + JetBrains Mono dominance + indicator-light dots add visual noise at high data density. A 30-day schedule grid with 14 active jobs has too many cells for the instrument-panel treatment to read cleanly.",
  },
  {
    heading: "Concession: warmth",
    body: "Helm + Brass is the coldest of the three. Instrument vocabulary + indicator dots + brass-bezel hairlines = calibrated, technical, marine-functional. Works on PM dashboard. Owner portal wants hospitality, which Specimen handles better.",
  },
  {
    heading: "Risk: marine vocabulary becomes affected over many releases",
    body: "By 100k tenants, the yacht-club association may feel stuck in Florida. A custom-home builder in Nashville or Phoenix may find the maritime vocabulary alien. Brass-bezel reads as decorative when the customer doesn't have the salt-water frame of reference.",
  },
  {
    heading: "Mitigation: build a 'utility' density mode",
    body: "Add --density-utility (third token) that suppresses the brass-bezel border-top on dense surfaces. Forbidden gallery gains: 'Brass-bezel decoration on a density=utility surface'. Canonical surfaces (invoice / draw / dashboard) keep full Helm + Brass.",
  },
];

const SPECIMEN_WEAKNESSES = [
  {
    heading: "Worst for: DataGrid / list pages",
    body: "Editorial vocabulary breaks down on dense scan-and-act surfaces. Invoice queue, vendor list, audit log — all need quick visual triage that Specimen's hairline + sentence-case + generous gap-6 actively works against.",
  },
  {
    heading: "Discipline cost: drift toward Helm + Brass",
    body: "Specimen's commitments (no shadows, weight ≤500, gap-6 minimums, sentence case) are easy to LOCK with hooks but hard to MAINTAIN over years. Without active /nightwork-design-check, drift toward Helm + Brass is the failure mode.",
  },
  {
    heading: "Risk: editorial slowness reads as wasted time to volume builders",
    body: "A 30-100 simultaneous-job production builder finds the curatorial commitments costly to productivity. PMs trained in QuickBooks/Procore find sentence-case + italic-everywhere unfamiliar. Specimen's best customer is a 4-7 simultaneous-job premium-craft builder.",
  },
  {
    heading: "Mitigation: 6 Specimen-specific hook checks",
    body: "Forbidden: UPPERCASE eyebrows on internal screens (sentence case only); weight ≥500 on display headings; gap-3 between top-level cards; colored card backgrounds; progress-bar fill in --color-success; density=compact outside tables.",
  },
];

const SITE_OFFICE_WEAKNESSES = [
  {
    heading: "Worst for: owner portal hospitality moment",
    body: "Stamped/forms vocabulary reads as bureaucratic to the homeowner. Manila-folder cards + Telex audit + UPPERCASE 0.18em letterspacing conflict with the warmth/care brand promise high-end residential needs. Specimen handles this surface better.",
  },
  {
    heading: "Implementation complexity: highest of the three",
    body: "Square stamp marker requires NwStatusDot shape='square' extension. Stamp caption codification. Telex ticker custom layout. Stamp-tone NwEyebrow + NwBadge variants. Striped table rows. New --shadow-panel-site-office softer-shadow value. Ruled-ledger texture decorative.",
  },
  {
    heading: "Doesn't generalize beyond document-review surfaces",
    body: "The forms-metaphor breaks on charts, real-time collaboration, dashboards. Requires a 'Site Office Lite' mode that fragments the visual identity. Over many releases the cohesion erodes unless the Form/Non-Form rule is rigorously enforced.",
  },
  {
    heading: "Mitigation: Form Surface vs Non-Form Surface rule",
    body: "PATTERNS.md gets new §15 documenting Form Surfaces (full Site Office) vs Non-Form Surfaces (Site Office Lite — stamp captions retained, manila-folder cards opted out, Telex-ticker audit relaxed). Hook adds the Form Surface check.",
  },
];

// ─────────────────────────────────────────────────────────────────────
// Comparison Matrix
// ─────────────────────────────────────────────────────────────────────

function ComparisonMatrix() {
  const rows: Array<{ axis: string; helm: string; spec: string; site: string }> = [
    {
      axis: "Best surface",
      helm: "Invoice review · draw approval · dashboard",
      spec: "Owner portal · document review · marketing site",
      site: "Reconciliation · print view · large data tables",
    },
    {
      axis: "Worst surface",
      helm: "Schedule grids · daily logs (high density)",
      spec: "DataGrid pages (invoice queue · vendor list)",
      site: "Owner portal hospitality moment",
    },
    {
      axis: "Best customer",
      helm: "Boutique-luxury coastal/yacht-influenced builder · $5–20M ocean-front estates",
      spec: "Premium-craft small builder · 4–7 jobs · design-conscious clientele",
      site: "High-volume production builder · 30–100 jobs · efficiency-oriented",
    },
    {
      axis: "Worst customer",
      helm: "Inland production builder (Phoenix · Park City multi-state)",
      spec: "Volume builder · efficiency-oriented owner",
      site: "Boutique luxury · hospitality-oriented client",
    },
    {
      axis: "Implementation complexity",
      helm: "Medium · brass-bezel + indicator-dot + instrument-log audit",
      spec: "Low · no new components · discipline cost over 5+ years",
      site: "High · square stamp marker · Telex ticker · stamp variants",
    },
    {
      axis: "Risk level",
      helm: "Medium · maritime vocabulary becomes constraint at 100k tenants",
      spec: "Low structural · high discipline · drift toward Helm + Brass without /design-check",
      site: "Medium-high · forms-metaphor doesn't generalize · cohesion erodes without Form Surface rule",
    },
  ];
  return (
    <Card padding="none">
      <div className="px-5 py-4 border-b" style={{ borderColor: "var(--border-default)" }}>
        <Eyebrow tone="accent" className="mb-2">Direction Comparison Matrix</Eyebrow>
        <p className="text-[12px]" style={{ color: "var(--text-secondary)" }}>
          Per nwrp16 directive 3 &mdash; rigorous comparison across the
          axes Jake actually cares about.
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-[11px]">
          <thead>
            <tr style={{ background: "var(--bg-subtle)" }}>
              <th className="px-3 py-2 text-left border-b border-r" style={{
                borderColor: "var(--border-default)",
                fontFamily: "var(--font-jetbrains-mono)",
                textTransform: "uppercase",
                letterSpacing: "0.14em",
                fontSize: "9px",
                color: "var(--text-tertiary)",
                width: "180px",
              }}>Axis</th>
              {DIRECTIONS.map((d) => (
                <th key={d.key} className="px-3 py-2 text-left border-b" style={{
                  borderColor: "var(--border-default)",
                  fontFamily: "var(--font-space-grotesk)",
                  fontWeight: 500,
                  fontSize: "12px",
                  color: "var(--text-primary)",
                  letterSpacing: "-0.01em",
                }}>
                  {d.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={row.axis} style={{
                background: i % 2 === 0 ? "var(--bg-card)" : "var(--bg-subtle)",
              }}>
                <td className="px-3 py-3 align-top border-r" style={{
                  borderColor: "var(--border-subtle)",
                  fontFamily: "var(--font-jetbrains-mono)",
                  textTransform: "uppercase",
                  letterSpacing: "0.1em",
                  fontSize: "10px",
                  color: "var(--text-secondary)",
                  fontWeight: 500,
                }}>{row.axis}</td>
                <td className="px-3 py-3 align-top" style={{ color: "var(--text-primary)" }}>{row.helm}</td>
                <td className="px-3 py-3 align-top" style={{ color: "var(--text-primary)" }}>{row.spec}</td>
                <td className="px-3 py-3 align-top" style={{ color: "var(--text-primary)" }}>{row.site}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="px-5 py-3 border-t" style={{ borderColor: "var(--border-default)" }}>
        <Eyebrow tone="muted" className="mb-2">Distinctness verification</Eyebrow>
        <p className="text-[11px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>
          A vs B: 4/4 axes differ. A vs C: 4/4 axes differ. B vs C: 4/4
          axes differ. No axis shared across all three. Transitively
          distinct per SPEC A1 + iteration-2 W2.
        </p>
      </div>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────
// PAGE
// ─────────────────────────────────────────────────────────────────────

const SCREEN_RENDERERS: Array<{
  key: string;
  label: string;
  Icon: typeof DocumentTextIcon;
  Cell: (props: { dir: Direction }) => React.ReactElement;
  description: string;
}> = [
  {
    key: "invoice-review",
    label: "Invoice review",
    Icon: DocumentTextIcon,
    Cell: InvoiceReviewCell,
    description: "PATTERNS.md §2 · Document Review gold standard. The reference Nightwork surface — file preview LEFT, fields RIGHT, audit BELOW.",
  },
  {
    key: "dashboard",
    label: "Dashboard",
    Icon: ChartBarIcon,
    Cell: DashboardCell,
    description: "PATTERNS.md §4 · Data-dense Overview. KPI strip + attention list + recent activity. PM home screen.",
  },
  {
    key: "mobile-approval",
    label: "Mobile approval",
    Icon: DevicePhoneMobileIcon,
    Cell: MobileApprovalCell,
    description: "PATTERNS.md §5 · iPhone 15 Pro 393×852. Sticky header + PDF preview + sticky CTA. PM in the field.",
  },
  {
    key: "owner-portal",
    label: "Owner portal",
    Icon: HomeModernIcon,
    Cell: OwnerPortalCell,
    description: "Owner-facing surface. Hospitality phrasing + headline contract metric + pending action. The warmth-test surface.",
  },
];

export default async function PhilosophyPage() {
  const chosen = await readChosenDirection();

  return (
    <div className="max-w-[1280px]">
      <header className="mb-10 pb-6 border-b" style={{ borderColor: "var(--border-default)" }}>
        <Eyebrow tone="accent" className="mb-3">CP2 · Decision surface</Eyebrow>
        <h1
          className="text-[34px] mb-3"
          style={{
            fontFamily: "var(--font-space-grotesk)",
            letterSpacing: "-0.02em",
            fontWeight: 500,
            color: "var(--text-primary)",
          }}
        >
          Philosophy
        </h1>
        <p className="text-[14px] max-w-[760px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>
          Three directions, four screens each. Twelve renders total. This
          page IS Strategic Checkpoint #2 &mdash; per nwrp17 the visual
          playground at /design-system is the decision surface for CP2.
          Read the overviews, scan the 4×3 render grid below, review the
          honest weaknesses + comparison matrix, then click <em>Pick this
          direction</em> on your chosen direction. The pick locks every
          downstream UI phase from Stage 1.5b onward.
        </p>
      </header>

      {/* LOCKED-DIRECTION BANNER (if marker exists with a real pick) */}
      {chosen && chosen.direction !== "TBD" ? (
        <div
          className="mb-10 px-5 py-4 border flex items-start gap-3"
          style={{
            borderColor: "var(--nw-stone-blue)",
            background: "var(--bg-subtle)",
          }}
        >
          <LockClosedIcon
            className="w-5 h-5 shrink-0 mt-0.5"
            style={{ color: "var(--nw-stone-blue)" }}
            strokeWidth={1.5}
          />
          <div>
            <Eyebrow tone="accent" className="mb-1">Direction locked</Eyebrow>
            <h3
              className="text-[18px] mb-1"
              style={{
                fontFamily: "var(--font-space-grotesk)",
                fontWeight: 500,
                color: "var(--text-primary)",
                letterSpacing: "-0.02em",
              }}
            >
              {chosen.direction}
            </h3>
            <p className="text-[12px]" style={{ color: "var(--text-secondary)" }}>
              Picked at CP2 on {chosen.pickedAt} by {chosen.pickedBy}. Locks
              subordinate work per PROPAGATION-RULES.md.
            </p>
          </div>
        </div>
      ) : null}

      {/* DIRECTION OVERVIEWS — three cards above the grid */}
      <section className="mb-12">
        <Eyebrow tone="muted" className="mb-3">The 3 directions at a glance</Eyebrow>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <DirectionOverviewCard
            direction={DIRECTIONS[0]}
            oneLiner="Yacht-bridge instrumentation rendered in software."
            concept="The maritime-engineering reference made literal. Brushed steel + brass instrument bezels + salt-weathered metal patina. Stone Blue is the active-control hue; Slate Deep reads as brushed aluminum. JetBrains Mono dominates (instrument readouts). Every panel carries a 1px Stone Blue hairline at top — the brass-bezel signature. Audit timelines render like instrument logs. Density medium, motion functional fast (200ms ease-out)."
          />
          <DirectionOverviewCard
            direction={DIRECTIONS[1]}
            oneLiner="Luxury architectural-monograph plates."
            concept="Each page is a plate — generous margins, plate number top-corner, exhibit-style captions, hairline museum-display labels. Whitespace-rich, type-led. Space Grotesk weights 400/500 only. Stone Blue is rare and editorial, used like an editor's red pencil. Density low, motion slow deliberate (240ms ease-in-out, page-turn-like). Coastal heritage suppressed."
          />
          <DirectionOverviewCard
            direction={DIRECTIONS[2]}
            oneLiner="Drafting-table office, blueprint cabinets, manila folders."
            concept="The literal Ross Built site-office aesthetic. Construction office — drafting tables, blueprint cabinets, carbon-paper triplicate forms, rubber stamps, ruled ledger paper. Eyebrows render like rubber-stamp marks (▢ prefix + 0.18em tracking). Audit timelines render as Telex tickers. JetBrains Mono is dense, frequent, archival. Density high, motion instant (150ms)."
          />
        </div>
      </section>

      {/* PICK CTAs */}
      <section className="mb-12">
        <PickDirectionPanel chosen={chosen} />
      </section>

      {/* THE 12 RENDERS — 4 rows × 3 columns */}
      <section className="mb-16">
        <Eyebrow tone="accent" className="mb-3">12 renders · 4 screens × 3 directions</Eyebrow>
        <h2
          className="text-[24px] mb-5"
          style={{
            fontFamily: "var(--font-space-grotesk)",
            fontWeight: 500,
            letterSpacing: "-0.02em",
            color: "var(--text-primary)",
          }}
        >
          Visual comparison
        </h2>

        {SCREEN_RENDERERS.map(({ key, label, Icon, Cell, description }) => (
          <div key={key} className="mb-12 pb-8 border-b last:border-b-0" style={{ borderColor: "var(--border-default)" }}>
            <div className="flex items-center gap-2 mb-1">
              <Icon className="w-4 h-4" style={{ color: "var(--nw-stone-blue)" }} strokeWidth={1.5} />
              <Eyebrow tone="muted">Screen</Eyebrow>
            </div>
            <h3
              className="text-[20px] mb-2"
              style={{
                fontFamily: "var(--font-space-grotesk)",
                fontWeight: 500,
                color: "var(--text-primary)",
                letterSpacing: "-0.02em",
              }}
            >
              {label}
            </h3>
            <p className="text-[12px] mb-5 max-w-[760px]" style={{ color: "var(--text-secondary)" }}>
              {description}
            </p>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              {DIRECTIONS.map((d) => (
                <div key={d.key}>
                  <div className="flex items-center justify-between mb-3">
                    <Eyebrow tone="accent">{d.label}</Eyebrow>
                    <span
                      className="text-[9px] uppercase"
                      style={{
                        fontFamily: "var(--font-jetbrains-mono)",
                        letterSpacing: "0.14em",
                        color: "var(--text-tertiary)",
                      }}
                    >
                      {label}
                    </span>
                  </div>
                  <Cell dir={d.key} />
                </div>
              ))}
            </div>
          </div>
        ))}
      </section>

      {/* HONEST WEAKNESSES — 3 cards */}
      <section className="mb-16">
        <Eyebrow tone="danger" className="mb-3">Honest weaknesses · per direction</Eyebrow>
        <h2
          className="text-[24px] mb-5"
          style={{
            fontFamily: "var(--font-space-grotesk)",
            fontWeight: 500,
            letterSpacing: "-0.02em",
            color: "var(--text-primary)",
          }}
        >
          What each direction trades away
        </h2>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <WeaknessBlock direction="Helm + Brass" weaknesses={HELM_BRASS_WEAKNESSES} />
          <WeaknessBlock direction="Specimen" weaknesses={SPECIMEN_WEAKNESSES} />
          <WeaknessBlock direction="Site Office" weaknesses={SITE_OFFICE_WEAKNESSES} />
        </div>
      </section>

      {/* DIRECTION COMPARISON MATRIX */}
      <section className="mb-12">
        <ComparisonMatrix />
      </section>
    </div>
  );
}
