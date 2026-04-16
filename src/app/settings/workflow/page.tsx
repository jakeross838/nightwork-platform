import { redirect } from "next/navigation";
import { getCurrentMembership } from "@/lib/org/session";
import { getWorkflowSettings } from "@/lib/workflow-settings";
import { createServerClient } from "@/lib/supabase/server";
import WorkflowSettingsForm from "./WorkflowSettingsForm";

export const dynamic = "force-dynamic";

export default async function WorkflowSettingsPage() {
  const membership = await getCurrentMembership();
  if (!membership) redirect("/login");
  if (membership.role === "pm") {
    redirect("/settings/company");
  }

  const supabase = createServerClient();
  const [settings, pmList] = await Promise.all([
    getWorkflowSettings(membership.org_id),
    // PMs who can be the default assignee for unmatched invoices in bulk import.
    supabase
      .from("org_members")
      .select("user_id, profiles:user_id (id, full_name)")
      .eq("org_id", membership.org_id)
      .eq("is_active", true)
      .in("role", ["pm", "admin", "owner"]),
  ]);

  type PmRow = { user_id: string; profiles: { id: string; full_name: string | null } | null };
  const pms = (pmList.data ?? [])
    .map((r) => {
      const rec = r as unknown as PmRow;
      const profile = Array.isArray(rec.profiles) ? rec.profiles[0] : rec.profiles;
      return profile?.id && profile.full_name
        ? { id: profile.id, name: profile.full_name }
        : null;
    })
    .filter((p): p is { id: string; name: string } => p !== null)
    .sort((a, b) => a.name.localeCompare(b.name));

  return <WorkflowSettingsForm settings={settings} pms={pms} />;
}
