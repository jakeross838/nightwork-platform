import { redirect } from "next/navigation";
import { getCurrentMembership } from "@/lib/org/session";
import AdminDashboard from "./AdminDashboard";

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  const membership = await getCurrentMembership();
  if (!membership) redirect("/login");
  if (membership.role !== "admin" && membership.role !== "owner") {
    redirect("/settings/company");
  }

  return <AdminDashboard />;
}
