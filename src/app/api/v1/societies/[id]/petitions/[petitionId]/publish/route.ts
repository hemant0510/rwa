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

    if (petition.status !== "DRAFT") {
      return NextResponse.json(
        { error: { code: "NOT_DRAFT", message: "Only DRAFT petitions can be published" } },
        { status: 400 },
      );
    }

    if (!petition.documentUrl) {
      return NextResponse.json(
        {
          error: {
            code: "NO_DOCUMENT",
            message: "PDF document must be uploaded before publishing",
          },
        },
        { status: 400 },
      );
    }

    const updated = await prisma.petition.update({
      where: { id: petitionId },
      data: { status: "PUBLISHED", publishedAt: new Date() },
      include: { creator: { select: { name: true } } },
    });

    void logAudit({
      actionType: "PETITION_PUBLISHED",
      userId: admin.userId,
      societyId,
      entityType: "Petition",
      entityId: petitionId,
      newValue: { title: petition.title },
    });

    // TODO: Fan-out WhatsApp notification to all active residents

    return NextResponse.json(updated);
  } catch {
    return internalError("Failed to publish petition");
  }
}
