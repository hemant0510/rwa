import { type NextRequest } from "next/server";

import {
  internalError,
  successResponse,
  unauthorizedError,
  validationError,
} from "@/lib/api-helpers";
import { logAudit } from "@/lib/audit";
import { getCurrentUser } from "@/lib/get-current-user";
import { prisma } from "@/lib/prisma";
import { createResidentTicketSchema } from "@/lib/validations/resident-support";
import { sendResidentTicketCreated } from "@/lib/whatsapp";

export async function GET(req: NextRequest) {
  try {
    const resident = await getCurrentUser("RESIDENT");
    if (!resident) return unauthorizedError("Resident authentication required");

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const type = searchParams.get("type");
    const mine = searchParams.get("mine") === "true";
    const page = Math.max(1, Number(searchParams.get("page") ?? "1"));
    const limit = Math.min(Number(searchParams.get("limit") ?? "20"), 50);

    const where: Record<string, unknown> = { societyId: resident.societyId };
    if (status) where.status = status;
    if (type) where.type = type;
    if (mine) where.createdBy = resident.userId;

    const [data, total] = await Promise.all([
      prisma.residentTicket.findMany({
        where,
        orderBy: { updatedAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          createdByUser: { select: { name: true } },
          _count: { select: { messages: true, attachments: true } },
        },
      }),
      prisma.residentTicket.count({ where }),
    ]);

    return successResponse({ tickets: data, total, page, pageSize: limit });
  } catch (err) {
    console.error("[Resident Support GET]", err);
    return internalError();
  }
}

export async function POST(request: Request) {
  try {
    const resident = await getCurrentUser("RESIDENT");
    if (!resident) return unauthorizedError("Resident authentication required");

    const body = await request.json();
    const parsed = createResidentTicketSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error);

    const ticket = await prisma.residentTicket.create({
      data: {
        ...parsed.data,
        societyId: resident.societyId,
        createdBy: resident.userId,
      },
    });

    await logAudit({
      actionType: "RESIDENT_TICKET_CREATED",
      userId: resident.userId,
      societyId: resident.societyId,
      entityType: "ResidentTicket",
      entityId: ticket.id,
      newValue: { type: parsed.data.type, subject: parsed.data.subject },
    });

    // Notify all society admins with WhatsApp consent (fire-and-forget)
    void prisma.user
      .findMany({
        where: {
          societyId: resident.societyId,
          role: "RWA_ADMIN",
          mobile: { not: null },
          consentWhatsapp: true,
        },
        select: { name: true, mobile: true },
      })
      .then((admins) => {
        for (const admin of admins) {
          /* v8 ignore start */
          if (admin.mobile) {
            void sendResidentTicketCreated(
              admin.mobile,
              resident.name,
              parsed.data.subject,
              parsed.data.type,
            );
          }
          /* v8 ignore stop */
        }
      });

    return successResponse(ticket, 201);
  } catch (err) {
    console.error("[Resident Support POST]", err);
    return internalError();
  }
}
