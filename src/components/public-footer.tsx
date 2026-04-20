import Link from "next/link";
import { PUBLIC_APP_NAME } from "@/lib/org/public";

export default function PublicFooter() {
  return (
    <footer
      className="mt-auto px-6 py-10 border-t"
      style={{ background: "var(--bg-card)", borderColor: "var(--border-default)" }}
    >
      <div className="max-w-[1200px] mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
        <div>
          <p
            className="text-sm uppercase"
            style={{
              fontFamily: "var(--font-space-grotesk)",
              letterSpacing: "0.12em",
              color: "var(--text-primary)",
            }}
          >
            {PUBLIC_APP_NAME}
          </p>
          <p className="mt-1 text-xs" style={{ color: "var(--text-tertiary)" }}>
            Nightwork makes building lightwork.
          </p>
          <p className="mt-1 text-xs" style={{ color: "var(--text-tertiary)" }}>
            jake@nightwork.build
          </p>
        </div>
        <nav className="flex items-center gap-4 text-[13px]" style={{ color: "var(--text-secondary)" }}>
          <Link href="/pricing" className="hover:underline">Pricing</Link>
          <Link href="/login" className="hover:underline">Sign In</Link>
          <Link href="/signup" className="hover:underline">Start Free Trial</Link>
        </nav>
        <p className="text-[11px]" style={{ color: "var(--text-tertiary)" }}>
          © {new Date().getFullYear()} {PUBLIC_APP_NAME}
        </p>
      </div>
    </footer>
  );
}
