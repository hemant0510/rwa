import { NextRequest, NextResponse } from "next/server";

import { z } from "zod";

import { internalError, notFoundError, unauthorizedError } from "@/lib/api-helpers";
import { logAudit } from "@/lib/audit";
import { getCurrentUser } from "@/lib/get-current-user";
import { prisma } from "@/lib/prisma";

type RouteParams = { params: Promise<{ id: string; petitionId: string }> };

const extendDeadlineSchema = z.object({
  deadline: z.string().nullable(),
});

// PATCH /api/v1/societies/[id]/petitions/[petitionId]/deadline
// Allows admins to update the deadline on PUBLISHED (or DRAFT) petitions.
// Only the deadline field is updated — no other fields.
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: societyId, petitionId } = await params;

    const admin = await getCurrentUser("RWA_ADMIN");
    if (!admin) return unauthorizedError("Admin authentication required");

    const petition = await prisma.petition.findUnique({ where: { id: petitionId } });
    if (!petition || petition.societyId !== societyId) return notFoundError("Petition not found");

    const allowed = ["DRAFT", "PUBLISHED"];
    if (!allowed.includes(petition.status)) {
      return NextResponse.json(
        {
          error: {
            code: "INVALID_STATUS",
            message: "Deadline can only be updated on DRAFT or PUBLISHED petitions",
          },
        },
        { status: 400 },
      );
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: { code: "INVALID_BODY", message: "Invalid JSON body" } },
        { status: 400 },
      );
    }

    const parsed = extendDeadlineSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "Invalid deadline value" } },
        { status: 400 },
      );
    }

    const { deadline } = parsed.data;

    const updated = await prisma.petition.update({
      where: { id: petitionId },
      data: { deadline: deadline ? new Date(deadline) : null },
      include: { creator: { select: { name: true } } },
    });

    void logAudit({
      actionType: "PETITION_UPDATED",
      userId: admin.userId,
      societyId,
      entityType: "Petition",
      entityId: petitionId,
      newValue: { deadline },
    });

    return NextResponse.json(updated);
  } catch {
    return internalError("Failed to update deadline");
  }
}
