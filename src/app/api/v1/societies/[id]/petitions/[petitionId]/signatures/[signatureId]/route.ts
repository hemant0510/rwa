import { NextRequest, NextResponse } from "next/server";

import { internalError, notFoundError, unauthorizedError } from "@/lib/api-helpers";
import { logAudit } from "@/lib/audit";
import { getCurrentUser } from "@/lib/get-current-user";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";

type RouteParams = { params: Promise<{ id: string; petitionId: string; signatureId: string }> };

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: societyId, petitionId, signatureId } = await params;

    const admin = await getCurrentUser("RWA_ADMIN");
    if (!admin) return unauthorizedError("Admin authentication required");

    const petition = await prisma.petition.findUnique({ where: { id: petitionId } });
    if (!petition || petition.societyId !== societyId) return notFoundError("Petition not found");

    if (petition.status !== "PUBLISHED") {
      return NextResponse.json(
        { error: { code: "NOT_PUBLISHED", message: "Petition is not published" } },
        { status: 400 },
      );
    }

    const signature = await prisma.petitionSignature.findUnique({ where: { id: signatureId } });
    if (!signature || signature.petitionId !== petitionId) {
      return notFoundError("Signature not found");
    }

    const supabase = await createClient();
    await supabase.storage.from("petition-signatures").remove([signature.signatureUrl]);

    await prisma.petitionSignature.delete({ where: { id: signatureId } });

    void logAudit({
      actionType: "PETITION_SIGNATURE_REMOVED",
      userId: admin.userId,
      societyId,
      entityType: "PetitionSignature",
      entityId: signatureId,
      oldValue: { petitionId, userId: signature.userId },
    });

    return NextResponse.json({ message: "Signature removed" });
  } catch {
    return internalError("Failed to remove signature");
  }
}
