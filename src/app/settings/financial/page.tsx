import { redirect } from "next/navigation";
import { getCurrentOrg } from "@/lib/org/session";
import FinancialSettingsForm from "./FinancialSettingsForm";

export const dynamic = "force-dynamic";

export default async function FinancialSettingsPage() {
  const org = await getCurrentOrg();
  if (!org) redirect("/login");

  return (
    <FinancialSettingsForm
      org={{
        default_gc_fee_percentage: Number(org.default_gc_fee_percentage),
        default_deposit_percentage: Number(org.default_deposit_percentage),
        payment_schedule_type: org.payment_schedule_type,
        payment_schedule_config: org.payment_schedule_config,
      }}
    />
  );
}
