import { cache } from "react";
import { getCurrentOrg } from "@/lib/org/session";

export type OrgBranding = {
  id: string;
  name: string;
  tagline: string | null;
  logo_url: string | null;
};

/**
 * Server-side branding fetch, cached per-request via React cache().
 * Returns null when no user is signed in (e.g. /login, marketing pages).
 */
export const getOrgBranding = cache(async (): Promise<OrgBranding | null> => {
  const org = await getCurrentOrg();
  if (!org) return null;
  return {
    id: org.id,
    name: org.name,
    tagline: org.tagline,
    logo_url: org.logo_url,
  };
});

export { PUBLIC_APP_NAME } from "@/lib/org/public";
