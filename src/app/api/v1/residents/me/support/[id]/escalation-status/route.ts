import {
  internalError,
  notFoundError,
  successResponse,
  unauthorizedError,
} from "@/lib/api-helpers";
import { getCurrentUser } from "@/lib/get-current-user";
import { prisma } from "@/lib/prisma";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const resident = await getCurrentUser("RESIDENT");
    if (!resident) return unauthorizedError("Resident authentication required");

    const { id: ticketId } = await params;

    const ticket = await prisma.residentTicket.findUnique({
      where: { id: ticketId, societyId: resident.societyId },
      select: { id: true, society: { select: { counsellorEscalationThreshold: true } } },
    });
    if (!ticket) return notFoundError("Ticket not found");

    const [voteCount, myVote, escalation] = await Promise.all([
      prisma.residentTicketEscalationVote.count({ where: { ticketId } }),
      prisma.residentTicketEscalationVote.findFirst({
        where: { ticketId, voterId: resident.userId },
        select: { id: true },
      }),
      prisma.residentTicketEscalation.findFirst({
        where: { ticketId, status: { not: "WITHDRAWN" } },
        select: { id: true },
      }),
    ]);

    return successResponse({
      ticketId,
      threshold: ticket.society.counsellorEscalationThreshold,
      voteCount,
      hasVoted: myVote !== null,
      escalationCreated: escalation !== null,
    });
  } catch (err) {
    console.error("[Resident Escalation Status GET]", err);
    return internalError();
  }
}
