import { NextRequest, NextResponse } from "next/server";

import { internalError, notFoundError, parseBody, unauthorizedError } from "@/lib/api-helpers";
import { logAudit } from "@/lib/audit";
import { getCurrentUser } from "@/lib/get-current-user";
import { prisma } from "@/lib/prisma";
import { closePetitionSchema } from "@/lib/validations/petition";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; petitionId: string }> },
) {
  try {
    const { id: societyId, petitionId } = await params;

    const admin = await getCurrentUser("RWA_ADMIN");
    if (!admin) return unauthorizedError("Admin authentication required");

    const petition = await prisma.petition.findUnique({ where: { id: petitionId } });
    if (!petition || petition.societyId !== societyId) return notFoundError("Petition not found");

    if (petition.status !== "PUBLISHED") {
      return NextResponse.json(
        { error: { code: "NOT_PUBLISHED", message: "Only PUBLISHED petitions can be closed" } },
        { status: 400 },
      );
    }

    const { data, error } = await parseBody(request, closePetitionSchema);
    if (error) return error;
    if (!data) return internalError();

    const updated = await prisma.petition.update({
      where: { id: petitionId },
      data: { status: "CLOSED", closedReason: data.reason },
      include: { creator: { select: { name: true } } },
    });

    void logAudit({
      actionType: "PETITION_CLOSED",
      userId: admin.userId,
      societyId,
      entityType: "Petition",
      entityId: petitionId,
      newValue: { reason: data.reason },
    });

    return NextResponse.json(updated);
  } catch {
    return internalError("Failed to close petition");
  }
}
