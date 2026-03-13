import { NextRequest } from "next/server";

import { parseBody, internalError, successResponse } from "@/lib/api-helpers";
import { sendEmail } from "@/lib/email";
import { getSubscriptionReminderEmailHtml } from "@/lib/email-templates/subscription";
import { prisma } from "@/lib/prisma";
import { sendBulkRemindersSchema } from "@/lib/validations/billing";

function getReminderContent(templateKey: "expiry-reminder" | "overdue-reminder" | "trial-ending") {
  if (templateKey === "overdue-reminder") {
    return {
      subject: "Subscription Payment Overdue",
      message:
        "Your subscription payment is overdue. Please complete payment to avoid service interruption.",
    };
  }
  if (templateKey === "trial-ending") {
    return {
      subject: "Your Trial Is Ending Soon",
      message:
        "Your trial period will end shortly. Please complete your subscription to continue access.",
    };
  }
  return {
    subject: "Subscription Expiry Reminder",
    message: "Your subscription is expiring soon. Please renew to ensure uninterrupted access.",
  };
}

// POST /api/v1/super-admin/billing/send-bulk-reminders
export async function POST(request: NextRequest) {
  try {
    const { data, error } = await parseBody(request, sendBulkRemindersSchema);
    if (error) return error;
    if (!data) return internalError();

    const societies = await prisma.society.findMany({
      where: { id: { in: data.societyIds } },
      select: { id: true, name: true },
    });
    const nameBySociety = new Map(societies.map((s) => [s.id, s.name]));

    const admins = await prisma.user.findMany({
      where: { societyId: { in: data.societyIds }, role: "RWA_ADMIN" },
      select: { email: true, societyId: true },
    });

    const content = getReminderContent(data.templateKey);
    const results = await Promise.allSettled(
      admins.map(async (admin) => {
        const html = getSubscriptionReminderEmailHtml({
          societyName: nameBySociety.get(admin.societyId || "") ?? "Society",
          subject: content.subject,
          message: content.message,
        });
        await sendEmail(admin.email, content.subject, html);
      }),
    );
    const sent = results.filter((r) => r.status === "fulfilled").length;
    const failed = results.filter((r) => r.status === "rejected").length;

    return successResponse({ sent, failed });
  } catch {
    return internalError("Failed to send bulk reminders");
  }
}
