import { createServerClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";

export type OrgMemberRole = "owner" | "admin" | "pm" | "accounting";

export type CurrentOrg = {
  id: string;
  name: string;
  slug: string;
  tagline: string | null;
  logo_url: string | null;
  primary_color: string;
  accent_color: string | null;
  company_address: string | null;
  company_city: string | null;
  company_state: string | null;
  company_zip: string | null;
  company_phone: string | null;
  company_email: string | null;
  company_website: string | null;
  default_gc_fee_percentage: number;
  default_deposit_percentage: number;
  payment_schedule_type: "5_20" | "15_30" | "monthly" | "custom";
  payment_schedule_config: Record<string, unknown>;
  subscription_plan: "free_trial" | "starter" | "professional" | "enterprise";
  subscription_status: "trialing" | "active" | "past_due" | "cancelled";
  trial_ends_at: string | null;
  ai_calls_this_month: number;
  ai_calls_limit: number;
  storage_used_bytes: number;
};

export type CurrentMembership = {
  org_id: string;
  role: OrgMemberRole;
  is_active: boolean;
};

const ORG_COLUMNS =
  "id, name, slug, tagline, logo_url, primary_color, accent_color, " +
  "company_address, company_city, company_state, company_zip, " +
  "company_phone, company_email, company_website, " +
  "default_gc_fee_percentage, default_deposit_percentage, " +
  "payment_schedule_type, payment_schedule_config, " +
  "subscription_plan, subscription_status, trial_ends_at, " +
  "ai_calls_this_month, ai_calls_limit, storage_used_bytes";

async function resolveMembership(
  supabase: SupabaseClient,
  userId: string
): Promise<CurrentMembership | null> {
  const { data } = await supabase
    .from("org_members")
    .select("org_id, role, is_active")
    .eq("user_id", userId)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  if (!data) return null;
  return {
    org_id: data.org_id,
    role: data.role as OrgMemberRole,
    is_active: data.is_active,
  };
}

export async function getCurrentOrgId(): Promise<string | null> {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const membership = await resolveMembership(supabase, user.id);
  return membership?.org_id ?? null;
}

export async function getCurrentMembership(): Promise<CurrentMembership | null> {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  return resolveMembership(supabase, user.id);
}

export async function getCurrentOrg(): Promise<CurrentOrg | null> {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const membership = await resolveMembership(supabase, user.id);
  if (!membership) return null;

  const { data, error } = await supabase
    .from("organizations")
    .select(ORG_COLUMNS)
    .eq("id", membership.org_id)
    .maybeSingle();

  if (error || !data) return null;
  return data as unknown as CurrentOrg;
}

export async function requireOrgId(): Promise<string> {
  const orgId = await getCurrentOrgId();
  if (!orgId) {
    throw new Error("No active organization for current user");
  }
  return orgId;
}
