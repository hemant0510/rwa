import { NextRequest } from "next/server";

import { forbiddenError, internalError, successResponse } from "@/lib/api-helpers";
import { verifyCronSecret } from "@/lib/cron-auth";
import { sendEmail } from "@/lib/email";
import { prisma } from "@/lib/prisma";

const BREACH_TEMPLATE_KEY = "counsellor-sla-breach";
const OPEN_STATUSES = ["PENDING", "ACKNOWLEDGED", "REVIEWING"] as const;

function buildBreachEmailHtml(params: {
  counsellorName: string;
  societyName: string;
  ticketNumber: number;
  subject: string;
  deadline: Date;
  hoursOverdue: number;
}) {
  return `
    <p>Hello ${params.counsellorName},</p>
    <p>An escalated resident ticket has breached the 72-hour counsellor SLA.</p>
    <ul>
      <li><strong>Society:</strong> ${params.societyName}</li>
      <li><strong>Ticket:</strong> ${params.ticketNumber} — ${params.subject}</li>
      <li><strong>SLA Deadline:</strong> ${params.deadline.toISOString()}</li>
      <li><strong>Hours Overdue:</strong> ${params.hoursOverdue}</li>
    </ul>
    <p>Please review and respond to this escalation as soon as possible.</p>
  `;
}

export async function POST(request: NextRequest) {
  if (!verifyCronSecret(request)) return forbiddenError("Invalid cron secret");

  try {
    const now = new Date();

    const breaches = await prisma.residentTicketEscalation.findMany({
      where: {
        status: { in: [...OPEN_STATUSES] },
        slaDeadline: { lt: now, not: null },
      },
      select: {
        id: true,
        slaDeadline: true,
        counsellor: { select: { id: true, name: true, email: true } },
        ticket: {
          select: {
            id: true,
            ticketNumber: true,
            subject: true,
            societyId: true,
            society: { select: { name: true } },
          },
        },
      },
    });

    let notified = 0;

    for (const breach of breaches) {
      if (!breach.slaDeadline) continue;

      const existing = await prisma.notificationLog.findUnique({
        where: {
          societyId_templateKey_periodKey: {
            societyId: breach.ticket.societyId,
            templateKey: BREACH_TEMPLATE_KEY,
            periodKey: breach.id,
          },
        },
      });
      if (existing) continue;

      const hoursOverdue = Math.ceil(
        (now.getTime() - breach.slaDeadline.getTime()) / (60 * 60 * 1000),
      );

      const html = buildBreachEmailHtml({
        counsellorName: breach.counsellor.name,
        societyName: breach.ticket.society.name,
        ticketNumber: breach.ticket.ticketNumber,
        subject: breach.ticket.subject,
        deadline: breach.slaDeadline,
        hoursOverdue,
      });

      await sendEmail(
        breach.counsellor.email,
        `[SLA Breach] Escalation overdue — ${breach.ticket.ticketNumber}`,
        html,
      );

      await prisma.notificationLog.create({
        data: {
          societyId: breach.ticket.societyId,
          templateKey: BREACH_TEMPLATE_KEY,
          periodKey: breach.id,
        },
      });

      notified += 1;
    }

    return successResponse({ breaches: breaches.length, notified });
  } catch (err) {
    console.error("[Cron Counsellor SLA Breach]", err);
    return internalError("Failed to run counsellor SLA breach check");
  }
}
