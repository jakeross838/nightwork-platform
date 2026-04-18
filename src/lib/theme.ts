/**
 * Nightwork — Design Tokens (Slate palette)
 * Swap this file + globals.css variables to change the entire theme.
 * Brand colors default to the Slate palette; org-specific overrides
 * are set at runtime via --org-primary CSS variable in layout.tsx.
 */

export const theme = {
 colors: {
 bgPage: "#F7F5EC",
 bgSubtle: "rgba(91, 134, 153, 0.06)",
 bgMuted: "rgba(59, 88, 100, 0.08)",
 bgInverse: "#1A2830",
 bgInverseHover: "#132028",
 textPrimary: "#3B5864",
 textBody: "#3B5864",
 textSecondary: "rgba(59, 88, 100, 0.70)",
 textInverse: "#F7F5EC",
 borderDefault: "rgba(59, 88, 100, 0.15)",
 borderStrong: "rgba(59, 88, 100, 0.30)",
 borderBrand: "#5B8699",
 white: "#FFFFFF",
 success: "#4A8A6F",
 warning: "#C98A3B",
 error: "#B0554E",
 money: "#3B5864",
 stoneBlue: "#5B8699",
 gulfBlue: "#4E7A8C",
 oceanside: "#CBD8DB",
 },
 fonts: {
 display: '"Space Grotesk", system-ui, sans-serif',
 body: '"Inter", system-ui, -apple-system, sans-serif',
 mono: '"JetBrains Mono", ui-monospace, monospace',
 },
 // Excel export colors (ARGB without alpha prefix for exceljs)
 excel: {
 headerBg: "1A2830",
 headerText: "F7F5EC",
 accentLine: "5B8699",
 lightBg: "F7F5EC",
 white: "FFFFFF",
 black: "000000",
 error: "B0554E",
 },
} as const;
