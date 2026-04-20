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
  const { response, user, gate, isPlatformAdmin } = await updateSession(request);
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

  // Platform admin route guard. Must run BEFORE the billing gate —
  // staff need to access /admin/platform even when their own org is
  // expired, and non-staff shouldn't see the page exists.
  if (pathname === "/admin/platform" || pathname.startsWith("/admin/platform/")) {
    if (!user) {
      const loginUrl = request.nextUrl.clone();
      loginUrl.pathname = "/login";
      loginUrl.searchParams.set("redirect", "/admin/platform");
      return NextResponse.redirect(loginUrl);
    }
    if (!isPlatformAdmin) {
      const url = request.nextUrl.clone();
      url.pathname = "/dashboard";
      url.search = "";
      return NextResponse.redirect(url);
    }
    // Authorized — fall through to response.
  }

  // Platform admin API routes: return JSON 401 instead of redirecting.
  if (pathname.startsWith("/api/admin/platform")) {
    if (!user || !isPlatformAdmin) {
      return NextResponse.json(
        { error: "Platform admin required" },
        { status: 401 }
      );
    }
  }

  // Billing enforcement: expired trial / cancelled sub → force to billing
  // page so they can resubscribe. Read-only mode is enforced at API-route
  // level (middleware stays GET-only friendly so pages can still render).
  // Platform admins are exempt — staff need to debug billing issues.
  if (user && !isPlatformAdmin && gate === "expired" && !canEscapeBillingGate(pathname)) {
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
