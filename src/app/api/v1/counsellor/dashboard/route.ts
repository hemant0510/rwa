import { internalError, successResponse } from "@/lib/api-helpers";
import { requireCounsellor } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";

const OPEN_ESCALATION_STATUSES = ["PENDING", "ACKNOWLEDGED", "REVIEWING"] as const;

export async function GET() {
  const auth = await requireCounsellor();
  if (auth.error) return auth.error;

  const counsellorId = auth.data.counsellorId;

  try {
    const [counsellor, assignments, escalations] = await Promise.all([
      prisma.counsellor.findUnique({
        where: { id: counsellorId },
        select: { id: true, name: true, email: true, photoUrl: true },
      }),
      prisma.counsellorSocietyAssignment.findMany({
        where: { counsellorId, isActive: true },
        orderBy: { assignedAt: "desc" },
        select: {
          isPrimary: true,
          society: {
            select: {
              id: true,
              name: true,
              societyCode: true,
              city: true,
              state: true,
              totalUnits: true,
              _count: { select: { users: { where: { role: "RESIDENT" } } } },
            },
          },
        },
      }),
      prisma.residentTicketEscalation.findMany({
        where: {
          counsellorId,
          status: { in: [...OPEN_ESCALATION_STATUSES] },
        },
        select: {
          status: true,
          ticket: { select: { societyId: true } },
        },
      }),
    ]);

    /* v8 ignore start */
    if (!counsellor) return internalError("Counsellor not found");
    /* v8 ignore stop */

    const perSocietyOpen = new Map<string, number>();
    let pendingAck = 0;
    for (const e of escalations) {
      perSocietyOpen.set(e.ticket.societyId, (perSocietyOpen.get(e.ticket.societyId) ?? 0) + 1);
      if (e.status === "PENDING") pendingAck += 1;
    }

    const societies = assignments.map((a) => ({
      id: a.society.id,
      name: a.society.name,
      societyCode: a.society.societyCode,
      city: a.society.city,
      state: a.society.state,
      totalUnits: a.society.totalUnits,
      isPrimary: a.isPrimary,
      openEscalations: perSocietyOpen.get(a.society.id) ?? 0,
    }));

    const totals = {
      societies: assignments.length,
      residents: assignments.reduce((sum, a) => sum + a.society._count.users, 0),
      openEscalations: escalations.length,
      pendingAck,
    };

    return successResponse({ counsellor, totals, societies });
  } catch {
    return internalError("Failed to load counsellor dashboard");
  }
}
