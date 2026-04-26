import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Optimistic-lock + RLS-denial helper used by the write endpoints in
 * src/app/api/**.
 *
 * Contract:
 *   - Client fetches a row and keeps its `updated_at`.
 *   - On save, client MAY send `expected_updated_at` in the request body.
 *   - Server includes `.eq("updated_at", expectedUpdatedAt)` in the UPDATE
 *     when provided.
 *   - When 0 rows are affected, the helper refetches by id+org_id and
 *     classifies:
 *       * Refetch returns nothing → 403 (row gone, never existed in this
 *         org, or read-denied). Pre-condition check on the route should
 *         have caught this; treat as access-denied.
 *       * Refetch returns a row whose updated_at differs from the client's
 *         `expected_updated_at` → 409 (true optimistic-lock conflict;
 *         payload includes `current` so the client can reconcile).
 *       * Refetch returns a row whose updated_at matches (or no expected
 *         was provided) → 403. The row exists and the client wasn't
 *         racing anyone, so the only remaining cause is RLS silently
 *         denying the write.
 *
 * `expected_updated_at` is OPTIONAL so legacy clients keep working;
 * those clients now get a real 403 on RLS denial instead of the
 * silent 200 the helper used to return.
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
  const selectCols = opts.selectCols ?? "id, updated_at";
  const { data, error } = await query.select(selectCols).maybeSingle();
  if (error) {
    return {
      __lockConflict: true,
      response: NextResponse.json({ error: error.message }, { status: 500 }),
    };
  }
  if (data) {
    return data as T;
  }

  // 0 rows affected. Refetch to distinguish RLS denial from a true
  // lock conflict.
  const { data: current } = await supabase
    .from(opts.table)
    .select(selectCols)
    .eq("id", opts.id)
    .eq("org_id", opts.orgId)
    .maybeSingle();

  if (!current) {
    return {
      __lockConflict: true,
      response: NextResponse.json(
        {
          error: "Permission denied or record not found",
          code: "permission_denied",
        },
        { status: 403 }
      ),
    };
  }

  const currentUpdatedAt = (current as { updated_at?: string | null }).updated_at ?? null;
  const lockMismatch =
    !!opts.expectedUpdatedAt &&
    currentUpdatedAt !== null &&
    currentUpdatedAt !== opts.expectedUpdatedAt;

  if (lockMismatch) {
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

  // Row is current (or client didn't send a lock token). The only
  // remaining cause for 0 rows affected is RLS silently denying.
  return {
    __lockConflict: true,
    response: NextResponse.json(
      {
        error: "Permission denied — you do not have access to update this record",
        code: "permission_denied",
      },
      { status: 403 }
    ),
  };
}
