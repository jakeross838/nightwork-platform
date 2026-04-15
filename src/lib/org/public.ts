/**
 * Org constants + types safe to import from client components. Avoids
 * pulling the server-side Supabase helpers into the client bundle.
 */

export const PUBLIC_APP_NAME = "CommandPost";

export type OrgBrandingPublic = {
  id: string;
  name: string;
  tagline: string | null;
  logo_url: string | null;
  primary_color: string;
  accent_color: string | null;
};
