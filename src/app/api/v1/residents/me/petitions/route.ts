import { NextRequest, NextResponse } from "next/server";

import { internalError, unauthorizedError } from "@/lib/api-helpers";
import { getCurrentUser } from "@/lib/get-current-user";
import { prisma } from "@/lib/prisma";

export async function GET(_request: NextRequest) {
  try {
    const resident = await getCurrentUser("RESIDENT");
    if (!resident) return unauthorizedError("Resident authentication required");

    const petitions = await prisma.petition.findMany({
      where: {
        societyId: resident.societyId,
        status: { in: ["PUBLISHED", "SUBMITTED"] },
      },
      orderBy: { createdAt: "desc" },
      include: {
        _count: { select: { signatures: true } },
        signatures: {
          where: { userId: resident.userId },
          select: { id: true, method: true, signedAt: true },
          take: 1,
        },
      },
    });

    const data = petitions.map((petition) => ({
      ...petition,
      mySignature: petition.signatures[0] ?? null,
      signatures: undefined,
    }));

    return NextResponse.json({ data });
  } catch {
    return internalError("Failed to fetch petitions");
  }
}
