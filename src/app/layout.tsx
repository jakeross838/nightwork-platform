import type { Metadata } from "next";
import "./globals.css";
import ConnectionBanner from "@/components/connection-banner";
import { OrgBrandingProvider } from "@/components/org-branding-provider";
import { getOrgBranding, PUBLIC_APP_NAME } from "@/lib/org/branding";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const branding = await getOrgBranding();
  const name = branding?.name ?? PUBLIC_APP_NAME;
  return {
    title: name,
    description: `Invoice processing and draw generation for ${name}`,
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const branding = await getOrgBranding();
  const primary = branding?.primary_color ?? "#3F5862";
  const accent = branding?.accent_color ?? primary;

  return (
    <html lang="en">
      <head>
        <style
          // Per-org CSS vars override the defaults declared in globals.css.
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{
            __html: `:root{--org-primary:${primary};--org-accent:${accent};}`,
          }}
        />
      </head>
      <body className="grain antialiased">
        <OrgBrandingProvider branding={branding}>
          <ConnectionBanner />
          {children}
        </OrgBrandingProvider>
      </body>
    </html>
  );
}
