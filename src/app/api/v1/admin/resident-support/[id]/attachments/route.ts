import { type NextRequest, NextResponse } from "next/server";

import { errorResponse, forbiddenError, internalError, successResponse } from "@/lib/api-helpers";
import { logAudit } from "@/lib/audit";
import { getCurrentUser } from "@/lib/get-current-user";
import { prisma } from "@/lib/prisma";
import { createAdminClient } from "@/lib/supabase/admin";
import { ensureBucket } from "@/lib/supabase/ensure-bucket";
import {
  ALLOWED_ATTACHMENT_MIME_TYPES,
  MAX_ATTACHMENT_SIZE_BYTES,
} from "@/lib/validations/resident-support";

const BUCKET = "resident-ticket-attachments";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await getCurrentUser("RWA_ADMIN");
    if (!admin) return forbiddenError("Admin access required");

    const { id } = await params;

    const ticket = await prisma.residentTicket.findUnique({
      where: { id, societyId: admin.societyId },
      select: { id: true },
    });

    if (!ticket)
      return errorResponse({ code: "NOT_FOUND", message: "Ticket not found", status: 404 });

    const attachments = await prisma.residentTicketAttachment.findMany({
      where: { ticketId: id },
      orderBy: { createdAt: "asc" },
    });

    const supabaseAdmin = createAdminClient();
    const withSignedUrls = await Promise.all(
      attachments.map(async (att) => {
        const { data } = await supabaseAdmin.storage
          .from(BUCKET)
          .createSignedUrl(att.fileUrl, 60 * 60);
        return {
          id: att.id,
          ticketId: att.ticketId,
          messageId: att.messageId,
          fileName: att.fileName,
          mimeType: att.mimeType,
          fileSize: att.fileSize,
          signedUrl: data?.signedUrl ?? null,
          uploadedBy: att.uploadedBy,
          createdAt: att.createdAt,
        };
      }),
    );

    return successResponse(withSignedUrls);
  } catch (err) {
    console.error("[Admin Resident Support Attachments GET]", err);
    return internalError();
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await getCurrentUser("RWA_ADMIN");
    if (!admin) return forbiddenError("Admin access required");

    if (admin.adminPermission !== "FULL_ACCESS") {
      return forbiddenError("Full access required to upload attachments");
    }

    const { id } = await params;

    const ticket = await prisma.residentTicket.findUnique({
      where: { id, societyId: admin.societyId },
      select: { id: true, societyId: true },
    });

    if (!ticket)
      return errorResponse({ code: "NOT_FOUND", message: "Ticket not found", status: 404 });

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const messageId = formData.get("messageId") as string | null;

    if (!file) {
      return NextResponse.json({ error: { message: "No file provided" } }, { status: 400 });
    }

    if (
      !ALLOWED_ATTACHMENT_MIME_TYPES.includes(
        file.type as (typeof ALLOWED_ATTACHMENT_MIME_TYPES)[number],
      )
    ) {
      return NextResponse.json(
        { error: { message: "Invalid file type. Allowed: JPG, PNG, WebP, PDF." } },
        { status: 400 },
      );
    }

    if (file.size > MAX_ATTACHMENT_SIZE_BYTES) {
      return NextResponse.json(
        { error: { message: "File size exceeds 5MB limit." } },
        { status: 400 },
      );
    }

    const sanitizedName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const storagePath = `${ticket.societyId}/${id}/${Date.now()}-${sanitizedName}`;

    const supabaseAdmin = createAdminClient();
    await ensureBucket(supabaseAdmin, BUCKET);

    const arrayBuffer = await file.arrayBuffer();
    const { error: uploadError } = await supabaseAdmin.storage
      .from(BUCKET)
      .upload(storagePath, arrayBuffer, { contentType: file.type, upsert: false });

    if (uploadError) {
      console.error("Admin attachment upload error:", uploadError.message);
      return internalError(`Storage error: ${uploadError.message}`);
    }

    const attachment = await prisma.residentTicketAttachment.create({
      data: {
        ticketId: id,
        messageId: messageId || null,
        uploadedBy: admin.userId,
        fileName: file.name,
        fileUrl: storagePath,
        fileSize: file.size,
        mimeType: file.type,
      },
    });

    await logAudit({
      actionType: "RESIDENT_TICKET_ATTACHMENT_UPLOADED",
      userId: admin.userId,
      societyId: admin.societyId,
      entityType: "ResidentTicketAttachment",
      entityId: attachment.id,
    });

    return successResponse(attachment, 201);
  } catch (err) {
    console.error("[Admin Resident Support Attachment POST]", err);
    return internalError();
  }
}
