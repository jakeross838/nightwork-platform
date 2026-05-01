// Design-system playground — Stage 1.5a Wave C T23.
//
// PATTERNS — every PATTERNS.md entry rendered as a static layout.
// Per SPEC A14 + PATTERNS.md (12 patterns + Document Review gold standard
// canonical render + Reconciliation 4-strawman per A16).
//
// Each pattern section: name + h2 anchor + 1-paragraph "what / when / when
// not" + ASCII diagram + static rendered example (NwCard + NwButton +
// NwBadge + NwEyebrow + Heroicons + sample data from _fixtures/) +
// Components used + Tokens used cites.
//
// Token discipline: every color via --bg-* / --text-* / --border-*; every
// type face via --font-*. No hex; no tenant imports.

import {
  DocumentTextIcon,
  CheckBadgeIcon,
  ChartBarIcon,
  DevicePhoneMobileIcon,
  Cog6ToothIcon,
  ListBulletIcon,
  ArrowsRightLeftIcon,
  Squares2X2Icon,
  PrinterIcon,
  ScaleIcon,
  ExclamationTriangleIcon,
  ArrowPathIcon,
  ChevronRightIcon,
  PaperClipIcon,
  PlusIcon,
} from "@heroicons/react/24/outline";

import Card from "@/components/nw/Card";
import Eyebrow from "@/components/nw/Eyebrow";
import Badge from "@/components/nw/Badge";
import Button from "@/components/nw/Button";
import Money from "@/components/nw/Money";
import DataRow from "@/components/nw/DataRow";
import StatusDot from "@/components/nw/StatusDot";
import { Textarea } from "@/components/ui/textarea";

import {
  SAMPLE_INVOICES,
  SAMPLE_VENDORS,
  SAMPLE_JOBS,
  SAMPLE_COST_CODES,
} from "@/app/design-system/_fixtures";

// Lookups so we can resolve invoice → vendor / job / cost code in renders.
const VENDOR_BY_ID = Object.fromEntries(SAMPLE_VENDORS.map((v) => [v.id, v]));
const JOB_BY_ID = Object.fromEntries(SAMPLE_JOBS.map((j) => [j.id, j]));
const COST_CODE_BY_ID = Object.fromEntries(SAMPLE_COST_CODES.map((c) => [c.id, c]));

// ─────────────────────────────────────────────────────────────────────
// Layout helpers
// ─────────────────────────────────────────────────────────────────────

function PatternSection({
  index,
  title,
  Icon,
  what,
  when,
  whenNot,
  ascii,
  componentsUsed,
  tokensUsed,
  children,
  anchor,
}: {
  index: number;
  title: string;
  Icon: typeof DocumentTextIcon;
  what: string;
  when: string;
  whenNot: string;
  ascii: string;
  componentsUsed: string[];
  tokensUsed: string[];
  children: React.ReactNode;
  anchor: string;
}) {
  return (
    <section
      id={anchor}
      className="pt-12 mt-12 border-t scroll-mt-20"
      style={{ borderColor: "var(--border-default)" }}
    >
      <div className="flex items-baseline gap-3 mb-3">
        <span
          className="text-[10px] uppercase shrink-0"
          style={{
            fontFamily: "var(--font-jetbrains-mono)",
            letterSpacing: "0.14em",
            color: "var(--text-tertiary)",
          }}
        >
          Pattern {String(index).padStart(2, "0")}
        </span>
        <Icon
          className="w-4 h-4 shrink-0"
          style={{ color: "var(--nw-stone-blue)" }}
          aria-hidden="true"
          strokeWidth={1.5}
        />
      </div>
      <h2
        className="text-[26px] mb-3"
        style={{
          fontFamily: "var(--font-space-grotesk)",
          letterSpacing: "-0.02em",
          fontWeight: 500,
          color: "var(--text-primary)",
        }}
      >
        {title}
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 text-[12px] leading-relaxed">
        <div>
          <Eyebrow tone="muted" className="mb-1.5">What</Eyebrow>
          <p style={{ color: "var(--text-secondary)" }}>{what}</p>
        </div>
        <div>
          <Eyebrow tone="success" className="mb-1.5">When to use</Eyebrow>
          <p style={{ color: "var(--text-secondary)" }}>{when}</p>
        </div>
        <div>
          <Eyebrow tone="danger" className="mb-1.5">When not</Eyebrow>
          <p style={{ color: "var(--text-secondary)" }}>{whenNot}</p>
        </div>
      </div>

      {/* ASCII diagram */}
      <details className="mb-6 group" open>
        <summary
          className="cursor-pointer mb-2 list-none flex items-center gap-2"
          style={{ color: "var(--text-tertiary)" }}
        >
          <ChevronRightIcon
            className="w-3 h-3 transition-transform group-open:rotate-90"
            aria-hidden="true"
            strokeWidth={2}
          />
          <span
            className="text-[10px] uppercase font-medium"
            style={{
              fontFamily: "var(--font-jetbrains-mono)",
              letterSpacing: "0.14em",
            }}
          >
            ASCII layout
          </span>
        </summary>
        <pre
          className="text-[10px] leading-snug p-4 overflow-x-auto border"
          style={{
            fontFamily: "var(--font-jetbrains-mono)",
            background: "var(--bg-subtle)",
            borderColor: "var(--border-subtle)",
            color: "var(--text-secondary)",
          }}
        >
{ascii}
        </pre>
      </details>

      {/* Static rendered example */}
      <Eyebrow tone="accent" className="mb-3">
        Static render
      </Eyebrow>
      <div className="mb-6">{children}</div>

      {/* Components + tokens used */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-[11px]">
        <div>
          <Eyebrow tone="muted" className="mb-2">Components used</Eyebrow>
          <div className="flex flex-wrap gap-1.5">
            {componentsUsed.map((c) => (
              <span
                key={c}
                className="px-2 py-0.5 border"
                style={{
                  fontFamily: "var(--font-jetbrains-mono)",
                  fontSize: "10px",
                  borderColor: "var(--border-default)",
                  color: "var(--text-secondary)",
                }}
              >
                {c}
              </span>
            ))}
          </div>
        </div>
        <div>
          <Eyebrow tone="muted" className="mb-2">Tokens used</Eyebrow>
          <div className="flex flex-wrap gap-1.5">
            {tokensUsed.map((t) => (
              <span
                key={t}
                className="px-2 py-0.5 border"
                style={{
                  fontFamily: "var(--font-jetbrains-mono)",
                  fontSize: "10px",
                  borderColor: "var(--border-default)",
                  color: "var(--text-secondary)",
                }}
              >
                {t}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

// Mock NavBar — used in many pattern renders
function MockNavBar() {
  return (
    <div
      className="h-10 flex items-center justify-between px-4 border-b"
      style={{
        background: "var(--nw-slate-deeper)",
        borderColor: "rgba(247,245,236,0.08)",
      }}
    >
      <div className="flex items-center gap-4">
        <span className="w-1.5 h-1.5 bg-nw-stone-blue" style={{ borderRadius: "var(--radius-dot)" }} />
        <span
          className="text-[12px] font-medium"
          style={{
            fontFamily: "var(--font-space-grotesk)",
            letterSpacing: "-0.02em",
            color: "var(--nw-white-sand)",
          }}
        >
          Nightwork
        </span>
      </div>
      <div className="flex items-center gap-3 text-[9px] uppercase" style={{
        fontFamily: "var(--font-jetbrains-mono)",
        letterSpacing: "0.14em",
        color: "rgba(247,245,236,0.7)",
      }}>
        <span>Dashboard</span>
        <span>Invoices</span>
        <span>Draws</span>
        <span>Vendors</span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// PATTERN 1 — Document Review (gold standard)
// ─────────────────────────────────────────────────────────────────────

function Pattern1DocumentReview() {
  const inv = SAMPLE_INVOICES[0]; // BAY-2026-04-0117 — pm_approved $18,600
  const vendor = VENDOR_BY_ID[inv.vendor_id];
  const job = JOB_BY_ID[inv.job_id];
  const costCode = inv.cost_code_id ? COST_CODE_BY_ID[inv.cost_code_id] : null;

  return (
    <div
      className="border"
      style={{ borderColor: "var(--border-default)", background: "var(--bg-card)" }}
    >
      <MockNavBar />
      {/* Header band */}
      <div
        className="px-5 py-4 border-b"
        style={{ borderColor: "var(--border-default)" }}
      >
        <div
          className="text-[9px] uppercase mb-2"
          style={{
            fontFamily: "var(--font-jetbrains-mono)",
            letterSpacing: "0.14em",
            color: "var(--text-tertiary)",
          }}
        >
          Home <span className="mx-1">›</span> Invoices <span className="mx-1">›</span> {inv.invoice_number}
        </div>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <Eyebrow tone="muted" className="mb-1">Invoice</Eyebrow>
            <h3
              className="text-[20px] mb-1.5"
              style={{
                fontFamily: "var(--font-space-grotesk)",
                letterSpacing: "-0.02em",
                fontWeight: 500,
                color: "var(--text-primary)",
              }}
            >
              {inv.invoice_number} · {vendor?.name}
            </h3>
            <div className="flex items-center gap-2">
              <Badge variant="success">PM APPROVED</Badge>
              <span className="text-[11px]" style={{ color: "var(--text-secondary)" }}>
                {job?.name} · Received Apr 22
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm">Reject</Button>
            <Button variant="primary" size="sm">Push to QB →</Button>
          </div>
        </div>
      </div>

      {/* Hero grid 50/50 */}
      <div
        className="grid grid-cols-1 lg:grid-cols-2"
        style={{
          gap: "1px",
          background: "var(--border-default)",
        }}
      >
        {/* LEFT — file preview */}
        <div className="p-5" style={{ background: "var(--bg-card)" }}>
          <Eyebrow tone="muted" className="mb-3">Source document</Eyebrow>
          <div
            className="aspect-[3/4] border flex flex-col items-center justify-center"
            style={{
              background: "var(--bg-subtle)",
              borderColor: "var(--border-subtle)",
            }}
          >
            <PaperClipIcon
              className="w-8 h-8 mb-3"
              style={{ color: "var(--text-tertiary)" }}
              strokeWidth={1.25}
            />
            <span
              className="text-[10px] uppercase"
              style={{
                fontFamily: "var(--font-jetbrains-mono)",
                letterSpacing: "0.14em",
                color: "var(--text-tertiary)",
              }}
            >
              Invoice PDF preview
            </span>
            <span
              className="text-[10px] mt-1"
              style={{ color: "var(--text-tertiary)" }}
            >
              react-pdf · sticky on desktop
            </span>
          </div>
        </div>

        {/* RIGHT — right-rail panels */}
        <div className="p-5 space-y-4" style={{ background: "var(--bg-card)" }}>
          <Card padding="md">
            <Eyebrow tone="accent" className="mb-3">Invoice details</Eyebrow>
            <div className="grid grid-cols-2 gap-3">
              <DataRow label="Total" value={<Money cents={inv.total_amount} size="lg" variant="emphasized" />} />
              <DataRow label="Vendor" value={vendor?.name} />
              <DataRow label="Project" value={job?.name} />
              <DataRow label="Cost code" value={costCode ? `${costCode.code} · ${costCode.description}` : "—"} />
              <DataRow label="Received" value={inv.received_date} />
              <DataRow label="Payment" value={inv.payment_date ?? "—"} />
            </div>
          </Card>
          <Card padding="md">
            <Eyebrow tone="muted" className="mb-2">Status timeline</Eyebrow>
            <ul className="space-y-2 text-[12px]">
              {[
                { when: "Apr 22 · 10:04", what: "RECEIVED via email-in", done: true },
                { when: "Apr 22 · 10:04", what: "AUTO-CLASSIFIED · 97% confidence", done: true },
                { when: "Apr 22 · 11:18", what: "PM APPROVED by Mark Henderson", done: true },
                { when: "Pending", what: "QA review by Maria D", done: false },
              ].map((e, i) => (
                <li key={i} className="flex items-baseline gap-2.5">
                  <span
                    className="w-2 h-2 mt-1 shrink-0"
                    style={{
                      borderRadius: "var(--radius-dot)",
                      background: e.done ? "var(--nw-success)" : "transparent",
                      border: e.done ? "none" : "1px solid var(--text-tertiary)",
                    }}
                  />
                  <span
                    className="text-[10px] uppercase shrink-0"
                    style={{
                      fontFamily: "var(--font-jetbrains-mono)",
                      letterSpacing: "0.1em",
                      color: "var(--text-tertiary)",
                      width: "82px",
                    }}
                  >
                    {e.when}
                  </span>
                  <span style={{ color: "var(--text-primary)" }}>{e.what}</span>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// PATTERN 2 — Multi-step Approval
// ─────────────────────────────────────────────────────────────────────

function Pattern2MultiStepApproval() {
  const steps = [
    { label: "PM review", role: "PM", status: "done" as const, who: "Mark Henderson", at: "Apr 22 · 11:18" },
    { label: "QA review", role: "Diane (QA)", status: "current" as const, who: "—", at: "Pending" },
    { label: "Push to QB", role: "Accounting", status: "pending" as const, who: "—", at: "Pending" },
    { label: "In draw", role: "Auto", status: "pending" as const, who: "—", at: "Pending" },
    { label: "Paid", role: "Auto", status: "pending" as const, who: "—", at: "Pending" },
  ];
  return (
    <Card padding="lg">
      <Eyebrow tone="muted" className="mb-3">Workflow chain · Invoice approval</Eyebrow>
      <ol className="grid grid-cols-1 md:grid-cols-5 gap-2">
        {steps.map((s, i) => (
          <li key={i} className="flex flex-col items-start">
            <div className="flex items-center gap-1.5 mb-2">
              <StatusDot
                variant={s.status === "done" ? "active" : s.status === "current" ? "pending" : "inactive"}
              />
              <span
                className="text-[10px] uppercase font-medium"
                style={{
                  fontFamily: "var(--font-jetbrains-mono)",
                  letterSpacing: "0.12em",
                  color: s.status === "current" ? "var(--nw-stone-blue)" : "var(--text-tertiary)",
                }}
              >
                Step {i + 1}
              </span>
            </div>
            <div
              className="text-[13px] mb-1"
              style={{
                color: "var(--text-primary)",
                fontWeight: s.status === "current" ? 500 : 400,
              }}
            >
              {s.label}
            </div>
            <div className="text-[11px]" style={{ color: "var(--text-tertiary)" }}>
              {s.role}
            </div>
            <div
              className="text-[10px] mt-1"
              style={{
                fontFamily: "var(--font-jetbrains-mono)",
                color: "var(--text-tertiary)",
              }}
            >
              {s.at}
            </div>
          </li>
        ))}
      </ol>
      <div className="mt-5 pt-5 border-t flex items-center justify-between" style={{ borderColor: "var(--border-default)" }}>
        <span className="text-[12px]" style={{ color: "var(--text-secondary)" }}>
          Currently waiting on QA review &mdash; Diane has 2 invoices ahead.
        </span>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm">Kick back</Button>
          <Button variant="primary" size="sm">Approve QA →</Button>
        </div>
      </div>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────
// PATTERN 3 — Data-dense Overview (Dashboard)
// ─────────────────────────────────────────────────────────────────────

function Pattern3Dashboard() {
  const kpis = [
    { label: "Active jobs", value: "5", sub: "1 new this week" },
    { label: "PM queue", value: "3", sub: "Oldest 2d" },
    { label: "Open draws", value: "2", sub: "1 awaiting owner" },
    { label: "MTD invoiced", value: "$2.4M", sub: "+$487K from Mar" },
  ];
  return (
    <Card padding="none">
      <MockNavBar />
      <div className="p-5 border-b" style={{ borderColor: "var(--border-default)" }}>
        <Eyebrow tone="muted" className="mb-2">Today · Apr 30, 2026 · Wed</Eyebrow>
        <h3
          className="text-[24px] mb-1"
          style={{
            fontFamily: "var(--font-space-grotesk)",
            letterSpacing: "-0.02em",
            fontWeight: 500,
            color: "var(--text-primary)",
          }}
        >
          Welcome back, Jake.
        </h3>
        <p className="text-[12px]" style={{ color: "var(--text-secondary)" }}>
          You have <span style={{ color: "var(--nw-stone-blue)", fontWeight: 500 }}>3</span> PM-review items
          and <span style={{ color: "var(--nw-stone-blue)", fontWeight: 500 }}>1</span> draw pending owner approval.
        </p>
      </div>
      {/* KPI strip */}
      <div
        className="grid grid-cols-2 md:grid-cols-4"
        style={{
          gap: "1px",
          background: "var(--border-default)",
          borderTop: "1px solid var(--border-default)",
          borderBottom: "1px solid var(--border-default)",
        }}
      >
        {kpis.map((k) => (
          <div key={k.label} className="p-4" style={{ background: "var(--bg-card)" }}>
            <Eyebrow tone="muted" className="mb-2">{k.label}</Eyebrow>
            <div
              className="text-[28px] mb-1"
              style={{
                fontFamily: "var(--font-space-grotesk)",
                fontWeight: 600,
                color: "var(--text-primary)",
                letterSpacing: "-0.02em",
              }}
            >
              {k.value}
            </div>
            <div
              className="text-[10px]"
              style={{
                fontFamily: "var(--font-jetbrains-mono)",
                color: "var(--text-accent)",
              }}
            >
              {k.sub}
            </div>
          </div>
        ))}
      </div>
      {/* Attention required */}
      <div className="p-5">
        <Eyebrow tone="accent" className="mb-3">Attention required · 4 items</Eyebrow>
        <ul className="space-y-2">
          {[
            { sev: "danger" as const, text: "Draw #9 awaiting owner approval — 2 days old", time: "2d ago" },
            { sev: "warning" as const, text: "PM queue: 3 items pending review", time: "—" },
            { sev: "info" as const, text: "Vendor verification: Bayside Plumbing tax ID expires", time: "30d" },
            { sev: "neutral" as const, text: "Cost code 06101 over-budget by $1,200", time: "Live" },
          ].map((row, i) => (
            <li
              key={i}
              className="flex items-center justify-between py-2 px-3 border"
              style={{ borderColor: "var(--border-subtle)" }}
            >
              <div className="flex items-center gap-3">
                <Badge variant={row.sev}>
                  {row.sev === "danger" ? "WARN" : row.sev === "warning" ? "HIGH" : row.sev === "info" ? "MED" : "LOW"}
                </Badge>
                <span className="text-[12px]" style={{ color: "var(--text-primary)" }}>{row.text}</span>
              </div>
              <span
                className="text-[10px] uppercase"
                style={{
                  fontFamily: "var(--font-jetbrains-mono)",
                  letterSpacing: "0.1em",
                  color: "var(--text-tertiary)",
                }}
              >
                {row.time}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────
// PATTERN 4 — Mobile Touch Approval
// ─────────────────────────────────────────────────────────────────────

function Pattern4MobileApproval() {
  const inv = SAMPLE_INVOICES[0];
  const vendor = VENDOR_BY_ID[inv.vendor_id];
  return (
    <div className="flex justify-center">
      <div
        className="w-[260px] border flex flex-col"
        style={{
          borderColor: "var(--border-default)",
          background: "var(--bg-card)",
          aspectRatio: "393 / 852",
        }}
      >
        {/* Status bar */}
        <div className="h-4 flex items-center justify-between px-3 text-[9px]" style={{
          fontFamily: "var(--font-jetbrains-mono)",
          background: "var(--nw-slate-deeper)",
          color: "rgba(247,245,236,0.7)",
        }}>
          <span>9:41</span>
          <span>•••</span>
        </div>
        {/* App nav */}
        <div className="h-8 flex items-center justify-between px-3" style={{
          background: "var(--nw-slate-deeper)",
        }}>
          <span className="w-1.5 h-1.5 bg-nw-stone-blue" style={{ borderRadius: "var(--radius-dot)" }} />
          <span
            className="text-[10px] font-medium"
            style={{
              fontFamily: "var(--font-space-grotesk)",
              color: "var(--nw-white-sand)",
            }}
          >
            Nightwork
          </span>
          <div className="w-4 h-4 border" style={{
            borderRadius: "var(--radius-dot)",
            borderColor: "rgba(247,245,236,0.3)",
          }} />
        </div>
        {/* Sticky header */}
        <div className="px-3 py-2 border-b" style={{ borderColor: "var(--border-default)" }}>
          <Eyebrow tone="muted" className="mb-1" style={{ fontSize: "8px" }}>
            Invoice · {inv.invoice_number}
          </Eyebrow>
          <div
            className="text-[12px] mb-1"
            style={{
              fontFamily: "var(--font-space-grotesk)",
              fontWeight: 500,
              color: "var(--text-primary)",
            }}
          >
            {vendor?.name}
          </div>
          <Badge variant="success" size="sm">PM APPROVED</Badge>
        </div>
        {/* File preview */}
        <div
          className="flex-1 flex items-center justify-center mx-3 my-2 border"
          style={{
            background: "var(--bg-subtle)",
            borderColor: "var(--border-subtle)",
          }}
        >
          <span
            className="text-[8px] uppercase"
            style={{
              fontFamily: "var(--font-jetbrains-mono)",
              letterSpacing: "0.14em",
              color: "var(--text-tertiary)",
            }}
          >
            PDF preview
          </span>
        </div>
        {/* Status + Total row (sticky) */}
        <div className="flex items-center justify-between px-3 py-2 border-t border-b" style={{
          borderColor: "var(--border-default)",
          background: "var(--bg-card)",
        }}>
          <div>
            <Eyebrow tone="muted" style={{ fontSize: "7px" }}>Status</Eyebrow>
            <Badge variant="success" size="sm">APPROVED</Badge>
          </div>
          <div className="text-right">
            <Eyebrow tone="muted" style={{ fontSize: "7px" }}>Total</Eyebrow>
            <Money cents={inv.total_amount} size="md" variant="emphasized" />
          </div>
        </div>
        {/* Audit (last 3) */}
        <div className="px-3 py-2 text-[9px]" style={{ color: "var(--text-secondary)" }}>
          <Eyebrow tone="muted" className="mb-1.5" style={{ fontSize: "7px" }}>
            Audit · last 3
          </Eyebrow>
          <ul className="space-y-0.5">
            <li>● Apr 22 · PM approved</li>
            <li>● Apr 22 · Auto-classified</li>
            <li>● Apr 22 · Received</li>
          </ul>
        </div>
        {/* Sticky CTA */}
        <div
          className="p-2 border-t"
          style={{
            borderColor: "var(--border-default)",
            background: "var(--bg-card)",
          }}
        >
          <button
            type="button"
            className="w-full inline-flex items-center justify-center gap-1 text-[10px] font-medium uppercase"
            style={{
              fontFamily: "var(--font-jetbrains-mono)",
              letterSpacing: "0.12em",
              background: "var(--nw-stone-blue)",
              color: "var(--nw-white-sand)",
              padding: "10px 12px",
              minHeight: "40px",
            }}
          >
            Approve & Push to QB →
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// PATTERN 5 — Config Form
// ─────────────────────────────────────────────────────────────────────

function Pattern5ConfigForm() {
  return (
    <Card padding="none">
      <div className="p-5 border-b" style={{ borderColor: "var(--border-default)" }}>
        <Eyebrow tone="muted" className="mb-2">Admin · Financial settings</Eyebrow>
        <h3
          className="text-[20px] mb-1"
          style={{
            fontFamily: "var(--font-space-grotesk)",
            fontWeight: 500,
            color: "var(--text-primary)",
            letterSpacing: "-0.02em",
          }}
        >
          Payment, fees, defaults
        </h3>
      </div>
      <div className="p-5 space-y-6">
        <fieldset>
          <Eyebrow tone="muted" className="mb-3">Payment schedule</Eyebrow>
          <div className="space-y-3">
            {[
              { label: "Cutoff day 1", value: "5th of the month" },
              { label: "Cutoff day 2", value: "20th of the month" },
              { label: "Honor weekends/holidays", value: "Yes" },
            ].map((f) => (
              <div key={f.label} className="grid grid-cols-1 md:grid-cols-[200px_1fr] gap-2 items-baseline">
                <label
                  className="text-[11px]"
                  style={{
                    fontFamily: "var(--font-jetbrains-mono)",
                    color: "var(--text-secondary)",
                  }}
                >
                  {f.label}
                </label>
                <div
                  className="text-[13px] px-3 py-2 border"
                  style={{
                    borderColor: "var(--border-default)",
                    background: "var(--bg-subtle)",
                    color: "var(--text-primary)",
                  }}
                >
                  {f.value}
                </div>
              </div>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <Eyebrow tone="muted" className="mb-3">GC fee defaults</Eyebrow>
          <div className="space-y-3">
            {[
              { label: "Default GC fee %", value: "20%" },
              { label: "Default deposit %", value: "10%" },
            ].map((f) => (
              <div key={f.label} className="grid grid-cols-1 md:grid-cols-[200px_1fr] gap-2 items-baseline">
                <label
                  className="text-[11px]"
                  style={{
                    fontFamily: "var(--font-jetbrains-mono)",
                    color: "var(--text-secondary)",
                  }}
                >
                  {f.label}
                </label>
                <div
                  className="text-[13px] px-3 py-2 border"
                  style={{
                    borderColor: "var(--border-default)",
                    background: "var(--bg-subtle)",
                    color: "var(--text-primary)",
                  }}
                >
                  {f.value}
                </div>
              </div>
            ))}
          </div>
        </fieldset>
      </div>
      <div className="p-4 border-t flex items-center justify-end gap-2" style={{ borderColor: "var(--border-default)" }}>
        <Button variant="ghost" size="sm">Cancel</Button>
        <Button variant="primary" size="sm">Save changes</Button>
      </div>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────
// PATTERN 6 — List + Detail
// ─────────────────────────────────────────────────────────────────────

function Pattern6ListDetail() {
  const list = SAMPLE_INVOICES.slice(0, 6);
  const selectedIdx = 1;
  return (
    <Card padding="none">
      <div
        className="grid grid-cols-1 md:grid-cols-[280px_1fr]"
        style={{ minHeight: "400px" }}
      >
        {/* List rail */}
        <div className="border-r" style={{ borderColor: "var(--border-default)" }}>
          <div className="px-4 py-3 border-b" style={{ borderColor: "var(--border-default)" }}>
            <Eyebrow tone="muted">Invoices · 12 total</Eyebrow>
          </div>
          <ul>
            {list.map((inv, i) => {
              const v = VENDOR_BY_ID[inv.vendor_id];
              return (
                <li
                  key={inv.id}
                  className="px-4 py-3 border-b cursor-pointer"
                  style={{
                    borderColor: "var(--border-subtle)",
                    background: i === selectedIdx ? "var(--bg-subtle)" : "transparent",
                    borderLeft: i === selectedIdx ? "2px solid var(--nw-stone-blue)" : "2px solid transparent",
                  }}
                >
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="text-[12px] font-medium truncate" style={{ color: "var(--text-primary)" }}>
                      {v?.name}
                    </span>
                    <Money cents={inv.total_amount} size="sm" />
                  </div>
                  <div className="text-[10px]" style={{
                    fontFamily: "var(--font-jetbrains-mono)",
                    color: "var(--text-tertiary)",
                  }}>
                    {inv.invoice_number ?? "—"} · {inv.received_date}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
        {/* Detail */}
        <div className="p-5">
          <Pattern1DocumentReviewMini invoiceIdx={selectedIdx} />
        </div>
      </div>
    </Card>
  );
}

function Pattern1DocumentReviewMini({ invoiceIdx }: { invoiceIdx: number }) {
  const inv = SAMPLE_INVOICES[invoiceIdx];
  const vendor = VENDOR_BY_ID[inv.vendor_id];
  const job = JOB_BY_ID[inv.job_id];
  return (
    <div>
      <Eyebrow tone="muted" className="mb-2">Invoice</Eyebrow>
      <h4
        className="text-[18px] mb-2"
        style={{
          fontFamily: "var(--font-space-grotesk)",
          letterSpacing: "-0.02em",
          fontWeight: 500,
          color: "var(--text-primary)",
        }}
      >
        {inv.invoice_number} · {vendor?.name}
      </h4>
      <Badge variant="warning" className="mb-4">PM REVIEW</Badge>
      <div className="grid grid-cols-2 gap-3 text-[12px]">
        <DataRow label="Total" value={<Money cents={inv.total_amount} size="md" variant="emphasized" />} />
        <DataRow label="Project" value={job?.name} />
        <DataRow label="Type" value={inv.invoice_type.replace("_", " ")} />
        <DataRow label="Confidence" value={`${(inv.confidence_score * 100).toFixed(0)}%`} />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// PATTERN 7 — Wizard
// ─────────────────────────────────────────────────────────────────────

function Pattern7Wizard() {
  const steps = [
    { label: "Project basics", done: true },
    { label: "Contract terms", done: true },
    { label: "Cost code template", current: true },
    { label: "Initial budget", done: false },
    { label: "Review", done: false },
  ];
  return (
    <Card padding="none">
      <div className="px-5 py-4 border-b" style={{ borderColor: "var(--border-default)" }}>
        <Eyebrow tone="muted" className="mb-1">New job · Step 3 of 5</Eyebrow>
        <div
          className="text-[18px]"
          style={{
            fontFamily: "var(--font-space-grotesk)",
            fontWeight: 500,
            color: "var(--text-primary)",
            letterSpacing: "-0.02em",
          }}
        >
          Cost code template
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-[200px_1fr]">
        {/* Stepper */}
        <ol className="border-r p-4 space-y-2" style={{ borderColor: "var(--border-default)" }}>
          {steps.map((s, i) => (
            <li key={i} className="flex items-center gap-2">
              <span
                className="w-5 h-5 inline-flex items-center justify-center border text-[10px]"
                style={{
                  fontFamily: "var(--font-jetbrains-mono)",
                  borderColor: s.done ? "var(--nw-success)" : (s as { current?: boolean }).current ? "var(--nw-stone-blue)" : "var(--border-default)",
                  background: s.done ? "var(--nw-success)" : "transparent",
                  color: s.done ? "var(--nw-white-sand)" : (s as { current?: boolean }).current ? "var(--nw-stone-blue)" : "var(--text-tertiary)",
                }}
              >
                {s.done ? "✓" : i + 1}
              </span>
              <span
                className="text-[12px]"
                style={{
                  color: (s as { current?: boolean }).current ? "var(--text-primary)" : "var(--text-secondary)",
                  fontWeight: (s as { current?: boolean }).current ? 500 : 400,
                }}
              >
                {s.label}
              </span>
            </li>
          ))}
        </ol>
        {/* Body */}
        <div className="p-5">
          <p className="text-[13px] mb-4" style={{ color: "var(--text-secondary)" }}>
            Choose the cost code template to seed this job&rsquo;s budget. You can
            edit individual codes after.
          </p>
          <div className="space-y-2">
            {["Custom Home — Standard 26 codes", "Custom Home — Coastal extended", "Renovation — 18 codes"].map((opt, i) => (
              <label
                key={opt}
                className="flex items-center gap-3 p-3 border cursor-pointer"
                style={{
                  borderColor: i === 1 ? "var(--nw-stone-blue)" : "var(--border-default)",
                  background: i === 1 ? "var(--bg-subtle)" : "var(--bg-card)",
                }}
              >
                <span
                  className="w-3 h-3 inline-block border"
                  style={{
                    borderColor: i === 1 ? "var(--nw-stone-blue)" : "var(--border-strong)",
                    background: i === 1 ? "var(--nw-stone-blue)" : "transparent",
                    borderRadius: "var(--radius-dot)",
                  }}
                />
                <span className="text-[13px]" style={{ color: "var(--text-primary)" }}>{opt}</span>
              </label>
            ))}
          </div>
        </div>
      </div>
      <div className="p-4 border-t flex items-center justify-between" style={{ borderColor: "var(--border-default)" }}>
        <Button variant="ghost" size="sm">← Back</Button>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm">Save draft</Button>
          <Button variant="primary" size="sm">Continue →</Button>
        </div>
      </div>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────
// PATTERN 8 — Empty Workspace
// ─────────────────────────────────────────────────────────────────────

function Pattern8EmptyWorkspace() {
  return (
    <Card padding="lg">
      <div className="text-center py-12">
        <div className="inline-flex items-center justify-center w-16 h-16 mb-4 border" style={{
          borderColor: "var(--border-default)",
          background: "var(--bg-subtle)",
        }}>
          <Squares2X2Icon
            className="w-8 h-8"
            style={{ color: "var(--text-tertiary)" }}
            strokeWidth={1.25}
          />
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
          No invoices yet
        </h3>
        <p className="text-[13px] mb-6 max-w-[420px] mx-auto" style={{ color: "var(--text-secondary)" }}>
          Forward email invoices to <span style={{
            fontFamily: "var(--font-jetbrains-mono)",
            color: "var(--nw-stone-blue)",
          }}>ap@yourorg.nightwork.app</span> or upload PDFs directly to start your first review.
        </p>
        <div className="flex items-center justify-center gap-2">
          <Button variant="ghost" size="md">View setup guide</Button>
          <Button variant="primary" size="md">
            <PlusIcon className="w-4 h-4" strokeWidth={1.5} />
            Upload invoice
          </Button>
        </div>
      </div>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────
// PATTERN 9 — Print View (G702/G703)
// ─────────────────────────────────────────────────────────────────────

function Pattern9PrintView() {
  return (
    <Card padding="none">
      <div className="px-5 py-4 border-b" style={{ borderColor: "var(--border-strong)" }}>
        <div className="flex items-center justify-between mb-1">
          <span
            className="text-[10px] uppercase"
            style={{
              fontFamily: "var(--font-jetbrains-mono)",
              letterSpacing: "0.14em",
              color: "var(--text-secondary)",
            }}
          >
            AIA Document G702 · Application and Certificate for Payment
          </span>
          <span
            className="text-[10px] uppercase"
            style={{
              fontFamily: "var(--font-jetbrains-mono)",
              letterSpacing: "0.14em",
              color: "var(--text-secondary)",
            }}
          >
            Application No. 8
          </span>
        </div>
        <div
          className="text-[14px]"
          style={{
            fontFamily: "var(--font-space-grotesk)",
            fontWeight: 500,
            color: "var(--text-primary)",
          }}
        >
          Pelican Bay Estate · Application Date: April 30, 2026
        </div>
      </div>
      {/* G703 simulated table */}
      <table className="w-full text-[10px]" style={{
        fontFamily: "var(--font-jetbrains-mono)",
        fontVariantNumeric: "tabular-nums",
      }}>
        <thead>
          <tr style={{ background: "var(--bg-subtle)" }}>
            {["Item", "Description", "Original", "Previous", "This period", "Total to date", "%", "Balance"].map((h) => (
              <th
                key={h}
                className="px-2 py-2 text-left border"
                style={{
                  borderColor: "var(--border-default)",
                  color: "var(--text-secondary)",
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  fontSize: "9px",
                }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {[
            { item: "01101", desc: "Architectural Services", orig: 152500, prev: 152500, period: 0, percent: 100 },
            { item: "05101", desc: "Concrete / Foundation", orig: 875000, prev: 875000, period: 0, percent: 100 },
            { item: "06101", desc: "Framing — Rough Carpentry", orig: 425000, prev: 320000, period: 105000, percent: 100 },
            { item: "09101", desc: "Electrical — Rough", orig: 324000, prev: 162000, period: 81000, percent: 75 },
            { item: "10101", desc: "Plumbing — Rough", orig: 186000, prev: 93000, period: 46500, percent: 75 },
          ].map((row) => {
            const total = row.prev + row.period;
            const balance = row.orig * 100 - total * 100;
            return (
              <tr key={row.item}>
                <td className="px-2 py-1.5 border" style={{ borderColor: "var(--border-subtle)" }}>{row.item}</td>
                <td className="px-2 py-1.5 border" style={{ borderColor: "var(--border-subtle)" }}>{row.desc}</td>
                <td className="px-2 py-1.5 border text-right" style={{ borderColor: "var(--border-subtle)" }}>${row.orig.toLocaleString()}</td>
                <td className="px-2 py-1.5 border text-right" style={{ borderColor: "var(--border-subtle)" }}>${row.prev.toLocaleString()}</td>
                <td className="px-2 py-1.5 border text-right" style={{ borderColor: "var(--border-subtle)" }}>${row.period.toLocaleString()}</td>
                <td className="px-2 py-1.5 border text-right" style={{ borderColor: "var(--border-subtle)" }}>${total.toLocaleString()}</td>
                <td className="px-2 py-1.5 border text-right" style={{ borderColor: "var(--border-subtle)" }}>{row.percent}%</td>
                <td className="px-2 py-1.5 border text-right" style={{ borderColor: "var(--border-subtle)" }}>${(balance / 100).toLocaleString()}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="px-5 py-3 border-t text-[10px]" style={{
        borderColor: "var(--border-strong)",
        fontFamily: "var(--font-jetbrains-mono)",
        color: "var(--text-secondary)",
      }}>
        Page 1 of 4 · Print preview · Compact density forced regardless of user preference (SYSTEM.md §10b)
      </div>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────
// PATTERN 10 — Reconciliation (4-strawman, deferred per A16)
// ─────────────────────────────────────────────────────────────────────

function ReconciliationStrawman() {
  return (
    <div className="space-y-6">
      <div
        className="border-l-2 px-4 py-3"
        style={{
          borderColor: "var(--nw-warn)",
          background: "var(--bg-subtle)",
        }}
      >
        <Eyebrow tone="warn" className="mb-1">Deferred · A16</Eyebrow>
        <p className="text-[12px]" style={{ color: "var(--text-secondary)" }}>
          Pick at first reconciliation phase implementation per D5 / D-028.
          All 4 candidates render below for reference; the selected
          variant locks at that phase.
        </p>
      </div>

      {/* Candidate 1 — Side-by-side delta */}
      <Card padding="md">
        <Eyebrow tone="accent" className="mb-2">Candidate 1 · Side-by-side delta</Eyebrow>
        <p className="text-[12px] mb-3" style={{ color: "var(--text-secondary)" }}>
          Two columns: imported (left) vs current (right). Differences
          highlighted with --nw-warn border on the changed cell.
        </p>
        <div className="grid grid-cols-2 gap-2 text-[12px]">
          <div className="border p-3" style={{ borderColor: "var(--border-default)" }}>
            <Eyebrow tone="muted" className="mb-2">Imported · QuickBooks</Eyebrow>
            <DataRow label="Vendor" value="Bayside Plumbing Inc" />
            <DataRow label="Total" value={<Money cents={1860000} size="sm" />} />
            <DataRow label="Cost code" value="10101" />
          </div>
          <div className="border p-3" style={{ borderColor: "var(--border-default)" }}>
            <Eyebrow tone="muted" className="mb-2">Current · Nightwork</Eyebrow>
            <DataRow label="Vendor" value="Bayside Plumbing Inc." />
            <DataRow label="Total" value={<Money cents={1860000} size="sm" />} />
            <div
              className="border-l-2 pl-2"
              style={{ borderColor: "var(--nw-warn)" }}
            >
              <DataRow label="Cost code" value="10201" />
            </div>
          </div>
        </div>
      </Card>

      {/* Candidate 2 — Inline diff */}
      <Card padding="md">
        <Eyebrow tone="accent" className="mb-2">Candidate 2 · Inline diff</Eyebrow>
        <p className="text-[12px] mb-3" style={{ color: "var(--text-secondary)" }}>
          One row per record; deletion + addition stacked inline like a git
          diff. Best for many records, narrow attribute changes.
        </p>
        <div className="space-y-1 text-[12px]" style={{
          fontFamily: "var(--font-jetbrains-mono)",
        }}>
          <div className="px-3 py-1.5" style={{
            background: "rgba(176, 85, 78, 0.06)",
            color: "var(--nw-danger)",
          }}>
            − Cost code: 10201 (Plumbing — Trim &amp; Fixtures)
          </div>
          <div className="px-3 py-1.5" style={{
            background: "rgba(74, 138, 111, 0.06)",
            color: "var(--nw-success)",
          }}>
            + Cost code: 10101 (Plumbing — Rough)
          </div>
        </div>
      </Card>

      {/* Candidate 3 — Timeline overlay */}
      <Card padding="md">
        <Eyebrow tone="accent" className="mb-2">Candidate 3 · Timeline overlay</Eyebrow>
        <p className="text-[12px] mb-3" style={{ color: "var(--text-secondary)" }}>
          Single timeline; imported events overlay current events with a
          ghost ring. Best for time-ordered reconciliation (audit logs,
          activity streams).
        </p>
        <ul className="space-y-2 text-[12px]">
          {[
            { kind: "current", text: "Apr 22 · PM approved (Mark Henderson)" },
            { kind: "imported", text: "Apr 22 · QB synced (no PM record imported)" },
            { kind: "current", text: "Apr 22 · QA approved (Maria D)" },
            { kind: "match", text: "Apr 23 · Pushed to QB · matched" },
          ].map((row, i) => (
            <li key={i} className="flex items-center gap-3">
              <span
                className="w-3 h-3 shrink-0 border"
                style={{
                  borderRadius: "var(--radius-dot)",
                  background: row.kind === "imported" ? "transparent" : row.kind === "match" ? "var(--nw-success)" : "var(--nw-stone-blue)",
                  borderColor: row.kind === "imported" ? "var(--nw-warn)" : row.kind === "match" ? "var(--nw-success)" : "var(--nw-stone-blue)",
                }}
              />
              <span style={{ color: "var(--text-primary)" }}>{row.text}</span>
            </li>
          ))}
        </ul>
      </Card>

      {/* Candidate 4 — Hybrid */}
      <Card padding="md">
        <Eyebrow tone="accent" className="mb-2">Candidate 4 · Hybrid (split + inline)</Eyebrow>
        <p className="text-[12px] mb-3" style={{ color: "var(--text-secondary)" }}>
          Top-level split (imported left / current right) with row-level
          inline diff per attribute. Most expressive; highest implementation
          weight.
        </p>
        <div className="grid grid-cols-2 gap-px" style={{ background: "var(--border-default)" }}>
          <div className="p-3 text-[11px]" style={{
            background: "var(--bg-card)",
            fontFamily: "var(--font-jetbrains-mono)",
          }}>
            <Eyebrow tone="muted" className="mb-2">Imported</Eyebrow>
            <div style={{ color: "var(--text-secondary)" }}>vendor: Bayside Plumbing Inc</div>
            <div style={{ color: "var(--nw-danger)" }}>cost_code: 10201</div>
          </div>
          <div className="p-3 text-[11px]" style={{
            background: "var(--bg-card)",
            fontFamily: "var(--font-jetbrains-mono)",
          }}>
            <Eyebrow tone="muted" className="mb-2">Current</Eyebrow>
            <div style={{ color: "var(--text-secondary)" }}>vendor: Bayside Plumbing Inc.</div>
            <div style={{ color: "var(--nw-success)" }}>cost_code: 10101</div>
          </div>
        </div>
      </Card>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// PATTERN 11 — Confirm/Destructive Action
// ─────────────────────────────────────────────────────────────────────

function Pattern11Confirm() {
  return (
    <div className="flex justify-center py-6 px-4" style={{ background: "var(--bg-subtle)" }}>
      <div
        className="w-full max-w-[440px] border"
        style={{
          borderColor: "var(--border-default)",
          background: "var(--bg-card)",
        }}
      >
        <div className="px-5 py-4 border-b flex items-center gap-3" style={{ borderColor: "var(--border-default)" }}>
          <ExclamationTriangleIcon
            className="w-5 h-5 shrink-0"
            style={{ color: "var(--nw-danger)" }}
            strokeWidth={1.5}
          />
          <div>
            <Eyebrow tone="danger">Destructive action</Eyebrow>
            <h3
              className="text-[16px] mt-0.5"
              style={{
                fontFamily: "var(--font-space-grotesk)",
                fontWeight: 500,
                color: "var(--text-primary)",
              }}
            >
              Void invoice INV-2026-04-0117?
            </h3>
          </div>
        </div>
        <div className="p-5 text-[12px] space-y-3" style={{ color: "var(--text-secondary)" }}>
          <p>
            Voiding marks the invoice as <span style={{ color: "var(--nw-danger)", fontWeight: 500 }}>void</span> and
            sets a status_history entry. The original record is preserved
            (no hard delete). This action requires a reason.
          </p>
          <Textarea
            minRows={3}
            placeholder="Reason for void (required)…"
          />
        </div>
        <div className="px-5 py-3 border-t flex items-center justify-end gap-2" style={{ borderColor: "var(--border-default)" }}>
          <Button variant="ghost" size="sm">Cancel · Esc</Button>
          <Button variant="danger" size="sm">Void invoice</Button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// PATTERN 12 — Loading / Error / Skeleton states
// ─────────────────────────────────────────────────────────────────────

function Pattern12States() {
  return (
    <div className="space-y-4">
      {/* Loading skeleton */}
      <Card padding="md">
        <Eyebrow tone="muted" className="mb-3">Loading state · Skeleton shimmer</Eyebrow>
        <div className="space-y-2.5">
          <div className="h-3 w-1/3" style={{ background: "var(--bg-muted)" }} />
          <div className="h-2 w-1/2" style={{ background: "var(--bg-muted)" }} />
          <div className="h-2 w-2/5" style={{ background: "var(--bg-muted)" }} />
        </div>
      </Card>
      {/* Error state */}
      <Card padding="md">
        <Eyebrow tone="danger" className="mb-3">Error state · Recoverable</Eyebrow>
        <div className="flex items-start gap-3">
          <ExclamationTriangleIcon
            className="w-5 h-5 mt-0.5 shrink-0"
            style={{ color: "var(--nw-danger)" }}
            strokeWidth={1.5}
          />
          <div className="flex-1">
            <p className="text-[13px] mb-1" style={{ color: "var(--text-primary)", fontWeight: 500 }}>
              Failed to load invoice details
            </p>
            <p className="text-[12px] mb-3" style={{ color: "var(--text-secondary)" }}>
              The Supabase query timed out. Retry, or refresh the page.
              Error reference: <span style={{
                fontFamily: "var(--font-jetbrains-mono)",
                color: "var(--text-tertiary)",
              }}>nw-q-tmo-4419</span>
            </p>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm">View error log</Button>
              <Button variant="primary" size="sm">
                <ArrowPathIcon className="w-3.5 h-3.5" strokeWidth={1.5} />
                Retry
              </Button>
            </div>
          </div>
        </div>
      </Card>
      {/* Inline empty within container */}
      <Card padding="md">
        <Eyebrow tone="muted" className="mb-3">Empty inline · Inside a container</Eyebrow>
        <div className="text-center py-6" style={{ color: "var(--text-tertiary)" }}>
          <span className="text-[12px]">No payments recorded for this invoice yet.</span>
        </div>
      </Card>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// PAGE
// ─────────────────────────────────────────────────────────────────────

export default function PatternsPage() {
  return (
    <div className="max-w-[1100px]">
      <header className="mb-10 pb-6 border-b" style={{ borderColor: "var(--border-default)" }}>
        <Eyebrow tone="accent" className="mb-3">
          Reference · 12 PATTERNS.md entries
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
          Patterns
        </h1>
        <p
          className="text-[14px] max-w-[680px] leading-relaxed"
          style={{ color: "var(--text-secondary)" }}
        >
          Every page-level pattern Nightwork ships, rendered as a static
          layout against the playground&rsquo;s sample-data fixtures.
          Document Review is the gold standard &mdash; everything else
          inherits its file-preview-LEFT, fields-RIGHT, audit-BELOW
          discipline. Reconciliation surfaces 4 candidate models per A16
          (deferred to first reconciliation-phase implementation).
        </p>
      </header>

      <PatternSection
        index={1}
        title="Document Review"
        Icon={DocumentTextIcon}
        anchor="document-review"
        what="The canonical layout for any record review surface. File preview LEFT, structured fields RIGHT, audit timeline BELOW. The pattern every other review surface inherits."
        when="A source document exists and the user reviews + edits parsed fields. Workflow status changes append to status_history. PM/QA approval flows. Proposal review, draw approval, lien release."
        whenNot="No source document (use Config Form). Creating not reviewing (use Wizard). Listing many records (use List + Detail)."
        ascii={`┌──────────────────────────────────────────────────┐
│ NavBar                                            │
│ Breadcrumbs · Header (eyebrow + title + actions)  │
│ ┌──────────────────┬──────────────────────────┐   │
│ │ FILE PREVIEW     │ RIGHT-RAIL PANELS        │   │
│ │  (sticky on lg)  │  - Invoice details       │   │
│ │                  │  - Cost code allocation  │   │
│ │                  │  - AI extraction         │   │
│ │                  │  - Lien release          │   │
│ └──────────────────┴──────────────────────────┘   │
│ AUDIT TIMELINE (chronological, full width)        │
└──────────────────────────────────────────────────┘`}
        componentsUsed={["AppShell", "Breadcrumbs", "NwEyebrow", "NwBadge", "NwButton", "NwCard", "NwDataRow", "NwMoney", "InvoiceFilePreview"]}
        tokensUsed={["--bg-page", "--bg-card", "--text-primary", "--border-default", "--shadow-panel", "--font-display", "--font-mono", "--space-5"]}
      >
        <Pattern1DocumentReview />
      </PatternSection>

      <PatternSection
        index={2}
        title="Multi-step Approval"
        Icon={CheckBadgeIcon}
        anchor="multi-step-approval"
        what="A sequential approval chain where a record moves through ordered states (PM → QA → push to QB), each gated by a different role, each transition logged."
        when="Multiple distinct roles approve in sequence. Kick-back path exists. Composes WITHIN Document Review &mdash; Multi-step is the workflow, Document Review is the surface."
        whenNot="Single-step submit. 5+ branching steps (custom workflow). No source document."
        ascii={`Step 1 ─── Step 2 ─── Step 3 ─── Step 4 ─── Step 5
PM       QA       Push QB   In Draw   Paid
●        ◐ now     ○         ○         ○
done    current   pending   pending   pending`}
        componentsUsed={["NwCard", "NwEyebrow", "NwStatusDot", "NwButton", "NwBadge"]}
        tokensUsed={["--nw-stone-blue", "--nw-success", "--text-tertiary", "--font-mono"]}
      >
        <Pattern2MultiStepApproval />
      </PatternSection>

      <PatternSection
        index={3}
        title="Data-dense Overview (Dashboard)"
        Icon={ChartBarIcon}
        anchor="dashboard"
        what="A multi-widget summary page for a role or domain. Many KPI cards, multiple data widgets, one top-line headline. Scan first, drill in to act."
        when="4-12 distinct metrics for a role. Mostly read-only widgets. At most one primary action. Home dashboard, per-job dashboard, owner portal."
        whenNot="Editing not scanning (Config Form). Listing records uniformly (List + Detail). Mobile-first surface (Mobile Approval)."
        ascii={`┌─────────────────────────────────────────┐
│ NavBar · Header (greeting + sub)         │
│ ┌──────┬──────┬──────┬──────┐ KPI strip  │
│ │ KPI1 │ KPI2 │ KPI3 │ KPI4 │  4-col grid│
│ └──────┴──────┴──────┴──────┘            │
│ ATTENTION REQUIRED · 4 items              │
│ CASH FLOW · OUTSTANDING BY AGING          │
│ RECENT ACTIVITY · last 8                  │
└─────────────────────────────────────────┘`}
        componentsUsed={["AppShell", "NwCard", "NwEyebrow", "NwBadge", "NwMoney", "NwStatusDot", "NwButton"]}
        tokensUsed={["--bg-page", "--bg-card", "--bg-muted", "--nw-stone-blue", "--nw-success", "--nw-warn", "--font-display", "--font-mono"]}
      >
        <Pattern3Dashboard />
      </PatternSection>

      <PatternSection
        index={4}
        title="Mobile Touch Approval"
        Icon={DevicePhoneMobileIcon}
        anchor="mobile-approval"
        what="Touch-first single-action surface for PMs in the field. Maximum context above-the-fold, single primary CTA, secondary actions in overflow."
        when="User on phone, action is approval/hold/deny, content already reviewed. Single canonical action 80% of the time."
        whenNot="Multi-field editing. Desktop-first surface. Tablet (use Document Review collapse)."
        ascii={`iPhone 15 Pro · 393×852pt
┌─────────────────────────┐
│ NavBar (icon + role)    │
│ Eyebrow · Title · Status│
│ TOTAL — large money      │
│ 4-quad meta grid         │
│ ┌─────────────────────┐ │
│ │ FILE PREVIEW        │ │
│ │ tap to expand       │ │
│ └─────────────────────┘ │
│ AUDIT (last 3 events)    │
│ ━━━━━━━━━━━━━━━━━━━━━━━ │
│ ║ APPROVE & PUSH ║ ⋮More│  ← sticky 56×56
└─────────────────────────┘`}
        componentsUsed={["NwBadge", "NwMoney", "NwDataRow", "NwButton (xl/56)", "Popover"]}
        tokensUsed={["--bg-card", "--brand-accent", "--font-display", "--font-mono", "--space-3"]}
      >
        <Pattern4MobileApproval />
      </PatternSection>

      <PatternSection
        index={5}
        title="Config Form (settings)"
        Icon={Cog6ToothIcon}
        anchor="config-form"
        what="Form-driven page for configuring a tenant or domain. Fields grouped into sections, save bar at the bottom. No source document, no audit timeline (settings audit lives elsewhere)."
        when="Editing org-scoped config. All fields direct-edit. Validation field-level + form-level."
        whenNot="Record with source document (Document Review). Listing records (List + Detail). Sequential creation (Wizard)."
        ascii={`Header · Sub-nav (Company · Financial · Workflow ·)
┌─────────────────────────────────────────┐
│ Section · Payment Schedule              │
│  Cutoff day 1 · Cutoff day 2 · Honor    │
├─────────────────────────────────────────┤
│ Section · GC Fee Defaults                │
│  Default GC fee % · Default deposit %   │
└─────────────────────────────────────────┘
[Cancel]  [Save changes]`}
        componentsUsed={["Form", "FormField", "FormLabel", "Input", "Combobox", "NwButton"]}
        tokensUsed={["--bg-card", "--bg-subtle", "--border-default", "--text-primary", "--font-mono"]}
      >
        <Pattern5ConfigForm />
      </PatternSection>

      <PatternSection
        index={6}
        title="List + Detail"
        Icon={ListBulletIcon}
        anchor="list-detail"
        what="A scrollable list rail on the left with the selected record's detail on the right. Master-detail view. Click a row to load its detail."
        when="Browsing many records of the same shape. Quick-switch between records is valuable. Records have a meaningful detail view."
        whenNot="Single-record review (Document Review). Form-driven editing (Config Form). Dashboard scan (Dashboard)."
        ascii={`┌──────────┬───────────────────────────┐
│ LIST     │ DETAIL                       │
│ ┌────┐   │ ┌─────────────────────────┐  │
│ │row │   │ │ Selected record         │  │
│ ├────┤   │ │   Document Review style │  │
│ │ROW │ ←─│ │                         │  │
│ │ACTV│   │ │                         │  │
│ ├────┤   │ │                         │  │
│ │row │   │ └─────────────────────────┘  │
│ └────┘   │                               │
└──────────┴───────────────────────────────┘`}
        componentsUsed={["NwCard", "NwEyebrow", "NwBadge", "NwMoney", "NwDataRow"]}
        tokensUsed={["--bg-card", "--bg-subtle", "--border-default", "--nw-stone-blue", "--font-mono"]}
      >
        <Pattern6ListDetail />
      </PatternSection>

      <PatternSection
        index={7}
        title="Wizard"
        Icon={ArrowsRightLeftIcon}
        anchor="wizard"
        what="Sequential creation flow with stepper, gated forward progress, save-draft + back navigation. New job creation, new vendor onboarding, draw assembly."
        when="Sequential, gated steps. State accumulates across steps. User wants to know &lsquo;where am I&rsquo;."
        whenNot="Form is short enough for one page (Config Form). Editing existing record (Document Review)."
        ascii={`Step 1 · Step 2 · Step 3 · Step 4 · Step 5
done    done    CURRENT pending pending
┌─────────────────────────────────────────┐
│ Stepper rail │  Step body              │
│ 1 ✓          │  Form fields for step 3  │
│ 2 ✓          │                          │
│ 3 ●          │                          │
│ 4 ○          │                          │
│ 5 ○          │                          │
└─────────────────────────────────────────┘
[← Back]  [Save draft]  [Continue →]`}
        componentsUsed={["NwCard", "NwEyebrow", "NwButton", "Form", "Combobox"]}
        tokensUsed={["--bg-card", "--bg-subtle", "--nw-stone-blue", "--nw-success", "--font-mono"]}
      >
        <Pattern7Wizard />
      </PatternSection>

      <PatternSection
        index={8}
        title="Empty Workspace"
        Icon={Squares2X2Icon}
        anchor="empty-workspace"
        what="The zero-state for any container that has no records yet. Friendly, action-oriented &mdash; tells the user how to get started."
        when="A list / dashboard / queue / drawer is empty for a real reason (new tenant, fresh job). User would otherwise think the page is broken."
        whenNot="Loading state (use Skeleton). Error state (use Error). Filtered to empty (use &lsquo;clear filters&rsquo; affordance)."
        ascii={`┌─────────────────────────────────────┐
│                                       │
│           ┌───────┐                   │
│           │ ICON  │                   │
│           └───────┘                   │
│        No invoices yet                │
│                                       │
│  Forward email invoices to            │
│  ap@yourorg.nightwork.app             │
│                                       │
│  [View setup guide] [Upload invoice]  │
│                                       │
└─────────────────────────────────────┘`}
        componentsUsed={["NwCard", "NwButton", "Heroicons"]}
        tokensUsed={["--bg-card", "--bg-subtle", "--border-default", "--text-secondary", "--font-display"]}
      >
        <Pattern8EmptyWorkspace />
      </PatternSection>

      <PatternSection
        index={9}
        title="Print View (G702/G703)"
        Icon={PrinterIcon}
        anchor="print-view"
        what="Print-optimized layout for AIA G702/G703 pay applications. Compact density forced regardless of user preference. No animations, no shadows."
        when="Generating a PDF or print-preview for a draw. Owner sign-off. Submission to lender."
        whenNot="On-screen review (Document Review). Editing (Config Form)."
        ascii={`AIA G702 · Application No. 8 · April 30, 2026
Pelican Bay Estate
─────────────────────────────────────────────
Item   Description     Original  This per  Total
01101  Architectural   $152,500   $0       $152,500
05101  Concrete         $875,000  $0       $875,000
06101  Framing          $425,000  $105,000 $425,000
09101  Electrical       $324,000  $81,000  $243,000
─────────────────────────────────────────────
Page 1 of 4 · Compact density forced`}
        componentsUsed={["table", "NwEyebrow", "NwMoney"]}
        tokensUsed={["--bg-card", "--border-default", "--border-strong", "--font-mono", "--density-compact"]}
      >
        <Pattern9PrintView />
      </PatternSection>

      <PatternSection
        index={10}
        title="Reconciliation (4-strawman)"
        Icon={ScaleIcon}
        anchor="reconciliation"
        what="The pattern for showing differences between two data sources (imported vs current, QB vs Nightwork, owner-sent vs internal). Per A16: 4 candidate models render as a strawman, picked at first reconciliation-phase implementation."
        when="Data import comparison. Cross-system sync resolution. Audit log replay vs current state."
        whenNot="One-record review (Document Review). Listing records (List + Detail)."
        ascii={`Candidate 1 · Side-by-side delta
Candidate 2 · Inline diff (git-style)
Candidate 3 · Timeline overlay
Candidate 4 · Hybrid (split + inline)
            ↓
Pick at first reconciliation phase (A16)`}
        componentsUsed={["NwCard", "NwEyebrow", "NwDataRow", "NwMoney", "NwBadge"]}
        tokensUsed={["--bg-card", "--nw-warn", "--nw-danger", "--nw-success", "--border-default", "--font-mono"]}
      >
        <ReconciliationStrawman />
      </PatternSection>

      <PatternSection
        index={11}
        title="Confirm / Destructive Action"
        Icon={ExclamationTriangleIcon}
        anchor="confirm"
        what="A modal that intercepts a destructive action (void, delete-soft, finalize, kick-back) and requires explicit confirmation, often with a reason note."
        when="Action is irreversible-ish and high-stakes. State change is recorded permanently. User error would be expensive to undo."
        whenNot="Reversible action (just do it). Form save (no confirm needed). Routine navigation."
        ascii={`         ┌──────────────────────────┐
         │  [!] Destructive action  │
         │  Void invoice INV-…?     │
         ├──────────────────────────┤
         │  Voiding marks the       │
         │  invoice as void…        │
         │  ┌────────────────────┐  │
         │  │ Reason (required)… │  │
         │  └────────────────────┘  │
         ├──────────────────────────┤
         │   [Cancel·Esc]  [Void]   │
         └──────────────────────────┘`}
        componentsUsed={["Dialog", "Textarea", "NwButton (danger)", "Heroicons"]}
        tokensUsed={["--bg-card", "--bg-subtle", "--nw-danger", "--border-default", "--font-display"]}
      >
        <Pattern11Confirm />
      </PatternSection>

      <PatternSection
        index={12}
        title="Loading / Error / Skeleton states"
        Icon={ArrowPathIcon}
        anchor="states"
        what="The universal layer that every other pattern uses. Skeleton while loading, error with retry path, empty inline within a container."
        when="Always. Every data-fetching surface ships skeleton + error + empty states from day one."
        whenNot="Static content with no fetch. Print view (no animations)."
        ascii={`Loading skeleton            Error with retry
─ ─ ─ ─ ─ ─ ─ ─ ─ ─        [!] Failed to load
░░░░░░░░░░ 1/3              The query timed out.
░░░░░░ 1/2                  Error: nw-q-tmo-4419
░░░░░ 2/5                   [Log] [Retry ↻]

Empty inline (inside a container)
"No payments recorded yet."`}
        componentsUsed={["Skeleton", "ErrorBoundary", "NwCard", "NwButton", "Heroicons"]}
        tokensUsed={["--bg-muted", "--nw-danger", "--text-tertiary", "--font-mono"]}
      >
        <Pattern12States />
      </PatternSection>
    </div>
  );
}
