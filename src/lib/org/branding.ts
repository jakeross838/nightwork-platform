import { cache } from "react";
import { getCurrentOrg } from "@/lib/org/session";

export type OrgBranding = {
  id: string;
  name: string;
  tagline: string | null;
  logo_url: string | null;
  primary_color: string;
  accent_color: string | null;
};

const FALLBACK_PRIMARY = "#3F5862";

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
    primary_color: org.primary_color || FALLBACK_PRIMARY,
    accent_color: org.accent_color,
  };
});

export { PUBLIC_APP_NAME } from "@/lib/org/public";
