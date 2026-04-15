import Link from "next/link";
import { PUBLIC_APP_NAME } from "@/lib/org/public";

export default function PublicFooter() {
  return (
    <footer className="mt-auto px-6 py-10 border-t border-brand-border bg-white">
      <div className="max-w-[1200px] mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
        <div>
          <p className="font-display text-sm tracking-[0.12em] uppercase text-cream">
            {PUBLIC_APP_NAME}
          </p>
          <p className="mt-1 text-xs text-cream-dim">
            Construction management, powered by AI.
          </p>
        </div>
        <nav className="flex items-center gap-4 text-[13px] text-cream-muted">
          <Link href="/pricing" className="hover:text-cream">Pricing</Link>
          <Link href="/login" className="hover:text-cream">Sign In</Link>
          <Link href="/signup" className="hover:text-cream">Start Free Trial</Link>
        </nav>
        <p className="text-[11px] text-cream-dim">
          © {new Date().getFullYear()} {PUBLIC_APP_NAME}
        </p>
      </div>
    </footer>
  );
}
