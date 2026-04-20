import Link from "next/link";

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

/**
 * Breadcrumbs — Phase 8g.
 *
 * Top-level "Home" is prepended automatically. On narrow screens the middle
 * segments collapse to a "..." item so the trail still shows where you are.
 * `print:hidden` hides the trail in printouts (the page header is enough).
 */
export default function Breadcrumbs({ items }: { items: BreadcrumbItem[] }) {
  if (!items.length) return null;
  // Always prepend Home unless caller explicitly already provided it.
  const trail: BreadcrumbItem[] =
    items[0]?.label === "Home"
      ? items
      : [{ label: "Home", href: "/dashboard" }, ...items];

  return (
    <nav aria-label="Breadcrumb" className="mb-4 print:hidden">
      {/* Mobile trail — collapse middle items if more than 3 */}
      <ol className="flex items-center gap-1.5 text-[13px] text-[color:var(--text-secondary)] sm:hidden">
        {renderCollapsed(trail).map((item, i, arr) => (
          <Crumb key={`${item.label}-${i}`} item={item} isLast={i === arr.length - 1} />
        ))}
      </ol>
      {/* Desktop trail — full path with wrapping */}
      <ol className="hidden sm:flex items-center gap-1.5 text-[13px] text-[color:var(--text-secondary)] flex-wrap">
        {trail.map((item, i) => (
          <Crumb key={`${item.label}-${i}`} item={item} isLast={i === trail.length - 1} />
        ))}
      </ol>
    </nav>
  );
}

function renderCollapsed(items: BreadcrumbItem[]): BreadcrumbItem[] {
  if (items.length <= 3) return items;
  return [items[0], { label: "…" }, items[items.length - 1]];
}

function Crumb({ item, isLast }: { item: BreadcrumbItem; isLast: boolean }) {
  return (
    <li className="flex items-center gap-1.5 min-w-0">
      {item.href && !isLast ? (
        <Link
          href={item.href}
          className="hover:text-[color:var(--nw-stone-blue)] transition-colors underline-offset-4 hover:underline truncate"
        >
          {item.label}
        </Link>
      ) : (
        <span className={`truncate ${isLast ? "text-[color:var(--text-primary)] font-medium" : "text-[color:var(--text-secondary)]"}`}>
          {item.label}
        </span>
      )}
      {!isLast && (
        <svg
          className="w-3 h-3 text-[color:var(--text-secondary)]/60 shrink-0"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      )}
    </li>
  );
}
