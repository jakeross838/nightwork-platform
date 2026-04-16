import { redirect } from "next/navigation";
import { getCurrentMembership } from "@/lib/org/session";
import { getWorkflowSettings } from "@/lib/workflow-settings";
import WorkflowSettingsForm from "./WorkflowSettingsForm";

export const dynamic = "force-dynamic";

export default async function WorkflowSettingsPage() {
  const membership = await getCurrentMembership();
  if (!membership) redirect("/login");
  if (membership.role === "pm") {
    redirect("/settings/company");
  }

  const settings = await getWorkflowSettings(membership.org_id);

  return <WorkflowSettingsForm settings={settings} />;
}
