import { type NextRequest, NextResponse } from "next/server";

import { internalError, notFoundError, successResponse } from "@/lib/api-helpers";
import { requireSuperAdmin } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";

type RouteParams = { params: Promise<{ id: string; pid: string }> };

export async function GET(_req: NextRequest, { params }: RouteParams) {
  const auth = await requireSuperAdmin();
  if (auth.error) return auth.error as NextResponse;

  try {
    const { id: societyId, pid } = await params;

    const [petition, signatories] = await Promise.all([
      prisma.petition.findUnique({
        where: { id: pid },
        include: {
          creator: { select: { name: true } },
          _count: { select: { signatures: true } },
        },
      }),
      prisma.petitionSignature.findMany({
        where: { petitionId: pid },
        include: { user: { select: { name: true, mobile: true } } },
        orderBy: { signedAt: "asc" },
        take: 100,
      }),
    ]);

    if (!petition || petition.societyId !== societyId) return notFoundError("Petition not found");

    return successResponse({
      ...petition,
      signatureCount: petition._count.signatures,
      signatories,
    });
  } catch (err) {
    console.error("[SA Petition Detail]", err);
    return internalError();
  }
}
