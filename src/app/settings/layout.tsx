import { redirect } from "next/navigation";
import NavBar from "@/components/nav-bar";
import AdminSidebar, { AdminMobileNav } from "@/components/admin-sidebar";
import { getCurrentMembership } from "@/lib/org/session";

export const dynamic = "force-dynamic";

export default async function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const membership = await getCurrentMembership();
  if (!membership) redirect("/login");

  return (
    <div className="min-h-screen flex flex-col">
      <NavBar />
      <main className="flex-1">
        <div className="max-w-[1200px] mx-auto px-4 md:px-6 py-8">
          <header className="mb-6">
            <h1 className="font-display text-3xl text-[color:var(--text-primary)] tracking-tight">Admin</h1>
            <p className="mt-1 text-sm text-[color:var(--text-secondary)]">
              Settings, reference data, and system tools.
            </p>
          </header>
          <AdminMobileNav role={membership.role} />
          <div className="flex gap-8">
            <AdminSidebar role={membership.role} />
            <div className="flex-1 min-w-0">{children}</div>
          </div>
        </div>
      </main>
    </div>
  );
}
