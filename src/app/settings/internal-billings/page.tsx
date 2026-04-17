import { redirect } from "next/navigation";
import { getCurrentOrg } from "@/lib/org/session";
import InternalBillingTypesManager from "./InternalBillingTypesManager";

export const dynamic = "force-dynamic";

export default async function InternalBillingsSettingsPage() {
  const org = await getCurrentOrg();
  if (!org) redirect("/login");
  return <InternalBillingTypesManager />;
}
