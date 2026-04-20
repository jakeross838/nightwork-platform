import Link from "next/link";
import { PUBLIC_APP_NAME } from "@/lib/org/public";

export default function PublicHeader() {
  return (
    <header
      className="border-b backdrop-blur-sm sticky top-0 z-40"
      style={{
        background: "var(--bg-card)",
        borderColor: "var(--border-default)",
      }}
    >
      <div className="max-w-[1200px] mx-auto px-6 py-3 flex items-center justify-between">
        <Link
          href="/"
          className="text-lg uppercase"
          style={{
            fontFamily: "var(--font-space-grotesk)",
            letterSpacing: "0.12em",
            color: "var(--text-primary)",
          }}
        >
          {PUBLIC_APP_NAME}
        </Link>
        <nav className="flex items-center gap-2">
          <Link
            href="/pricing"
            className="hidden sm:inline-block px-3 py-1.5 text-[13px]"
            style={{ color: "var(--text-secondary)" }}
          >
            Pricing
          </Link>
          <Link
            href="/login"
            className="px-3 py-1.5 text-[13px]"
            style={{ color: "var(--text-secondary)" }}
          >
            Sign In
          </Link>
          <Link
            href="/signup"
            className="h-[36px] inline-flex items-center px-4 text-[11px] uppercase transition-colors"
            style={{
              fontFamily: "var(--font-jetbrains-mono)",
              letterSpacing: "0.12em",
              fontWeight: 500,
              background: "var(--nw-stone-blue)",
              color: "var(--nw-white-sand)",
              border: "1px solid var(--nw-stone-blue)",
            }}
          >
            Start Free Trial
          </Link>
        </nav>
      </div>
    </header>
  );
}
