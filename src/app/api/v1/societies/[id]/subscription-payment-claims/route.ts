import { NextRequest } from "next/server";

import {
  errorResponse,
  internalError,
  successResponse,
  unauthorizedError,
  validationError,
} from "@/lib/api-helpers";
import { logAudit } from "@/lib/audit";
import { sendEmail } from "@/lib/email";
import { getFullAccessAdmin } from "@/lib/get-current-user";
import { prisma } from "@/lib/prisma";
import { subscriptionClaimSchema } from "@/lib/validations/payment-claim";

type RouteParams = { params: Promise<{ id: string }> };

/** GET /api/v1/societies/[id]/subscription-payment-claims — list own society's claims */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  const { id: societyId } = await params;

  const admin = await getFullAccessAdmin();
  if (!admin) return unauthorizedError("Admin authentication required");
  if (admin.societyId !== societyId) return unauthorizedError("Society mismatch");

  try {
    const claims = await prisma.subscriptionPaymentClaim.findMany({
      where: { societyId },
      orderBy: { createdAt: "desc" },
    });

    return successResponse({ claims });
  } catch (err) {
    console.error("[Sub Claims GET]", err);
    return internalError();
  }
}

/** POST /api/v1/societies/[id]/subscription-payment-claims — admin submits a subscription payment claim */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const { id: societyId } = await params;

  const admin = await getFullAccessAdmin();
  if (!admin) return unauthorizedError("Admin authentication required");
  if (admin.societyId !== societyId) return unauthorizedError("Society mismatch");

  try {
    const body = await request.json();
    const result = subscriptionClaimSchema.safeParse(body);

    if (!result.success) {
      return validationError(result.error);
    }

    const { amount, utrNumber, paymentDate, screenshotUrl, periodStart, periodEnd } = result.data;
    const normalizedUtr = utrNumber.toUpperCase();

    // Derive active subscription server-side
    const subscription = await prisma.societySubscription.findFirst({
      where: { societyId, status: { in: ["ACTIVE", "TRIAL"] } },
      orderBy: { createdAt: "desc" },
    });

    if (!subscription) {
      return errorResponse({
        code: "NO_ACTIVE_SUBSCRIPTION",
        message: "No active subscription found for this society",
        status: 400,
      });
    }

    // Check for duplicate UTR
    const existingUtr = await prisma.subscriptionPaymentClaim.findFirst({
      where: { utrNumber: normalizedUtr },
    });

    if (existingUtr) {
      return errorResponse({
        code: "UTR_DUPLICATE",
        message: "This UTR has already been used",
        status: 409,
      });
    }

    // Check for existing pending claim for same subscription
    const existingPending = await prisma.subscriptionPaymentClaim.findFirst({
      where: {
        societyId,
        subscriptionId: subscription.id,
        status: "PENDING",
      },
    });

    if (existingPending) {
      return errorResponse({
        code: "CLAIM_ALREADY_PENDING",
        message: "You already have a pending subscription payment claim",
        status: 400,
      });
    }

    const claim = await prisma.subscriptionPaymentClaim.create({
      data: {
        societyId,
        subscriptionId: subscription.id,
        amount,
        utrNumber: normalizedUtr,
        paymentDate: new Date(paymentDate),
        screenshotUrl: screenshotUrl ?? null,
        periodStart: new Date(periodStart),
        periodEnd: new Date(periodEnd),
        status: "PENDING",
      },
    });

    void logAudit({
      actionType: "SUBSCRIPTION_CLAIM_SUBMITTED",
      userId: admin.userId,
      societyId,
      entityType: "SubscriptionPaymentClaim",
      entityId: claim.id,
      newValue: { amount, utrNumber: normalizedUtr },
    });

    void (async () => {
      const saEmail = process.env.SUPER_ADMIN_NOTIFICATION_EMAIL;
      if (saEmail) {
        const society = await prisma.society.findUnique({
          where: { id: societyId },
          select: { name: true },
        });
        await sendEmail(
          saEmail,
          "Sub Payment Claim",
          `<p>Society: ${society?.name ?? societyId}</p><p>Amount: ₹${amount.toLocaleString("en-IN")}</p><p>UTR: ${normalizedUtr}</p>`,
        );
      }
    })();

    return successResponse({ claim }, 201);
  } catch (err) {
    console.error("[Sub Claims POST]", err);
    return internalError();
  }
}
