import { NextRequest, NextResponse } from "next/server";

import { errorResponse, internalError } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";
import { checkRateLimitAsync } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";
import { loginSchema } from "@/lib/validations/auth";

// 5 login attempts per email per 15 minutes
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = loginSchema.safeParse(body);

    if (!parsed.success) {
      return errorResponse({
        code: "VALIDATION_ERROR",
        message: "Valid email and password (min 8 chars) are required.",
        status: 422,
      });
    }

    const { email, password } = parsed.data;

    // Rate limit per email address
    const rl = await checkRateLimitAsync(`login:${email.toLowerCase()}`, MAX_ATTEMPTS, WINDOW_MS);

    if (!rl.allowed) {
      return errorResponse({
        code: "RATE_LIMIT_EXCEEDED",
        message: "Too many login attempts. Please wait 15 minutes before trying again.",
        status: 429,
      });
    }

    const supabase = await createClient();
    const { data: authData, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      return errorResponse({
        code: "INVALID_CREDENTIALS",
        message: error.message,
        status: 401,
      });
    }

    if (authData?.user?.id) {
      await prisma.counsellor
        .updateMany({
          where: { authUserId: authData.user.id },
          data: { lastLoginAt: new Date() },
        })
        .catch(() => undefined);
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Login error:", err);
    return internalError("Login failed. Please try again.");
  }
}
