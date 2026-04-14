import { NextRequest } from "next/server";

import { internalError, parseBody, successResponse } from "@/lib/api-helpers";
import { requireCounsellor } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { updateCounsellorSelfSchema } from "@/lib/validations/counsellor";

export async function GET() {
  const auth = await requireCounsellor();
  if (auth.error) return auth.error;

  try {
    const counsellor = await prisma.counsellor.findUnique({
      where: { id: auth.data.counsellorId },
      select: {
        id: true,
        authUserId: true,
        email: true,
        mobile: true,
        name: true,
        nationalId: true,
        photoUrl: true,
        bio: true,
        publicBlurb: true,
        isActive: true,
        mfaRequired: true,
        mfaEnrolledAt: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    /* v8 ignore start */
    if (!counsellor) return internalError("Counsellor not found");
    /* v8 ignore stop */

    // Best-effort lastLoginAt update on each /me fetch (cheap heartbeat).
    void prisma.counsellor
      .update({ where: { id: counsellor.id }, data: { lastLoginAt: new Date() } })
      .catch(() => undefined);

    return successResponse(counsellor);
  } catch {
    return internalError("Failed to fetch counsellor profile");
  }
}

export async function PATCH(request: NextRequest) {
  const auth = await requireCounsellor();
  if (auth.error) return auth.error;

  const { data, error } = await parseBody(request, updateCounsellorSelfSchema);
  if (error) return error;
  /* v8 ignore start */
  if (!data) return internalError();
  /* v8 ignore stop */

  try {
    const updated = await prisma.counsellor.update({
      where: { id: auth.data.counsellorId },
      data,
      select: {
        id: true,
        name: true,
        email: true,
        mobile: true,
        bio: true,
        publicBlurb: true,
        photoUrl: true,
      },
    });

    return successResponse(updated);
  } catch {
    return internalError("Failed to update counsellor profile");
  }
}
