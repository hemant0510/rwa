import { Prisma } from "@prisma/client";

import { computeSlaDeadline } from "@/lib/counsellor/sla";
import { prisma } from "@/lib/prisma";

export type AutoEscalationOutcome =
  | { created: true; escalationId: string; counsellorId: string }
  | { created: false; reason: "THRESHOLD_NOT_MET" | "ALREADY_ESCALATED" | "NO_COUNSELLOR" };

export async function maybeAutoEscalate(ticketId: string): Promise<AutoEscalationOutcome> {
  const ticket = await prisma.residentTicket.findUnique({
    where: { id: ticketId },
    select: {
      id: true,
      societyId: true,
      society: { select: { counsellorEscalationThreshold: true } },
    },
  });

  if (!ticket) return { created: false, reason: "NO_COUNSELLOR" };

  const threshold = ticket.society.counsellorEscalationThreshold;
  const [voteCount, existingEscalation] = await Promise.all([
    prisma.residentTicketEscalationVote.count({ where: { ticketId } }),
    prisma.residentTicketEscalation.findFirst({
      where: { ticketId, status: { not: "WITHDRAWN" } },
      select: { id: true },
    }),
  ]);

  if (existingEscalation) return { created: false, reason: "ALREADY_ESCALATED" };
  if (voteCount < threshold) return { created: false, reason: "THRESHOLD_NOT_MET" };

  const assignment = await prisma.counsellorSocietyAssignment.findFirst({
    where: { societyId: ticket.societyId, isActive: true },
    orderBy: [{ isPrimary: "desc" }, { assignedAt: "asc" }],
    select: { counsellorId: true },
  });

  if (!assignment) return { created: false, reason: "NO_COUNSELLOR" };

  try {
    const escalation = await prisma.$transaction(async (tx) => {
      const now = new Date();
      const created = await tx.residentTicketEscalation.create({
        data: {
          ticketId,
          counsellorId: assignment.counsellorId,
          source: "RESIDENT_VOTE",
          status: "PENDING",
          slaDeadline: computeSlaDeadline(now),
        },
        select: { id: true },
      });
      await tx.residentTicketEscalationVote.updateMany({
        where: { ticketId, escalationId: null },
        data: { escalationId: created.id },
      });
      return created;
    });

    return { created: true, escalationId: escalation.id, counsellorId: assignment.counsellorId };
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return { created: false, reason: "ALREADY_ESCALATED" };
    }
    throw err;
  }
}
