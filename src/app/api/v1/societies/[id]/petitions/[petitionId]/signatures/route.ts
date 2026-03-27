import { NextRequest, NextResponse } from "next/server";

import { internalError, notFoundError } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";
import { createAdminClient } from "@/lib/supabase/admin";

type RouteParams = { params: Promise<{ id: string; petitionId: string }> };

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: societyId, petitionId } = await params;
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "50");

    const petition = await prisma.petition.findUnique({ where: { id: petitionId } });
    if (!petition || petition.societyId !== societyId) return notFoundError("Petition not found");

    const [signatures, total] = await Promise.all([
      prisma.petitionSignature.findMany({
        where: { petitionId },
        orderBy: { signedAt: "asc" },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          user: {
            select: {
              name: true,
              email: true,
              mobile: true,
              userUnits: {
                select: { unit: { select: { displayLabel: true } } },
                take: 1,
              },
            },
          },
        },
      }),
      prisma.petitionSignature.count({ where: { petitionId } }),
    ]);

    const supabase = createAdminClient();

    const data = await Promise.all(
      signatures.map(async (sig) => {
        const { data: urlData } = await supabase.storage
          .from("petition-signatures")
          .createSignedUrl(sig.signatureUrl, 3600);
        return {
          ...sig,
          signatureUrl: urlData?.signedUrl ?? sig.signatureUrl,
        };
      }),
    );

    return NextResponse.json({ data, total, page, limit });
  } catch {
    return internalError("Failed to fetch signatures");
  }
}
