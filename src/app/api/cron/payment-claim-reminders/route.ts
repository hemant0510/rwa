import { NextRequest } from "next/server";

import { forbiddenError, internalError, successResponse } from "@/lib/api-helpers";
import { verifyCronSecret } from "@/lib/cron-auth";
import { prisma } from "@/lib/prisma";
import { sendAdminClaimReminder24h, sendAdminClaimReminder48h } from "@/lib/whatsapp";

function groupBySociety(claims: { societyId: string }[]): Record<string, number> {
  return claims.reduce<Record<string, number>>((acc, claim) => {
    acc[claim.societyId] = (acc[claim.societyId] ?? 0) + 1;
    return acc;
  }, {});
}

/** POST /api/cron/payment-claim-reminders
 * Sends WhatsApp reminders to admins for pending payment claims.
 * 24h: claims between 24–48h old; 48h: claims older than 48h.
 * Scheduled: 0 9 * * * (daily at 9am)
 */
export async function POST(request: NextRequest) {
  if (!verifyCronSecret(request)) return forbiddenError("Invalid cron secret");

  try {
    const now = new Date();
    const ago24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const ago48h = new Date(now.getTime() - 48 * 60 * 60 * 1000);

    const [claims24h, claims48h] = await Promise.all([
      prisma.paymentClaim.findMany({
        where: { status: "PENDING", createdAt: { gte: ago48h, lt: ago24h } },
        select: { societyId: true },
      }),
      prisma.paymentClaim.findMany({
        where: { status: "PENDING", createdAt: { lt: ago48h } },
        select: { societyId: true },
      }),
    ]);

    const counts24h = groupBySociety(claims24h);
    const counts48h = groupBySociety(claims48h);

    let notified24h = 0;
    let notified48h = 0;

    for (const [societyId, count] of Object.entries(counts24h)) {
      const admin = await prisma.user.findFirst({
        where: { societyId, role: "RWA_ADMIN" },
        select: { mobile: true },
      });
      if (admin?.mobile) {
        await sendAdminClaimReminder24h(admin.mobile, String(count));
        notified24h++;
      }
    }

    for (const [societyId, count] of Object.entries(counts48h)) {
      const admin = await prisma.user.findFirst({
        where: { societyId, role: "RWA_ADMIN" },
        select: { mobile: true },
      });
      if (admin?.mobile) {
        await sendAdminClaimReminder48h(admin.mobile, String(count));
        notified48h++;
      }
    }

    return successResponse({ notified24h, notified48h });
  } catch {
    return internalError("Failed to send reminders");
  }
}
