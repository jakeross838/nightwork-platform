import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { getCurrentMembership } from "@/lib/org/session";
import CodesManager from "./CodesManager";

export const dynamic = "force-dynamic";

export type OrgCostCode = {
  id: string;
  code: string;
  name: string;
  parent_code: string | null;
  canonical_code_id: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type CanonicalCode = {
  id: string;
  code: string;
  name: string;
  category: string;
  full_path: string;
  level: number;
};

// Per-org cost code admin UI. Top-level route under /cost-intelligence/
// (separate from the legacy Phase-1 /settings/cost-codes which manages the
// older `cost_codes` table). org_cost_codes coexist with cost_codes;
// future migration consolidates them.
export default async function CostIntelligenceCodesPage() {
  const membership = await getCurrentMembership();
  if (!membership) redirect("/login");

  const supabase = createServerClient();

  const [orgCodesRes, canonicalCodesRes] = await Promise.all([
    supabase
      .from("org_cost_codes")
      .select("id, code, name, parent_code, canonical_code_id, is_active, created_at, updated_at")
      .eq("org_id", membership.org_id)
      .order("code", { ascending: true }),
    supabase
      .from("canonical_cost_codes")
      .select("id, code, name, category, full_path, level")
      .eq("spine", "NAHB")
      .eq("is_active", true)
      .order("code", { ascending: true }),
  ]);

  return (
    <CodesManager
      initial={(orgCodesRes.data ?? []) as OrgCostCode[]}
      canonical={(canonicalCodesRes.data ?? []) as CanonicalCode[]}
    />
  );
}
