import { NextRequest, NextResponse } from "next/server";

import { internalError, notFoundError, parseBody, unauthorizedError } from "@/lib/api-helpers";
import { logAudit } from "@/lib/audit";
import { getCurrentUser } from "@/lib/get-current-user";
import { prisma } from "@/lib/prisma";
import { createAdminClient } from "@/lib/supabase/admin";
import { ensureBucket } from "@/lib/supabase/ensure-bucket";
import { signPetitionSchema } from "@/lib/validations/petition";

type RouteParams = { params: Promise<{ petitionId: string }> };

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { petitionId } = await params;

    const resident = await getCurrentUser("RESIDENT");
    if (!resident) return unauthorizedError("Resident authentication required");

    const petition = await prisma.petition.findUnique({ where: { id: petitionId } });
    if (!petition || petition.societyId !== resident.societyId) {
      return notFoundError("Petition not found");
    }

    if (petition.status !== "PUBLISHED") {
      return NextResponse.json(
        { error: { code: "NOT_PUBLISHED", message: "Petition is not accepting signatures" } },
        { status: 400 },
      );
    }

    const existing = await prisma.petitionSignature.findUnique({
      where: { petitionId_userId: { petitionId, userId: resident.userId } },
    });

    if (existing) {
      return NextResponse.json(
        { error: { code: "ALREADY_SIGNED", message: "You have already signed this petition" } },
        { status: 409 },
      );
    }

    const { data, error } = await parseBody(request, signPetitionSchema);
    if (error) return error;
    if (!data) return internalError();

    const base64Data = data.signatureDataUrl.split(",")[1];
    const buffer = Buffer.from(base64Data, "base64");

    const path = `${resident.societyId}/${petitionId}/${resident.userId}.png`;
    const supabase = createAdminClient();
    await ensureBucket(supabase, "petition-signatures");
    const { error: uploadError } = await supabase.storage
      .from("petition-signatures")
      .upload(path, buffer, { contentType: "image/png", upsert: true });

    if (uploadError) {
      return internalError(`Failed to upload signature: ${uploadError.message}`);
    }

    const signature = await prisma.petitionSignature.create({
      data: {
        petitionId,
        userId: resident.userId,
        societyId: resident.societyId,
        method: data.method,
        signatureUrl: path,
      },
    });

    void logAudit({
      actionType: "PETITION_SIGNED",
      userId: resident.userId,
      societyId: resident.societyId,
      entityType: "PetitionSignature",
      entityId: signature.id,
      newValue: { petitionId, method: data.method },
    });

    return NextResponse.json({ signedAt: signature.signedAt }, { status: 201 });
  } catch {
    return internalError("Failed to sign petition");
  }
}
