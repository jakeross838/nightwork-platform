/**
 * CommandPost — Design Tokens
 * Swap this file + globals.css variables to change the entire theme.
 * Brand-specific colors (bgInverse/textPrimary/borderBrand/money) default
 * to Ross Built's navy, but are overridden at runtime by --org-primary
 * CSS variable (set per-org in layout.tsx from the organizations table).
 */

export const theme = {
 colors: {
 bgPage: "#F7F5ED",
 bgSubtle: "#F5F5F5",
 bgMuted: "#E8E8E8",
 bgInverse: "#3F5862",
 textPrimary: "#3F5862",
 textBody: "#3D3D3D",
 textSecondary: "#878787",
 textInverse: "#FFFFFF",
 borderDefault: "#E8E8E8",
 borderStrong: "#A0A0A0",
 borderBrand: "#3F5862",
 white: "#FFFFFF",
 success: "#2E7D32",
 warning: "#E65100",
 error: "#c0392b",
 money: "#3F5862",
 },
 fonts: {
 family: '"Century Gothic", "CenturyGothic", "AppleGothic", sans-serif',
 },
 // Excel export colors (ARGB without alpha prefix for exceljs)
 excel: {
 headerBg: "3F5862",
 headerText: "FFFFFF",
 accentLine: "3F5862",
 lightBg: "F5F5F5",
 white: "FFFFFF",
 black: "000000",
 error: "C0392B",
 },
} as const;
