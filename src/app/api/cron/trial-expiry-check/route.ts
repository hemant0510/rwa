import { NextRequest } from "next/server";

import { forbiddenError, internalError, successResponse } from "@/lib/api-helpers";
import { diffDaysUtc, toPeriodKey } from "@/lib/billing";
import { verifyCronSecret } from "@/lib/cron-auth";
import { sendEmail } from "@/lib/email";
import { getSubscriptionReminderEmailHtml } from "@/lib/email-templates/subscription";
import { prisma } from "@/lib/prisma";

async function notifyTrial(
  societyId: string,
  templateKey: string,
  periodKey: string,
  subject: string,
  message: string,
) {
  const existing = await prisma.notificationLog.findUnique({
    where: { societyId_templateKey_periodKey: { societyId, templateKey, periodKey } },
  });
  if (existing) return false;

  const [society, admins] = await Promise.all([
    prisma.society.findUnique({ where: { id: societyId }, select: { name: true } }),
    prisma.user.findMany({ where: { societyId, role: "RWA_ADMIN" }, select: { email: true } }),
  ]);
  const html = getSubscriptionReminderEmailHtml({
    societyName: society?.name ?? "Society",
    subject,
    message,
  });

  await Promise.allSettled(admins.map((a) => sendEmail(a.email, subject, html)));
  await prisma.notificationLog.create({ data: { societyId, templateKey, periodKey } });
  return true;
}

export async function POST(request: NextRequest) {
  try {
    if (!verifyCronSecret(request)) return forbiddenError("Invalid cron secret");

    const today = new Date();
    const trials = await prisma.societySubscription.findMany({
      where: { status: "TRIAL", trialEndsAt: { not: null } },
      select: { id: true, societyId: true, trialEndsAt: true },
    });

    let remindersSent = 0;
    let expired = 0;

    for (const trial of trials) {
      if (!trial.trialEndsAt) continue;
      const days = diffDaysUtc(today, trial.trialEndsAt);
      const periodKey = toPeriodKey(trial.trialEndsAt);

      if (days === 7) {
        if (
          await notifyTrial(
            trial.societyId,
            "trial-ending-7d",
            periodKey,
            "Trial Ending in 7 Days",
            "Your free trial will end in 7 days. Please select a plan to continue.",
          )
        ) {
          remindersSent += 1;
        }
      } else if (days === 1) {
        if (
          await notifyTrial(
            trial.societyId,
            "trial-ending-1d",
            periodKey,
            "Trial Ending Tomorrow",
            "Your free trial will end tomorrow. Please select a subscription plan.",
          )
        ) {
          remindersSent += 1;
        }
      } else if (days === 0) {
        await prisma.societySubscription.update({
          where: { id: trial.id },
          data: { status: "EXPIRED" },
        });
        expired += 1;
      }
    }

    return successResponse({ remindersSent, expired });
  } catch {
    return internalError("Failed to run trial expiry check");
  }
}
