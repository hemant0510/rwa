import { NextResponse } from "next/server";

import { errorResponse, internalError, successResponse, validationError } from "@/lib/api-helpers";
import { requireSuperAdmin } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { createMessageSchema } from "@/lib/validations/support";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireSuperAdmin();
  if (auth.error) return auth.error as NextResponse;

  try {
    const { id } = await params;

    const serviceRequest = await prisma.serviceRequest.findUnique({
      where: { id },
      select: { id: true, status: true },
    });

    if (!serviceRequest)
      return errorResponse({ code: "NOT_FOUND", message: "Request not found", status: 404 });

    if (serviceRequest.status === "CLOSED")
      return errorResponse({
        code: "BAD_REQUEST",
        message: "Cannot post message to a closed request",
        status: 400,
      });

    const body = await request.json();
    const parsed = createMessageSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error);

    const message = await prisma.serviceRequestMessage.create({
      data: {
        requestId: id,
        authorId: auth.data!.superAdminId,
        authorRole: "SUPER_ADMIN",
        content: parsed.data.content,
        isInternal: parsed.data.isInternal,
      },
    });

    // Only update status for non-internal messages
    if (!parsed.data.isInternal && serviceRequest.status !== "AWAITING_ADMIN") {
      await prisma.serviceRequest.update({
        where: { id },
        data: { status: "AWAITING_ADMIN" },
      });
    }

    return successResponse(message, 201);
  } catch (err) {
    console.error("[SA Support Message POST]", err);
    return internalError();
  }
}
