import { redirect } from "next/navigation";
import Link from "next/link";
import { getPlatformAdmin } from "@/lib/auth/platform-admin";
import PlatformSidebar from "@/components/admin/platform-sidebar";
import Eyebrow from "@/components/nw/Eyebrow";
import { createServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function PlatformAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const admin = await getPlatformAdmin();
  if (!admin) {
    // Middleware already handles this, but belt-and-suspenders: if the
    // layout renders without a staff session, bail out.
    redirect("/dashboard");
  }

  // Counts for sidebar badges.
  const supabase = createServerClient();
  const [feedbackRes, supportRes] = await Promise.all([
    supabase
      .from("feedback_notes")
      .select("id", { count: "exact", head: true })
      .in("status", ["new", "reviewing", "in_progress"]),
    supabase
      .from("support_conversations")
      .select("id", { count: "exact", head: true })
      .eq("status", "escalated"),
  ]);
  const unresolvedFeedback = feedbackRes.count ?? 0;
  const escalatedSupport = supportRes.count ?? 0;

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: "var(--bg-page)" }}
    >
      {/* Top bar — separate from the customer-facing NavBar so staff
          always know they're in the internal tools. */}
      <header
        className="border-b"
        style={{
          borderColor: "var(--border-default)",
          background: "var(--bg-card)",
        }}
      >
        <div className="max-w-[1400px] mx-auto px-4 md:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span
              className="font-display text-base tracking-tight"
              style={{ color: "var(--text-primary)" }}
            >
              Nightwork Platform
            </span>
            <span
              className="hidden sm:inline-block h-4 w-px"
              style={{ background: "var(--border-default)" }}
            />
            <Eyebrow tone="accent" className="hidden sm:inline-flex">
              STAFF · INTERNAL TOOLS
            </Eyebrow>
          </div>
          <Link
            href="/dashboard"
            className="text-xs px-3 py-1.5 border transition-colors"
            style={{
              borderColor: "var(--border-default)",
              color: "var(--text-secondary)",
            }}
          >
            Exit to app →
          </Link>
        </div>
      </header>

      <div className="flex-1 flex">
        <PlatformSidebar
          unresolvedFeedback={unresolvedFeedback}
          escalatedSupport={escalatedSupport}
        />
        <main className="flex-1 min-w-0">
          <div className="max-w-[1400px] mx-auto px-4 md:px-6 py-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
