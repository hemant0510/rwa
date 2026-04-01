import {
  errorResponse,
  forbiddenError,
  internalError,
  successResponse,
  validationError,
} from "@/lib/api-helpers";
import { getCurrentUser } from "@/lib/get-current-user";
import { prisma } from "@/lib/prisma";
import { createMessageSchema } from "@/lib/validations/support";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser("RWA_ADMIN");
    if (!user) return forbiddenError("Admin access required");

    const { id } = await params;

    const serviceRequest = await prisma.serviceRequest.findUnique({
      where: { id, societyId: user.societyId },
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
        authorId: user.userId,
        authorRole: "ADMIN",
        content: parsed.data.content,
      },
    });

    // Update status to AWAITING_SA when admin replies
    if (serviceRequest.status !== "AWAITING_SA") {
      await prisma.serviceRequest.update({
        where: { id },
        data: { status: "AWAITING_SA" },
      });
    }

    return successResponse(message, 201);
  } catch (err) {
    console.error("[Admin Support Message POST]", err);
    return internalError();
  }
}
