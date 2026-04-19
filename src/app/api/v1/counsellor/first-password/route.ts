import { z } from "zod";

import {
  errorResponse,
  forbiddenError,
  internalError,
  parseBody,
  successResponse,
} from "@/lib/api-helpers";
import { requireCounsellor } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { createAdminClient } from "@/lib/supabase/admin";

const firstPasswordSchema = z.object({
  password: z.string().min(8, "Password must be at least 8 characters."),
});

/**
 * Sets the counsellor's password for the first time and marks `passwordSetAt`
 * in a single atomic call.
 *
 * Uses `admin.updateUserById` instead of a client-side `auth.updateUser` so
 * Supabase's "new password must differ from current" check can't reject the
 * user's first real password choice (the account was created with a random
 * temp password they don't know).
 */
export async function POST(request: Request) {
  const auth = await requireCounsellor();
  if (auth.error) return auth.error;
  if (auth.data.isSuperAdmin) {
    return forbiddenError("Super Admin cannot perform counsellor actions");
  }

  const { data, error } = await parseBody(request, firstPasswordSchema);
  if (error) return error;
  /* v8 ignore start */
  if (!data) return internalError();
  /* v8 ignore stop */

  const admin = createAdminClient();
  const { error: pwError } = await admin.auth.admin.updateUserById(auth.data.authUserId, {
    password: data.password,
  });
  if (pwError) {
    return errorResponse({
      code: "PASSWORD_UPDATE_FAILED",
      message: pwError.message ?? "Failed to update password.",
      status: 400,
    });
  }

  try {
    await prisma.counsellor.update({
      where: { id: auth.data.counsellorId },
      data: { passwordSetAt: new Date() },
    });
  } catch {
    return internalError("Password set, but failed to finalize account setup.");
  }

  return successResponse({ passwordSet: true });
}
