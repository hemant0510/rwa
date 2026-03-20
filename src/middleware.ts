import { type NextRequest, NextResponse } from "next/server";

import { updateSession } from "@/lib/supabase/middleware";

/**
 * Route prefixes that require an authenticated Supabase session.
 * Role-based access control (admin vs resident vs super admin) is
 * enforced inside each layout via useAuth().
 */
const PROTECTED_PREFIXES = ["/admin", "/sa", "/r"] as const;

/**
 * Routes that are intentionally public — skip auth check entirely.
 * Next.js static files are excluded via the matcher config below.
 */
const PUBLIC_PREFIXES = ["/api/v1/auth", "/api/cron"] as const;

/**
 * Admin session inactivity timeout (8 hours).
 * Mirrors ADMIN_SESSION_TIMEOUT_MS from src/lib/constants.ts.
 * Defined inline here to avoid importing Prisma-dependent modules
 * into the Edge-runtime middleware bundle.
 */
const ADMIN_SESSION_TIMEOUT_MS = 8 * 60 * 60 * 1000;
const ACTIVITY_COOKIE = "admin-last-activity";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Public API routes — no auth check
  if (PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return NextResponse.next();
  }

  const isProtected = PROTECTED_PREFIXES.some((prefix) => pathname.startsWith(prefix));

  // Non-protected routes — refresh session cookies and continue
  if (!isProtected) {
    const { supabaseResponse } = await updateSession(request);
    return supabaseResponse;
  }

  // Protected route — verify session
  const { user, supabaseResponse } = await updateSession(request);

  if (!user) {
    // Super Admin routes redirect to their own login page
    const loginPath = pathname.startsWith("/sa") ? "/super-admin-login" : "/login";
    const redirectUrl = new URL(loginPath, request.url);
    redirectUrl.searchParams.set("redirectTo", pathname);
    return NextResponse.redirect(redirectUrl);
  }

  // Admin-specific inactivity timeout
  if (pathname.startsWith("/admin")) {
    const lastActivityStr = request.cookies.get(ACTIVITY_COOKIE)?.value;

    if (lastActivityStr) {
      const lastActivity = parseInt(lastActivityStr, 10);
      if (!isNaN(lastActivity) && Date.now() - lastActivity > ADMIN_SESSION_TIMEOUT_MS) {
        // Session expired due to inactivity — redirect to login
        const loginUrl = new URL("/login", request.url);
        loginUrl.searchParams.set("reason", "session_expired");
        const response = NextResponse.redirect(loginUrl);
        response.cookies.delete(ACTIVITY_COOKIE);
        return response;
      }
    }

    // Refresh the activity timestamp on every admin request
    supabaseResponse.cookies.set(ACTIVITY_COOKIE, String(Date.now()), {
      httpOnly: true,
      sameSite: "lax",
      maxAge: Math.floor(ADMIN_SESSION_TIMEOUT_MS / 1000),
      path: "/",
    });
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    /*
     * Match all paths except:
     * - _next/static (Next.js build output)
     * - _next/image (image optimisation)
     * - favicon.ico
     * - static image/font files
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|woff2?)$).*)",
  ],
};
