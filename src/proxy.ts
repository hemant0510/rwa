import { NextResponse, type NextRequest } from "next/server";

import { updateSession } from "@/lib/supabase/middleware";

const PUBLIC_ROUTES = [
  "/",
  "/login",
  "/super-admin-login",
  "/register",
  "/register-society",
  "/verify-email",
  "/check-email",
  "/forgot-password",
  "/reset-password",
];
const PUBLIC_API_PREFIX = [
  "/api/v1/auth/",
  "/api/v1/residents/register",
  "/api/v1/health",
  "/api/v1/societies/",
  "/api/cron",
];
const PUBLIC_PAGE_PREFIX = ["/register/", "/rwaid/"];

/**
 * Admin session inactivity timeout (8 hours).
 * Mirrors ADMIN_SESSION_TIMEOUT_MS from src/lib/constants.ts.
 * Defined inline here to avoid importing Prisma-dependent modules
 * into the Edge-runtime proxy bundle.
 */
const ADMIN_SESSION_TIMEOUT_MS = 8 * 60 * 60 * 1000;
const ACTIVITY_COOKIE = "admin-last-activity";

function isPublicPage(pathname: string): boolean {
  if (PUBLIC_ROUTES.includes(pathname)) return true;
  return PUBLIC_PAGE_PREFIX.some((prefix) => pathname.startsWith(prefix));
}

function isPublicApi(pathname: string): boolean {
  return PUBLIC_API_PREFIX.some((prefix) => pathname.startsWith(prefix));
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip static files and Next.js internals
  if (pathname.startsWith("/_next") || pathname.startsWith("/favicon") || pathname.includes(".")) {
    return NextResponse.next();
  }

  const { user, supabaseResponse } = await updateSession(request);

  // API routes — return 401 JSON for protected APIs (never redirect)
  if (pathname.startsWith("/api/")) {
    if (!user && !isPublicApi(pathname)) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "Not authenticated" } },
        { status: 401 },
      );
    }
    return supabaseResponse;
  }

  // Public pages — always allow access
  if (isPublicPage(pathname)) {
    return supabaseResponse;
  }

  // Protected pages — redirect to login
  if (!user) {
    const loginUrl = pathname.startsWith("/sa") ? "/super-admin-login" : "/login";
    return NextResponse.redirect(new URL(loginUrl, request.url));
  }

  // Admin & Super Admin inactivity timeout
  if (pathname.startsWith("/admin") || pathname.startsWith("/sa")) {
    const lastActivityStr = request.cookies.get(ACTIVITY_COOKIE)?.value;

    if (lastActivityStr) {
      const lastActivity = parseInt(lastActivityStr, 10);
      if (!isNaN(lastActivity) && Date.now() - lastActivity > ADMIN_SESSION_TIMEOUT_MS) {
        const loginPath = pathname.startsWith("/sa") ? "/super-admin-login" : "/login";
        const loginUrl = new URL(loginPath, request.url);
        loginUrl.searchParams.set("reason", "session_expired");
        const response = NextResponse.redirect(loginUrl);
        response.cookies.delete(ACTIVITY_COOKIE);
        return response;
      }
    }

    supabaseResponse.cookies.set(ACTIVITY_COOKIE, String(Date.now()), {
      httpOnly: true,
      sameSite: "lax",
      maxAge: Math.floor(ADMIN_SESSION_TIMEOUT_MS / 1000),
      path: "/",
    });
  }

  // Add security headers
  supabaseResponse.headers.set("X-Content-Type-Options", "nosniff");
  supabaseResponse.headers.set("X-Frame-Options", "DENY");
  supabaseResponse.headers.set("X-XSS-Protection", "1; mode=block");
  supabaseResponse.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");

  return supabaseResponse;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
