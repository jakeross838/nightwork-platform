"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import AppShell from "@/components/app-shell";
import FinancialViewTabs from "@/components/financial-view-tabs";
import EmptyState, { EmptyIcons } from "@/components/empty-state";
import { SkeletonList } from "@/components/loading-skeleton";
import { formatDate, formatStatus } from "@/lib/utils/format";
import NwBadge, { type BadgeVariant } from "@/components/nw/Badge";
import NwMoney from "@/components/nw/Money";

function drawBadgeVariant(status: string): BadgeVariant {
 if (status === "submitted" || status === "pm_review") return "warning";
 if (status === "paid" || status === "approved") return "success";
 if (status === "void") return "danger";
 if (status === "draft") return "neutral";
 return "neutral";
}

interface Draw {
 id: string;
 draw_number: number;
 revision_number: number;
 application_date: string | null;
 period_start: string | null;
 period_end: string | null;
 status: string;
 current_payment_due: number;
 jobs: { id: string; name: string; address: string | null } | null;
}

export default function DrawsPage() {
 const [draws, setDraws] = useState<Draw[]>([]);
 const [loading, setLoading] = useState(true);

 useEffect(() => {
 async function fetchDraws() {
 const res = await fetch("/api/draws");
 if (res.ok) {
 const data = await res.json();
 setDraws(data);
 }
 setLoading(false);
 }
 fetchDraws();
 }, []);

 // Group by job
 const grouped = draws.reduce<Record<string, { job: Draw["jobs"]; draws: Draw[] }>>((acc, d) => {
 const key = d.jobs?.id ?? "unknown";
 if (!acc[key]) acc[key] = { job: d.jobs, draws: [] };
 acc[key].draws.push(d);
 return acc;
 }, {});

 return (
 <AppShell>
 <main className="max-w-[1600px] mx-auto px-6 py-8">
 <FinancialViewTabs active="draws" />
 <div className="flex items-end justify-between mb-6 flex-wrap gap-4">
 <div>
 <span
 className="block mb-2 text-[10px] uppercase"
 style={{
 fontFamily: "var(--font-jetbrains-mono)",
 letterSpacing: "0.14em",
 color: "var(--text-tertiary)",
 }}
 >
 Financial · Draws
 </span>
 <h2
 className="m-0"
 style={{
 fontFamily: "var(--font-space-grotesk)",
 fontWeight: 500,
 fontSize: "30px",
 letterSpacing: "-0.02em",
 color: "var(--text-primary)",
 }}
 >
 Draws
 </h2>
 <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
 AIA G702/G703 pay applications
 </p>
 </div>
 <Link href="/draws/new"
 className="inline-flex items-center justify-center h-9 px-4 text-[11px] uppercase font-medium border transition-colors"
 style={{
 fontFamily: "var(--font-jetbrains-mono)",
 letterSpacing: "0.12em",
 background: "var(--nw-stone-blue)",
 borderColor: "var(--nw-stone-blue)",
 color: "var(--nw-white-sand)",
 }}
 >
 Create New Draw
 </Link>
 </div>

 {loading ? (
 <SkeletonList rows={5} columns={["w-16", "w-32", "w-32", "w-24", "w-32"]} />
 ) : draws.length === 0 ? (
 <EmptyState
 icon={<EmptyIcons.Document />}
 title="No draws created for this job yet"
 message="Create your first draw to generate an AIA G702/G703 pay application from approved invoices."
 primaryAction={{ label: "+ Create Draw", href: "/draws/new" }}
 />
 ) : (
 <div className="space-y-8 animate-fade-up">
 {Object.entries(grouped).map(([, { job, draws: jobDraws }]) => (
 <div key={job?.id ?? "unknown"}>
 <div className="flex items-center gap-3 mb-3">
 <NwBadge variant="info" size="md">
 {job?.name ?? "Unknown Job"}
 </NwBadge>
 <span className="text-xs text-cream-dim">{job?.address}</span>
 </div>
 <div className="overflow-x-auto border border-brand-border">
 <table className="w-full text-sm">
 <thead>
 <tr className="bg-brand-surface text-left">
 <th className="py-3 px-5 text-[10px] uppercase font-medium tracking-[0.14em] text-cream-dim">Draw #</th>
 <th className="py-3 px-5 text-[10px] uppercase font-medium tracking-[0.14em] text-cream-dim">Period</th>
 <th className="py-3 px-5 text-[10px] uppercase font-medium tracking-[0.14em] text-cream-dim">Application Date</th>
 <th className="py-3 px-5 text-[10px] uppercase font-medium tracking-[0.14em] text-cream-dim">Status</th>
 <th className="py-3 px-5 text-[10px] uppercase font-medium tracking-[0.14em] text-cream-dim text-right">Current Payment Due</th>
 </tr>
 </thead>
 <tbody>
 {jobDraws.map((d) => (
 <tr key={d.id}
 className="border-t border-brand-row-border hover:bg-brand-elevated/50 cursor-pointer transition-colors"
 onClick={() => window.location.href = `/draws/${d.id}`}>
 <td className="py-4 px-5 text-cream font-display font-medium">
 #{d.draw_number}
 {d.revision_number > 0 && <span className="text-brass ml-1 text-xs">Rev {d.revision_number}</span>}
 </td>
 <td className="py-4 px-5 text-cream-muted">{formatDate(d.period_start)} — {formatDate(d.period_end)}</td>
 <td className="py-4 px-5 text-cream-muted">{formatDate(d.application_date)}</td>
 <td className="py-4 px-5">
 <NwBadge variant={drawBadgeVariant(d.status)} size="sm">
 {formatStatus(d.status)}
 </NwBadge>
 </td>
 <td className="py-4 px-5 text-right">
 <NwMoney cents={d.current_payment_due} />
 </td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 </div>
 ))}
 </div>
 )}
 </main>
 </AppShell>
 );
}
