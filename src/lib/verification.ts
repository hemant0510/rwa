import { APP_URL } from "@/lib/constants";
import { sendEmail, isEmailConfigured } from "@/lib/email";
import { getVerificationEmailHtml } from "@/lib/email-templates/verification";
import { prisma } from "@/lib/prisma";
import { generateVerificationToken } from "@/lib/tokens";

/**
 * Check if email verification is required for a society.
 * Returns false if SMTP is not configured (dev-friendly fallback).
 */
export async function isVerificationRequired(societyId: string): Promise<boolean> {
  if (!isEmailConfigured()) return false;

  const society = await prisma.society.findUnique({
    where: { id: societyId },
    select: { emailVerificationRequired: true },
  });

  return society?.emailVerificationRequired ?? true;
}

/**
 * Send a verification email to a user.
 * Generates a token and sends a branded email with a verification link.
 */
export async function sendVerificationEmail(
  userId: string,
  email: string,
  name: string,
): Promise<void> {
  const token = await generateVerificationToken(userId);
  const verificationUrl = `${APP_URL}/verify-email?token=${token}`;
  const html = getVerificationEmailHtml(name, verificationUrl);

  await sendEmail(email, "Verify your email — RWA Connect", html);
}

/**
 * Mark a user as verified if verification is not required.
 * Used when verification is disabled for a society.
 */
export async function autoVerifyUser(userId: string): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: { isEmailVerified: true },
  });
}
