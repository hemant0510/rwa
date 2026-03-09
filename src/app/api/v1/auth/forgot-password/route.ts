import { NextRequest, NextResponse } from "next/server";

import { internalError } from "@/lib/api-helpers";
import { PASSWORD_RESET_COOLDOWN_SECONDS, APP_URL } from "@/lib/constants";
import { sendEmail } from "@/lib/email";
import { getPasswordResetEmailHtml } from "@/lib/email-templates/password-reset";
import { prisma } from "@/lib/prisma";
import { generatePasswordResetToken } from "@/lib/tokens";
import { forgotPasswordSchema } from "@/lib/validations/auth";

const SUCCESS_MESSAGE =
  "If an account with that email exists, a password reset link has been sent.";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = forgotPasswordSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "Valid email is required." } },
        { status: 422 },
      );
    }

    const { email } = parsed.data;

    // Look up user by email (don't leak whether account exists)
    const user = await prisma.user.findFirst({
      where: { email },
      select: { id: true, name: true, authUserId: true },
    });

    if (!user || !user.authUserId) {
      // Don't reveal that email doesn't exist
      return NextResponse.json({ success: true, message: SUCCESS_MESSAGE });
    }

    // Check cooldown — prevent spam
    const recentToken = await prisma.passwordResetToken.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
    });

    if (recentToken) {
      const secondsSinceLastRequest = (Date.now() - recentToken.createdAt.getTime()) / 1000;
      if (secondsSinceLastRequest < PASSWORD_RESET_COOLDOWN_SECONDS) {
        return NextResponse.json({ success: true, message: SUCCESS_MESSAGE });
      }
    }

    // Generate token and send email
    const token = await generatePasswordResetToken(user.id);
    const resetUrl = `${APP_URL}/reset-password?token=${token}`;
    const html = getPasswordResetEmailHtml(user.name, resetUrl);

    await sendEmail(email, "Reset Your Password — RWA Connect", html);

    return NextResponse.json({ success: true, message: SUCCESS_MESSAGE });
  } catch (err) {
    console.error("Forgot password error:", err);
    return internalError("Failed to process password reset request");
  }
}
