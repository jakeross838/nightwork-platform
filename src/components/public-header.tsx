import Link from "next/link";
import { PUBLIC_APP_NAME } from "@/lib/org/public";

export default function PublicHeader() {
  return (
    <header className="border-b border-border-def bg-white/90 backdrop-blur-sm sticky top-0 z-40">
      <div className="max-w-[1200px] mx-auto px-6 py-3 flex items-center justify-between">
        <Link href="/" className="font-display text-lg tracking-[0.12em] uppercase text-slate-tile">
          {PUBLIC_APP_NAME}
        </Link>
        <nav className="flex items-center gap-2">
          <Link
            href="/pricing"
            className="hidden sm:inline-block px-3 py-1.5 text-[13px] text-secondary hover:text-slate-tile"
          >
            Pricing
          </Link>
          <Link
            href="/login"
            className="px-3 py-1.5 text-[13px] text-secondary hover:text-slate-tile"
          >
            Sign In
          </Link>
          <Link
            href="/signup"
            className="px-4 py-2 bg-slate-deep text-white text-[12px] tracking-[0.08em] uppercase hover:bg-slate-deeper transition-colors"
          >
            Start Free Trial
          </Link>
        </nav>
      </div>
    </header>
  );
}
