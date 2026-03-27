import { NextRequest, NextResponse } from "next/server";

import { internalError, notFoundError, unauthorizedError } from "@/lib/api-helpers";
import { logAudit } from "@/lib/audit";
import { getCurrentUser } from "@/lib/get-current-user";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; petitionId: string }> },
) {
  try {
    const { id: societyId, petitionId } = await params;

    const admin = await getCurrentUser("RWA_ADMIN");
    if (!admin) return unauthorizedError("Admin authentication required");

    const petition = await prisma.petition.findUnique({ where: { id: petitionId } });
    if (!petition || petition.societyId !== societyId) return notFoundError("Petition not found");

    if (petition.status !== "DRAFT") {
      return NextResponse.json(
        {
          error: { code: "NOT_DRAFT", message: "Only DRAFT petitions can have documents uploaded" },
        },
        { status: 400 },
      );
    }

    const formData = await request.formData();
    const file = formData.get("file");

    if (!file) {
      return NextResponse.json(
        { error: { code: "NO_FILE", message: "No file provided" } },
        { status: 400 },
      );
    }

    if (typeof file === "string") {
      return NextResponse.json(
        { error: { code: "INVALID_FILE", message: "Invalid file provided" } },
        { status: 400 },
      );
    }

    const supabase = await createClient();

    if (petition.documentUrl) {
      await supabase.storage.from("petition-docs").remove([petition.documentUrl]);
    }

    const path = `${societyId}/${petitionId}/${Date.now()}.pdf`;
    const buffer = Buffer.from(await (file as Blob).arrayBuffer());
    const { error: uploadError } = await supabase.storage
      .from("petition-docs")
      .upload(path, buffer, { contentType: "application/pdf", upsert: false });

    if (uploadError) {
      return internalError(`Storage error: ${uploadError.message}`);
    }

    await prisma.petition.update({
      where: { id: petitionId },
      data: { documentUrl: path },
    });

    void logAudit({
      actionType: "PETITION_DOCUMENT_UPLOADED",
      userId: admin.userId,
      societyId,
      entityType: "Petition",
      entityId: petitionId,
      newValue: { documentUrl: path },
    });

    return NextResponse.json({ documentUrl: path });
  } catch {
    return internalError("Failed to upload petition document");
  }
}
