import { NextRequest, NextResponse } from "next/server";

import { internalError, notFoundError, unauthorizedError } from "@/lib/api-helpers";
import { getCurrentUser } from "@/lib/get-current-user";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";

type RouteParams = { params: Promise<{ petitionId: string }> };

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { petitionId } = await params;

    const resident = await getCurrentUser("RESIDENT");
    if (!resident) return unauthorizedError("Resident authentication required");

    const petition = await prisma.petition.findUnique({
      where: { id: petitionId },
      include: {
        _count: { select: { signatures: true } },
        signatures: {
          where: { userId: resident.userId },
          select: { id: true, method: true, signedAt: true },
          take: 1,
        },
      },
    });

    if (!petition || petition.societyId !== resident.societyId) {
      return notFoundError("Petition not found");
    }

    if (petition.status !== "PUBLISHED" && petition.status !== "SUBMITTED") {
      return notFoundError("Petition not found");
    }

    const supabase = await createClient();
    let documentSignedUrl: string | null = null;
    if (petition.documentUrl) {
      const { data: urlData } = await supabase.storage
        .from("petition-docs")
        .createSignedUrl(petition.documentUrl, 3600);
      documentSignedUrl = urlData?.signedUrl ?? null;
    }

    return NextResponse.json({
      ...petition,
      signatureCount: petition._count.signatures,
      documentSignedUrl,
      mySignature: petition.signatures[0] ?? null,
      signatures: undefined,
    });
  } catch {
    return internalError("Failed to fetch petition");
  }
}
