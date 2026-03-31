import { type NextRequest, NextResponse } from "next/server";

import ReactPDF from "@react-pdf/renderer";

import { PetitionReportDocument } from "@/app/api/v1/societies/[id]/reports/report-document";
import { internalError, notFoundError, successResponse } from "@/lib/api-helpers";
import { requireSuperAdmin } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";

type RouteParams = { params: Promise<{ id: string; pid: string }> };

export async function GET(_req: NextRequest, { params }: RouteParams) {
  const auth = await requireSuperAdmin();
  if (auth.error) return auth.error as NextResponse;

  try {
    const { id: societyId, pid } = await params;

    const [petition, society] = await Promise.all([
      prisma.petition.findUnique({
        where: { id: pid },
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
      return successResponse(
        { error: { code: "NO_SIGNATURES", message: "Petition has no signatures" } },
        400,
      );
    }

    const signatures = await prisma.petitionSignature.findMany({
      where: { petitionId: pid },
      include: {
        user: {
          select: {
            name: true,
            userUnits: { select: { unit: { select: { displayLabel: true } } }, take: 1 },
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
  } catch (err) {
    console.error("[SA Petition Report]", err);
    return internalError();
  }
}
