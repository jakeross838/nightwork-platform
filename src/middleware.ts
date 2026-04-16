import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

// Anything a signed-out visitor can reach (marketing + auth pages).
// "/" is the marketing landing; the root page redirects authed users
// to /dashboard itself, so we leave that branching to the page.
const PUBLIC_PATHS = ["/", "/login", "/signup", "/pricing", "/forgot-password"];

// Pages that remain reachable even when the billing gate is "expired".
// Users need to be able to open the billing page to resubscribe, hit the
// Stripe portal/checkout APIs, and still log out.
const BILLING_ESCAPE_PATHS = [
  "/settings/billing",
  "/api/stripe",
  "/pricing",
  "/login",
];

function isPublic(pathname: string): boolean {
  if (pathname === "/") return true;
  return PUBLIC_PATHS.some(
    (p) => p !== "/" && (pathname === p || pathname.startsWith(`${p}/`))
  );
}

function canEscapeBillingGate(pathname: string): boolean {
  return BILLING_ESCAPE_PATHS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  );
}

export async function middleware(request: NextRequest) {
  const T0 = Date.now();
  const { response, user, gate } = await updateSession(request);
  const { pathname } = request.nextUrl;
  if (process.env.PERF_LOG === "1" && pathname.startsWith("/api/")) {
    console.log(`[perf] middleware ${pathname}: ${Date.now() - T0}ms`);
  }

  // Bounce signed-in users away from auth-only pages.
  if (user && (pathname === "/login" || pathname === "/signup")) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    url.search = "";
    return NextResponse.redirect(url);
  }

  if (!user && !isPublic(pathname)) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Billing enforcement: expired trial / cancelled sub → force to billing
  // page so they can resubscribe. Read-only mode is enforced at API-route
  // level (middleware stays GET-only friendly so pages can still render).
  if (user && gate === "expired" && !canEscapeBillingGate(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/settings/billing";
    url.search = "?trial_expired=1";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    // Run on every request except Next internals, static files, and the auth callback.
    "/((?!_next/static|_next/image|favicon.ico|fonts/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
