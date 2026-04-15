import Link from "next/link";
import { PUBLIC_APP_NAME } from "@/lib/org/public";

export default function PublicHeader() {
  return (
    <header className="border-b border-brand-border bg-white/90 backdrop-blur-sm sticky top-0 z-40">
      <div className="max-w-[1200px] mx-auto px-6 py-3 flex items-center justify-between">
        <Link href="/" className="font-display text-lg tracking-[0.12em] uppercase text-cream">
          {PUBLIC_APP_NAME}
        </Link>
        <nav className="flex items-center gap-2">
          <Link
            href="/pricing"
            className="hidden sm:inline-block px-3 py-1.5 text-[13px] text-cream-muted hover:text-cream"
          >
            Pricing
          </Link>
          <Link
            href="/login"
            className="px-3 py-1.5 text-[13px] text-cream-muted hover:text-cream"
          >
            Sign In
          </Link>
          <Link
            href="/signup"
            className="px-4 py-2 bg-teal text-white text-[12px] tracking-[0.08em] uppercase hover:bg-teal-hover transition-colors"
          >
            Start Free Trial
          </Link>
        </nav>
      </div>
    </header>
  );
}
