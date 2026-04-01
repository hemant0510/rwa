import { NextResponse } from "next/server";

import { errorResponse, internalError, successResponse, validationError } from "@/lib/api-helpers";
import { requireSuperAdmin } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { changeStatusSchema, isValidTransition } from "@/lib/validations/support";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
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

    const body = await request.json();
    const parsed = changeStatusSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error);

    const { status: newStatus, reason } = parsed.data;

    if (!isValidTransition(serviceRequest.status, newStatus)) {
      return errorResponse({
        code: "BAD_REQUEST",
        message: `Cannot transition from ${serviceRequest.status} to ${newStatus}`,
        status: 400,
      });
    }

    // Closing requires a reason if there are no prior messages
    if (newStatus === "CLOSED" && !reason) {
      const msgCount = await prisma.serviceRequestMessage.count({
        where: { requestId: id },
      });
      if (msgCount === 0) {
        return errorResponse({
          code: "VALIDATION_ERROR",
          message: "Reason is required when closing a request with no messages",
          status: 422,
        });
      }
    }

    const updateData: Record<string, unknown> = { status: newStatus };
    if (newStatus === "RESOLVED") updateData.resolvedAt = new Date();
    if (newStatus === "CLOSED") {
      updateData.closedAt = new Date();
      if (reason) updateData.closedReason = reason;
    }

    const updated = await prisma.serviceRequest.update({
      where: { id },
      data: updateData,
    });

    return successResponse(updated);
  } catch (err) {
    console.error("[SA Support Status PATCH]", err);
    return internalError();
  }
}
