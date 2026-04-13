"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";

function NavLink({ href, label, count, active }: { href: string; label: string; count?: number; active: boolean }) {
  return (
    <Link href={href}
      className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
        active ? "bg-brand-elevated text-cream" : "text-cream-dim hover:text-cream hover:bg-brand-surface"
      }`}>
      {label}
      {count != null && count > 0 && (
        <span className="flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-brass text-brand-bg text-[10px] font-bold">
          {count}
        </span>
      )}
    </Link>
  );
}

export default function NavBar() {
  const pathname = usePathname();
  const [pmCount, setPmCount] = useState(0);
  const [qaCount, setQaCount] = useState(0);

  useEffect(() => {
    async function fetchCounts() {
      const [pmRes, qaRes] = await Promise.all([
        supabase.from("invoices").select("id", { count: "exact", head: true }).in("status", ["pm_review", "ai_processed"]).is("deleted_at", null),
        supabase.from("invoices").select("id", { count: "exact", head: true }).in("status", ["qa_review", "pm_approved"]).is("deleted_at", null),
      ]);
      setPmCount(pmRes.count ?? 0);
      setQaCount(qaRes.count ?? 0);
    }
    fetchCounts();
  }, [pathname]); // refetch when navigating

  return (
    <header className="border-b border-brand-border bg-brand-bg/80 backdrop-blur-sm sticky top-0 z-40">
      <div className="max-w-[1600px] mx-auto px-6 py-3 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 group">
          <span className="font-display text-lg text-cream group-hover:text-teal transition-colors">Ross Command Center</span>
        </Link>
        <nav className="flex items-center gap-1">
          <NavLink href="/invoices/upload" label="Upload" active={pathname === "/invoices/upload"} />
          <NavLink href="/invoices/queue" label="PM Queue" count={pmCount} active={pathname === "/invoices/queue" || (pathname.startsWith("/invoices/") && !pathname.includes("/qa") && !pathname.includes("/upload") && pathname !== "/invoices/queue")} />
          <NavLink href="/invoices/qa" label="Accounting QA" count={qaCount} active={pathname === "/invoices/qa" || pathname.includes("/qa")} />
        </nav>
      </div>
    </header>
  );
}
