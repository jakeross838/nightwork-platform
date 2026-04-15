import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { getCurrentOrg } from "@/lib/org/session";
import OnboardWizard from "./OnboardWizard";

export const dynamic = "force-dynamic";

export default async function OnboardPage() {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const org = await getCurrentOrg();
  if (!org) redirect("/login");
  if (org.onboarding_complete) redirect("/dashboard");

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", user.id)
    .single();

  return (
    <OnboardWizard
      userFullName={profile?.full_name ?? ""}
      initial={{
        name: org.name,
        company_address: org.company_address,
        company_city: org.company_city,
        company_state: org.company_state,
        company_zip: org.company_zip,
        company_phone: org.company_phone,
        company_email: org.company_email,
        company_website: org.company_website,
        logo_url: org.logo_url,
        builder_type: org.builder_type,
        default_gc_fee_percentage: Number(org.default_gc_fee_percentage),
        default_deposit_percentage: Number(org.default_deposit_percentage),
        payment_schedule_type: org.payment_schedule_type,
      }}
    />
  );
}
