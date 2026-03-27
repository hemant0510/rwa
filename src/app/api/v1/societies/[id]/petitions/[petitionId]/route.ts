import { NextRequest, NextResponse } from "next/server";

import { internalError, notFoundError, parseBody, unauthorizedError } from "@/lib/api-helpers";
import { logAudit } from "@/lib/audit";
import { getCurrentUser } from "@/lib/get-current-user";
import { prisma } from "@/lib/prisma";
import { createAdminClient } from "@/lib/supabase/admin";
import { updatePetitionSchema } from "@/lib/validations/petition";

type RouteParams = { params: Promise<{ id: string; petitionId: string }> };

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: societyId, petitionId } = await params;

    const petition = await prisma.petition.findUnique({
      where: { id: petitionId },
      include: {
        creator: { select: { name: true } },
        _count: { select: { signatures: true } },
      },
    });

    if (!petition || petition.societyId !== societyId) return notFoundError("Petition not found");

    let documentSignedUrl: string | null = null;
    if (petition.documentUrl) {
      const supabase = createAdminClient();
      const { data } = await supabase.storage
        .from("petition-docs")
        .createSignedUrl(petition.documentUrl, 60 * 60); // 1 hour
      documentSignedUrl = data?.signedUrl ?? null;
    }

    return NextResponse.json({
      ...petition,
      signatureCount: petition._count.signatures,
      documentSignedUrl,
    });
  } catch {
    return internalError("Failed to fetch petition");
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: societyId, petitionId } = await params;

    const admin = await getCurrentUser("RWA_ADMIN");
    if (!admin) return unauthorizedError("Admin authentication required");

    const petition = await prisma.petition.findUnique({ where: { id: petitionId } });
    if (!petition || petition.societyId !== societyId) return notFoundError("Petition not found");

    if (petition.status !== "DRAFT") {
      return NextResponse.json(
        { error: { code: "NOT_DRAFT", message: "Only DRAFT petitions can be edited" } },
        { status: 400 },
      );
    }

    const { data, error } = await parseBody(request, updatePetitionSchema);
    if (error) return error;
    if (!data) return internalError();

    const updated = await prisma.petition.update({
      where: { id: petitionId },
      data: {
        ...(data.title !== undefined && { title: data.title }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.type !== undefined && { type: data.type }),
        ...(data.targetAuthority !== undefined && { targetAuthority: data.targetAuthority }),
        ...(data.minSignatures !== undefined && { minSignatures: data.minSignatures }),
        ...(data.deadline !== undefined && {
          deadline: data.deadline ? new Date(data.deadline) : null,
        }),
      },
      include: { creator: { select: { name: true } } },
    });

    void logAudit({
      actionType: "PETITION_UPDATED",
      userId: admin.userId,
      societyId,
      entityType: "Petition",
      entityId: petitionId,
      newValue: JSON.parse(JSON.stringify(data)),
    });

    return NextResponse.json(updated);
  } catch {
    return internalError("Failed to update petition");
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: societyId, petitionId } = await params;

    const admin = await getCurrentUser("RWA_ADMIN");
    if (!admin) return unauthorizedError("Admin authentication required");

    const petition = await prisma.petition.findUnique({ where: { id: petitionId } });
    if (!petition || petition.societyId !== societyId) return notFoundError("Petition not found");

    if (petition.status !== "DRAFT") {
      return NextResponse.json(
        { error: { code: "NOT_DRAFT", message: "Only DRAFT petitions can be deleted" } },
        { status: 400 },
      );
    }

    if (petition.documentUrl) {
      const supabase = createAdminClient();
      await supabase.storage.from("petition-docs").remove([petition.documentUrl]);
    }

    await prisma.petition.delete({ where: { id: petitionId } });

    void logAudit({
      actionType: "PETITION_DELETED",
      userId: admin.userId,
      societyId,
      entityType: "Petition",
      entityId: petitionId,
      oldValue: { title: petition.title },
    });

    return NextResponse.json({ message: "Petition deleted" });
  } catch {
    return internalError("Failed to delete petition");
  }
}
