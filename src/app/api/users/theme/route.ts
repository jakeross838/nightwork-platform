import { cookies } from "next/headers";
import { NextResponse } from "next/server";

const THEME_COOKIE = "nw_theme";
const MAX_AGE = 60 * 60 * 24 * 365; // 1 year

// Persists the user's theme choice in a long-lived cookie. Read server-side
// in src/app/layout.tsx to set the initial data-theme attribute (no flash).
// No DB write yet — cookie is per-device. A future migration can add
// user_profiles.theme_mode if cross-device persistence is needed.
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const theme = (body as { theme?: unknown })?.theme;
  if (theme !== "light" && theme !== "dark") {
    return NextResponse.json({ error: "Invalid theme" }, { status: 400 });
  }

  cookies().set(THEME_COOKIE, theme, {
    path: "/",
    maxAge: MAX_AGE,
    sameSite: "lax",
    httpOnly: false,
  });

  return NextResponse.json({ theme });
}
