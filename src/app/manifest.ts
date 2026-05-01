import type { MetadataRoute } from "next";
import { BRAND_HEX } from "@/lib/branding/constants";

// PWA / Web App Manifest — Nightwork brand v0 (nwrp19 lock for 1.5a ship).
//
// Next.js 14 App Router auto-generates /manifest.webmanifest from this file
// and adds the appropriate <link rel="manifest"> in <head>. Icon paths are
// served from /public via Next's static file convention. The src/app/icon.svg
// file-based icon convention handles favicons separately (Next auto-injects
// <link rel="icon"> for it).
//
// Color tokens — theme_color matches the icon square fill (Stone Blue) so the
// splash screen does not flash a different brand color before the app mounts.
// background_color matches --bg-page in light theme (White Sand).
//
// PWA manifest is JSON output, not CSS — browsers cannot resolve var(--*) here.
// The literal hex values therefore live in one place: src/lib/branding/constants.ts,
// which is the carve-out source of truth for non-CSS brand contexts (manifest, OG
// images, future PDF generators). It mirrors the canonical raw brand tokens in
// src/app/colors_and_type.css.
//
// Reference: .planning/design/BRANDING.md §3, §7
//   https://nextjs.org/docs/app/api-reference/file-conventions/metadata/manifest

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Nightwork",
    short_name: "Nightwork",
    description:
      "Invoice approval, draws, budgets, and lien releases for custom home builders.",
    start_url: "/",
    display: "standalone",
    theme_color: BRAND_HEX.stoneBlue,
    background_color: BRAND_HEX.whiteSand,
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
    ],
  };
}
