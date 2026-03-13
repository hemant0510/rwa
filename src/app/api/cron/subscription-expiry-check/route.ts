import { NextRequest } from "next/server";

import { forbiddenError, internalError, successResponse } from "@/lib/api-helpers";
import { diffDaysUtc, toPeriodKey } from "@/lib/billing";
import { verifyCronSecret } from "@/lib/cron-auth";
import { sendEmail } from "@/lib/email";
import { getSubscriptionReminderEmailHtml } from "@/lib/email-templates/subscription";
import { prisma } from "@/lib/prisma";

async function notifyOnce(
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
    const subs = await prisma.societySubscription.findMany({
      where: { status: { in: ["ACTIVE", "EXPIRED"] }, currentPeriodEnd: { not: null } },
      select: { id: true, societyId: true, currentPeriodEnd: true, status: true },
    });

    let remindersSent = 0;
    let autoExpired = 0;
    let autoSuspended = 0;

    for (const sub of subs) {
      if (!sub.currentPeriodEnd) continue;
      const days = diffDaysUtc(today, sub.currentPeriodEnd);
      const periodKey = toPeriodKey(sub.currentPeriodEnd);

      if (days === 30) {
        if (
          await notifyOnce(
            sub.societyId,
            "subscription-expiry-30d",
            periodKey,
            "Subscription Expiry Reminder (30 days)",
            "Your subscription will expire in 30 days. Please renew on time.",
          )
        ) {
          remindersSent += 1;
        }
      } else if (days === 7) {
        if (
          await notifyOnce(
            sub.societyId,
            "subscription-expiry-7d",
            periodKey,
            "Subscription Expiry Reminder (7 days)",
            "Your subscription will expire in 7 days. Please renew to avoid interruption.",
          )
        ) {
          remindersSent += 1;
        }
      } else if (days === 1) {
        if (
          await notifyOnce(
            sub.societyId,
            "subscription-expiry-1d",
            periodKey,
            "Subscription Expiry Reminder (1 day)",
            "Your subscription will expire tomorrow. Please renew now.",
          )
        ) {
          remindersSent += 1;
        }
      } else if (days === 0 && sub.status !== "EXPIRED") {
        await prisma.$transaction(async (tx) => {
          await tx.societySubscription.update({
            where: { id: sub.id },
            data: { status: "EXPIRED" },
          });
          await tx.society.update({ where: { id: sub.societyId }, data: { status: "ACTIVE" } });
          await tx.societySubscriptionHistory.create({
            data: {
              subscriptionId: sub.id,
              societyId: sub.societyId,
              changeType: "AUTO_EXPIRED",
              performedBy: "SYSTEM",
              notes: "Auto-expired by cron",
            },
          });
        });
        autoExpired += 1;
      } else if (days === -7 && sub.status !== "SUSPENDED") {
        await prisma.$transaction(async (tx) => {
          await tx.societySubscription.update({
            where: { id: sub.id },
            data: { status: "SUSPENDED" },
          });
          await tx.society.update({ where: { id: sub.societyId }, data: { status: "SUSPENDED" } });
          await tx.societySubscriptionHistory.create({
            data: {
              subscriptionId: sub.id,
              societyId: sub.societyId,
              changeType: "AUTO_SUSPENDED",
              performedBy: "SYSTEM",
              notes: "Auto-suspended after grace period",
            },
          });
        });
        autoSuspended += 1;
      }
    }

    return successResponse({ remindersSent, autoExpired, autoSuspended });
  } catch {
    return internalError("Failed to run subscription expiry check");
  }
}
