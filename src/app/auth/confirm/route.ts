import { NextRequest, NextResponse } from "next/server";

import { createServerClient } from "@supabase/ssr";

import type { EmailOtpType } from "@supabase/supabase-js";

const ALLOWED_TYPES: readonly EmailOtpType[] = [
  "invite",
  "recovery",
  "magiclink",
  "signup",
  "email",
  "email_change",
] as const;

function isAllowedType(value: string | null): value is EmailOtpType {
  return value !== null && (ALLOWED_TYPES as readonly string[]).includes(value);
}

/**
 * Confirms a Supabase email-link verification server-side using `verifyOtp`.
 *
 * Unlike `/auth/callback` (which handles PKCE `?code=...` exchange), this route
 * consumes `token_hash` + `type` emitted by `admin.generateLink`, so session
 * cookies are set on the server before redirecting to `next`.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  const next = searchParams.get("next") ?? "/";

  if (!tokenHash || !isAllowedType(type)) {
    return NextResponse.redirect(`${origin}/auth/auth-error`);
  }

  const response = NextResponse.redirect(`${origin}${next}`);

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
  if (error) {
    return NextResponse.redirect(`${origin}/auth/auth-error`);
  }

  return response;
}
