import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Inter, Space_Grotesk, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import ConnectionBanner from "@/components/connection-banner";
import ImpersonationBanner from "@/components/impersonation-banner";
import FeedbackWidgetMount from "@/components/feedback-widget-mount";
import { OrgBrandingProvider } from "@/components/org-branding-provider";
import { ThemeProvider, type Theme } from "@/components/theme-provider";
import { ToastProvider } from "@/components/toast-provider";
import KeyboardShortcutsProvider from "@/components/keyboard-shortcuts-provider";
import { getOrgBranding } from "@/lib/org/branding";

export const dynamic = "force-dynamic";

// Inter — Nightwork wordmark font. Loaded with CSS variable binding so
// Tailwind's font-sans utility can pick it up globally.
const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-inter",
  display: "swap",
});

// Slate design-system fonts — loaded but not applied globally yet.
// Available as CSS variables for future component restyling.
const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-space-grotesk",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Nightwork",
  description:
    "Invoice approval, draws, budgets, and lien releases for custom home builders. Built by builders.",
  metadataBase: new URL("https://nightwork.build"),
  alternates: { canonical: "https://nightwork.build" },
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
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

  // Server-side theme read from cookie. Default = light. Setting data-theme
  // on <html> at server-render time avoids a flash-of-wrong-theme on first paint.
  const themeCookie = cookies().get("nw_theme")?.value;
  const theme: Theme = themeCookie === "dark" ? "dark" : "light";

  return (
    <html
      lang="en"
      data-theme={theme}
      className={`${inter.variable} ${spaceGrotesk.variable} ${jetbrainsMono.variable}`}
    >
      <body className="grain antialiased">
        <ThemeProvider initialTheme={theme}>
          <OrgBrandingProvider branding={branding}>
            <ToastProvider>
              <KeyboardShortcutsProvider>
                <ImpersonationBanner />
                <ConnectionBanner />
                {children}
                <FeedbackWidgetMount />
              </KeyboardShortcutsProvider>
            </ToastProvider>
          </OrgBrandingProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
