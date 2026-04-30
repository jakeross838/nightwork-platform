// Design-system playground — components/data-display (Stage 1.5a, T20e).
//
// Renders the 3 Data Display entries from COMPONENTS.md §5:
//   Table — simple HTML table styled with tokens, sample invoices.
//   DataGrid — TanStack Table v8 with sortable + filterable columns.
//   ConfidenceBadge — composed over NwBadge with confidence-score routing
//     (≥85% success / 70-84% warning / <70% danger).
//
// IMPORTANT — token discipline:
//   - All colors via CSS vars or `nw-*` Tailwind utilities.
//   - Square corners. Bullet dot uses --radius-dot.
//   - Heroicons outline for new icons (NOT lucide — A12.2 boundary).
//
// IMPORTANT — sample-data isolation (SPEC D9 / hook T10c):
//   - Fixtures imported from `@/app/design-system/_fixtures` only.
//   - Sample invoices, vendors, jobs, cost-codes are pure constants.

"use client";

import { useState, useMemo } from "react";
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import {
  ChevronUpIcon,
  ChevronDownIcon,
  ChevronUpDownIcon,
  MagnifyingGlassIcon,
  CheckIcon,
} from "@heroicons/react/24/outline";

import NwButton from "@/components/nw/Button";
import NwEyebrow from "@/components/nw/Eyebrow";
import NwBadge from "@/components/nw/Badge";
import NwCard from "@/components/nw/Card";
import NwMoney from "@/components/nw/Money";
import { Input as ShadcnInput } from "@/components/ui/input";

import {
  SAMPLE_INVOICES,
  SAMPLE_VENDORS,
  SAMPLE_JOBS,
  type SampleInvoice,
} from "@/app/design-system/_fixtures";

// ─────────────────────────────────────────────────────────────────────────
// Section helpers (consistent with sibling category pages)
// ─────────────────────────────────────────────────────────────────────────
function ComponentSection({
  title,
  source,
  children,
}: {
  title: string;
  source: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className="mb-12 pb-10 border-b last:border-b-0"
      style={{ borderColor: "var(--border-default)" }}
    >
      <div className="mb-6">
        <NwEyebrow tone="accent" className="mb-2">
          {title}
        </NwEyebrow>
        <p
          className="text-[12px]"
          style={{
            fontFamily: "var(--font-jetbrains-mono)",
            color: "var(--text-tertiary)",
          }}
        >
          Source · {source}
        </p>
      </div>
      <div className="space-y-6">{children}</div>
    </section>
  );
}

function SubBlock({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <NwEyebrow tone="muted" className="mb-3">
        {label}
      </NwEyebrow>
      {children}
    </div>
  );
}

function TokenList({
  bindings,
}: {
  bindings: Array<{ token: string; role: string }>;
}) {
  return (
    <div
      className="border p-3 text-[11px] leading-relaxed"
      style={{
        borderColor: "var(--border-default)",
        background: "var(--bg-subtle)",
      }}
    >
      <ul className="space-y-1">
        {bindings.map((b) => (
          <li
            key={b.token}
            style={{
              fontFamily: "var(--font-jetbrains-mono)",
              color: "var(--text-secondary)",
            }}
          >
            <span style={{ color: "var(--nw-stone-blue)" }}>{b.token}</span>
            <span style={{ color: "var(--text-tertiary)" }}> · {b.role}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function AntiPatterns({ items }: { items: string[] }) {
  return (
    <div
      className="border p-3 text-[12px] leading-relaxed"
      style={{
        borderColor: "rgba(176,85,78,0.4)",
        background: "rgba(176,85,78,0.04)",
      }}
    >
      <ul className="space-y-1.5">
        {items.map((item, i) => (
          <li
            key={i}
            className="pl-3 relative"
            style={{ color: "var(--text-secondary)" }}
          >
            <span
              className="absolute left-0 top-[6px] w-1.5 h-1.5"
              style={{
                background: "var(--nw-danger)",
                borderRadius: "var(--radius-dot)",
              }}
              aria-hidden="true"
            />
            <strong style={{ color: "var(--nw-danger)" }}>DO NOT</strong>{" "}
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

function ARIANote({ children }: { children: React.ReactNode }) {
  return (
    <p
      className="text-[12px] leading-relaxed"
      style={{ color: "var(--text-secondary)" }}
    >
      {children}
    </p>
  );
}

// Status → NwBadge variant mapping. Aligns with COMPONENTS.md §3.3 variant
// set. The narrow set of statuses we map here is the workflow vocabulary
// from CLAUDE.md "Invoice workflow" status flow.
function statusBadgeVariant(
  status: SampleInvoice["status"],
): "neutral" | "success" | "warning" | "danger" | "info" | "accent" {
  switch (status) {
    case "received":
    case "ai_processed":
      return "info";
    case "pm_review":
    case "qa_review":
      return "warning";
    case "pm_approved":
    case "qa_approved":
    case "pushed_to_qb":
    case "in_draw":
    case "paid":
      return "success";
    case "pm_held":
      return "warning";
    case "pm_denied":
    case "qa_kicked_back":
      return "danger";
    default:
      return "neutral";
  }
}

function statusLabel(status: SampleInvoice["status"]): string {
  return status.replace(/_/g, " ").toUpperCase();
}

// ─────────────────────────────────────────────────────────────────────────
// 1. Table section — simple HTML table styled with tokens
// ─────────────────────────────────────────────────────────────────────────
function TableSection() {
  const rows = SAMPLE_INVOICES.slice(0, 8);

  return (
    <ComponentSection
      title="Table"
      source="Simple HTML <table> styled with Tailwind tokens — shadcn Table primitive not yet installed; this is the canonical pattern"
    >
      <SubBlock label="Live table — 8 sample invoices (Invoice # / Vendor / Job / Amount / Status)">
        <div
          className="border overflow-x-auto"
          style={{ borderColor: "var(--border-default)" }}
        >
          <table
            className="w-full text-[13px]"
            style={{ background: "var(--bg-card)" }}
          >
            <thead>
              <tr
                className="border-b"
                style={{
                  background: "var(--bg-muted)",
                  borderColor: "var(--border-default)",
                }}
              >
                {["Invoice #", "Vendor", "Job", "Amount", "Status"].map((h) => (
                  <th
                    key={h}
                    scope="col"
                    className="text-left px-3 h-8 text-[10px] uppercase font-medium"
                    style={{
                      fontFamily: "var(--font-jetbrains-mono)",
                      letterSpacing: "0.14em",
                      color: "var(--text-tertiary)",
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((inv, i) => {
                const vendor = SAMPLE_VENDORS.find(
                  (v) => v.id === inv.vendor_id,
                );
                const job = SAMPLE_JOBS.find((j) => j.id === inv.job_id);
                return (
                  <tr
                    key={inv.id}
                    className={i < rows.length - 1 ? "border-b" : ""}
                    style={{ borderColor: "var(--border-default)" }}
                  >
                    <td
                      className="px-3 h-8"
                      style={{
                        fontFamily: "var(--font-jetbrains-mono)",
                        color: "var(--text-primary)",
                      }}
                    >
                      {inv.invoice_number ?? "—"}
                    </td>
                    <td
                      className="px-3"
                      style={{ color: "var(--text-primary)" }}
                    >
                      {vendor?.name ?? "—"}
                    </td>
                    <td
                      className="px-3"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      {job?.name ?? "—"}
                    </td>
                    <td className="px-3 text-right">
                      <NwMoney cents={inv.total_amount} size="md" />
                    </td>
                    <td className="px-3">
                      <NwBadge
                        variant={statusBadgeVariant(inv.status)}
                        size="sm"
                      >
                        {statusLabel(inv.status)}
                      </NwBadge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </SubBlock>

      <SubBlock label="Token bindings (per SYSTEM.md §1, §4e, §10)">
        <TokenList
          bindings={[
            { token: "--bg-card", role: "table bg" },
            { token: "--bg-muted", role: "header bg + striped row alt" },
            { token: "--text-primary", role: "cell text" },
            { token: "--text-secondary", role: "supporting cell text" },
            { token: "--text-tertiary", role: "header label" },
            { token: "--border-default", role: "row dividers" },
            { token: "--font-mono + tabular-nums", role: "money columns (SYSTEM §4e)" },
            { token: "--font-jetbrains-mono", role: "header labels (uppercase)" },
          ]}
        />
      </SubBlock>

      <SubBlock label="ARIA / a11y">
        <ARIANote>
          Native <code>&lt;table&gt;</code> semantics: <code>&lt;thead&gt;</code>,{" "}
          <code>&lt;tbody&gt;</code>,{" "}
          <code>&lt;th scope=&quot;col&quot;&gt;</code>. Caption via{" "}
          <code>&lt;caption&gt;</code> (or <code>&lt;TableCaption&gt;</code> when
          shadcn Table ships). Sortable columns get{" "}
          <code>aria-sort=&quot;ascending|descending|none&quot;</code> on the
          <code>&lt;th&gt;</code>. Money columns ALWAYS use{" "}
          <code>tabular-nums</code> to keep digits aligned across rows.
        </ARIANote>
      </SubBlock>

      <SubBlock label="Anti-patterns">
        <AntiPatterns
          items={[
            "use Table for layout — that's a grid",
            "omit <th scope> — SR users lose row/column orientation",
            "use <table> for forms — that's <form>",
            "pass org_id (A12.1) — Table is data-blind",
          ]}
        />
      </SubBlock>
    </ComponentSection>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// 2. DataGrid section — TanStack Table v8 with sort + filter
// ─────────────────────────────────────────────────────────────────────────

// Row shape — joins invoice with vendor + job names so the grid renders a
// flat record (TanStack does not need joining; we just denormalize for
// display).
type InvoiceRow = {
  id: string;
  invoice_number: string;
  vendor_name: string;
  job_name: string;
  total_amount: number; // cents
  confidence_score: number;
  status: SampleInvoice["status"];
};

function DataGridSection() {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState("");

  // Denormalize SAMPLE_INVOICES → flat row shape for the grid.
  const data = useMemo<InvoiceRow[]>(() => {
    return SAMPLE_INVOICES.map((inv) => {
      const vendor = SAMPLE_VENDORS.find((v) => v.id === inv.vendor_id);
      const job = SAMPLE_JOBS.find((j) => j.id === inv.job_id);
      return {
        id: inv.id,
        invoice_number: inv.invoice_number ?? "—",
        vendor_name: vendor?.name ?? "—",
        job_name: job?.name ?? "—",
        total_amount: inv.total_amount,
        confidence_score: inv.confidence_score,
        status: inv.status,
      };
    });
  }, []);

  const columns = useMemo<ColumnDef<InvoiceRow>[]>(
    () => [
      {
        accessorKey: "invoice_number",
        header: "Invoice #",
        cell: (info) => (
          <span
            style={{
              fontFamily: "var(--font-jetbrains-mono)",
              color: "var(--text-primary)",
            }}
          >
            {info.getValue<string>()}
          </span>
        ),
      },
      {
        accessorKey: "vendor_name",
        header: "Vendor",
      },
      {
        accessorKey: "job_name",
        header: "Job",
        cell: (info) => (
          <span style={{ color: "var(--text-secondary)" }}>
            {info.getValue<string>()}
          </span>
        ),
      },
      {
        accessorKey: "total_amount",
        header: "Amount",
        cell: (info) => (
          <NwMoney cents={info.getValue<number>()} size="md" />
        ),
        sortingFn: "basic",
      },
      {
        accessorKey: "confidence_score",
        header: "Confidence",
        cell: (info) => {
          const score = info.getValue<number>();
          return <ConfidenceBadge confidence={score} />;
        },
        sortingFn: "basic",
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: (info) => {
          const s = info.getValue<SampleInvoice["status"]>();
          return (
            <NwBadge variant={statusBadgeVariant(s)} size="sm">
              {statusLabel(s)}
            </NwBadge>
          );
        },
      },
    ],
    [],
  );

  const table = useReactTable({
    data,
    columns,
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  return (
    <ComponentSection
      title="DataGrid"
      source="TanStack Table v8 (@tanstack/react-table@^8.21.3) — headless; rendered through Table primitive"
    >
      <SubBlock label="Live grid — 12 invoices, sortable + filterable (click headers / type to filter)">
        {/* Filter input */}
        <div className="mb-3 max-w-[360px] relative">
          <span
            aria-hidden="true"
            className="absolute left-2.5 top-1/2 -translate-y-1/2"
            style={{ color: "var(--text-tertiary)" }}
          >
            <MagnifyingGlassIcon className="w-4 h-4" strokeWidth={1.5} />
          </span>
          <ShadcnInput
            type="text"
            placeholder="Filter invoices…"
            value={globalFilter ?? ""}
            onChange={(e) => setGlobalFilter(e.target.value)}
            className="pl-8"
            aria-label="Filter invoices"
          />
        </div>

        {/* Active filter chips (just one global filter for now) */}
        {globalFilter && (
          <div className="mb-3 flex items-center gap-2">
            <NwEyebrow tone="muted">Filter</NwEyebrow>
            <button
              type="button"
              onClick={() => setGlobalFilter("")}
              aria-label={`Remove filter: ${globalFilter}`}
              className="px-2 h-6 inline-flex items-center gap-1 text-[11px] border"
              style={{
                fontFamily: "var(--font-jetbrains-mono)",
                background: "var(--bg-subtle)",
                borderColor: "var(--border-default)",
                color: "var(--text-primary)",
              }}
            >
              {globalFilter}
              <span style={{ color: "var(--text-tertiary)" }}>×</span>
            </button>
          </div>
        )}

        <div
          className="border overflow-x-auto"
          style={{ borderColor: "var(--border-default)" }}
        >
          <table
            className="w-full text-[13px]"
            style={{ background: "var(--bg-card)" }}
          >
            <thead>
              {table.getHeaderGroups().map((hg) => (
                <tr
                  key={hg.id}
                  className="border-b"
                  style={{
                    background: "var(--bg-muted)",
                    borderColor: "var(--border-default)",
                  }}
                >
                  {hg.headers.map((header) => {
                    const sorted = header.column.getIsSorted();
                    const sortable = header.column.getCanSort();
                    return (
                      <th
                        key={header.id}
                        scope="col"
                        aria-sort={
                          sorted === "asc"
                            ? "ascending"
                            : sorted === "desc"
                              ? "descending"
                              : sortable
                                ? "none"
                                : undefined
                        }
                        className="text-left px-3 h-8 text-[10px] uppercase font-medium"
                        style={{
                          fontFamily: "var(--font-jetbrains-mono)",
                          letterSpacing: "0.14em",
                          color: "var(--text-tertiary)",
                        }}
                      >
                        {sortable ? (
                          <button
                            type="button"
                            onClick={header.column.getToggleSortingHandler()}
                            className="inline-flex items-center gap-1 hover:[color:var(--text-primary)] transition-colors"
                            style={{
                              fontFamily: "var(--font-jetbrains-mono)",
                              letterSpacing: "0.14em",
                              color: sorted
                                ? "var(--text-primary)"
                                : "var(--text-tertiary)",
                            }}
                          >
                            {flexRender(
                              header.column.columnDef.header,
                              header.getContext(),
                            )}
                            <span
                              style={{
                                color: sorted
                                  ? "var(--nw-stone-blue)"
                                  : "var(--text-tertiary)",
                              }}
                            >
                              {sorted === "asc" ? (
                                <ChevronUpIcon
                                  className="w-3 h-3"
                                  aria-hidden="true"
                                  strokeWidth={1.5}
                                />
                              ) : sorted === "desc" ? (
                                <ChevronDownIcon
                                  className="w-3 h-3"
                                  aria-hidden="true"
                                  strokeWidth={1.5}
                                />
                              ) : (
                                <ChevronUpDownIcon
                                  className="w-3 h-3 opacity-40"
                                  aria-hidden="true"
                                  strokeWidth={1.5}
                                />
                              )}
                            </span>
                          </button>
                        ) : (
                          flexRender(
                            header.column.columnDef.header,
                            header.getContext(),
                          )
                        )}
                      </th>
                    );
                  })}
                </tr>
              ))}
            </thead>
            <tbody>
              {table.getRowModel().rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={columns.length}
                    className="px-3 py-6 text-center text-[12px]"
                    style={{ color: "var(--text-tertiary)" }}
                  >
                    No invoices match.
                  </td>
                </tr>
              ) : (
                table.getRowModel().rows.map((row, i, arr) => (
                  <tr
                    key={row.id}
                    className={i < arr.length - 1 ? "border-b" : ""}
                    style={{ borderColor: "var(--border-default)" }}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td
                        key={cell.id}
                        className="px-3 h-8"
                        style={{ color: "var(--text-primary)" }}
                      >
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext(),
                        )}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <p
          className="text-[11px] mt-2"
          style={{
            fontFamily: "var(--font-jetbrains-mono)",
            color: "var(--text-tertiary)",
          }}
        >
          {table.getRowModel().rows.length} of {data.length} invoices
        </p>
      </SubBlock>

      <SubBlock label="Token bindings (inherits Table tokens)">
        <TokenList
          bindings={[
            { token: "--bg-card", role: "table bg" },
            { token: "--bg-muted", role: "header bg" },
            { token: "--text-primary", role: "active sort header + cell text" },
            { token: "--text-tertiary", role: "inactive sort header + supporting" },
            { token: "--nw-stone-blue", role: "active sort indicator" },
            { token: "--bg-subtle", role: "filter chip bg" },
            { token: "--border-default", role: "row dividers + chip border" },
          ]}
        />
      </SubBlock>

      <SubBlock label="ARIA / a11y">
        <ARIANote>
          Sortable columns: <code>aria-sort</code> on header (
          <code>ascending</code> / <code>descending</code> /{" "}
          <code>none</code>). Selectable rows would add{" "}
          <code>role=&quot;row&quot;</code> + <code>aria-selected</code>.
          Pagination buttons (when present): &ldquo;Go to next page&rdquo;,
          &ldquo;Go to previous page&rdquo;. Filter chips: dismissible buttons
          with <code>aria-label=&quot;Remove filter: &lt;name&gt;&quot;</code>.
          Mobile: pagination controls grow to 44px touch targets; column
          visibility menu is a Popover at <code>nw-tablet</code>+; full-screen
          Sheet at <code>nw-phone</code>.
        </ARIANote>
      </SubBlock>

      <SubBlock label="Anti-patterns">
        <AntiPatterns
          items={[
            "bypass TanStack and roll your own table state — you lose accessibility + cross-feature consistency",
            "pass org_id to a column — pass tenant-aware data through the data prop only",
            "use DataGrid for <10 rows — Table is enough",
            "put DataGrid inside DataGrid — use sub-rows / row-expansion",
          ]}
        />
      </SubBlock>
    </ComponentSection>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// 3. ConfidenceBadge — composed primitive (used by DataGrid above)
// ─────────────────────────────────────────────────────────────────────────

// Confidence routing per CLAUDE.md "Confidence Routing":
//   ≥ 0.85 → success (green) — PM auto-approve candidate
//   0.70-0.84 → warning (yellow) — needs PM review
//   < 0.70 → danger (red) — Diane triages first
function ConfidenceBadge({
  confidence,
  showPercent = true,
  size = "sm",
}: {
  confidence: number;
  showPercent?: boolean;
  size?: "sm" | "md";
}) {
  const pct = Math.round(confidence * 100);
  const variant: "success" | "warning" | "danger" =
    confidence >= 0.85
      ? "success"
      : confidence >= 0.7
        ? "warning"
        : "danger";

  return (
    <NwBadge
      variant={variant}
      size={size}
      aria-label={`AI confidence ${pct}%`}
    >
      {showPercent ? `${pct}%` : variant.toUpperCase()}
    </NwBadge>
  );
}

function ConfidenceBadgeSection() {
  const samples = [
    { score: 0.94, label: "High — auto-route" },
    { score: 0.78, label: "Mid — PM review" },
    { score: 0.62, label: "Low — Diane triage" },
  ];

  return (
    <ComponentSection
      title="ConfidenceBadge"
      source="Composition over NwBadge — drives AI confidence routing per CLAUDE.md"
    >
      <SubBlock label="3 routing thresholds (≥85% / 70-84% / <70%)">
        <div className="space-y-3 max-w-[640px]">
          {samples.map((s) => (
            <NwCard
              key={s.score}
              variant="default"
              padding="md"
              className="flex items-center justify-between"
            >
              <div>
                <p
                  className="text-[13px] mb-0.5"
                  style={{ color: "var(--text-primary)" }}
                >
                  {s.label}
                </p>
                <p
                  className="text-[11px]"
                  style={{ color: "var(--text-tertiary)" }}
                >
                  raw score: {s.score.toFixed(2)}
                </p>
              </div>
              <ConfidenceBadge confidence={s.score} size="md" />
            </NwCard>
          ))}
        </div>
      </SubBlock>

      <SubBlock label="Token bindings (inherits NwBadge variants)">
        <TokenList
          bindings={[
            { token: "--color-success / --nw-success", role: "≥85% (auto-route)" },
            { token: "--color-warning / --nw-warn", role: "70-84% (PM review)" },
            { token: "--color-error / --nw-danger", role: "<70% (Diane triage)" },
            { token: "Bordered + tinted (Slate non-negotiable #7)", role: "border + text share variant color; bg is subtle tint" },
          ]}
        />
      </SubBlock>

      <SubBlock label="ARIA / a11y">
        <ARIANote>
          NwBadge inherits <code>&lt;span&gt;</code> semantics; SR-friendly
          text rendered inside (e.g. &ldquo;94%&rdquo;).{" "}
          <code>aria-label=&quot;AI confidence ${"{pct}"}%&quot;</code>. The
          visual color is reinforced by text — never color-only (WCAG 1.4.1).
        </ARIANote>
      </SubBlock>

      <SubBlock label="Anti-patterns">
        <AntiPatterns
          items={[
            "display confidence as a raw float (0.94) — always format as percentage",
            "invert the routing thresholds (locked per CLAUDE.md and SPEC)",
            "use ConfidenceBadge outside AI parsing contexts — variant routing is AI-specific",
            "pass org_id (A12.1)",
          ]}
        />
      </SubBlock>
    </ComponentSection>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Page assembly
// ─────────────────────────────────────────────────────────────────────────
export default function ComponentsDataDisplayPage() {
  return (
    <div className="max-w-[1100px]">
      <header
        className="mb-10 pb-6 border-b"
        style={{ borderColor: "var(--border-default)" }}
      >
        <NwEyebrow tone="accent" className="mb-3">
          Components · Data display
        </NwEyebrow>
        <h1
          className="text-[28px] mb-3"
          style={{
            fontFamily: "var(--font-space-grotesk)",
            letterSpacing: "-0.02em",
            fontWeight: 500,
            color: "var(--text-primary)",
          }}
        >
          Data display primitives
        </h1>
        <p
          className="text-[14px] max-w-[680px] leading-relaxed"
          style={{ color: "var(--text-secondary)" }}
        >
          The 3 data-display primitives from COMPONENTS.md §5: Table (simple
          HTML table styled with tokens), DataGrid (TanStack Table v8 with
          sort + filter), ConfidenceBadge (AI routing badge). DataGrid is the
          most complex — sortable headers, global filter, dismissible chip.
        </p>
        <div className="mt-3 flex items-center gap-2 flex-wrap">
          <NwBadge variant="success" size="sm">
            <CheckIcon
              className="w-3 h-3 mr-1"
              aria-hidden="true"
              strokeWidth={1.5}
            />
            3 rendered
          </NwBadge>
          <NwBadge variant="info" size="sm">
            TanStack v8 live
          </NwBadge>
        </div>
      </header>

      <TableSection />
      <DataGridSection />
      <ConfidenceBadgeSection />
    </div>
  );
}
