"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { OrgBrandingPublic } from "@/lib/org/public";

type ClientBranding = OrgBrandingPublic | null;

const OrgBrandingContext = createContext<ClientBranding>(null);

export function OrgBrandingProvider({
  branding,
  children,
}: {
  branding: ClientBranding;
  children: ReactNode;
}) {
  return (
    <OrgBrandingContext.Provider value={branding}>
      {children}
    </OrgBrandingContext.Provider>
  );
}

/**
 * Returns current org branding, or null if no user/org context (e.g. /login).
 */
export function useOrgBranding(): ClientBranding {
  return useContext(OrgBrandingContext);
}
