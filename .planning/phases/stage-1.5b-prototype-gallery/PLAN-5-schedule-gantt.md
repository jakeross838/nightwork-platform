---
phase: stage-1.5b-prototype-gallery
plan: 5
type: execute
wave: 1
depends_on: [1]
files_modified:
  - src/app/design-system/prototypes/jobs/[id]/schedule/page.tsx
autonomous: true
threat_model_severity: low
requirements: []
must_haves:
  truths:
    - "User can view Drummond schedule (Gantt) at /design-system/prototypes/jobs/j-caldwell-1/schedule"
    - "Gantt renders timeline with >=20 tasks visible"
    - "Total date span >=6 months (max(end_date) - min(start_date) over all rendered items)"
    - "Dependencies (predecessor_ids) visible — connector lines OR start-after offsets clear in render"
    - "Today-marker (vertical line at current date) clear in timeline"
    - "Milestones (is_milestone: true) render as DIAMONDS, not bars (per CONTEXT D-11 — pay app dates are milestones)"
    - "Bar colors encode status (not_started / in_progress / complete / blocked) consistently with Site Office tokens"
    - "TanStack Table v8 base with custom timeline cell renderer (per D-10 — NOT custom CSS grid)"
    - "Site Office direction inherited (UPPERCASE 0.18em eyebrows, JetBrains Mono for date labels, compact density)"
    - "Hook T10c silent (no @/lib/supabase|org|auth imports)"
    - "Schedule readability finding logged: does Site Office direction's compact density hold up at Gantt scale? (acceptance criterion — does NOT halt phase)"
  artifacts:
    - path: "src/app/design-system/prototypes/jobs/[id]/schedule/page.tsx"
      provides: "Schedule (Gantt) prototype — TanStack Table v8 + custom timeline cell renderers"
      contains: "DRUMMOND_SCHEDULE_ITEMS"
  key_links:
    - from: "prototypes/jobs/[id]/schedule/page.tsx"
      to: "DRUMMOND_SCHEDULE_ITEMS + DRUMMOND_VENDORS + DRUMMOND_JOBS"
      via: "named imports + per-row timeline rendering"
      pattern: "DRUMMOND_SCHEDULE_ITEMS"
    - from: "prototypes/jobs/[id]/schedule/page.tsx"
      to: "@tanstack/react-table v8 (already shipped per package.json)"
      via: "useReactTable + ColumnDef with custom cell renderer for timeline column"
      pattern: "useReactTable"
---

<objective>
Render the Schedule (Gantt) prototype — Wave 2 preview surface. Per CONTEXT D-10/D-11/D-12, this is the highest-risk implementation in Stage 1.5b: NEW pattern not in 1.5a PATTERNS.md catalogue, NEW entity type (`schedule_items` per D-11 proposed shape), NEW rendering approach (TanStack Table v8 + custom timeline cell renderers).

Purpose:
- Tests whether Site Office direction's compact density + UPPERCASE eyebrows + JetBrains Mono dominance works at Gantt timeline density.
- If the prototype validates Gantt fit, PATTERNS.md gains a Timeline/Gantt entry as 1.5a-followup.
- If readability fails, log as design-system polish requirement — does NOT halt phase (per EXPANDED-SCOPE §0 schedule prototype acceptance).

Output:
- Schedule (Gantt) prototype at `/design-system/prototypes/jobs/{id}/schedule`
</objective>

<execution_context>
@C:/Users/Jake/nightwork-platform/.claude/get-shit-done/workflows/execute-plan.md
@C:/Users/Jake/nightwork-platform/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/ROADMAP.md
@.planning/phases/stage-1.5b-prototype-gallery/CONTEXT.md
@.planning/phases/stage-1.5b-prototype-gallery/PATTERNS.md
@.planning/expansions/stage-1.5b-prototype-gallery-EXPANDED-SCOPE.md
@.planning/phases/stage-1.5b-prototype-gallery/stage-1.5b-prototype-gallery-1-SUMMARY.md
@CLAUDE.md
@.planning/design/SYSTEM.md
@.planning/design/COMPONENTS.md
@.planning/design/PATTERNS.md
@.planning/design/CHOSEN-DIRECTION.md
@.planning/codebase/STACK.md
@src/app/design-system/_fixtures/drummond/index.ts
@src/app/design-system/_fixtures/drummond/types.ts
@src/app/design-system/_fixtures/drummond/schedule.ts
@src/app/design-system/components/data-display/page.tsx
@src/app/design-system/prototypes/layout.tsx
@src/components/nw/Card.tsx
@src/components/nw/Eyebrow.tsx
@src/components/nw/Badge.tsx

<interfaces>
<!-- DrummondScheduleItem from Wave 0 (per CONTEXT D-11; 1.5b proposed, F1 may revise):

  type DrummondScheduleStatus = "not_started" | "in_progress" | "complete" | "blocked";

  type DrummondScheduleItem = {
    id: string;
    job_id: string;
    name: string;
    start_date: string;            // ISO date
    end_date: string;              // ISO date
    predecessor_ids: string[];     // dependencies
    parent_id?: string;            // hierarchical tasks
    assigned_vendor_id?: string;
    percent_complete: number;      // 0-1
    status: DrummondScheduleStatus;
    is_milestone: boolean;         // pay app dates render as DIAMONDS, not bars
  };

  export const DRUMMOND_SCHEDULE_ITEMS: DrummondScheduleItem[];
-->

<!-- TanStack Table v8 (already shipped — package.json: @tanstack/react-table@^8.21.3).
     Existing usage analog: src/app/design-system/components/data-display/page.tsx:367-660.
     Per CONTEXT D-10 — TanStack provides row/column infrastructure; we write the
     custom cell renderer that draws bars/diamonds across the timeline column. -->

  import { useReactTable, getCoreRowModel, flexRender, type ColumnDef } from "@tanstack/react-table";

<!-- Status → bar color mapping (Site Office tokens):
     not_started → var(--nw-warm-gray) — neutral / pre-start
     in_progress → var(--nw-stone-blue) — active
     complete    → var(--nw-success) — done
     blocked     → var(--nw-danger) — needs attention
     milestone diamond stroke → var(--nw-stone-blue) — emphasized -->

<!-- Fallback per CONTEXT deferred ideas: if TanStack + custom timeline cells
     prove insufficient during execute, fall back to lightweight Gantt library
     (frappe-gantt or similar small well-maintained dep). Decision deferred to
     execute-phase based on first-attempt complexity. -->
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Schedule (Gantt) prototype with TanStack Table v8 + custom timeline cell renderer</name>
  <files>src/app/design-system/prototypes/jobs/[id]/schedule/page.tsx</files>

  <read_first>
    - src/app/design-system/components/data-display/page.tsx (lines 367-660 DataGridSection — TanStack Table v8 base; ColumnDef pattern; useReactTable setup)
    - src/app/design-system/_fixtures/drummond/schedule.ts (DRUMMOND_SCHEDULE_ITEMS — >=20 items, dates spanning 6+ months, >=2 milestones)
    - src/app/design-system/_fixtures/drummond/types.ts (DrummondScheduleItem + DrummondScheduleStatus contracts)
    - src/app/design-system/_fixtures/drummond/vendors.ts (resolve assigned_vendor_id for tooltip/hover)
    - src/app/design-system/_fixtures/drummond/jobs.ts (resolve job_id)
    - .planning/design/SYSTEM.md (Site Office direction tokens — compact density, JetBrains Mono, 0.18em eyebrows)
    - .planning/design/COMPONENTS.md (DataGrid component contract — establishes density expectations the Gantt must honor)
    - CLAUDE.md "Pillar 3 schedule intelligence" reference (Wave 4 future) — informs eventual schedule_items canonical schema, but 1.5b uses D-11 proposed shape
    - src/components/nw/Card.tsx, Eyebrow.tsx, Badge.tsx
  </read_first>

  <action>
**Create `src/app/design-system/prototypes/jobs/[id]/schedule/page.tsx`:**

Implementation strategy per CONTEXT D-10:
1. **TanStack Table v8 provides:** the row/column virtualization, sorting, and column sizing infrastructure.
2. **Custom timeline cell renderer adds:** bar/diamond rendering per row, dependency indicators, today-marker overlay.
3. **Layout:** 2-column table:
   - Column 1: task hierarchy (name + parent_id indent, vendor name secondary line, dependencies note)
   - Column 2: timeline column with custom cell renderer
4. **Timeline header:** date axis showing months across the top of the timeline column.
5. **Today-marker:** absolute-positioned vertical line at the current date offset (red or stone-blue per Site Office).
6. **Per CONTEXT D-12:** uses real Drummond `Schedule_*.xlsx` data extracted in Wave 0 — NOT reconstructed dates.

```typescript
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
// Wave 0 (DRUMMOND_SCHEDULE_ITEMS). Not reconstructed dates.
//
// Per acceptance criterion: 6+ month timeline + 20+ tasks + dependencies
// visible + today-marker clear. If readability fails, log as design-system
// polish requirement (does NOT halt phase per EXPANDED-SCOPE §0 schedule
// acceptance).
//
// Fallback (per CONTEXT deferred ideas): if TanStack + custom timeline
// cells prove insufficient during execute, swap to lightweight Gantt
// library (frappe-gantt or similar). Decision is the executor's during
// implementation based on first-attempt complexity.
//
// Hook T10c — no imports from @/lib/supabase|org|auth.

"use client";

import { useMemo } from "react";
import { notFound } from "next/navigation";
import Link from "next/link";
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  type ColumnDef,
} from "@tanstack/react-table";

import {
  DRUMMOND_SCHEDULE_ITEMS,
  DRUMMOND_VENDORS,
  DRUMMOND_JOBS,
  type DrummondScheduleItem,
  type DrummondScheduleStatus,
} from "@/app/design-system/_fixtures/drummond";

import Card from "@/components/nw/Card";
import Eyebrow from "@/components/nw/Eyebrow";
import Badge from "@/components/nw/Badge";

// Status → CSS var color mapping (Site Office tokens).
function statusColor(s: DrummondScheduleStatus): string {
  switch (s) {
    case "not_started": return "var(--nw-warm-gray)";
    case "in_progress": return "var(--nw-stone-blue)";
    case "complete":    return "var(--nw-success)";
    case "blocked":     return "var(--nw-danger)";
  }
}

const STATUS_BADGE: Record<DrummondScheduleStatus, { variant: "neutral" | "accent" | "success" | "warn" | "danger" | "info"; label: string }> = {
  not_started: { variant: "neutral", label: "NOT STARTED" },
  in_progress: { variant: "accent", label: "IN PROGRESS" },
  complete:    { variant: "success", label: "COMPLETE" },
  blocked:     { variant: "danger", label: "BLOCKED" },
};

export default function SchedulePrototypePage({ params }: { params: { id: string } }) {
  const job = DRUMMOND_JOBS.find((j) => j.id === params.id);
  if (!job) return notFound();

  const items = DRUMMOND_SCHEDULE_ITEMS.filter((i) => i.job_id === job.id);

  // Compute timeline date range from rendered items.
  const projectStart = useMemo(() => {
    if (items.length === 0) return new Date();
    return new Date(items.reduce((min, i) => i.start_date < min ? i.start_date : min, items[0].start_date));
  }, [items]);

  const projectEnd = useMemo(() => {
    if (items.length === 0) return new Date();
    return new Date(items.reduce((max, i) => i.end_date > max ? i.end_date : max, items[0].end_date));
  }, [items]);

  const totalMs = projectEnd.getTime() - projectStart.getTime();
  const totalDays = totalMs / (1000 * 60 * 60 * 24);

  // Helper: convert ISO date to % offset within project range.
  function pctOffset(isoDate: string): number {
    const d = new Date(isoDate);
    return ((d.getTime() - projectStart.getTime()) / totalMs) * 100;
  }

  // Today-marker offset.
  const todayPct = useMemo(() => {
    const now = new Date();
    if (now < projectStart) return 0;
    if (now > projectEnd) return 100;
    return pctOffset(now.toISOString().slice(0, 10));
  }, [projectStart, projectEnd]);

  // Generate month labels for timeline header axis.
  const monthLabels = useMemo(() => {
    const labels: Array<{ label: string; pct: number }> = [];
    const cursor = new Date(projectStart.getFullYear(), projectStart.getMonth(), 1);
    while (cursor <= projectEnd) {
      const pct = ((cursor.getTime() - projectStart.getTime()) / totalMs) * 100;
      labels.push({
        label: cursor.toLocaleString("en-US", { month: "short", year: "2-digit" }),
        pct,
      });
      cursor.setMonth(cursor.getMonth() + 1);
    }
    return labels;
  }, [projectStart, projectEnd, totalMs]);

  // TanStack Table v8 column definitions.
  const columns = useMemo<ColumnDef<DrummondScheduleItem>[]>(() => [
    {
      id: "task",
      header: "Task",
      cell: (info) => {
        const item = info.row.original;
        const vendor = item.assigned_vendor_id ? DRUMMOND_VENDORS.find((v) => v.id === item.assigned_vendor_id) : null;
        const indent = item.parent_id ? "pl-4" : "pl-0";
        return (
          <div className={`${indent}`}>
            <div className="text-[12px] truncate" style={{ color: "var(--text-primary)", fontFamily: "var(--font-space-grotesk)", fontWeight: 500 }}>
              {item.is_milestone && <span className="mr-1" style={{ color: "var(--nw-stone-blue)" }}>◆</span>}
              {item.name}
            </div>
            {vendor && (
              <div className="text-[10px] truncate" style={{ fontFamily: "var(--font-jetbrains-mono)", color: "var(--text-tertiary)" }}>
                {vendor.name}
              </div>
            )}
            {item.predecessor_ids.length > 0 && (
              <div className="text-[9px]" style={{ fontFamily: "var(--font-jetbrains-mono)", color: "var(--text-tertiary)", letterSpacing: "0.06em", textTransform: "uppercase" }}>
                After: {item.predecessor_ids.length} dep{item.predecessor_ids.length === 1 ? "" : "s"}
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
          {/* Month labels across top */}
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
        const width = right - left;

        return (
          <div className="relative h-6" style={{ minWidth: "600px" }}>
            {/* Today-marker per row (full-row vertical line) */}
            <div
              className="absolute top-0 bottom-0"
              style={{
                left: `${todayPct}%`,
                width: "1px",
                background: "var(--nw-danger)",
                opacity: 0.6,
                pointerEvents: "none",
              }}
            />

            {item.is_milestone ? (
              // Diamond marker (per CONTEXT D-11 — milestones render as diamonds, not bars)
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
              // Bar — colored by status, partial fill by percent_complete
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
  ], [monthLabels, todayPct, projectStart, totalMs]);

  const table = useReactTable({
    data: items,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <div className="px-6 py-8 max-w-[1800px] mx-auto">
      {/* Header band */}
      <div className="mb-6">
        <div className="flex items-center gap-2 text-[12px] mb-2" style={{ color: "var(--text-tertiary)" }}>
          <Link href="/design-system/prototypes/" className="hover:underline">Prototypes</Link>
          <span>/</span>
          <Link href={`/design-system/prototypes/jobs/${job.id}`} className="hover:underline" style={{ fontFamily: "var(--font-jetbrains-mono)" }}>
            {job.id}
          </Link>
          <span>/</span>
          <span style={{ fontFamily: "var(--font-jetbrains-mono)" }}>Schedule</span>
        </div>
        <h1 className="text-[24px] mb-1" style={{ fontFamily: "var(--font-space-grotesk)", fontWeight: 500, color: "var(--text-primary)" }}>
          {job.name} — Schedule
        </h1>
        <div className="flex items-center gap-3 text-[12px]" style={{ color: "var(--text-secondary)" }}>
          <span>{items.length} tasks</span>
          <span>·</span>
          <span>{projectStart.toISOString().slice(0, 10)} → {projectEnd.toISOString().slice(0, 10)}</span>
          <span>·</span>
          <span>{Math.round(totalDays)} days ({Math.round(totalDays / 30)} months)</span>
          <span>·</span>
          <Badge variant="neutral">WAVE 2 PREVIEW</Badge>
        </div>
      </div>

      {/* Wave 2 preview banner */}
      <Card padding="md" className="mb-4">
        <Eyebrow tone="muted" className="mb-2">Wave 2 preview surface</Eyebrow>
        <p className="text-[12px]" style={{ color: "var(--text-secondary)" }}>
          Per Stage 1.5b deliverable #11 + Q2 override C: Schedule (Gantt) is a Wave 2 preview to test whether
          Site Office direction's compact density holds at Gantt scale. <code>schedule_items</code> shape is
          proposed (NOT canonical — F1 may revise based on real complexity discovered here). NEW pattern —
          if 1.5b proves Gantt fit, PATTERNS.md gains a Timeline/Gantt entry as 1.5a-followup.
        </p>
      </Card>

      {/* Gantt grid */}
      <Card padding="none">
        <div className="overflow-x-auto">
          <table className="w-full text-[11px]" style={{ fontFamily: "var(--font-jetbrains-mono)", fontVariantNumeric: "tabular-nums" }}>
            <thead>
              {table.getHeaderGroups().map((hg) => (
                <tr key={hg.id} style={{ background: "var(--bg-subtle)" }}>
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
                      {flexRender(h.column.columnDef.header, h.getContext())}
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
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Legend */}
      <div className="mt-4 flex items-center gap-4 text-[10px] flex-wrap" style={{ fontFamily: "var(--font-jetbrains-mono)", color: "var(--text-tertiary)", letterSpacing: "0.08em", textTransform: "uppercase" }}>
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-2" style={{ background: "var(--nw-warm-gray)" }} /> Not started
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-2" style={{ background: "var(--nw-stone-blue)" }} /> In progress
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-2" style={{ background: "var(--nw-success)" }} /> Complete
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-2" style={{ background: "var(--nw-danger)" }} /> Blocked
        </span>
        <span className="flex items-center gap-1">
          <span style={{ color: "var(--nw-stone-blue)" }}>◆</span> Milestone
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-px h-3" style={{ background: "var(--nw-danger)" }} /> Today
        </span>
      </div>
    </div>
  );
}
```

**Per CONTEXT acceptance criterion (per Q2 override C):** "Site Office Gantt renders >=6-month timeline + >=20 tasks + dependencies visible + today-marker clear. If readability fails, finding logged as design-system polish requirement (does not halt phase)."

**Fallback path (per CONTEXT deferred ideas):** if TanStack Table v8 + custom cell renderer prove insufficient during execute (e.g., column resizing breaks the percentage-offset math, or the timeline column doesn't scroll-sync with task rows), the executor MAY switch to a lightweight Gantt library (frappe-gantt or similar). This is a tactical sub-decision per CONTEXT "Claude's Discretion" — the executor decides during execute, not at planning time. Document the fallback as a 1.5b finding if invoked.

**Reasoning for TanStack-base approach (per D-10):**
- TanStack Table is already installed (`@^8.21.3` per package.json:27).
- Custom CSS grid Gantt was Jake's known time-sink concern (per nwrp29 directive 1).
- TanStack provides infrastructure (rows, sorting, sizing); we write only bar-rendering logic.
- If insufficient during execute, frappe-gantt (~10KB) is a small well-maintained dep alternative.
  </action>

  <verify>
    <automated>npm run build && grep -c "useReactTable\|DRUMMOND_SCHEDULE_ITEMS\|is_milestone" src/app/design-system/prototypes/jobs/[id]/schedule/page.tsx</automated>
    Expected: build exits 0; grep returns >=3.

    Hex check (no hardcoded hex outside intentional CSS var refs): `grep -nE '#[0-9a-fA-F]{3,6}' src/app/design-system/prototypes/jobs/[id]/schedule/page.tsx` returns 0 matches.

    T10c check: `grep -E '@/lib/(supabase|org|auth)' src/app/design-system/prototypes/jobs/[id]/schedule/page.tsx` returns 0 matches.

    Manual visual checks (Chrome MCP):
    - Visit `/design-system/prototypes/jobs/j-caldwell-1/schedule`. Page renders.
    - Header shows total task count (>=20), date range (>=6 months), task count.
    - Gantt grid: each row shows task name LEFT (column 1), status badge (column 2), timeline bar/diamond (column 3).
    - Bars vary in length proportional to (end_date - start_date).
    - Bars colored by status: gray=not_started, blue=in_progress, green=complete, red=blocked.
    - Bars partially filled per percent_complete (gradient or solid fill).
    - Milestones (is_milestone=true) render as diamonds (◆) at start_date offset, NOT as bars.
    - Today-marker: vertical red line visible across the timeline column at today's date offset.
    - Month labels appear across the timeline header (Jan 25, Feb 25, ...).
    - Dependencies indicated in task name column ("After: N deps").
    - At desktop width (1280px+), timeline fills horizontally. At tablet (768px), horizontal scroll engages.
  </verify>

  <done>
    - Schedule (Gantt) prototype renders 20+ tasks with bars + milestones + today-marker
    - 6+ month timeline visible across month-labeled axis
    - Bar colors encode status correctly per Site Office tokens
    - Milestones diamond-shaped (per D-11)
    - Predecessor count displayed per task
    - TanStack Table v8 base used (not custom CSS grid per D-10)
    - Site Office direction inherited
    - npm run build passes
    - Readability finding documented in summary (does NOT halt phase)
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Prototype routes (`/design-system/prototypes/*`) → tenant code | Hook T10c rejects imports |
| Prototype routes → middleware platform_admin gate | Inherited from `/design-system/*` matcher |
| `schedule_items` proposed shape (D-11) | NOT canonical; F1 may revise — finding logged if real complexity diverges |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-1.5b-W1-11 | T (Tampering) | Date math could mis-position bars if start/end_date format inconsistent | mitigate | All dates ISO YYYY-MM-DD format from extractor (Wave 0); component parses with `new Date(iso)`. If a malformed date appears, NaN propagates and bar renders at NaN% (visually broken, easy to spot). Wave 0 Task 2 acceptance verifies date format. |
| T-1.5b-W1-12 | E (Elevation of privilege) | Prototype imports tenant module | mitigate (existing) | Hook T10c rejects @/lib/(supabase|org|auth) imports. |
| T-1.5b-W1-13 | I (Information disclosure) | Schedule fixture leaks real Drummond names | mitigate (existing) | Wave 0 grep gates (extractor + CI) prevent real-data leaks. |
</threat_model>

<verification>
- npm run build passes
- Hook T10c silent
- No hardcoded hex
- Date math correct (verify by spot-checking a known item: bar `left%` proportional to `(start_date - projectStart) / totalMs`)
- Site Office direction visually applied at Gantt density (compact rows, JetBrains Mono date labels, UPPERCASE eyebrows)
- Readability finding documented in summary regardless of pass/fail
</verification>

<success_criteria>
- Schedule (Gantt) renders Drummond schedule fixture (>=20 tasks, >=6 months, >=2 milestones)
- TanStack Table v8 base used per D-10
- Status-coded bars + diamond milestones + today-marker visible
- Site Office direction inherited correctly
- Acceptance criterion satisfied: readability finding logged (pass or fail) — phase does NOT halt on Gantt readability per EXPANDED-SCOPE §0
</success_criteria>

<output>
After completion, create `.planning/phases/stage-1.5b-prototype-gallery/stage-1.5b-prototype-gallery-5-SUMMARY.md` covering:
- Final task count rendered + actual date span (months)
- Whether TanStack-base approach worked or fallback (frappe-gantt) was invoked
- Site Office Gantt readability finding (specific observations: did compact density work? UPPERCASE month labels readable?)
- D-11 schedule_items shape findings — did real Drummond data fit the proposed shape?
- 1.5a-followup recommendation: should PATTERNS.md gain a Timeline/Gantt entry?
- Critical findings (if any) — note these do NOT halt phase per EXPANDED-SCOPE §0 schedule acceptance
</output>
