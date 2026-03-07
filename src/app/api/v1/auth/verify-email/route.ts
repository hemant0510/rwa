import { NextRequest, NextResponse } from "next/server";

import { internalError } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";
import { validateVerificationToken, deleteVerificationToken } from "@/lib/tokens";

export async function GET(request: NextRequest) {
  try {
    const token = request.nextUrl.searchParams.get("token");

    if (!token) {
      return NextResponse.json(
        { error: { code: "MISSING_TOKEN", message: "Verification token is required" } },
        { status: 400 },
      );
    }

    const result = await validateVerificationToken(token);

    if (!result) {
      return NextResponse.json(
        {
          error: {
            code: "INVALID_TOKEN",
            message: "This verification link is invalid or has expired. Please request a new one.",
          },
        },
        { status: 400 },
      );
    }

    // Check if already verified
    const user = await prisma.user.findUnique({
      where: { id: result.userId },
      select: { isEmailVerified: true },
    });

    if (user?.isEmailVerified) {
      await deleteVerificationToken(token);
      return NextResponse.json({
        success: true,
        message: "Email is already verified. You can sign in.",
        alreadyVerified: true,
      });
    }

    // Mark user as verified
    await prisma.user.update({
      where: { id: result.userId },
      data: { isEmailVerified: true },
    });

    await deleteVerificationToken(token);

    return NextResponse.json({
      success: true,
      message: "Email verified successfully! You can now sign in.",
    });
  } catch (err) {
    console.error("Email verification error:", err);
    return internalError("Failed to verify email");
  }
}
