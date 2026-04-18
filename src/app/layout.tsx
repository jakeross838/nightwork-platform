import type { Metadata } from "next";
import { Inter, Space_Grotesk, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import ConnectionBanner from "@/components/connection-banner";
import { OrgBrandingProvider } from "@/components/org-branding-provider";
import { ToastProvider } from "@/components/toast-provider";
import KeyboardShortcutsProvider from "@/components/keyboard-shortcuts-provider";
import { getOrgBranding } from "@/lib/org/branding";

export const dynamic = "force-dynamic";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-display",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-sans",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Nightwork",
  description:
    "Invoice approval, draws, budgets, and lien releases for custom home builders. Built by builders.",
  metadataBase: new URL("https://nightwork.build"),
  alternates: { canonical: "https://nightwork.build" },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon-16x16.png", type: "image/png", sizes: "16x16" },
      { url: "/favicon-32x32.png", type: "image/png", sizes: "32x32" },
    ],
    apple: "/apple-touch-icon.png",
  },
  openGraph: {
    title: "Nightwork — construction back-office, on autopilot",
    description:
      "Invoice approval, draws, budgets, and lien releases for custom home builders. Built by builders.",
    url: "https://nightwork.build",
    siteName: "Nightwork",
    images: [{ url: "/icon-512.png", width: 512, height: 512, alt: "Nightwork" }],
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "Nightwork — construction back-office, on autopilot",
    description:
      "Invoice approval, draws, budgets, and lien releases for custom home builders. Built by builders.",
    images: ["/icon-512.png"],
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const branding = await getOrgBranding();
  const primary = branding?.primary_color ?? "#3B5864";
  const accent = branding?.accent_color ?? primary;

  return (
    <html
      lang="en"
      className={`${spaceGrotesk.variable} ${inter.variable} ${jetbrainsMono.variable}`}
    >
      <head>
        <style
          // Per-org CSS vars override the defaults declared in globals.css.
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{
            __html: `:root{--org-primary:${primary};--org-accent:${accent};}`,
          }}
        />
      </head>
      <body className="antialiased">
        <OrgBrandingProvider branding={branding}>
          <ToastProvider>
            <KeyboardShortcutsProvider>
              <ConnectionBanner />
              {children}
            </KeyboardShortcutsProvider>
          </ToastProvider>
        </OrgBrandingProvider>
      </body>
    </html>
  );
}
