import { redirect } from "next/navigation";
import NavBar from "@/components/nav-bar";
import SettingsTabs from "@/components/settings-tabs";
import Breadcrumbs from "@/components/breadcrumbs";
import { getCurrentMembership } from "@/lib/org/session";

export const dynamic = "force-dynamic";

export default async function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const membership = await getCurrentMembership();
  if (!membership) redirect("/login");
  if (membership.role !== "admin" && membership.role !== "owner") {
    redirect("/");
  }

  return (
    <div className="min-h-screen flex flex-col">
      <NavBar />
      <main className="flex-1">
        <div className="max-w-[1200px] mx-auto px-6 py-8">
          <Breadcrumbs items={[{ label: "Settings" }]} />
          <header className="mb-6">
            <h1 className="font-display text-3xl text-cream tracking-tight">Settings</h1>
            <p className="mt-1 text-sm text-cream-dim">
              Manage your organization, team, financial defaults, and cost codes.
            </p>
          </header>
          <SettingsTabs />
          <div className="mt-6">{children}</div>
        </div>
      </main>
    </div>
  );
}
