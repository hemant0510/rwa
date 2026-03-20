import { NextRequest, NextResponse } from "next/server";

import { internalError, unauthorizedError } from "@/lib/api-helpers";
import { isEmailConfigured } from "@/lib/email";
import { getFullAccessAdmin } from "@/lib/get-current-user";
import { prisma } from "@/lib/prisma";
import { sendVerificationEmail } from "@/lib/verification";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;

    // Auth guard
    const admin = await getFullAccessAdmin();
    if (!admin) return unauthorizedError("Admin authentication required");

    if (!isEmailConfigured()) {
      return NextResponse.json(
        { error: { code: "EMAIL_NOT_CONFIGURED", message: "Email service is not configured" } },
        { status: 503 },
      );
    }

    const user = await prisma.user.findUnique({
      where: { id },
      select: { id: true, name: true, email: true, isEmailVerified: true, role: true },
    });

    if (!user || user.role !== "RESIDENT") {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Resident not found" } },
        { status: 404 },
      );
    }

    if (user.isEmailVerified) {
      return NextResponse.json(
        { error: { code: "ALREADY_VERIFIED", message: "Email is already verified" } },
        { status: 400 },
      );
    }

    // Admin bypass — no cooldown check
    await sendVerificationEmail(user.id, user.email, user.name);

    return NextResponse.json({ success: true, message: "Verification email sent" });
  } catch {
    return internalError("Failed to send verification email");
  }
}
