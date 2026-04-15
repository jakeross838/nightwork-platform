import { redirect } from "next/navigation";
import { getCurrentOrg } from "@/lib/org/session";
import CompanySettingsForm from "./CompanySettingsForm";

export const dynamic = "force-dynamic";

export default async function CompanySettingsPage() {
  const org = await getCurrentOrg();
  if (!org) redirect("/login");

  return (
    <CompanySettingsForm
      org={{
        id: org.id,
        name: org.name,
        tagline: org.tagline,
        logo_url: org.logo_url,
        primary_color: org.primary_color,
        accent_color: org.accent_color,
        company_address: org.company_address,
        company_city: org.company_city,
        company_state: org.company_state,
        company_zip: org.company_zip,
        company_phone: org.company_phone,
        company_email: org.company_email,
        company_website: org.company_website,
      }}
    />
  );
}
