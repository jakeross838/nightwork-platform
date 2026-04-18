"use client";

import Link from "next/link";

const TABS = [
  { key: "draws", label: "Draws", slug: "/draws" },
  { key: "liens", label: "Lien Releases", slug: "/lien-releases" },
] as const;

export type DrawsSection = (typeof TABS)[number]["key"];

export default function DrawsSubTabs({
  jobId,
  active,
}: {
  jobId: string;
  active: DrawsSection;
}) {
  return (
    <div className="flex items-center gap-1 mb-5 border-b border-brand-border/50">
      {TABS.map((tab) => {
        const isActive = tab.key === active;
        return (
          <Link
            key={tab.key}
            href={`/jobs/${jobId}${tab.slug}`}
            className={`relative px-3 py-2 text-xs tracking-[0.04em] font-medium transition-colors whitespace-nowrap ${
              isActive ? "text-cream" : "text-cream-dim hover:text-cream"
            }`}
          >
            {tab.label}
            {isActive && (
              <span className="absolute bottom-0 left-0 right-0 h-[1.5px] bg-teal" />
            )}
          </Link>
        );
      })}
    </div>
  );
}
