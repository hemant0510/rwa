import { NextRequest, NextResponse } from "next/server";

import { internalError } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";
import { createAdminClient } from "@/lib/supabase/admin";
import { deletePasswordResetToken, validatePasswordResetToken } from "@/lib/tokens";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token, password, confirmPassword } = body as {
      token?: string;
      password?: string;
      confirmPassword?: string;
    };

    if (!token || !password || !confirmPassword) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "All fields are required." } },
        { status: 422 },
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "Password must be at least 8 characters." } },
        { status: 422 },
      );
    }

    if (password !== confirmPassword) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "Passwords do not match." } },
        { status: 422 },
      );
    }

    // Validate token
    const result = await validatePasswordResetToken(token);
    if (!result) {
      return NextResponse.json(
        {
          error: {
            code: "INVALID_TOKEN",
            message: "This reset link is invalid or has expired. Please request a new one.",
          },
        },
        { status: 400 },
      );
    }

    // Find user and their auth ID
    const user = await prisma.user.findUnique({
      where: { id: result.userId },
      select: { authUserId: true },
    });

    if (!user?.authUserId) {
      return NextResponse.json(
        { error: { code: "USER_NOT_FOUND", message: "Account not found." } },
        { status: 404 },
      );
    }

    // Update password in Supabase
    const supabaseAdmin = createAdminClient();
    const { error } = await supabaseAdmin.auth.admin.updateUserById(user.authUserId, {
      password,
    });

    if (error) {
      console.error("Supabase password update error:", error);
      return NextResponse.json(
        {
          error: { code: "UPDATE_FAILED", message: "Failed to update password. Please try again." },
        },
        { status: 500 },
      );
    }

    // Clean up token
    await deletePasswordResetToken(token);

    return NextResponse.json({
      success: true,
      message: "Password has been reset successfully.",
    });
  } catch (err) {
    console.error("Reset password error:", err);
    return internalError("Failed to reset password");
  }
}
