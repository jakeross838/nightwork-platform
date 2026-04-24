"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import type { OrgMemberRole } from "@/lib/org/session";

/**
 * Client-side hook that resolves the current authenticated user's
 * primary org role. Mirrors the server-side `getCurrentMembership()`
 * pattern: looks up the earliest-created active org_members row for
 * the authenticated user and returns its `role`.
 *
 * Returns `null` while loading OR when no authenticated/active
 * membership exists. Callers should treat `null` as non-privileged
 * by default — any lock/permission gate should fail-closed until the
 * hook resolves a concrete role.
 */
export function useCurrentRole(): OrgMemberRole | null {
  const [role, setRole] = useState<OrgMemberRole | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user || cancelled) return;
      const { data } = await supabase
        .from("org_members")
        .select("role")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (!cancelled && data?.role) {
        setRole(data.role as OrgMemberRole);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return role;
}
