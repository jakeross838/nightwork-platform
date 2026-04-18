import Link from "next/link";
import { PUBLIC_APP_NAME } from "@/lib/org/public";

export default function PublicFooter() {
  return (
    <footer className="mt-auto px-6 py-10 border-t border-[rgba(59,88,100,0.15)] bg-white">
      <div className="max-w-[1200px] mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
        <div>
          <p className="font-display text-sm tracking-[0.12em] uppercase text-slate-tile">
            {PUBLIC_APP_NAME}
          </p>
          <p className="mt-1 text-xs text-[rgba(59,88,100,0.55)]">
            Nightwork makes building lightwork.
          </p>
          <p className="mt-1 text-xs text-[rgba(59,88,100,0.55)]">
            jake@nightwork.build
          </p>
        </div>
        <nav className="flex items-center gap-4 text-[13px] text-[rgba(59,88,100,0.70)]">
          <Link href="/pricing" className="hover:text-slate-tile">Pricing</Link>
          <Link href="/login" className="hover:text-slate-tile">Sign In</Link>
          <Link href="/signup" className="hover:text-slate-tile">Start Free Trial</Link>
        </nav>
        <p className="text-[11px] text-[rgba(59,88,100,0.55)]">
          © {new Date().getFullYear()} {PUBLIC_APP_NAME}
        </p>
      </div>
    </footer>
  );
}
