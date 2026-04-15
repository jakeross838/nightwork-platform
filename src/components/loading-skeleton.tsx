/**
 * Loading skeleton primitives — Phase 8g.
 *
 * Use during initial loads only (not on filter changes / tab switches —
 * those should be instant from cached data). Pulses gray on white to mimic
 * the eventual shape of the rendered content.
 */
import { ReactNode } from "react";

interface SkeletonProps {
  className?: string;
  ariaLabel?: string;
}

/** A single gray pulse rectangle. Pass Tailwind classes for size/shape. */
export function Skeleton({ className = "", ariaLabel }: SkeletonProps) {
  return (
    <div
      role={ariaLabel ? "status" : undefined}
      aria-label={ariaLabel}
      className={`bg-[#E5E7EB] animate-pulse ${className}`}
    />
  );
}

/** Stat-card skeleton matching the dashboard top-row card dimensions. */
export function SkeletonStatCard() {
  return (
    <div className="flex flex-col items-start p-4 border border-brand-border bg-white">
      <Skeleton className="h-3 w-20" />
      <Skeleton className="mt-3 h-7 w-16" />
    </div>
  );
}

/** Table-row skeleton with N column widths. */
export function SkeletonTableRow({ columns }: { columns: string[] }) {
  return (
    <div className="grid items-center gap-4 px-4 py-3 border-b border-brand-border" style={{ gridTemplateColumns: columns.map(() => "1fr").join(" ") }}>
      {columns.map((width, i) => (
        <Skeleton key={i} className={`h-4 ${width}`} />
      ))}
    </div>
  );
}

/** N skeleton rows in a list — for invoice list, vendor list, etc. */
export function SkeletonList({ rows = 5, columns }: { rows?: number; columns: string[] }) {
  return (
    <div className="border border-brand-border bg-white" aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }).map((_, i) => (
        <SkeletonTableRow key={i} columns={columns} />
      ))}
    </div>
  );
}

/** Card skeleton (taller, for job cards or content blocks). */
export function SkeletonCard({ height = "h-32" }: { height?: string }) {
  return (
    <div className={`p-5 border border-brand-border bg-white ${height}`}>
      <Skeleton className="h-4 w-2/3" />
      <Skeleton className="mt-3 h-3 w-1/2" />
      <Skeleton className="mt-6 h-3 w-3/4" />
    </div>
  );
}

/** Generic block skeleton wrapper. */
export function SkeletonBlock({ children, height = "h-48" }: { children?: ReactNode; height?: string }) {
  return (
    <div className={`p-4 border border-brand-border bg-white ${height}`} aria-busy="true">
      {children ?? (
        <>
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="mt-4 h-3 w-full" />
          <Skeleton className="mt-2 h-3 w-5/6" />
          <Skeleton className="mt-2 h-3 w-4/6" />
        </>
      )}
    </div>
  );
}
