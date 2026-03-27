import { NextRequest, NextResponse } from "next/server";

import { internalError, notFoundError, unauthorizedError } from "@/lib/api-helpers";
import { logAudit } from "@/lib/audit";
import { getCurrentUser } from "@/lib/get-current-user";
import { prisma } from "@/lib/prisma";

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
        { error: { code: "NOT_PUBLISHED", message: "Only PUBLISHED petitions can be submitted" } },
        { status: 400 },
      );
    }

    const updated = await prisma.petition.update({
      where: { id: petitionId },
      data: { status: "SUBMITTED", submittedAt: new Date() },
      include: { creator: { select: { name: true } } },
    });

    void logAudit({
      actionType: "PETITION_SUBMITTED",
      userId: admin.userId,
      societyId,
      entityType: "Petition",
      entityId: petitionId,
      newValue: { title: petition.title },
    });

    // TODO: Fan-out WhatsApp notification to petition signatories

    return NextResponse.json(updated);
  } catch {
    return internalError("Failed to submit petition");
  }
}
