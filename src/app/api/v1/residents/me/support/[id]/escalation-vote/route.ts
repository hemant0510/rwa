import { Prisma } from "@prisma/client";

import {
  errorResponse,
  internalError,
  notFoundError,
  successResponse,
  unauthorizedError,
} from "@/lib/api-helpers";
import { logAudit } from "@/lib/audit";
import { maybeAutoEscalate } from "@/lib/counsellor/auto-escalate";
import { getCurrentUser } from "@/lib/get-current-user";
import { prisma } from "@/lib/prisma";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const resident = await getCurrentUser("RESIDENT");
    if (!resident) return unauthorizedError("Resident authentication required");

    const { id: ticketId } = await params;

    const ticket = await prisma.residentTicket.findUnique({
      where: { id: ticketId, societyId: resident.societyId },
      select: { id: true, status: true, createdBy: true },
    });
    if (!ticket) return notFoundError("Ticket not found");

    if (ticket.status === "CLOSED") {
      return errorResponse({
        code: "BAD_REQUEST",
        message: "Cannot vote on a closed ticket",
        status: 400,
      });
    }

    if (ticket.createdBy === resident.userId) {
      return errorResponse({
        code: "FORBIDDEN",
        message: "Ticket creator cannot vote to escalate their own ticket",
        status: 403,
      });
    }

    try {
      await prisma.residentTicketEscalationVote.create({
        data: { ticketId, voterId: resident.userId },
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        return errorResponse({
          code: "ALREADY_VOTED",
          message: "You have already voted to escalate this ticket",
          status: 409,
        });
      }
      throw err;
    }

    const outcome = await maybeAutoEscalate(ticketId);

    await logAudit({
      actionType: "TICKET_ESCALATION_VOTE_CAST",
      userId: resident.userId,
      societyId: resident.societyId,
      entityType: "ResidentTicket",
      entityId: ticketId,
      newValue: { escalationCreated: outcome.created },
    });

    const voteCount = await prisma.residentTicketEscalationVote.count({ where: { ticketId } });
    const society = await prisma.society.findUnique({
      where: { id: resident.societyId },
      select: { counsellorEscalationThreshold: true },
    });

    return successResponse(
      {
        voteCount,
        threshold: society?.counsellorEscalationThreshold ?? 10,
        hasVoted: true,
        escalationCreated: outcome.created,
      },
      201,
    );
  } catch (err) {
    console.error("[Resident Escalation Vote POST]", err);
    return internalError();
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const resident = await getCurrentUser("RESIDENT");
    if (!resident) return unauthorizedError("Resident authentication required");

    const { id: ticketId } = await params;

    const ticket = await prisma.residentTicket.findUnique({
      where: { id: ticketId, societyId: resident.societyId },
      select: { id: true },
    });
    if (!ticket) return notFoundError("Ticket not found");

    const deleted = await prisma.residentTicketEscalationVote.deleteMany({
      where: { ticketId, voterId: resident.userId, escalationId: null },
    });

    if (deleted.count === 0) {
      return errorResponse({
        code: "BAD_REQUEST",
        message: "No withdrawable vote found",
        status: 400,
      });
    }

    await logAudit({
      actionType: "TICKET_ESCALATION_VOTE_WITHDRAWN",
      userId: resident.userId,
      societyId: resident.societyId,
      entityType: "ResidentTicket",
      entityId: ticketId,
    });

    const voteCount = await prisma.residentTicketEscalationVote.count({ where: { ticketId } });
    const society = await prisma.society.findUnique({
      where: { id: resident.societyId },
      select: { counsellorEscalationThreshold: true },
    });

    return successResponse({
      voteCount,
      threshold: society?.counsellorEscalationThreshold ?? 10,
      hasVoted: false,
      escalationCreated: false,
    });
  } catch (err) {
    console.error("[Resident Escalation Vote DELETE]", err);
    return internalError();
  }
}
