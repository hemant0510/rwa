import { NextRequest, NextResponse } from "next/server";

import { z } from "zod";

import { internalError } from "@/lib/api-helpers";
import { VERIFICATION_RESEND_COOLDOWN_SECONDS } from "@/lib/constants";
import { isEmailConfigured } from "@/lib/email";
import { prisma } from "@/lib/prisma";
import { sendVerificationEmail } from "@/lib/verification";

const resendSchema = z.object({
  email: z.string().email(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = resendSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "Valid email is required" } },
        { status: 422 },
      );
    }

    if (!isEmailConfigured()) {
      return NextResponse.json(
        { error: { code: "EMAIL_NOT_CONFIGURED", message: "Email service is not configured" } },
        { status: 503 },
      );
    }

    // Find the unverified user (multiple users may share an email across roles)
    const user = await prisma.user.findFirst({
      where: { email: parsed.data.email, isEmailVerified: false },
      select: { id: true, name: true, email: true, isEmailVerified: true },
      orderBy: { createdAt: "desc" },
    });

    if (!user) {
      // No unverified user — check if any verified user exists with this email
      const verifiedUser = await prisma.user.findFirst({
        where: { email: parsed.data.email },
        select: { id: true },
      });

      if (verifiedUser) {
        return NextResponse.json({
          success: true,
          message: "Email is already verified. You can sign in.",
          alreadyVerified: true,
        });
      }

      // Don't reveal whether email exists
      return NextResponse.json({
        success: true,
        message: "If that email exists, a verification email has been sent.",
      });
    }

    // Rate limit: check cooldown on last token
    const lastToken = await prisma.emailVerificationToken.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    });

    if (lastToken) {
      const elapsed = (Date.now() - lastToken.createdAt.getTime()) / 1000;
      if (elapsed < VERIFICATION_RESEND_COOLDOWN_SECONDS) {
        const remaining = Math.ceil(VERIFICATION_RESEND_COOLDOWN_SECONDS - elapsed);
        return NextResponse.json(
          {
            error: {
              code: "COOLDOWN",
              message: `Please wait ${remaining} seconds before requesting another email.`,
            },
          },
          { status: 429 },
        );
      }
    }

    await sendVerificationEmail(user.id, user.email, user.name);

    return NextResponse.json({
      success: true,
      message: "Verification email sent. Please check your inbox.",
    });
  } catch (err) {
    console.error("Resend verification error:", err);
    return internalError("Failed to resend verification email");
  }
}
