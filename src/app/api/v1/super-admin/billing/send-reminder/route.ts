import { NextRequest } from "next/server";

import { parseBody, internalError, successResponse, notFoundError } from "@/lib/api-helpers";
import { requireSuperAdmin } from "@/lib/auth-guard";
import { sendEmail } from "@/lib/email";
import { getSubscriptionReminderEmailHtml } from "@/lib/email-templates/subscription";
import { prisma } from "@/lib/prisma";
import { sendReminderSchema } from "@/lib/validations/billing";

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

// POST /api/v1/super-admin/billing/send-reminder
export async function POST(request: NextRequest) {
  const auth = await requireSuperAdmin();
  if (auth.error) return auth.error;

  try {
    const { data, error } = await parseBody(request, sendReminderSchema);
    if (error) return error;
    if (!data) return internalError();

    const society = await prisma.society.findUnique({
      where: { id: data.societyId },
      select: { id: true, name: true },
    });
    if (!society) return notFoundError("Society not found");

    const admins = await prisma.user.findMany({
      where: { societyId: data.societyId, role: "RWA_ADMIN" },
      select: { email: true },
    });

    const recipients = admins.map((a) => a.email).filter(Boolean);
    if (recipients.length === 0) return notFoundError("No RWA admin email found for this society");

    const content = getReminderContent(data.templateKey);
    const html = getSubscriptionReminderEmailHtml({
      societyName: society.name,
      subject: content.subject,
      message: content.message,
    });

    await Promise.all(recipients.map((email) => sendEmail(email, content.subject, html)));

    return successResponse({ sent: recipients.length });
  } catch {
    return internalError("Failed to send reminder");
  }
}
