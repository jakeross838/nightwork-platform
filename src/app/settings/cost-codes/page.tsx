import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { getCurrentMembership } from "@/lib/org/session";
import CostCodesManager from "./CostCodesManager";

export const dynamic = "force-dynamic";

export type CostCode = {
  id: string;
  code: string;
  description: string;
  category: string | null;
  sort_order: number;
  is_change_order: boolean;
};

export default async function CostCodesPage() {
  const membership = await getCurrentMembership();
  if (!membership) redirect("/login");

  const supabase = createServerClient();
  const { data: codes } = await supabase
    .from("cost_codes")
    .select("id, code, description, category, sort_order, is_change_order")
    .eq("org_id", membership.org_id)
    .is("deleted_at", null)
    .order("sort_order", { ascending: true });

  return <CostCodesManager initial={(codes ?? []) as CostCode[]} />;
}
