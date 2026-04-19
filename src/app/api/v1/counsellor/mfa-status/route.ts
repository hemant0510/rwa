import { z } from "zod";

import { forbiddenError, internalError, parseBody, successResponse } from "@/lib/api-helpers";
import { requireCounsellor } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";

const counsellorMfaStatusSchema = z.object({
  enrolled: z.boolean(),
});

export async function PATCH(request: Request) {
  const auth = await requireCounsellor();
  if (auth.error) return auth.error;
  if (auth.data.isSuperAdmin) {
    return forbiddenError("Super Admin cannot perform counsellor actions");
  }

  const { data, error } = await parseBody(request, counsellorMfaStatusSchema);
  if (error) return error;
  /* v8 ignore start */
  if (!data) return internalError();
  /* v8 ignore stop */

  try {
    await prisma.counsellor.update({
      where: { id: auth.data.counsellorId },
      data: { mfaEnrolledAt: data.enrolled ? new Date() : null },
    });

    return successResponse({ enrolled: data.enrolled });
  } catch {
    return internalError("Failed to update counsellor MFA status");
  }
}
