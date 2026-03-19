import { NextRequest, NextResponse } from "next/server";

import { internalError, notFoundError } from "@/lib/api-helpers";
import { APP_URL, ACCOUNT_SETUP_TOKEN_EXPIRY_HOURS } from "@/lib/constants";
import { sendEmail } from "@/lib/email";
import { getWelcomeSetupEmailHtml } from "@/lib/email-templates/welcome-setup";
import { prisma } from "@/lib/prisma";
import { generatePasswordResetToken } from "@/lib/tokens";

// POST /api/v1/residents/[id]/send-setup-email
// Generates a 7-day account-setup link and emails it to the resident.
// Used after bulk upload and by admin "Resend Setup Email" button.
export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;

    const user = await prisma.user.findUnique({
      where: { id },
      select: { id: true, name: true, email: true, society: { select: { name: true } } },
    });

    if (!user) return notFoundError("Resident not found");
    if (!user.email) {
      return NextResponse.json(
        { error: { code: "NO_EMAIL", message: "Resident has no email address" } },
        { status: 400 },
      );
    }

    const token = await generatePasswordResetToken(id, ACCOUNT_SETUP_TOKEN_EXPIRY_HOURS);
    const setupUrl = `${APP_URL}/reset-password?token=${token}`;
    const societyName = user.society?.name ?? "your society";

    await sendEmail(
      user.email,
      `Welcome to ${societyName} — Create your password`,
      getWelcomeSetupEmailHtml(user.name, societyName, setupUrl),
    );

    return NextResponse.json({ success: true, message: "Setup email sent" });
  } catch (err) {
    console.error("Send setup email error:", err);
    return internalError("Failed to send setup email");
  }
}
