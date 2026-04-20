import { cookies } from "next/headers";
import { createServiceRoleClient } from "@/lib/supabase/service";
import EndImpersonationButton from "./end-impersonation-button";

/**
 * Renders the red "you are impersonating" bar at the very top of every
 * page. Reads the nw_impersonate cookie server-side so there's no
 * flash-of-wrong-banner on first paint. When the cookie isn't present,
 * returns null and the banner is absent.
 */
export default async function ImpersonationBanner() {
  const cookie = cookies().get("nw_impersonate")?.value;
  if (!cookie) return null;

  let parsed: {
    admin_user_id?: string;
    target_org_id?: string;
    started_at?: string;
  };
  try {
    parsed = JSON.parse(cookie);
  } catch {
    return null;
  }

  const ONE_HOUR = 60 * 60 * 1000;
  const startedAt = parsed.started_at ? new Date(parsed.started_at) : null;
  const ageMs = startedAt ? Date.now() - startedAt.getTime() : Infinity;
  if (ageMs >= ONE_HOUR || !parsed.target_org_id) {
    // Expired / malformed — middleware will clear it on next hit.
    return null;
  }

  // Fetch the org name for the banner. Service-role because the admin's
  // session may not have direct access until RLS resolves.
  const svc = createServiceRoleClient();
  const { data: org } = await svc
    .from("organizations")
    .select("name")
    .eq("id", parsed.target_org_id)
    .maybeSingle();

  const orgName = (org as { name: string } | null)?.name ?? "organization";
  const minutesLeft = Math.max(0, Math.ceil((ONE_HOUR - ageMs) / 60000));

  return (
    <div
      className="w-full"
      style={{
        background: "var(--nw-danger)",
        color: "#FFF8F3",
        borderBottom: "1px solid rgba(0,0,0,0.15)",
      }}
    >
      <div className="max-w-[1400px] mx-auto px-4 py-2 flex items-center justify-between gap-4 text-sm">
        <div className="flex items-center gap-3 min-w-0">
          <span
            className="text-[10px] uppercase tracking-[0.14em] font-medium px-1.5 py-0.5 border"
            style={{
              fontFamily: "var(--font-jetbrains-mono)",
              borderColor: "rgba(255,255,255,0.6)",
            }}
          >
            IMPERSONATING
          </span>
          <span className="font-medium truncate">{orgName}</span>
          <span className="text-xs opacity-80 hidden sm:inline">
            · {minutesLeft}m left · every action is logged
          </span>
        </div>
        <EndImpersonationButton />
      </div>
    </div>
  );
}
