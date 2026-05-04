// src/app/design-system/prototypes/jobs/[id]/schedule/page.tsx
//
// Schedule (Gantt) prototype — Wave 2 preview surface per Stage 1.5b
// deliverable #11 + Q2 override C.
//
// Per CONTEXT D-10: TanStack Table v8 (already installed) provides
// row/column infrastructure; this component writes ONLY the custom
// timeline cell renderer + today-marker overlay + dependency indicators.
//
// Per CONTEXT D-11: schedule_items shape is 1.5b proposed (NOT canonical
// — F1 may revise based on real complexity discovered here).
//
// Per CONTEXT D-12: uses real Drummond Schedule_*.xlsx data extracted in
// Wave 0 (CALDWELL_SCHEDULE_ITEMS, sanitized via SUBSTITUTION-MAP).
// Not reconstructed dates.
//
// Per CONTEXT D-22 / iter-1 planner C2 + design-pushback C7 hardenings:
//   - 5 useMemos declared unconditionally before the early-return at the
//     bottom of the hooks block, to comply with the Rules of Hooks. The
//     `items` array is a plain const computed from the resolved job; if
//     the job is missing, items is empty and the downstream useMemos all
//     handle the empty case (return new Date() / [] / 0).
//   - Tokens use `var(--text-tertiary)` (no hex fallback). The token is
//     always defined under .design-system-scope (Set B locked palette
//     via prototypes/layout.tsx), so the fallback adds no reliability
//     and the post-edit hex-block hook would reject any hex literal.
//
// Per acceptance criterion: 6+ month timeline + 20+ tasks + dependencies
// visible + today-marker clear. If readability fails, log as design-system
// polish requirement (does NOT halt phase per EXPANDED-SCOPE §0 schedule
// acceptance).
//
// Hook T10c — no imports from @/lib/supabase|org|auth.

"use client";

import { useCallback, useMemo } from "react";
import { notFound } from "next/navigation";
import Link from "next/link";
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  type ColumnDef,
} from "@tanstack/react-table";

import {
  CALDWELL_SCHEDULE_ITEMS,
  CALDWELL_VENDORS,
  CALDWELL_JOBS,
  type CaldwellScheduleItem,
  type CaldwellScheduleStatus,
} from "@/app/design-system/_fixtures/drummond";

import Card from "@/components/nw/Card";
import Eyebrow from "@/components/nw/Eyebrow";
import Badge, { type BadgeVariant } from "@/components/nw/Badge";

// Status → CSS var color mapping (Site Office tokens, Set B locked palette).
function statusColor(s: CaldwellScheduleStatus): string {
  switch (s) {
    case "not_started":
      return "var(--text-tertiary)";
    case "in_progress":
      return "var(--nw-stone-blue)";
    case "complete":
      return "var(--nw-success)";
    case "blocked":
      return "var(--nw-danger)";
  }
}

const STATUS_BADGE: Record<
  CaldwellScheduleStatus,
  { variant: BadgeVariant; label: string }
> = {
  not_started: { variant: "neutral", label: "NOT STARTED" },
  in_progress: { variant: "accent", label: "IN PROGRESS" },
  complete: { variant: "success", label: "COMPLETE" },
  blocked: { variant: "danger", label: "BLOCKED" },
};

export default function SchedulePrototypePage({
  params,
}: {
  params: { id: string };
}) {
  const job = CALDWELL_JOBS.find((j) => j.id === params.id);

  // Hooks declared unconditionally above any early return (Rules of Hooks).
  // `items` is empty when job is missing; downstream useMemos handle empty
  // input gracefully. Early-return below short-circuits render.
  // Wrapped in useMemo so dependent useMemos get a stable reference per
  // render (silences react-hooks/exhaustive-deps).
  const items = useMemo<CaldwellScheduleItem[]>(() => {
    return job
      ? CALDWELL_SCHEDULE_ITEMS.filter((i) => i.job_id === job.id)
      : [];
  }, [job]);

  // Compute timeline date range from rendered items.
  const projectStart = useMemo(() => {
    if (items.length === 0) return new Date();
    return new Date(
      items.reduce(
        (min, i) => (i.start_date < min ? i.start_date : min),
        items[0].start_date,
      ),
    );
  }, [items]);

  const projectEnd = useMemo(() => {
    if (items.length === 0) return new Date();
    return new Date(
      items.reduce(
        (max, i) => (i.end_date > max ? i.end_date : max),
        items[0].end_date,
      ),
    );
  }, [items]);

  const totalMs = projectEnd.getTime() - projectStart.getTime();
  const totalDays = totalMs / (1000 * 60 * 60 * 24);

  // Helper: convert ISO date to % offset within project range.
  // useCallback so it's stable across renders + so it can be a dep of the
  // columns useMemo without warnings.
  const pctOffset = useCallback(
    (isoDate: string): number => {
      if (totalMs <= 0) return 0;
      const d = new Date(isoDate);
      return ((d.getTime() - projectStart.getTime()) / totalMs) * 100;
    },
    [projectStart, totalMs],
  );

  // Today-marker offset.
  const todayPct = useMemo(() => {
    const now = new Date();
    if (now < projectStart) return 0;
    if (now > projectEnd) return 100;
    if (totalMs <= 0) return 0;
    return ((now.getTime() - projectStart.getTime()) / totalMs) * 100;
  }, [projectStart, projectEnd, totalMs]);

  // Generate month labels for timeline header axis.
  const monthLabels = useMemo(() => {
    const labels: Array<{ label: string; pct: number }> = [];
    if (totalMs <= 0) return labels;
    const cursor = new Date(
      projectStart.getFullYear(),
      projectStart.getMonth(),
      1,
    );
    while (cursor <= projectEnd) {
      const pct =
        ((cursor.getTime() - projectStart.getTime()) / totalMs) * 100;
      labels.push({
        label: cursor.toLocaleString("en-US", {
          month: "short",
          year: "2-digit",
        }),
        pct,
      });
      cursor.setMonth(cursor.getMonth() + 1);
    }
    return labels;
  }, [projectStart, projectEnd, totalMs]);

  // TanStack Table v8 column definitions.
  // Per CONTEXT D-10: TanStack provides row infrastructure; the timeline
  // column's `cell` renderer draws the bar / diamond / today-marker per
  // row. No external Gantt dep needed for this density.
  const columns = useMemo<ColumnDef<CaldwellScheduleItem>[]>(
    () => [
      {
        id: "task",
        header: "Task",
        cell: (info) => {
          const item = info.row.original;
          const vendor = item.assigned_vendor_id
            ? CALDWELL_VENDORS.find((v) => v.id === item.assigned_vendor_id)
            : null;
          const indent = item.parent_id ? "pl-4" : "pl-0";
          return (
            <div className={indent}>
              <div
                className="text-[12px] truncate"
                style={{
                  color: "var(--text-primary)",
                  fontFamily: "var(--font-space-grotesk)",
                  fontWeight: 500,
                }}
              >
                {item.is_milestone && (
                  <span
                    className="mr-1"
                    style={{ color: "var(--nw-stone-blue)" }}
                    aria-hidden="true"
                  >
                    ◆
                  </span>
                )}
                {item.name}
              </div>
              {vendor && (
                <div
                  className="text-[10px] truncate"
                  style={{
                    fontFamily: "var(--font-jetbrains-mono)",
                    color: "var(--text-tertiary)",
                  }}
                >
                  {vendor.name}
                </div>
              )}
              {item.predecessor_ids.length > 0 && (
                <div
                  className="text-[9px]"
                  style={{
                    fontFamily: "var(--font-jetbrains-mono)",
                    color: "var(--text-tertiary)",
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                  }}
                >
                  After: {item.predecessor_ids.length} dep
                  {item.predecessor_ids.length === 1 ? "" : "s"}
                </div>
              )}
            </div>
          );
        },
      },
      {
        id: "status",
        header: "Status",
        cell: (info) => {
          const s = STATUS_BADGE[info.row.original.status];
          return <Badge variant={s.variant}>{s.label}</Badge>;
        },
      },
      {
        id: "timeline",
        header: () => (
          <div className="relative h-8" style={{ minWidth: "600px" }}>
            {/* Month labels across the top axis. JetBrains Mono UPPERCASE
                10px keeps the date axis readable at compact density. */}
            {monthLabels.map((m) => (
              <div
                key={m.label}
                className="absolute top-0 text-[9px]"
                style={{
                  left: `${m.pct}%`,
                  fontFamily: "var(--font-jetbrains-mono)",
                  color: "var(--text-tertiary)",
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  transform: "translateX(0)",
                }}
              >
                {m.label}
              </div>
            ))}
          </div>
        ),
        cell: (info) => {
          const item = info.row.original;
          const left = pctOffset(item.start_date);
          const right = pctOffset(item.end_date);
          const width = Math.max(right - left, 0);

          return (
            <div className="relative h-6" style={{ minWidth: "600px" }}>
              {/* Today-marker per row (full-row vertical line). The marker
                  repeats per row rather than as a single overlay because
                  the table's row-rendering doesn't expose a body-area
                  z-overlay slot — repeating per row is the simplest way
                  to keep the marker aligned with each timeline cell. */}
              <div
                className="absolute top-0 bottom-0"
                style={{
                  left: `${todayPct}%`,
                  width: "1px",
                  background: "var(--nw-danger)",
                  opacity: 0.6,
                  pointerEvents: "none",
                }}
                aria-hidden="true"
              />

              {item.is_milestone ? (
                // Diamond marker (per CONTEXT D-11 — milestones render as
                // diamonds, not bars). Pay app dates / inspections / CO are
                // all milestones in the Caldwell fixture.
                <div
                  className="absolute top-1"
                  style={{
                    left: `${left}%`,
                    width: "16px",
                    height: "16px",
                    background: "var(--nw-stone-blue)",
                    transform: "translateX(-8px) rotate(45deg)",
                  }}
                  title={`${item.name} (milestone) — ${item.start_date}`}
                />
              ) : (
                // Bar — colored by status, partial fill by percent_complete.
                // Outer div = outline, inner div = solid fill at percent_complete.
                <div
                  className="absolute top-1 h-4"
                  style={{
                    left: `${left}%`,
                    width: `${width}%`,
                    background: "var(--bg-subtle)",
                    border: `1px solid ${statusColor(item.status)}`,
                    overflow: "hidden",
                  }}
                  title={`${item.name} — ${item.start_date} to ${item.end_date} (${(item.percent_complete * 100).toFixed(0)}%)`}
                >
                  <div
                    className="h-full"
                    style={{
                      width: `${item.percent_complete * 100}%`,
                      background: statusColor(item.status),
                      opacity: 0.7,
                    }}
                  />
                </div>
              )}
            </div>
          );
        },
      },
    ],
    [monthLabels, todayPct, pctOffset],
  );

  const table = useReactTable({
    data: items,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  // All hooks above run unconditionally per Rules of Hooks. Now safe to
  // early-return on missing job.
  if (!job) return notFound();

  return (
    <div className="px-6 py-8 max-w-[1800px] mx-auto">
      {/* Breadcrumb + header */}
      <div className="mb-6">
        <div
          className="flex items-center gap-2 text-[12px] mb-2"
          style={{ color: "var(--text-tertiary)" }}
        >
          <Link
            href="/design-system/prototypes/"
            className="hover:underline"
          >
            Prototypes
          </Link>
          <span>/</span>
          <Link
            href={`/design-system/prototypes/jobs/${job.id}`}
            className="hover:underline"
            style={{ fontFamily: "var(--font-jetbrains-mono)" }}
          >
            {job.id}
          </Link>
          <span>/</span>
          <span style={{ fontFamily: "var(--font-jetbrains-mono)" }}>
            Schedule
          </span>
        </div>
        <h1
          className="text-[24px] mb-1 nw-direction-headline"
          style={{
            fontFamily: "var(--font-space-grotesk)",
            fontWeight: 500,
            color: "var(--text-primary)",
          }}
        >
          {job.name} — Schedule
        </h1>
        <div
          className="flex items-center gap-3 text-[12px] flex-wrap"
          style={{ color: "var(--text-secondary)" }}
        >
          <span>{items.length} tasks</span>
          <span>·</span>
          <span style={{ fontFamily: "var(--font-jetbrains-mono)" }}>
            {projectStart.toISOString().slice(0, 10)} →{" "}
            {projectEnd.toISOString().slice(0, 10)}
          </span>
          <span>·</span>
          <span>
            {Math.round(totalDays)} days ({Math.round(totalDays / 30)} months)
          </span>
          <span>·</span>
          <Badge variant="neutral">WAVE 2 PREVIEW</Badge>
        </div>
      </div>

      {/* Wave 2 preview banner */}
      <Card padding="md" className="mb-4">
        <Eyebrow tone="muted" className="mb-2">
          Wave 2 preview surface
        </Eyebrow>
        <p
          className="text-[12px]"
          style={{ color: "var(--text-secondary)" }}
        >
          Per Stage 1.5b deliverable #11 + Q2 override C: Schedule (Gantt)
          is a Wave 2 preview to test whether Site Office direction&apos;s
          compact density holds at Gantt scale.{" "}
          <code style={{ fontFamily: "var(--font-jetbrains-mono)" }}>
            schedule_items
          </code>{" "}
          shape is proposed (NOT canonical — F1 may revise based on real
          complexity discovered here). NEW pattern — if 1.5b proves Gantt
          fit, PATTERNS.md gains a Timeline/Gantt entry as
          1.5a-followup.
        </p>
      </Card>

      {/* Gantt grid — TanStack Table v8 base + per-cell timeline rendering. */}
      <Card padding="none">
        <div className="overflow-x-auto">
          <table
            className="w-full text-[11px]"
            style={{
              fontFamily: "var(--font-jetbrains-mono)",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            <thead>
              {table.getHeaderGroups().map((hg) => (
                <tr
                  key={hg.id}
                  style={{ background: "var(--bg-subtle)" }}
                >
                  {hg.headers.map((h) => (
                    <th
                      key={h.id}
                      className="px-2 py-2 text-left border align-bottom"
                      style={{
                        borderColor: "var(--border-default)",
                        color: "var(--text-secondary)",
                        letterSpacing: "0.08em",
                        textTransform: "uppercase",
                        fontSize: "9px",
                      }}
                    >
                      {flexRender(
                        h.column.columnDef.header,
                        h.getContext(),
                      )}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {table.getRowModel().rows.map((row) => (
                <tr key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <td
                      key={cell.id}
                      className="px-2 py-2 border align-top"
                      style={{ borderColor: "var(--border-subtle)" }}
                    >
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext(),
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Legend */}
      <div
        className="mt-4 flex items-center gap-4 text-[10px] flex-wrap"
        style={{
          fontFamily: "var(--font-jetbrains-mono)",
          color: "var(--text-tertiary)",
          letterSpacing: "0.08em",
          textTransform: "uppercase",
        }}
      >
        <span className="flex items-center gap-1">
          <span
            className="inline-block w-3 h-2"
            style={{ background: "var(--text-tertiary)" }}
            aria-hidden="true"
          />{" "}
          Not started
        </span>
        <span className="flex items-center gap-1">
          <span
            className="inline-block w-3 h-2"
            style={{ background: "var(--nw-stone-blue)" }}
            aria-hidden="true"
          />{" "}
          In progress
        </span>
        <span className="flex items-center gap-1">
          <span
            className="inline-block w-3 h-2"
            style={{ background: "var(--nw-success)" }}
            aria-hidden="true"
          />{" "}
          Complete
        </span>
        <span className="flex items-center gap-1">
          <span
            className="inline-block w-3 h-2"
            style={{ background: "var(--nw-danger)" }}
            aria-hidden="true"
          />{" "}
          Blocked
        </span>
        <span className="flex items-center gap-1">
          <span
            style={{ color: "var(--nw-stone-blue)" }}
            aria-hidden="true"
          >
            ◆
          </span>{" "}
          Milestone
        </span>
        <span className="flex items-center gap-1">
          <span
            className="inline-block w-px h-3"
            style={{ background: "var(--nw-danger)" }}
            aria-hidden="true"
          />{" "}
          Today
        </span>
      </div>
    </div>
  );
}
