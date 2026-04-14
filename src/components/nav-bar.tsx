"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase/client";

function NavLink({
 href,
 label,
 count,
 active,
 mobile,
 onClick,
}: {
 href: string;
 label: string;
 count?: number;
 active: boolean;
 mobile?: boolean;
 onClick?: () => void;
}) {
 return (
 <Link
 href={href}
 onClick={onClick}
 className={`relative flex items-center gap-1.5 text-[14px] font-medium transition-colors ${
 mobile ? "py-3 px-4 w-full" : "px-3 py-1.5"
 } ${
 active
 ? "text-white nav-underline active"
 : "text-white/70 hover:text-white nav-underline"
 }`}
 >
 {label}
 {count != null && count > 0 && (
 <span className="flex items-center justify-center min-w-[18px] h-[18px] px-1 border border-white/50 text-white text-[10px] font-bold bg-transparent">
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
 const [mobileOpen, setMobileOpen] = useState(false);
 const menuRef = useRef<HTMLDivElement>(null);

 useEffect(() => {
 async function fetchCounts() {
 const [pmRes, qaRes] = await Promise.all([
 supabase
 .from("invoices")
 .select("id", { count: "exact", head: true })
 .in("status", ["pm_review", "ai_processed"])
 .is("deleted_at", null),
 supabase
 .from("invoices")
 .select("id", { count: "exact", head: true })
 .in("status", ["qa_review", "pm_approved"])
 .is("deleted_at", null),
 ]);
 setPmCount(pmRes.count ?? 0);
 setQaCount(qaRes.count ?? 0);
 }
 fetchCounts();
 }, [pathname]);

 // Close mobile menu on route change
 useEffect(() => {
 setMobileOpen(false);
 }, [pathname]);

 // Close mobile menu on click outside
 useEffect(() => {
 if (!mobileOpen) return;

 function handleClickOutside(e: MouseEvent) {
 if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
 setMobileOpen(false);
 }
 }

 document.addEventListener("mousedown", handleClickOutside);
 return () => document.removeEventListener("mousedown", handleClickOutside);
 }, [mobileOpen]);

 const closeMobile = () => setMobileOpen(false);

 const isUploadActive = pathname === "/invoices/upload";
 const isAllInvoicesActive = pathname === "/invoices";
 const isPmActive =
 pathname === "/invoices/queue" ||
 (pathname.startsWith("/invoices/") &&
 pathname !== "/invoices" &&
 !pathname.includes("/qa") &&
 !pathname.includes("/upload") &&
 !pathname.includes("/draws"));
 const isQaActive =
 pathname === "/invoices/qa" || pathname.endsWith("/qa");
 const isDrawsActive = pathname.startsWith("/draws");
 const isVendorsActive = pathname === "/vendors";

 return (
 <header
 ref={menuRef}
 className="border-t-[3px] border-t-teal border-b border-brand-border bg-teal backdrop-blur-sm sticky top-0 z-40"
 >
 <div className="max-w-[1600px] mx-auto px-6 py-2.5 flex items-center justify-between">
 <Link href="/" className="flex items-center gap-2 group">
 <span className="font-display text-lg text-white uppercase tracking-[0.08em] font-normal group-hover:text-white/80 transition-colors">
 Ross Command Center
 </span>
 </Link>

 {/* Desktop nav */}
 <nav className="hidden md:flex items-center gap-1">
 <NavLink
 href="/invoices/upload"
 label="Upload"
 active={isUploadActive}
 />
 <NavLink
 href="/invoices"
 label="All Invoices"
 active={isAllInvoicesActive}
 />
 <NavLink
 href="/invoices/queue"
 label="PM Queue"
 count={pmCount}
 active={isPmActive}
 />
 <NavLink
 href="/invoices/qa"
 label="Accounting QA"
 count={qaCount}
 active={isQaActive}
 />
 <NavLink href="/draws" label="Draws" active={isDrawsActive} />
 <NavLink href="/vendors" label="Vendors" active={isVendorsActive} />
 </nav>

 {/* Mobile hamburger + badge */}
 <div className="flex md:hidden items-center gap-2">
 {pmCount > 0 && (
 <span className="flex items-center justify-center min-w-[18px] h-[18px] px-1 border border-white/50 text-white text-[10px] font-bold bg-transparent">
 {pmCount}
 </span>
 )}
 <button
 type="button"
 onClick={() => setMobileOpen((prev) => !prev)}
 className="p-2 text-white/70 hover:text-white nav-underline transition-colors"
 aria-label="Toggle menu"
 aria-expanded={mobileOpen}
 >
 <svg
 className="w-6 h-6"
 fill="none"
 stroke="currentColor"
 strokeWidth={2}
 viewBox="0 0 24 24"
 >
 {mobileOpen ? (
 <path
 strokeLinecap="round"
 strokeLinejoin="round"
 d="M6 18L18 6M6 6l12 12"
 />
 ) : (
 <path
 strokeLinecap="round"
 strokeLinejoin="round"
 d="M4 6h16M4 12h16M4 18h16"
 />
 )}
 </svg>
 </button>
 </div>
 </div>

 {/* Mobile dropdown panel */}
 {mobileOpen && (
 <nav className="md:hidden bg-teal border-b border-white/10 px-4 pb-3 pt-1 flex flex-col gap-1">
 <NavLink
 href="/invoices/upload"
 label="Upload"
 active={isUploadActive}
 mobile
 onClick={closeMobile}
 />
 <NavLink
 href="/invoices"
 label="All Invoices"
 active={isAllInvoicesActive}
 mobile
 onClick={closeMobile}
 />
 <NavLink
 href="/invoices/queue"
 label="PM Queue"
 count={pmCount}
 active={isPmActive}
 mobile
 onClick={closeMobile}
 />
 <NavLink
 href="/invoices/qa"
 label="Accounting QA"
 count={qaCount}
 active={isQaActive}
 mobile
 onClick={closeMobile}
 />
 <NavLink
 href="/draws"
 label="Draws"
 active={isDrawsActive}
 mobile
 onClick={closeMobile}
 />
 <NavLink
 href="/vendors"
 label="Vendors"
 active={isVendorsActive}
 mobile
 onClick={closeMobile}
 />
 </nav>
 )}
 </header>
 );
}
