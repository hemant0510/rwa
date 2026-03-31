import { NextRequest, NextResponse } from "next/server";

import { internalError, notFoundError, unauthorizedError } from "@/lib/api-helpers";
import { logAudit } from "@/lib/audit";
import { getCurrentUser } from "@/lib/get-current-user";
import { prisma } from "@/lib/prisma";
import { createAdminClient } from "@/lib/supabase/admin";
import { ensureBucket } from "@/lib/supabase/ensure-bucket";

// Allowed upload types
const ALLOWED_TYPES: Record<string, { ext: string; contentType: string }> = {
  "application/pdf": { ext: "pdf", contentType: "application/pdf" },
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": {
    ext: "docx",
    contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  },
};

function getContentTypeFromPath(path: string): string {
  if (path.endsWith(".docx")) {
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  }
  return "application/pdf";
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; petitionId: string }> },
) {
  try {
    const { id: societyId, petitionId } = await params;

    const user = await getCurrentUser();
    if (!user) return unauthorizedError("Authentication required");

    const petition = await prisma.petition.findUnique({ where: { id: petitionId } });
    if (!petition || petition.societyId !== societyId) return notFoundError("Petition not found");
    if (!petition.documentUrl) return notFoundError("No document attached");

    const supabase = createAdminClient();
    const { data, error } = await supabase.storage
      .from("petition-docs")
      .download(petition.documentUrl);

    if (error || !data) return internalError("Failed to retrieve document");

    const buffer = Buffer.from(await data.arrayBuffer());
    const contentType = getContentTypeFromPath(petition.documentUrl);

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": "inline",
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch {
    return internalError("Failed to serve petition document");
  }
}

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

    const blob = file as Blob;
    const fileType = ALLOWED_TYPES[blob.type];
    if (!fileType) {
      return NextResponse.json(
        {
          error: {
            code: "INVALID_TYPE",
            message: "Only PDF and DOCX files are allowed",
          },
        },
        { status: 400 },
      );
    }

    const supabase = createAdminClient();
    await ensureBucket(supabase, "petition-docs");

    if (petition.documentUrl) {
      await supabase.storage.from("petition-docs").remove([petition.documentUrl]);
    }

    const path = `${societyId}/${petitionId}/${Date.now()}.${fileType.ext}`;
    const buffer = Buffer.from(await blob.arrayBuffer());
    const { error: uploadError } = await supabase.storage
      .from("petition-docs")
      .upload(path, buffer, { contentType: fileType.contentType, upsert: false });

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
