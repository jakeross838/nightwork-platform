import { ApiError } from "@/lib/api/errors";
import { getCurrentOrg } from "@/lib/org/session";

/**
 * Call from any API route that mutates data. Throws ApiError(402) when the
 * org's billing state puts them in read-only mode (past_due > 7 days, or
 * cancelled). The middleware already redirects expired users away from
 * non-billing pages, but API routes served directly still need a write
 * guard.
 *
 * Use case:
 *   export const POST = withApiError(async (req) => {
 *     await requireBillingOk();
 *     ...
 *   });
 */
export async function requireBillingOk(): Promise<void> {
  const org = await getCurrentOrg();
  if (!org) return; // auth layer already handled it
  const status = org.subscription_status;
  const trialEnds = org.trial_ends_at ? new Date(org.trial_ends_at) : null;
  const now = new Date();

  if (status === "cancelled") {
    throw new ApiError(
      "Your subscription is cancelled. Update your plan in Settings → Billing.",
      402
    );
  }

  if (status === "trialing" && trialEnds && trialEnds.getTime() < now.getTime()) {
    throw new ApiError(
      "Your free trial has ended. Pick a plan in Settings → Billing.",
      402
    );
  }

  if (status === "past_due") {
    // We don't have a durable "past_due since" timestamp on the org row.
    // Approximate from `updated_at` via a fresh query — the webhook updates
    // updated_at each time it applies a status change.
    const { createServerClient } = await import("@/lib/supabase/server");
    const supabase = createServerClient();
    const { data } = await supabase
      .from("organizations")
      .select("updated_at")
      .eq("id", org.id)
      .maybeSingle();
    const updatedAt = data?.updated_at ? new Date(data.updated_at as string) : null;
    if (updatedAt && now.getTime() - updatedAt.getTime() > 7 * 24 * 60 * 60 * 1000) {
      throw new ApiError(
        "Payment is past due. Update your payment method in Settings → Billing.",
        402
      );
    }
  }
}
