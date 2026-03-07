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
];
const PUBLIC_API_PREFIX = [
  "/api/v1/auth/",
  "/api/v1/residents/register",
  "/api/v1/health",
  "/api/v1/societies/",
];
const PUBLIC_PAGE_PREFIX = ["/register/", "/rwaid/"];

function isPublicPage(pathname: string): boolean {
  if (PUBLIC_ROUTES.includes(pathname)) return true;
  return PUBLIC_PAGE_PREFIX.some((prefix) => pathname.startsWith(prefix));
}

function isPublicApi(pathname: string): boolean {
  return PUBLIC_API_PREFIX.some((prefix) => pathname.startsWith(prefix));
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip static files and Next.js internals
  if (pathname.startsWith("/_next") || pathname.startsWith("/favicon") || pathname.includes(".")) {
    return NextResponse.next();
  }

  const { user, supabaseResponse } = await updateSession(request);

  // API routes — return 401 JSON for protected APIs (never redirect)
  if (pathname.startsWith("/api/v1/")) {
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
