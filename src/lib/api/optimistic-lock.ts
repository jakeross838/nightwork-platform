import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Optimistic-lock helper used by the write endpoints in src/app/api/**.
 *
 * Contract:
 *   - Client fetches a row and keeps its `updated_at`.
 *   - On save, client sends `expected_updated_at` in the request body.
 *   - Server includes `.eq("updated_at", expectedUpdatedAt)` in the UPDATE.
 *   - If nothing matched, another writer got there first — we return 409
 *     with the current row so the client can reconcile.
 *
 * `expected_updated_at` is OPTIONAL so legacy clients keep working. The
 * guard only activates when the client opts in. As the client codebase
 * is migrated, every write should pass it; we can then flip the field to
 * required in a follow-up.
 */
export type OptimisticLockConflict = { __lockConflict: true; response: NextResponse };

export function isLockConflict(v: unknown): v is OptimisticLockConflict {
  return typeof v === "object" && v !== null && (v as OptimisticLockConflict).__lockConflict === true;
}

export async function updateWithLock<T = Record<string, unknown>>(
  supabase: SupabaseClient,
  opts: {
    table: string;
    id: string;
    orgId: string;
    expectedUpdatedAt: string | null | undefined;
    updates: Record<string, unknown>;
    selectCols?: string;
  }
): Promise<T | OptimisticLockConflict> {
  let query = supabase
    .from(opts.table)
    .update(opts.updates)
    .eq("id", opts.id)
    .eq("org_id", opts.orgId);
  if (opts.expectedUpdatedAt) {
    query = query.eq("updated_at", opts.expectedUpdatedAt);
  }
  const { data, error } = await query
    .select(opts.selectCols ?? "id, updated_at")
    .maybeSingle();
  if (error) {
    return {
      __lockConflict: true,
      response: NextResponse.json({ error: error.message }, { status: 500 }),
    };
  }
  if (!data && opts.expectedUpdatedAt) {
    const { data: current } = await supabase
      .from(opts.table)
      .select(opts.selectCols ?? "id, updated_at")
      .eq("id", opts.id)
      .eq("org_id", opts.orgId)
      .maybeSingle();
    return {
      __lockConflict: true,
      response: NextResponse.json(
        {
          error:
            "Another user changed this record before your update landed. Reload to see the latest.",
          code: "optimistic_lock_conflict",
          current,
        },
        { status: 409 }
      ),
    };
  }
  return data as T;
}
