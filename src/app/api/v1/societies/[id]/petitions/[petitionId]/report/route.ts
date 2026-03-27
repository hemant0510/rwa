import { NextRequest, NextResponse } from "next/server";

import { internalError, notFoundError } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";

type RouteParams = { params: Promise<{ id: string; petitionId: string }> };

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: societyId, petitionId } = await params;

    const petition = await prisma.petition.findUnique({
      where: { id: petitionId },
      select: {
        id: true,
        title: true,
        description: true,
        type: true,
        targetAuthority: true,
        submittedAt: true,
        societyId: true,
        _count: { select: { signatures: true } },
      },
    });

    if (!petition || petition.societyId !== societyId) return notFoundError("Petition not found");

    if (petition._count.signatures === 0) {
      return NextResponse.json(
        { error: { code: "NO_SIGNATURES", message: "Petition has no signatures" } },
        { status: 400 },
      );
    }

    const signatures = await prisma.petitionSignature.findMany({
      where: { petitionId },
      include: {
        user: {
          select: {
            name: true,
            userUnits: {
              select: { unit: { select: { displayLabel: true } } },
              take: 1,
            },
          },
        },
      },
      orderBy: { signedAt: "asc" },
    });

    return NextResponse.json({
      petition: {
        title: petition.title,
        description: petition.description,
        type: petition.type,
        targetAuthority: petition.targetAuthority,
        submittedAt: petition.submittedAt,
      },
      totalSignatures: signatures.length,
      signatories: signatures.map((s) => ({
        name: s.user.name,
        unit: s.user.userUnits[0]?.unit.displayLabel ?? "—",
        method: s.method,
        signedAt: s.signedAt,
        signatureUrl: s.signatureUrl,
      })),
    });
  } catch {
    return internalError("Failed to generate petition report");
  }
}
