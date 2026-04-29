/**
 * Phase 3.4 Step 4 — owner/admin queue for pending cost-code suggestions.
 *
 * PMs cannot directly create org_cost_codes. They suggest new codes from
 * the proposal review form (Step 4 ReviewManager → "Suggest new code"
 * modal); each suggestion lands here as a pending_cost_code_suggestions
 * row. Owners/admins resolve via approve (creates the org_cost_codes row
 * + sets approved_org_cost_code_id) or reject.
 *
 * RLS already gates this:
 *   - SELECT: any active org member + platform admin (so PMs can see
 *     their own suggestions, but the resolve UI here is owner/admin only)
 *   - UPDATE (resolve): owner/admin only via the resolve route in Step 5
 *
 * The page itself does a soft role check so PMs aren't shown the
 * approve/reject buttons; the real authz is enforced server-side at
 * /api/cost-code-suggestions/[id]/resolve (Step 5).
 */
import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { getCurrentMembership } from "@/lib/org/session";
import SuggestionsManager from "./SuggestionsManager";

export const dynamic = "force-dynamic";

export type PendingSuggestion = {
  id: string;
  org_id: string;
  suggested_code: string;
  suggested_name: string;
  suggested_canonical_code_id: string | null;
  suggested_parent_code: string | null;
  source_proposal_line_item_id: string | null;
  rationale: string | null;
  status: "pending" | "approved" | "rejected" | "duplicate";
  approved_org_cost_code_id: string | null;
  suggested_by: string;
  resolved_by: string | null;
  resolved_at: string | null;
  resolution_note: string | null;
  created_at: string;
  updated_at: string;
};

export type CanonicalCodeOption = {
  id: string;
  code: string;
  name: string;
  full_path: string;
  level: number;
};

export default async function SuggestionsPage() {
  const membership = await getCurrentMembership();
  if (!membership) redirect("/login");

  const supabase = createServerClient();

  // Fetch all open suggestions for this org. Status filter is the queue
  // boundary — resolved rows drop off the live UI. RLS scope is already
  // org-bound; the .eq() is defense-in-depth.
  const [pendingRes, canonicalRes] = await Promise.all([
    supabase
      .from("pending_cost_code_suggestions")
      .select(
        "id, org_id, suggested_code, suggested_name, suggested_canonical_code_id, suggested_parent_code, source_proposal_line_item_id, rationale, status, approved_org_cost_code_id, suggested_by, resolved_by, resolved_at, resolution_note, created_at, updated_at"
      )
      .eq("org_id", membership.org_id)
      .eq("status", "pending")
      .order("created_at", { ascending: true }),
    supabase
      .from("canonical_cost_codes")
      .select("id, code, name, full_path, level")
      .eq("spine", "NAHB")
      .eq("is_active", true)
      .order("code", { ascending: true }),
  ]);

  return (
    <SuggestionsManager
      pending={(pendingRes.data ?? []) as PendingSuggestion[]}
      canonical={(canonicalRes.data ?? []) as CanonicalCodeOption[]}
      role={membership.role}
    />
  );
}
