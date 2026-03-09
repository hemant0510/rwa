import crypto from "crypto";

import {
  PASSWORD_RESET_TOKEN_EXPIRY_HOURS,
  VERIFICATION_TOKEN_EXPIRY_HOURS,
} from "@/lib/constants";
import { prisma } from "@/lib/prisma";

/**
 * Generate a verification token for a user.
 * Deletes any existing token for the same user before creating a new one.
 */
export async function generateVerificationToken(userId: string): Promise<string> {
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + VERIFICATION_TOKEN_EXPIRY_HOURS);

  // Remove any existing tokens for this user
  await prisma.emailVerificationToken.deleteMany({ where: { userId } });

  await prisma.emailVerificationToken.create({
    data: { userId, token, expiresAt },
  });

  return token;
}

/**
 * Validate a verification token.
 * Returns the userId if valid, null if invalid or expired.
 */
export async function validateVerificationToken(token: string): Promise<{ userId: string } | null> {
  const record = await prisma.emailVerificationToken.findUnique({
    where: { token },
  });

  if (!record) return null;
  if (new Date() > record.expiresAt) {
    // Token expired — clean it up
    await prisma.emailVerificationToken.delete({ where: { id: record.id } });
    return null;
  }

  return { userId: record.userId };
}

/**
 * Delete a verification token after successful verification.
 */
export async function deleteVerificationToken(token: string): Promise<void> {
  await prisma.emailVerificationToken.deleteMany({ where: { token } });
}

/**
 * Generate a password reset token for a user.
 * Deletes any existing reset token for the same user before creating a new one.
 */
export async function generatePasswordResetToken(userId: string): Promise<string> {
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + PASSWORD_RESET_TOKEN_EXPIRY_HOURS);

  await prisma.passwordResetToken.deleteMany({ where: { userId } });

  await prisma.passwordResetToken.create({
    data: { userId, token, expiresAt },
  });

  return token;
}

/**
 * Validate a password reset token.
 * Returns the userId if valid, null if invalid or expired.
 */
export async function validatePasswordResetToken(
  token: string,
): Promise<{ userId: string } | null> {
  const record = await prisma.passwordResetToken.findUnique({
    where: { token },
  });

  if (!record) return null;
  if (new Date() > record.expiresAt) {
    await prisma.passwordResetToken.delete({ where: { id: record.id } });
    return null;
  }

  return { userId: record.userId };
}

/**
 * Delete a password reset token after successful reset.
 */
export async function deletePasswordResetToken(token: string): Promise<void> {
  await prisma.passwordResetToken.deleteMany({ where: { token } });
}
