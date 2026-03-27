import { NextRequest, NextResponse } from "next/server";

import ReactPDF from "@react-pdf/renderer";

import { PetitionReportDocument } from "@/app/api/v1/societies/[id]/reports/report-document";
import { internalError, notFoundError, unauthorizedError } from "@/lib/api-helpers";
import { getCurrentUser } from "@/lib/get-current-user";
import { prisma } from "@/lib/prisma";

type RouteParams = { params: Promise<{ id: string; petitionId: string }> };

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { id: societyId, petitionId } = await params;

    const admin = await getCurrentUser("RWA_ADMIN");
    if (!admin) return unauthorizedError("Admin authentication required");

    const [petition, society] = await Promise.all([
      prisma.petition.findUnique({
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
      }),
      prisma.society.findUnique({
        where: { id: societyId },
        select: { name: true },
      }),
    ]);

    if (!petition || petition.societyId !== societyId) return notFoundError("Petition not found");
    if (!society) return notFoundError("Society not found");

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

    const generatedAt = new Date().toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });

    const stream = await ReactPDF.renderToStream(
      PetitionReportDocument({
        societyName: society.name,
        generatedAt,
        petition: {
          title: petition.title,
          description: petition.description,
          type: petition.type,
          targetAuthority: petition.targetAuthority,
          submittedAt: petition.submittedAt,
        },
        signatories: signatures.map((s) => ({
          name: s.user.name,
          unit: s.user.userUnits[0]?.unit.displayLabel ?? "—",
          method: s.method,
          signedAt: s.signedAt,
        })),
      }),
    );

    const chunks: Uint8Array[] = [];
    for await (const chunk of stream) {
      chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
    }
    const pdfBuffer = Buffer.concat(chunks);

    const safeTitle = petition.title.replace(/[^a-z0-9]/gi, "-").toLowerCase();

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="petition-report-${safeTitle}.pdf"`,
      },
    });
  } catch {
    return internalError("Failed to generate petition report");
  }
}
